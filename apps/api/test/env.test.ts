import { describe, expect, it } from "vitest";
import { envSchema } from "../src/config/env";

const secret = "s".repeat(40);
const prod = {
  NODE_ENV: "production",
  BETTER_AUTH_SECRET: secret,
  WEB_ORIGIN: "https://docs.example.org",
  BETTER_AUTH_URL: "https://docs.example.org",
  SEED_SUPERADMIN_PASSWORD: "a-Real-Password-42",
};

const issues = (input: Record<string, string>) => {
  const r = envSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
};

describe("env (production guard)", () => {
  it("accepts a proper production config", () => {
    expect(issues(prod)).toEqual([]);
  });

  it("rejects the default seed password", () => {
    expect(issues({ ...prod, SEED_SUPERADMIN_PASSWORD: "ChangeMe123!" })).toEqual([
      "SEED_SUPERADMIN_PASSWORD",
    ]);
    expect(issues({ ...prod, SEED_SUPERADMIN_PASSWORD: undefined as never })).toEqual([
      "SEED_SUPERADMIN_PASSWORD",
    ]);
  });

  it("rejects the placeholder secret, localhost origins and disabled dry-run", () => {
    expect(issues({ ...prod, BETTER_AUTH_SECRET: `change-me-${secret}` })).toEqual([
      "BETTER_AUTH_SECRET",
    ]);
    expect(issues({ ...prod, WEB_ORIGIN: "http://localhost:3000" })).toEqual(["WEB_ORIGIN"]);
    expect(issues({ ...prod, BETTER_AUTH_URL: "http://127.0.0.1:3001" })).toEqual([
      "BETTER_AUTH_URL",
    ]);
    expect(issues({ ...prod, PUBLISH_DRY_RUN: "off" })).toEqual(["PUBLISH_DRY_RUN"]);
  });

  it("keeps development defaults usable", () => {
    expect(issues({ NODE_ENV: "development", BETTER_AUTH_SECRET: secret })).toEqual([]);
  });
});
