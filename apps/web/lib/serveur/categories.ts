import type { PrismaClient } from "@app/db";

/** Pathologies (catégories) : liste commune, sans donnée de patient. */
export function listerCategories(prisma: PrismaClient) {
  return prisma.categorie.findMany({
    orderBy: { nom: "asc" },
    select: { id: true, nom: true, slug: true },
  });
}
export type Categorie = Awaited<ReturnType<typeof listerCategories>>[number];
