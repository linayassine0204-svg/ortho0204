import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

// Stockage des fichiers (documents du dossier). En production : stockage de
// l'hébergeur certifié HDS (à brancher en remplaçant cette implémentation).
// En développement : un dossier local, jamais versionné.

export interface Stockage {
  ecrire(contenu: Uint8Array): Promise<string>;
  lire(cle: string): Promise<Buffer>;
  supprimer(cle: string): Promise<void>;
}

const FORMAT_CLE = /^[0-9a-f-]{36}$/;

function verifierCle(cle: string): string {
  // Empêche toute sortie du dossier de stockage (« ../ »).
  if (!FORMAT_CLE.test(cle)) throw new Error("Clé de stockage invalide.");
  return cle;
}

export function stockageLocal(dossier: string): Stockage {
  const racine = resolve(dossier);
  return {
    async ecrire(contenu) {
      await mkdir(racine, { recursive: true, mode: 0o700 });
      const cle = randomUUID();
      await writeFile(join(racine, cle), contenu, { mode: 0o600, flag: "wx" });
      return cle;
    },
    lire: (cle) => readFile(join(racine, verifierCle(cle))),
    supprimer: (cle) => rm(join(racine, verifierCle(cle)), { force: true }),
  };
}

/** Stockage configuré par STOCKAGE_DOSSIER (par défaut : .stockage-local). */
export function stockage(): Stockage {
  return stockageLocal(process.env.STOCKAGE_DOSSIER ?? ".stockage-local");
}
