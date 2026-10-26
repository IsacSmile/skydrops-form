/**
 * Application feature flags.
 * isFileUploadsEnabled(): Returns true only when process.env.BLOB_READ_WRITE_TOKEN is set and non-empty.
 */
export function isFileUploadsEnabled(): boolean {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return Boolean(token && token.length > 0);
}
