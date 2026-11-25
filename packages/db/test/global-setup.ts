// Prépare une base de TEST vide (jamais la base de développement) avant les tests
// d'intégration : suppression, recréation, puis application des migrations.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";
import type { TestProject } from "vitest/node";

const racineDb = fileURLToPath(new URL("..", import.meta.url));
const HOTES_LOCAUX = new Set(["localhost", "127.0.0.1", "::1", "db", "postgres"]);

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

/** URL de la base de test : même serveur, nom de base suffixé par « _test ». */
export function urlBaseDeTest(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const nom = url.pathname.replace(/^\//, "");
  if (!nom) throw new Error("DATABASE_URL ne contient pas de nom de base.");
  url.pathname = `/${nom.endsWith("_test") ? nom : `${nom}_test`}`;
  return url.toString();
}

export default async function setup(project: TestProject): Promise<void> {
  config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });
  const source = process.env.DATABASE_URL;
  if (!source) {
    throw new Error("DATABASE_URL est manquante : copiez .env.example en .env.");
  }
  const testUrl = urlBaseDeTest(source);
  const url = new URL(testUrl);
  if (!HOTES_LOCAUX.has(url.hostname) && process.env.CI !== "true") {
    throw new Error("Les tests d'intégration ne tournent que sur une base locale.");
  }
  const nomBase = url.pathname.slice(1);

  const admin = new URL(testUrl);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  try {
    await client.connect();
  } catch {
    throw new Error("Base injoignable : lancez `pnpm db:up` (Docker) puis relancez les tests.");
  }
  try {
    const ident = `"${nomBase.replace(/"/g, '""')}"`;
    await client.query(`DROP DATABASE IF EXISTS ${ident} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${ident}`);
  } finally {
    await client.end();
  }

  // Applique les migrations sur la base vide, exactement comme en production.
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: racineDb,
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "pipe",
  });

  project.provide("testDatabaseUrl", testUrl);
}
