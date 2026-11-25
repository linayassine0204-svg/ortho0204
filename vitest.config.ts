import { defineConfig } from "vitest/config";

// Tests du monorepo (les tests de bout en bout sont dans apps/web/e2e).
// - unitaires : rapides, sans base de données ;
// - base-de-donnees : sur une base de TEST dédiée, recréée vide à chaque lancement
//   (nécessite `pnpm db:up`).
export default defineConfig({
  resolve: {
    alias: {
      "@/": new URL("./apps/web/", import.meta.url).pathname,
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unitaires",
          include: ["{apps,packages}/*/{src,lib,app}/**/*.test.{ts,tsx}"],
          exclude: ["**/node_modules/**", "**/.next/**", "**/*.int.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "base-de-donnees",
          include: ["packages/db/test/**/*.int.test.ts"],
          globalSetup: ["packages/db/test/global-setup.ts"],
          environment: "node",
          // Une seule base de test partagée : les fichiers passent l'un après l'autre.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
