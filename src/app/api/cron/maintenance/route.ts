import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { runMaintenance } from "@/lib/maintenance";

export const maxDuration = 60;

function verifyCronAuth(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  if (!authHeader) return false;

  const expected = `Bearer ${secret}`;
  const actual = authHeader.trim();

  const bufActual = Buffer.from(actual);
  const bufExpected = Buffer.from(expected);

  if (bufActual.length !== bufExpected.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufActual, bufExpected);
}

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: "Maintenance is not configured." },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!verifyCronAuth(authHeader)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized." },
      {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  const result = await runMaintenance();

  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
