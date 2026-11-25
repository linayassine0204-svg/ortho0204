import { z } from "zod";

const databaseUrlSchema = z
  .string({ message: "DATABASE_URL est manquante (voir .env.example)." })
  .regex(/^postgres(ql)?:\/\//, "DATABASE_URL doit être une URL PostgreSQL.");

/** Lit et valide DATABASE_URL. Le message d'erreur ne contient jamais la valeur. */
export function readDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const result = databaseUrlSchema.safeParse(env.DATABASE_URL);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "DATABASE_URL invalide.");
  }
  return result.data;
}
