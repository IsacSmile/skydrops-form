/**
 * Upload policy constants and validation helpers for Vercel Blob client uploads.
 * Pure module: safe for both client and server bundles.
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_FILE_TYPES: Record<string, readonly string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
} as const;

export const ALL_ALLOWED_MIME_TYPES = Object.keys(ALLOWED_FILE_TYPES);
export const ALL_ALLOWED_EXTENSIONS = Array.from(
  new Set(Object.values(ALLOWED_FILE_TYPES).flat())
);

// Formatted accept attribute for HTML file input
export const ACCEPT_ATTR = [
  ...ALL_ALLOWED_MIME_TYPES,
  ...ALL_ALLOWED_EXTENSIONS,
].join(",");

/**
 * Builds the canonical storage prefix for a form field's uploads:
 * `forms/${formId}/${fieldKey}/`
 */
export function buildUploadPrefix(formId: string, fieldKey: string): string {
  return `forms/${formId}/${fieldKey}/`;
}

/**
 * Sanitizes a user-provided file name:
 * - Keeps letters, digits, dot, dash, underscore
 * - Replaces forbidden characters with "-"
 * - Collapses consecutive dashes
 * - Keeps extension, capping total length to 80 chars
 * - Falls back to "file" if name is empty or entirely sanitized away
 */
export function sanitizeFileName(name: string): string {
  if (!name || typeof name !== "string") {
    return "file";
  }

  // Strip leading path separators / directory traversal
  const baseName = name.replace(/^.*[\\\/]/, "").trim();
  if (!baseName) {
    return "file";
  }

  const lastDot = baseName.lastIndexOf(".");
  let ext = "";
  let main = baseName;

  if (lastDot > 0) {
    ext = baseName.slice(lastDot).toLowerCase().replace(/[^a-z0-9.]/g, "");
    main = baseName.slice(0, lastDot);
  } else if (lastDot === 0) {
    main = "file";
    ext = baseName.toLowerCase().replace(/[^a-z0-9.]/g, "");
  }

  // Replace characters outside [a-zA-Z0-9.\-_] with "-"
  let cleanMain = main
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!cleanMain) {
    cleanMain = "file";
  }

  // Max 80 chars while preserving extension
  const maxMainLen = Math.max(1, 80 - ext.length);
  if (cleanMain.length > maxMainLen) {
    cleanMain = cleanMain.slice(0, maxMainLen).replace(/-+$/, "");
    if (!cleanMain) {
      cleanMain = "file";
    }
  }

  return `${cleanMain}${ext}`;
}

export interface AllowedFileCheck {
  name: string;
  type?: string;
  size: number;
}

export type AllowedFileResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Validates file size, MIME type, and extension.
 * Rejects empty files (size <= 0), files > 5 MB, and types not in ALLOWED_FILE_TYPES.
 * Requires that BOTH the MIME type and the extension match the allowed list.
 */
export function isAllowedFile(file: AllowedFileCheck): AllowedFileResult {
  if (typeof file.size !== "number" || file.size <= 0) {
    return { ok: false, message: "File is empty." };
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      message: "File is too large. Maximum size is 5 MB.",
    };
  }

  const mime = file.type ? file.type.toLowerCase().trim() : "";
  const lastDot = file.name ? file.name.lastIndexOf(".") : -1;
  const ext = lastDot >= 0 ? file.name.slice(lastDot).toLowerCase().trim() : "";

  const allowedExtsForMime = ALLOWED_FILE_TYPES[mime];
  if (!allowedExtsForMime || !ext || !allowedExtsForMime.includes(ext)) {
    return {
      ok: false,
      message:
        "This file type is not allowed. Use JPG, PNG, WebP, PDF, DOC or DOCX.",
    };
  }

  return { ok: true };
}

/**
 * Verifies that a blob URL belongs to the expected form and field:
 * - Valid URL string
 * - Protocol is https:
 * - Hostname ends with .public.blob.vercel-storage.com (without trailing dot or evil subdomains)
 * - Has no username, password, query params, or hash
 * - Decoded pathname starts with "/" + buildUploadPrefix(formId, fieldKey)
 * - Decoded pathname contains no ".." segments
 * Pure function: no I/O.
 */
export function isOwnBlobUrl(
  url: string,
  formId: string,
  fieldKey: string
): boolean {
  if (typeof url !== "string" || url.trim().length === 0) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const validSuffix = ".public.blob.vercel-storage.com";
  if (!host.endsWith(validSuffix) || host.endsWith(`${validSuffix}.`)) {
    return false;
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  if (parsed.search || parsed.hash) {
    return false;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    return false;
  }

  if (decodedPath.includes("..")) {
    return false;
  }

  const expectedPrefix = `/${buildUploadPrefix(formId, fieldKey)}`;
  if (!decodedPath.startsWith(expectedPrefix)) {
    return false;
  }

  return true;
}
