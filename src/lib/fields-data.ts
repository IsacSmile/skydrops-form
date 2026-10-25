import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import { forms, fields } from "@/db/schema";
import type { Field } from "@/types/form";
import { generateFieldKey } from "./field-keys";
import { isStructureLocked, isValidUuid, getForm } from "./forms-data";
import {
  createFieldSchema,
  updateFieldSchema,
} from "./field-validation";

export type FieldResultCode =
  | "FORM_NOT_FOUND"
  | "FIELD_NOT_FOUND"
  | "LOCKED"
  | "LIMIT_REACHED"
  | "INVALID";

export type FieldResult<T = Field> =
  | { ok: true; field: T }
  | { ok: false; code: FieldResultCode; message: string };

const MAX_FIELDS_PER_FORM = 50;

/**
 * Lists all fields for a given form, ordered by position ascending.
 */
export async function listFields(formId: string): Promise<Field[]> {
  if (!isValidUuid(formId)) {
    return [];
  }

  return db
    .select()
    .from(fields)
    .where(eq(fields.formId, formId))
    .orderBy(asc(fields.position));
}

/**
 * Adds a new field to a form.
 * Enforces:
 * - Form existence
 * - Max 50 fields limit
 * - Zod validation on type, placeholder, options
 * - Stable, unique field key generation
 * - Position = max(positions) + 1
 * - Bumps forms.updated_at
 */
export async function addField(
  formId: string,
  rawInput: unknown
): Promise<FieldResult> {
  if (!isValidUuid(formId)) {
    return { ok: false, code: "FORM_NOT_FOUND", message: "Form not found" };
  }

  const parsed = createFieldSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      message: parsed.error.issues[0]?.message ?? "Invalid field input",
    };
  }

  const input = parsed.data;

  const form = await getForm(formId);
  if (!form) {
    return { ok: false, code: "FORM_NOT_FOUND", message: "Form not found" };
  }

  const existingFields = await listFields(formId);
  if (existingFields.length >= MAX_FIELDS_PER_FORM) {
    return {
      ok: false,
      code: "LIMIT_REACHED",
      message: `Maximum of ${MAX_FIELDS_PER_FORM} fields per form reached`,
    };
  }

  const nextPosition =
    existingFields.length === 0
      ? 0
      : Math.max(...existingFields.map((f) => f.position)) + 1;

  const existingKeys = new Set(existingFields.map((f) => f.key));

  // Retry key generation up to 3 times in case of concurrent key generation
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const key = generateFieldKey(input.label, existingKeys);

    try {
      const [inserted] = await db
        .insert(fields)
        .values({
          formId,
          key,
          label: input.label,
          type: input.type,
          required: input.required,
          placeholder: input.placeholder,
          options: input.options,
          position: nextPosition,
        })
        .returning();

      // Bump form updated_at
      await db
        .update(forms)
        .set({ updatedAt: new Date() })
        .where(eq(forms.id, formId));

      return { ok: true, field: inserted };
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const isUniqueCollision =
        err?.code === "23505" ||
        err?.message?.includes("fields_form_id_key_unique") ||
        err?.message?.includes("unique");

      if (isUniqueCollision && attempt < maxAttempts) {
        existingKeys.add(key);
        continue;
      }

      return {
        ok: false,
        code: "INVALID",
        message: "Failed to create field due to a database collision",
      };
    }
  }

  return {
    ok: false,
    code: "INVALID",
    message: "Failed to generate a unique key for the field",
  };
}

/**
 * Updates an existing field on a form.
 * Enforces:
 * - Form and field existence
 * - Field belongs to formId
 * - Structure lock rules:
 *   - Locked forms CANNOT change field type
 *   - Locked forms CANNOT remove or rename existing options (append-only)
 *   - Locked forms CAN update label, placeholder, required, and append options
 * - Key NEVER changes after creation
 * - Bumps forms.updated_at
 */
