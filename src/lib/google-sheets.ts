import crypto from "crypto";

export interface GoogleConfig {
  email: string;
  privateKey: string;
  sheetId: string;
}

export class SheetsNotConfiguredError extends Error {
  readonly missingVars: string[];

  constructor(missingVars: string[]) {
    super(`Google Sheets is not configured: missing ${missingVars.join(", ")}`);
    this.name = "SheetsNotConfiguredError";
    this.missingVars = missingVars;
  }
}

export class SheetsApiError extends Error {
  readonly status: number;
  readonly safeMessage: string;

  constructor(status: number, safeMessage: string) {
    super(safeMessage);
    this.name = "SheetsApiError";
    this.status = status;
    this.safeMessage = safeMessage;
  }
}

/**
 * Reads Google Sheets configuration from process.env.
 * Normalizes the private key (strips wrapping quotes and replaces literal \n with newlines).
 * Throws SheetsNotConfiguredError with the missing variable names if any are missing.
 */
export function readGoogleConfig(): GoogleConfig {
  const missing: string[] = [];

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!email) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");

  let privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim();
  if (!privateKey) missing.push("GOOGLE_PRIVATE_KEY");

  const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
  if (!sheetId) missing.push("GOOGLE_SHEET_ID");

  if (missing.length > 0 || !email || !privateKey || !sheetId) {
    throw new SheetsNotConfiguredError(missing);
  }

  // Normalize private key: strip wrapping quotes if present
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }
  // Convert literal "\n" sequences into real newlines
  privateKey = privateKey.replace(/\\n/g, "\n").trim();

  return { email, privateKey, sheetId };
}

interface CachedToken {
  token: string;
  expiresAt: number; // Unix timestamp in ms
}

let cachedToken: CachedToken | null = null;
let inFlightTokenPromise: Promise<string> | null = null;

function base64UrlEncode(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return buf.toString("base64url");
}

function createSignedJwt(email: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaims = base64UrlEncode(JSON.stringify(claims));
  const message = `${encodedHeader}.${encodedClaims}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(message);
  signer.end();
  const signature = signer.sign(privateKey, "base64url");

  return `${message}.${signature}`;
}

/**
 * Retrieves a valid Google OAuth2 access token for the service account.
 * Caches token in memory and refreshes 5 minutes before expiry.
 * Concurrent refreshes are de-duplicated using a shared in-flight promise.
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  // Refresh 5 minutes before expiry
  if (cachedToken && cachedToken.expiresAt - now > 5 * 60 * 1000) {
    return cachedToken.token;
  }

  if (inFlightTokenPromise) {
    return inFlightTokenPromise;
  }

  inFlightTokenPromise = (async () => {
    try {
      const config = readGoogleConfig();
      const jwt = createSignedJwt(config.email, config.privateKey);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      let res: Response;
      try {
        res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
          }),
          signal: controller.signal,
        });
      } catch {
        clearTimeout(timeoutId);
        throw new SheetsApiError(0, "Google Sheets request failed");
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        const status = res.status;
        let safeMessage = "Google Sheets request failed";
        if (status === 403) {
          safeMessage = "Google Sheets denied access: check that the sheet is shared with the service account";
        } else if (status === 404) {
          safeMessage = "Spreadsheet not found";
        } else if (status === 429) {
          safeMessage = "Google rate limit reached";
        }
        throw new SheetsApiError(status, safeMessage);
      }

      const data = (await res.json()) as { access_token: string; expires_in: number };
      const expiresInSec = typeof data.expires_in === "number" ? data.expires_in : 3600;

      cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + expiresInSec * 1000,
      };

      return data.access_token;
    } finally {
      inFlightTokenPromise = null;
    }
  })();

  return inFlightTokenPromise;
}

/**
 * Internal HTTP request helper for Google Sheets API.
 * Uses 10s timeout, handles JSON parsing, and maps errors to SheetsApiError with safe messages.
 */
async function sheetsRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof SheetsApiError) throw err;
    throw new SheetsApiError(0, "Google Sheets request failed");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    let safeMessage = "Google Sheets request failed";
    if (res.status === 403) {
      safeMessage = "Google Sheets denied access: check that the sheet is shared with the service account";
    } else if (res.status === 404) {
      safeMessage = "Spreadsheet not found";
    } else if (res.status === 429) {
      safeMessage = "Google rate limit reached";
    }
    throw new SheetsApiError(res.status, safeMessage);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

/**
 * Escapes single quotes in tab titles for A1 notation:
 * 'Tab''s Name'!A1
 */
export function formatA1Range(tabTitle: string, cellRange?: string): string {
  const escaped = tabTitle.replace(/'/g, "''");
  return cellRange ? `'${escaped}'!${cellRange}` : `'${escaped}'`;
}

/**
 * Returns all tabs in the spreadsheet with their numeric sheetId (gid) and title.
 */
export async function getSpreadsheetTabs(): Promise<Array<{ gid: number; title: string }>> {
  const config = readGoogleConfig();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.sheetId)}?fields=sheets.properties`;

  interface SheetsResponse {
    sheets?: Array<{
      properties?: {
        sheetId?: number;
        title?: string;
      };
    }>;
  }

  const data = await sheetsRequest<SheetsResponse>(url, { method: "GET" });
  return (data.sheets || []).map((s) => ({
    gid: s.properties?.sheetId ?? 0,
    title: s.properties?.title ?? "",
  }));
}

