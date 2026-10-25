import type { Field, Submission } from "@/types/form";

export const SHEET_TIMEZONE = "UTC"; // comment: change to e.g. "Asia/Kolkata" for local time

/**
 * Sanitizes a form title and slug to create a deterministic, valid Google Sheet tab name.
 * Rules:
 * - Remove forbidden characters: [ ] * ? : / \ and newlines
 * - Collapse whitespace and trim
 * - Strip leading/trailing apostrophes
 * - Truncate the title portion to 60 characters
 * - Fall back to "Form" if title is empty
 * - Return `${title} (${slug})`
 * - Total length <= 100
 */
export function sanitizeTabName(title: string, slug: string): string {
  // Remove forbidden characters [ ] * ? : / \ and newlines
  let cleaned = (title || "")
    .replace(/[\[\]*?:/\\]|\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Strip leading and trailing apostrophes
  cleaned = cleaned.replace(/^'+|'+$/g, "").trim();

  // Truncate title portion to 60 chars
  if (cleaned.length > 60) {
    cleaned = cleaned.slice(0, 60).trim();
  }

  // Fall back to "Form" if empty
  if (!cleaned) {
    cleaned = "Form";
  }

  const result = `${cleaned} (${slug})`;

  // Total length must not exceed 100 characters (Google Sheets tab limit)
  if (result.length > 100) {
    return result.slice(0, 100).trim();
  }

  return result;
}

/**
 * Builds the ordered column definitions for a form's fields.
 * Rule: fields sorted by createdAt ASC then position ASC.
 * (New fields append to the right; reordering position never moves sheet columns).
 */
export function buildColumns(fields: Field[]): Array<{ key: string; label: string }> {
  const sorted = [...fields].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return a.position - b.position;
  });

  return sorted.map((f) => ({ key: f.key, label: f.label }));
}

/**
 * Computes the header row for the sheet:
 * ["submitted_at", "submission_id", ...labels]
 * If two labels are identical, later ones are disambiguated by appending " (2)", " (3)".
 */
export function buildHeader(fields: Field[]): string[] {
  const cols = buildColumns(fields);
  const header: string[] = ["submitted_at", "submission_id"];
  const labelCounts = new Map<string, number>();

  for (const col of cols) {
    const count = labelCounts.get(col.label) ?? 0;
    labelCounts.set(col.label, count + 1);

    if (count === 0) {
      header.push(col.label);
    } else {
      header.push(`${col.label} (${count + 1})`);
    }
  }

  return header;
}

/**
 * Formula-injection guard for string values.
 * If a string starts with =, @, tab (\t), or carriage return (\r),
 * or starts with + or - followed by something that is NOT a digit, space, '(', or '.',
 * then prefix it with a single quote '.
 * Phone numbers like "+91 98765" and negative numbers like "-5" remain untouched.
 */
export function sanitizeCell(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  if (value.length === 0) {
    return value;
  }

  const firstChar = value[0];

  // Starts with =, @, tab, or carriage return
  if (firstChar === "=" || firstChar === "@" || firstChar === "\t" || firstChar === "\r") {
    return `'${value}`;
  }

  // Starts with + or -
  if (firstChar === "+" || firstChar === "-") {
    const secondChar = value.length > 1 ? value[1] : "";
    // If NOT followed by a digit, space, '(', or '.'
    if (!secondChar || !/[0-9\s(.]/.test(secondChar)) {
      return `'${value}`;
    }
  }

  return value;
}

/**
 * Formats a date as YYYY-MM-DD HH:mm:ss in the specified timezone using Intl.DateTimeFormat.
 */
export function formatSubmittedAt(date: Date, timeZone: string = SHEET_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * Builds the data row array for appending to the Google Sheet tab:
 * [submittedAt, submissionId, ...cells in buildColumns order]
 * Cell rules:
 * - null/undefined -> ""
 * - number -> number
 * - string[] -> items joined with ", "
 * - string -> string
 * sanitizeCell is applied to every string cell (including checkbox-joined strings).
 */
export function buildRow(
  submission: Pick<Submission, "id" | "createdAt" | "data">,
  fields: Field[]
): (string | number)[] {
  const submittedAt = formatSubmittedAt(new Date(submission.createdAt));
  const row: (string | number)[] = [submittedAt, submission.id];

  const cols = buildColumns(fields);
  const answers = (submission.data as Record<string, unknown>) || {};

  for (const col of cols) {
    const raw = answers[col.key];

    if (raw === null || raw === undefined) {
      row.push("");
    } else if (typeof raw === "number") {
      row.push(raw);
    } else if (Array.isArray(raw)) {
      const joined = raw.map((item) => String(item ?? "")).join(", ");
      row.push(sanitizeCell(joined) as string);
    } else if (typeof raw === "string") {
      row.push(sanitizeCell(raw) as string);
    } else {
      row.push(sanitizeCell(String(raw)) as string);
    }
  }

  return row;
}
