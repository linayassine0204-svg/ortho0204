import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
import { readDatabaseUrl } from "./env";

export { readDatabaseUrl } from "./env";
export { PrismaClient };

/** Crée un client Prisma connecté à la base décrite par DATABASE_URL. */
export function createPrismaClient(env: NodeJS.ProcessEnv = process.env): PrismaClient {
  const adapter = new PrismaPg({ connectionString: readDatabaseUrl(env) });
  return new PrismaClient({ adapter });
}
