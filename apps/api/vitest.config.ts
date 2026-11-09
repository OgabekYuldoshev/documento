import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: ":memory:",
      BETTER_AUTH_SECRET: "x".repeat(32),
      NODE_ENV: "test",
      PUBLISH_DRY_RUN: "off",
    },
    setupFiles: ["test/setup.ts"],
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
  },
});
