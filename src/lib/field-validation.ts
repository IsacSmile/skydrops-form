import { z } from "zod";
import {
  FIELD_TYPES,
  OPTION_FIELD_TYPES,
  TEXT_LIKE_FIELD_TYPES,
  type FieldType,
} from "@/types/form";

export const isOptionFieldType = (
  type: FieldType
): type is (typeof OPTION_FIELD_TYPES)[number] =>
  (OPTION_FIELD_TYPES as readonly string[]).includes(type);

export const isTextLikeFieldType = (
  type: FieldType
): type is (typeof TEXT_LIKE_FIELD_TYPES)[number] =>
  (TEXT_LIKE_FIELD_TYPES as readonly string[]).includes(type);

/**
 * Base field input schema with per-type option and placeholder validation.
 */
export const fieldInputSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, "Label is required")
      .max(120, "Label must be 120 characters or less"),
    type: z.enum(FIELD_TYPES, {
      message: "Please select a valid field type",
    }),
    required: z.boolean().default(false),
    placeholder: z
      .string()
      .trim()
      .max(200, "Placeholder must be 200 characters or less")
      .optional()
      .nullable()
      .transform((val) => (val === "" || val === undefined ? null : val)),
    options: z.array(z.string()).default([]),
  })
  .superRefine((data, ctx) => {
    // 1. Placeholder rule: only text-like fields can have placeholders
    if (!isTextLikeFieldType(data.type)) {
      data.placeholder = null;
    }

    // 2. Options rule: non-option types must have empty options
    if (!isOptionFieldType(data.type)) {
      data.options = [];
      return;
    }

    // 3. Option types: dropdown, radio, checkbox
    const trimmedOptions = data.options.map((opt) => opt.trim());
    data.options = trimmedOptions;

    // Check individual option length (1 to 100 chars)
    for (let i = 0; i < trimmedOptions.length; i++) {
      const opt = trimmedOptions[i];
      if (opt.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Option #${i + 1} cannot be empty`,
          path: ["options", i],
        });
      } else if (opt.length > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Option #${i + 1} must be 100 characters or less`,
          path: ["options", i],
        });
      }
    }

    // Check count limits
    if (data.type === "dropdown" || data.type === "radio") {
      if (trimmedOptions.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Dropdown and radio fields require at least 2 options",
          path: ["options"],
        });
      }
    } else if (data.type === "checkbox") {
      if (trimmedOptions.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Checkbox fields require at least 1 option",
          path: ["options"],
        });
      }
    }

    if (trimmedOptions.length > 50) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A maximum of 50 options is allowed",
        path: ["options"],
      });
    }

    // Check duplicates (case-insensitive)
    const seen = new Set<string>();
    for (let i = 0; i < trimmedOptions.length; i++) {
      const lower = trimmedOptions[i].toLowerCase();
      if (seen.has(lower)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate option "${trimmedOptions[i]}" found`,
          path: ["options", i],
        });
      }
      seen.add(lower);
    }
  });

export type FieldInput = z.infer<typeof fieldInputSchema>;

export const createFieldSchema = fieldInputSchema;
export const updateFieldSchema = fieldInputSchema;
