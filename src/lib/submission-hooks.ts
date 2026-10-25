import type { Submission } from "./submissions-data";

/**
 * Post-submission hook called asynchronously after a submission is safely stored in Neon.
 *
 * NOTE: Currently a NO-OP.
 * Component C8 will implement the Google Sheets synchronization here, pushing
 * new rows to the designated sheet tab.
 */
export async function afterSubmissionCreated(submission: Submission): Promise<void> {
  // NO-OP for C6. C8 will push the row to Google Sheets.
  void submission;
}
