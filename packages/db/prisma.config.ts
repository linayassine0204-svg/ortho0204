import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Le fichier .env (non versionné) est à la racine du monorepo.
config({ path: "../../.env", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.ts",
  },
  datasource: {
    // Lue depuis l'environnement (.env à la racine ou variable de CI), jamais en dur.
    url: process.env.DATABASE_URL ?? "",
  },
});
