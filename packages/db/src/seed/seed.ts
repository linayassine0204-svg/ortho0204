// Remplit la base avec des données FICTIVES pour le développement.
// Aucune personne réelle : prénoms courants, nom de famille « Exemple »,
// e-mails sur le domaine réservé .test (RFC 2606).

import type { PrismaClient } from "../generated/prisma/client.ts";
import { JourSemaine, Ressenti, Role } from "../generated/prisma/enums.ts";
import { contenuProgramme } from "@app/shared";
import { hashPassword } from "../password.ts";
import { CATEGORIES, CONSEILS_MODELES, EXERCICES, type SlugCategorie } from "./bibliotheque.ts";

export const DOMAINE_FICTIF = "exemple.test";
export const SEMAINES_DE_REALISATIONS = 6;

export interface SeedOptions {
  /** Date de référence (« aujourd'hui »). Fixée dans les tests pour des résultats stables. */
  aujourdhui?: Date;
  /** Mot de passe commun des comptes fictifs (variable SEED_PASSWORD). */
  motDePasse: string;
}

export interface SeedResultat {
  cabinetId: string;
  orthoId: string;
  patients: { lea: string; tom: string; adulte: string };
  parents: { lea: string; tomMere: string; tomPere: string };
}

const JOURS_PAR_INDEX: JourSemaine[] = [
  JourSemaine.DIMANCHE,
  JourSemaine.LUNDI,
  JourSemaine.MARDI,
  JourSemaine.MERCREDI,
  JourSemaine.JEUDI,
  JourSemaine.VENDREDI,
  JourSemaine.SAMEDI,
];

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même seed → mêmes données. */
function aleatoire(graine: number): () => number {
  let a = graine;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function debutDeJour(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function moinsJours(date: Date, jours: number): Date {
  return new Date(date.getTime() - jours * JOUR_MS);
}

/** Date de naissance donnant exactement `age` ans à la date de référence. */
function naissance(aujourdhui: Date, age: number): Date {
  const d = moinsJours(aujourdhui, 60);
  return new Date(Date.UTC(d.getUTCFullYear() - age, d.getUTCMonth(), d.getUTCDate()));
}

function email(local: string): string {
  return `${local}@${DOMAINE_FICTIF}`;
}

/** Vide toutes les tables (sauf l'historique des migrations). */
export async function viderBase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const liste = tables.map((t) => `"${t.tablename.replace(/"/g, '""')}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${liste} RESTART IDENTITY CASCADE`);
}

export async function seed(prisma: PrismaClient, options: SeedOptions): Promise<SeedResultat> {
  const aujourdhui = debutDeJour(options.aujourdhui ?? new Date());
  const debutProgrammes = moinsJours(aujourdhui, SEMAINES_DE_REALISATIONS * 7);
  const hash = await hashPassword(options.motDePasse);
  const hasard = aleatoire(20261125);

  await viderBase(prisma);

  // ── Bibliothèque ──
  const categories = new Map<SlugCategorie, string>();
  for (const c of CATEGORIES) {
    const cree = await prisma.categorie.create({ data: { nom: c.nom, slug: c.slug } });
    categories.set(c.slug, cree.id);
  }
  const cat = (slug: SlugCategorie): string => {
    const id = categories.get(slug);
    if (!id) throw new Error(`Catégorie inconnue : ${slug}`);
    return id;
  };

  const exercices = new Map<string, string>();
  const scoreMaxParExercice = new Map<string, number | null>();
  for (const e of EXERCICES) {
    const cree = await prisma.exercice.create({
      data: {
        categorieId: cat(e.categorie),
        titre: e.titre,
        description: e.description,
        ageMin: e.ageMin,
        ageMax: e.ageMax,
        dureeMinutes: e.dureeMinutes,
        materiel: e.materiel,
        apercuConsigne: e.apercuConsigne,
        scoreMax: e.scoreMax ?? null,
        // Exemple non vérifié médicalement : étiquette « à valider par un orthophoniste ».
        aValider: true,
        niveaux: {
          create: e.niveaux.map((consigne, i) => ({ niveau: i + 1, consigne })),
        },
      },
    });
    exercices.set(e.cle, cree.id);
    scoreMaxParExercice.set(cree.id, e.scoreMax ?? null);
  }
  const exo = (cle: string): string => {
    const id = exercices.get(cle);
    if (!id) throw new Error(`Exercice inconnu : ${cle}`);
    return id;
  };

  const modeles = new Map<string, string>();
  for (const c of CONSEILS_MODELES) {
    const cree = await prisma.conseil.create({
      data: {
        titre: c.titre,
        aFaire: c.aFaire,
        aEviter: c.aEviter,
        estModele: true,
        // Exemple non vérifié médicalement : étiquette « à valider par un orthophoniste ».
        aValider: true,
        ageMin: c.ageMin,
        ageMax: c.ageMax,
        etiquettes: { create: c.categories.map((s) => ({ categorieId: cat(s) })) },
      },
    });
    modeles.set(c.cle, cree.id);
  }

  // ── Cabinet et comptes ──
  const cabinet = await prisma.cabinet.create({
    data: { nom: "Cabinet des Tilleuls (fictif)", messagerieActivee: true },
  });
  const compte = (local: string, role: Role, prenom: string) =>
    prisma.user.create({
      data: {
        email: email(local),
        motDePasseHash: hash,
        role,
        prenom,
        nom: "Exemple",
        cabinetId: cabinet.id,
      },
    });

  const ortho = await compte("ortho", Role.ORTHO, "Alice");
  const parentLea = await compte("parent.lea", Role.PARENT, "Julie");
  const mereTom = await compte("mere.tom", Role.PARENT, "Nadia");
  const pereTom = await compte("pere.tom", Role.PARENT, "Marc");
  const compteAdulte = await compte("paul", Role.PATIENT_ADULT, "Paul");

  // ── Patients ──
  const lea = await prisma.patient.create({
    data: {
      cabinetId: cabinet.id,
      prenom: "Léa",
      nom: "Exemple",
      medecinNom: "Dr Martin (fictif)",
      medecinContact: "01 00 00 00 00",
      dateNaissance: naissance(aujourdhui, 7),
      notes: "Patiente fictive. Difficultés de conscience phonologique.",
      pathologies: {
        create: [{ categorieId: cat("langage-ecrit") }, { categorieId: cat("langage-oral") }],
      },
      tuteurs: { create: [{ parentId: parentLea.id }] },
    },
  });
  const tom = await prisma.patient.create({
    data: {
      cabinetId: cabinet.id,
      prenom: "Tom",
      nom: "Exemple",
      dateNaissance: naissance(aujourdhui, 9),
      notes: "Patient fictif. Bégaiement.",
      pathologies: { create: [{ categorieId: cat("begaiement") }] },
      tuteurs: { create: [{ parentId: mereTom.id }, { parentId: pereTom.id }] },
    },
  });
  const adulte = await prisma.patient.create({
    data: {
      cabinetId: cabinet.id,
      prenom: "Paul",
      nom: "Exemple",
      dateNaissance: naissance(aujourdhui, 34),
      notes: "Patient fictif adulte. Fatigue vocale.",
      compteUserId: compteAdulte.id,
      pathologies: { create: [{ categorieId: cat("voix") }] },
      // Exception au réglage du cabinet : pas de messagerie pour ce patient.
      reglage: { create: { messagerieActivee: false } },
    },
  });

  // ── Consentements ──
  // Même version que CONSENTEMENT_DONNEES_SANTE.version (packages/shared). Le père
  // de Tom n'a PAS donné son consentement « données de santé » : il le verra demandé.
  const versionTexte = "2026-11-v1";
  await prisma.consentement.createMany({
    data: [
      { userId: parentLea.id, patientId: lea.id, type: "CONDITIONS_UTILISATION", versionTexte },
      { userId: parentLea.id, patientId: lea.id, type: "DONNEES_SANTE", versionTexte },
      { userId: parentLea.id, patientId: lea.id, type: "MESSAGERIE", versionTexte },
      { userId: mereTom.id, patientId: tom.id, type: "CONDITIONS_UTILISATION", versionTexte },
      { userId: mereTom.id, patientId: tom.id, type: "DONNEES_SANTE", versionTexte },
      { userId: mereTom.id, patientId: tom.id, type: "ENREGISTREMENT_AUDIO", versionTexte },
      { userId: pereTom.id, patientId: tom.id, type: "CONDITIONS_UTILISATION", versionTexte },
      {
        userId: pereTom.id,
        patientId: tom.id,
        type: "MESSAGERIE",
        versionTexte,
        retire: true,
        retireLe: moinsJours(aujourdhui, 10),
      },
      {
        userId: compteAdulte.id,
        patientId: adulte.id,
        type: "CONDITIONS_UTILISATION",
        versionTexte,
      },
      { userId: compteAdulte.id, patientId: adulte.id, type: "DONNEES_SANTE", versionTexte },
    ],
  });

  // ── Programmes (2) ──
  const programmeLea = await prisma.programme.create({
    data: {
      patientId: lea.id,
      auteurId: ortho.id,
      titre: "Sons et syllabes",
      dateDebut: debutProgrammes,
      elements: {
        create: [
          {
            exerciceId: exo("rimes"),
            niveau: 1,
            foisParSemaine: 3,
            jours: [JourSemaine.LUNDI, JourSemaine.MERCREDI, JourSemaine.VENDREDI],
            motFamille: "Faites-le après le goûter, 10 minutes suffisent.",
            ordre: 1,
          },
          {
            exerciceId: exo("syllabes"),
            niveau: 2,
            foisParSemaine: 2,
            jours: [JourSemaine.MARDI, JourSemaine.SAMEDI],
            motFamille: "Transformez-le en jeu, sans pression.",
            ordre: 2,
          },
        ],
      },
    },
    include: { elements: true },
  });
  const programmeTom = await prisma.programme.create({
    data: {
      patientId: tom.id,
      auteurId: ortho.id,
      titre: "Parler en douceur",
      dateDebut: debutProgrammes,
      elements: {
        create: [
          {
            exerciceId: exo("respiration"),
            niveau: 2,
            foisParSemaine: 5,
            jours: [
              JourSemaine.LUNDI,
              JourSemaine.MARDI,
              JourSemaine.MERCREDI,
              JourSemaine.JEUDI,
              JourSemaine.VENDREDI,
            ],
            motFamille: "Le matin avant l'école.",
            ordre: 1,
          },
          {
            exerciceId: exo("parole-lente"),
            niveau: 1,
            foisParSemaine: 2,
            jours: [JourSemaine.MERCREDI, JourSemaine.DIMANCHE],
            ordre: 2,
          },
        ],
      },
    },
    include: { elements: true },
  });

  // ── Envoi des programmes à la famille (version 1, copie figée) ──
  for (const programme of [programmeLea, programmeTom]) {
    const complet = await prisma.programme.findUniqueOrThrow({
      where: { id: programme.id },
      include: {
        elements: {
          include: {
            exercice: { include: { categorie: true, niveaux: true } },
          },
        },
      },
    });
    await prisma.programme.update({
      where: { id: programme.id },
      data: { modifieLe: debutProgrammes },
    });
    await prisma.versionProgramme.create({
      data: {
        programmeId: programme.id,
        numero: 1,
        envoyeLe: debutProgrammes,
        envoyeParId: ortho.id,
        contenu: JSON.parse(JSON.stringify(contenuProgramme(complet.elements))),
      },
    });
  }

  // ── Réalisations sur 6 semaines ──
  const ressentis = [Ressenti.FACILE, Ressenti.MOYEN, Ressenti.DIFFICILE];
  const programmes = [
    { elements: programmeLea.elements, saisiePar: parentLea.id },
    { elements: programmeTom.elements, saisiePar: mereTom.id },
  ];
  const realisations: {
    elementProgrammeId: string;
    saisieParId: string;
    date: Date;
    fait: boolean;
    ressenti: Ressenti | null;
    score: number | null;
    scoreMax: number | null;
    niveau: number;
  }[] = [];
  for (let j = SEMAINES_DE_REALISATIONS * 7; j >= 1; j--) {
    const jour = moinsJours(aujourdhui, j);
    const jourSemaine = JOURS_PAR_INDEX[jour.getUTCDay()];
    for (const { elements, saisiePar } of programmes) {
      for (const element of elements) {
        if (!jourSemaine || !element.jours.includes(jourSemaine)) continue;
        // Progression : un peu plus réussi au fil des semaines.
        const progression = 1 - j / (SEMAINES_DE_REALISATIONS * 7);
        const fait = hasard() < 0.7 + 0.2 * progression;
        const scoreMax = scoreMaxParExercice.get(element.exerciceId) ?? null;
        realisations.push({
          elementProgrammeId: element.id,
          saisieParId: saisiePar,
          date: new Date(jour.getTime() + 18 * 60 * 60 * 1000),
          fait,
          ressenti: fait ? (ressentis[Math.floor(hasard() * 3)] ?? null) : null,
          // Score seulement si l'exercice en prévoit un (ex. 7 sur 10).
          score:
            fait && scoreMax
              ? Math.min(
                  scoreMax,
                  Math.round((0.5 + 0.4 * progression + hasard() * 0.1) * scoreMax),
                )
              : null,
          scoreMax: fait && scoreMax ? scoreMax : null,
          niveau: element.niveau,
        });
      }
    }
  }
  await prisma.realisation.createMany({ data: realisations });

  // Quelques enregistrements audio (fichiers fictifs) sur les dernières réalisations de Tom.
  const dernieres = await prisma.realisation.findMany({
    where: { fait: true, element: { programmeId: programmeTom.id } },
    orderBy: { date: "desc" },
    take: 3,
  });
  await prisma.enregistrement.createMany({
    data: dernieres.map((r, i) => ({
      realisationId: r.id,
      cleStockage: `fictif/audio/tom-${i + 1}.m4a`,
      typeMime: "audio/mp4",
      dureeSecondes: 20 + i * 5,
    })),
  });

  // ── Conseils envoyés ──
  // Chaque envoi porte sur une COPIE propre au patient (texte figé au moment de l'envoi).
  const modele = async (cle: string) => {
    const id = modeles.get(cle);
    if (!id) throw new Error(`Modèle de conseil manquant : ${cle}`);
    return prisma.conseil.findUniqueOrThrow({ where: { id } });
  };
  const lecturePartagee = await modele("lecture-partagee");
  const tempsDeParole = await modele("temps-de-parole");

  // Léa : « Lire ensemble » adapté, ré-envoyé chaque semaine (2 envois, le 1er lu).
  const conseilLea = await prisma.conseil.create({
    data: {
      titre: lecturePartagee.titre,
      aFaire: [...lecturePartagee.aFaire, "Montrez les mots qui riment en fin de ligne."],
      aEviter: lecturePartagee.aEviter,
      aValider: true,
      modifie: true,
      patientId: lea.id,
      cabinetId: cabinet.id,
      modeleSourceId: lecturePartagee.id,
    },
  });
  const debutPlanLea = moinsJours(aujourdhui, 10);
  const planLea = await prisma.planConseil.create({
    data: {
      conseilId: conseilLea.id,
      patientId: lea.id,
      creeParId: ortho.id,
      repetition: "HEBDOMADAIRE",
      prochainEnvoi: new Date(debutPlanLea.getTime() + 14 * JOUR_MS),
    },
  });
  await prisma.envoiConseil.createMany({
    data: [
      {
        conseilId: conseilLea.id,
        patientId: lea.id,
        planId: planLea.id,
        envoyeParId: ortho.id,
        repetition: "HEBDOMADAIRE",
        envoyeLe: debutPlanLea,
        luLe: moinsJours(aujourdhui, 9),
        luParId: parentLea.id,
      },
      {
        conseilId: conseilLea.id,
        patientId: lea.id,
        planId: planLea.id,
        envoyeParId: ortho.id,
        repetition: "HEBDOMADAIRE",
        envoyeLe: new Date(debutPlanLea.getTime() + 7 * JOUR_MS),
      },
    ],
  });

  // Tom : « Laisser le temps de parler » envoyé tel quel, une fois, pas encore lu.
  const conseilTom = await prisma.conseil.create({
    data: {
      titre: tempsDeParole.titre,
      aFaire: tempsDeParole.aFaire,
      aEviter: tempsDeParole.aEviter,
      aValider: true,
      patientId: tom.id,
      cabinetId: cabinet.id,
      modeleSourceId: tempsDeParole.id,
    },
  });
  const planTom = await prisma.planConseil.create({
    data: {
      conseilId: conseilTom.id,
      patientId: tom.id,
      creeParId: ortho.id,
      repetition: "UNE_FOIS",
      prochainEnvoi: null,
    },
  });
  await prisma.envoiConseil.create({
    data: {
      conseilId: conseilTom.id,
      patientId: tom.id,
      planId: planTom.id,
      envoyeParId: ortho.id,
      repetition: "UNE_FOIS",
      envoyeLe: moinsJours(aujourdhui, 5),
    },
  });

  // ── Séances passées (terminées), avec leurs exercices ──
  // Pas de séance en préparation : elle est créée à l'ouverture de « Préparation ».
  const seancesPassees: {
    patientId: string;
    exercices: { cle: string; niveau: number }[];
    notes: string;
    pointsAReprendre: string;
  }[] = [
    {
      patientId: lea.id,
      exercices: [
        { cle: "rimes", niveau: 1 },
        { cle: "syllabes", niveau: 2 },
        { cle: "histoire-images", niveau: 1 },
      ],
      notes: "Notes fictives : bonne attention, rimes encore hésitantes sur les sons proches.",
      pointsAReprendre: "Reprendre les rimes en « -on » / « -an ». Essayer l'histoire en 4 images.",
    },
    {
      patientId: tom.id,
      exercices: [
        { cle: "respiration", niveau: 2 },
        { cle: "parole-lente", niveau: 1 },
      ],
      notes: "Notes fictives : respiration plus régulière, débit encore rapide en fin de séance.",
      pointsAReprendre: "Parole lente sur des phrases plus longues.",
    },
    {
      patientId: adulte.id,
      exercices: [{ cle: "voix-paille", niveau: 1 }],
      notes: "Notes fictives : fatigue vocale moindre en fin de journée.",
      pointsAReprendre: "Ajouter un exercice de sirène vocale.",
    },
  ];
  for (const s of seancesPassees) {
    for (const [i, j] of [35, 21, 7].entries()) {
      const date = new Date(moinsJours(aujourdhui, j).getTime() + 10 * 60 * 60 * 1000);
      const derniere = i === 2;
      await prisma.seance.create({
        data: {
          patientId: s.patientId,
          orthoId: ortho.id,
          date,
          termineeLe: new Date(date.getTime() + 45 * 60 * 1000),
          objectifs: "Objectifs fictifs de séance.",
          notes: derniere ? s.notes : "Notes fictives.",
          pointsAReprendre: derniere ? s.pointsAReprendre : null,
          elements: {
            create: s.exercices.map((e, ordre) => ({
              exerciceId: exo(e.cle),
              niveau: e.niveau,
              ordre: ordre + 1,
              origine: "BIBLIOTHEQUE" as const,
            })),
          },
        },
      });
    }
  }
  // ── Bilans initiaux (déjà écrits). Seul celui de Tom est partagé avec la famille. ──
  for (const p of [lea, tom, adulte]) {
    const partage = p.id === tom.id;
    await prisma.bilan.create({
      data: {
        patientId: p.id,
        auteurId: ortho.id,
        type: "INITIAL",
        titre: "Bilan initial",
        modele: "INITIAL",
        date: moinsJours(aujourdhui, 49),
        sections: [
          {
            cle: "anamnese",
            titre: "Anamnèse",
            type: "LIBRE",
            source: null,
            aide: null,
            contenu: "Anamnèse fictive (données de test).",
            relu: true,
          },
          {
            cle: "conclusion",
            titre: "Conclusion",
            type: "LIBRE",
            source: null,
            aide: null,
            contenu: "Conclusion fictive de bilan initial.",
            relu: true,
          },
        ],
        partage,
        partageLe: partage ? moinsJours(aujourdhui, 48) : null,
        partageParId: partage ? ortho.id : null,
      },
    });
  }

  // ── Messagerie ──
  await prisma.filMessages.create({
    data: {
      patientId: lea.id,
      sujet: "Organisation des exercices",
      messages: {
        create: [
          {
            auteurId: parentLea.id,
            contenu: "Message fictif : peut-on décaler la séance de mercredi ?",
            envoyeLe: moinsJours(aujourdhui, 3),
            luLe: moinsJours(aujourdhui, 2),
          },
          {
            auteurId: ortho.id,
            contenu: "Message fictif : oui, voici la fiche d'exercice en pièce jointe.",
            envoyeLe: moinsJours(aujourdhui, 2),
            piecesJointes: {
              create: [
                {
                  nomFichier: "fiche-rimes.pdf",
                  typeMime: "application/pdf",
                  tailleOctets: 48_000,
                  cleStockage: "fictif/pieces-jointes/fiche-rimes.pdf",
                },
              ],
            },
          },
        ],
      },
    },
  });

  // ── Journal d'accès ──
  await prisma.journalAcces.createMany({
    data: [lea, tom, adulte].map((p, i) => ({
      userId: ortho.id,
      patientId: p.id,
      section: "fiche",
      createdAt: moinsJours(aujourdhui, i + 1),
    })),
  });

  return {
    cabinetId: cabinet.id,
    orthoId: ortho.id,
    patients: { lea: lea.id, tom: tom.id, adulte: adulte.id },
    parents: { lea: parentLea.id, tomMere: mereTom.id, tomPere: pereTom.id },
  };
}
