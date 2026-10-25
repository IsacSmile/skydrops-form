import type { FormStatus } from "../src/types/form";

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

async function runStatusVerification() {
  const { canTransition } = await import(
    "../src/lib/form-status"
  );
  const {
    createForm,
    getForm,
    deleteForm,
    setFormStatus,
  } = await import("../src/lib/forms-data");
  const { addField } = await import("../src/lib/fields-data");
  const { isStructureLocked } = await import("../src/types/form");
  const { buildShortLink } = await import("../src/lib/short-link");

  const createdFormIds: string[] = [];
  let allPassed = true;

  console.log("Running form status verification against Neon database...\n");

  try {
    // ------------------------------------------------------------------------
    // Step 1: canTransition truth table (all 9 combinations of from/to)
    // ------------------------------------------------------------------------
    process.stdout.write("1. canTransition truth table (all 9 combinations)... ");
    const allStatuses: FormStatus[] = ["draft", "published", "closed"];
    const expectedTruthTable: Record<string, boolean> = {
      "draft->draft": false,
      "draft->published": true,
      "draft->closed": false,
      "published->draft": true,
      "published->published": false,
      "published->closed": true,
      "closed->draft": true,
      "closed->published": true,
      "closed->closed": false,
    };

    let truthTablePassed = true;
    for (const from of allStatuses) {
      for (const to of allStatuses) {
        const key = `${from}->${to}`;
        const actual = canTransition(from, to);
        const expected = expectedTruthTable[key];
        if (actual !== expected) {
          console.error(`\nMismatch for ${key}: expected ${expected}, got ${actual}`);
          truthTablePassed = false;
        }
      }
    }

    if (truthTablePassed) {
      console.log("PASS");
    } else {
      console.log("FAIL");
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 2: publish a form with 0 fields -> NO_FIELDS; status still draft
    // ------------------------------------------------------------------------
    process.stdout.write("2. Publish form with 0 fields (returns NO_FIELDS)... ");
    const form = await createForm({
      title: "Test Status Form",
      description: "Testing status transitions",
    });
    createdFormIds.push(form.id);
    const initialSlug = form.slug;

    const noFieldsRes = await setFormStatus(form.id, "published");
    const formAfterStep2 = await getForm(form.id);

    const step2Passed =
      !noFieldsRes.ok &&
      noFieldsRes.code === "NO_FIELDS" &&
      noFieldsRes.message === "Add at least one field before publishing." &&
      formAfterStep2?.status === "draft" &&
      formAfterStep2?.publishedAt === null;

    if (step2Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", noFieldsRes);
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 3: add a field, publish -> status published, publishedAt set
    // ------------------------------------------------------------------------
    process.stdout.write("3. Add field, publish -> published, publishedAt set... ");
    const fieldRes = await addField(form.id, {
      label: "Full Name",
      type: "short_text",
      required: true,
    });
    if (!fieldRes.ok) {
      throw new Error(`Failed to add field: ${fieldRes.message}`);
    }

    const publishRes = await setFormStatus(form.id, "published");
    const formAfterStep3 = await getForm(form.id);

    const initialPublishedAt = formAfterStep3?.publishedAt;
    const step3Passed =
      publishRes.ok &&
      publishRes.form.status === "published" &&
      formAfterStep3?.status === "published" &&
      initialPublishedAt !== null &&
      initialPublishedAt !== undefined;

    if (step3Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", publishRes);
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 4: unpublish -> draft, publishedAt UNCHANGED; isStructureLocked true
    // ------------------------------------------------------------------------
    process.stdout.write("4. Unpublish -> draft, publishedAt unchanged, structure locked... ");
    const unpublishRes = await setFormStatus(form.id, "draft");
    const formAfterStep4 = await getForm(form.id);

    const step4Passed =
      unpublishRes.ok &&
      unpublishRes.form.status === "draft" &&
      formAfterStep4?.status === "draft" &&
      formAfterStep4?.publishedAt !== null &&
      new Date(formAfterStep4!.publishedAt!).getTime() ===
        new Date(initialPublishedAt!).getTime() &&
      isStructureLocked(formAfterStep4!);

    if (step4Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", unpublishRes, formAfterStep4?.publishedAt);
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 5: republish -> publishedAt equals value from step 3 (not overwritten)
    // ------------------------------------------------------------------------
    process.stdout.write("5. Republish -> publishedAt preserved from first publish... ");
    // Small delay to ensure timestamp would differ if overwritten
    await new Promise((r) => setTimeout(r, 50));

    const republishRes = await setFormStatus(form.id, "published");
    const formAfterStep5 = await getForm(form.id);

    const step5Passed =
      republishRes.ok &&
      republishRes.form.status === "published" &&
      formAfterStep5?.status === "published" &&
      new Date(formAfterStep5!.publishedAt!).getTime() ===
        new Date(initialPublishedAt!).getTime();

    if (step5Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", {
        step3Date: initialPublishedAt,
        step5Date: formAfterStep5?.publishedAt,
      });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 6: close -> closed; reopen -> published; closed -> draft works
    // ------------------------------------------------------------------------
    process.stdout.write("6. Close -> Reopen -> Close -> Draft transitions... ");
    const closeRes1 = await setFormStatus(form.id, "closed");
    const reopenRes = await setFormStatus(form.id, "published");
    const closeRes2 = await setFormStatus(form.id, "closed");
    const unpublishFromClosed = await setFormStatus(form.id, "draft");
    const formAfterStep6 = await getForm(form.id);

    const step6Passed =
      closeRes1.ok &&
      closeRes1.form.status === "closed" &&
      reopenRes.ok &&
      reopenRes.form.status === "published" &&
      closeRes2.ok &&
      closeRes2.form.status === "closed" &&
      unpublishFromClosed.ok &&
      unpublishFromClosed.form.status === "draft" &&
      formAfterStep6?.status === "draft";

    if (step6Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", {
        closeRes1,
        reopenRes,
        closeRes2,
        unpublishFromClosed,
      });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 7: invalid transitions return INVALID_TRANSITION
    // ------------------------------------------------------------------------
    process.stdout.write("7. Invalid transitions (draft->closed, draft->draft, published->published)... ");
    // Currently draft
    const draftToClosed = await setFormStatus(form.id, "closed");
    const draftToDraft = await setFormStatus(form.id, "draft");

    // Move to published
    await setFormStatus(form.id, "published");
    const pubToPub = await setFormStatus(form.id, "published");

    const step7Passed =
      !draftToClosed.ok &&
      draftToClosed.code === "INVALID_TRANSITION" &&
      !draftToDraft.ok &&
      draftToDraft.code === "INVALID_TRANSITION" &&
      !pubToPub.ok &&
      pubToPub.code === "INVALID_TRANSITION";

    if (step7Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", { draftToClosed, draftToDraft, pubToPub });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 8: nonexistent form id -> FORM_NOT_FOUND
    // ------------------------------------------------------------------------
    process.stdout.write("8. Nonexistent form id -> FORM_NOT_FOUND... ");
    const fakeUuid = "00000000-0000-0000-0000-000000000000";
    const notFoundRes = await setFormStatus(fakeUuid, "published");

    const step8Passed =
      !notFoundRes.ok && notFoundRes.code === "FORM_NOT_FOUND";

    if (step8Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", notFoundRes);
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 9: slug is identical before and after all of the above
    // ------------------------------------------------------------------------
    process.stdout.write("9. Slug immutability throughout transitions... ");
    const formFinal = await getForm(form.id);

    const step9Passed =
      formFinal?.slug === initialSlug &&
      typeof formFinal?.slug === "string" &&
      formFinal.slug.length > 0;

    if (step9Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", { initialSlug, finalSlug: formFinal?.slug });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 10: race condition (two concurrent setFormStatus calls)
    // ------------------------------------------------------------------------
    process.stdout.write("10. Race condition (concurrent published -> closed)... ");
    // Ensure form is currently published
    const cur = await getForm(form.id);
    if (cur?.status !== "published") {
      await setFormStatus(form.id, "published");
    }

    const [raceRes1, raceRes2] = await Promise.all([
      setFormStatus(form.id, "closed"),
      setFormStatus(form.id, "closed"),
    ]);

    const successCount = (raceRes1.ok ? 1 : 0) + (raceRes2.ok ? 1 : 0);
    const failureCount = (!raceRes1.ok ? 1 : 0) + (!raceRes2.ok ? 1 : 0);
    const failedResult = !raceRes1.ok ? raceRes1 : raceRes2;

    const step10Passed =
      successCount === 1 &&
      failureCount === 1 &&
      !failedResult.ok &&
      failedResult.code === "INVALID_TRANSITION";

    if (step10Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", { raceRes1, raceRes2 });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 11: buildShortLink pure function checks
    // ------------------------------------------------------------------------
    process.stdout.write("11. buildShortLink origin and trailing slash handling... ");
    const linkNoSlash = buildShortLink("a1b2c3d4", "https://example.com");
    const linkTrailingSlash = buildShortLink("a1b2c3d4", "https://example.com/");
    const linkMultiSlash = buildShortLink("a1b2c3d4", "https://example.com///");
    const linkNoOrigin = buildShortLink("a1b2c3d4");

    const step11Passed =
      linkNoSlash === "https://example.com/f/a1b2c3d4" &&
      linkTrailingSlash === "https://example.com/f/a1b2c3d4" &&
      linkMultiSlash === "https://example.com/f/a1b2c3d4" &&
      linkNoOrigin === "/f/a1b2c3d4";

    if (step11Passed) {
      console.log("PASS");
    } else {
      console.log("FAIL", {
        linkNoSlash,
        linkTrailingSlash,
        linkMultiSlash,
        linkNoOrigin,
      });
      allPassed = false;
    }
  } catch (error) {
    console.error("\nUnexpected error during verification:", error);
    allPassed = false;
  } finally {
    // Cleanup created forms
    if (createdFormIds.length > 0) {
      process.stdout.write("\nCleaning up test forms... ");
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
    console.log("\n🎉 ALL FORM STATUS VERIFICATION CHECKS PASSED!\n");
    process.exit(0);
  } else {
    console.error("\n❌ SOME FORM STATUS CHECKS FAILED.\n");
    process.exit(1);
  }
}

runStatusVerification();
