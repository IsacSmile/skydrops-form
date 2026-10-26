import { readGoogleConfig } from "./google-sheets";
import { syncPendingSubmissions } from "./sheets-sync";
import { cleanupOrphanBlobs } from "./blob-cleanup";
import { purgeOldRateLimits } from "./rate-limit";

export interface MaintenanceOptions {
  maxDurationMs?: number;
  now?: Date;
  dryRun?: boolean;
}

export interface MaintenanceResult {
  ok: true;
  syncAttempted: number;
  syncSucceeded: number;
  blobsDeleted: number;
  rateLimitRowsDeleted: number;
  durationMs: number;
}

function isGoogleConfigured(): boolean {
  try {
    readGoogleConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs scheduled maintenance tasks with a time budget of ~50 seconds:
 * 1. syncPendingSubmissions(50) if Google Sheets is configured
 * 2. cleanupOrphanBlobs() if BLOB_READ_WRITE_TOKEN is set
 * 3. purgeOldRateLimits(86400)
 *
 * Each task runs in its own try/catch block so one failure never stops others.
 * Never leaks secrets, URLs, or answers.
 */
export async function runMaintenance(
  options?: MaintenanceOptions
): Promise<MaintenanceResult> {
  const startTime = Date.now();
  const maxDurationMs = options?.maxDurationMs ?? 50_000;

  let syncAttempted = 0;
  let syncSucceeded = 0;
  let blobsDeleted = 0;
  let rateLimitRowsDeleted = 0;

  // Task a: Sync pending/failed submissions to Google Sheets
  if (isGoogleConfigured() && Date.now() - startTime < maxDurationMs) {
    try {
      const syncResult = await syncPendingSubmissions(50);
      syncAttempted = syncResult.total;
      syncSucceeded = syncResult.synced;
    } catch (err: unknown) {
      console.error(
        "Maintenance Google Sheets sync error:",
        (err as Error)?.name || "SyncError"
      );
    }
  }

  // Task b: Clean up orphan blobs
  if (
    Boolean(process.env.BLOB_READ_WRITE_TOKEN) &&
    Date.now() - startTime < maxDurationMs
  ) {
    try {
      const blobResult = await cleanupOrphanBlobs({
        now: options?.now,
        dryRun: options?.dryRun,
      });
      blobsDeleted = blobResult.deleted;
    } catch (err: unknown) {
      console.error(
        "Maintenance orphan blob cleanup error:",
        (err as Error)?.name || "BlobCleanupError"
      );
    }
  }

  // Task c: Purge old rate limits (older than 24 hours)
  if (Date.now() - startTime < maxDurationMs) {
    try {
      rateLimitRowsDeleted = await purgeOldRateLimits(86400);
    } catch (err: unknown) {
      console.error(
        "Maintenance rate limit purge error:",
        (err as Error)?.name || "RateLimitPurgeError"
      );
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    ok: true,
    syncAttempted,
    syncSucceeded,
    blobsDeleted,
    rateLimitRowsDeleted,
    durationMs,
  };
}
