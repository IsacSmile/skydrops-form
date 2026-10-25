/**
 * Builds a public short link URL given a form slug and an optional base origin.
 * Handles trailing slashes on origin.
 * Example: buildShortLink("a1b2c3d4", "https://example.com/") -> "https://example.com/f/a1b2c3d4"
 */
export function buildShortLink(slug: string, origin?: string): string {
  if (!origin) {
    return `/f/${slug}`;
  }

  const cleanOrigin = origin.trim().replace(/\/+$/, "");
  return `${cleanOrigin}/f/${slug}`;
}

/**
 * Server helper to determine the application origin.
 * Precedence:
 * 1. NEXT_PUBLIC_APP_URL env var (validated http/https, stripped trailing slash)
 * 2. Request headers (x-forwarded-proto + x-forwarded-host or host)
 * 3. Fallback: http://localhost:3000
 */
export async function getAppOrigin(): Promise<string> {
  // 1. Check NEXT_PUBLIC_APP_URL
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    } catch {
      // invalid URL in env, fallback to request headers
    }
  }

  // 2. Request headers (dynamic import to allow safe import in non-request contexts)
  try {
    const { headers } = await import("next/headers");
    const headerList = await headers();
    const proto =
      headerList.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "production" ? "https" : "http");
    const host =
      headerList.get("x-forwarded-host") || headerList.get("host");

    if (host) {
      const originCandidate = `${proto}://${host}`;
      const parsed = new URL(originCandidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    }
  } catch {
    // Outside request scope or during static generation
  }

  // 3. Fallback
  return "http://localhost:3000";
}

/**
 * Builds a direct link to a Google Sheet tab:
 * https://docs.google.com/spreadsheets/d/{sheetId}/edit#gid={gid}
 * Returns null if either sheetId or gid is missing or empty.
 */
export function getSheetUrl(
  sheetId?: string | null,
  gid?: number | string | null
): string | null {
  if (!sheetId || sheetId.trim().length === 0) {
    return null;
  }
  if (gid === undefined || gid === null || String(gid).trim().length === 0) {
    return null;
  }

  const cleanSheetId = sheetId.trim();
  const cleanGid = String(gid).trim();

  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(cleanSheetId)}/edit#gid=${encodeURIComponent(cleanGid)}`;
}