export async function updateField(
  formId: string,
  fieldId: string,
  rawInput: unknown
): Promise<FieldResult> {
  if (!isValidUuid(formId) || !isValidUuid(fieldId)) {
    return { ok: false, code: "FIELD_NOT_FOUND", message: "Field not found" };
  }

  const form = await getForm(formId);
  if (!form) {
    return { ok: false, code: "FORM_NOT_FOUND", message: "Form not found" };
  }

  const [existingField] = await db
    .select()
    .from(fields)
    .where(and(eq(fields.id, fieldId), eq(fields.formId, formId)));

  if (!existingField) {
    return { ok: false, code: "FIELD_NOT_FOUND", message: "Field not found" };
  }

  const locked = isStructureLocked(form);

  if (locked) {
    const rawObj =
      typeof rawInput === "object" && rawInput !== null
        ? (rawInput as Record<string, unknown>)
        : {};

    // Rule: Cannot change field type when locked
    if ("type" in rawObj && rawObj.type !== existingField.type) {
      return {
        ok: false,
        code: "LOCKED",
        message: "Cannot change field type on a published form",
      };
    }

    // Rule: Existing options must not be renamed or removed (append-only)
    if ("options" in rawObj && Array.isArray(rawObj.options)) {
      const existingOpts = existingField.options ?? [];
      const newOpts = rawObj.options.map((o) =>
        typeof o === "string" ? o.trim() : String(o)
      );

      if (newOpts.length < existingOpts.length) {
        return {
          ok: false,
          code: "LOCKED",
          message: "Cannot remove existing options on a published form",
        };
      }

      for (let i = 0; i < existingOpts.length; i++) {
        if (newOpts[i] !== existingOpts[i]) {
          return {
            ok: false,
            code: "LOCKED",
            message:
              "Existing options cannot be renamed or reordered on a published form; you may only append new options",
          };
        }
      }
    }
  }

  const parsed = updateFieldSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      message: parsed.error.issues[0]?.message ?? "Invalid field input",
    };
  }

  const input = parsed.data;

  const [updated] = await db
    .update(fields)
    .set({
      label: input.label,
      type: input.type,
      required: input.required,
      placeholder: input.placeholder,
      options: input.options,
    })
    .where(and(eq(fields.id, fieldId), eq(fields.formId, formId)))
    .returning();

  // Bump form updated_at
  await db
    .update(forms)
    .set({ updatedAt: new Date() })
    .where(eq(forms.id, formId));

  return { ok: true, field: updated };
}

/**
 * Deletes a field from a form.
 * Enforces:
 * - Form and field existence
 * - Field belongs to formId
 * - Structure lock rules: cannot delete fields if form is locked
 * - Bumps forms.updated_at
 */
export async function deleteField(
  formId: string,
  fieldId: string
): Promise<FieldResult> {
  if (!isValidUuid(formId) || !isValidUuid(fieldId)) {
    return { ok: false, code: "FIELD_NOT_FOUND", message: "Field not found" };
  }

  const form = await getForm(formId);
  if (!form) {
    return { ok: false, code: "FORM_NOT_FOUND", message: "Form not found" };
  }

  if (isStructureLocked(form)) {
    return {
      ok: false,
      code: "LOCKED",
      message: "Cannot delete fields from a published form",
    };
  }

  const [existingField] = await db
    .select()
    .from(fields)
    .where(and(eq(fields.id, fieldId), eq(fields.formId, formId)));

  if (!existingField) {
    return { ok: false, code: "FIELD_NOT_FOUND", message: "Field not found" };
  }

  const [deleted] = await db
    .delete(fields)
    .where(and(eq(fields.id, fieldId), eq(fields.formId, formId)))
    .returning();

  // Bump form updated_at
  await db
    .update(forms)
    .set({ updatedAt: new Date() })
    .where(eq(forms.id, formId));

  return { ok: true, field: deleted };
}

/**
 * Reorders fields in a form.
 * - Allowed whether or not the form is structure-locked.
 * - Verifies that orderedFieldIds contains EXACTLY the set of current field IDs for this form.
 * - Replaces positions with 0..n-1 atomically using db.batch.
 * - Bumps forms.updated_at in the same batch.
 */
export async function reorderFields(
  formId: string,
  orderedFieldIds: string[]
): Promise<FieldResult<{ reordered: boolean }>> {
  if (!isValidUuid(formId)) {
    return { ok: false, code: "FORM_NOT_FOUND", message: "Form not found" };
  }

  const form = await getForm(formId);
  if (!form) {
    return { ok: false, code: "FORM_NOT_FOUND", message: "Form not found" };
  }

  const existingFields = await listFields(formId);
  if (orderedFieldIds.length !== existingFields.length) {
    return {
      ok: false,
      code: "INVALID",
      message:
        "The reorder list does not match the number of fields in this form",
    };
  }

  // Check for duplicates
  const submittedSet = new Set(orderedFieldIds);
  if (submittedSet.size !== orderedFieldIds.length) {
    return {
      ok: false,
      code: "INVALID",
      message: "Duplicate field IDs found in reorder list",
    };
  }

  // Check that all submitted IDs belong to this form
  const existingIdSet = new Set(existingFields.map((f) => f.id));
  for (const id of orderedFieldIds) {
    if (!isValidUuid(id) || !existingIdSet.has(id)) {
      return {
        ok: false,
        code: "INVALID",
        message: "Invalid or foreign field ID in reorder list",
      };
    }
  }

  // Atomic batch update of positions and forms.updated_at
  const updates = orderedFieldIds.map((id, index) =>
    db
      .update(fields)
      .set({ position: index })
      .where(and(eq(fields.id, id), eq(fields.formId, formId)))
  );

  const bumpForm = db
    .update(forms)
    .set({ updatedAt: new Date() })
    .where(eq(forms.id, formId));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.batch([bumpForm, ...updates] as unknown as [any, ...any[]]);

  return { ok: true, field: { reordered: true } };
}
