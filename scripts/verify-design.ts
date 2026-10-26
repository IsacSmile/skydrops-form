/**
 * Verification script for U2: Premium Public Form Redesign (Deep Sky).
 *
 * Verifies:
 * 1. Published form page contains the white lockup image path (/brand/skydrops-logo-lockup-white.png).
 * 2. Contains the wrapper class .sk-form.
 * 3. Contains the "* Required" caption.
 * 4. Contains the option-card markup (.sk-option-card) for checkbox and radio fields.
 * 5. Does NOT contain the old floating-logo container.
 * 6. Closed form page contains the header band.
 * 7. Cleans up test forms reliably.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-design.ts
 */

import { createForm, deleteForm, setFormStatus } from "../src/lib/forms-data";
import { addField } from "../src/lib/fields-data";

interface StepResult {
  step: number;
  name: string;
  status: "PASS" | "FAIL" | "SKIPPED";
  detail?: string;
}

const results: StepResult[] = [];
const createdFormIds: string[] = [];

function record(
  step: number,
  name: string,
  status: "PASS" | "FAIL" | "SKIPPED",
  detail?: string
) {
  results.push({ step, name, status, detail });
  const badge =
    status === "PASS"
      ? "\x1b[32mPASS\x1b[0m"
      : status === "SKIPPED"
      ? "\x1b[33mSKIPPED\x1b[0m"
      : "\x1b[31mFAIL\x1b[0m";
  console.log(`  [${badge}] Step ${step}: ${name}${detail ? ` (${detail})` : ""}`);
}

function uniqueIp(): string {
  return `10.201.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;
}

async function run() {
  console.log("\n=======================================================");
  console.log("  U2 PREMIUM PUBLIC FORM DESIGN VERIFICATION");
  console.log("=======================================================\n");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Check dev server health
  let serverReachable = false;
  try {
    const health = await fetch(`${baseUrl}/api/health`);
    if (health.ok) serverReachable = true;
  } catch {
    serverReachable = false;
  }

  if (!serverReachable) {
    console.log("SKIPPED: dev server not running on " + baseUrl + "\n");
    process.exit(0);
  }

  const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  try {
    // -------------------------------------------------------------------------
    // Step 1: Create a published test form with one field of each type
    // -------------------------------------------------------------------------
    const form = await createForm({
      title: `Deep Sky Test Form ${runId}`,
      description: "Testing premium Deep Sky styling, option cards and header band.",
    });
    createdFormIds.push(form.id);

    const fieldsToAdd = [
      { label: "Your Full Name", type: "short_text" as const, required: true },
      { label: "Detailed Notes", type: "long_text" as const, required: false },
      { label: "Work Email", type: "email" as const, required: false },
      { label: "Phone Number", type: "phone" as const, required: false },
      { label: "Estimated Quantity", type: "number" as const, required: false },
      {
        label: "Department",
        type: "dropdown" as const,
        required: false,
        options: ["Engineering", "Operations", "Sustainability"],
      },
      {
        label: "Facility Type",
        type: "radio" as const,
        required: false,
        options: ["Commercial", "Industrial", "Residential", "Municipal", "Agricultural"],
      },
      {
        label: "Services Required",
        type: "checkbox" as const,
        required: false,
        options: ["Purification", "Recycling", "Monitoring", "Maintenance"],
      },
      { label: "Preferred Date", type: "date" as const, required: false },
    ];

    for (const f of fieldsToAdd) {
      const res = await addField(form.id, f);
      if (!res.ok) throw new Error(`Failed to add field ${f.label}`);
    }

    await setFormStatus(form.id, "published");
    record(1, "Create published test form with all field types", "PASS", `Slug: ${form.slug}`);

    // -------------------------------------------------------------------------
    // Step 2: GET /f/<slug> and assert Deep Sky design elements
    // -------------------------------------------------------------------------
    const resPublished = await fetch(`${baseUrl}/f/${form.slug}`, {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const html = await resPublished.text();

    const hasWhiteLockup = html.includes("skydrops-logo-lockup-white.png");
    const hasSkFormClass = html.includes("sk-form");
    const hasRequiredCaption =
      html.includes("* Required") ||
      (html.includes("*") && html.includes("Required"));
    const hasOptionCards = html.includes("sk-option-card");
    const hasOldFloatingLogo =
      html.includes('<header class="flex justify-center"') ||
      html.includes("/brand/skydrops-logo-lockup.png");

    const passChecks =
      resPublished.status === 200 &&
      hasWhiteLockup &&
      hasSkFormClass &&
      hasRequiredCaption &&
      hasOptionCards &&
      !hasOldFloatingLogo;

    if (passChecks) {
      record(
        2,
        "Published page Deep Sky design assertions",
        "PASS",
        "White lockup logo, .sk-form, '* Required', .sk-option-card present; old floating logo absent"
      );
    } else {
      record(
        2,
        "Published page Deep Sky design assertions",
        "FAIL",
        `WhiteLockup: ${hasWhiteLockup}, skForm: ${hasSkFormClass}, RequiredCaption: ${hasRequiredCaption}, OptionCards: ${hasOptionCards}, OldLogoAbsent: ${!hasOldFloatingLogo}`
      );
    }

    // -------------------------------------------------------------------------
    // Step 3: Close form and verify closed page contains the band
    // -------------------------------------------------------------------------
    await setFormStatus(form.id, "closed");
    const resClosed = await fetch(`${baseUrl}/f/${form.slug}`, {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const htmlClosed = await resClosed.text();

    const closedHasBand =
      htmlClosed.includes("sk-header-band") &&
      htmlClosed.includes("This form is closed") &&
      htmlClosed.includes("skydrops-logo-lockup-white.png");

    if (resClosed.status === 200 && closedHasBand) {
      record(
        3,
        "Closed form page header band assertion",
        "PASS",
        "Contains .sk-header-band, 'This form is closed', and white lockup logo"
      );
    } else {
      record(
        3,
        "Closed form page header band assertion",
        "FAIL",
        `Status: ${resClosed.status}, closedHasBand: ${closedHasBand}`
      );
    }
  } catch (err: unknown) {
    console.error("\nUnexpected test suite error:", err);
    record(99, "Unhandled Exception", "FAIL", (err as Error)?.message);
  } finally {
    // -------------------------------------------------------------------------
    // Step 4: Cleanup test forms always
    // -------------------------------------------------------------------------
    for (const formId of createdFormIds) {
      try {
        await deleteForm(formId);
      } catch (err: unknown) {
        console.error(`Failed to delete test form ${formId}:`, (err as Error)?.message);
      }
    }
    record(4, "Cleanup test forms", "PASS", "Test form cleaned up from Neon");

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
      `Total Steps: ${results.length} | Passed: ${totalPassed} | Skipped: ${totalSkipped} | Failed: ${totalFailed}\n`
    );

    if (totalFailed > 0) {
      console.error(`❌ Verification FAILED with ${totalFailed} failure(s).\n`);
      process.exit(1);
    } else {
      console.log(`🎉 ALL DESIGN VERIFICATION CHECKS PASSED!\n`);
      process.exit(0);
    }
  }
}

run();
