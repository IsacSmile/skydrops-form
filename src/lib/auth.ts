import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
  constantTimeEqual,
  getValidatedSessionSecret,
} from "./session";

export function getValidatedAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    throw new Error(
      "ADMIN_PASSWORD environment variable is missing. Please set it in .env.local."
    );
  }
  return password;
}

export async function verifyPassword(input: string): Promise<boolean> {
  const actualPassword = getValidatedAdminPassword();
  const enc = new TextEncoder();
  const [inputDigest, actualDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(input)),
    crypto.subtle.digest("SHA-256", enc.encode(actualPassword)),
  ]);

  return constantTimeEqual(
    new Uint8Array(inputDigest),
    new Uint8Array(actualDigest)
  );
}

export async function isAdmin(): Promise<boolean> {
  await connection();
  // Validate SESSION_SECRET lazily if token is present
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return false;
  }
  return verifySessionToken(token);
}

export async function requireAdmin(): Promise<void> {
  await connection();
  const authorized = await isAdmin();
  if (!authorized) {
    redirect("/admin/login");
  }
}

export { getValidatedSessionSecret };
