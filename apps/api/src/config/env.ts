import { z } from "zod";

const DEFAULT_SEED_PASSWORD = "ChangeMe123!";
const PLACEHOLDER_SECRET_PREFIX = "change-me";

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    WEB_ORIGIN: z.url().default("http://localhost:3000"),
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 chars"),
    DATABASE_URL: z.string().default("file:./data/app.db"),
    PDF_RETENTION_DAYS: z.coerce.number().int().min(1).default(1),
    PDF_RETENTION_MAX_DAYS: z.coerce.number().int().min(1).default(30),
    PUBLISH_DRY_RUN: z.enum(["on", "off"]).default("on"),
    STORAGE_DIR: z.string().default("./data/storage"),
    ASSET_MAX_MB: z.coerce.number().positive().default(10),
    UPLOAD_MAX_MB: z.coerce.number().positive().default(25),
    UPLOAD_TTL_MINUTES: z.coerce.number().int().min(1).default(60),
    UPLOAD_PROJECT_QUOTA_MB: z.coerce.number().positive().default(1024),
    RENDER_CONCURRENCY: z.coerce.number().int().min(1).default(4),
    // Queued + processing jobs one project may have at once; more is refused with 429.
    PROJECT_MAX_PENDING: z.coerce.number().int().min(1).default(100),
    // Editor previews one user may have running or waiting at once.
    PREVIEW_MAX_PER_USER: z.coerce.number().int().min(1).default(2),
    // An Idempotency-Key replays its original document for this long, then it can be reused.
    IDEMPOTENCY_TTL_HOURS: z.coerce.number().int().min(1).default(24),
    // Largest accepted tRPC request body (editor saves and previews carry source + sample data).
    TRPC_BODY_LIMIT_MB: z.coerce.number().int().min(1).default(12),
    // Invalid /v1 API keys one IP may send per minute before it gets 429.
    API_AUTH_MAX_FAILURES: z.coerce.number().int().min(1).default(20),
    // A job is abandoned (render_error) once it was claimed this many times without finishing.
    JOB_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(3),
    // `processing` jobs older than this and not running in this process are recovered.
    JOB_STALE_MINUTES: z.coerce.number().int().min(2).default(30),
    SYNC_WAIT_MS: z.coerce.number().int().min(0).max(60000).default(25000),
    TYPST_BIN: z.string().default("typst"),
    FONTS_DIR: z.string().default("./fonts"),
    RENDER_MEMORY_BUDGET_MB: z.coerce.number().int().min(256).default(2560),
    // Sign-in throttle: failures per email (and per IP, x4) inside the window lock further attempts.
    LOGIN_MAX_FAILURES: z.coerce.number().int().min(1).default(5),
    LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).default(15),
    // Audit rows older than this are deleted (swept hourly).
    AUDIT_RETENTION_DAYS: z.coerce.number().int().min(1).default(90),
    // Webhook delivery log rows older than this are deleted.
    WEBHOOK_LOG_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
    WEBHOOK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
    // Total attempts per delivery (1 + retries at 1 min, 5 min, 30 min, 2 h, 6 h).
    WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(6).default(6),
    // Dev only: allow webhook URLs that resolve to private/loopback addresses (SSRF guard off).
    WEBHOOK_ALLOW_PRIVATE: z.enum(["on", "off"]).default("off"),
    SEED_SUPERADMIN_NAME: z.string().default("Super Admin"),
    SEED_SUPERADMIN_EMAIL: z.email().default("superadmin@example.com"),
    SEED_SUPERADMIN_PASSWORD: z.string().min(8).default(DEFAULT_SEED_PASSWORD),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV !== "production") return;
    const fail = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (e.SEED_SUPERADMIN_PASSWORD === DEFAULT_SEED_PASSWORD) {
      fail("SEED_SUPERADMIN_PASSWORD", "must be changed from the default in production");
    }
    if (e.BETTER_AUTH_SECRET.startsWith(PLACEHOLDER_SECRET_PREFIX)) {
      fail("BETTER_AUTH_SECRET", "is still the .env.example placeholder");
    }
    for (const key of ["WEB_ORIGIN", "BETTER_AUTH_URL"] as const) {
      if (/\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(e[key])) {
        fail(key, "must be the public origin in production, not localhost");
      }
    }
    if (e.PUBLISH_DRY_RUN === "off") fail("PUBLISH_DRY_RUN", "must be on in production");
  });

export const env = envSchema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
