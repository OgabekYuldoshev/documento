import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      BETTER_AUTH_SECRET: "x".repeat(32),
      NODE_ENV: "test",
      PUBLISH_DRY_RUN: "off",
      STORAGE_DIR: join(tmpdir(), `documento-test-storage-${process.pid}`),
    },
    globalSetup: ["test/global-setup.ts"],
    setupFiles: ["test/setup.ts"],
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
  },
});
