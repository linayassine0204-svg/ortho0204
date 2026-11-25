// Lancé par `pnpm db:seed` (prisma db seed). Données FICTIVES uniquement.
import { config } from "dotenv";
import { createPrismaClient } from "../src/index.ts";
import { seed } from "../src/seed/seed.ts";

config({ path: "../../.env", quiet: true });

if (process.env.NODE_ENV === "production") {
  throw new Error("Le seed de données fictives est interdit en production.");
}

const motDePasse = process.env.SEED_PASSWORD;
if (!motDePasse) {
  throw new Error("SEED_PASSWORD est manquante (voir .env.example).");
}

const prisma = createPrismaClient();
try {
  await seed(prisma, { motDePasse });
  process.stdout.write("Données fictives créées.\n");
} finally {
  await prisma.$disconnect();
}
