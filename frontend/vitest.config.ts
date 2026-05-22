import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", "tests/e2e/**"],
    reporters: process.env.CI
      ? ["default", ["json", { outputFile: "../reports/frontend.json" }]]
      : ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "../reports/frontend-cov",
      include: ["src/components/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"],
      exclude: ["src/components/ui/**", "**/*.test.{ts,tsx}"],
    },
  },
});
