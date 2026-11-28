import type { Prisma, PrismaClient, Role } from "@app/db";
import {
  EXTENSIONS_PIECE_JOINTE,
  LIMITES_PIECE_JOINTE,
  TAILLE_MAX_PIECE_JOINTE,
  TYPES_PIECE_JOINTE,
  detecterTypePieceJointe,
  texteMessageSchema,
  type FilVue,
  type MessageVue,
  type ReglagesCabinet,
  type ReponseRapideSaisie,
  type TypePieceJointe,
} from "@app/shared";
import { can, type Acteur } from "./droits";
import { erreurs } from "./erreurs";
import { journaliserAcces } from "./journal";
import { patientAutorise } from "./patients";
import { stockage } from "./stockage";

// Messagerie sécurisée (optionnelle), un fil par patient.
// - Droits : `can()` sur la section « messagerie » (lire, ecrire). Désactivée pour le
//   cabinet ou le patient : l'API refuse tout (403 « messagerie_desactivee »).
// - Chaque lecture du fil (et de ses pièces jointes) est écrite au journal d'accès.
// - Aucun service externe ; aucun contenu de message dans les journaux techniques.

const inclusionMessage = {
  auteur: { select: { id: true, prenom: true, role: true } },
  piecesJointes: {
    select: { id: true, typeMime: true, tailleOctets: true, dureeSecondes: true },
    orderBy: { id: "asc" },
  },
} satisfies Prisma.MessageInclude;
type MessageCharge = Prisma.MessageGetPayload<{ include: typeof inclusionMessage }>;

const coteDe = (role: Role | undefined) => (role === "ORTHO" ? "CABINET" : "FAMILLE");

function versVue(m: MessageCharge, lecteur: Acteur): MessageVue {
  return {
    id: m.id,
    deMoi: m.auteurId === lecteur.id,
    cote: m.auteur ? coteDe(m.auteur.role) : "FAMILLE",
    auteur: m.auteur?.prenom ?? null,
    contenu: m.contenu,
    envoyeLe: m.envoyeLe.toISOString(),
    luLe: m.luLe?.toISOString() ?? null,
    piecesJointes: m.piecesJointes.map((p) => {
      const typeMime = p.typeMime as TypePieceJointe;
      return {
        id: p.id,
        genre: TYPES_PIECE_JOINTE[typeMime] ?? "PHOTO",
        typeMime,
        tailleOctets: p.tailleOctets,
        dureeSecondes: p.dureeSecondes,
      };
    }),
  };
}

/** Comptes famille qui peuvent lire le fil (reliés et consentants). */
async function interlocuteurs(prisma: PrismaClient, patientId: string) {
  const p = await prisma.patient.findUniqueOrThrow({
    where: { id: patientId },
    select: {
      tuteurs: { select: { parent: { select: { id: true, prenom: true, nom: true } } } },
      compte: { select: { id: true, prenom: true, nom: true } },
      consentements: { where: { type: "DONNEES_SANTE", retire: false }, select: { userId: true } },
    },
  });
  const consentants = new Set(p.consentements.map((c) => c.userId));
  return [...p.tuteurs.map((t) => t.parent), ...(p.compte ? [p.compte] : [])]
    .filter((c) => consentants.has(c.id))
    .map((c) => `${c.prenom} ${c.nom}`);
}

/**
 * Fil du patient (orthophoniste du cabinet, parent relié ou patient lui-même).
 * Les messages de l'autre côté sont marqués lus. Lecture journalisée.
 */
export async function lireFil(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  maintenant = new Date(),
): Promise<FilVue & { interlocuteurs?: string[] }> {
  const patient = await patientAutorise(prisma, acteur, patientId, "lire", "messagerie");
  const [fil, cabinet] = await Promise.all([
    prisma.filMessages.findUnique({ where: { patientId } }),
    prisma.cabinet.findUniqueOrThrow({
      where: { id: patient.cabinetId },
      select: { horairesReponse: true },
    }),
  ]);
  let messages: MessageCharge[] = [];
  if (fil) {
    // Lu par l'autre côté : un orthophoniste lit les messages de la famille, et inversement.
    const auteursDeLautreCote: Prisma.UserWhereInput =
      acteur.role === "ORTHO" ? { role: { not: "ORTHO" } } : { role: "ORTHO" };
    await prisma.message.updateMany({
      where: { filId: fil.id, luLe: null, auteur: auteursDeLautreCote },
      data: { luLe: maintenant },
    });
    messages = await prisma.message.findMany({
      where: { filId: fil.id },
      orderBy: { envoyeLe: "asc" },
      include: inclusionMessage,
    });
  }
  return {
    horairesReponse: cabinet.horairesReponse,
    messages: messages.map((m) => versVue(m, acteur)),
    ...(acteur.role === "ORTHO" ? { interlocuteurs: await interlocuteurs(prisma, patientId) } : {}),
  };
}

