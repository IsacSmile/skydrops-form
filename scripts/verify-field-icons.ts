/**
 * Verification test suite for getFieldIconName
 */
import { getFieldIconName } from "../src/lib/field-icons";

interface TestCase {
  label: string;
  type: string;
  expected: string | null;
}

const testCases: TestCase[] = [
  { label: "Full Name", type: "short_text", expected: "user" },
  { label: "Company / Organization", type: "short_text", expected: "building" },
  { label: "Company Name", type: "short_text", expected: "building" },
  { label: "Job Title", type: "short_text", expected: "briefcase" },
  { label: "Position", type: "short_text", expected: "briefcase" },
  { label: "Email Address", type: "email", expected: "mail" },
  { label: "Phone", type: "phone", expected: "phone" },
  { label: "Age", type: "number", expected: "hash" },
  { label: "Country", type: "short_text", expected: "map-pin" },
  { label: "Website", type: "short_text", expected: "globe" },
  { label: "Area of Interest", type: "dropdown", expected: "bar-chart" },
  { label: "Comments", type: "long_text", expected: null },
  { label: "DOB", type: "date", expected: null },
  { label: "Pick one", type: "radio", expected: null },
  { label: "Your best click", type: "file", expected: null },
  { label: "Favourite colour", type: "short_text", expected: null },
];

console.log("\n=======================================================");
console.log("  VERIFY FIELD ICONS SUITE");
console.log("=======================================================\n");

let failures = 0;

for (let i = 0; i < testCases.length; i++) {
  const { label, type, expected } = testCases[i];
  const actual = getFieldIconName({ label, type });

  if (actual === expected) {
    console.log(`  [\x1b[32mPASS\x1b[0m] ${i + 1}. "${label}" (${type}) => ${actual ?? "null"}`);
  } else {
    failures++;
    console.error(
      `  [\x1b[31mFAIL\x1b[0m] ${i + 1}. "${label}" (${type}) => expected ${expected}, got ${actual}`
    );
  }
}

console.log("\n-------------------------------------------------------");
if (failures === 0) {
  console.log(`🎉 ALL ${testCases.length} FIELD ICON CHECKS PASSED!\n`);
  process.exit(0);
} else {
  console.error(`❌ ${failures} CHECKS FAILED.\n`);
  process.exit(1);
}
