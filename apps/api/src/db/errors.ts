/** Postgres SQLSTATE codes we branch on. */
const UNIQUE_VIOLATION = "23505";

/** Drizzle wraps driver errors: the pg `DatabaseError` (with `.code`) is the `cause`. */
export function isUniqueViolation(error: unknown): boolean {
  const code =
    (error as { cause?: { code?: string } } | null)?.cause?.code ??
    (error as { code?: string } | null)?.code;
  return code === UNIQUE_VIOLATION;
}
