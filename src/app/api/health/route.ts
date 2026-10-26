import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const { db } = await import("@/db");
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
