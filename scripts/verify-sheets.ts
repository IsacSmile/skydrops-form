import type { Field, Submission } from "../src/types/form";

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

async function runSheetsVerification() {
  console.log("Running Google Sheets sync verification checks...\n");

  const {
    sanitizeTabName,
    buildColumns,
    buildHeader,
    buildRow,
    sanitizeCell,
  } = await import("../src/lib/sheet-format");

  let allPassed = true;

  // ==========================================================================
  // SECTION A: Pure Unit Tests (Always Run)
  // ==========================================================================
  console.log("=== SECTION A: Pure Unit Tests ===");

  // A1: sanitizeTabName
  process.stdout.write("A1. sanitizeTabName (forbidden chars, 100-char limit, fallback, deterministic)... ");
  const rawTitle = "'[Water: / Drops] * Test? \\ \r\n  Special' ";
  const tab1 = sanitizeTabName(rawTitle, "k5n7xs5h");
  const tab1Again = sanitizeTabName(rawTitle, "k5n7xs5h");

  const longTitle = "A".repeat(150);
  const tabLong = sanitizeTabName(longTitle, "slug1234");

  const emptyTitle = "  [ ] * ? : / \\  ";
  const tabEmpty = sanitizeTabName(emptyTitle, "slug1234");

  const a1Passed =
    !/[\[\]*?:/\\]|\r?\n/.test(tab1) &&
    tab1 === tab1Again &&
    tab1 === "Water Drops Test Special (k5n7xs5h)" &&
    tabLong.length <= 100 &&
    tabLong.endsWith("(slug1234)") &&
    tabEmpty === "Form (slug1234)";

  if (a1Passed) {
    console.log("PASS");
  } else {
    console.log("FAIL", { tab1, tabLong, tabEmpty });
    allPassed = false;
  }

  // A2: buildColumns / buildHeader
  process.stdout.write("A2. buildColumns & buildHeader (createdAt order wins, duplicate disambiguation)... ");
  const dummyFields: Field[] = [
    {
      id: "f-1",
      formId: "form-1",
      key: "email",
      label: "Email",
      type: "email",
      required: true,
      placeholder: null,
      options: [],
      position: 1,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
    {
      id: "f-2",
      formId: "form-1",
      key: "name",
      label: "Full Name",
      type: "short_text",
      required: true,
      placeholder: null,
      options: [],
      position: 0, // position is 0, but createdAt is later!
      createdAt: new Date("2026-01-02T00:00:00Z"),
    },
    {
      id: "f-3",
      formId: "form-1",
      key: "dup_email",
      label: "Email", // duplicate label!
      type: "email",
      required: false,
      placeholder: null,
      options: [],
      position: 2,
      createdAt: new Date("2026-01-03T00:00:00Z"),
    },
    {
      id: "f-4",
      formId: "form-1",
      key: "dup_email_2",
      label: "Email", // 3rd duplicate label!
      type: "email",
      required: false,
      placeholder: null,
      options: [],
      position: 3,
      createdAt: new Date("2026-01-04T00:00:00Z"),
    },
  ];

  const cols = buildColumns(dummyFields);
  const header = buildHeader(dummyFields);

  const a2Passed =
    cols[0].key === "email" &&
    cols[1].key === "name" &&
    header.length === 6 &&
    header[0] === "submitted_at" &&
    header[1] === "submission_id" &&
    header[2] === "Email" &&
    header[3] === "Full Name" &&
    header[4] === "Email (2)" &&
    header[5] === "Email (3)";

  if (a2Passed) {
    console.log("PASS");
  } else {
    console.log("FAIL", { cols, header });
    allPassed = false;
  }

  // A3: buildRow
  process.stdout.write("A3. buildRow (null -> '', numbers, checkbox joined, missing keys)... ");
  const dummySubmission: Pick<Submission, "id" | "createdAt" | "data"> = {
    id: "sub-12345",
    createdAt: new Date("2026-05-10T14:30:00Z"),
    data: {
      email: "test@example.com",
      name: null,
      dup_email: ["Design", "Engineering"],
      // dup_email_2 is omitted (undefined)
    },
  };

  const row = buildRow(dummySubmission, dummyFields);
  const a3Passed =
    row[0] === "2026-05-10 14:30:00" &&
    row[1] === "sub-12345" &&
    row[2] === "test@example.com" &&
    row[3] === "" &&
    row[4] === "Design, Engineering" &&
    row[5] === "";

  if (a3Passed) {
    console.log("PASS");
  } else {
    console.log("FAIL", { row });
    allPassed = false;
  }

  // A4: sanitizeCell
  process.stdout.write("A4. sanitizeCell (neutralizes formula injection, preserves phone/numbers)... ");
  const c1 = sanitizeCell("=HYPERLINK('http://malicious.com')");
  const c2 = sanitizeCell("@SUM(A1:A10)");
  const c3 = sanitizeCell("-cmd|'/C calc'!A0");
  const c4 = sanitizeCell("+cmd|'/C calc'!A0");
  const c5 = sanitizeCell("+91 98765 43210");
  const c6 = sanitizeCell("-5");
  const c7 = sanitizeCell("hello");
  const c8 = sanitizeCell(42);

  const a4Passed =
    c1 === "'=HYPERLINK('http://malicious.com')" &&
    c2 === "'@SUM(A1:A10)" &&
    c3 === "'-cmd|'/C calc'!A0" &&
    c4 === "'+cmd|'/C calc'!A0" &&
    c5 === "+91 98765 43210" &&
    c6 === "-5" &&
    c7 === "hello" &&
    c8 === 42;

  if (a4Passed) {
    console.log("PASS");
  } else {
    console.log("FAIL", { c1, c2, c3, c4, c5, c6, c7, c8 });
    allPassed = false;
  }

  // ==========================================================================
  // SECTION B: Integration Tests (Requires Google Env Vars)
  // ==========================================================================
  console.log("\n=== SECTION B: Integration Tests ===");

  const hasGoogleEnv =
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()) &&
    Boolean(process.env.GOOGLE_PRIVATE_KEY?.trim()) &&
    Boolean(process.env.GOOGLE_SHEET_ID?.trim());

  if (!hasGoogleEnv) {
    console.log("SKIPPED: Google env vars not set");
    if (!allPassed) process.exit(1);
    return;
  }

  const {
    getSpreadsheetTabs,
    getValues,
    deleteTab,
  } = await import("../src/lib/google-sheets");
  const { syncSubmission } = await import("../src/lib/sheets-sync");
  const { createForm, deleteForm, getForm } = await import("../src/lib/forms-data");
  const { addField, updateField } = await import("../src/lib/fields-data");
  const { createSubmission } = await import("../src/lib/submissions-data");
  const { db } = await import("../src/db");
  const { forms, submissions } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  const createdFormIds: string[] = [];
  const createdTabGids: number[] = [];

  try {
    // B1: Create form, 3 fields, publish, insert submission, sync
    process.stdout.write("B1. Create form, fields, publish, insert submission, syncSubmission... ");
    const testForm = await createForm({
      title: "Integration Test Form",
      description: "Testing Google Sheets sync",
    });
    createdFormIds.push(testForm.id);

    const f1Res = await addField(testForm.id, {
      key: "first_name",
      label: "First Name",
      type: "short_text",
      required: true,
    });
    const f1 = f1Res.ok ? f1Res.field : null;

    const f2Res = await addField(testForm.id, {
      key: "age",
      label: "Age",
      type: "number",
      required: false,
    });
    const f2 = f2Res.ok ? f2Res.field : null;

    const f3Res = await addField(testForm.id, {
      key: "skills",
      label: "Skills",
      type: "checkbox",
      options: ["Node", "React", "Drizzle"],
      required: false,
    });
    const f3 = f3Res.ok ? f3Res.field : null;

    if (!f1 || !f2 || !f3) {
      throw new Error("Failed to create initial test fields");
    }

    // Publish form in DB
    await db
      .update(forms)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(forms.id, testForm.id));

    const sub1 = await createSubmission(testForm.id, {
      first_name: "Alice",
      age: 30,
      skills: ["Node", "React"],
    });

    const sync1Res = await syncSubmission(sub1.id);

    const [dbSub1] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, sub1.id));

    const formAfterSync1 = await getForm(testForm.id);

    const b1Passed =
      sync1Res.ok &&
      dbSub1?.syncStatus === "synced" &&
      dbSub1.syncAttempts === 1 &&
      dbSub1.syncedAt !== null &&
      dbSub1.syncError === null &&
      Boolean(formAfterSync1?.sheetTab);

    if (b1Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", { sync1Res, dbSub1, formAfterSync1 });
      allPassed = false;
    }

    // B2: Verify tab and row in Google Sheet
    process.stdout.write("B2. Verify tab exists, header matches, data row appended... ");
    const allTabs = await getSpreadsheetTabs();
    const syncedTab = allTabs.find((t) => t.title === formAfterSync1?.sheetTab);
    if (syncedTab) {
      createdTabGids.push(syncedTab.gid);
    }

    const sheetRows = syncedTab
      ? await getValues(`'${syncedTab.title}'!A1:E2`)
      : [];

    const expectedHeader = ["submitted_at", "submission_id", "First Name", "Age", "Skills"];
    const headerRow = sheetRows[0] || [];
    const dataRow = sheetRows[1] || [];

    const b2Passed =
      syncedTab !== undefined &&
      JSON.stringify(headerRow) === JSON.stringify(expectedHeader) &&
      dataRow[1] === sub1.id &&
      dataRow[2] === "Alice" &&
      String(dataRow[3]) === "30" &&
      dataRow[4] === "Node, React";

    if (b2Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", { syncedTab, headerRow, dataRow, expectedHeader });
      allPassed = false;
    }

    // B3 & B4: Add 4th field + rename label, insert submission with formula injection & checkbox
    process.stdout.write("B3 & B4. Add 4th field, rename label, formula injection, header update... ");
    // Rename f1 label
    const updateRes = await updateField(testForm.id, f1.id, {
      label: "Full Name",
      type: f1.type,
      required: f1.required,
      placeholder: f1.placeholder,
      options: f1.options,
    });
    if (!updateRes.ok) {
      throw new Error(`Failed to update field label: ${updateRes.message}`);
    }

    // Add 4th field
    await addField(testForm.id, {
      key: "notes",
      label: "Notes",
      type: "short_text",
      required: false,
    });

    const sub2 = await createSubmission(testForm.id, {
      first_name: "Bob",
      age: 25,
      skills: ["Drizzle"],
      notes: "=1+1",
    });

    const sync2Res = await syncSubmission(sub2.id);

    const sheetRowsAfterSub2 = syncedTab
      ? await getValues(`'${syncedTab.title}'!A1:F3`)
      : [];

    const expectedHeader2 = [
      "submitted_at",
      "submission_id",
      "Full Name",
      "Age",
      "Skills",
      "Notes",
    ];

    const updatedHeaderRow = sheetRowsAfterSub2[0] || [];
    const oldDataRow = sheetRowsAfterSub2[1] || [];
    const newDataRow = sheetRowsAfterSub2[2] || [];

    const b3Passed =
      sync2Res.ok &&
      JSON.stringify(updatedHeaderRow) === JSON.stringify(expectedHeader2) &&
      oldDataRow[1] === sub1.id &&
      oldDataRow[2] === "Alice" &&
      newDataRow[1] === sub2.id &&
      newDataRow[2] === "Bob" &&
      newDataRow[4] === "Drizzle" &&
      newDataRow[5] === "'=1+1"; // Formula injection escaped with leading quote

    if (b3Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", { updatedHeaderRow, oldDataRow, newDataRow });
      allPassed = false;
    }

    // B5: Idempotency on retry: reset Bob's submission to 'failed' with attempts 1
    process.stdout.write("B5. Idempotency on retry (no duplicate row in Google Sheet)... ");
    await db
      .update(submissions)
      .set({
        syncStatus: "failed",
        syncAttempts: 1,
        syncError: "Simulated prior failure",
      })
      .where(eq(submissions.id, sub2.id));

    const retryRes = await syncSubmission(sub2.id);

    const sheetRowsAfterRetry = syncedTab
      ? await getValues(`'${syncedTab.title}'!A1:F10`)
      : [];

    const [dbSub2AfterRetry] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, sub2.id));

    const b5Passed =
      retryRes.ok &&
      retryRes.alreadyPresent === true &&
      sheetRowsAfterRetry.length === 3 && // Still exactly 1 header + 2 data rows
      dbSub2AfterRetry?.syncStatus === "synced" &&
      dbSub2AfterRetry?.syncAttempts === 2 &&
      dbSub2AfterRetry?.syncError === null;

    if (b5Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", { retryRes, rowsCount: sheetRowsAfterRetry.length, dbSub2AfterRetry });
      allPassed = false;
    }

    // B6: Calling syncSubmission when env is unset leaves submission 'pending'
    process.stdout.write("B6. Unset env leaves submission 'pending' without incrementing attempts... ");
    const savedEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    try {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

      const sub3 = await createSubmission(testForm.id, {
        first_name: "Charlie",
        age: 22,
      });

      const unconfiguredRes = await syncSubmission(sub3.id);

      const [dbSub3] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, sub3.id));

      const b6Passed =
        !unconfiguredRes.ok &&
        unconfiguredRes.notConfigured === true &&
        dbSub3?.syncStatus === "pending" &&
        dbSub3.syncAttempts === 0 &&
        dbSub3.syncError === "Google Sheets is not configured";

      if (b6Passed) {
        console.log("PASS");
      } else {
        console.log("FAIL", { unconfiguredRes, dbSub3 });
        allPassed = false;
      }
    } finally {
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = savedEmail;
    }
  } catch (err: unknown) {
    console.log("FAIL with unhandled exception");
    console.error(err);
    allPassed = false;
  } finally {
    // B7: Cleanup ALWAYS runs: delete test tab from Google and test form from Neon
    process.stdout.write("B7. Cleanup test tab from Google Sheets & test form from Neon... ");
    let cleanupOk = true;

    for (const gid of createdTabGids) {
      try {
        await deleteTab(gid);
      } catch (tabErr) {
        console.error("Failed to delete test tab:", tabErr);
        cleanupOk = false;
      }
    }

    for (const formId of createdFormIds) {
      try {
        await deleteForm(formId);
      } catch (formErr) {
        console.error("Failed to delete test form:", formErr);
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
    console.log("\n🎉 ALL GOOGLE SHEETS VERIFICATION CHECKS PASSED!");
  } else {
    console.error("\n❌ SOME GOOGLE SHEETS CHECKS FAILED.");
    process.exit(1);
  }
}

runSheetsVerification().catch((err) => {
  console.error("Fatal error during sheets verification:", err);
  process.exit(1);
});
