import { describe, expect, it } from "vitest";
import { auth } from "../src/lib/auth";

describe("session config", () => {
  it("does not serve sessions from a signed cookie cache", () => {
    // A cache would keep a banned or demoted user's old role alive for its whole lifetime.
    expect(auth.options.session?.cookieCache?.enabled ?? false).toBe(false);
  });
});
