// Load environment variables before importing DB
try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    // ignore
  }
}

async function runVerification() {
  const { db } = await import("../src/db");
  const { forms, fields, submissions } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");
  const { nanoid } = await import("nanoid");

  let testFormId: string | null = null;
  let allPassed = true;

  console.log("Starting schema verification on Neon database...\n");

  try {
    // Step 1: Insert a form, 2 fields and 1 submission
    process.stdout.write("Step 1: Insert form, 2 fields, and 1 submission... ");
    const [insertedForm] = await db
      .insert(forms)
      .values({
        slug: `test-${nanoid(8)}`,
        title: "Verification Test Form",
        description: "Temporary form for C1 schema verification",
        status: "draft",
      })
      .returning();

    testFormId = insertedForm.id;

    const [field1, field2] = await db
      .insert(fields)
      .values([
        {
          formId: insertedForm.id,
          key: "fullName",
          label: "Full Name",
          type: "short_text",
          required: true,
          position: 0,
        },
        {
          formId: insertedForm.id,
          key: "preferredColors",
          label: "Preferred Colors",
          type: "checkbox",
          required: false,
          options: ["Red", "Green", "Blue"],
          position: 1,
        },
      ])
      .returning();

    const [insertedSubmission] = await db
      .insert(submissions)
      .values({
        formId: insertedForm.id,
        data: {
          fullName: "Jane Doe",
          preferredColors: ["Red", "Blue"],
        },
        syncStatus: "pending",
      })
      .returning();

    if (
      insertedForm?.id &&
      field1?.id &&
      field2?.id &&
      insertedSubmission?.id
    ) {
      console.log("PASS");
    } else {
      console.log("FAIL - missing inserted records");
      allPassed = false;
    }

    // Step 2: Read them back with relations
    process.stdout.write(
      "Step 2: Read records back with Drizzle relations... "
    );
    const fetchedForm = await db.query.forms.findFirst({
      where: eq(forms.id, insertedForm.id),
      with: {
        fields: true,
        submissions: true,
      },
    });

    if (
      fetchedForm &&
      fetchedForm.fields.length === 2 &&
      fetchedForm.submissions.length === 1 &&
      fetchedForm.fields.some((f) => f.key === "fullName") &&
      fetchedForm.fields.some((f) => f.key === "preferredColors") &&
      fetchedForm.submissions[0].syncStatus === "pending"
    ) {
      console.log("PASS");
    } else {
      console.log("FAIL - relations not properly populated");
      allPassed = false;
    }

    // Step 3: Confirm UNIQUE (form_id, key) rejects duplicate key
    process.stdout.write("Step 3: Verify UNIQUE (form_id, key) constraint... ");
    let rejectedDuplicate = false;
    try {
      await db.insert(fields).values({
        formId: insertedForm.id,
        key: "fullName", // duplicate key on same form_id
        label: "Duplicate Field",
        type: "short_text",
        position: 2,
      });
    } catch {
      rejectedDuplicate = true;
    }

    if (rejectedDuplicate) {
      console.log("PASS");
    } else {
      console.log("FAIL - duplicate (form_id, key) was allowed");
      allPassed = false;
    }

    // Step 4: Delete the form and confirm cascade deletion of fields and submissions
    process.stdout.write(
      "Step 4: Verify ON DELETE CASCADE for fields and submissions... "
    );
    await db.delete(forms).where(eq(forms.id, insertedForm.id));
    testFormId = null; // already deleted

    const remainingFields = await db
      .select()
      .from(fields)
      .where(eq(fields.formId, insertedForm.id));
    const remainingSubmissions = await db
      .select()
      .from(submissions)
      .where(eq(submissions.formId, insertedForm.id));

    if (remainingFields.length === 0 && remainingSubmissions.length === 0) {
      console.log("PASS");
    } else {
      console.log(
        `FAIL - cascade delete failed (remaining fields: ${remainingFields.length}, submissions: ${remainingSubmissions.length})`
      );
      allPassed = false;
    }
  } catch (error) {
    console.error("\nUnexpected error during schema verification:", error);
    allPassed = false;
  } finally {
    // Cleanup if form still exists
    if (testFormId) {
      try {
        const { db } = await import("../src/db");
        const { forms } = await import("../src/db/schema");
        const { eq } = await import("drizzle-orm");
        await db.delete(forms).where(eq(forms.id, testFormId));
        console.log("Cleanup: Deleted test form.");
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }
    }
  }

  if (allPassed) {
    console.log("\nAll schema verification checks passed successfully!");
    process.exit(0);
  } else {
    console.error("\nSchema verification failed.");
    process.exit(1);
  }
}

runVerification();
