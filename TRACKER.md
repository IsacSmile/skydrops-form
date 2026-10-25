# Brand Forms: Project Tracker

Lightweight Google-Forms-style app. Admin builds forms, publishes a short link, the public fills it, and submissions land in Google Sheets.

**Status legend:** ⬜ Not started · 🟦 Prompt written · 🟨 In progress · ✅ Done · ❌ Blocked

**Current phase:** Planning (no code yet)

---

## 1. Locked decisions

| Area            | Decision                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js (App Router) + TypeScript                                                                                                   |
| Database        | Neon Postgres + Drizzle ORM                                                                                                         |
| UI              | Tailwind + shadcn/ui                                                                                                                |
| Admin auth      | Single shared password, signed httpOnly cookie session (no user table)                                                              |
| Sheets          | Service account; ONE master spreadsheet, ONE tab per form                                                                           |
| Hosting         | Vercel                                                                                                                              |
| Branding        | Fixed company logo + colors on every public form                                                                                    |
| Field types     | short text, long text, email, phone, number, dropdown, radio, checkboxes, date, file upload                                         |
| After publish   | Can add fields, rename labels, toggle required, add options. CANNOT delete fields or change type. Form can be closed or unpublished |
| Source of truth | Neon. Sheets is a mirror, so a Google outage never loses a submission                                                               |

## 2. Open items (need your input before the related component)

| #   | Item                                                            | My default                                                                             | Needed for |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------- |
| O1  | File upload storage                                             | Vercel Blob (direct client upload, 5 MB cap, PDF/image/doc only, URL written to Sheet) | C7         |
| O2  | Company logo file + brand hex colors                            | Placeholder until provided                                                             | C6         |
| O3  | Master Google Sheet created and shared with the service account | You create it; I give steps                                                            | C8         |
| O4  | Custom domain for the short link                                | Use *.vercel.app first                                                                 | C10        |
| O5  | Spam protection level                                           | Honeypot field + simple rate limit per IP                                              | C10        |

## 3. Architecture

```
Admin (password) --> /admin --> Server actions --> Neon (forms, fields, submissions)
                                                       |
Public --> /f/[slug] --> POST /api/submit --> validate -+
                                  |                    v
                                  +--> Google Sheets append (retry on failure)
File upload --> Vercel Blob (client upload) --> URL stored in submission
```

**Tables (draft)**

- `forms`: id, slug (unique, nanoid 8), title, description, status (`draft|published|closed`), sheet_tab, created_at, updated_at
- `fields`: id, form_id, key (stable, never changes), label, type, required, options (jsonb), placeholder, position
- `submissions`: id, form_id, data (jsonb keyed by field key), sync_status (`pending|synced|failed`), sync_error, created_at

**Key rule:** Sheet columns map by field `key`, not label, so renaming a label only updates the header cell.

## 4. Components

| ID  | Component                                                                                                                     | Depends on | Prompt | Status |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------ |
| C0  | Project setup: Next.js, Tailwind, shadcn, Drizzle, env handling, folder structure                                             | none       | ⬜     | ✅     |
| C1  | DB schema + migrations on Neon                                                                                                | C0         | ⬜     | ✅     |
| C2  | Admin auth: shared password login, cookie session, route protection                                                           | C0         | ⬜     | ✅     |
| C3  | Admin forms list: create, rename, duplicate, delete, status badges                                                            | C1, C2     | ⬜     | ✅     |
| C4a | Form builder: add/edit/delete fields, all 10 types, options editor, required toggle (lock rules in data layer) | C3         | ⬜     | ✅     |
| C4b | Reorder fields, live preview (verified via test suite; Playwright driver unavailable) | C4a        | ⬜     | ✅     |
| C5  | Publish / unpublish / close + short link generation + copy button (verified via test suite; Playwright driver unavailable in environment) | C4b        | ⬜     | ✅     |
| C6  | Public form page `/f/[slug]`: branded, responsive, client + server validation, thank-you and closed states    | C5         | ⬜     | ⬜     |
| C7  | File upload via Vercel Blob (size/type limits)                                                                | C6         | ⬜     | ⬜     |
| C8  | Google Sheets sync: service account, create tab, header row, append row, header update on label change, retry for failed rows | C6         | ⬜     | ⬜     |
| C9  | Admin submissions view (minimal): count, sync status, retry failed, link to Sheet                             | C8         | ⬜     | ⬜     |
| C10 | Hardening + deploy: rate limit, honeypot, env vars, Vercel deploy, smoke test checklist                       | all        | ⬜     | ⬜     |

**Build order:** C0 > C1 > C2 > C3 > C4a > C4b > C5 > C6 > C8 > C7 > C9 > C10
(Sheets before file upload, so the core flow works end to end first.)

## 5. Milestones

- **M1: Admin can create a form with fields** (C0-C4)
- **M2: Publish and fill a form via short link** (C5-C6)
- **M3: Submissions appear in Google Sheet** (C8)
- **M4: Files, submissions view, production deploy** (C7, C9, C10)

## 6. Per-component workflow

1. I write the prompt for the component (one at a time)
2. You paste it into Antigravity
3. Antigravity builds it and you test using the acceptance checks in the prompt
4. You tell me the result and we update status here
5. Next component

## 7. Change log

| Date       | Change                                                          |
| ---------- | --------------------------------------------------------------- |
| 2026-10-25 | Tracker created, decisions locked                               |
| 2026-10-25 | C0 completed: Next.js + Tailwind + shadcn + Drizzle + env setup |
| 2026-10-25 | C1 completed: Database schema, migration, and types             |
| 2026-10-25 | C2 completed: Admin auth, session tokens, and route protection  |
| 2026-10-26 | C3 completed: Admin forms list, CRUD actions, and dialogs       |
| 2026-10-26 | C4a completed: Form builder field CRUD, 10 types, publish-lock rules |
| 2026-10-26 | C4b completed: Move up/down field reordering, live preview tabs, shared FieldRenderer |
| 2026-10-26 | C5 completed: Publish/unpublish/close transitions, atomic concurrency lock, short link copy & builder publishing card |
