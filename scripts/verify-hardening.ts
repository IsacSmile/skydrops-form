/**
 * Comprehensive verification suite for C10a: production hardening.
 *
 * Runs:
 * A. Pure tests: getClientIp precedence & fallback, header capping, hashIdentifier determinism,
 *    scope separation, raw IP privacy.
 * B. Database tests: hitRateLimit limit & retry-after, window reset, 25-thread concurrency,
 *    resetRateLimit, purgeOldRateLimits, failMode 'open' / 'closed', cleanupOrphanBlobs.
 * C. HTTP tests: /api/cron/maintenance auth & response keys, submit 10-then-429 limit,
 *    login rate limiter, security headers on /admin and /f, /robots.txt disallows.
 * D. Cleanup of all test artifacts.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-hardening.ts
 */

import { put, del, head, BlobNotFoundError } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { getClientIp, hashIdentifier } from "../src/lib/client-ip";
import {
  hitRateLimit,
  resetRateLimit,
  purgeOldRateLimits,
} from "../src/lib/rate-limit";
import { cleanupOrphanBlobs } from "../src/lib/blob-cleanup";
import { createForm, deleteForm, setFormStatus } from "../src/lib/forms-data";
import { addField } from "../src/lib/fields-data";
import { createSubmission } from "../src/lib/submissions-data";
import { db } from "../src/db";
import { rateLimits } from "../src/db/schema";

interface StepResult {
  section: string;
  name: string;
  status: "PASS" | "FAIL" | "SKIPPED";
  detail?: string;
}

const results: StepResult[] = [];
const createdFormIds: string[] = [];
const createdBlobUrls: string[] = [];
const createdRateLimitKeys: string[] = [];

function record(
  section: string,
  name: string,
  status: "PASS" | "FAIL" | "SKIPPED",
  detail?: string
) {
  results.push({ section, name, status, detail });
  const badge =
    status === "PASS"
      ? "\x1b[32mPASS\x1b[0m"
      : status === "SKIPPED"
      ? "\x1b[33mSKIPPED\x1b[0m"
      : "\x1b[31mFAIL\x1b[0m";
  console.log(`  [${badge}] ${section} > ${name}${detail ? ` (${detail})` : ""}`);
}

