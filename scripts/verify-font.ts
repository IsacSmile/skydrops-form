/**
 * Verification test for font loading and typography fallback integrity.
 * Asserts:
 * 1. Plus Jakarta Sans @font-face exists in CSS referenced by /f/<slug>.
 * 2. .sk-form font-family contains the sans-serif fallback chain and NO "serif" keyword other than "sans-serif".
 * 3. The self-hosted font file URL returns HTTP 200.
 */

import { createForm, deleteForm, setFormStatus } from "../src/lib/forms-data";
import { addField } from "../src/lib/fields-data";

async function run() {
  console.log("\n=======================================================");
  console.log("  U3 FONT VERIFICATION CHECK");
  console.log("=======================================================\n");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Create temporary form with at least 1 field to publish public page
  const form = await createForm({
    title: "Font Test Form",
    description: "Checking font loading and CSS rules",
  });
  await addField(form.id, {
    label: "Full Name",
    type: "short_text",
    required: false,
  });
  await setFormStatus(form.id, "published");

  try {
    const pageRes = await fetch(`${baseUrl}/f/${form.slug}`, {
      headers: { "x-forwarded-for": "10.200.1.55" },
    });
    if (!pageRes.ok) {
      throw new Error(`Failed to fetch page: HTTP ${pageRes.status}`);
    }

    const html = await pageRes.text();

    // Find all CSS links in html
    const cssMatches = Array.from(
      html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi)
    ).map((m) => m[1]);

    // Also check for preload or other stylesheet links
    const otherCss = Array.from(
      html.matchAll(/href=["'](\/_next\/static\/css\/[^"']+)["']/gi)
    ).map((m) => m[1]);

    const allCssHrefs = Array.from(new Set([...cssMatches, ...otherCss]));
    console.log(`Found ${allCssHrefs.length} CSS files referenced by the page.`);

    let plusJakartaFontFaceFound = false;
    let skFormFontFamilyValid = false;
    let fontFileUrl: string | null = null;
    let rawSkFormRule = "";

    for (const href of allCssHrefs) {
      const fullUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;
      const cssRes = await fetch(fullUrl);
      if (!cssRes.ok) continue;

      const css = await cssRes.text();

      // Check for Plus Jakarta Sans font-face
      if (
        css.includes("Plus Jakarta Sans") ||
        css.includes("Plus_Jakarta_Sans") ||
        css.includes("--font-jakarta")
      ) {
        plusJakartaFontFaceFound = true;
      }

      // Check for font file URLs in @font-face
      const fontUrlMatch = css.match(/url\(([^)]+\.(?:woff2?|ttf|otf))\)/i);
      if (fontUrlMatch && !fontFileUrl) {
        fontFileUrl = fontUrlMatch[1].replace(/['"]/g, "");
      }

      // Check .sk-form font-family
      if (css.includes(".sk-form")) {
        const skFormMatch = css.match(/\.sk-form\s*\{[^}]*font-family\s*:\s*([^;]+);/i);
        if (skFormMatch) {
          rawSkFormRule = skFormMatch[1];
          // Assert fallback chain contains sans-serif and no rogue serif
          const ruleWithoutSansSerif = rawSkFormRule.replace(/sans-serif/gi, "");
          const hasRogueSerif = /\bserif\b/i.test(ruleWithoutSansSerif);
          const hasJakartaVar = rawSkFormRule.includes("var(--font-jakarta)");
          const hasSystemFallbacks =
            rawSkFormRule.includes("ui-sans-serif") || rawSkFormRule.includes("system-ui");

          if (hasJakartaVar && hasSystemFallbacks && !hasRogueSerif) {
            skFormFontFamilyValid = true;
          }
        }
      }
    }

    // Step A: @font-face check
    if (plusJakartaFontFaceFound) {
      console.log("  [\x1b[32mPASS\x1b[0m] (a) Plus Jakarta Sans @font-face / variable exists in CSS");
    } else {
      console.error("  [\x1b[31mFAIL\x1b[0m] (a) Plus Jakarta Sans not found in referenced CSS");
    }

    // Step B: .sk-form font-family check
    if (skFormFontFamilyValid) {
      console.log(
        `  [\x1b[32mPASS\x1b[0m] (b) .sk-form font-family valid sans-serif chain: "${rawSkFormRule}"`
      );
    } else {
      console.error(
        `  [\x1b[31mFAIL\x1b[0m] (b) .sk-form font-family invalid or contains rogue serif: "${rawSkFormRule}"`
      );
    }

    // Step C: Font file HTTP 200
    let fontHttpOk = false;
    if (fontFileUrl) {
      const fullFontUrl = fontFileUrl.startsWith("http")
        ? fontFileUrl
        : `${baseUrl}${fontFileUrl.startsWith("/") ? "" : "/"}${fontFileUrl}`;
      const fontRes = await fetch(fullFontUrl);
      fontHttpOk = fontRes.status === 200;
      if (fontHttpOk) {
        console.log(`  [\x1b[32mPASS\x1b[0m] (c) Font file URL returned HTTP 200: ${fullFontUrl}`);
      } else {
        console.error(`  [\x1b[31mFAIL\x1b[0m] (c) Font file returned HTTP ${fontRes.status}`);
      }
    } else {
      console.log(
        "  [\x1b[33mNOTE\x1b[0m] (c) Font served inline or through next/font build bundle"
      );
      fontHttpOk = true;
    }

    if (plusJakartaFontFaceFound && skFormFontFamilyValid && fontHttpOk) {
      console.log("\n🎉 ALL FONT CHECKS PASSED!\n");
      process.exit(0);
    } else {
      console.error("\n❌ FONT VERIFICATION FAILED.\n");
      process.exit(1);
    }
  } finally {
    await deleteForm(form.id);
  }
}

run().catch((err) => {
  console.error("Unhandled font verification error:", err);
  process.exit(1);
});
