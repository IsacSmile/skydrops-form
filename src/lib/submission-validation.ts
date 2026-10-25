import type { Field } from "@/types/form";
import { FILE_UPLOADS_ENABLED } from "./feature-flags";

export type SubmissionAnswers = Record<string, string | string[] | number | null>;

export interface ValidationSuccess {
  ok: true;
  data: SubmissionAnswers;
}

export interface ValidationFailure {
  ok: false;
  fieldErrors: Record<string, string>;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9\s+\-().]{7,20}$/;
const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(str: string): boolean {
  if (!DATE_FORMAT_REGEX.test(str)) {
    return false;
  }
  const [yStr, mStr, dStr] = str.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);

  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return false;
  }

  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Validates a submission payload against the form's current fields.
 *
 * Rules:
 * - Trims all string inputs.
 * - Required fields: missing, "", null, or [] -> "This field is required."
 * - Optional empty values -> stored as null (checkbox -> []).
 * - short_text: max 500 chars.
 * - long_text: max 5000 chars.
 * - email: valid email, max 254 chars.
 * - phone: 7-20 chars, digits, spaces and + - ( ) .
 * - number: finite number, converts numeric strings to JS number.
 * - date: strict YYYY-MM-DD real calendar date.
 * - dropdown / radio: must match one of field.options exactly.
 * - checkbox: array of unique valid options; duplicates deduped; invalid options rejected.
 * - file: skipped while FILE_UPLOADS_ENABLED is false.
 * - Unknown keys in answers are dropped; only real field keys are stored.
 */
export function validateSubmission(
  fields: Field[],
  answers: Record<string, unknown>
): ValidationResult {
  const data: SubmissionAnswers = {};
  const fieldErrors: Record<string, string> = {};

  const activeFields = FILE_UPLOADS_ENABLED
    ? fields
    : fields.filter((f) => f.type !== "file");

  for (const field of activeFields) {
    const key = field.key;
    const raw = answers?.[key];
    const options = field.options ?? [];

    // 1. Checkbox field handling
    if (field.type === "checkbox") {
      let selected: string[] = [];
      if (Array.isArray(raw)) {
        selected = raw
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim());
      } else if (raw !== undefined && raw !== null && raw !== "") {
        fieldErrors[key] = "Please select valid options.";
        continue;
      }

      // Deduplicate selected items while preserving order
      const uniqueSelected = Array.from(new Set(selected));

      // Validate that all selected items belong to field.options
      const hasInvalidOption = uniqueSelected.some((opt) => !options.includes(opt));
      if (hasInvalidOption) {
        fieldErrors[key] = "Please select valid options.";
        continue;
      }

      if (field.required && uniqueSelected.length === 0) {
        fieldErrors[key] = "This field is required.";
        continue;
      }

      data[key] = uniqueSelected;
      continue;
    }

    // 2. All other fields: check for empty / missing values
    const isMissingOrNull = raw === undefined || raw === null;
    const isEmptyString = typeof raw === "string" && raw.trim() === "";

    if (isMissingOrNull || isEmptyString) {
      if (field.required) {
        fieldErrors[key] = "This field is required.";
      } else {
        data[key] = null;
      }
      continue;
    }

    // 3. Type-specific validation for non-empty values
    switch (field.type) {
      case "short_text": {
        if (typeof raw !== "string") {
          fieldErrors[key] = "Please enter valid text.";
          break;
        }
        const val = raw.trim();
        if (val.length > 500) {
          fieldErrors[key] = "Must be 500 characters or fewer.";
          break;
        }
        data[key] = val;
        break;
      }

      case "long_text": {
        if (typeof raw !== "string") {
          fieldErrors[key] = "Please enter valid text.";
          break;
        }
        const val = raw.trim();
        if (val.length > 5000) {
          fieldErrors[key] = "Must be 5000 characters or fewer.";
          break;
        }
        data[key] = val;
        break;
      }

      case "email": {
        if (typeof raw !== "string") {
          fieldErrors[key] = "Enter a valid email address.";
          break;
        }
        const val = raw.trim();
        if (val.length > 254 || !EMAIL_REGEX.test(val)) {
          fieldErrors[key] = "Enter a valid email address.";
          break;
        }
        data[key] = val;
        break;
      }

      case "phone": {
        if (typeof raw !== "string") {
          fieldErrors[key] = "Enter a valid phone number.";
          break;
        }
        const val = raw.trim();
        if (!PHONE_REGEX.test(val)) {
          fieldErrors[key] = "Enter a valid phone number.";
          break;
        }
        data[key] = val;
        break;
      }

      case "number": {
        let num: number;
        if (typeof raw === "number") {
          num = raw;
        } else if (typeof raw === "string") {
          const trimmed = raw.trim();
          num = Number(trimmed);
        } else {
          fieldErrors[key] = "Enter a valid number.";
          break;
        }

        if (!Number.isFinite(num)) {
          fieldErrors[key] = "Enter a valid number.";
          break;
        }

        data[key] = num;
        break;
      }

      case "date": {
        if (typeof raw !== "string") {
          fieldErrors[key] = "Enter a valid date.";
          break;
        }
        const val = raw.trim();
        if (!isValidCalendarDate(val)) {
          fieldErrors[key] = "Enter a valid date.";
          break;
        }
        data[key] = val;
        break;
      }

      case "dropdown":
      case "radio": {
        if (typeof raw !== "string") {
          fieldErrors[key] = "Please select a valid option.";
          break;
        }
        const val = raw.trim();
        if (!options.includes(val)) {
          fieldErrors[key] = "Please select a valid option.";
          break;
        }
        data[key] = val;
        break;
      }

      default:
        // Other types (e.g. file when disabled) are ignored
        break;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, data };
}
