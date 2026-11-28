import type { Prisma, PrismaClient } from "@app/db";
import {
  actualiserSections,
  cleModele,
  compterStatuts,
  creerSections,
  jourLocal,
  resumeMaison,
  sectionsSchema,
  statutDocument,
  titreParDefaut,
  type CreationDocument,
  type DonneesBilan,
  type ElementPourResume,
  type Jour,
  type SectionDocument,
  type SeancePourBilan,
  type TypeBilan,
  type TypeCreable,
} from "@app/shared";
import type { Acteur } from "./droits";
import { erreurs } from "./erreurs";
import { exporterDocx, exporterPdf, type ContenuExport } from "./export-bilan";
import { journaliserAcces } from "./journal";
import { ageEnAnnees, patientAutorise } from "./patients";

// Bilans, comptes rendus et courriers (orthophoniste du cabinet).
// - Création depuis un modèle : les parties factuelles sont remplies par des règles
//   (packages/shared/src/bilans.ts), marquées « Automatique » jusqu'à relecture.
// - Partage avec la famille : SEULEMENT si l'orthophoniste le coche, et seulement un
//   document entièrement relu. Toute modification retire le partage.
// - La famille ne lit que les documents partagés (partie « documentsPartages »).

const JOUR_MS = 24 * 60 * 60 * 1000;
const SEANCES_PROPOSEES = 20;

type Client = PrismaClient | Prisma.TransactionClient;
type BilanEnBase = Prisma.BilanGetPayload<object>;

const jourDe = (d: Date) => d.toISOString().slice(0, 10);
const enDate = (jour: string) => new Date(`${jour}T00:00:00Z`);
const jourSuivant = (jour: string) => jourDe(new Date(enDate(jour).getTime() + JOUR_MS));

/** L'orthophoniste du cabinet rédige : droit « modifier » sur la section bilans. */
function autoriser(prisma: PrismaClient, acteur: Acteur, patientId: string) {
  return patientAutorise(prisma, acteur, patientId, "modifier", "bilans");
}

function sectionsDe(bilan: Pick<BilanEnBase, "sections">): SectionDocument[] {
  return sectionsSchema.parse(bilan.sections);
}

/** Comptes famille reliés au patient qui ont donné leur consentement (verront le partage). */
async function familleConsentante(prisma: Client, patientId: string) {
  const p = await prisma.patient.findUniqueOrThrow({
    where: { id: patientId },
    select: {
      tuteurs: { select: { parentId: true } },
      compteUserId: true,
      consentements: { where: { type: "DONNEES_SANTE", retire: false }, select: { userId: true } },
    },
  });
  const famille = new Set([
    ...p.tuteurs.map((t) => t.parentId),
    ...(p.compteUserId ? [p.compteUserId] : []),
  ]);
  return new Set(p.consentements.map((c) => c.userId).filter((id) => famille.has(id))).size;
}

// ─── Données du remplissage automatique ────────────────────────────────────

