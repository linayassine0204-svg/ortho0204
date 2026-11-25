import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MARQUE_ROUTE, type GestionnaireNext } from "./routes";

// Garantit qu'AUCUNE route de l'API ne répond sans passer par la vérification
// des droits : chaque méthode exportée doit venir de routeProtegee() ou routePublique(),
// et chaque route publique doit être listée (et justifiée) ici.

const ROUTES_PUBLIQUES: Record<string, string> = {
  "GET /api/health": "état technique du service, aucune donnée",
  "POST /api/auth/inscription": "création de compte, avant toute connexion",
  "POST /api/auth/connexion": "connexion web",
  "POST /api/auth/mobile/connexion": "connexion mobile",
  "POST /api/auth/mobile/renouvellement": "le jeton de renouvellement est la preuve",
  "POST /api/invitations/accepter": "le jeton d'invitation est la preuve",
};

const METHODES = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;
const dossierApi = fileURLToPath(new URL("../../app/api", import.meta.url));

function fichiersRoute(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) return fichiersRoute(chemin);
    return /^route\.(ts|tsx|js)$/.test(entree.name) ? [chemin] : [];
  });
}

function cheminUrl(fichier: string): string {
  const rel = relative(dossierApi, fichier)
    .replace(/\\/g, "/")
    .replace(/\/?route\.\w+$/, "");
  return `/api${rel ? `/${rel}` : ""}`;
}

describe("couverture des droits sur les routes de l'API", async () => {
  const routes = await Promise.all(
    fichiersRoute(dossierApi).map(async (fichier) => ({
      url: cheminUrl(fichier),
      module: (await import(fichier)) as Record<string, unknown>,
    })),
  );

  it("trouve les routes de l'API", () => {
    expect(routes.length).toBeGreaterThan(5);
  });

  it("chaque méthode exportée passe par routeProtegee ou routePublique", () => {
    const fautives: string[] = [];
    for (const { url, module } of routes) {
      for (const methode of METHODES) {
        const gestionnaire = module[methode] as GestionnaireNext | undefined;
        if (gestionnaire && !gestionnaire[MARQUE_ROUTE]) fautives.push(`${methode} ${url}`);
      }
    }
    expect(fautives).toEqual([]);
  });

  it("seules les routes listées ici sont publiques", () => {
    const publiques: string[] = [];
    for (const { url, module } of routes) {
      for (const methode of METHODES) {
        const gestionnaire = module[methode] as GestionnaireNext | undefined;
        if (gestionnaire?.[MARQUE_ROUTE] === "publique") publiques.push(`${methode} ${url}`);
      }
    }
    expect(publiques.sort()).toEqual(Object.keys(ROUTES_PUBLIQUES).sort());
  });
});
