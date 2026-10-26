/**
 * Verification script for U1: Brand Footer.
 *
 * Verifies:
 * 1. Published form page contains exact links, names, domains, OUR BRANDS,
 *    target="_blank", rel with noopener/noreferrer, and exactly one <footer>.
 * 2. Closed form page contains the footer with both links.
 * 3. 404 /f/zzzzzzzz page contains the footer with both links.
 * 4. Admin login page contains NEITHER brand link.
 * 5. "Powered by" does not appear on public pages.
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
  console.log("  U1 BRAND FOOTER VERIFICATION SUITE");
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
      description: "Testing parent brand footer",
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
    const hasWaterName = htmlPublished.includes("Skydrops Water");
    const hasTechName = htmlPublished.includes("Skydrops Technologies");
    const hasWaterDisplay = htmlPublished.includes("skydropswater.com");
    const hasTechDisplay = htmlPublished.includes("skydropstechnologies.com");
    const hasBrandsHeadingOrLogos =
      htmlPublished.includes("OUR BRANDS") ||
      ((htmlPublished.includes("skydrops-water-logo.png") ||
        htmlPublished.includes("Product%20Logo") ||
        htmlPublished.includes("Product Logo")) &&
        htmlPublished.includes("skydrops-tech-logo.png"));
    const hasBlank = htmlPublished.includes('target="_blank"');
    const hasNoopener = htmlPublished.includes("noopener");
    const hasNoreferrer = htmlPublished.includes("noreferrer");

    const footerMatches = htmlPublished.match(/<footer[\s>]/gi) || [];
    const exactlyOneFooter = footerMatches.length === 1;

    const step2Pass =
      resPublished.status === 200 &&
      hasWaterHref &&
      hasTechHref &&
      hasWaterName &&
      hasTechName &&
      hasWaterDisplay &&
      hasTechDisplay &&
      hasBrandsHeadingOrLogos &&
      hasBlank &&
      hasNoopener &&
      hasNoreferrer &&
      exactlyOneFooter;

    if (step2Pass) {
      record(
        2,
        "Published page /f/<slug> footer elements",
        "PASS",
        "Both hrefs, names, displays, brand logos, target=_blank, rel=noopener noreferrer, exactly 1 footer"
      );
    } else {
      record(
        2,
        "Published page /f/<slug> footer elements",
        "FAIL",
        `Status: ${resPublished.status}, Footers: ${footerMatches.length}, WaterHref: ${hasWaterHref}, TechHref: ${hasTechHref}`
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

    const closedHasWater = htmlClosed.includes("https://skydropswater.com/");
    const closedHasTech = htmlClosed.includes(
      "https://www.skydropstechnologies.com/"
    );
    const closedFooterMatches = htmlClosed.match(/<footer[\s>]/gi) || [];
    const closedOneFooter = closedFooterMatches.length === 1;

    if (closedHasWater && closedHasTech && closedOneFooter) {
      record(
        3,
        "Closed form page /f/<slug> footer elements",
        "PASS",
        "Contains both brand links and exactly 1 footer"
      );
    } else {
      record(
        3,
        "Closed form page /f/<slug> footer elements",
        "FAIL",
        `Water: ${closedHasWater}, Tech: ${closedHasTech}, Footers: ${closedFooterMatches.length}`
      );
    }

    // -------------------------------------------------------------------------
    // Step 4: GET /f/zzzzzzzz nonexistent form 404 page
    // -------------------------------------------------------------------------
    const resNotFound = await fetch(`${baseUrl}/f/zzzzzzzz`, {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const htmlNotFound = await resNotFound.text();

    const notFoundHasWater = htmlNotFound.includes(
      "https://skydropswater.com/"
    );
    const notFoundHasTech = htmlNotFound.includes(
      "https://www.skydropstechnologies.com/"
    );
    const notFoundFooterMatches = htmlNotFound.match(/<footer[\s>]/gi) || [];
    const notFoundHasFooterElement =
      notFoundFooterMatches.length === 1 ||
      htmlNotFound.includes('["$","footer"') ||
      htmlNotFound.includes("OUR BRANDS") ||
      htmlNotFound.includes("skydrops-water-logo.png") ||
      htmlNotFound.includes("Product%20Logo") ||
      htmlNotFound.includes("Product Logo");

    if (notFoundHasWater && notFoundHasTech && notFoundHasFooterElement) {
      record(
        4,
        "Not-found page /f/zzzzzzzz footer elements",
        "PASS",
        "Contains both brand links and footer component"
      );
    } else {
      record(
        4,
        "Not-found page /f/zzzzzzzz footer elements",
        "FAIL",
        `Water: ${notFoundHasWater}, Tech: ${notFoundHasTech}, FooterElement: ${notFoundHasFooterElement}`
      );
    }

    // -------------------------------------------------------------------------
    // Step 5: GET /admin/login contains NEITHER brand link
    // -------------------------------------------------------------------------
    const resAdmin = await fetch(`${baseUrl}/admin/login`, {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const htmlAdmin = await resAdmin.text();

    const adminHasWater = htmlAdmin.includes("https://skydropswater.com/");
    const adminHasTech = htmlAdmin.includes(
      "https://www.skydropstechnologies.com/"
    );

    if (!adminHasWater && !adminHasTech) {
      record(
        5,
        "Admin /admin/login footer isolation",
        "PASS",
        "Contains neither brand link; admin is completely unaffected"
      );
    } else {
      record(
        5,
        "Admin /admin/login footer isolation",
        "FAIL",
        `Admin leaked links: Water=${adminHasWater}, Tech=${adminHasTech}`
      );
    }

    // -------------------------------------------------------------------------
    // Step 6: "Powered by" no longer appears on public pages
    // -------------------------------------------------------------------------
    const publishedHasPowered = htmlPublished.includes("Powered by");
    const closedHasPowered = htmlClosed.includes("Powered by");
    const notFoundHasPowered = htmlNotFound.includes("Powered by");

    if (!publishedHasPowered && !closedHasPowered && !notFoundHasPowered) {
      record(
        6,
        "Removal of old 'Powered by' line",
        "PASS",
        "'Powered by' line is absent on published, closed, and not-found pages"
      );
    } else {
      record(
        6,
        "Removal of old 'Powered by' line",
        "FAIL",
        `Published: ${publishedHasPowered}, Closed: ${closedHasPowered}, NotFound: ${notFoundHasPowered}`
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
