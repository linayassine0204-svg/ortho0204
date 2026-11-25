import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";
import { readDatabaseUrl } from "./env.ts";

export { readDatabaseUrl } from "./env.ts";
export { hashPassword, verifyPassword } from "./password.ts";
export { PrismaClient };
export * from "./generated/prisma/enums.ts";

/** Crée un client Prisma connecté à la base décrite par DATABASE_URL. */
export function createPrismaClient(env: NodeJS.ProcessEnv = process.env): PrismaClient {
  const adapter = new PrismaPg({ connectionString: readDatabaseUrl(env) });
  return new PrismaClient({ adapter });
}
