import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import type { SubmissionAnswers } from "./submission-validation";

export type Submission = typeof submissions.$inferSelect;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

export interface SubmissionStats {
  total: number;
  synced: number;
  pending: number;
  failed: number;
}

export interface SubmissionRow {
  id: string;
  createdAt: Date;
  data: Record<string, string | string[] | number | null>;
  syncStatus: "pending" | "synced" | "failed";
  syncAttempts: number;
  syncError: string | null;
  syncedAt: Date | null;
}

export interface ListSubmissionsResult {
  rows: SubmissionRow[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * Stores a form submission in the database with syncStatus 'pending'.
 * Pure data-access function: no next/* imports.
 */
export async function createSubmission(
  formId: string,
  data: SubmissionAnswers
): Promise<Submission> {
  const [created] = await db
    .insert(submissions)
    .values({
      formId,
      data,
      syncStatus: "pending",
      syncAttempts: 0,
    })
    .returning();

  return created;
}

/**
 * Computes submission statistics for a given form using ONE grouped SQL query:
 * { total, synced, pending, failed }
 */
export async function getSubmissionStats(formId: string): Promise<SubmissionStats> {
  if (!isValidUuid(formId)) {
    return { total: 0, synced: 0, pending: 0, failed: 0 };
  }

  const rows = await db
    .select({
      status: submissions.syncStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(submissions)
    .where(eq(submissions.formId, formId))
    .groupBy(submissions.syncStatus);

  let total = 0;
  let synced = 0;
  let pending = 0;
  let failed = 0;

  for (const r of rows) {
    total += r.count;
    if (r.status === "synced") synced = r.count;
    else if (r.status === "pending") pending = r.count;
    else if (r.status === "failed") failed = r.count;
  }

  return { total, synced, pending, failed };
}

/**
 * Lists submissions for a form ordered by createdAt desc with pagination.
 * Clamps page to a valid range (min 1, max pageCount).
 */
export async function listSubmissions(
  formId: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<ListSubmissionsResult> {
  if (!isValidUuid(formId)) {
    return { rows: [], total: 0, page: 1, pageCount: 1 };
  }

  const pageSize = Math.max(1, Math.min(options.pageSize ?? 25, 100));

  // Count total submissions
  const [countRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(submissions)
    .where(eq(submissions.formId, formId));

  const total = countRes?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Clamp page between 1 and pageCount
  const requestedPage = typeof options.page === "number" && !isNaN(options.page) ? options.page : 1;
  const clampedPage = Math.max(1, Math.min(requestedPage, pageCount));
  const offset = (clampedPage - 1) * pageSize;

  if (total === 0) {
    return { rows: [], total: 0, page: 1, pageCount: 1 };
  }

  const rows = await db
    .select({
      id: submissions.id,
      createdAt: submissions.createdAt,
      data: submissions.data,
      syncStatus: submissions.syncStatus,
      syncAttempts: submissions.syncAttempts,
      syncError: submissions.syncError,
      syncedAt: submissions.syncedAt,
    })
    .from(submissions)
    .where(eq(submissions.formId, formId))
    .orderBy(desc(submissions.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    rows,
    total,
    page: clampedPage,
    pageCount,
  };
}

/**
 * Retrieves a submission only if it belongs to the specified form.
 * Validates both IDs as UUIDs first; returns null on mismatch or invalid UUID.
 */
export async function getSubmissionForForm(
  formId: string,
  submissionId: string
): Promise<Submission | null> {
  if (!isValidUuid(formId) || !isValidUuid(submissionId)) {
    return null;
  }

  const [row] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.id, submissionId), eq(submissions.formId, formId)));

  return row ?? null;
}
