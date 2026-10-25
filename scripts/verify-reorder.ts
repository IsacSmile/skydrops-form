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

async function runReorderVerification() {
  const { moveItem } = await import("../src/lib/reorder");
  const {
    addField,
    reorderFields,
    listFields,
  } = await import("../src/lib/fields-data");
  const { createForm, getForm, deleteForm } = await import("../src/lib/forms-data");
  const { db } = await import("../src/db");
  const { forms } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  const createdFormIds: string[] = [];
  let allPassed = true;

  console.log("Running reorder verification against Neon database...\n");

  try {
    // ------------------------------------------------------------------------
    // Step 1: moveItem pure unit checks
    // ------------------------------------------------------------------------
    process.stdout.write("1. moveItem unit tests... ");
    const letters = ["a", "b", "c", "d"];

    const movedUp = moveItem(letters, 1, "up"); // b moves up -> [b, a, c, d]
    const movedDown = moveItem(letters, 1, "down"); // b moves down -> [a, c, b, d]
    const firstUp = moveItem(letters, 0, "up"); // no-op -> [a, b, c, d]
    const lastDown = moveItem(letters, 3, "down"); // no-op -> [a, b, c, d]
    const singleUp = moveItem(["x"], 0, "up"); // no-op -> [x]
    const singleDown = moveItem(["x"], 0, "down"); // no-op -> [x]

    const step1Ok =
      JSON.stringify(movedUp) === JSON.stringify(["b", "a", "c", "d"]) &&
      JSON.stringify(movedDown) === JSON.stringify(["a", "c", "b", "d"]) &&
      JSON.stringify(firstUp) === JSON.stringify(["a", "b", "c", "d"]) &&
      JSON.stringify(lastDown) === JSON.stringify(["a", "b", "c", "d"]) &&
      JSON.stringify(singleUp) === JSON.stringify(["x"]) &&
      JSON.stringify(singleDown) === JSON.stringify(["x"]);

    if (step1Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL - moveItem behavior mismatch:", {
        movedUp,
        movedDown,
        firstUp,
        lastDown,
        singleUp,
        singleDown,
      });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Setup test form with 4 fields
    // ------------------------------------------------------------------------
    const testForm = await createForm({
      title: "Reorder Test Form",
      description: "Testing reorder operations",
    });
    createdFormIds.push(testForm.id);

    const f0 = await addField(testForm.id, { label: "Field Zero", type: "short_text" });
    const f1 = await addField(testForm.id, { label: "Field One", type: "email" });
    const f2 = await addField(testForm.id, { label: "Field Two", type: "phone" });
    const f3 = await addField(testForm.id, { label: "Field Three", type: "number" });

    if (!f0.ok || !f1.ok || !f2.ok || !f3.ok) {
      throw new Error("Failed to create initial 4 test fields");
    }

    const fieldMapBefore = new Map([
      [f0.field.id, f0.field.key],
      [f1.field.id, f1.field.key],
      [f2.field.id, f2.field.key],
      [f3.field.id, f3.field.key],
    ]);

    // ------------------------------------------------------------------------
    // Step 2: reorderFields on a form with 4 fields: order persisted, positions 0..3
    // ------------------------------------------------------------------------
    process.stdout.write("2. reorderFields on 4 fields persists order with positions 0..3... ");
    const newOrder1 = [f3.field.id, f0.field.id, f2.field.id, f1.field.id];
    const reorderRes1 = await reorderFields(testForm.id, newOrder1);

    const fieldsAfter1 = await listFields(testForm.id);
    const idsAfter1 = fieldsAfter1.map((f) => f.id);
    const positionsAfter1 = fieldsAfter1.map((f) => f.position);

    const step2Ok =
      reorderRes1.ok &&
      JSON.stringify(idsAfter1) === JSON.stringify(newOrder1) &&
      JSON.stringify(positionsAfter1) === JSON.stringify([0, 1, 2, 3]);

    if (step2Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL - reorder not persisted correctly:", {
        reorderRes1,
        idsAfter1,
        positionsAfter1,
      });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 3: missing id -> INVALID; extra id -> INVALID; duplicate id -> INVALID; order unchanged
    // ------------------------------------------------------------------------
    process.stdout.write("3. invalid reorder lists rejected (missing, extra, duplicate) and order preserved... ");
    // Missing id (only 3 ids)
    const missingRes = await reorderFields(testForm.id, [
      f3.field.id,
      f0.field.id,
      f2.field.id,
    ]);

    // Foreign / extra id (5 ids)
    const foreignId = crypto.randomUUID();
    const extraRes = await reorderFields(testForm.id, [
      ...newOrder1,
      foreignId,
    ]);

    // Duplicate id
    const dupRes = await reorderFields(testForm.id, [
      f3.field.id,
      f0.field.id,
      f2.field.id,
      f3.field.id,
    ]);

    // Check order remains unchanged
    const fieldsAfterInvalid = await listFields(testForm.id);
    const idsAfterInvalid = fieldsAfterInvalid.map((f) => f.id);

    const step3Ok =
      !missingRes.ok &&
      missingRes.code === "INVALID" &&
      !extraRes.ok &&
      extraRes.code === "INVALID" &&
      !dupRes.ok &&
      dupRes.code === "INVALID" &&
      JSON.stringify(idsAfterInvalid) === JSON.stringify(newOrder1);

    if (step3Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL - invalid reorder checks failed:", {
        missingCode: !missingRes.ok ? missingRes.code : "ok",
        extraCode: !extraRes.ok ? extraRes.code : "ok",
        dupCode: !dupRes.ok ? dupRes.code : "ok",
        idsAfterInvalid,
      });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 4: nonexistent form id -> FORM_NOT_FOUND
    // ------------------------------------------------------------------------
    process.stdout.write("4. nonexistent or invalid form ID returns FORM_NOT_FOUND... ");
    const notFoundRes = await reorderFields(
      "00000000-0000-0000-0000-000000000000",
      newOrder1
    );
    const badIdRes = await reorderFields("not-a-uuid", newOrder1);

    const step4Ok =
      !notFoundRes.ok &&
      notFoundRes.code === "FORM_NOT_FOUND" &&
      !badIdRes.ok &&
      badIdRes.code === "FORM_NOT_FOUND";

    if (step4Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL - expected FORM_NOT_FOUND:", { notFoundRes, badIdRes });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 5: reordering works on a locked (published) form
    // ------------------------------------------------------------------------
    process.stdout.write("5. reordering works on a locked (published) form... ");
    await db
      .update(forms)
      .set({
        status: "published",
        publishedAt: new Date(),
      })
      .where(eq(forms.id, testForm.id));

    const newOrderLocked = [f1.field.id, f2.field.id, f0.field.id, f3.field.id];
    const lockedReorderRes = await reorderFields(testForm.id, newOrderLocked);

    const fieldsAfterLocked = await listFields(testForm.id);
    const idsAfterLocked = fieldsAfterLocked.map((f) => f.id);
    const positionsAfterLocked = fieldsAfterLocked.map((f) => f.position);

    const step5Ok =
      lockedReorderRes.ok &&
      JSON.stringify(idsAfterLocked) === JSON.stringify(newOrderLocked) &&
      JSON.stringify(positionsAfterLocked) === JSON.stringify([0, 1, 2, 3]);

    if (step5Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL - reordering on locked form failed:", {
        lockedReorderRes,
        idsAfterLocked,
      });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 6: forms.updated_at changes after a reorder
    // ------------------------------------------------------------------------
    process.stdout.write("6. forms.updated_at changes after a reorder... ");
    const formBefore = await getForm(testForm.id);
    const timeBefore = formBefore?.updatedAt ? new Date(formBefore.updatedAt).getTime() : 0;

    // Wait 50ms so timestamp increases
    await new Promise((r) => setTimeout(r, 50));

    const swapBackOrder = [f0.field.id, f1.field.id, f2.field.id, f3.field.id];
    await reorderFields(testForm.id, swapBackOrder);

    const formAfter = await getForm(testForm.id);
    const timeAfter = formAfter?.updatedAt ? new Date(formAfter.updatedAt).getTime() : 0;

    const step6Ok = timeAfter > timeBefore;

    if (step6Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL - forms.updated_at did not advance:", {
        timeBefore,
        timeAfter,
      });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 7: field keys are unchanged after reordering
    // ------------------------------------------------------------------------
    process.stdout.write("7. field keys are unchanged after reordering... ");
    const finalFields = await listFields(testForm.id);
    let keysMatch = true;

    for (const f of finalFields) {
      const originalKey = fieldMapBefore.get(f.id);
      if (f.key !== originalKey) {
        keysMatch = false;
        console.log(`Key mismatch for ${f.id}: expected ${originalKey}, got ${f.key}`);
      }
    }

    if (keysMatch) {
      console.log("PASS");
    } else {
      console.log("FAIL - field keys were mutated during reorder");
      allPassed = false;
    }
  } catch (error) {
    console.error("\nUnexpected error during reorder verification:", error);
    allPassed = false;
  } finally {
    // Teardown test form
    for (const id of createdFormIds) {
      try {
        await deleteForm(id);
      } catch (cleanupErr) {
        console.error("Cleanup error for form", id, cleanupErr);
      }
    }
  }

  if (allPassed) {
    console.log("\nAll reorder verification tests passed!");
    process.exit(0);
  } else {
    console.error("\nReorder verification tests failed.");
    process.exit(1);
  }
}

runReorderVerification();
