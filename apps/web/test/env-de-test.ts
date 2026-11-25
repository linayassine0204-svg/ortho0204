// Variables d'environnement des tests d'intégration : base de TEST et secret fictif.
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inject } from "vitest";

declare module "vitest" {
  export interface ProvidedContext {
    testDatabaseUrl: string;
  }
}

process.env.DATABASE_URL = inject("testDatabaseUrl");
process.env.AUTH_SECRET = "secret-de-test-fictif-au-moins-32-caracteres";
process.env.APP_URL = "http://localhost:3000";
// Documents déposés pendant les tests : dossier temporaire, jamais dans le dépôt.
process.env.STOCKAGE_DOSSIER = join(tmpdir(), "ortho-stockage-test");
