"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  retrySubmission,
  retryFailedForForm,
  type RetryFailedResult,
} from "@/lib/sheets-sync";

const uuidSchema = z.string().uuid("Invalid ID format");

export interface ActionResponse<T = unknown> {
  success?: boolean;
  error?: string;
  data?: T;
}

/**
 * Retries synchronization for a single submission to Google Sheets.
 * Requires admin session. Validates UUIDs.
 */
export async function retrySubmissionAction(
  formId: string,
  submissionId: string
): Promise<ActionResponse<{ message: string }>> {
  await requireAdmin();

  const formParsed = uuidSchema.safeParse(formId);
  const subParsed = uuidSchema.safeParse(submissionId);

  if (!formParsed.success || !subParsed.success) {
    return { error: "Invalid form or submission ID format." };
  }

  const result = await retrySubmission(formId, submissionId);

  revalidatePath(`/admin/forms/${formId}/submissions`);
  revalidatePath(`/admin/forms/${formId}`);

  if (result.ok) {
    if (result.code === "ALREADY_SYNCED") {
      return {
        success: true,
        data: { message: "Submission is already synced to Google Sheets." },
      };
    }
    return {
      success: true,
      data: { message: "Submission synced successfully to Google Sheets." },
    };
  }

  let message = "Failed to sync submission to Google Sheets.";
  if (result.code === "NOT_FOUND") {
    message = "Submission not found for this form.";
  } else if (result.code === "NOT_RETRYABLE") {
    message = "Submission is still within the initial 2-minute sync window.";
  } else if (result.message) {
    message = result.message;
  }

  return { error: message };
}

/**
 * Retries all retryable submissions (failed or old pending) for a form.
 * Requires admin session. Validates formId.
 */
export async function retryFailedAction(
  formId: string
): Promise<ActionResponse<RetryFailedResult>> {
  await requireAdmin();

  const formParsed = uuidSchema.safeParse(formId);
  if (!formParsed.success) {
    return { error: "Invalid form ID format." };
  }

  const result = await retryFailedForForm(formId);

  revalidatePath(`/admin/forms/${formId}/submissions`);
  revalidatePath(`/admin/forms/${formId}`);

  return { success: true, data: result };
}
