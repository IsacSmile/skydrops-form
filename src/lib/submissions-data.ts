import { db } from "@/db";
import { submissions } from "@/db/schema";
import type { SubmissionAnswers } from "./submission-validation";

export type Submission = typeof submissions.$inferSelect;

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
