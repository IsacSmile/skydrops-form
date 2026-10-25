/**
 * Edge-compatible session token creation and verification using Web Crypto API (crypto.subtle).
 * NEVER import Node-only modules (like 'crypto' or 'fs') here.
 */

export const SESSION_COOKIE_NAME = "sk_admin";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export interface SessionPayload {
  exp: number; // Unix timestamp in seconds
}

export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlToBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export function getValidatedSessionSecret(customSecret?: string): string {
  const secret = customSecret || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET environment variable is missing. Please set it in .env.local."
    );
  }
  if (secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be at least 32 characters long. Generate one with `openssl rand -base64 32`."
    );
  }
  return secret;
}

export async function createSessionToken(
  secret?: string,
  maxAgeSeconds = SESSION_MAX_AGE
): Promise<string> {
  const secretToUse = getValidatedSessionSecret(secret);
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payloadStr = JSON.stringify({ exp });
  const payloadEncoded = bufferToBase64Url(
    new TextEncoder().encode(payloadStr)
  );

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretToUse),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadEncoded)
  );

  const signatureEncoded = bufferToBase64Url(signature);
  return `${payloadEncoded}.${signatureEncoded}`;
}

export async function verifySessionToken(
  token: string,
  secret?: string
): Promise<boolean> {
  if (!token || typeof token !== "string") {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return false;
  }

  const [payloadEncoded, signatureEncoded] = parts;

  let secretToUse: string;
  try {
    secretToUse = getValidatedSessionSecret(secret);
  } catch {
    return false;
  }

  try {
    // 1. Decode payload
    const payloadBytes = base64UrlToBuffer(payloadEncoded);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const payload: unknown = JSON.parse(payloadJson);

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("exp" in payload) ||
      typeof (payload as SessionPayload).exp !== "number"
    ) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > (payload as SessionPayload).exp) {
      return false; // Expired
    }

    // 2. Decode received signature
    const receivedSigBytes = base64UrlToBuffer(signatureEncoded);

    // 3. Compute expected signature
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secretToUse),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const expectedSig = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payloadEncoded)
    );

    const expectedSigBytes = new Uint8Array(expectedSig);
    return constantTimeEqual(receivedSigBytes, expectedSigBytes);
  } catch {
    return false;
  }
}
