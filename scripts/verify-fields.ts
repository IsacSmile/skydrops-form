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

async function runFieldsVerification() {
  const { generateFieldKey } = await import("../src/lib/field-keys");
  const {
    addField,
    updateField,
    deleteField,
    listFields,
  } = await import("../src/lib/fields-data");
  const { createForm, deleteForm } = await import("../src/lib/forms-data");
  const { db } = await import("../src/db");
  const { forms, fields } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");
  const { FIELD_TYPES } = await import("../src/types/form");

  const createdFormIds: string[] = [];
  let allPassed = true;

  console.log("Running field-keys and fields-data verification against Neon...\n");

  try {
    // ------------------------------------------------------------------------
    // Step 1: generateFieldKey pure unit checks
    // ------------------------------------------------------------------------
    process.stdout.write("1. generateFieldKey unit cases... ");
    const keyFullName = generateFieldKey("Full Name", new Set());
    const keyDuplicate = generateFieldKey("Full Name", new Set(["full_name"]));
    const keyEmail = generateFieldKey("Email!!", new Set());
    const keyEmpty = generateFieldKey("", new Set());
    const keyReserved = generateFieldKey("ID", new Set());
    const keyCafe = generateFieldKey("Café", new Set());
    const longLabel = "a".repeat(100);
    const keyLong = generateFieldKey(longLabel, new Set());

    const step1Ok =
      keyFullName === "full_name" &&
      keyDuplicate === "full_name_2" &&
      keyEmail === "email" &&
      keyEmpty === "field" &&
      keyReserved !== "id" &&
      keyReserved === "id_2" &&
      keyCafe === "cafe" &&
      keyLong.length <= 40 &&
      keyLong.length === 40;

    if (step1Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL - generateFieldKey results unexpected:", {
        keyFullName,
        keyDuplicate,
        keyEmail,
        keyEmpty,
        keyReserved,
        keyCafe,
        keyLongLen: keyLong.length,
      });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Setup unlocked test form
    // ------------------------------------------------------------------------
    const testForm1 = await createForm({
      title: "Field Test Form Unlocked",
      description: "Testing field operations",
    });
    createdFormIds.push(testForm1.id);

    // ------------------------------------------------------------------------
    // Step 2: add one field of every one of the 10 types; positions increase
    // ------------------------------------------------------------------------
    process.stdout.write("2. add one field of each of the 10 types; positions increase... ");
    let step2Ok = true;

    for (let i = 0; i < FIELD_TYPES.length; i++) {
      const type = FIELD_TYPES[i];
      const defaultOptions =
        type === "dropdown" || type === "radio"
          ? ["Option A", "Option B"]
          : type === "checkbox"
            ? ["Option 1"]
            : [];

      const res = await addField(testForm1.id, {
        label: `Field ${type}`,
        type,
        required: i % 2 === 0,
        placeholder: `Placeholder for ${type}`,
        options: defaultOptions,
      });

      if (!res.ok || res.field.position !== i) {
        step2Ok = false;
        console.log(`Failed on type ${type}:`, res);
        break;
      }
    }

    const form1Fields = await listFields(testForm1.id);
    if (step2Ok && form1Fields.length === 10) {
      console.log("PASS");
    } else {
      console.log(`FAIL - expected 10 fields, got ${form1Fields.length}`);
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 3: option types reject fewer than min options, duplicates, and
    //         non-option types force options to []
    // ------------------------------------------------------------------------
    process.stdout.write("3. option validation and non-option options clearing... ");
    // Dropdown with 1 option -> INVALID
    const failDropdownMin = await addField(testForm1.id, {
      label: "Bad Dropdown",
      type: "dropdown",
      options: ["Only One"],
    });

    // Radio with duplicate options (case-insensitive) -> INVALID
    const failRadioDup = await addField(testForm1.id, {
      label: "Duplicate Radio",
      type: "radio",
      options: ["Apple", "apple"],
    });

    // Checkbox with 0 options -> INVALID
    const failCheckboxMin = await addField(testForm1.id, {
      label: "Zero Checkbox",
      type: "checkbox",
      options: [],
    });

    // Text field passed with options -> must be forced to []
    const okTextOptionsForced = await addField(testForm1.id, {
      label: "Text with options",
      type: "short_text",
      options: ["Should", "Be", "Ignored"],
    });

    const step3Ok =
      !failDropdownMin.ok &&
      failDropdownMin.code === "INVALID" &&
      !failRadioDup.ok &&
      failRadioDup.code === "INVALID" &&
      !failCheckboxMin.ok &&
      failCheckboxMin.code === "INVALID" &&
      okTextOptionsForced.ok &&
      Array.isArray(okTextOptionsForced.field.options) &&
      okTextOptionsForced.field.options.length === 0;

    if (step3Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL - option rules not enforced as expected:", {
        failDropdownMin,
        failRadioDup,
        failCheckboxMin,
        okTextOptionsForced,
      });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 4: unlocked form: change type, delete field -> allowed
    // ------------------------------------------------------------------------
    process.stdout.write("4. unlocked form: change type, delete field allowed... ");
    if (okTextOptionsForced.ok) {
      const fieldIdToChange = okTextOptionsForced.field.id;
      // Change from short_text to long_text
      const changeRes = await updateField(testForm1.id, fieldIdToChange, {
        label: "Now Long Text",
        type: "long_text",
        required: true,
        placeholder: "Write lots here",
        options: [],
      });

      // Delete the field
      const deleteRes = await deleteField(testForm1.id, fieldIdToChange);

      if (
        changeRes.ok &&
        changeRes.field.type === "long_text" &&
        deleteRes.ok
      ) {
        console.log("PASS");
      } else {
        console.log("FAIL - change type or delete failed on unlocked form:", {
          changeRes,
          deleteRes,
        });
        allPassed = false;
      }
    } else {
      console.log("FAIL - prerequisite field creation failed");
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 5: publish form directly in DB -> lock rules enforced
    // ------------------------------------------------------------------------
    process.stdout.write("5. published form lock rules (add ok, edit label ok, type/del locked)... ");
    const publishedAtDate = new Date();
    await db
      .update(forms)
      .set({
        status: "published",
        publishedAt: publishedAtDate,
      })
      .where(eq(forms.id, testForm1.id));

    // A. addField works on published form
    const addOnPublished = await addField(testForm1.id, {
      label: "New Question After Publish",
      type: "short_text",
    });

    // Pick an existing dropdown field from step 2
    const currentFields = await listFields(testForm1.id);
    const dropdownField = currentFields.find((f) => f.type === "dropdown");

    if (!dropdownField) {
      throw new Error("Missing dropdown field for step 5");
    }

    // B. updateField can change label, required, placeholder, and APPEND an option
    const updateOk = await updateField(testForm1.id, dropdownField.id, {
      label: "Updated Dropdown Label",
      type: dropdownField.type,
      required: true,
      placeholder: null,
      options: [...dropdownField.options, "Option C"],
    });

    // C. updateField changing type -> LOCKED
    const failTypeChange = await updateField(testForm1.id, dropdownField.id, {
      label: dropdownField.label,
      type: "radio", // Changed from dropdown
      options: ["Option A", "Option B"],
    });

    // D. updateField removing or renaming an existing option -> LOCKED
    const failOptionRename = await updateField(testForm1.id, dropdownField.id, {
      label: dropdownField.label,
      type: dropdownField.type,
      options: ["Renamed Option A", "Option B", "Option C"],
    });

    const failOptionRemove = await updateField(testForm1.id, dropdownField.id, {
      label: dropdownField.label,
      type: dropdownField.type,
      options: ["Option A"], // removed Option B and C
    });

    // E. deleteField -> LOCKED
    const failDelete = await deleteField(testForm1.id, dropdownField.id);

    const step5Ok =
      addOnPublished.ok &&
      updateOk.ok &&
      updateOk.field.label === "Updated Dropdown Label" &&
      updateOk.field.options.length === 3 &&
      !failTypeChange.ok &&
      failTypeChange.code === "LOCKED" &&
      !failOptionRename.ok &&
      failOptionRename.code === "LOCKED" &&
      !failOptionRemove.ok &&
      failOptionRemove.code === "LOCKED" &&
      !failDelete.ok &&
      failDelete.code === "LOCKED";

    if (step5Ok) {
      console.log("PASS");
    } else {
      console.log("FAIL - lock rules failed:", {
        addOnPublished: addOnPublished.ok,
        updateOk: updateOk.ok,
        failTypeChangeCode: !failTypeChange.ok ? failTypeChange.code : "unexpected ok",
        failOptionRenameCode: !failOptionRename.ok ? failOptionRename.code : "unexpected ok",
        failOptionRemoveCode: !failOptionRemove.ok ? failOptionRemove.code : "unexpected ok",
        failDeleteCode: !failDelete.ok ? failDelete.code : "unexpected ok",
      });
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 6: set form back to 'draft' but KEEP publishedAt: still locked
    // ------------------------------------------------------------------------
    process.stdout.write("6. draft status with publishedAt still locked... ");
    await db
      .update(forms)
      .set({ status: "draft" })
      .where(eq(forms.id, testForm1.id));

    const failDeleteDraftEverPublished = await deleteField(
      testForm1.id,
      dropdownField.id
    );

    if (
      !failDeleteDraftEverPublished.ok &&
      failDeleteDraftEverPublished.code === "LOCKED"
    ) {
      console.log("PASS");
    } else {
      console.log(
        "FAIL - expected LOCKED for draft with publishedAt set, got:",
        failDeleteDraftEverPublished
      );
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 7: updateField with a field id belonging to ANOTHER form -> FIELD_NOT_FOUND
    // ------------------------------------------------------------------------
    process.stdout.write("7. cross-form field update returns FIELD_NOT_FOUND... ");
    const otherForm = await createForm({ title: "Other Form" });
    createdFormIds.push(otherForm.id);

    const crossUpdate = await updateField(otherForm.id, dropdownField.id, {
      label: "Cross update",
      type: dropdownField.type,
      options: dropdownField.options,
    });

    if (!crossUpdate.ok && crossUpdate.code === "FIELD_NOT_FOUND") {
      console.log("PASS");
    } else {
      console.log("FAIL - cross update returned:", crossUpdate);
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 8: 51st field -> LIMIT_REACHED
    // ------------------------------------------------------------------------
    process.stdout.write("8. 50 fields limit (51st field -> LIMIT_REACHED)... ");
    const form50 = await createForm({ title: "50 Fields Form" });
    createdFormIds.push(form50.id);

    // Fast batch insert 50 fields directly
    const fieldsToInsert = Array.from({ length: 50 }, (_, i) => ({
      formId: form50.id,
      key: `field_${i + 1}`,
      label: `Field ${i + 1}`,
      type: "short_text" as const,
      position: i,
    }));
    await db.insert(fields).values(fieldsToInsert);

    // Attempting to add 51st field via addField
    const res51 = await addField(form50.id, {
      label: "51st Field",
      type: "short_text",
    });

    if (!res51.ok && res51.code === "LIMIT_REACHED") {
      console.log("PASS");
    } else {
      console.log("FAIL - 51st field returned:", res51);
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Step 9: key never changes when the label is renamed
    // ------------------------------------------------------------------------
    process.stdout.write("9. field key never changes on label rename... ");
    const testFormForRename = await createForm({ title: "Rename Form" });
    createdFormIds.push(testFormForRename.id);

    const initialField = await addField(testFormForRename.id, {
      label: "Initial Question",
      type: "short_text",
    });

    if (initialField.ok) {
      const originalKey = initialField.field.key;
      const renamedField = await updateField(
        testFormForRename.id,
        initialField.field.id,
        {
          label: "Completely Different Question Title",
          type: "short_text",
        }
      );

      if (renamedField.ok && renamedField.field.key === originalKey) {
        console.log("PASS");
      } else {
        console.log("FAIL - key changed or rename failed:", {
          originalKey,
          renamedKey: renamedField.ok ? renamedField.field.key : null,
        });
        allPassed = false;
      }
    } else {
      console.log("FAIL - initial field creation failed");
      allPassed = false;
    }
  } catch (error) {
    console.error("\nUnexpected error during fields verification:", error);
    allPassed = false;
  } finally {
    // Teardown any remaining forms
    for (const id of createdFormIds) {
      try {
        await deleteForm(id);
      } catch (cleanupErr) {
        console.error("Cleanup error for form", id, cleanupErr);
      }
    }
  }

  if (allPassed) {
    console.log("\nAll field-keys and fields-data verification tests passed!");
    process.exit(0);
  } else {
    console.error("\nField verification tests failed.");
    process.exit(1);
  }
}

runFieldsVerification();
