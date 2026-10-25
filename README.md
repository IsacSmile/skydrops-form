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
