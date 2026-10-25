"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { updateForm } from "@/lib/forms-data";
import {
  addField,
  updateField,
  deleteField,
  type FieldResultCode,
} from "@/lib/fields-data";
import { formInputSchema } from "@/lib/validation";
import {
  createFieldSchema,
  updateFieldSchema,
} from "@/lib/field-validation";
import type { Field } from "@/types/form";

export interface ActionResponse<T = unknown> {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
}

function mapResultCodeToMessage(code: FieldResultCode, fallback: string): string {
  switch (code) {
    case "FORM_NOT_FOUND":
      return "The requested form was not found.";
    case "FIELD_NOT_FOUND":
      return "The requested field was not found on this form.";
    case "LOCKED":
      return fallback || "This action is not allowed on a published form.";
    case "LIMIT_REACHED":
      return "Maximum limit of 50 fields reached for this form.";
    case "INVALID":
      return fallback || "Invalid field configuration provided.";
    default:
      return fallback || "An unexpected error occurred.";
  }
}

/**
 * Updates form title and description.
 */
export async function updateFormDetailsAction(
  formId: string,
  input: { title: string; description?: string | null }
): Promise<ActionResponse> {
  await requireAdmin();

  const validation = formInputSchema.safeParse(input);
  if (!validation.success) {
    return {
      error: "Please fix the validation errors below.",
      fieldErrors: validation.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await updateForm(formId, validation.data);
    if (!updated) {
      return { error: "Form not found or could not be updated." };
    }

    revalidatePath(`/admin/forms/${formId}`);
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("updateFormDetailsAction error:", err);
    return { error: "Failed to update form details. Please try again." };
  }
}

/**
 * Adds a new field to a form.
 */
export async function addFieldAction(
  formId: string,
  input: unknown
): Promise<ActionResponse<Field>> {
  await requireAdmin();

  // Validate upfront for detailed field errors
  const validation = createFieldSchema.safeParse(input);
  if (!validation.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of validation.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }
    return {
      error: validation.error.issues[0]?.message ?? "Invalid field input",
      fieldErrors,
    };
  }

  try {
    const result = await addField(formId, validation.data);
    if (!result.ok) {
      return {
        error: mapResultCodeToMessage(result.code, result.message),
      };
    }

    revalidatePath(`/admin/forms/${formId}`);
    revalidatePath("/admin");
    return { success: true, data: result.field };
  } catch (err) {
    console.error("addFieldAction error:", err);
    return { error: "Failed to add field. Please try again." };
  }
}

/**
 * Updates an existing field on a form.
 */
export async function updateFieldAction(
  formId: string,
  fieldId: string,
  input: unknown
): Promise<ActionResponse<Field>> {
  await requireAdmin();

  // Validate upfront for detailed field errors
  const validation = updateFieldSchema.safeParse(input);
  if (!validation.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of validation.error.issues) {
      const path = issue.path.join(".");
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }
    return {
      error: validation.error.issues[0]?.message ?? "Invalid field input",
      fieldErrors,
    };
  }

  try {
    const result = await updateField(formId, fieldId, validation.data);
    if (!result.ok) {
      return {
        error: mapResultCodeToMessage(result.code, result.message),
      };
    }

    revalidatePath(`/admin/forms/${formId}`);
    revalidatePath("/admin");
    return { success: true, data: result.field };
  } catch (err) {
    console.error("updateFieldAction error:", err);
    return { error: "Failed to update field. Please try again." };
  }
}

/**
 * Deletes a field from a form.
 */
export async function deleteFieldAction(
  formId: string,
  fieldId: string
): Promise<ActionResponse> {
  await requireAdmin();

  try {
    const result = await deleteField(formId, fieldId);
    if (!result.ok) {
      return {
        error: mapResultCodeToMessage(result.code, result.message),
      };
    }

    revalidatePath(`/admin/forms/${formId}`);
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("deleteFieldAction error:", err);
    return { error: "Failed to delete field. Please try again." };
  }
}