/** Période habituelle d'un nouveau document (si l'orthophoniste n'en donne pas). */
async function periodeParDefaut(
  prisma: Client,
  patientId: string,
  type: TypeCreable,
  aujourdhui: string,
): Promise<{ debut: string | null; fin: string }> {
  if (type === "INITIAL") return { debut: null, fin: aujourdhui };
  const premiere = await prisma.seance.findFirst({
    where: { patientId, termineeLe: { not: null } },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  const debutSuivi = premiere ? jourLocal(premiere.date).date : null;
  if (type === "EVOLUTION") {
    // Depuis le dernier bilan (initial, d'évolution ou de renouvellement).
    const precedent = await prisma.bilan.findFirst({
      where: {
        patientId,
        type: { in: ["INITIAL", "EVOLUTION", "RENOUVELLEMENT"] },
        date: { lt: enDate(aujourdhui) },
      },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    return { debut: precedent ? jourDe(precedent.date) : debutSuivi, fin: aujourdhui };
  }
  return { debut: debutSuivi, fin: aujourdhui };
}

/** Séance terminée de ce patient (ou la dernière), pour un compte rendu de séance. */
async function seanceDuCompteRendu(prisma: Client, patientId: string, seanceId: string | null) {
  const seance = await prisma.seance.findFirst({
    where: { patientId, termineeLe: { not: null }, ...(seanceId ? { id: seanceId } : {}) },
    orderBy: { date: "desc" },
    include: {
      elements: {
        where: { retenu: true },
        orderBy: { ordre: "asc" },
        include: { exercice: { select: { titre: true } } },
      },
    },
  });
  if (seanceId && !seance) throw erreurs.introuvable();
  return seance;
}

type SeanceChargee = NonNullable<Awaited<ReturnType<typeof seanceDuCompteRendu>>>;

const versSeancePourBilan = (s: SeanceChargee): SeancePourBilan => ({
  jour: jourLocal(s.date).date,
  exercices: s.elements.map((e) => ({ titre: e.exercice.titre, niveau: e.niveau })),
  notes: s.notes,
  pointsAReprendre: s.pointsAReprendre,
});

/** Rassemble les données du patient sur la période (lecture seule, droits déjà vérifiés). */
export async function donneesBilan(
  prisma: Client,
  patientId: string,
  periode: { debut: string | null; fin: string },
  seanceId: string | null,
  avecSeance: boolean,
): Promise<DonneesBilan> {
  const debutInstant = periode.debut ? enDate(periode.debut).getTime() - JOUR_MS : 0;
  const finInstant = enDate(jourSuivant(periode.fin)).getTime() + JOUR_MS;
  const dansPeriode = (jour: string) =>
    (!periode.debut || jour >= periode.debut) && jour <= periode.fin;

  const [patient, seances, programme, scores, seance] = await Promise.all([
    prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      select: {
        prenom: true,
        nom: true,
        dateNaissance: true,
        medecinNom: true,
        medecinContact: true,
        pathologies: { select: { categorie: { select: { nom: true } } } },
      },
    }),
    prisma.seance.findMany({
      where: {
        patientId,
        termineeLe: { not: null },
        date: { gte: new Date(debutInstant), lt: new Date(finInstant) },
      },
      orderBy: { date: "asc" },
      include: {
        elements: {
          where: { retenu: true },
          orderBy: { ordre: "asc" },
          include: { exercice: { select: { titre: true } } },
        },
      },
    }),
    prisma.programme.findFirst({
      where: { patientId, actif: true },
      include: {
        elements: {
          where: { retireLe: null },
          orderBy: { ordre: "asc" },
          include: { exercice: { select: { titre: true } } },
        },
      },
    }),
    prisma.realisation.findMany({
      where: {
        element: { programme: { patientId } },
        fait: true,
        score: { not: null },
        scoreMax: { not: null },
        date: { gte: new Date(debutInstant), lt: new Date(finInstant) },
      },
      select: {
        date: true,
        score: true,
        scoreMax: true,
        niveau: true,
        element: { select: { niveau: true, exercice: { select: { titre: true } } } },
      },
    }),
    avecSeance ? seanceDuCompteRendu(prisma, patientId, seanceId) : null,
  ]);

  // Maison : exercices du programme actuel, du début de la période (ou du programme) à la fin.
  let maison = null;
  if (programme && programme.elements.length > 0) {
    const depuis = periode.debut ?? jourDe(programme.dateDebut);
    const realisations = await prisma.realisation.findMany({
      where: {
        elementProgrammeId: { in: programme.elements.map((e) => e.id) },
        date: { gte: new Date(enDate(depuis).getTime() - JOUR_MS), lt: new Date(finInstant) },
      },
      select: {
        elementProgrammeId: true,
        date: true,
        fait: true,
        ressenti: true,
        score: true,
        scoreMax: true,
      },
    });
    maison = resumeMaison({
      depuis,
      aujourdhui: jourSuivant(periode.fin),
      elements: programme.elements.map((e): ElementPourResume => ({
        elementId: e.id,
        titre: e.exercice.titre,
        foisParSemaine: e.foisParSemaine,
        jours: e.jours as Jour[],
      })),
      realisations: realisations.map((r) => ({
        elementId: r.elementProgrammeId,
        jour: jourLocal(r.date).date,
        fait: r.fait,
        ressenti: r.ressenti,
        score: r.score,
        scoreMax: r.scoreMax,
      })),
    });
  }

  return {
    patient: {
      prenom: patient.prenom,
      nom: patient.nom,
      dateNaissance: jourDe(patient.dateNaissance),
      age: ageEnAnnees(patient.dateNaissance, enDate(periode.fin)),
      pathologies: patient.pathologies
        .map((p) => p.categorie.nom)
        .sort((a, b) => a.localeCompare(b, "fr")),
      medecinNom: patient.medecinNom,
      medecinContact: patient.medecinContact,
    },
    periode,
    seances: seances.map(versSeancePourBilan).filter((s) => dansPeriode(s.jour)),
    maison,
    scores: scores
      .filter((r) => dansPeriode(jourLocal(r.date).date))
      .map((r) => ({
        titre: r.element.exercice.titre,
        niveau: r.niveau ?? r.element.niveau,
        score: r.score ?? 0,
        scoreMax: r.scoreMax ?? 0,
      })),
    programme: (programme?.elements ?? []).map((e) => ({
      titre: e.exercice.titre,
      niveau: e.niveau,
      foisParSemaine: e.foisParSemaine,
      jours: e.jours,
    })),
    seance: seance ? versSeancePourBilan(seance) : null,
  };
}

// ─── Vues ──────────────────────────────────────────────────────────────────

function resume(b: BilanEnBase) {
  const sections = sectionsDe(b);
  return {
    id: b.id,
    titre: b.titre,
    type: b.type as TypeBilan,
    date: jourDe(b.date),
    statut: statutDocument(sections),
    parties: compterStatuts(sections),
    total: sections.length,
    partage: b.partage,
    partageLe: b.partageLe,
    modifieLe: b.updatedAt,
  };
}

function vue(b: BilanEnBase) {
  return {
    ...resume(b),
    modele: b.modele,
    dateDebut: b.dateDebut ? jourDe(b.dateDebut) : null,
    destinataire: b.destinataire,
    seanceId: b.seanceId,
    sections: sectionsDe(b),
  };
}
export type VueBilan = ReturnType<typeof vue>;
export type ResumeBilan = ReturnType<typeof resume>;

async function bilanDuPatient(prisma: Client, patientId: string, bilanId: string) {
  const bilan = await prisma.bilan.findFirst({ where: { id: bilanId, patientId } });
  if (!bilan) throw erreurs.introuvable();
  return bilan;
}

async function journaliserModification(prisma: PrismaClient, acteur: Acteur, patientId: string) {
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "bilans",
    action: "MODIFICATION",
  });
}

