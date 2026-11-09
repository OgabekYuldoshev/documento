import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const TITLES: Record<number, string> = {
  400: "Bad request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not found",
  409: "Conflict",
  410: "Gone",
  413: "Payload too large",
  422: "Validation failed",
  429: "Too many requests",
  500: "Render failed",
  503: "Service unavailable",
  504: "Render timeout",
};

/** RFC 9457 `application/problem+json` response. */
export function problem(
  c: Context,
  status: ContentfulStatusCode,
  type: string,
  detail?: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return c.body(
    JSON.stringify({ type, title: TITLES[status] ?? "Error", status, detail, ...extra }),
    status,
    { "Content-Type": "application/problem+json", ...headers },
  );
}
