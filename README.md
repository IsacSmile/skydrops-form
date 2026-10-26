# Skydrops Forms

A lightweight Google-Forms-style application built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, and Drizzle ORM on Neon Postgres.

## Prerequisites

- Node.js 18+ (tested on v22)
- npm

## Setup Instructions

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and configure your credentials:

```bash
cp .env.example .env.local
```

Required variable:

- `DATABASE_URL`: Connection string to your Neon Postgres database.

Optional variables (configured in later milestones):

- `ADMIN_PASSWORD`: Shared password for admin access.
- `SESSION_SECRET`: Secret key for session encryption.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Google Service Account email.
- `GOOGLE_PRIVATE_KEY`: Google Service Account PEM private key.
- `GOOGLE_SHEET_ID`: Target Google Spreadsheet ID.
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob storage token.
- `NEXT_PUBLIC_APP_URL`: Base application URL.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the homepage.
Check [http://localhost:3000/api/health](http://localhost:3000/api/health) to verify your Neon database connection.

### 4. Database Commands (Drizzle ORM)

- Generate migrations:
  ```bash
  npm run db:generate
  ```
- Run migrations:
  ```bash
  npm run db:migrate
  ```
- Open Drizzle Studio:
  ```bash
  npm run db:studio
  ```

### 5. Quality & Type Checking

- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`
- Format code: `npm run format`
- Pre-deployment check: `npm run predeploy` (add `--prod` for production verification)

## Deployment

### Environment Variables

| Variable Name | Purpose | Source / Generation |
| ------------- | ------- | ------------------- |
| `DATABASE_URL` | Neon Postgres connection string with SSL | Neon Console (Connection details, ensure `sslmode=require`) |
| `ADMIN_PASSWORD` | Shared password for admin access (min 12 chars) | Strong random passphrase or password manager |
| `SESSION_SECRET` | 32+ char key for HMAC cookie signing & IP hashing | Generated via `openssl rand -hex 32` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account client email for Sheets API | Google Cloud Console (IAM & Admin > Service Accounts) |
| `GOOGLE_PRIVATE_KEY` | Service account PEM private key | Google Cloud Console (Service Account JSON Key) |
| `GOOGLE_SHEET_ID` | Master Google Spreadsheet ID for submissions | Spreadsheet URL (`https://docs.google.com/spreadsheets/d/<ID>/edit`) |
| `BLOB_READ_WRITE_TOKEN` | Read/write token for Vercel Blob file uploads | Vercel Project Dashboard (Storage > Blob Store) |
| `NEXT_PUBLIC_APP_URL` | Canonical public URL (e.g. `https://forms.yourdomain.com`) | Your custom domain or Vercel production deployment URL |
| `CRON_SECRET` | Bearer token authenticating `/api/cron/maintenance` | Generated via `openssl rand -hex 32` |

### Scheduled Maintenance (Cron)

A maintenance job runs at `/api/cron/maintenance` via `vercel.json`:
- **Hobby Plan**: Scheduled once per day (`0 3 * * *`, 3:00 AM UTC).
- **Pro Plan**: Can be configured to run more frequently (e.g., hourly `0 * * * *` or every 10 minutes) in `vercel.json`.
- **Tasks**:
  1. Syncs pending submissions and retries failed Google Sheets rows (`syncPendingSubmissions(50)`).
  2. Deletes unreferenced orphan blobs older than 24 hours under `forms/` (`cleanupOrphanBlobs()`).
  3. Purges rate limit windows older than 24 hours from the database (`purgeOldRateLimits()`).

### Rate Limiting

Rate limiting is stored in Neon Postgres using atomic upserts with fixed time windows.
All limits and windows are centralized in [`src/lib/rate-limit-config.ts`](file:///home/faiz/Desktop/skydrops-form/src/lib/rate-limit-config.ts):

- **Form Submissions** (`POST /api/submit`): 10 requests per 10 minutes per IP per form slug (`failMode: 'open'`).
- **File Uploads** (`POST /api/upload`): 30 requests per 10 minutes per IP (`failMode: 'open'`).
- **Admin Login** (`login` action): 8 attempts per 15 minutes per IP (`failMode: 'closed'`). Counter is reset on successful login.

To adjust any threshold, simply edit the values in `src/lib/rate-limit-config.ts`.

### What to do if Google Sheets sync fails

If a submission cannot be synced to Google Sheets immediately (e.g., Google API temporary outage or quota limit):
1. The submission is safely stored in Neon with `sync_status = 'failed'` or `'pending'` (Neon is the primary source of truth, so no data is ever lost).
2. The daily maintenance cron will automatically retry failed rows and pending rows older than 2 minutes.
3. Admins can view submission sync statuses and click **Retry Sync** at any time on the form's Responses page: `/admin/forms/[id]/submissions`.
