import { createPrismaClient, type PrismaClient } from "@app/db";

const globalPourPrisma = globalThis as unknown as { __orthoPrisma?: PrismaClient };

/** Client Prisma unique pour le serveur (réutilisé entre les rechargements en dev). */
export function db(): PrismaClient {
  globalPourPrisma.__orthoPrisma ??= createPrismaClient();
  return globalPourPrisma.__orthoPrisma;
}
