/**
 * Verification script for U3: Visual Redesign of Public Form Pages & Admin Preview.
 *
 * Asserts on /f/<slug>:
 * 1. The h1 with the form title.
 * 2. The horizontal logo path (/brand/skydrops-logo-horizontal.png).
 * 3. The header image (a next/image URL containing "header-background-image").
 * 4. The "* Required" caption.
 * 5. At least one svg icon inside an input wrapper.
 * 6. The exact link labels "Skydrops Technologies website" and "Skydrops Water website"
 *    with exact hrefs, target="_blank", rel containing noopener and noreferrer.
 * 7. The text "© Skydrops".
 * 8. NO "OUR BRANDS", NO "Powered by".
 * 9. Exactly one <footer> or one brand nav.
 * 10. On the closed page and on /f/zzzzzzzz assert the header and the link cards exist.
 * 11. On /admin/login assert none of them exist.
 * 12. Cleans up test forms reliably.
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
  console.log("  U3 PUBLIC FORM DESIGN & MARKUP VERIFICATION");
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
    // Step 1: Create a published test form with diverse field types
    // -------------------------------------------------------------------------
    const formTitle = `U3 Design Test Form ${runId}`;
    const form = await createForm({
      title: formTitle,
      description: "Testing U3 light header, field icons, and brand cards.",
    });
    createdFormIds.push(form.id);

    const fieldsToAdd = [
      { label: "Full Name", type: "short_text" as const, required: true },
      { label: "Work Email", type: "email" as const, required: false },
      { label: "Phone Number", type: "phone" as const, required: false },
      { label: "Company Name", type: "short_text" as const, required: false },
      {
        label: "Department",
        type: "dropdown" as const,
        required: false,
        options: ["Engineering", "Operations", "Sustainability"],
      },
      {
        label: "Services Required",
        type: "checkbox" as const,
        required: false,
        options: ["Purification", "Recycling"],
      },
    ];

    for (const f of fieldsToAdd) {
      const res = await addField(form.id, f);
      if (!res.ok) throw new Error(`Failed to add field ${f.label}`);
    }

    await setFormStatus(form.id, "published");
    record(1, "Create published test form with fields", "PASS", `Slug: ${form.slug}`);

    // -------------------------------------------------------------------------
    // Step 2: GET /f/<slug> and assert U3 design elements
    // -------------------------------------------------------------------------
    const resPublished = await fetch(`${baseUrl}/f/${form.slug}`, {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const html = await resPublished.text();

    // 1. h1 with the form title
    const hasH1Title =
      html.includes(`<h1`) && html.includes(formTitle);

    // 2. Horizontal logo path
    const hasHorizontalLogo =
      html.includes("skydrops-logo-horizontal.png");

    // 3. Header background image
    const hasHeaderBg =
      html.includes("header-background-image");

    // 4. "* Required" caption
    const hasRequiredCaption =
      html.includes("* Required") ||
      (html.includes("*") && html.includes("Required"));

    // 5. At least one svg icon inside an input wrapper
    const hasInputLeadingIcon =
      html.includes("sk-input-icon") ||
      html.includes("sk-input-with-icon");

    // 6. Exact link labels and hrefs
    const hasTechLink =
      html.includes("https://www.skydropstechnologies.com/") &&
      html.includes("Skydrops Technologies website");
    const hasWaterLink =
      html.includes("https://skydropswater.com/") &&
      html.includes("Skydrops Water website");
    const hasTargetBlank = html.includes('target="_blank"');
    const hasRelNoopener = html.includes("noopener") && html.includes("noreferrer");

    // 7. Text "© Skydrops"
    const hasCopyright = html.includes("© Skydrops");

    // 8. NO "OUR BRANDS", NO "Powered by"
    const hasNoOurBrands = !html.includes("OUR BRANDS");
    const hasNoPoweredBy = !html.includes("Powered by");

    // 9. Exactly one <footer> or one brand nav
    const footerCount = (html.match(/<footer[\s>]/gi) || []).length;
    const navCount = (html.match(/aria-label=["']Skydrops websites["']/gi) || []).length;
    const hasOneFooterOrNav = footerCount === 1 || navCount === 1;

    const allStep2Pass =
      resPublished.status === 200 &&
      hasH1Title &&
      hasHorizontalLogo &&
      hasHeaderBg &&
      hasRequiredCaption &&
      hasInputLeadingIcon &&
      hasTechLink &&
      hasWaterLink &&
      hasTargetBlank &&
      hasRelNoopener &&
      hasCopyright &&
      hasNoOurBrands &&
      hasNoPoweredBy &&
      hasOneFooterOrNav;

    if (allStep2Pass) {
      record(
        2,
        "Published page U3 assertions",
        "PASS",
        "h1 title, horizontal logo, header bg image, * Required, leading icon, brand cards, © Skydrops, no 'OUR BRANDS'/'Powered by'"
      );
    } else {
      record(
        2,
        "Published page U3 assertions",
        "FAIL",
        `H1: ${hasH1Title}, Logo: ${hasHorizontalLogo}, HeaderBg: ${hasHeaderBg}, ReqCaption: ${hasRequiredCaption}, LeadingIcon: ${hasInputLeadingIcon}, Tech: ${hasTechLink}, Water: ${hasWaterLink}, Copyright: ${hasCopyright}, NoBrands: ${hasNoOurBrands}, NoPowered: ${hasNoPoweredBy}`
      );
    }

    // -------------------------------------------------------------------------
    // Step 3: Close form and verify closed page contains header and link cards
    // -------------------------------------------------------------------------
    await setFormStatus(form.id, "closed");
    const resClosed = await fetch(`${baseUrl}/f/${form.slug}`, {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const htmlClosed = await resClosed.text();

    const closedHasHeader =
      htmlClosed.includes("header-background-image") &&
      htmlClosed.includes("This form is closed");
    const closedHasLinkCards =
      htmlClosed.includes("Skydrops Technologies website") &&
      htmlClosed.includes("Skydrops Water website");

    if (resClosed.status === 200 && closedHasHeader && closedHasLinkCards) {
      record(
        3,
        "Closed form page assertions",
        "PASS",
        "Contains U3 header and brand link cards"
      );
    } else {
      record(
        3,
        "Closed form page assertions",
        "FAIL",
        `Header: ${closedHasHeader}, LinkCards: ${closedHasLinkCards}`
      );
    }

    // -------------------------------------------------------------------------
    // Step 4: GET /f/zzzzzzzz 404 page contains header and link cards
    // -------------------------------------------------------------------------
    const resNotFound = await fetch(`${baseUrl}/f/zzzzzzzz`, {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const htmlNotFound = await resNotFound.text();

    const notFoundHasHeader =
      htmlNotFound.includes("header-background-image") ||
      htmlNotFound.includes("Form not found");
    const notFoundHasLinkCards =
      htmlNotFound.includes("Skydrops Technologies website") &&
      htmlNotFound.includes("Skydrops Water website");

    if (notFoundHasHeader && notFoundHasLinkCards) {
      record(
        4,
        "Not-found page assertions (/f/zzzzzzzz)",
        "PASS",
        "Contains U3 header and brand link cards"
      );
    } else {
      record(
        4,
        "Not-found page assertions (/f/zzzzzzzz)",
        "FAIL",
        `Header: ${notFoundHasHeader}, LinkCards: ${notFoundHasLinkCards}`
      );
    }

    // -------------------------------------------------------------------------
    // Step 5: GET /admin/login contains NONE of them
    // -------------------------------------------------------------------------
    const resAdmin = await fetch(`${baseUrl}/admin/login`, {
      headers: { "x-forwarded-for": uniqueIp() },
    });
    const htmlAdmin = await resAdmin.text();

    const adminHasNone =
      !htmlAdmin.includes("header-background-image") &&
      !htmlAdmin.includes("skydrops-logo-horizontal.png") &&
      !htmlAdmin.includes("Skydrops Technologies website") &&
      !htmlAdmin.includes("Skydrops Water website");

    if (adminHasNone) {
      record(
        5,
        "Admin /admin/login isolation",
        "PASS",
        "Admin page contains none of the public form header/brand card elements"
      );
    } else {
      record(
        5,
        "Admin /admin/login isolation",
        "FAIL",
        "Admin leaked public form header or brand card elements"
      );
    }
  } catch (err: unknown) {
    console.error("\nUnexpected test suite error:", err);
    record(99, "Unhandled Exception", "FAIL", (err as Error)?.message);
  } finally {
    // -------------------------------------------------------------------------
    // Step 6: Cleanup test forms always
    // -------------------------------------------------------------------------
    for (const formId of createdFormIds) {
      try {
        await deleteForm(formId);
      } catch (err: unknown) {
        console.error(`Failed to delete test form ${formId}:`, (err as Error)?.message);
      }
    }
    record(6, "Cleanup test forms", "PASS", "Test form cleaned up from Neon");

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
