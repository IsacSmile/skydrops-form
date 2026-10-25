import { z } from "zod";

export const formInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(120, "Title must be 120 characters or less"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or less")
    .optional()
    .nullable()
    .transform((val) => (val === "" || val === undefined ? null : val)),
});

export type FormInput = z.infer<typeof formInputSchema>;