/**
 * Fil du patient, créé au premier message. Deux premiers messages simultanés : la base
 * n'accepte qu'un fil par patient, l'autre requête relit celui qui vient d'être créé.
 */
async function filDuPatient(prisma: PrismaClient, patientId: string): Promise<string> {
  const existant = await prisma.filMessages.findUnique({ where: { patientId } });
  if (existant) return existant.id;
  try {
    return (await prisma.filMessages.create({ data: { patientId } })).id;
  } catch (erreur) {
    const doublon =
      typeof erreur === "object" && erreur !== null && "code" in erreur && erreur.code === "P2002";
    if (!doublon) throw erreur;
    return (await prisma.filMessages.findUniqueOrThrow({ where: { patientId } })).id;
  }
}

export interface FichierRecu {
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Nouveau message : texte, et/ou une pièce jointe (photo ou message vocal) dont le type
 * RÉEL est lu dans le fichier. Le fil du patient est créé au premier message.
 */
export async function envoyerMessage(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  d: { contenu: string; fichier?: FichierRecu | null; dureeSecondes?: number | null },
): Promise<MessageVue> {
  await patientAutorise(prisma, acteur, patientId, "ecrire", "messagerie");
  const texte = texteMessageSchema.safeParse(d.contenu ?? "");
  if (!texte.success) throw erreurs.donneesInvalides();
  const contenu = texte.data;
  if (contenu === "" && !d.fichier) throw erreurs.messageVide();

  let piece: { octets: Uint8Array; typeMime: TypePieceJointe; duree: number | null } | null = null;
  if (d.fichier) {
    if (d.fichier.size <= 0) throw erreurs.donneesInvalides();
    if (d.fichier.size > TAILLE_MAX_PIECE_JOINTE) throw erreurs.pieceJointeTropGrosse();
    const octets = new Uint8Array(await d.fichier.arrayBuffer());
    const typeMime = detecterTypePieceJointe(octets);
    if (!typeMime) throw erreurs.pieceJointeTypeRefuse();
    const genre = TYPES_PIECE_JOINTE[typeMime];
    if (octets.length > LIMITES_PIECE_JOINTE[genre].tailleMaxOctets) {
      throw erreurs.pieceJointeTropGrosse();
    }
    let duree: number | null = null;
    if (genre === "VOCAL" && d.dureeSecondes !== undefined && d.dureeSecondes !== null) {
      if (!Number.isInteger(d.dureeSecondes) || d.dureeSecondes < 0) {
        throw erreurs.donneesInvalides();
      }
      if (d.dureeSecondes > LIMITES_PIECE_JOINTE.VOCAL.dureeMaxSecondes) {
        throw erreurs.pieceJointeTropGrosse();
      }
      duree = d.dureeSecondes;
    }
    piece = { octets, typeMime, duree };
  }

  const cleStockage = piece ? await stockage().ecrire(piece.octets) : null;
  try {
    const filId = await filDuPatient(prisma, patientId);
    const message = await prisma.message.create({
      data: {
        filId,
        auteurId: acteur.id,
        contenu,
        ...(piece && cleStockage
          ? {
              piecesJointes: {
                create: {
                  nomFichier: `piece-jointe.${EXTENSIONS_PIECE_JOINTE[piece.typeMime]}`,
                  typeMime: piece.typeMime,
                  tailleOctets: piece.octets.length,
                  cleStockage,
                  dureeSecondes: piece.duree,
                },
              },
            }
          : {}),
      },
      include: inclusionMessage,
    });
    await journaliserAcces(prisma, {
      userId: acteur.id,
      patientId,
      section: "messagerie",
      action: "MODIFICATION",
    });
    return versVue(message, acteur);
  } catch (erreur) {
    if (cleStockage) await stockage().supprimer(cleStockage);
    throw erreur;
  }
}

/** Pièce jointe d'un message de ce patient (mêmes droits que le fil). Lecture journalisée. */
export async function lirePieceJointe(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  pieceId: string,
) {
  await patientAutorise(prisma, acteur, patientId, "lire", "messagerie");
  const piece = await prisma.pieceJointe.findFirst({
    where: { id: pieceId, message: { fil: { patientId } } },
  });
  if (!piece) throw erreurs.introuvable();
  let contenu: Buffer;
  try {
    contenu = await stockage().lire(piece.cleStockage);
  } catch {
    throw erreurs.introuvable();
  }
  return { contenu, typeMime: piece.typeMime, nomFichier: piece.nomFichier };
}

// ─── Réglages (orthophoniste du cabinet) ───────────────────────────────────

function autoriserCabinet(acteur: Acteur, action: "lire" | "modifier") {
  if (!can(acteur, action, { type: "cabinet", id: acteur.cabinetId })) throw erreurs.introuvable();
}

export async function lireReglages(prisma: PrismaClient, acteur: Acteur) {
  autoriserCabinet(acteur, "lire");
  return prisma.cabinet.findUniqueOrThrow({
    where: { id: acteur.cabinetId },
    select: { messagerieActivee: true, horairesReponse: true },
  });
}

export async function modifierReglages(prisma: PrismaClient, acteur: Acteur, d: ReglagesCabinet) {
  autoriserCabinet(acteur, "modifier");
  return prisma.cabinet.update({
    where: { id: acteur.cabinetId },
    data: { messagerieActivee: d.messagerieActivee, horairesReponse: d.horairesReponse },
    select: { messagerieActivee: true, horairesReponse: true },
  });
}

/** Exception pour un patient : true, false, ou null (suit le cabinet). */
export async function modifierMessageriePatient(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  messagerieActivee: boolean | null,
) {
  await patientAutorise(prisma, acteur, patientId, "modifier", "fiche");
  await prisma.reglagePatient.upsert({
    where: { patientId },
    create: { patientId, messagerieActivee },
    update: { messagerieActivee },
  });
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "fiche",
    action: "MODIFICATION",
  });
  return { messagerieActivee };
}

