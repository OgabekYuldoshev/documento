import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { env } from "../src/config/env";

const post = (path: string, bytes: number) =>
  app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": String(bytes) },
    body: "x".repeat(bytes),
  });

describe("request body limits", () => {
  it("rejects an oversized tRPC body with 413 before parsing it", async () => {
    const res = await post(
      "/api/trpc/templates.preview",
      (env.TRPC_BODY_LIMIT_MB + 1) * 1024 * 1024,
    );
    expect(res.status).toBe(413);
  });

  it("rejects an oversized auth body with 413", async () => {
    const res = await post("/api/auth/sign-in/email", 2 * 1024 * 1024);
    expect(res.status).toBe(413);
  });

  it("lets normal bodies through to their handlers", async () => {
    const res = await post("/api/trpc/templates.preview", 100);
    expect(res.status).not.toBe(413);
  });
});
