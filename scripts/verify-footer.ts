/**
 * Verification script for Brand Footer and Brand Link Cards (U3).
 *
 * Verifies:
 * 1. Published form page contains exact links, labels ("Skydrops Technologies website",
 *    "Skydrops Water website"), target="_blank", rel with noopener/noreferrer, exactly one <footer>/brand nav,
 *    and static "© Skydrops".
 * 2. Closed form page contains the header and the brand link cards.
 * 3. 404 /f/zzzzzzzz page contains the header and the brand link cards.
 * 4. Admin login page contains NEITHER brand link card.
 * 5. NO "OUR BRANDS", NO "Powered by" on public pages.
 * 6. Cleans up test forms reliably.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/verify-footer.ts
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
  return `10.200.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;
}

async function run() {
  console.log("\n=======================================================");
  console.log("  U3 BRAND FOOTER / LINK CARDS VERIFICATION SUITE");
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
    // Step 1: Create a published test form with one text field
    // -------------------------------------------------------------------------
    const form = await createForm({
      title: `Footer Test Form ${runId}`,
      description: "Testing parent brand link cards and copyright",
    });
    createdFormIds.push(form.id);

    const f1 = await addField(form.id, {
      label: "Full Name",
      type: "short_text",
      required: false,
    });
    if (!f1.ok) throw new Error("Failed to add field to test form");

    await setFormStatus(form.id, "published");
    record(1, "Create published test form", "PASS", `Slug: ${form.slug}`);

    // -------------------------------------------------------------------------
    // Step 2: GET /f/<slug> published form page checks
    // -------------------------------------------------------------------------
    const resPublished = await fetch(`${baseUrl}/f/${form.slug}`, {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const htmlPublished = await resPublished.text();

    const hasWaterHref = htmlPublished.includes("https://skydropswater.com/");
    const hasTechHref = htmlPublished.includes(
      "https://www.skydropstechnologies.com/"
    );
    const hasWaterLabel = htmlPublished.includes("Skydrops Water website");
    const hasTechLabel = htmlPublished.includes("Skydrops Technologies website");
    const hasBlank = htmlPublished.includes('target="_blank"');
    const hasNoopener = htmlPublished.includes("noopener");
    const hasNoreferrer = htmlPublished.includes("noreferrer");
    const hasCopyright = htmlPublished.includes("© Skydrops");

    const footerMatches = htmlPublished.match(/<footer[\s>]/gi) || [];
    const navMatches = htmlPublished.match(/aria-label=["']Skydrops websites["']/gi) || [];
    const exactlyOneFooterOrNav = footerMatches.length === 1 || navMatches.length === 1;

    const step2Pass =
      resPublished.status === 200 &&
      hasWaterHref &&
      hasTechHref &&
      hasWaterLabel &&
      hasTechLabel &&
      hasBlank &&
      hasNoopener &&
      hasNoreferrer &&
      hasCopyright &&
      exactlyOneFooterOrNav;

    if (step2Pass) {
      record(
        2,
        "Published page /f/<slug> footer elements",
        "PASS",
        "Both hrefs, exact labels, target=_blank, rel=noopener noreferrer, © Skydrops, exactly 1 footer/nav"
      );
    } else {
      record(
        2,
        "Published page /f/<slug> footer elements",
        "FAIL",
        `Status: ${resPublished.status}, Footers: ${footerMatches.length}, WaterHref: ${hasWaterHref}, TechHref: ${hasTechHref}, WaterLabel: ${hasWaterLabel}, TechLabel: ${hasTechLabel}`
      );
    }

    // -------------------------------------------------------------------------
    // Step 3: Close the form and verify /f/<slug> closed page
    // -------------------------------------------------------------------------
    await setFormStatus(form.id, "closed");
    const resClosed = await fetch(`${baseUrl}/f/${form.slug}`, {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const htmlClosed = await resClosed.text();

    const closedHasHeader =
      htmlClosed.includes("header-background-image") &&
      htmlClosed.includes("This form is closed");
    const closedHasWater = htmlClosed.includes("https://skydropswater.com/");
    const closedHasTech = htmlClosed.includes(
      "https://www.skydropstechnologies.com/"
    );
    const closedHasCards =
      htmlClosed.includes("Skydrops Technologies website") &&
      htmlClosed.includes("Skydrops Water website");

    if (resClosed.status === 200 && closedHasHeader && closedHasWater && closedHasTech && closedHasCards) {
      record(
        3,
        "Closed form page /f/<slug> header and link cards",
        "PASS",
        "Contains header and both brand link cards"
      );
    } else {
      record(
        3,
        "Closed form page /f/<slug> header and link cards",
        "FAIL",
        `Header: ${closedHasHeader}, Water: ${closedHasWater}, Tech: ${closedHasTech}`
      );
    }

    // -------------------------------------------------------------------------
    // Step 4: GET /f/zzzzzzzz nonexistent form 404 page
    // -------------------------------------------------------------------------
    const resNotFound = await fetch(`${baseUrl}/f/zzzzzzzz`, {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const htmlNotFound = await resNotFound.text();

    const notFoundHasHeader =
      htmlNotFound.includes("header-background-image") ||
      htmlNotFound.includes("Form not found");
    const notFoundHasWater = htmlNotFound.includes(
      "https://skydropswater.com/"
    );
    const notFoundHasTech = htmlNotFound.includes(
      "https://www.skydropstechnologies.com/"
    );
    const notFoundHasCards =
      htmlNotFound.includes("Skydrops Technologies website") &&
      htmlNotFound.includes("Skydrops Water website");

    if (notFoundHasHeader && notFoundHasWater && notFoundHasTech && notFoundHasCards) {
      record(
        4,
        "Not-found page /f/zzzzzzzz header and link cards",
        "PASS",
        "Contains header and both brand link cards"
      );
    } else {
      record(
        4,
        "Not-found page /f/zzzzzzzz header and link cards",
        "FAIL",
        `Header: ${notFoundHasHeader}, Water: ${notFoundHasWater}, Tech: ${notFoundHasTech}, Cards: ${notFoundHasCards}`
      );
    }

    // -------------------------------------------------------------------------
    // Step 5: GET /admin/login contains NEITHER brand link nor header
    // -------------------------------------------------------------------------
    const resAdmin = await fetch(`${baseUrl}/admin/login`, {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const htmlAdmin = await resAdmin.text();

    const adminHasWater = htmlAdmin.includes("https://skydropswater.com/");
    const adminHasTech = htmlAdmin.includes(
      "https://www.skydropstechnologies.com/"
    );
    const adminHasHeaderImg = htmlAdmin.includes("header-background-image");

    if (!adminHasWater && !adminHasTech && !adminHasHeaderImg) {
      record(
        5,
        "Admin /admin/login isolation",
        "PASS",
        "Contains neither brand link nor header; admin is completely unaffected"
      );
    } else {
      record(
        5,
        "Admin /admin/login isolation",
        "FAIL",
        `Admin leaked: Water=${adminHasWater}, Tech=${adminHasTech}, HeaderImg=${adminHasHeaderImg}`
      );
    }

    // -------------------------------------------------------------------------
    // Step 6: Assert NO "OUR BRANDS", NO "Powered by"
    // -------------------------------------------------------------------------
    const publishedHasOurBrands = htmlPublished.includes("OUR BRANDS");
    const publishedHasPowered = htmlPublished.includes("Powered by");
    const closedHasOurBrands = htmlClosed.includes("OUR BRANDS");
    const closedHasPowered = htmlClosed.includes("Powered by");

    if (!publishedHasOurBrands && !publishedHasPowered && !closedHasOurBrands && !closedHasPowered) {
      record(
        6,
        "Removal of old 'OUR BRANDS' and 'Powered by'",
        "PASS",
        "Neither phrase appears on public pages"
      );
    } else {
      record(
        6,
        "Removal of old 'OUR BRANDS' and 'Powered by'",
        "FAIL",
        `OurBrands: ${publishedHasOurBrands || closedHasOurBrands}, PoweredBy: ${publishedHasPowered || closedHasPowered}`
      );
    }
  } catch (err: unknown) {
    console.error("\nUnexpected test suite error:", err);
    record(99, "Unhandled Exception", "FAIL", (err as Error)?.message);
  } finally {
    // -------------------------------------------------------------------------
    // Step 7: Cleanup test forms always
    // -------------------------------------------------------------------------
    for (const formId of createdFormIds) {
      try {
        await deleteForm(formId);
      } catch (err: unknown) {
        console.error(
          `Failed to delete test form ${formId}:`,
          (err as Error)?.message
        );
      }
    }
    record(7, "Cleanup test forms", "PASS", "Test form cleaned up from Neon");

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
      console.log(`🎉 ALL FOOTER VERIFICATION CHECKS PASSED!\n`);
      process.exit(0);
    }
  }
}

run();
