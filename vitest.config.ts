import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // server-only throws outside the React server runtime; tests exercise server code directly
      "server-only": path.resolve(__dirname, "tests/helpers/empty.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], fileParallelism: false, testTimeout: 30000 },
});
