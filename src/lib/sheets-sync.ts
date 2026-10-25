import { eq, and, or, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { forms, fields, submissions } from "@/db/schema";
import { getSubmissionForForm } from "./submissions-data";
import {
  readGoogleConfig,
  getSpreadsheetTabs,
  addTab,
  getValues,
  updateValues,
  appendRow,
  freezeAndFormatHeader,
  formatA1Range,
  SheetsNotConfiguredError,
  SheetsApiError,
} from "./google-sheets";
import {
  sanitizeTabName,
  buildHeader,
  buildRow,
} from "./sheet-format";

export interface SyncResult {
  ok: boolean;
  error?: string;
  alreadySynced?: boolean;
  alreadyPresent?: boolean;
  notConfigured?: boolean;
}

/**
 * Synchronizes a single submission with its form's Google Sheet tab.
 *
 * Steps:
 * 1. Load submission, form, and fields. If already 'synced', return ok.
 * 2. If Google is not configured: leave sync_status 'pending', set sync_error to
 *    "Google Sheets is not configured", do NOT increment attempts, return typed result.
 * 3. Ensure the tab: if forms.sheet_tab is null, create it with deterministic name.
 *    If Google says tab exists, look it up via getSpreadsheetTabs instead of failing.
 *    Persist sheet_tab and sheet_gid with conditional update.
 * 4. Header: compute buildHeader(fields). If differs from forms.sheet_header, write to row 1
 *    and persist sheet_header. Freeze row 1 and bold it on first creation (best-effort).
 * 5. Idempotency on retries: if sync_attempts > 0, check column B for submission.id and skip
 *    append if already present (mark synced).
 * 6. Append the row from buildRow, mapping cells by field key.
 * 7. On success: sync_status 'synced', synced_at now, sync_error null, attempts + 1.
 *    On failure: sync_status 'failed', attempts + 1, sync_error = safeMessage.
 *
 * Never throws out of syncSubmission; always returns a typed Result.
 */
export async function syncSubmission(submissionId: string): Promise<SyncResult> {
  // Step 1: Load the submission
  let subRow;
  try {
    const [found] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId));
    subRow = found;
  } catch (err: unknown) {
    return {
      ok: false,
      error: `Database error loading submission: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!subRow) {
    return { ok: false, error: "Submission not found" };
  }

  // Idempotency: if already synced, return ok
  if (subRow.syncStatus === "synced") {
    return { ok: true, alreadySynced: true };
  }

  // Load form
  let formRow;
  try {
    const [foundForm] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, subRow.formId));
    formRow = foundForm;
  } catch (err: unknown) {
    return {
      ok: false,
      error: `Database error loading form: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!formRow) {
    return { ok: false, error: "Form not found" };
  }

  // Load fields
  let formFields;
  try {
    formFields = await db
      .select()
      .from(fields)
      .where(eq(fields.formId, formRow.id))
      .orderBy(asc(fields.position));
  } catch (err: unknown) {
    return {
      ok: false,
      error: `Database error loading fields: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Step 2: Check Google configuration
  try {
    readGoogleConfig();
  } catch (err: unknown) {
    if (err instanceof SheetsNotConfiguredError) {
      // Leave sync_status 'pending', set sync_error, do NOT increment attempts
      try {
        await db
          .update(submissions)
          .set({
            syncError: "Google Sheets is not configured",
          })
          .where(eq(submissions.id, subRow.id));
      } catch {
        // ignore db error
      }
      return {
        ok: false,
        notConfigured: true,
        error: "Google Sheets is not configured",
      };
    }
  }

  try {
    // Step 3: Ensure the tab
    let currentTab = formRow.sheetTab;
    let currentGid = formRow.sheetGid;
    let isFirstTabCreation = false;

    if (!currentTab) {
      const targetTabTitle = sanitizeTabName(formRow.title, formRow.slug);
      let tabInfo: { gid: number; title: string };

      try {
        tabInfo = await addTab(targetTabTitle);
        isFirstTabCreation = true;
      } catch (err: unknown) {
        // If tab already exists (e.g. concurrent creation), look it up by title
        const existingTabs = await getSpreadsheetTabs();
        const found = existingTabs.find((t) => t.title === targetTabTitle);
        if (found) {
          tabInfo = found;
        } else {
          throw err;
        }
      }

      // Conditional update: WHERE id = ? AND sheet_tab IS NULL
      const updateResult = await db
        .update(forms)
        .set({
          sheetTab: tabInfo.title,
          sheetGid: tabInfo.gid,
          updatedAt: new Date(),
        })
        .where(and(eq(forms.id, formRow.id), sql`${forms.sheetTab} IS NULL`))
        .returning();

      if (updateResult.length > 0) {
        currentTab = tabInfo.title;
        currentGid = tabInfo.gid;
      } else {
        // Another concurrent request persisted sheet_tab; re-read from DB
        const [reloaded] = await db
          .select()
          .from(forms)
          .where(eq(forms.id, formRow.id));
        currentTab = reloaded?.sheetTab ?? tabInfo.title;
        currentGid = reloaded?.sheetGid ?? tabInfo.gid;
        formRow = reloaded ?? formRow;
      }
    }

    if (!currentTab) {
      throw new Error("Failed to determine sheet tab name.");
    }

    // Step 4: Ensure Header
    const newHeader = buildHeader(formFields);
    const existingHeader = formRow.sheetHeader;
    const headerChanged =
      !existingHeader ||
      JSON.stringify(newHeader) !== JSON.stringify(existingHeader);

    if (headerChanged) {
      // Write header to row 1 (A1 onward)
      const headerRange = formatA1Range(currentTab, "A1");
      await updateValues(headerRange, [newHeader]);

      // Persist new header in database
      await db
        .update(forms)
        .set({
          sheetHeader: newHeader,
          updatedAt: new Date(),
        })
        .where(eq(forms.id, formRow.id));

      formRow.sheetHeader = newHeader;
    }

    // Freeze row 1 and bold it on first creation (best effort)
    if (isFirstTabCreation && typeof currentGid === "number") {
      try {
        await freezeAndFormatHeader(currentGid);
      } catch {
        // Ignore cosmetic formatting errors
      }
    }

    // Step 5: Idempotency on retries: check column B for submission ID
    if (subRow.syncAttempts > 0) {
      const colBRange = formatA1Range(currentTab, "B:B");
      const colBValues = await getValues(colBRange);
      const isAlreadyPresent = colBValues.some(
        (row) => row && row[0] === subRow.id
      );

      if (isAlreadyPresent) {
        await db
          .update(submissions)
          .set({
            syncStatus: "synced",
            syncedAt: new Date(),
            syncError: null,
            syncAttempts: subRow.syncAttempts + 1,
          })
          .where(eq(submissions.id, subRow.id));

        return { ok: true, alreadyPresent: true };
      }
    }

    // Step 6: Append the row
    const rowValues = buildRow(subRow, formFields);
    await appendRow(currentTab, rowValues);

    // Step 7: On success: mark synced
    await db
      .update(submissions)
      .set({
        syncStatus: "synced",
        syncedAt: new Date(),
        syncError: null,
        syncAttempts: subRow.syncAttempts + 1,
      })
      .where(eq(submissions.id, subRow.id));

    return { ok: true };
  } catch (err: unknown) {
    // Step 7: On failure: mark failed with safe error message
    let safeMessage = "Google Sheets request failed";
    if (err instanceof SheetsApiError) {
      safeMessage = err.safeMessage;
    } else if (err instanceof Error) {
      safeMessage = err.message.slice(0, 500);
    }

    try {
      await db
        .update(submissions)
        .set({
          syncStatus: "failed",
          syncAttempts: subRow.syncAttempts + 1,
          syncError: safeMessage.slice(0, 500),
        })
        .where(eq(submissions.id, subRow.id));
    } catch {
      // ignore secondary db update error
    }

    return { ok: false, error: safeMessage };
  }
}

/**
 * Syncs submissions that are 'failed' or 'pending' older than 2 minutes,
 * oldest first, sequentially (up to limit).
 */
export async function syncPendingSubmissions(
  limit: number = 20
): Promise<{ total: number; synced: number; failed: number }> {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const pendingRows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      or(
        eq(submissions.syncStatus, "failed"),
        and(
          eq(submissions.syncStatus, "pending"),
          sql`${submissions.createdAt} < ${twoMinutesAgo}`
        )
      )
    )
    .orderBy(asc(submissions.createdAt))
    .limit(limit);

  let synced = 0;
  let failed = 0;

  for (const row of pendingRows) {
    const result = await syncSubmission(row.id);
    if (result.ok) {
      synced++;
    } else {
      failed++;
    }
  }

  return { total: pendingRows.length, synced, failed };
}

/**
 * Pure function to check if a submission is eligible for retry:
 * true if syncStatus is 'failed', OR 'pending' and created more than 2 minutes ago.
 */
export function isRetryable(
  submission: { syncStatus: string; createdAt: Date | string },
  now: Date = new Date()
): boolean {
  if (submission.syncStatus === "failed") {
    return true;
  }
  if (submission.syncStatus === "pending") {
    const createdMs = new Date(submission.createdAt).getTime();
    const nowMs = now.getTime();
    return nowMs - createdMs > 2 * 60 * 1000;
  }
  return false;
}

export type RetryResultCode =
  | "NOT_FOUND"
  | "NOT_RETRYABLE"
  | "ALREADY_SYNCED"
  | "SUCCESS"
  | "FAILED";

export interface RetrySubmissionResult {
  ok: boolean;
  code: RetryResultCode;
  message?: string;
  syncResult?: SyncResult;
}

export interface RetryFailedResult {
  attempted: number;
  synced: number;
  failed: number;
  remaining: number;
}

/**
 * Retries a single submission for a form:
 * - Verifies ownership via getSubmissionForForm
 * - Checks if retryable via isRetryable
 * - Calls syncSubmission
 */
export async function retrySubmission(
  formId: string,
  submissionId: string
): Promise<RetrySubmissionResult> {
  const sub = await getSubmissionForForm(formId, submissionId);
  if (!sub) {
    return { ok: false, code: "NOT_FOUND", message: "Submission not found" };
  }

  if (sub.syncStatus === "synced") {
    return { ok: true, code: "ALREADY_SYNCED", message: "Submission is already synced" };
  }

  if (!isRetryable(sub)) {
    return {
      ok: false,
      code: "NOT_RETRYABLE",
      message: "Submission is still within the initial 2-minute sync window",
    };
  }

  const syncRes = await syncSubmission(sub.id);
  if (syncRes.ok) {
    return { ok: true, code: "SUCCESS", syncResult: syncRes };
  } else {
    return {
      ok: false,
      code: "FAILED",
      message: syncRes.error || "Google Sheets sync failed",
      syncResult: syncRes,
    };
  }
}

/**
 * Retries this form's retryable submissions oldest first, sequentially, never more than limit,
 * and reports how many retryable ones remain.
 */
export async function retryFailedForForm(
  formId: string,
  limit: number = 20
): Promise<RetryFailedResult> {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const retryableRows = await db
    .select({
      id: submissions.id,
      createdAt: submissions.createdAt,
      syncStatus: submissions.syncStatus,
    })
    .from(submissions)
    .where(
      and(
        eq(submissions.formId, formId),
        or(
          eq(submissions.syncStatus, "failed"),
          and(
            eq(submissions.syncStatus, "pending"),
            sql`${submissions.createdAt} < ${twoMinutesAgo}`
          )
        )
      )
    )
    .orderBy(asc(submissions.createdAt));

  const toProcess = retryableRows.slice(0, limit);
  let synced = 0;
  let failed = 0;

  for (const row of toProcess) {
    const res = await syncSubmission(row.id);
    if (res.ok) {
      synced++;
    } else {
      failed++;
    }
  }

  const attempted = toProcess.length;
  const unattempted = retryableRows.length - toProcess.length;
  const remaining = unattempted + failed;

  return { attempted, synced, failed, remaining };
}

