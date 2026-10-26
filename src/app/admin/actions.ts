"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from "@/lib/session";
import { getClientIp } from "@/lib/client-ip";
import { hitRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_CONFIG } from "@/lib/rate-limit-config";

export interface LoginState {
  error?: string;
}

export async function login(
  prevState: LoginState | undefined,
  formData: FormData
): Promise<LoginState> {
  const headerList = await headers();
  const clientIp = getClientIp(headerList);

  // Rate limiting: 8 attempts per 15 minutes per IP, failMode 'closed'
  // Count EVERY attempt BEFORE checking password
  const rateLimitResult = await hitRateLimit({
    scope: "login",
    identifier: clientIp,
    limit: RATE_LIMIT_CONFIG.login.limit,
    windowSeconds: RATE_LIMIT_CONFIG.login.windowSeconds,
    failMode: RATE_LIMIT_CONFIG.login.failMode,
  });

  if (!rateLimitResult.allowed) {
    const minutes = Math.ceil(rateLimitResult.retryAfterSeconds / 60);
    return {
      error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const password = formData.get("password");

  if (typeof password !== "string" || !password) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "Incorrect password" };
  }

  let isValid = false;
  try {
    isValid = await verifyPassword(password);
  } catch (err) {
    // If ADMIN_PASSWORD is not set, propagate or log
    console.error("Login verification error:", err);
    throw err;
  }

  if (!isValid) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "Incorrect password" };
  }

  // On successful login, clear the rate limit counter for this IP
  await resetRateLimit({ scope: "login", identifier: clientIp });

  const token = await createSessionToken();
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/admin");
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/admin/login");
}
