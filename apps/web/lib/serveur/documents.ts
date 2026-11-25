import type { PrismaClient } from "@app/db";
import { TAILLE_MAX_DOCUMENT, type TypeDocument } from "@app/shared";
import type { Acteur } from "./droits";
import { erreurs } from "./erreurs";
import { journaliserAcces } from "./journal";
import { patientAutorise } from "./patients";
import { stockage } from "./stockage";

// Documents de la Fiche : réservés à l'orthophoniste du cabinet (section « fiche »).

/** Type réel du fichier, lu dans ses premiers octets (le type annoncé n'est pas fiable). */
export function detecterType(octets: Uint8Array): TypeDocument | null {
  const debut = (signature: number[]) => signature.every((b, i) => octets[i] === b);
  if (debut([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (debut([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (debut([0xff, 0xd8, 0xff])) return "image/jpeg";
  return null;
}

/** Nom de fichier affichable : sans chemin ni caractères de contrôle, 200 caractères max. */
export function nettoyerNom(nom: string): string {
  const base = nom.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex -- on retire justement les caractères de contrôle
  const propre = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (propre || "document").slice(0, 200);
}

export async function ajouterDocument(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  fichier: { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> },
) {
  await patientAutorise(prisma, acteur, patientId, "modifier", "fiche");
  if (fichier.size <= 0) throw erreurs.donneesInvalides();
  if (fichier.size > TAILLE_MAX_DOCUMENT) throw erreurs.documentTropGros();
  const octets = new Uint8Array(await fichier.arrayBuffer());
  if (octets.length > TAILLE_MAX_DOCUMENT) throw erreurs.documentTropGros();
  const typeMime = detecterType(octets);
  if (!typeMime) throw erreurs.documentTypeRefuse();

  const cleStockage = await stockage().ecrire(octets);
  try {
    const doc = await prisma.document.create({
      data: {
        patientId,
        nomFichier: nettoyerNom(fichier.name),
        typeMime,
        tailleOctets: octets.length,
        cleStockage,
        ajouteParId: acteur.id,
      },
      select: { id: true, nomFichier: true, typeMime: true, tailleOctets: true, createdAt: true },
    });
    await journaliserAcces(prisma, {
      userId: acteur.id,
      patientId,
      section: "documents",
      action: "MODIFICATION",
    });
    return doc;
  } catch (erreur) {
    await stockage().supprimer(cleStockage);
    throw erreur;
  }
}

async function documentDuPatient(prisma: PrismaClient, patientId: string, documentId: string) {
  const doc = await prisma.document.findFirst({ where: { id: documentId, patientId } });
  if (!doc) throw erreurs.introuvable();
  return doc;
}

/** Téléchargement : journalisé comme une sortie de données (EXPORT). */
export async function lireDocument(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  documentId: string,
) {
  await patientAutorise(prisma, acteur, patientId, "lire", "fiche", { journaliser: false });
  const doc = await documentDuPatient(prisma, patientId, documentId);
  const contenu = await stockage().lire(doc.cleStockage);
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "documents",
    action: "EXPORT",
  });
  return { doc, contenu };
}

export async function supprimerDocument(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  documentId: string,
) {
  await patientAutorise(prisma, acteur, patientId, "modifier", "fiche");
  const doc = await documentDuPatient(prisma, patientId, documentId);
  await prisma.document.delete({ where: { id: doc.id } });
  await stockage().supprimer(doc.cleStockage);
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "documents",
    action: "MODIFICATION",
  });
}
