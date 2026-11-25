import { defineConfig } from "vitest/config";

// Tests unitaires de tout le monorepo (les tests de bout en bout sont dans apps/web/e2e).
export default defineConfig({
  test: {
    include: ["{apps,packages}/*/{src,lib,app}/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "apps/web/e2e/**"],
    environment: "node",
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      "@/": new URL("./apps/web/", import.meta.url).pathname,
    },
  },
});
