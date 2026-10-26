import crypto from "node:crypto";

const DEV_FALLBACK_SECRET = "skydrops-dev-fallback-secret-at-least-32-chars";

type HeaderSource =
  | Headers
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

/**
 * Extracts client IP from headers with fallback:
 * 1. x-real-ip
 * 2. first entry of x-forwarded-for
 * 3. "unknown"
 * Trims and caps at 64 characters.
 */
export function getClientIp(headers: HeaderSource): string {
  let rawIp: string | null = null;

  if (headers) {
    if (typeof (headers as Headers).get === "function") {
      const h = headers as Headers;
      const realIp = h.get("x-real-ip");
      if (realIp && realIp.trim()) {
        rawIp = realIp.trim();
      } else {
        const forwarded = h.get("x-forwarded-for");
        if (forwarded && forwarded.trim()) {
          rawIp = forwarded.split(",")[0].trim();
        }
      }
    } else {
      const record = headers as Record<string, string | string[] | undefined>;
      const realIp = record["x-real-ip"];
      const realIpVal = Array.isArray(realIp) ? realIp[0] : realIp;
      if (realIpVal && realIpVal.trim()) {
        rawIp = realIpVal.trim();
      } else {
        const forwarded = record["x-forwarded-for"];
        const forwardedVal = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        if (forwardedVal && forwardedVal.trim()) {
          rawIp = forwardedVal.split(",")[0].trim();
        }
      }
    }
  }

  const effectiveIp = rawIp && rawIp.length > 0 ? rawIp : "unknown";
  return effectiveIp.slice(0, 64);
}

/**
 * Computes an HMAC-SHA256 hash of (ip + scope) using SESSION_SECRET.
 * Falls back to a dev secret only when SESSION_SECRET is missing and NODE_ENV !== 'production'.
 * Hex-encoded, so raw IPs are never stored.
 */
export function hashIdentifier(ip: string, scope: string): string {
  const secret = process.env.SESSION_SECRET?.trim();
  let key: string;

  if (secret && secret.length > 0) {
    key = secret;
  } else if (process.env.NODE_ENV !== "production") {
    key = DEV_FALLBACK_SECRET;
  } else {
    throw new Error(
      "SESSION_SECRET is required to hash identifiers in production."
    );
  }

  const hmac = crypto.createHmac("sha256", key);
  hmac.update(`${scope}:${ip}`);
  return hmac.digest("hex");
}
