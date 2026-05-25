import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["__tests__/**/*.test.ts"],
    exclude: ["node_modules", "dist", "__tests__/fixtures/**"],
    reporters: process.env.CI
      ? ["default", ["json", { outputFile: "../../reports/ts-api.json" }]]
      : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "../../reports/ts-api-cov",
      include: [
        "verifier-storage.ts",
        "verifier-metrics.ts",
        "saved-domains.ts",
        "feedback.ts",
        "llm-renderer.ts",
        "llm-domain-interpreter.ts",
        "llm-verifier.ts",
        "visualizer.ts",
        "verifier.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