/**
 * Modifie un document en exclusivité : la ligne est verrouillée le temps de relire et
 * de réécrire ses parties (deux enregistrements rapprochés ne s'écrasent pas).
 * Un document partagé qui est modifié n'est plus partagé.
 */
async function modifierEnExclusivite(
  prisma: PrismaClient,
  patientId: string,
  bilanId: string,
  calcul: (
    tx: Prisma.TransactionClient,
    bilan: BilanEnBase,
    sections: SectionDocument[],
  ) => Promise<{ sections: SectionDocument[]; titre?: string; destinataire?: string | null }>,
) {
  return prisma.$transaction(async (tx) => {
    const verrou = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "bilan" WHERE "id" = ${bilanId} AND "patientId" = ${patientId} FOR UPDATE`;
    if (verrou.length === 0) throw erreurs.introuvable();
    const bilan = await tx.bilan.findUniqueOrThrow({ where: { id: bilanId } });
    const { sections, titre, destinataire } = await calcul(tx, bilan, sectionsDe(bilan));
    const misAJour = await tx.bilan.update({
      where: { id: bilan.id },
      data: { titre, destinataire, sections, partage: false, partageLe: null, partageParId: null },
    });
    return { bilan: vue(misAJour), partageRetire: bilan.partage };
  });
}

// ─── Orthophoniste ─────────────────────────────────────────────────────────

/** Liste des documents du patient avec leur statut, et ce qu'il faut pour en créer un. */
export async function listerBilans(prisma: PrismaClient, acteur: Acteur, patientId: string) {
  await autoriser(prisma, acteur, patientId);
  await journaliserAcces(prisma, { userId: acteur.id, patientId, section: "bilans" });
  const [bilans, patient, seances, famille] = await Promise.all([
    prisma.bilan.findMany({
      where: { patientId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      select: { pathologies: { select: { categorie: { select: { slug: true, nom: true } } } } },
    }),
    prisma.seance.findMany({
      where: { patientId, termineeLe: { not: null } },
      orderBy: { date: "desc" },
      take: SEANCES_PROPOSEES,
      select: { id: true, date: true },
    }),
    familleConsentante(prisma, patientId),
  ]);
  return {
    documents: bilans.map(resume),
    pathologies: patient.pathologies
      .map((p) => p.categorie)
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    seances: seances.map((s) => ({ id: s.id, jour: jourLocal(s.date).date })),
    familleConsentante: famille,
  };
}
export type ListeBilans = Awaited<ReturnType<typeof listerBilans>>;

/** Nouveau document depuis le modèle du type et de la pathologie, chiffres remplis. */
export async function creerBilan(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  d: CreationDocument,
  maintenant = new Date(),
) {
  await autoriser(prisma, acteur, patientId);
  const aujourdhui = jourLocal(maintenant).date;
  const compteRendu = d.type === "COMPTE_RENDU_SEANCE";
  const seance = compteRendu ? await seanceDuCompteRendu(prisma, patientId, d.seanceId) : null;
  const jourSeance = seance ? jourLocal(seance.date).date : null;
  const parDefaut = await periodeParDefaut(prisma, patientId, d.type, aujourdhui);
  const periode = jourSeance
    ? { debut: jourSeance, fin: jourSeance }
    : { debut: d.dateDebut ?? parDefaut.debut, fin: d.date ?? parDefaut.fin };
  if (periode.debut && periode.debut > periode.fin) throw erreurs.donneesInvalides();

  const pathologies = await prisma.patientPathologie.findMany({
    where: { patientId },
    select: { categorie: { select: { slug: true, nom: true } } },
  });
  const slugs = pathologies
    .map((p) => p.categorie)
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
    .map((c) => c.slug);
  const pathologie = d.pathologie ?? slugs[0] ?? null;

  const donnees = await donneesBilan(prisma, patientId, periode, seance?.id ?? null, compteRendu);
  const bilan = await prisma.bilan.create({
    data: {
      patientId,
      auteurId: acteur.id,
      type: d.type,
      titre: titreParDefaut(d.type),
      modele: cleModele(d.type, pathologie),
      dateDebut: periode.debut ? enDate(periode.debut) : null,
      date: enDate(periode.fin),
      seanceId: seance?.id ?? null,
      destinataire: d.destinataire,
      sections: creerSections(d.type, pathologie, donnees),
    },
  });
  await journaliserModification(prisma, acteur, patientId);
  return vue(bilan);
}

export async function lireBilan(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  bilanId: string,
) {
  await autoriser(prisma, acteur, patientId);
  const bilan = await bilanDuPatient(prisma, patientId, bilanId);
  await journaliserAcces(prisma, { userId: acteur.id, patientId, section: "bilans" });
  return { bilan: vue(bilan), familleConsentante: await familleConsentante(prisma, patientId) };
}

/** Titre, destinataire. */
export async function modifierBilan(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  bilanId: string,
  d: { titre?: string; destinataire?: string | null },
) {
  await autoriser(prisma, acteur, patientId);
  const resultat = await modifierEnExclusivite(
    prisma,
    patientId,
    bilanId,
    async (_, __, sections) => ({
      sections,
      titre: d.titre,
      destinataire: d.destinataire,
    }),
  );
  await journaliserModification(prisma, acteur, patientId);
  return resultat;
}

/**
 * Texte d'une partie écrit ou corrigé (`contenu`), ou relu tel quel (`relu`).
 * Dans les deux cas, la partie est désormais relue par l'orthophoniste.
 */
export async function modifierSection(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  bilanId: string,
  cle: string,
  d: { contenu?: string; relu?: true },
) {
  await autoriser(prisma, acteur, patientId);
  const resultat = await modifierEnExclusivite(
    prisma,
    patientId,
    bilanId,
    async (_, __, sections) => {
      if (!sections.some((s) => s.cle === cle)) throw erreurs.partieInconnue();
      return {
        sections: sections.map((s) =>
          s.cle === cle ? { ...s, contenu: d.contenu ?? s.contenu, relu: true } : s,
        ),
      };
    },
  );
  await journaliserModification(prisma, acteur, patientId);
  return resultat;
}

/** Recalcule les parties automatiques depuis les données (même période) : à relire. */
export async function actualiserBilan(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  bilanId: string,
) {
  await autoriser(prisma, acteur, patientId);
  const resultat = await modifierEnExclusivite(
    prisma,
    patientId,
    bilanId,
    async (tx, bilan, sections) => {
      const donnees = await donneesBilan(
        tx,
        patientId,
        { debut: bilan.dateDebut ? jourDe(bilan.dateDebut) : null, fin: jourDe(bilan.date) },
        bilan.seanceId,
        bilan.type === "COMPTE_RENDU_SEANCE",
      );
      return { sections: actualiserSections(sections, donnees) };
    },
  );
  await journaliserModification(prisma, acteur, patientId);
  return resultat;
}

/**
 * Partager avec la famille (case cochée par l'orthophoniste) ou retirer le partage.
 * Seul un document entièrement relu (« Rempli ») peut être partagé.
 */
export async function partagerBilan(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  bilanId: string,
  partage: boolean,
  maintenant = new Date(),
) {
  await autoriser(prisma, acteur, patientId);
  const bilan = await bilanDuPatient(prisma, patientId, bilanId);
  if (partage && statutDocument(sectionsDe(bilan)) !== "REMPLI") throw erreurs.documentARelire();
  const misAJour = await prisma.bilan.update({
    where: { id: bilan.id },
    data: partage
      ? { partage: true, partageLe: maintenant, partageParId: acteur.id }
      : { partage: false, partageLe: null, partageParId: null },
  });
  await journaliserModification(prisma, acteur, patientId);
  return vue(misAJour);
}

export async function supprimerBilan(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  bilanId: string,
) {
  await autoriser(prisma, acteur, patientId);
  const bilan = await bilanDuPatient(prisma, patientId, bilanId);
  await prisma.bilan.delete({ where: { id: bilan.id } });
  await journaliserModification(prisma, acteur, patientId);
}

// ─── Export (PDF, Word) ────────────────────────────────────────────────────

async function contenuExport(
  prisma: PrismaClient,
  patientId: string,
  bilan: BilanEnBase,
): Promise<ContenuExport> {
  const [patient, auteur] = await Promise.all([
    prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      select: { prenom: true, nom: true, dateNaissance: true },
    }),
    bilan.auteurId
      ? prisma.user.findUnique({
          where: { id: bilan.auteurId },
          select: { prenom: true, nom: true },
        })
      : null,
  ]);
  const sections = sectionsDe(bilan);
  return {
    titre: bilan.titre,
    patient: {
      prenom: patient.prenom,
      nom: patient.nom,
      dateNaissance: jourDe(patient.dateNaissance),
    },
    date: jourDe(bilan.date),
    periode:
      bilan.dateDebut && bilan.type !== "COMPTE_RENDU_SEANCE"
        ? { debut: jourDe(bilan.dateDebut), fin: jourDe(bilan.date) }
        : null,
    destinataire: bilan.destinataire,
    professionnel: auteur ? `${auteur.prenom} ${auteur.nom}` : null,
    sections: sections.map((s) => ({ titre: s.titre, contenu: s.contenu })),
    brouillon: statutDocument(sections) !== "REMPLI",
  };
}

/** Nom de fichier sans le nom du patient. */
const nomFichier = (b: BilanEnBase, extension: string) =>
  `${b.type.toLowerCase().replace(/_/g, "-")}-${jourDe(b.date)}.${extension}`;

/**
 * Export PDF ou Word, produit sur NOTRE serveur (aucun service externe).
 * Un document pas entièrement relu porte la mention « Brouillon ». Export journalisé.
 */
export async function exporterBilan(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  bilanId: string,
  format: "pdf" | "docx",
  maintenant = new Date(),
) {
  await autoriser(prisma, acteur, patientId);
  const bilan = await bilanDuPatient(prisma, patientId, bilanId);
  const contenu = await contenuExport(prisma, patientId, bilan);
  const octets =
    format === "pdf" ? await exporterPdf(contenu, maintenant) : await exporterDocx(contenu);
  await journaliserAcces(prisma, {
    userId: acteur.id,
    patientId,
    section: "bilans",
    action: "EXPORT",
  });
  return { octets, nomFichier: nomFichier(bilan, format) };
}

// ─── Famille : documents partagés seulement ────────────────────────────────

/**
 * Documents que l'orthophoniste a partagés (parent relié ou patient lui-même, avec
 * consentement). Un document non partagé n'apparaît jamais. Lecture journalisée.
 */
export async function listerBilansPartages(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
) {
  await patientAutorise(prisma, acteur, patientId, "lire", "documentsPartages");
  const bilans = await prisma.bilan.findMany({
    where: { patientId, partage: true },
    orderBy: { date: "desc" },
    select: { id: true, titre: true, type: true, date: true, partageLe: true },
  });
  return bilans.map((b) => ({ ...b, date: jourDe(b.date) }));
}

/** PDF d'un document partagé ; non partagé ou absent : 404. */
export async function exporterBilanPartage(
  prisma: PrismaClient,
  acteur: Acteur,
  patientId: string,
  bilanId: string,
  maintenant = new Date(),
) {
  await patientAutorise(prisma, acteur, patientId, "lire", "documentsPartages");
  const bilan = await prisma.bilan.findFirst({ where: { id: bilanId, patientId, partage: true } });
  if (!bilan) throw erreurs.introuvable();
  const octets = await exporterPdf(await contenuExport(prisma, patientId, bilan), maintenant);
  return { octets, nomFichier: nomFichier(bilan, "pdf") };
}
