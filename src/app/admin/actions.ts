"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/auth";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
} from "@/lib/session";

export interface LoginState {
  error?: string;
}

export async function login(
  prevState: LoginState | undefined,
  formData: FormData
): Promise<LoginState> {
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
