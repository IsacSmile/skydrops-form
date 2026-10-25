"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  createForm,
  updateForm,
  duplicateForm,
  deleteForm,
} from "@/lib/forms-data";
import { formInputSchema } from "@/lib/validation";

export interface ActionResponse {
  success?: boolean;
  error?: string;
  fieldErrors?: {
    title?: string[];
    description?: string[];
  };
  formId?: string;
}

export async function createFormAction(
  prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse> {
  await requireAdmin();

  const rawTitle = formData.get("title");
  const rawDescription = formData.get("description");

  const validation = formInputSchema.safeParse({
    title: typeof rawTitle === "string" ? rawTitle : "",
    description: typeof rawDescription === "string" ? rawDescription : null,
  });

  if (!validation.success) {
    return {
      fieldErrors: validation.error.flatten().fieldErrors,
      error: "Please fix the validation errors below.",
    };
  }

  let createdId: string;
  try {
    const newForm = await createForm(validation.data);
    createdId = newForm.id;
    revalidatePath("/admin");
  } catch (err) {
    console.error("createFormAction error:", err);
    return { error: "Failed to create form. Please try again." };
  }

  redirect(`/admin/forms/${createdId}`);
}

export async function updateFormAction(
  id: string,
  prevState: ActionResponse | undefined,
  formData: FormData
): Promise<ActionResponse> {
  await requireAdmin();

  const rawTitle = formData.get("title");
  const rawDescription = formData.get("description");

  const validation = formInputSchema.safeParse({
    title: typeof rawTitle === "string" ? rawTitle : "",
    description: typeof rawDescription === "string" ? rawDescription : null,
  });

  if (!validation.success) {
    return {
      fieldErrors: validation.error.flatten().fieldErrors,
      error: "Please fix the validation errors below.",
    };
  }

  try {
    const updated = await updateForm(id, validation.data);
    if (!updated) {
      return { error: "Form not found or could not be updated." };
    }
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("updateFormAction error:", err);
    return { error: "Failed to update form. Please try again." };
  }
}

export async function duplicateFormAction(
  id: string
): Promise<ActionResponse> {
  await requireAdmin();

  try {
    const duplicated = await duplicateForm(id);
    if (!duplicated) {
      return { error: "Original form not found." };
    }
    revalidatePath("/admin");
    return { success: true, formId: duplicated.id };
  } catch (err) {
    console.error("duplicateFormAction error:", err);
    return { error: "Failed to duplicate form. Please try again." };
  }
}

export async function deleteFormAction(
  id: string
): Promise<ActionResponse> {
  await requireAdmin();

  try {
    const deleted = await deleteForm(id);
    if (!deleted) {
      return { error: "Form not found or could not be deleted." };
    }
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("deleteFormAction error:", err);
    return { error: "Failed to delete form. Please try again." };
  }
}
