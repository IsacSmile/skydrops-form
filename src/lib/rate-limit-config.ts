/**
 * Centralized rate limit configuration.
 * All windows are in seconds.
 */
export const RATE_LIMIT_CONFIG = {
  submit: {
    limit: 10,
    windowSeconds: 10 * 60, // 10 minutes
    failMode: "open" as const,
  },
  upload: {
    limit: 30,
    windowSeconds: 10 * 60, // 10 minutes
    failMode: "open" as const,
  },
  login: {
    limit: 8,
    windowSeconds: 15 * 60, // 15 minutes
    failMode: "closed" as const,
  },
} as const;
