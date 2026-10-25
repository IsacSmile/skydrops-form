import type { Submission } from "./submissions-data";
import { syncSubmission } from "./sheets-sync";

/**
 * Post-submission hook called asynchronously after a submission is safely stored in Neon.
 * Pushes the new submission row to the designated Google Sheets tab.
 * Wrapped in try/catch so a hook failure can never fail the submission response.
 */
export async function afterSubmissionCreated(submission: Submission): Promise<void> {
  try {
    await syncSubmission(submission.id);
  } catch (err: unknown) {
    console.error(
      "afterSubmissionCreated hook error:",
      err instanceof Error ? err.message : String(err)
    );
  }
}
