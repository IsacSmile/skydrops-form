import {
  createSessionToken,
  verifySessionToken,
  base64UrlToBuffer,
  bufferToBase64Url,
} from "../src/lib/session";

async function runAuthVerification() {
  const testSecret = "test-session-secret-at-least-32-characters-long-key!";
  let allPassed = true;

  console.log("Running session token verification checks...\n");

  // Test 1: Valid token verifies
  try {
    process.stdout.write("1. Valid token verifies... ");
    const token = await createSessionToken(testSecret, 3600);
    const isValid = await verifySessionToken(token, testSecret);
    if (isValid) {
      console.log("PASS");
    } else {
      console.log("FAIL - valid token returned false");
      allPassed = false;
    }
  } catch (err) {
    console.log("FAIL - error:", err);
    allPassed = false;
  }

  // Test 2: Tampered payload fails
  try {
    process.stdout.write("2. Tampered payload fails... ");
    const token = await createSessionToken(testSecret, 3600);
    const [payloadB64, sigB64] = token.split(".");

    // Tamper with the payload (e.g. modify exp)
    const payloadBytes = base64UrlToBuffer(payloadB64);
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    payload.exp += 9999;
    const tamperedPayloadB64 = bufferToBase64Url(
      new TextEncoder().encode(JSON.stringify(payload))
    );
    const tamperedToken = `${tamperedPayloadB64}.${sigB64}`;

    const isValid = await verifySessionToken(tamperedToken, testSecret);
    if (!isValid) {
      console.log("PASS");
    } else {
      console.log("FAIL - tampered payload verified as valid");
      allPassed = false;
    }
  } catch (err) {
    console.log("FAIL - error:", err);
    allPassed = false;
  }

  // Test 3: Tampered signature fails
  try {
    process.stdout.write("3. Tampered signature fails... ");
    const token = await createSessionToken(testSecret, 3600);
    const [payloadB64, sigB64] = token.split(".");

    // Flip the last character of the signature
    const lastChar = sigB64.slice(-1);
    const newLastChar = lastChar === "a" ? "b" : "a";
    const tamperedSig = sigB64.slice(0, -1) + newLastChar;
    const tamperedToken = `${payloadB64}.${tamperedSig}`;

    const isValid = await verifySessionToken(tamperedToken, testSecret);
    if (!isValid) {
      console.log("PASS");
    } else {
      console.log("FAIL - tampered signature verified as valid");
      allPassed = false;
    }
  } catch (err) {
    console.log("FAIL - error:", err);
    allPassed = false;
  }

  // Test 4: Expired token fails
  try {
    process.stdout.write("4. Expired token fails... ");
    // Create token that expired 10 seconds ago
    const expiredToken = await createSessionToken(testSecret, -10);
    const isValid = await verifySessionToken(expiredToken, testSecret);
    if (!isValid) {
      console.log("PASS");
    } else {
      console.log("FAIL - expired token verified as valid");
      allPassed = false;
    }
  } catch (err) {
    console.log("FAIL - error:", err);
    allPassed = false;
  }

  // Test 5: Garbage / empty string fails
  try {
    process.stdout.write("5. Garbage / empty string fails... ");
    const cases = [
      "",
      "   ",
      "not-a-token",
      "only-one-part",
      "three.parts.token",
      ".empty-payload",
      "empty-sig.",
      "invalid-base64-payload.invalid-sig",
    ];

    let garbagePassed = true;
    for (const testCase of cases) {
      const isValid = await verifySessionToken(testCase, testSecret);
      if (isValid) {
        garbagePassed = false;
        break;
      }
    }

    if (garbagePassed) {
      console.log("PASS");
    } else {
      console.log("FAIL - garbage input accepted as valid");
      allPassed = false;
    }
  } catch (err) {
    console.log("FAIL - error:", err);
    allPassed = false;
  }

  if (allPassed) {
    console.log("\nAll auth verification tests passed!");
    process.exit(0);
  } else {
    console.error("\nAuth verification tests failed.");
    process.exit(1);
  }
}

runAuthVerification();
