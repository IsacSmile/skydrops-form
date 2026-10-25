import { eq, and, desc, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { forms, fields, submissions } from "@/db/schema";
import type { Form, FormStatus } from "@/types/form";
import { canTransition } from "./form-status";
import { generateSlug } from "./slug";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

export { isStructureLocked } from "@/types/form";

export interface FormListItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "closed";
  publishedAt: Date | null;
  sheetTab: string | null;
  createdAt: Date;
  updatedAt: Date;
  fieldCount: number;
  submissionCount: number;
}

/**
 * Lists all forms with their fieldCount and submissionCount in a single query.
 * Ordered by updatedAt desc.
 */
export async function listForms(): Promise<FormListItem[]> {
  const fcSub = db
    .select({
      formId: fields.formId,
      count: sql<number>`count(*)::int`.as("fc_count"),
    })
    .from(fields)
    .groupBy(fields.formId)
    .as("fc");

  const scSub = db
    .select({
      formId: submissions.formId,
      count: sql<number>`count(*)::int`.as("sc_count"),
    })
    .from(submissions)
    .groupBy(submissions.formId)
    .as("sc");

  const rows = await db
    .select({
      id: forms.id,
      slug: forms.slug,
      title: forms.title,
      description: forms.description,
      status: forms.status,
      publishedAt: forms.publishedAt,
      sheetTab: forms.sheetTab,
      createdAt: forms.createdAt,
      updatedAt: forms.updatedAt,
      fieldCount: sql<number>`COALESCE(${fcSub.count}, 0)`.as("field_count"),
      submissionCount: sql<number>`COALESCE(${scSub.count}, 0)`.as(
        "submission_count"
      ),
    })
    .from(forms)
    .leftJoin(fcSub, eq(forms.id, fcSub.formId))
    .leftJoin(scSub, eq(forms.id, scSub.formId))
    .orderBy(desc(forms.updatedAt));

  return rows.map((r) => ({
    ...r,
    fieldCount: Number(r.fieldCount),
    submissionCount: Number(r.submissionCount),
  }));
}

/**
 * Returns a form by ID or null if not found or if ID is not a valid UUID.
 */
export async function getForm(id: string): Promise<Form | null> {
  if (!isValidUuid(id)) {
    return null;
  }
  const [form] = await db.select().from(forms).where(eq(forms.id, id));
  return form || null;
}

/**
 * Creates a new form in draft status with an 8-character unique slug.
 * Retries up to 5 times on slug collision.
 */
export async function createForm(input: {
  title: string;
  description?: string | null;
}): Promise<Form> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const slug = generateSlug();
    try {
      const [inserted] = await db
        .insert(forms)
        .values({
          slug,
          title: input.title,
          description: input.description ?? null,
          status: "draft",
        })
        .returning();
      return inserted;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const isUniqueCollision =
        err?.code === "23505" ||
        err?.message?.includes("forms_slug_unique") ||
        err?.message?.includes("unique");

      if (isUniqueCollision && attempt < maxAttempts) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Failed to generate a unique slug after 5 attempts");
}

/**
 * Renames/updates an existing form. Returns updated form or null if not found.
 */
export async function updateForm(
  id: string,
  input: {
    title: string;
    description?: string | null;
  }
): Promise<Form | null> {
  if (!isValidUuid(id)) {
    return null;
  }

  const [updated] = await db
    .update(forms)
    .set({
      title: input.title,
      description: input.description ?? null,
      updatedAt: new Date(),
    })
    .where(eq(forms.id, id))
    .returning();

  return updated || null;
}

/**
 * Duplicates a form and all its fields into a new form with a unique slug.
 * Submissions are NOT copied. Atomic batch insert via db.batch.
 */
