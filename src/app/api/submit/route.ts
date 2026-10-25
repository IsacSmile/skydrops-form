import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getPublicFormBySlug } from "@/lib/forms-data";
import { validateSubmission } from "@/lib/submission-validation";
import { createSubmission } from "@/lib/submissions-data";
import { afterSubmissionCreated } from "@/lib/submission-hooks";

const MAX_BODY_BYTES = 100 * 1024; // 100 KB

const submitSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
  answers: z.record(z.string(), z.unknown()),
  website: z.string().optional(),
});

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}

export async function POST(request: Request) {
  // 1. Content-Length check
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return jsonResponse(
      { ok: false, message: "Payload exceeds maximum allowed size of 100 KB." },
      400
    );
  }

  // 2. Read and parse body text safely with byte length check
  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return jsonResponse(
      { ok: false, message: "Failed to read request body." },
      400
    );
  }

  const byteLength = new TextEncoder().encode(bodyText).length;
  if (byteLength > MAX_BODY_BYTES) {
    return jsonResponse(
      { ok: false, message: "Payload exceeds maximum allowed size of 100 KB." },
      400
    );
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(bodyText);
  } catch {
    return jsonResponse(
      { ok: false, message: "Malformed JSON payload." },
      400
    );
  }

  // 3. Schema validation
  const parsed = submitSchema.safeParse(rawJson);
  if (!parsed.success) {
    return jsonResponse(
      {
        ok: false,
        message: parsed.error.issues[0]?.message || "Invalid submission payload.",
      },
      400
    );
  }

  const { slug, answers, website } = parsed.data;

  // 4. Honeypot check: silently accept without storing
  if (typeof website === "string" && website.trim().length > 0) {
    return jsonResponse({ ok: true }, 200);
  }

  // 5. Load public form by slug
  let publicForm;
  try {
    publicForm = await getPublicFormBySlug(slug);
  } catch (err) {
    console.error("Database error retrieving form by slug:", err);
    return jsonResponse(
      { ok: false, message: "Something went wrong. Please try again." },
      500
    );
  }

  if (!publicForm) {
    return jsonResponse({ ok: false, message: "Form not found." }, 404);
  }

  const { form, fields } = publicForm;

  if (form.status === "closed") {
    return jsonResponse({ ok: false, message: "This form is closed." }, 403);
  }

  if (form.status !== "published") {
    return jsonResponse({ ok: false, message: "Form not found." }, 404);
  }

  // 6. Validate submission answers against form's current fields
  const validation = validateSubmission(fields, answers);
  if (!validation.ok) {
    return jsonResponse(
      {
        ok: false,
        fieldErrors: validation.fieldErrors,
        message: "Please check your answers and try again.",
      },
      422
    );
  }

  // 7. Store submission in database with syncStatus 'pending'
  try {
    const submission = await createSubmission(form.id, validation.data);

    // Run the hook via Next's after() so it executes after response is sent
    // and is kept alive on serverless platforms (Vercel)
    after(async () => {
      try {
        await afterSubmissionCreated(submission);
      } catch (hookErr) {
        console.error("afterSubmissionCreated hook error:", hookErr);
      }
    });

    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    console.error("Database error saving submission for form ID:", form.id, err);
    return jsonResponse(
      { ok: false, message: "Something went wrong. Please try again." },
      500
    );
  }
}
