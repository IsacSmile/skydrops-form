import type { Field } from "../src/types/form";

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

async function runSubmitVerification() {
  const { validateSubmission } = await import(
    "../src/lib/submission-validation"
  );
  const {
    createForm,
    deleteForm,
    setFormStatus,
    getPublicFormBySlug,
  } = await import("../src/lib/forms-data");
  const { addField } = await import("../src/lib/fields-data");
  const { createSubmission } = await import("../src/lib/submissions-data");
  const { db } = await import("../src/db");
  const { submissions } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  const createdFormIds: string[] = [];
  let allPassed = true;

  console.log("Running submission validation & API verification checks...\n");

  try {
    // ------------------------------------------------------------------------
    // Step 1: validateSubmission pure unit cases for EVERY field type
    // ------------------------------------------------------------------------
    process.stdout.write("1. validateSubmission pure unit cases for every field type... ");

    const testFields: Field[] = [
      {
        id: "f-1",
        formId: "form-1",
        key: "name",
        label: "Name",
        type: "short_text",
        required: true,
        placeholder: null,
        options: [],
        position: 0,
        createdAt: new Date(),
      },
      {
        id: "f-2",
        formId: "form-1",
        key: "bio",
        label: "Bio",
        type: "long_text",
        required: false,
        placeholder: null,
        options: [],
        position: 1,
        createdAt: new Date(),
      },
      {
        id: "f-3",
        formId: "form-1",
        key: "contact_email",
        label: "Email",
        type: "email",
        required: true,
        placeholder: null,
        options: [],
        position: 2,
        createdAt: new Date(),
      },
      {
        id: "f-4",
        formId: "form-1",
        key: "phone_num",
        label: "Phone",
        type: "phone",
        required: false,
        placeholder: null,
        options: [],
        position: 3,
        createdAt: new Date(),
      },
      {
        id: "f-5",
        formId: "form-1",
        key: "age",
        label: "Age",
        type: "number",
        required: true,
        placeholder: null,
        options: [],
        position: 4,
        createdAt: new Date(),
      },
      {
        id: "f-6",
        formId: "form-1",
        key: "birth_date",
        label: "Birth Date",
        type: "date",
        required: true,
        placeholder: null,
        options: [],
        position: 5,
        createdAt: new Date(),
      },
      {
        id: "f-7",
        formId: "form-1",
        key: "plan",
        label: "Plan",
        type: "dropdown",
        required: true,
        placeholder: null,
        options: ["Basic", "Pro", "Enterprise"],
        position: 6,
        createdAt: new Date(),
      },
      {
        id: "f-8",
        formId: "form-1",
        key: "gender",
        label: "Gender",
        type: "radio",
        required: false,
        placeholder: null,
        options: ["Female", "Male", "Other"],
        position: 7,
        createdAt: new Date(),
      },
      {
        id: "f-9",
        formId: "form-1",
        key: "interests",
        label: "Interests",
        type: "checkbox",
        required: true,
        placeholder: null,
        options: ["Tech", "Design", "Marketing"],
        position: 8,
        createdAt: new Date(),
      },
      {
        id: "f-10",
        formId: "form-1",
        key: "avatar",
        label: "Avatar",
        type: "file",
        required: true,
        placeholder: null,
        options: [],
        position: 9,
        createdAt: new Date(),
      },
    ];

    // Case 1A: Perfectly valid input with unknown key and string numbers
    const validRaw = {
      name: "  Alice Smith  ",
      bio: "  Loves coding  ",
      contact_email: "alice@example.com",
      phone_num: "+1 (555) 123-4567",
      age: "28",
      birth_date: "1998-04-12",
      plan: "Pro",
      gender: "Female",
      interests: ["Tech", "Design", "Tech"], // duplicates
      unknown_key: "should be dropped",
      avatar: "file-data", // should be skipped while file uploads disabled
    };

    const res1A = validateSubmission(testFields, validRaw);
    const pass1A =
      res1A.ok &&
      res1A.data.name === "Alice Smith" &&
      res1A.data.bio === "Loves coding" &&
      res1A.data.contact_email === "alice@example.com" &&
      res1A.data.phone_num === "+1 (555) 123-4567" &&
      res1A.data.age === 28 &&
      res1A.data.birth_date === "1998-04-12" &&
      res1A.data.plan === "Pro" &&
      res1A.data.gender === "Female" &&
      JSON.stringify(res1A.data.interests) === JSON.stringify(["Tech", "Design"]) &&
      !("unknown_key" in res1A.data) &&
      !("avatar" in res1A.data);

    // Case 1B: Optional fields empty -> stored as null
    const validWithOptionalsEmpty = {
      name: "Bob",
      contact_email: "bob@example.com",
      age: 35,
      birth_date: "1990-01-01",
      plan: "Basic",
      interests: ["Marketing"],
    };
    const res1B = validateSubmission(testFields, validWithOptionalsEmpty);
    const pass1B =
      res1B.ok &&
      res1B.data.bio === null &&
      res1B.data.phone_num === null &&
      res1B.data.gender === null;

    // Case 1C: Missing required fields
    const res1C = validateSubmission(testFields, {});
    const pass1C =
      !res1C.ok &&
      res1C.fieldErrors.name === "This field is required." &&
      res1C.fieldErrors.contact_email === "This field is required." &&
      res1C.fieldErrors.age === "This field is required." &&
      res1C.fieldErrors.birth_date === "This field is required." &&
      res1C.fieldErrors.plan === "This field is required." &&
      res1C.fieldErrors.interests === "This field is required.";

    // Case 1D: Invalid field formats (bad date, invalid email, invalid phone, non-option dropdown, non-option checkbox)
    const invalidFormats = {
      name: "x".repeat(501), // over 500 chars
      contact_email: "not-an-email",
      phone_num: "123", // under 7 chars
      age: "not-a-number",
      birth_date: "2026-02-31", // invalid date
      plan: "InvalidPlan", // not in options
      interests: ["Tech", "Hacking"], // Hacking not in options
    };
    const res1D = validateSubmission(testFields, invalidFormats);
    const pass1D =
      !res1D.ok &&
      !!res1D.fieldErrors.name &&
      !!res1D.fieldErrors.contact_email &&
      !!res1D.fieldErrors.phone_num &&
      !!res1D.fieldErrors.age &&
      !!res1D.fieldErrors.birth_date &&
      !!res1D.fieldErrors.plan &&
      !!res1D.fieldErrors.interests;

    if (pass1A && pass1B && pass1C && pass1D) {
      console.log("PASS");
    } else {
      console.log("FAIL", { pass1A, pass1B, pass1C, pass1D, res1A, res1C, res1D });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 2: createSubmission stores data with sync_status 'pending'
    // ------------------------------------------------------------------------
    process.stdout.write("2. createSubmission stores data with sync_status 'pending'... ");
    const form1 = await createForm({
      title: "Submit Verification Form 1",
      description: "Testing createSubmission",
    });
    createdFormIds.push(form1.id);

    const testSubmissionData = {
      name: "Charlie",
      age: 22,
    };
    const createdSub = await createSubmission(form1.id, testSubmissionData);

    const [dbSub] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, createdSub.id));

    const step2Passed =
      dbSub !== undefined &&
      dbSub.formId === form1.id &&
      dbSub.syncStatus === "pending" &&
      dbSub.syncAttempts === 0 &&
      (dbSub.data as Record<string, unknown>)?.name === testSubmissionData.name &&
      (dbSub.data as Record<string, unknown>)?.age === testSubmissionData.age;

    if (step2Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", { createdSub, dbSub });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 3: getPublicFormBySlug (published -> form+fields; draft -> null; closed -> closed status; malformed -> null)
    // ------------------------------------------------------------------------
    process.stdout.write("3. getPublicFormBySlug status behavior & slug validation... ");
    const form2 = await createForm({
      title: "Submit Verification Form 2",
      description: "Testing getPublicFormBySlug",
    });
    createdFormIds.push(form2.id);

    await addField(form2.id, {
      label: "Question 1",
      type: "short_text",
      required: true,
    });
    await addField(form2.id, {
      label: "Question 2",
      type: "number",
      required: false,
    });

    // 3a. Draft form -> returns null (never reveals draft existence)
    const draftRes = await getPublicFormBySlug(form2.slug);
    const passDraft = draftRes === null;

    // 3b. Published form -> returns form + fields in position order
    await setFormStatus(form2.id, "published");
    const pubRes = await getPublicFormBySlug(form2.slug);
    const passPub =
      pubRes !== null &&
      pubRes.form.title === "Submit Verification Form 2" &&
      pubRes.form.status === "published" &&
      !("sheetTab" in pubRes.form) &&
      pubRes.fields.length === 2 &&
      pubRes.fields[0].position <= pubRes.fields[1].position;

    // 3c. Closed form -> returns form with status 'closed'
    await setFormStatus(form2.id, "closed");
    const closedRes = await getPublicFormBySlug(form2.slug);
    const passClosed =
      closedRes !== null && closedRes.form.status === "closed";

    // 3d. Malformed slugs -> null without querying
    const passMalformed1 = (await getPublicFormBySlug("short")) === null;
    const passMalformed2 = (await getPublicFormBySlug("UPPERCASE")) === null;
    const passMalformed3 = (await getPublicFormBySlug("special!@#")) === null;
    const passMalformed4 = (await getPublicFormBySlug("waytoolongslug123456")) === null;

    const step3Passed =
      passDraft &&
      passPub &&
      passClosed &&
      passMalformed1 &&
      passMalformed2 &&
      passMalformed3 &&
      passMalformed4;

    if (step3Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", {
        passDraft,
        passPub,
        passClosed,
        passMalformed1,
        passMalformed2,
      });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 4: fetch against the running dev server
    // ------------------------------------------------------------------------
    process.stdout.write("4. HTTP fetch against dev server (/api/submit)... ");
    const baseUrl = "http://localhost:3000";

    let devServerRunning = false;
    try {
      const ping = await fetch(`${baseUrl}/api/health`);
      if (ping.ok) devServerRunning = true;
    } catch {
      devServerRunning = false;
    }

    if (!devServerRunning) {
      console.log("SKIPPED (Dev server is not running on port 3000)");
    } else {
      // Create a dedicated form for API tests
      const apiForm = await createForm({
        title: "API Submit Test Form",
        description: "Testing API submit route",
      });
      createdFormIds.push(apiForm.id);

      const f1 = await addField(apiForm.id, {
        label: "Your Email",
        type: "email",
        required: true,
      });
      const f2 = await addField(apiForm.id, {
        label: "Your Note",
        type: "short_text",
        required: false,
      });
      if (!f1.ok || !f2.ok) throw new Error("Failed to add test fields");

      await setFormStatus(apiForm.id, "published");

      // 4a. Valid POST -> 200 and row stored in Neon
      const res4A = await fetch(`${baseUrl}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: apiForm.slug,
          answers: {
            [f1.field.key]: "valid@example.com",
            [f2.field.key]: "Hello world",
          },
        }),
      });
      const body4A = await res4A.json();
      const pass4A = res4A.status === 200 && body4A.ok === true;

      // Verify row exists in Neon
      const formSubs = await db
        .select()
        .from(submissions)
        .where(eq(submissions.formId, apiForm.id));
      const rowStored = formSubs.length === 1;

      // 4b. Missing required field -> 422 with fieldErrors
      const res4B = await fetch(`${baseUrl}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: apiForm.slug,
          answers: {
            [f2.field.key]: "Just a note",
          },
        }),
      });
      const body4B = await res4B.json();
      const pass4B =
        res4B.status === 422 &&
        body4B.ok === false &&
        body4B.fieldErrors?.[f1.field.key] === "This field is required.";

      // 4c. Closed form -> 403
      await setFormStatus(apiForm.id, "closed");
      const res4C = await fetch(`${baseUrl}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: apiForm.slug,
          answers: { [f1.field.key]: "test@example.com" },
        }),
      });
      const pass4C = res4C.status === 403;

      // 4d. Draft form -> 404
      await setFormStatus(apiForm.id, "draft");
      const res4D = await fetch(`${baseUrl}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: apiForm.slug,
          answers: { [f1.field.key]: "test@example.com" },
        }),
      });
      const pass4D = res4D.status === 404;

      // 4e. Bad slug -> 404
      const res4E = await fetch(`${baseUrl}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "bad_slug_123",
          answers: {},
        }),
      });
      const pass4E = res4E.status === 404;

      // 4f. Honeypot filled -> 200 but NO row stored
      await setFormStatus(apiForm.id, "published");
      const subsBeforeHoneypot = (
        await db
          .select()
          .from(submissions)
          .where(eq(submissions.formId, apiForm.id))
      ).length;

      const res4F = await fetch(`${baseUrl}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: apiForm.slug,
          answers: { [f1.field.key]: "spam@example.com" },
          website: "https://spam-bot.xyz",
        }),
      });
      const body4F = await res4F.json();
      const subsAfterHoneypot = (
        await db
          .select()
          .from(submissions)
          .where(eq(submissions.formId, apiForm.id))
      ).length;

      const pass4F =
        res4F.status === 200 &&
        body4F.ok === true &&
        subsBeforeHoneypot === subsAfterHoneypot;

      // 4g. Body over 100 KB -> 400
      const largePayload = {
        slug: apiForm.slug,
        answers: {
          [f1.field.key]: "test@example.com",
          large: "x".repeat(101 * 1024),
        },
      };
      const res4G = await fetch(`${baseUrl}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(largePayload),
      });
      const pass4G = res4G.status === 400;

      // 4h. Malformed JSON -> 400
      const res4H = await fetch(`${baseUrl}/api/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ not valid json",
      });
      const pass4H = res4H.status === 400;

      const step4Passed =
        pass4A &&
        rowStored &&
        pass4B &&
        pass4C &&
        pass4D &&
        pass4E &&
        pass4F &&
        pass4G &&
        pass4H;

      if (step4Passed) {
        console.log("PASS");
      } else {
        console.log("FAIL", {
          pass4A,
          rowStored,
          pass4B,
          pass4C,
          pass4D,
          pass4E,
          pass4F,
          pass4G,
          pass4H,
        });
        allPassed = false;
      }
    }
  } catch (error) {
    console.error("\nUnexpected error during submit verification:", error);
    allPassed = false;
  } finally {
    // ------------------------------------------------------------------------
    // Step 5: Cleanup all test forms
    // ------------------------------------------------------------------------
    if (createdFormIds.length > 0) {
      process.stdout.write("5. Cleaning up test forms... ");
      for (const id of createdFormIds) {
        try {
          await deleteForm(id);
        } catch (e) {
          console.error(`Failed to delete test form ${id}:`, e);
        }
      }
      console.log("Cleaned up");
    }
  }

  if (allPassed) {
    console.log("\n🎉 ALL SUBMISSION VERIFICATION CHECKS PASSED!\n");
    process.exit(0);
  } else {
    console.error("\n❌ SOME SUBMISSION CHECKS FAILED.\n");
    process.exit(1);
  }
}

runSubmitVerification();