export async function duplicateForm(id: string): Promise<Form | null> {
  if (!isValidUuid(id)) {
    return null;
  }

  const original = await getForm(id);
  if (!original) {
    return null;
  }

  const originalFields = await db
    .select()
    .from(fields)
    .where(eq(fields.formId, id))
    .orderBy(asc(fields.position));

  const newTitle = `Copy of ${original.title}`.slice(0, 120);
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const newId = crypto.randomUUID();
    const newSlug = generateSlug();

    const newFormValues = {
      id: newId,
      slug: newSlug,
      title: newTitle,
      description: original.description,
      status: "draft" as const,
      publishedAt: null,
      sheetTab: null,
    };

    const newFieldsValues = originalFields.map((f) => ({
      id: crypto.randomUUID(),
      formId: newId,
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      placeholder: f.placeholder,
      options: f.options,
      position: f.position,
    }));

    try {
      if (newFieldsValues.length > 0) {
        const [insertedForms] = await db.batch([
          db.insert(forms).values(newFormValues).returning(),
          db.insert(fields).values(newFieldsValues),
        ]);
        return (insertedForms as Form[])[0];
      } else {
        const [inserted] = await db
          .insert(forms)
          .values(newFormValues)
          .returning();
        return inserted;
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const isUniqueCollision =
        err?.code === "23505" ||
        err?.message?.includes("forms_slug_unique") ||
        err?.message?.includes("unique");

      if (isUniqueCollision && attempt < maxAttempts) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to generate unique slug for duplicate form");
}

/**
 * Deletes a form and cascades fields/submissions. Returns boolean.
 */
export async function deleteForm(id: string): Promise<boolean> {
  if (!isValidUuid(id)) {
    return false;
  }

  const deleted = await db
    .delete(forms)
    .where(eq(forms.id, id))
    .returning({ id: forms.id });

  return deleted.length > 0;
}

export type FormStatusResultCode =
  | "FORM_NOT_FOUND"
  | "INVALID_TRANSITION"
  | "NO_FIELDS";

export type FormStatusResult =
  | { ok: true; form: Form }
  | { ok: false; code: FormStatusResultCode; message: string };

/**
 * Transitions form status according to allowed transitions:
 * - draft     -> published (Publish, requires at least 1 field)
 * - published -> draft     (Unpublish)
 * - published -> closed    (Close)
 * - closed    -> published (Reopen, requires at least 1 field)
 * - closed    -> draft     (Unpublish)
 *
 * publishedAt is set only the first time the form is published and never cleared.
 * Slug never changes.
 * Uses conditional update WHERE id = ? AND status = ? for concurrency safety.
 */
export async function setFormStatus(
  formId: string,
  targetStatus: FormStatus
): Promise<FormStatusResult> {
  if (!isValidUuid(formId)) {
    return { ok: false, code: "FORM_NOT_FOUND", message: "Form not found" };
  }

  const currentForm = await getForm(formId);
  if (!currentForm) {
    return { ok: false, code: "FORM_NOT_FOUND", message: "Form not found" };
  }

  if (!canTransition(currentForm.status, targetStatus)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Cannot transition form from "${currentForm.status}" to "${targetStatus}"`,
    };
  }

  // Publish and Reopen require at least 1 field
  if (targetStatus === "published") {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(fields)
      .where(eq(fields.formId, formId));

    const fieldCount = Number(countResult?.count ?? 0);
    if (fieldCount < 1) {
      return {
        ok: false,
        code: "NO_FIELDS",
        message: "Add at least one field before publishing.",
      };
    }
  }

  // Set publishedAt only the first time a form is published
  const shouldSetPublishedAt =
    targetStatus === "published" && currentForm.publishedAt === null;

  const updateSet: Record<string, unknown> = {
    status: targetStatus,
    updatedAt: new Date(),
  };

  if (shouldSetPublishedAt) {
    updateSet.publishedAt = new Date();
  }

  // Conditional update for concurrency safety
  const [updated] = await db
    .update(forms)
    .set(updateSet)
    .where(and(eq(forms.id, formId), eq(forms.status, currentForm.status)))
    .returning();

  if (!updated) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: "Form status was concurrently updated by another process",
    };
  }

  return { ok: true, form: updated };
}
