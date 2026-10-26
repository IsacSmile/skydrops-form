import { eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { hashIdentifier } from "./client-ip";

export type FailMode = "open" | "closed";

export type RateLimitDbExecutor =
  | typeof db
  | {
      insert: (table: typeof rateLimits) => {
        values: (values: unknown) => {
          onConflictDoUpdate: (config: unknown) => {
            returning: (fields: unknown) => Promise<unknown[]>;
          };
        };
      };
      delete?: (table: typeof rateLimits) => {
        where: (condition: unknown) => {
          returning: (fields: unknown) => Promise<unknown[]>;
        };
      };
    };

export interface HitRateLimitParams {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
  now?: Date;
  failMode?: FailMode;
  dbExecutor?: RateLimitDbExecutor;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export interface ResetRateLimitParams {
  scope: string;
  identifier: string;
  dbExecutor?: RateLimitDbExecutor;
}

function resolveHashedIdentifier(identifier: string, scope: string): string {
  if (identifier.length === 64 && /^[0-9a-fA-F]{64}$/.test(identifier)) {
    return identifier;
  }
  return hashIdentifier(identifier, scope);
}

/**
 * Atomic fixed-window rate limiter stored in PostgreSQL (Neon).
 * Uses INSERT ... ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1.
 */
export async function hitRateLimit({
  scope,
  identifier,
  limit,
  windowSeconds,
  now,
  failMode = "open",
  dbExecutor = db,
}: HitRateLimitParams): Promise<RateLimitResult> {
  const nowMs = (now ?? new Date()).getTime();
  const nowSeconds = Math.floor(nowMs / 1000);
  const windowStartSeconds =
    Math.floor(nowSeconds / windowSeconds) * windowSeconds;
  const windowStart = new Date(windowStartSeconds * 1000);
  const retryAfterSeconds = Math.max(
    1,
    windowStartSeconds + windowSeconds - nowSeconds
  );

  const hashed = resolveHashedIdentifier(identifier, scope);
  const key = `${scope}:${hashed}`;

  try {
    const rows = (await (dbExecutor as typeof db)
      .insert(rateLimits)
      .values({
        key,
        windowStart,
        count: 1,
      })
      .onConflictDoUpdate({
        target: [rateLimits.key, rateLimits.windowStart],
        set: { count: sql`${rateLimits.count} + 1` },
      })
      .returning({ count: rateLimits.count })) as { count: number }[];

    const count = Number(rows[0]?.count ?? 1);
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return {
      allowed,
      count,
      limit,
      remaining,
      retryAfterSeconds,
    };
  } catch (err: unknown) {
    console.error(
      "Rate limit DB error type:",
      (err as Error)?.name || "RateLimitError"
    );

    if (failMode === "closed") {
      return {
        allowed: false,
        count: limit + 1,
        limit,
        remaining: 0,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      count: 1,
      limit,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds,
    };
  }
}

/**
 * Resets rate limit for a given scope and identifier (e.g. after successful login).
 */
export async function resetRateLimit({
  scope,
  identifier,
  dbExecutor = db,
}: ResetRateLimitParams): Promise<void> {
  const hashed = resolveHashedIdentifier(identifier, scope);
  const key = `${scope}:${hashed}`;
  await (dbExecutor as typeof db)
    .delete(rateLimits)
    .where(eq(rateLimits.key, key));
}

/**
 * Purges rate limit windows older than olderThanSeconds (default 86400 = 24 hours).
 * Returns the number of rows deleted.
 */
export async function purgeOldRateLimits(
  olderThanSeconds = 86400,
  dbExecutor: RateLimitDbExecutor = db
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
  const deleted = (await (dbExecutor as typeof db)
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, cutoff))
    .returning({ key: rateLimits.key })) as { key: string }[];
  return deleted.length;
}