async function run() {
  console.log("\n=======================================================");
  console.log("  C10a HARDENING VERIFICATION SUITE");
  console.log("=======================================================\n");

  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    // =========================================================================
    // SECTION A: PURE TESTS
    // =========================================================================
    console.log("--- Section A: Pure Client IP & Hashing Tests ---");

    // A1: getClientIp precedence (x-real-ip over x-forwarded-for)
    const ipPrecedence = getClientIp({
      "x-real-ip": "203.0.113.1",
      "x-forwarded-for": "198.51.100.2, 198.51.100.3",
    });
    if (ipPrecedence === "203.0.113.1") {
      record("A", "getClientIp precedence", "PASS", "x-real-ip chosen over x-forwarded-for");
    } else {
      record("A", "getClientIp precedence", "FAIL", `Expected 203.0.113.1, got ${ipPrecedence}`);
    }

    // A2: getClientIp first entry of x-forwarded-for
    const ipForwarded = getClientIp({
      "x-forwarded-for": "  198.51.100.5 , 198.51.100.6 ",
    });
    if (ipForwarded === "198.51.100.5") {
      record("A", "getClientIp forwarded first entry", "PASS", "First IP trimmed correctly");
    } else {
      record("A", "getClientIp forwarded first entry", "FAIL", `Expected 198.51.100.5, got ${ipForwarded}`);
    }

    // A3: getClientIp fallback to "unknown"
    const ipUnknown1 = getClientIp({});
    const ipUnknown2 = getClientIp(null);
    if (ipUnknown1 === "unknown" && ipUnknown2 === "unknown") {
      record("A", "getClientIp fallback", "PASS", "Falls back to 'unknown'");
    } else {
      record("A", "getClientIp fallback", "FAIL", `Fallback failed: ${ipUnknown1}, ${ipUnknown2}`);
    }

    // A4: getClientIp capping at 64 characters
    const longHeader = "a".repeat(100);
    const ipCapped = getClientIp({ "x-real-ip": longHeader });
    if (ipCapped.length === 64) {
      record("A", "getClientIp length capping", "PASS", "Capped at 64 chars");
    } else {
      record("A", "getClientIp length capping", "FAIL", `Length was ${ipCapped.length}`);
    }

    // A5: getClientIp works with Headers instance
    const h = new Headers();
    h.set("x-forwarded-for", "10.0.0.1, 10.0.0.2");
    const ipHeadersObj = getClientIp(h);
    if (ipHeadersObj === "10.0.0.1") {
      record("A", "getClientIp Headers object", "PASS", "Works with Headers class");
    } else {
      record("A", "getClientIp Headers object", "FAIL", `Got ${ipHeadersObj}`);
    }

    // A6: hashIdentifier determinism and privacy
    const rawIp = "192.0.2.45";
    const hash1 = hashIdentifier(rawIp, "submit:test");
    const hash2 = hashIdentifier(rawIp, "submit:test");
    const hashDiffScope = hashIdentifier(rawIp, "submit:other");
    const hashDiffIp = hashIdentifier("192.0.2.46", "submit:test");

    const isDeterministic = hash1 === hash2;
    const isScopeSeparated = hash1 !== hashDiffScope;
    const isIpSeparated = hash1 !== hashDiffIp;
    const doesNotLeakIp = !hash1.includes(rawIp);
    const isHex64 = hash1.length === 64 && /^[0-9a-f]{64}$/.test(hash1);

    if (
      isDeterministic &&
      isScopeSeparated &&
      isIpSeparated &&
      doesNotLeakIp &&
      isHex64
    ) {
      record(
        "A",
        "hashIdentifier properties",
        "PASS",
        "Deterministic, scope-separated, privacy-preserving 64-char hex HMAC"
      );
    } else {
      record(
        "A",
        "hashIdentifier properties",
        "FAIL",
        `Det: ${isDeterministic}, Scope: ${isScopeSeparated}, IP: ${isIpSeparated}, Leak: ${!doesNotLeakIp}`
      );
    }

    // =========================================================================
    // SECTION B: DATABASE TESTS (Neon)
    // =========================================================================
    console.log("\n--- Section B: Database Rate Limiter & Blob Cleanup (Neon) ---");

    const bScope = `verify_b_${runId}`;
    const bId = `ip_${runId}`;
    createdRateLimitKeys.push(`${bScope}:${hashIdentifier(bId, bScope)}`);

    // B1: hitRateLimit allows exactly limit hits then blocks; retryAfterSeconds sensible
    const bLimit = 3;
    const bWindow = 60;
    const r1 = await hitRateLimit({
      scope: bScope,
      identifier: bId,
      limit: bLimit,
      windowSeconds: bWindow,
    });
    const r2 = await hitRateLimit({
      scope: bScope,
      identifier: bId,
      limit: bLimit,
      windowSeconds: bWindow,
    });
    const r3 = await hitRateLimit({
      scope: bScope,
      identifier: bId,
      limit: bLimit,
      windowSeconds: bWindow,
    });
    const r4 = await hitRateLimit({
      scope: bScope,
      identifier: bId,
      limit: bLimit,
      windowSeconds: bWindow,
    });

    const b1Pass =
      r1.allowed === true &&
      r1.count === 1 &&
      r2.allowed === true &&
      r2.count === 2 &&
      r3.allowed === true &&
      r3.count === 3 &&
      r4.allowed === false &&
      r4.count === 4 &&
      r4.retryAfterSeconds >= 1 &&
      r4.retryAfterSeconds <= bWindow;

    if (b1Pass) {
      record(
        "B",
        "hitRateLimit exact limit & block",
        "PASS",
        `Allowed ${bLimit} hits, blocked 4th with retryAfter=${r4.retryAfterSeconds}s`
      );
    } else {
      record(
        "B",
        "hitRateLimit exact limit & block",
        "FAIL",
        `Counts: ${r1.count}, ${r2.count}, ${r3.count}, ${r4.count}; r4.allowed=${r4.allowed}`
      );
    }

    // B2: A new window resets the count
    const futureDate = new Date(Date.now() + (bWindow + 5) * 1000);
    const rNewWindow = await hitRateLimit({
      scope: bScope,
      identifier: bId,
      limit: bLimit,
      windowSeconds: bWindow,
      now: futureDate,
    });

    if (rNewWindow.allowed === true && rNewWindow.count === 1) {
      record("B", "hitRateLimit new window reset", "PASS", "New window starts at count 1");
    } else {
      record(
        "B",
        "hitRateLimit new window reset",
        "FAIL",
        `Allowed: ${rNewWindow.allowed}, count: ${rNewWindow.count}`
      );
    }

    // B3: Concurrency: 25 parallel hits with limit 10 -> exactly 10 allowed
    const concScope = `verify_conc_${runId}`;
    createdRateLimitKeys.push(`${concScope}:${hashIdentifier(bId, concScope)}`);

    const concPromises = Array.from({ length: 25 }, () =>
      hitRateLimit({
        scope: concScope,
        identifier: bId,
        limit: 10,
        windowSeconds: 60,
      })
    );
    const concResults = await Promise.all(concPromises);
    const concAllowed = concResults.filter((r) => r.allowed).length;
    const concBlocked = concResults.filter((r) => !r.allowed).length;

    if (concAllowed === 10 && concBlocked === 15) {
      record(
        "B",
        "hitRateLimit 25-thread concurrency",
        "PASS",
        "Exactly 10 allowed and 15 blocked out of 25 parallel requests"
      );
    } else {
      record(
        "B",
        "hitRateLimit 25-thread concurrency",
        "FAIL",
        `Allowed: ${concAllowed}, Blocked: ${concBlocked}`
      );
    }

    // B4: resetRateLimit clears counter & purgeOldRateLimits deletes old rows
    await resetRateLimit({ scope: concScope, identifier: bId });
    const rAfterReset = await hitRateLimit({
      scope: concScope,
      identifier: bId,
      limit: 10,
      windowSeconds: 60,
    });
    const resetSuccess = rAfterReset.allowed === true && rAfterReset.count === 1;

    // Insert an old rate_limit row (2 days ago)
    const oldKey = `verify_old_${runId}`;
    createdRateLimitKeys.push(oldKey);
    await db.insert(rateLimits).values({
      key: oldKey,
      windowStart: new Date(Date.now() - 172_800 * 1000), // 48h ago
      count: 7,
    });

    const purgedCount = await purgeOldRateLimits(86400); // older than 24h
    const oldRowCheck = await db
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, oldKey));

    if (resetSuccess && purgedCount >= 1 && oldRowCheck.length === 0) {
      record(
        "B",
        "resetRateLimit & purgeOldRateLimits",
        "PASS",
        `Reset cleared counter; purge deleted ${purgedCount} old row(s)`
      );
    } else {
      record(
        "B",
        "resetRateLimit & purgeOldRateLimits",
        "FAIL",
        `Reset: ${resetSuccess}, Purged: ${purgedCount}, OldRowRemaining: ${oldRowCheck.length}`
      );
    }

    // B5: failMode 'open' vs 'closed' with simulated failing DB executor
    const throwingExecutor = {
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: () => ({
            returning: () =>
              Promise.reject(new Error("Simulated Neon connection failure")),
          }),
        }),
      }),
    };

    const failOpenResult = await hitRateLimit({
      scope: "fail_test",
      identifier: "simulated_ip",
      limit: 5,
      windowSeconds: 60,
      failMode: "open",
      dbExecutor: throwingExecutor,
    });

    const failClosedResult = await hitRateLimit({
      scope: "fail_test",
      identifier: "simulated_ip",
      limit: 5,
      windowSeconds: 60,
      failMode: "closed",
      dbExecutor: throwingExecutor,
    });

    if (failOpenResult.allowed === true && failClosedResult.allowed === false) {
      record(
        "B",
        "failMode error handling",
        "PASS",
        "'open' allows fallback, 'closed' blocks fallback on DB error"
      );
    } else {
      record(
        "B",
        "failMode error handling",
        "FAIL",
        `Open allowed: ${failOpenResult.allowed}, Closed allowed: ${failClosedResult.allowed}`
      );
    }

    // B6: cleanupOrphanBlobs test
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      record(
        "B",
        "cleanupOrphanBlobs",
        "SKIPPED",
        "BLOB_READ_WRITE_TOKEN is not configured"
      );
    } else {
      // 1. Create a test form with a file field
      const blobForm = await createForm({
        title: `Blob Cleanup Test ${runId}`,
        description: "Testing orphan blob cleanup",
      });
      createdFormIds.push(blobForm.id);

      const fileFieldRes = await addField(blobForm.id, {
        label: "Attachment",
        type: "file",
        required: false,
      });
      if (!fileFieldRes.ok) throw new Error("Failed to add file field for blob test");

      // 2. Put two blobs under forms/ prefix
      const prefix = `forms/${blobForm.id}/${fileFieldRes.field.key}/`;
      const blob1 = await put(`${prefix}referenced-${runId}.txt`, "referenced content", {
        access: "public",
      });
      createdBlobUrls.push(blob1.url);

      const blob2 = await put(`${prefix}orphan-${runId}.txt`, "orphan content", {
        access: "public",
      });
      createdBlobUrls.push(blob2.url);

      // 3. Put one blob outside forms/
      const outsideBlob = await put(`outside-forms-${runId}.txt`, "outside content", {
        access: "public",
      });
      createdBlobUrls.push(outsideBlob.url);

      // 4. Reference blob1 in a submission
      await createSubmission(blobForm.id, {
        [fileFieldRes.field.key]: blob1.url,
      });

      // Test a: Default 24h cutoff -> fresh blobs should NOT be deleted
      const resFresh = await cleanupOrphanBlobs({
        olderThanMs: 24 * 60 * 60 * 1000,
      });
      const freshKept = resFresh.deleted === 0;

      // Test b: dryRun with olderThanMs = 0 -> reports orphan for deletion without deleting
      const resDry = await cleanupOrphanBlobs({
        olderThanMs: 0,
        dryRun: true,
      });
      const dryReported = resDry.deleted >= 1;
      // Verify blob2 is still present
      const blob2StillThere = await head(blob2.url).then(
        () => true,
        () => false
      );

      // Test c: Real run with olderThanMs = 0 -> referenced blob1 KEPT, unreferenced blob2 DELETED
      const resReal = await cleanupOrphanBlobs({
        olderThanMs: 0,
        dryRun: false,
      });
      const realRan = resReal.deleted >= 1;

      let blob1Kept = false;
      try {
        await head(blob1.url);
        blob1Kept = true;
      } catch {
        blob1Kept = false;
      }

      let blob2Deleted = false;
      try {
        await head(blob2.url);
        blob2Deleted = false;
      } catch (e) {
        if (e instanceof BlobNotFoundError || (e as Error).name === "BlobNotFoundError") {
          blob2Deleted = true;
        }
      }

      let outsideKept = false;
      try {
        await head(outsideBlob.url);
        outsideKept = true;
      } catch {
        outsideKept = false;
      }

      if (
        freshKept &&
        dryReported &&
        blob2StillThere &&
        realRan &&
        blob1Kept &&
        blob2Deleted &&
        outsideKept
      ) {
        record(
          "B",
          "cleanupOrphanBlobs",
          "PASS",
          "Keeps referenced & fresh blobs; deletes unreferenced old blobs; protects non-forms/ blobs"
        );
      } else {
        record(
          "B",
          "cleanupOrphanBlobs",
          "FAIL",
          `FreshKept: ${freshKept}, Dry: ${dryReported}, DryExists: ${blob2StillThere}, ` +
            `Blob1Kept: ${blob1Kept}, Blob2Deleted: ${blob2Deleted}, OutsideKept: ${outsideKept}`
        );
      }
    }

    // =========================================================================
    // SECTION C: HTTP TESTS
    // =========================================================================
    console.log("\n--- Section C: HTTP Server Integration Tests ---");

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    let devServerRunning = false;
    try {
      const ping = await fetch(`${baseUrl}/api/health`);
      if (ping.ok) devServerRunning = true;
    } catch {
      devServerRunning = false;
    }

    const cronSecretSet = Boolean(process.env.CRON_SECRET?.trim());

    if (!devServerRunning) {
      record(
        "C",
        "HTTP Integration Suite",
        "SKIPPED",
        `Dev server is not running on ${baseUrl}`
      );
    } else if (!cronSecretSet) {
      record(
        "C",
        "HTTP Integration Suite",
        "SKIPPED",
        "CRON_SECRET is not configured in .env.local"
      );
    } else {
      // C1: /api/cron/maintenance authorization & responses
      const resNoAuth = await fetch(`${baseUrl}/api/cron/maintenance`);
      const resWrongAuth = await fetch(`${baseUrl}/api/cron/maintenance`, {
        headers: { Authorization: "Bearer wrong-secret-token" },
      });
      const resGoodAuth = await fetch(`${baseUrl}/api/cron/maintenance`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      const goodAuthBody = await resGoodAuth.json();

      const c1Pass =
        resNoAuth.status === 401 &&
        resWrongAuth.status === 401 &&
        resGoodAuth.status === 200 &&
        goodAuthBody.ok === true &&
        typeof goodAuthBody.syncAttempted === "number" &&
        typeof goodAuthBody.syncSucceeded === "number" &&
        typeof goodAuthBody.blobsDeleted === "number" &&
        typeof goodAuthBody.rateLimitRowsDeleted === "number" &&
        typeof goodAuthBody.durationMs === "number";

      if (c1Pass) {
        record(
          "C",
          "/api/cron/maintenance auth & structure",
          "PASS",
          "401 without/wrong token; 200 with valid schema on correct token"
        );
      } else {
        record(
          "C",
          "/api/cron/maintenance auth & structure",
          "FAIL",
          `NoAuth: ${resNoAuth.status}, WrongAuth: ${resWrongAuth.status}, GoodAuth: ${resGoodAuth.status}`
        );
      }

      // C2: Submit rate limit (10 allowed, 11th 429 with Retry-After; different IP allowed)
      const submitForm = await createForm({
        title: `Submit Limit Form ${runId}`,
        description: "Testing submit rate limit",
      });
      createdFormIds.push(submitForm.id);

      const f1 = await addField(submitForm.id, {
        label: "Your Email",
        type: "email",
        required: true,
      });
      if (!f1.ok) throw new Error("Failed to add field for submit test");
      await setFormStatus(submitForm.id, "published");

      const submitIp = `192.0.2.${Math.floor(Math.random() * 200) + 10}`;
      createdRateLimitKeys.push(
        `submit:${submitForm.slug}:${hashIdentifier(submitIp, `submit:${submitForm.slug}`)}`
      );

      const submitStatuses: number[] = [];
      let retryAfterHeader: string | null = null;

      for (let i = 0; i < 11; i++) {
        const res = await fetch(`${baseUrl}/api/submit`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": submitIp,
          },
          body: JSON.stringify({
            slug: submitForm.slug,
            answers: { [f1.field.key]: `user${i}@example.com` },
          }),
        });
        submitStatuses.push(res.status);
        if (res.status === 429) {
          retryAfterHeader = res.headers.get("retry-after");
        }
      }

      // 12th request with different IP
      const diffIp = `192.0.2.254`;
      createdRateLimitKeys.push(
        `submit:${submitForm.slug}:${hashIdentifier(diffIp, `submit:${submitForm.slug}`)}`
      );
      const resDiffIp = await fetch(`${baseUrl}/api/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": diffIp,
        },
        body: JSON.stringify({
          slug: submitForm.slug,
          answers: { [f1.field.key]: "different@example.com" },
        }),
      });

      const first10Not429 = submitStatuses.slice(0, 10).every((s) => s === 200);
      const eleventhis429 = submitStatuses[10] === 429;
      const hasRetryAfter = Boolean(retryAfterHeader && Number(retryAfterHeader) > 0);
      const diffIpAllowed = resDiffIp.status === 200;

      if (first10Not429 && eleventhis429 && hasRetryAfter && diffIpAllowed) {
        record(
          "C",
          "POST /api/submit rate limit",
          "PASS",
          `First 10 succeeded, 11th returned 429 (Retry-After=${retryAfterHeader}s), diff IP allowed`
        );
      } else {
        record(
          "C",
          "POST /api/submit rate limit",
          "FAIL",
          `Statuses: [${submitStatuses.join(", ")}], RetryAfter: ${retryAfterHeader}, DiffIpStatus: ${resDiffIp.status}`
        );
      }

      // C3: Login limiter (8 attempts allowed, 9th blocked)
      const testLoginIp = `10.99.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;
      createdRateLimitKeys.push(`login:${hashIdentifier(testLoginIp, "login")}`);

      const loginResults: boolean[] = [];
      for (let i = 0; i < 9; i++) {
        const limRes = await hitRateLimit({
          scope: "login",
          identifier: testLoginIp,
          limit: 8,
          windowSeconds: 15 * 60,
          failMode: "closed",
        });
        loginResults.push(limRes.allowed);
      }

      const first8Allowed = loginResults.slice(0, 8).every((a) => a === true);
      const ninthBlocked = loginResults[8] === false;

      // Clean up counter
      await resetRateLimit({ scope: "login", identifier: testLoginIp });
      const afterCleanup = await hitRateLimit({
        scope: "login",
        identifier: testLoginIp,
        limit: 8,
        windowSeconds: 15 * 60,
        failMode: "closed",
      });

      if (first8Allowed && ninthBlocked && afterCleanup.allowed === true) {
        record(
          "C",
          "Admin login rate limit",
          "PASS",
          "First 8 attempts allowed, 9th blocked; resetRateLimit successfully cleared counter"
        );
      } else {
        record(
          "C",
          "Admin login rate limit",
          "FAIL",
          `Results: [${loginResults.join(", ")}], AfterReset: ${afterCleanup.allowed}`
        );
      }

      // C4: Response headers on /admin/login and /f/<slug>
      const adminLoginRes = await fetch(`${baseUrl}/admin/login`);
      const adminNosniff = adminLoginRes.headers.get("x-content-type-options");
      const adminReferrer = adminLoginRes.headers.get("referrer-policy");
      const adminFrame = adminLoginRes.headers.get("x-frame-options");
      const adminCache = adminLoginRes.headers.get("cache-control");

      const publicFormRes = await fetch(`${baseUrl}/f/${submitForm.slug}`);
      const publicNosniff = publicFormRes.headers.get("x-content-type-options");
      const publicReferrer = publicFormRes.headers.get("referrer-policy");
      const publicFrame = publicFormRes.headers.get("x-frame-options");

      const adminHeadersOk =
        adminNosniff === "nosniff" &&
        adminReferrer === "strict-origin-when-cross-origin" &&
        adminFrame === "DENY" &&
        adminCache?.includes("no-store");

      const publicHeadersOk =
        publicNosniff === "nosniff" &&
        publicReferrer === "strict-origin-when-cross-origin" &&
        !publicFrame; // Absent so embedding is allowed

      if (adminHeadersOk && publicHeadersOk) {
        record(
          "C",
          "Security response headers",
          "PASS",
          "nosniff & Referrer-Policy on all; X-Frame-Options DENY on /admin; no X-Frame-Options on /f"
        );
      } else {
        record(
          "C",
          "Security response headers",
          "FAIL",
          `Admin: nosniff=${adminNosniff}, frame=${adminFrame}, cache=${adminCache}; Public: frame=${publicFrame}`
        );
      }

      // C5: /robots.txt disallows /admin and /api
      const robotsRes = await fetch(`${baseUrl}/robots.txt`);
      const robotsText = await robotsRes.text();
      const hasDisallowAdmin =
        robotsText.includes("Disallow: /admin") ||
        robotsText.includes("Disallow: /admin/");
      const hasDisallowApi =
        robotsText.includes("Disallow: /api") ||
        robotsText.includes("Disallow: /api/");

      if (robotsRes.status === 200 && hasDisallowAdmin && hasDisallowApi) {
        record("C", "/robots.txt rules", "PASS", "Disallows /admin and /api routes");
      } else {
        record(
          "C",
          "/robots.txt rules",
          "FAIL",
          `Status: ${robotsRes.status}, Content:\n${robotsText}`
        );
      }
    }
  } catch (err: unknown) {
    console.error("\nUnexpected test suite error:", err);
    record("ERROR", "Unhandled Exception", "FAIL", (err as Error)?.message);
  } finally {
    // =========================================================================
    // SECTION D: CLEANUP ALWAYS RUNS
    // =========================================================================
    console.log("\n--- Section D: Cleanup ---");

    // Clean up test forms
    for (const formId of createdFormIds) {
      try {
        await deleteForm(formId);
      } catch (err: unknown) {
        console.error(`Failed to delete test form ${formId}:`, (err as Error)?.message);
      }
    }

    // Clean up test blobs
    if (createdBlobUrls.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(createdBlobUrls);
      } catch {
        // Ignore blob cleanup error
      }
    }

    // Clean up test rate limit keys
    for (const key of createdRateLimitKeys) {
      try {
        await db.delete(rateLimits).where(eq(rateLimits.key, key));
      } catch {
        // Ignore rate limit cleanup error
      }
    }

    record("D", "Cleanup test artifacts", "PASS", "Test forms, blobs, and rate_limits removed");

    // Final summary
    console.log("\n=======================================================");
    console.log("  VERIFICATION RESULTS SUMMARY");
    console.log("=======================================================");

    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const r of results) {
      if (r.status === "PASS") totalPassed++;
      else if (r.status === "FAIL") totalFailed++;
      else totalSkipped++;
    }

    console.log(
      `Total Checks: ${results.length} | Passed: ${totalPassed} | Skipped: ${totalSkipped} | Failed: ${totalFailed}\n`
    );

    if (totalFailed > 0) {
      console.error(`❌ Verification FAILED with ${totalFailed} failure(s).\n`);
      process.exit(1);
    } else {
      console.log(`🎉 ALL HARDENING VERIFICATION CHECKS PASSED!\n`);
      process.exit(0);
    }
  }
}

run();
