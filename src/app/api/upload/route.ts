import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import { getPublicFormBySlug } from "@/lib/forms-data";
import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_BYTES,
  buildUploadPrefix,
} from "@/lib/upload-policy";
import { getClientIp } from "@/lib/client-ip";
import { hitRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/rate-limit-config";

const clientPayloadSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
  fieldKey: z.string().min(1, "Field key is required").max(60, "Field key is too long"),
});

class UploadAuthorizationError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "UploadAuthorizationError";
    this.status = status;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { ok: false, message: "File upload is not available right now." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const clientIp = getClientIp(request.headers);
  const rateLimitResult = await hitRateLimit({
    scope: "upload",
    identifier: clientIp,
    limit: RATE_LIMIT_CONFIG.upload.limit,
    windowSeconds: RATE_LIMIT_CONFIG.upload.windowSeconds,
    failMode: RATE_LIMIT_CONFIG.upload.failMode,
  });

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: "Too many attempts. Please wait a few minutes and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Malformed JSON payload." },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // 1. Parse clientPayload with zod
        if (!clientPayload) {
          throw new UploadAuthorizationError("Missing upload client payload.", 400);
        }

        let rawJson: unknown;
        try {
          rawJson = JSON.parse(clientPayload);
        } catch {
          throw new UploadAuthorizationError("Malformed client payload.", 400);
        }

        const parsed = clientPayloadSchema.safeParse(rawJson);
        if (!parsed.success) {
          throw new UploadAuthorizationError("Invalid upload parameters.", 400);
        }

        const { slug, fieldKey } = parsed.data;

        // 2. Load the form with getPublicFormBySlug(slug); reject unless status is 'published'
        const publicForm = await getPublicFormBySlug(slug);
        if (!publicForm || publicForm.form.status !== "published") {
          throw new UploadAuthorizationError(
            "Form is not available for uploads.",
            404
          );
        }

        // 3. Require a field with that key and type 'file' on that form
        const targetField = publicForm.fields.find(
          (f) => f.key === fieldKey && f.type === "file"
        );
        if (!targetField) {
          throw new UploadAuthorizationError(
            "Field is not a valid file upload field.",
            400
          );
        }

        // 4. Require pathname to start with buildUploadPrefix(form.id, fieldKey) and contain no ".."
        const expectedPrefix = buildUploadPrefix(publicForm.form.id, fieldKey);
        if (!pathname.startsWith(expectedPrefix) || pathname.includes("..")) {
          throw new UploadAuthorizationError("Invalid upload destination.", 400);
        }

        // 5. Return generation options
        return {
          allowedContentTypes: Object.keys(ALLOWED_FILE_TYPES),
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60 * 1000, // 10 minutes
          tokenPayload: JSON.stringify({
            formId: publicForm.form.id,
            fieldKey,
          }),
        };
      },
    });

    return NextResponse.json(jsonResponse, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err: unknown) {
    if (err instanceof UploadAuthorizationError) {
      return NextResponse.json(
        { ok: false, message: err.message },
        {
          status: err.status,
          headers: { "Cache-Control": "no-store" },
        }
      );
    }

    // For any unhandled error from handleUpload or internal, return safe generic message
    return NextResponse.json(
      { ok: false, message: "Upload authorization failed. Please try again." },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
