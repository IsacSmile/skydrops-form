export const RESERVED_FIELD_KEYS = new Set([
  "id",
  "form_id",
  "submitted_at",
  "created_at",
]);

const MAX_KEY_LENGTH = 40;

/**
 * Generates a clean, unique, lowercase snake_case ASCII field key.
 * - Strips accents and non-ASCII/symbols
 * - Collapses non-alphanumeric chars to single underscores
 * - Trims leading and trailing underscores
 * - Falls back to "field" if empty
 * - Caps length at 40 characters
 * - Avoids reserved keys ("id", "form_id", "submitted_at", "created_at")
 * - Resolves collisions with existing keys by appending _2, _3, etc.
 */
export function generateFieldKey(
  label: string,
  existingKeys: Set<string>
): string {
  // Strip accents: normalize NFD and remove combining diacritical marks
  const normalized = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Lowercase and convert non-alphanumeric chars to underscores
  const cleaned = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  let base = cleaned.slice(0, MAX_KEY_LENGTH).replace(/_+$/, "");
  if (!base) {
    base = "field";
  }

  // If base is available and not reserved, return directly
  if (!RESERVED_FIELD_KEYS.has(base) && !existingKeys.has(base)) {
    return base;
  }

  // Suffix collision resolver: _2, _3, etc.
  let counter = 2;
  while (true) {
    const suffix = `_${counter}`;
    const maxPrefixLen = Math.max(1, MAX_KEY_LENGTH - suffix.length);
    const prefix = base.slice(0, maxPrefixLen).replace(/_+$/, "") || "field";
    const candidate = `${prefix}${suffix}`;

    if (!RESERVED_FIELD_KEYS.has(candidate) && !existingKeys.has(candidate)) {
      return candidate;
    }
    counter++;
  }
}
