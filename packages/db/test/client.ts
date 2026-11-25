import { inject } from "vitest";
import { createPrismaClient } from "../src/index.ts";

/** Client Prisma connecté à la base de test préparée par global-setup.ts. */
export function clientDeTest() {
  return createPrismaClient({ DATABASE_URL: inject("testDatabaseUrl") });
}

export const AUJOURDHUI_TEST = new Date("2026-11-25T00:00:00Z");
export const MOT_DE_PASSE_TEST = "motdepasse-de-test-fictif";

/** Âge en années révolues à une date donnée. */
export function age(naissance: Date, a: Date): number {
  let ans = a.getUTCFullYear() - naissance.getUTCFullYear();
  const avantAnniversaire =
    a.getUTCMonth() < naissance.getUTCMonth() ||
    (a.getUTCMonth() === naissance.getUTCMonth() && a.getUTCDate() < naissance.getUTCDate());
  if (avantAnniversaire) ans -= 1;
  return ans;
}
