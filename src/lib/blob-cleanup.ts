import { list, del, type ListBlobResult } from "@vercel/blob";

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
    console.error("Blob cleanup error type:", (err as Error)?.name || "BlobError");
  }
}
