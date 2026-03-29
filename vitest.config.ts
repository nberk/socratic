import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["server/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    pool: "forks",
    isolate: false,
    coverage: {
      provider: "v8",
      include: ["server/**/*.ts"],
      exclude: [
        "server/index.ts",
        "server/instrument.ts",
        "server/migrate.ts",
        "server/db/schema.ts",
      ],
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
    },
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
