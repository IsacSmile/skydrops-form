import type { forms, fields, submissions } from "@/db/schema";

export const FORM_STATUSES = ["draft", "published", "closed"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const FIELD_TYPES = [
  "short_text",
  "long_text",
  "email",
  "phone",
  "number",
  "dropdown",
  "radio",
  "checkbox",
  "date",
  "file",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const OPTION_FIELD_TYPES = ["dropdown", "radio", "checkbox"] as const;
export type OptionFieldType = (typeof OPTION_FIELD_TYPES)[number];

export const SYNC_STATUSES = ["pending", "synced", "failed"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export type Form = typeof forms.$inferSelect;
export type NewForm = typeof forms.$inferInsert;

export type Field = typeof fields.$inferSelect;
export type NewField = typeof fields.$inferInsert;

export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
