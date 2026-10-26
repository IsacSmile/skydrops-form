import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { FIELD_TYPES, FORM_STATUSES, SYNC_STATUSES } from "../types/form";

export const formStatusEnum = pgEnum("form_status", FORM_STATUSES);
export const fieldTypeEnum = pgEnum("field_type", FIELD_TYPES);
export const syncStatusEnum = pgEnum("sync_status", SYNC_STATUSES);

export const forms = pgTable("forms", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  status: formStatusEnum("status").notNull().default("draft"),
  sheetTab: text("sheet_tab"),
  sheetGid: integer("sheet_gid"),
  sheetHeader: jsonb("sheet_header").$type<string[]>(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const fields = pgTable(
  "fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: fieldTypeEnum("type").notNull(),
    required: boolean("required").notNull().default(false),
    placeholder: text("placeholder"),
    options: jsonb("options").$type<string[]>().notNull().default([]),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("fields_form_id_key_unique").on(table.formId, table.key),
    index("fields_form_id_position_idx").on(table.formId, table.position),
  ]
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formId: uuid("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    data: jsonb("data")
      .$type<Record<string, string | string[] | number | null>>()
      .notNull(),
    syncStatus: syncStatusEnum("sync_status").notNull().default("pending"),
    syncAttempts: integer("sync_attempts").notNull().default(0),
    syncError: text("sync_error"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("submissions_form_id_created_at_idx").on(
      table.formId,
      table.createdAt
    ),
    index("submissions_sync_status_idx").on(table.syncStatus),
  ]
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.key, table.windowStart] }),
    index("rate_limits_window_start_idx").on(table.windowStart),
  ]
);

export const formsRelations = relations(forms, ({ many }) => ({
  fields: many(fields),
  submissions: many(submissions),
}));

export const fieldsRelations = relations(fields, ({ one }) => ({
  form: one(forms, {
    fields: [fields.formId],
    references: [forms.id],
  }),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  form: one(forms, {
    fields: [submissions.formId],
    references: [forms.id],
  }),
}));