// ─── Réponses rapides du cabinet ───────────────────────────────────────────

const selectionReponse = { id: true, titre: true, texte: true, ordre: true } as const;

export async function listerReponsesRapides(prisma: PrismaClient, acteur: Acteur) {
  autoriserCabinet(acteur, "lire");
  return prisma.reponseRapide.findMany({
    where: { cabinetId: acteur.cabinetId },
    orderBy: [{ ordre: "asc" }, { createdAt: "asc" }],
    select: selectionReponse,
  });
}

export async function creerReponseRapide(
  prisma: PrismaClient,
  acteur: Acteur,
  d: ReponseRapideSaisie,
) {
  autoriserCabinet(acteur, "modifier");
  const max = await prisma.reponseRapide.aggregate({
    where: { cabinetId: acteur.cabinetId },
    _max: { ordre: true },
  });
  return prisma.reponseRapide.create({
    data: { ...d, cabinetId: acteur.cabinetId, ordre: (max._max.ordre ?? 0) + 1 },
    select: selectionReponse,
  });
}

async function reponseDuCabinet(prisma: PrismaClient, acteur: Acteur, id: string) {
  autoriserCabinet(acteur, "modifier");
  const r = await prisma.reponseRapide.findFirst({ where: { id, cabinetId: acteur.cabinetId } });
  if (!r) throw erreurs.introuvable();
  return r;
}

export async function modifierReponseRapide(
  prisma: PrismaClient,
  acteur: Acteur,
  id: string,
  d: ReponseRapideSaisie,
) {
  const r = await reponseDuCabinet(prisma, acteur, id);
  return prisma.reponseRapide.update({ where: { id: r.id }, data: d, select: selectionReponse });
}

export async function supprimerReponseRapide(prisma: PrismaClient, acteur: Acteur, id: string) {
  const r = await reponseDuCabinet(prisma, acteur, id);
  await prisma.reponseRapide.delete({ where: { id: r.id } });
}
