import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "src/test/server-only.ts") },
  },
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["src/**/*.test.ts"], exclude: ["src/**/*.int.test.ts"] } },
      {
        extends: true,
        test: { name: "integration", include: ["src/**/*.int.test.ts"], setupFiles: ["dotenv/config"], testTimeout: 60_000, hookTimeout: 60_000 },
      },
    ],
  },
});
