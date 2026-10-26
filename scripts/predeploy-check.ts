/**
 * Pre-deployment environment check.
 * Validates environment variable presence, lengths, and formats.
 * NEVER prints secret values, raw tokens, or connection strings.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/predeploy-check.ts
 *   npx tsx --env-file=.env.local scripts/predeploy-check.ts --prod
 */

interface CheckResult {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  message: string;
}

const isProd = process.argv.includes("--prod");
const results: CheckResult[] = [];

function record(name: string, status: "PASS" | "WARN" | "FAIL", message: string) {
  results.push({ name, status, message });
}

// 1. Required Variables Presence
const REQUIRED_VARS = [
  "DATABASE_URL",
  "ADMIN_PASSWORD",
  "SESSION_SECRET",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_SHEET_ID",
  "BLOB_READ_WRITE_TOKEN",
  "NEXT_PUBLIC_APP_URL",
  "CRON_SECRET",
] as const;

for (const varName of REQUIRED_VARS) {
  const val = process.env[varName]?.trim();
  if (val && val.length > 0) {
    record(`presence:${varName}`, "PASS", "Configured");
  } else {
    record(`presence:${varName}`, "FAIL", "Missing or empty");
  }
}

// 2. SESSION_SECRET Length (min 32 chars)
const sessionSecret = process.env.SESSION_SECRET?.trim() || "";
if (sessionSecret.length >= 32) {
  record("length:SESSION_SECRET", "PASS", "At least 32 characters");
} else {
  record(
    "length:SESSION_SECRET",
    "FAIL",
    "Must be at least 32 characters long"
  );
}

// 3. ADMIN_PASSWORD Length (min 12 chars; FAIL with --prod, WARN otherwise)
const adminPassword = process.env.ADMIN_PASSWORD?.trim() || "";
if (adminPassword.length >= 12) {
  record("length:ADMIN_PASSWORD", "PASS", "At least 12 characters");
} else if (isProd) {
  record(
    "length:ADMIN_PASSWORD",
    "FAIL",
    "Must be at least 12 characters long in production"
  );
} else {
  record(
    "length:ADMIN_PASSWORD",
    "WARN",
    "Should be at least 12 characters long"
  );
}

// 4. CRON_SECRET Length (min 32 chars)
const cronSecret = process.env.CRON_SECRET?.trim() || "";
if (cronSecret.length >= 32) {
  record("length:CRON_SECRET", "PASS", "At least 32 characters");
} else {
  record("length:CRON_SECRET", "FAIL", "Must be at least 32 characters long");
}

// 5. NEXT_PUBLIC_APP_URL format & production requirements
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
let parsedUrl: URL | null = null;
try {
  parsedUrl = new URL(appUrl);
} catch {
  parsedUrl = null;
}

if (!parsedUrl) {
  record("format:NEXT_PUBLIC_APP_URL", "FAIL", "Invalid URL format");
} else if (isProd) {
  const isHttps = parsedUrl.protocol === "https:";
  const isLocalhost =
    parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
  if (isHttps && !isLocalhost) {
    record("format:NEXT_PUBLIC_APP_URL", "PASS", "Valid production HTTPS URL");
  } else {
    record(
      "format:NEXT_PUBLIC_APP_URL",
      "FAIL",
      "In production, URL must use https:// and not be localhost"
    );
  }
} else {
  record("format:NEXT_PUBLIC_APP_URL", "PASS", "Valid URL format");
}

// 6. GOOGLE_PRIVATE_KEY format (contains "BEGIN PRIVATE KEY")
let privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim() || "";
if (
  (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
  (privateKey.startsWith("'") && privateKey.endsWith("'"))
) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, "\n").trim();
if (privateKey.includes("BEGIN PRIVATE KEY")) {
  record("format:GOOGLE_PRIVATE_KEY", "PASS", "Valid PEM private key format");
} else {
  record(
    "format:GOOGLE_PRIVATE_KEY",
    "FAIL",
    "Must contain 'BEGIN PRIVATE KEY'"
  );
}

// 7. DATABASE_URL format (looks like postgres URL and includes sslmode=require)
const dbUrl = process.env.DATABASE_URL?.trim() || "";
const isPostgresUrl =
  dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

if (!isPostgresUrl) {
  record("format:DATABASE_URL", "FAIL", "Must be a postgres connection URL");
} else if (dbUrl.includes("sslmode=require")) {
  record("format:DATABASE_URL", "PASS", "Valid postgres URL with sslmode=require");
} else {
  record(
    "format:DATABASE_URL",
    "WARN",
    "DATABASE_URL should include 'sslmode=require' for Neon security"
  );
}

// Output summary table
console.log(`\n======================================================`);
console.log(`  PRE-DEPLOYMENT ENVIRONMENT CHECK (${isProd ? "PRODUCTION" : "DEVELOPMENT"})`);
console.log(`======================================================\n`);

let failCount = 0;
let warnCount = 0;
let passCount = 0;

for (const r of results) {
  const color =
    r.status === "PASS"
      ? "\x1b[32mPASS\x1b[0m"
      : r.status === "WARN"
      ? "\x1b[33mWARN\x1b[0m"
      : "\x1b[31mFAIL\x1b[0m";

  const padding = " ".repeat(Math.max(1, 35 - r.name.length));
  console.log(`  [${color}]  ${r.name}${padding}${r.message}`);

  if (r.status === "FAIL") failCount++;
  else if (r.status === "WARN") warnCount++;
  else passCount++;
}

console.log(`\n------------------------------------------------------`);
console.log(
  `Total: ${results.length} | Passed: ${passCount} | Warnings: ${warnCount} | Failures: ${failCount}`
);
console.log(`------------------------------------------------------\n`);

if (failCount > 0) {
  console.error(`❌ Pre-deployment check FAILED with ${failCount} error(s).\n`);
  process.exit(1);
} else if (warnCount > 0) {
  console.log(`⚠️ Pre-deployment check PASSED with ${warnCount} warning(s).\n`);
  process.exit(0);
} else {
  console.log(`✅ All pre-deployment checks PASSED cleanly.\n`);
  process.exit(0);
}
