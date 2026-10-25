// Load environment variables before testing
try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    // ignore
  }
}

async function runFormsVerification() {
  const {
    createForm,
    getForm,
    updateForm,
    duplicateForm,
    deleteForm,
    listForms,
  } = await import("../src/lib/forms-data");
  const { db } = await import("../src/db");
  const { fields, submissions, forms } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  const createdFormIds: string[] = [];
  let allPassed = true;

  console.log("Running forms-data verification against Neon database...\n");

  try {
    // Step 1: createForm creates a draft with an 8-char slug
    process.stdout.write("1. createForm creates draft with 8-char slug... ");
    const form1 = await createForm({
      title: "Original Verification Form",
      description: "Test description",
    });
    createdFormIds.push(form1.id);

    if (
      form1.id &&
      form1.slug.length === 8 &&
      form1.status === "draft" &&
      form1.title === "Original Verification Form"
    ) {
      console.log("PASS");
    } else {
      console.log("FAIL - invalid form returned from createForm");
      allPassed = false;
    }

    // Step 2: getForm returns it; getForm('not-a-uuid') returns null
    process.stdout.write("2. getForm returns form and handles non-uuid safely... ");
    const fetched = await getForm(form1.id);
    const nonUuid = await getForm("not-a-uuid-string");
    const missingUuid = await getForm("00000000-0000-0000-0000-000000000000");

    if (
      fetched?.id === form1.id &&
      nonUuid === null &&
      missingUuid === null
    ) {
      console.log("PASS");
    } else {
      console.log("FAIL - getForm did not return expected result");
      allPassed = false;
    }

    // Step 3: updateForm changes title/description
    process.stdout.write("3. updateForm changes title/description... ");
    const updated = await updateForm(form1.id, {
      title: "Updated Verification Title",
      description: "Updated description text",
    });

    if (
      updated?.title === "Updated Verification Title" &&
      updated?.description === "Updated description text" &&
      updated?.updatedAt > form1.createdAt
    ) {
      console.log("PASS");
    } else {
      console.log("FAIL - updateForm failed to update fields");
      allPassed = false;
    }

    // Step 4: Insert 2 fields manually, then duplicateForm
    process.stdout.write("4. duplicateForm creates copy with fields and 0 submissions... ");
    await db.insert(fields).values([
      {
        formId: form1.id,
        key: "name",
        label: "Your Name",
        type: "short_text",
        required: true,
        position: 0,
      },
      {
        formId: form1.id,
        key: "feedback",
        label: "Feedback",
        type: "long_text",
        required: false,
        position: 1,
      },
    ]);

    const duplicated = await duplicateForm(form1.id);
    if (duplicated) {
      createdFormIds.push(duplicated.id);
    }

    const dupFields = duplicated
      ? await db
          .select()
          .from(fields)
          .where(eq(fields.formId, duplicated.id))
      : [];

    const dupSubmissions = duplicated
      ? await db
          .select()
          .from(submissions)
          .where(eq(submissions.formId, duplicated.id))
      : [];

    if (
      duplicated &&
      duplicated.id !== form1.id &&
      duplicated.slug !== form1.slug &&
      duplicated.slug.length === 8 &&
      duplicated.title.startsWith("Copy of") &&
      duplicated.status === "draft" &&
      dupFields.length === 2 &&
      dupFields.some((f) => f.key === "name") &&
      dupFields.some((f) => f.key === "feedback") &&
      dupSubmissions.length === 0
    ) {
      console.log("PASS");
    } else {
      console.log("FAIL - duplicateForm did not replicate form properly");
      allPassed = false;
    }

    // Step 5: listForms returns correct fieldCount and submissionCount
    process.stdout.write("5. listForms returns fieldCount and submissionCount... ");
    // Insert 1 submission on the original form
    await db.insert(submissions).values({
      formId: form1.id,
      data: { name: "Alice", feedback: "Great work!" },
      syncStatus: "pending",
    });

    const list = await listForms();
    const item1 = list.find((f) => f.id === form1.id);
    const itemDup = duplicated ? list.find((f) => f.id === duplicated.id) : null;

    if (
      item1 &&
      item1.fieldCount === 2 &&
      item1.submissionCount === 1 &&
      itemDup &&
      itemDup.fieldCount === 2 &&
      itemDup.submissionCount === 0
    ) {
      console.log("PASS");
    } else {
      console.log(
        `FAIL - list counts incorrect. item1: fields=${item1?.fieldCount}, subs=${item1?.submissionCount}`
      );
      allPassed = false;
    }

    // Step 6: deleteForm removes the form and cascades fields and submissions
    process.stdout.write("6. deleteForm cascades fields and submissions... ");
    const deleted1 = await deleteForm(form1.id);
    // Remove from tracking array since deleted
    const idx1 = createdFormIds.indexOf(form1.id);
    if (idx1 >= 0) createdFormIds.splice(idx1, 1);

    const remainingF = await db
      .select()
      .from(fields)
      .where(eq(fields.formId, form1.id));
    const remainingS = await db
      .select()
      .from(submissions)
      .where(eq(submissions.formId, form1.id));

    if (deleted1 && remainingF.length === 0 && remainingS.length === 0) {
      console.log("PASS");
    } else {
      console.log("FAIL - cascade deletion failed");
      allPassed = false;
    }

    // Step 7: deleteForm on missing id returns false
    process.stdout.write("7. deleteForm on missing or bad id returns false... ");
    const delMissing = await deleteForm("00000000-0000-0000-0000-000000000000");
    const delBad = await deleteForm("bad-id");

    if (delMissing === false && delBad === false) {
      console.log("PASS");
    } else {
      console.log("FAIL - deleteForm on non-existent id did not return false");
      allPassed = false;
    }
  } catch (error) {
    console.error("\nUnexpected error during forms verification:", error);
    allPassed = false;
  } finally {
    // Teardown any remaining forms
    for (const id of createdFormIds) {
      try {
        await db.delete(forms).where(eq(forms.id, id));
      } catch (cleanupErr) {
        console.error("Cleanup error for form", id, cleanupErr);
      }
    }
  }

  if (allPassed) {
    console.log("\nAll forms-data verification tests passed!");
    process.exit(0);
  } else {
    console.error("\nForms-data verification tests failed.");
    process.exit(1);
  }
}

runFormsVerification();