/**
 * Adds a new tab to the spreadsheet.
 * Returns the newly created tab's gid and title.
 */
export async function addTab(title: string): Promise<{ gid: number; title: string }> {
  const config = readGoogleConfig();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.sheetId)}:batchUpdate`;

  interface AddSheetResponse {
    replies?: Array<{
      addSheet?: {
        properties?: {
          sheetId?: number;
          title?: string;
        };
      };
    }>;
  }

  const res = await sheetsRequest<AddSheetResponse>(url, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title,
            },
          },
        },
      ],
    }),
  });

  const props = res.replies?.[0]?.addSheet?.properties;
  return {
    gid: props?.sheetId ?? 0,
    title: props?.title ?? title,
  };
}

/**
 * Deletes a tab from the spreadsheet by numeric sheetId (gid).
 */
export async function deleteTab(gid: number): Promise<void> {
  const config = readGoogleConfig();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.sheetId)}:batchUpdate`;

  await sheetsRequest(url, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteSheet: {
            sheetId: gid,
          },
        },
      ],
    }),
  });
}

/**
 * Reads values from an A1 range.
 * Returns a 2D array of values.
 */
export async function getValues(rangeA1: string): Promise<unknown[][]> {
  const config = readGoogleConfig();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    config.sheetId
  )}/values/${encodeURIComponent(rangeA1)}`;

  interface ValuesResponse {
    values?: unknown[][];
  }

  const data = await sheetsRequest<ValuesResponse>(url, { method: "GET" });
  return data.values ?? [];
}

/**
 * Updates values in an A1 range using valueInputOption=RAW.
 */
export async function updateValues(rangeA1: string, values: unknown[][]): Promise<void> {
  const config = readGoogleConfig();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    config.sheetId
  )}/values/${encodeURIComponent(rangeA1)}?valueInputOption=RAW`;

  await sheetsRequest(url, {
    method: "PUT",
    body: JSON.stringify({
      values,
    }),
  });
}

/**
 * Appends a row of values to a tab using valueInputOption=RAW and insertDataOption=INSERT_ROWS.
 */
export async function appendRow(tabTitle: string, values: unknown[]): Promise<void> {
  const config = readGoogleConfig();
  const range = formatA1Range(tabTitle, "A1");
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    config.sheetId
  )}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  await sheetsRequest(url, {
    method: "POST",
    body: JSON.stringify({
      values: [values],
    }),
  });
}

/**
 * Best-effort helper to freeze row 1 and apply bold formatting to row 1.
 */
export async function freezeAndFormatHeader(gid: number): Promise<void> {
  const config = readGoogleConfig();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.sheetId)}:batchUpdate`;

  await sheetsRequest(url, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: gid,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: gid,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                textFormat: {
                  bold: true,
                },
              },
            },
            fields: "userEnteredFormat.textFormat.bold",
          },
        },
      ],
    }),
  });
}
