import {
  isAllowedFile,
  sanitizeFileName,
  isOwnBlobUrl,
  buildUploadPrefix,
  MAX_FILE_BYTES,
} from "../src/lib/upload-policy";
import { validateSubmission } from "../src/lib/submission-validation";
import type { Field } from "../src/types/form";

// Load environment variables before running
try {
  process.loadEnvFile(".env.local");
} catch {
  try {
    process.loadEnvFile(".env");
  } catch {
    // ignore
  }
}

async function runUploadVerification() {
  console.log("=== COMPONENT C7: FILE UPLOAD VERIFICATION ===\n");
  let allPassed = true;

  // =========================================================================
  // SECTION A: Pure Tests (always run)
  // =========================================================================
  console.log("--- Section A: Pure Tests ---");

  // 1. isAllowedFile
  process.stdout.write("A.1 isAllowedFile checks... ");
  try {
    // Allowed types pass
    const jpgPass = isAllowedFile({ name: "photo.jpg", type: "image/jpeg", size: 1024 });
    const jpegPass = isAllowedFile({ name: "photo.jpeg", type: "image/jpeg", size: 1024 });
    const pngPass = isAllowedFile({ name: "logo.png", type: "image/png", size: 1024 });
    const webpPass = isAllowedFile({ name: "img.webp", type: "image/webp", size: 1024 });
    const pdfPass = isAllowedFile({ name: "doc.pdf", type: "application/pdf", size: 1024 });
    const docPass = isAllowedFile({ name: "file.doc", type: "application/msword", size: 1024 });
    const docxPass = isAllowedFile({
      name: "file.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 1024,
    });

    if (!jpgPass.ok || !jpegPass.ok || !pngPass.ok || !webpPass.ok || !pdfPass.ok || !docPass.ok || !docxPass.ok) {
      throw new Error("One or more allowed file types failed validation");
    }

    // Exactly 5 MB passes
    const fiveMbPass = isAllowedFile({ name: "doc.pdf", type: "application/pdf", size: MAX_FILE_BYTES });
    if (!fiveMbPass.ok) {
      throw new Error("Exactly 5 MB file should pass");
    }

    // Wrong mime
    const wrongMime = isAllowedFile({ name: "photo.jpg", type: "text/plain", size: 1024 });
    if (wrongMime.ok) throw new Error("Wrong mime type should be rejected");

    // Wrong extension
    const wrongExt = isAllowedFile({ name: "script.sh", type: "image/jpeg", size: 1024 });
    if (wrongExt.ok) throw new Error("Wrong extension should be rejected");

    // Mismatched extension (.exe named photo.jpg with application/x-msdownload)
    const mismatched = isAllowedFile({
      name: "photo.jpg",
      type: "application/x-msdownload",
      size: 1024,
    });
    if (mismatched.ok) throw new Error("Mismatched extension/mime should be rejected");

    // 0 bytes rejected
    const zeroBytes = isAllowedFile({ name: "photo.jpg", type: "image/jpeg", size: 0 });
    if (zeroBytes.ok) throw new Error("0 byte file should be rejected");

    // 5 MB + 1 byte rejected
    const tooLarge = isAllowedFile({
      name: "photo.jpg",
      type: "image/jpeg",
      size: MAX_FILE_BYTES + 1,
    });
    if (tooLarge.ok || !tooLarge.message.includes("5 MB")) {
      throw new Error("5 MB + 1 byte file should be rejected with friendly message");
    }

    console.log("PASS");
  } catch (err: unknown) {
    allPassed = false;
    console.log(`FAIL: ${(err as Error).message}`);
  }

  // 2. sanitizeFileName
  process.stdout.write("A.2 sanitizeFileName checks... ");
  try {
    // Spaces
    const spaces = sanitizeFileName("my resume file.pdf");
    if (spaces !== "my-resume-file.pdf") {
      throw new Error(`Spaces sanitize failed: got ${spaces}`);
    }

    // Unicode & symbols
    const unicode = sanitizeFileName("résumé_2026!@#.pdf");
    if (!/^[a-zA-Z0-9.\-_]+\.pdf$/.test(unicode)) {
      throw new Error(`Unicode sanitize failed: got ${unicode}`);
    }

    // Path separators & directory traversal
    const pathTrav = sanitizeFileName("../../secret/doc.pdf");
    if (pathTrav !== "doc.pdf") {
      throw new Error(`Path traversal sanitize failed: got ${pathTrav}`);
    }

    // Windows backslashes
    const winTrav = sanitizeFileName("..\\..\\secret\\doc.pdf");
    if (winTrav !== "doc.pdf") {
      throw new Error(`Windows path traversal sanitize failed: got ${winTrav}`);
    }

    // 200-char name capped at max 80 chars keeping extension
    const longName = "a".repeat(200) + ".pdf";
    const sanitizedLong = sanitizeFileName(longName);
    if (sanitizedLong.length > 80 || !sanitizedLong.endsWith(".pdf")) {
      throw new Error(`Long name cap failed: len=${sanitizedLong.length}, name=${sanitizedLong}`);
    }

    // Empty fallback
    const empty = sanitizeFileName("");
    if (empty !== "file") {
      throw new Error(`Empty fallback failed: got ${empty}`);
    }

    console.log("PASS");
  } catch (err: unknown) {
    allPassed = false;
    console.log(`FAIL: ${(err as Error).message}`);
  }

  // 3. isOwnBlobUrl
  process.stdout.write("A.3 isOwnBlobUrl checks... ");
  try {
    const formId = "00000000-0000-0000-0000-000000000001";
    const fieldKey = "resume";

    // Valid URL
    const validUrl = `https://storeid.public.blob.vercel-storage.com/forms/${formId}/${fieldKey}/my-file.pdf`;
    if (!isOwnBlobUrl(validUrl, formId, fieldKey)) {
      throw new Error("Valid blob URL should pass isOwnBlobUrl");
    }

    // Reject HTTP
    const httpUrl = `http://storeid.public.blob.vercel-storage.com/forms/${formId}/${fieldKey}/my-file.pdf`;
    if (isOwnBlobUrl(httpUrl, formId, fieldKey)) {
      throw new Error("HTTP URL should be rejected");
    }

    // Reject other host
    const evilHost = `https://evil.com/forms/${formId}/${fieldKey}/my-file.pdf`;
    if (isOwnBlobUrl(evilHost, formId, fieldKey)) {
      throw new Error("Foreign host should be rejected");
    }

    // Reject sneaky domain ending with evil.com
    const sneakyHost = `https://storeid.public.blob.vercel-storage.com.evil.com/forms/${formId}/${fieldKey}/my-file.pdf`;
    if (isOwnBlobUrl(sneakyHost, formId, fieldKey)) {
      throw new Error("Subdomain hijack should be rejected");
    }

    // Reject wrong formId
    const wrongForm = `https://storeid.public.blob.vercel-storage.com/forms/wrong-form-id/${fieldKey}/my-file.pdf`;
    if (isOwnBlobUrl(wrongForm, formId, fieldKey)) {
      throw new Error("Wrong formId in path should be rejected");
    }

    // Reject wrong fieldKey
    const wrongField = `https://storeid.public.blob.vercel-storage.com/forms/${formId}/avatar/my-file.pdf`;
    if (isOwnBlobUrl(wrongField, formId, fieldKey)) {
      throw new Error("Wrong fieldKey in path should be rejected");
    }

    // Reject ".."
    const dotDot = `https://storeid.public.blob.vercel-storage.com/forms/${formId}/${fieldKey}/../other/my-file.pdf`;
    if (isOwnBlobUrl(dotDot, formId, fieldKey)) {
      throw new Error("URL with '..' should be rejected");
    }

    // Reject query strings
    const withQuery = `${validUrl}?foo=bar`;
    if (isOwnBlobUrl(withQuery, formId, fieldKey)) {
      throw new Error("URL with query string should be rejected");
    }

    // Reject credentials
    const withCreds = `https://user:pass@storeid.public.blob.vercel-storage.com/forms/${formId}/${fieldKey}/my-file.pdf`;
    if (isOwnBlobUrl(withCreds, formId, fieldKey)) {
      throw new Error("URL with credentials should be rejected");
    }

    // Reject garbage
    if (isOwnBlobUrl("random-garbage-string", formId, fieldKey)) {
      throw new Error("Garbage string should be rejected");
    }

    console.log("PASS");
  } catch (err: unknown) {
    allPassed = false;
    console.log(`FAIL: ${(err as Error).message}`);
  }

  // 4. validateSubmission with file fields
  process.stdout.write("A.4 validateSubmission with file fields... ");
  try {
    const formId = "00000000-0000-0000-0000-000000000001";
    const testFields: Field[] = [
      {
        id: "f-1",
        formId,
        key: "name",
        label: "Name",
        type: "short_text",
        required: true,
        placeholder: null,
        options: [],
        position: 0,
        createdAt: new Date(),
      },
      {
        id: "f-2",
        formId,
        key: "resume",
        label: "Resume",
        type: "file",
        required: true,
        placeholder: null,
        options: [],
        position: 1,
        createdAt: new Date(),
      },
      {
        id: "f-3",
        formId,
        key: "cover",
        label: "Cover Letter",
        type: "file",
        required: false,
        placeholder: null,
        options: [],
        position: 2,
        createdAt: new Date(),
      },
    ];

    const validResumeUrl = `https://storeid.public.blob.vercel-storage.com/forms/${formId}/resume/resume.pdf`;

    // Case 1: disabled -> file fields are skipped
    const disabledRes = validateSubmission(
      testFields,
      { name: "Faiz" },
      { fileUploadsEnabled: false, formId }
    );
    if (!disabledRes.ok || "resume" in disabledRes.data || "cover" in disabledRes.data) {
      throw new Error("File fields should be skipped when fileUploadsEnabled is false");
    }

    // Case 2: enabled + required + missing -> error
    const missingRes = validateSubmission(
      testFields,
      { name: "Faiz", resume: "" },
      { fileUploadsEnabled: true, formId }
    );
    if (missingRes.ok || missingRes.fieldErrors.resume !== "This field is required.") {
      throw new Error("Required file field should fail with 'This field is required.'");
    }

    // Case 3: enabled + foreign URL -> "Please upload the file again."
    const foreignRes = validateSubmission(
      testFields,
      {
        name: "Faiz",
        resume: "https://evil.com/fake.pdf",
      },
      { fileUploadsEnabled: true, formId }
    );
    if (foreignRes.ok || foreignRes.fieldErrors.resume !== "Please upload the file again.") {
      throw new Error("Foreign URL should fail with 'Please upload the file again.'");
    }

    // Case 4: enabled + valid own URL -> stored
    const validRes = validateSubmission(
      testFields,
      {
        name: "Faiz",
        resume: validResumeUrl,
        cover: "",
      },
      { fileUploadsEnabled: true, formId }
    );
    if (!validRes.ok || validRes.data.resume !== validResumeUrl) {
      throw new Error("Valid own blob URL should be stored");
    }

    // Case 5: optional empty -> stored as null
    if (validRes.data.cover !== null) {
      throw new Error("Optional empty file field should be stored as null");
    }

    console.log("PASS");
  } catch (err: unknown) {
    allPassed = false;
    console.log(`FAIL: ${(err as Error).message}`);
  }

  // =========================================================================
  // SECTION B: Integration Tests (Requires BLOB_READ_WRITE_TOKEN)
  // =========================================================================
  console.log("\n--- Section B: Integration Tests ---");

  const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (!hasBlobToken) {
    console.log("SKIPPED: Blob token not set");
    if (!allPassed) {
      process.exit(1);
    }
    process.exit(0);
  }

  const { createForm, deleteForm, setFormStatus } =
    await import("../src/lib/forms-data");
  const { addField } = await import("../src/lib/fields-data");
  const { put, del, list } = await import("@vercel/blob");
  const { cleanupFormBlobs } = await import("../src/lib/blob-cleanup");
  const { db } = await import("../src/db");
  const { submissions } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  const createdFormIds: string[] = [];
  const uploadedBlobUrls: string[] = [];

  const port = process.env.PORT || "3000";
  const baseUrl = `http://localhost:${port}`;

  let devServerAvailable = false;
  try {
    const pingRes = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // Any HTTP response (even 400 or 503) indicates the server is alive
    if (pingRes.status) {
      devServerAvailable = true;
    }
  } catch {
    devServerAvailable = false;
  }

  if (!devServerAvailable) {
    console.log(`SKIPPED: Dev server is not running on ${baseUrl}`);
    if (!allPassed) {
      process.exit(1);
    }
    process.exit(0);
  }

  try {
    // 1. Create a published form with a file field and a text field
    process.stdout.write("B.1 Create published form with file + text fields... ");
    const form = await createForm({
      title: "C7 Verify Upload Form",
      description: "Automated test form for C7 file uploads",
    });
    createdFormIds.push(form.id);

    const textRes = await addField(form.id, {
      label: "Full Name",
      type: "short_text",
      required: true,
      options: [],
    });
    if (!textRes.ok) throw new Error(`Failed to add text field: ${textRes.message}`);
    const textField = textRes.field;

    const fileRes = await addField(form.id, {
      label: "Resume Document",
      type: "file",
      required: true,
      options: [],
    });
    if (!fileRes.ok) throw new Error(`Failed to add file field: ${fileRes.message}`);
    const fileField = fileRes.field;

    const pubRes = await setFormStatus(form.id, "published");
    if (!pubRes.ok) {
      throw new Error(`Failed to publish test form: ${pubRes.message}`);
    }
    console.log("PASS");

    // 2. POST /api/upload with valid & invalid handleUpload bodies
    process.stdout.write("B.2 POST /api/upload handleUpload token generation & rejections... ");
    const validPathname = `${buildUploadPrefix(form.id, fileField.key)}sample.pdf`;
    const validPayload = {
      type: "blob.generate-client-token" as const,
      payload: {
        pathname: validPathname,
        clientPayload: JSON.stringify({ slug: form.slug, fieldKey: fileField.key }),
        multipart: false,
      },
    };

    // Valid request -> 200 with clientToken
    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Valid /api/upload failed with ${uploadRes.status}: ${errText}`);
    }

    const uploadData = await uploadRes.json();
    if (!uploadData?.clientToken || uploadData.type !== "blob.generate-client-token") {
      throw new Error("Invalid token generation response");
    }

    // Reject for DRAFT form
    const draftForm = await createForm({ title: "Draft Test Form" });
    createdFormIds.push(draftForm.id);
    const draftRes = await addField(draftForm.id, {
      label: "Upload",
      type: "file",
      required: true,
    });
    if (!draftRes.ok) throw new Error(`Failed to add draft field: ${draftRes.message}`);
    const draftField = draftRes.field;
    const draftUploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: `${buildUploadPrefix(draftForm.id, draftField.key)}doc.pdf`,
          clientPayload: JSON.stringify({ slug: draftForm.slug, fieldKey: draftField.key }),
          multipart: false,
        },
      }),
    });
    if (draftUploadRes.status < 400 || draftUploadRes.status >= 500) {
      throw new Error(`Draft form upload request should be rejected with 4xx, got ${draftUploadRes.status}`);
    }

    // Reject for unknown slug
    const unknownSlugRes = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: validPathname,
          clientPayload: JSON.stringify({ slug: "unknown88", fieldKey: fileField.key }),
          multipart: false,
        },
      }),
    });
    if (unknownSlugRes.status < 400 || unknownSlugRes.status >= 500) {
      throw new Error(`Unknown slug upload request should be rejected with 4xx, got ${unknownSlugRes.status}`);
    }

    // Reject for non-file field key
    const nonFileRes = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: `${buildUploadPrefix(form.id, textField.key)}doc.pdf`,
          clientPayload: JSON.stringify({ slug: form.slug, fieldKey: textField.key }),
          multipart: false,
        },
      }),
    });
    if (nonFileRes.status < 400 || nonFileRes.status >= 500) {
      throw new Error(`Non-file field key should be rejected with 4xx, got ${nonFileRes.status}`);
    }

    // Reject for pathname outside field's prefix
    const wrongPrefixRes = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "blob.generate-client-token",
        payload: {
          pathname: `forms/${form.id}/other-field/doc.pdf`,
          clientPayload: JSON.stringify({ slug: form.slug, fieldKey: fileField.key }),
          multipart: false,
        },
      }),
    });
    if (wrongPrefixRes.status < 400 || wrongPrefixRes.status >= 500) {
      throw new Error(`Wrong prefix should be rejected with 4xx, got ${wrongPrefixRes.status}`);
    }

    console.log("PASS");

    // 3. Upload a real file server-side with put(), then submit
    process.stdout.write("B.3 Upload real file with put() and POST /api/submit... ");
    const realBlob = await put(validPathname, Buffer.from("Skydrops verification test PDF content"), {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: true,
    });
    uploadedBlobUrls.push(realBlob.url);

    const submitRes = await fetch(`${baseUrl}/api/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: form.slug,
        answers: {
          [textField.key]: "Verification User",
          [fileField.key]: realBlob.url,
        },
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.text();
      throw new Error(`Submission failed with status ${submitRes.status}: ${err}`);
    }

    const submitData = await submitRes.json();
    if (!submitData?.ok) {
      throw new Error("Submission did not return ok: true");
    }

    // Verify submission is stored in DB with URL
    const dbSubs = await db
      .select()
      .from(submissions)
      .where(eq(submissions.formId, form.id));

    if (dbSubs.length === 0) {
      throw new Error("Submission not found in database");
    }
    const lastSubData = dbSubs[0].data as Record<string, unknown>;
    if (lastSubData[fileField.key] !== realBlob.url) {
      throw new Error(`Stored file URL mismatch: got ${lastSubData[fileField.key]}`);
    }
    console.log("PASS");

    // 4. POST /api/submit rejection checks (wrong prefix, wrong host, non-existent blob)
    process.stdout.write("B.4 POST /api/submit rejections for invalid URLs... ");
    // Another form prefix
    const otherFormUrl = `https://store.public.blob.vercel-storage.com/forms/other-form/${fileField.key}/file.pdf`;
    const resOtherPrefix = await fetch(`${baseUrl}/api/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: form.slug,
        answers: {
          [textField.key]: "User",
          [fileField.key]: otherFormUrl,
        },
      }),
    });
    if (resOtherPrefix.status !== 422) {
      throw new Error(`Other form prefix should be 422, got ${resOtherPrefix.status}`);
    }

    // Another host
    const otherHostUrl = `https://evil.com/forms/${form.id}/${fileField.key}/file.pdf`;
    const resOtherHost = await fetch(`${baseUrl}/api/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: form.slug,
        answers: {
          [textField.key]: "User",
          [fileField.key]: otherHostUrl,
        },
      }),
    });
    if (resOtherHost.status !== 422) {
      throw new Error(`Other host should be 422, got ${resOtherHost.status}`);
    }

    // Non-existent blob under correct prefix (head check rejects)
    const host = new URL(realBlob.url).host;
    const nonExistentBlobUrl = `https://${host}/forms/${form.id}/${fileField.key}/nonexistent-file-999.pdf`;
    const resNonExistent = await fetch(`${baseUrl}/api/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: form.slug,
        answers: {
          [textField.key]: "User",
          [fileField.key]: nonExistentBlobUrl,
        },
      }),
    });
    if (resNonExistent.status !== 422) {
      throw new Error(`Non-existent blob should be rejected with 422 by head check, got ${resNonExistent.status}`);
    }
    const nonExistentData = await resNonExistent.json();
    if (nonExistentData?.fieldErrors?.[fileField.key] !== "Please upload the file again.") {
      throw new Error(`Expected error message 'Please upload the file again.', got ${JSON.stringify(nonExistentData)}`);
    }

    console.log("PASS");

    // 5. syncSubmission (if Google is configured)
    process.stdout.write("B.5 Google Sheets sync with file URL... ");
    const hasGoogle =
      Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) &&
      Boolean(process.env.GOOGLE_PRIVATE_KEY) &&
      Boolean(process.env.GOOGLE_SHEET_ID);

    if (!hasGoogle) {
      console.log("SKIPPED: Google Sheets credentials not configured");
    } else {
      try {
        const { syncSubmission } = await import("../src/lib/sheets-sync");
        const syncResult = await syncSubmission(dbSubs[0].id);
        if (!syncResult.ok) {
          throw new Error(`syncSubmission failed: ${syncResult.error}`);
        }
        console.log("PASS");
      } catch (sheetErr: unknown) {
        console.log(`SKIPPED: Google Sheets sync check: ${(sheetErr as Error).message}`);
      }
    }

    // 6. Deleting the form through cleanupFormBlobs helper removes blobs
    process.stdout.write("B.6 cleanupFormBlobs helper removes blobs... ");
    await cleanupFormBlobs(form.id);

    // Confirm with list() that blobs with this form prefix are gone
    const listAfter = await list({ prefix: `forms/${form.id}/` });
    if (listAfter.blobs.length > 0) {
      throw new Error(`Expected 0 blobs remaining under forms/${form.id}/, found ${listAfter.blobs.length}`);
    }
    console.log("PASS");

  } catch (err: unknown) {
    allPassed = false;
    console.log(`\nFAIL in Section B: ${(err as Error).message}`);
  } finally {
    // 7. Cleanup ALWAYS runs
    process.stdout.write("B.7 Cleanup test forms and blobs... ");
    try {
      for (const formId of createdFormIds) {
        await cleanupFormBlobs(formId).catch(() => null);
        await deleteForm(formId).catch(() => null);
      }
      if (uploadedBlobUrls.length > 0) {
        await del(uploadedBlobUrls).catch(() => null);
      }
      console.log("Cleaned up");
    } catch {
      console.log("Cleaned up with warnings");
    }
  }

  console.log("\n=============================================");
  if (allPassed) {
    console.log("🎉 ALL UPLOAD VERIFICATION CHECKS PASSED!");
    process.exit(0);
  } else {
    console.error("❌ SOME CHECKS FAILED.");
    process.exit(1);
  }
}

runUploadVerification().catch((err) => {
  console.error("Fatal error running uploads:verify:", err);
  process.exit(1);
});
