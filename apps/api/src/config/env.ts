import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 chars"),
  DATABASE_URL: z.string().default("file:./data/app.db"),
  PDF_RETENTION_DAYS: z.coerce.number().int().min(1).default(1),
  PDF_RETENTION_MAX_DAYS: z.coerce.number().int().min(1).default(30),
  SEED_SUPERADMIN_NAME: z.string().default("Super Admin"),
  SEED_SUPERADMIN_EMAIL: z.email().default("superadmin@example.com"),
  SEED_SUPERADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!"),
});

export const env = envSchema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
