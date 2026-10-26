import { list, del, type ListBlobResult } from "@vercel/blob";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { fields, submissions } from "@/db/schema";

export interface CleanupOrphanBlobsOptions {
  olderThanMs?: number;
  maxDeletes?: number;
  now?: Date;
  dryRun?: boolean;
}

export interface CleanupOrphanBlobsResult {
  scanned: number;
  deleted: number;
  kept: number;
  errors: number;
}

function getCleanPath(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return u.pathname;
  } catch {
    return rawUrl.split("?")[0].split("#")[0];
  }
}

/**
 * Best-effort deletion of all blobs under `forms/${formId}/`.
 * Uses list() with cursor paging and del() in batches.
 * Safe for server actions and cleanup scripts.
 * - Skips silently if BLOB_READ_WRITE_TOKEN is not set.
 * - Never throws: catches all errors and logs only the error type.
 */
export async function cleanupFormBlobs(formId: string): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return;
  }

  try {
    const prefix = `forms/${formId}/`;
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const result: ListBlobResult = await list({
        prefix,
        cursor,
        limit: 1000,
      });

      const urls = result.blobs.map((b) => b.url);
      if (urls.length > 0) {
        await del(urls);
      }

      hasMore = result.hasMore;
      cursor = result.cursor;
    }
  } catch (err: unknown) {
    console.error(
      "Blob cleanup error type:",
      (err as Error)?.name || "BlobError"
    );
  }
}

/**
 * Finds and deletes orphan blobs under `forms/` that are unreferenced and older than olderThanMs.
 * - Queries all form file fields and collects referenced URLs from submissions.
 * - Compares by URL pathname.
 * - NEVER deletes outside "forms/".
 * - Deletes up to maxDeletes per run in batches of 100.
 * - If listing or DB query fails, stops immediately and returns counts so far.
 * - dryRun returns what would be deleted without calling del().
 */
export async function cleanupOrphanBlobs({
  olderThanMs = 24 * 60 * 60 * 1000,
  maxDeletes = 200,
  now,
  dryRun = false,
}: CleanupOrphanBlobsOptions = {}): Promise<CleanupOrphanBlobsResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { scanned: 0, deleted: 0, kept: 0, errors: 0 };
  }

  const nowMs = (now ?? new Date()).getTime();
  const cutoffTime = nowMs - olderThanMs;

  const referencedPaths = new Set<string>();

  // 1. Build set of referenced URL pathnames
  try {
    const fileFields = await db
      .select({ formId: fields.formId, key: fields.key })
      .from(fields)
      .where(eq(fields.type, "file"));

    for (const f of fileFields) {
      const rows = await db
        .select({
          url: sql<string | null>`${submissions.data}->>${f.key}`,
        })
        .from(submissions)
        .where(
          and(
            eq(submissions.formId, f.formId),
            sql`${submissions.data}->>${f.key} IS NOT NULL`
          )
        );

      for (const r of rows) {
        if (r.url && typeof r.url === "string") {
          const path = getCleanPath(r.url);
          if (path) {
            referencedPaths.add(path);
            referencedPaths.add(path.replace(/^\//, ""));
            referencedPaths.add("/" + path.replace(/^\//, ""));
          }
        }
      }
    }
  } catch (err: unknown) {
    console.error(
      "Blob cleanup DB query error:",
      (err as Error)?.name || "DbError"
    );
    return { scanned: 0, deleted: 0, kept: 0, errors: 1 };
  }

  // 2. List blobs under "forms/" prefix
  let scanned = 0;
  let kept = 0;
  let errors = 0;
  const toDeleteUrls: string[] = [];

  let cursor: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    let result: ListBlobResult;
    try {
      result = await list({
        prefix: "forms/",
        cursor,
        limit: 1000,
      });
    } catch (err: unknown) {
      console.error(
        "Blob cleanup listing error:",
        (err as Error)?.name || "BlobListError"
      );
      errors++;
      break;
    }

    for (const b of result.blobs) {
      scanned++;

      // Safety check: must be under forms/
      const isUnderForms =
        (b.pathname && b.pathname.startsWith("forms/")) ||
        (b.url &&
          (b.url.includes("/forms/") ||
            getCleanPath(b.url).startsWith("/forms/")));

      if (!isUnderForms) {
        kept++;
        continue;
      }

      // Must be older than olderThanMs
      const uploadedMs = b.uploadedAt.getTime();
      if (uploadedMs > cutoffTime) {
        kept++;
        continue;
      }

      // Check if referenced
      const blobPath = b.pathname || getCleanPath(b.url);
      const isReferenced =
        referencedPaths.has(blobPath) ||
        referencedPaths.has(getCleanPath(b.url)) ||
        referencedPaths.has(blobPath.replace(/^\//, "")) ||
        referencedPaths.has("/" + blobPath.replace(/^\//, ""));

      if (isReferenced) {
        kept++;
        continue;
      }

      // Old and unreferenced
      if (toDeleteUrls.length < maxDeletes) {
        toDeleteUrls.push(b.url);
      } else {
        kept++;
      }
    }

    hasMore = result.hasMore;
    cursor = result.cursor;

    if (toDeleteUrls.length >= maxDeletes) {
      break;
    }
  }

  // 3. Dry-run return or batch delete
  if (dryRun) {
    return {
      scanned,
      deleted: toDeleteUrls.length,
      kept,
      errors,
    };
  }

  let deleted = 0;
  for (let i = 0; i < toDeleteUrls.length; i += 100) {
    const batch = toDeleteUrls.slice(i, i + 100);
    try {
      await del(batch);
      deleted += batch.length;
    } catch (err: unknown) {
      console.error(
        "Blob batch deletion error:",
        (err as Error)?.name || "BlobDelError"
      );
      errors++;
      // Stop on error, do not delete further
      break;
    }
  }

  return {
    scanned,
    deleted,
    kept,
    errors,
  };
}
