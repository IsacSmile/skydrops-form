import { z } from "zod";

/**
 * Server-only environment variable validation.
 * NEVER import this file into client components.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ADMIN_PASSWORD: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_SHEET_ID: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = Object.entries(result.error.flatten().fieldErrors)
      .map(([key, messages]) => `${key}: ${messages?.join(", ")}`)
      .join("; ");
    throw new Error(`Environment validation failed: ${issues}`);
  }
  return result.data;
}

export const env: Env = validateEnv();
