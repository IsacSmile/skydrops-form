import { randomUUID } from "crypto";
import { db } from "../src/db";
import { submissions } from "../src/db/schema";
import { createForm, deleteForm } from "../src/lib/forms-data";
import {
  getSubmissionStats,
  listSubmissions,
  getSubmissionForForm,
} from "../src/lib/submissions-data";
import { isRetryable, retrySubmission } from "../src/lib/sheets-sync";
import { getSheetUrl } from "../src/lib/short-link";

// Load environment variables before running verification
try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    // ignore
  }
}

async function runSubmissionsVerification() {
  console.log("Running Submissions & Retry verification checks...\n");

  let allPassed = true;
  const createdFormIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // Setup test forms
    // -------------------------------------------------------------------------
    const formA = await createForm({ title: "Submissions Verification Form A" });
    createdFormIds.push(formA.id);

    const formB = await createForm({ title: "Submissions Verification Form B" });
    createdFormIds.push(formB.id);

    const now = new Date();
    const tenSecAgo = new Date(now.getTime() - 10 * 1000);
    const threeMinAgo = new Date(now.getTime() - 3 * 60 * 1000);
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);

    // Insert submissions directly into DB for formA:
    // 2 synced, 1 pending (fresh), 1 pending (old), 2 failed
    const [subSynced1] = await db
      .insert(submissions)
      .values([
        {
          formId: formA.id,
          data: { name: "Alice", email: "alice@example.com" },
          syncStatus: "synced",
          syncAttempts: 1,
          syncError: null,
          syncedAt: tenMinAgo,
          createdAt: tenMinAgo,
        },
        {
          formId: formA.id,
          data: { name: "Bob", email: "bob@example.com" },
          syncStatus: "synced",
          syncAttempts: 1,
          syncError: null,
          syncedAt: tenMinAgo,
          createdAt: new Date(now.getTime() - 8 * 60 * 1000),
        },
      ])
      .returning();

    const [subPendingFresh] = await db
      .insert(submissions)
      .values([
        {
          formId: formA.id,
          data: { name: "Charlie Fresh", email: "charlie@example.com" },
          syncStatus: "pending",
          syncAttempts: 0,
          syncError: null,
          createdAt: tenSecAgo,
        },
        {
          formId: formA.id,
          data: { name: "Diana Old", email: "diana@example.com" },
          syncStatus: "pending",
          syncAttempts: 1,
          syncError: "Temporary timeout",
          createdAt: threeMinAgo,
        },
      ])
      .returning();

    await db
      .insert(submissions)
      .values([
        {
          formId: formA.id,
          data: { name: "Eve Failed", email: "eve@example.com" },
          syncStatus: "failed",
          syncAttempts: 3,
          syncError: "Rate limit exceeded",
          createdAt: new Date(now.getTime() - 2 * 60 * 1000),
        },
        {
          formId: formA.id,
          data: { name: "Frank Failed", email: "frank@example.com" },
          syncStatus: "failed",
          syncAttempts: 2,
          syncError: "Google Sheets quota reached",
          createdAt: new Date(now.getTime() - 1 * 60 * 1000),
        },
      ])
      .returning();

    // Insert 1 submission for formB
    const [subB] = await db
      .insert(submissions)
      .values({
        formId: formB.id,
        data: { name: "Grace B", email: "grace@example.com" },
        syncStatus: "pending",
        syncAttempts: 0,
        createdAt: now,
      })
      .returning();

    // -------------------------------------------------------------------------
    // Step 1: getSubmissionStats
    // -------------------------------------------------------------------------
    process.stdout.write(
      "1. getSubmissionStats counts correctly across synced/pending/failed rows... "
    );
    const statsA = await getSubmissionStats(formA.id);
    const step1Ok =
      statsA.total === 6 &&
      statsA.synced === 2 &&
      statsA.pending === 2 &&
      statsA.failed === 2;

    if (step1Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL", statsA);
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // Step 2: listSubmissions
    // -------------------------------------------------------------------------
    process.stdout.write(
      "2. listSubmissions (newest first, pageSize respected, page clamped, pageCount)... "
    );

    // 2a. Newest first
    const listAll = await listSubmissions(formA.id, { page: 1, pageSize: 10 });
    let newestFirst = true;
    for (let i = 0; i < listAll.rows.length - 1; i++) {
      const cur = new Date(listAll.rows[i].createdAt).getTime();
      const next = new Date(listAll.rows[i + 1].createdAt).getTime();
      if (cur < next) {
        newestFirst = false;
        break;
      }
    }

    // 2b. Page size respected
    const pageSize2 = await listSubmissions(formA.id, { page: 1, pageSize: 2 });
    const sizeOk = pageSize2.rows.length === 2 && pageSize2.pageCount === 3;

    // 2c. Page clamped: page 0 -> page 1
    const pageZero = await listSubmissions(formA.id, { page: 0, pageSize: 2 });
    const clampZeroOk = pageZero.page === 1 && pageZero.rows.length === 2;

    // 2d. Page clamped: page 999 -> page pageCount
    const page999 = await listSubmissions(formA.id, { page: 999, pageSize: 2 });
    const clampHighOk = page999.page === 3 && page999.rows.length === 2;

    const step2Ok = newestFirst && sizeOk && clampZeroOk && clampHighOk;
    if (step2Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL", {
        newestFirst,
        sizeOk,
        clampZeroOk,
        clampHighOk,
        pageZero: pageZero.page,
        page999: page999.page,
      });
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // Step 3: getSubmissionForForm
    // -------------------------------------------------------------------------
    process.stdout.write(
      "3. getSubmissionForForm (cross-form isolation and malformed id checks)... "
    );

    // subB belongs to formB, not formA -> must return null
    const crossCheck = await getSubmissionForForm(formA.id, subB.id);

    // malformed IDs -> must return null without throwing
    const malformedSubId = await getSubmissionForForm(formA.id, "not-a-valid-uuid");
    const malformedFormId = await getSubmissionForForm("not-a-valid-uuid", subB.id);

    // correct form and submission -> must return the row
    const validLookup = await getSubmissionForForm(formB.id, subB.id);

    const step3Ok =
      crossCheck === null &&
      malformedSubId === null &&
      malformedFormId === null &&
      validLookup !== null &&
      validLookup.id === subB.id;

    if (step3Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL", {
        crossCheckNull: crossCheck === null,
        malformedSubIdNull: malformedSubId === null,
        malformedFormIdNull: malformedFormId === null,
        validLookupOk: validLookup?.id === subB.id,
      });
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // Step 4: isRetryable truth table
    // -------------------------------------------------------------------------
    process.stdout.write("4. isRetryable truth table... ");

    const testNow = new Date("2026-10-26T12:00:00.000Z");
    const test10sAgo = new Date(testNow.getTime() - 10 * 1000);
    const test5mAgo = new Date(testNow.getTime() - 5 * 60 * 1000);

    const tFailed = isRetryable({ syncStatus: "failed", createdAt: testNow }, testNow);
    const tSynced = isRetryable({ syncStatus: "synced", createdAt: testNow }, testNow);
    const tPendingFresh = isRetryable(
      { syncStatus: "pending", createdAt: test10sAgo },
      testNow
    );
    const tPendingOld = isRetryable(
      { syncStatus: "pending", createdAt: test5mAgo },
      testNow
    );

    const step4Ok =
      tFailed === true &&
      tSynced === false &&
      tPendingFresh === false &&
      tPendingOld === true;

    if (step4Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL", { tFailed, tSynced, tPendingFresh, tPendingOld });
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // Step 5: retrySubmission guard codes
    // -------------------------------------------------------------------------
    process.stdout.write(
      "5. retrySubmission guards (NOT_FOUND, ALREADY_SYNCED, NOT_RETRYABLE)... "
    );

    const nonExistentUuid = randomUUID();
    const resNotFound = await retrySubmission(formA.id, nonExistentUuid);
    const resCrossForm = await retrySubmission(formA.id, subB.id);
    const resAlreadySynced = await retrySubmission(formA.id, subSynced1.id);
    const resNotRetryable = await retrySubmission(formA.id, subPendingFresh.id);

    const step5Ok =
      resNotFound.ok === false &&
      resNotFound.code === "NOT_FOUND" &&
      resCrossForm.ok === false &&
      resCrossForm.code === "NOT_FOUND" &&
      resAlreadySynced.code === "ALREADY_SYNCED" &&
      resNotRetryable.ok === false &&
      resNotRetryable.code === "NOT_RETRYABLE";

    if (step5Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL", {
        resNotFound,
        resCrossForm,
        resAlreadySynced,
        resNotRetryable,
      });
      allPassed = false;
    }

    // -------------------------------------------------------------------------
    // Step 6: getSheetUrl helper
    // -------------------------------------------------------------------------
    process.stdout.write("6. getSheetUrl (builds URL, returns null if missing)... ");

    const validUrl1 = getSheetUrl("1234567890abcdef", 987654);
    const validUrl2 = getSheetUrl("1234567890abcdef", "987654");
    const nullSheet = getSheetUrl(null, 987654);
    const nullGid = getSheetUrl("1234567890abcdef", null);
    const emptySheet = getSheetUrl("", 987654);
    const undefGid = getSheetUrl("1234567890abcdef", undefined);

    const step6Ok =
      validUrl1 ===
        "https://docs.google.com/spreadsheets/d/1234567890abcdef/edit#gid=987654" &&
      validUrl2 ===
        "https://docs.google.com/spreadsheets/d/1234567890abcdef/edit#gid=987654" &&
      nullSheet === null &&
      nullGid === null &&
      emptySheet === null &&
      undefGid === null;

    if (step6Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL", {
        validUrl1,
        validUrl2,
        nullSheet,
        nullGid,
        emptySheet,
        undefGid,
      });
      allPassed = false;
    }
  } catch (err) {
    console.log("FAIL with unexpected error");
    console.error(err);
    allPassed = false;
  } finally {
    // -------------------------------------------------------------------------
    // Step 7: Cleanup test forms (submissions cascade)
    // -------------------------------------------------------------------------
    process.stdout.write(
      "7. Cleanup test forms (submissions cascade automatically)... "
    );
    let cleanupOk = true;
    for (const formId of createdFormIds) {
      try {
        await deleteForm(formId);
      } catch (err) {
        console.error("Cleanup error for form:", formId, err);
        cleanupOk = false;
      }
    }

    if (cleanupOk) {
      console.log("PASS");
    } else {
      console.log("WARN (cleanup had errors)");
    }
  }

  if (allPassed) {
    console.log("\n🎉 ALL SUBMISSIONS & RETRY CHECKS PASSED!");
  } else {
    console.error("\n❌ SOME SUBMISSIONS CHECKS FAILED.");
    process.exit(1);
  }
}

runSubmissionsVerification().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
