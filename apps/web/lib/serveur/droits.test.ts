import { describe, expect, it } from "vitest";
import { can, SECTIONS_PATIENT, type Acteur, type RessourcePatient } from "./droits";

const ortho: Acteur = { id: "ortho-a", role: "ORTHO", cabinetId: "cab-a" };
const orthoAutreCabinet: Acteur = { id: "ortho-b", role: "ORTHO", cabinetId: "cab-b" };
const parent: Acteur = { id: "parent-1", role: "PARENT", cabinetId: "cab-a" };
const autreParent: Acteur = { id: "parent-2", role: "PARENT", cabinetId: "cab-a" };
const adulte: Acteur = { id: "adulte-1", role: "PATIENT_ADULT", cabinetId: "cab-a" };
const autreAdulte: Acteur = { id: "adulte-2", role: "PATIENT_ADULT", cabinetId: "cab-a" };

const enfant: RessourcePatient = {
  type: "patient",
  cabinetId: "cab-a",
  compteUserId: null,
  tuteurIds: ["parent-1"],
  messagerieActivee: true,
  consentementIds: ["parent-1"],
};
const dossierAdulte: RessourcePatient = {
  type: "patient",
  cabinetId: "cab-a",
  compteUserId: "adulte-1",
  tuteurIds: [],
  messagerieActivee: true,
  consentementIds: ["adulte-1"],
};
const section = (r: RessourcePatient, s: RessourcePatient["section"]) => ({ ...r, section: s });

describe("can() — orthophoniste", () => {
  it("voit, modifie et invite pour les patients de son cabinet, toutes sections", () => {
    for (const action of ["lire", "modifier", "supprimer", "inviter"] as const) {
      expect(can(ortho, action, enfant)).toBe(true);
    }
    // Même sans aucun consentement famille : le consentement concerne l'envoi aux familles.
    expect(can(ortho, "lire", { ...enfant, consentementIds: [] })).toBe(true);
    for (const s of SECTIONS_PATIENT) expect(can(ortho, "lire", section(enfant, s))).toBe(true);
  });

  it("ne voit PAS les patients d'un autre cabinet", () => {
    for (const action of ["lire", "modifier", "supprimer", "inviter"] as const) {
      expect(can(orthoAutreCabinet, action, enfant)).toBe(false);
      expect(can(orthoAutreCabinet, action, dossierAdulte)).toBe(false);
    }
  });

  it("gère son propre cabinet, pas celui d'un autre", () => {
    expect(can(ortho, "modifier", { type: "cabinet", id: "cab-a" })).toBe(true);
    expect(can(ortho, "lire", { type: "cabinet", id: "cab-b" })).toBe(false);
  });

  it("crée des patients dans son cabinet, pas dans un autre", () => {
    expect(can(ortho, "creer", { type: "cabinet", id: "cab-a" })).toBe(true);
    expect(can(ortho, "creer", { type: "cabinet", id: "cab-b" })).toBe(false);
  });

  it("ne peut pas consentir à la place de la famille", () => {
    expect(can(ortho, "consentir", enfant)).toBe(false);
  });
});

describe("can() — parent", () => {
  it("voit son enfant", () => {
    expect(can(parent, "lire", enfant)).toBe(true);
  });

  it("ne voit PAS l'enfant d'un autre parent", () => {
    expect(can(autreParent, "lire", enfant)).toBe(false);
    expect(can(autreParent, "lire", section(enfant, "programme"))).toBe(false);
  });

  it("ne voit PAS le dossier d'un patient adulte", () => {
    expect(can(parent, "lire", dossierAdulte)).toBe(false);
  });

  it("ne voit PAS son enfant si le dossier est dans un autre cabinet (cloison)", () => {
    expect(can(parent, "lire", { ...enfant, cabinetId: "cab-b" })).toBe(false);
  });

  it("voit programme, conseils, messagerie et suivi, mais pas fiche, préparation ni bilans", () => {
    for (const s of ["programme", "conseils", "messagerie", "suivi"] as const) {
      expect(can(parent, "lire", section(enfant, s))).toBe(true);
    }
    for (const s of ["fiche", "preparation", "bilans"] as const) {
      expect(can(parent, "lire", section(enfant, s))).toBe(false);
    }
  });

  it("ne peut ni modifier, ni supprimer, ni inviter", () => {
    for (const action of ["modifier", "supprimer", "inviter"] as const) {
      expect(can(parent, action, enfant)).toBe(false);
    }
  });

  it("ne gère pas le cabinet et ne crée pas de patient", () => {
    expect(can(parent, "lire", { type: "cabinet", id: "cab-a" })).toBe(false);
    expect(can(parent, "creer", { type: "cabinet", id: "cab-a" })).toBe(false);
  });
});

describe("can() — patient adulte", () => {
  it("voit son propre dossier", () => {
    expect(can(adulte, "lire", dossierAdulte)).toBe(true);
  });

  it("ne voit PAS le dossier d'un autre patient", () => {
    expect(can(autreAdulte, "lire", dossierAdulte)).toBe(false);
    expect(can(adulte, "lire", enfant)).toBe(false);
  });

  it("voit programme et messagerie seulement", () => {
    expect(can(adulte, "lire", section(dossierAdulte, "programme"))).toBe(true);
    expect(can(adulte, "lire", section(dossierAdulte, "messagerie"))).toBe(true);
    for (const s of ["fiche", "preparation", "bilans", "conseils", "suivi"] as const) {
      expect(can(adulte, "lire", section(dossierAdulte, s))).toBe(false);
    }
  });

  it("ne peut pas modifier son dossier", () => {
    expect(can(adulte, "modifier", dossierAdulte)).toBe(false);
  });
});

describe("can() — consentement de la famille", () => {
  const sansConsentement = { ...enfant, consentementIds: [] };

  it("sans consentement, le parent ne reçoit AUCUNE donnée de son enfant", () => {
    expect(can(parent, "lire", sansConsentement)).toBe(false);
    for (const s of ["programme", "conseils", "messagerie", "suivi"] as const) {
      expect(can(parent, "lire", section(sansConsentement, s))).toBe(false);
    }
  });

  it("le parent peut donner son consentement pour son enfant", () => {
    expect(can(parent, "consentir", sansConsentement)).toBe(true);
  });

  it("le consentement d'un autre parent ne suffit pas", () => {
    const consentDeLAutre = {
      ...enfant,
      tuteurIds: ["parent-1", "parent-2"],
      consentementIds: ["parent-2"],
    };
    expect(can(parent, "lire", consentDeLAutre)).toBe(false);
    expect(can(autreParent, "lire", consentDeLAutre)).toBe(true);
  });

  it("ÉCHEC : un parent ne consent pas pour l'enfant d'un autre", () => {
    expect(can(autreParent, "consentir", enfant)).toBe(false);
  });

  it("l'adulte donne son propre consentement ; sans lui, rien", () => {
    const sansAdulte = { ...dossierAdulte, consentementIds: [] };
    expect(can(adulte, "lire", sansAdulte)).toBe(false);
    expect(can(adulte, "consentir", sansAdulte)).toBe(true);
    expect(can(autreAdulte, "consentir", sansAdulte)).toBe(false);
  });
});

describe("can() — faire un exercice du programme (réalisation)", () => {
  const programme = (r: RessourcePatient) => section(r, "programme");

  it("le parent relié, avec son consentement, peut enregistrer une réalisation", () => {
    expect(can(parent, "realiser", programme(enfant))).toBe(true);
  });

  it("le patient adulte, pour son propre programme", () => {
    expect(can(adulte, "realiser", programme(dossierAdulte))).toBe(true);
  });

  it("ÉCHEC : un autre parent, un autre patient, un autre cabinet", () => {
    expect(can(autreParent, "realiser", programme(enfant))).toBe(false);
    expect(can(autreAdulte, "realiser", programme(dossierAdulte))).toBe(false);
    expect(can(adulte, "realiser", programme(enfant))).toBe(false);
    expect(can(parent, "realiser", programme({ ...enfant, cabinetId: "cab-b" }))).toBe(false);
  });

  it("ÉCHEC : sans consentement, hors du programme, ou pour l'orthophoniste", () => {
    expect(can(parent, "realiser", programme({ ...enfant, consentementIds: [] }))).toBe(false);
    expect(can(parent, "realiser", enfant)).toBe(false);
    expect(can(parent, "realiser", section(enfant, "suivi"))).toBe(false);
    expect(can(ortho, "realiser", programme(enfant))).toBe(false);
  });
});

describe("can() — conseils (lecture et « J'ai compris »)", () => {
  const conseils = (r: RessourcePatient) => section(r, "conseils");

  it("l'orthophoniste du cabinet lit et envoie les conseils", () => {
    expect(can(ortho, "lire", conseils(enfant))).toBe(true);
    expect(can(ortho, "modifier", conseils(enfant))).toBe(true);
    expect(can(orthoAutreCabinet, "lire", conseils(enfant))).toBe(false);
    expect(can(orthoAutreCabinet, "modifier", conseils(enfant))).toBe(false);
  });

  it("le parent relié, avec son consentement, lit et marque « J'ai compris »", () => {
    expect(can(parent, "lire", conseils(enfant))).toBe(true);
    expect(can(parent, "confirmerLecture", conseils(enfant))).toBe(true);
  });

  it("ÉCHEC : le parent ne peut pas envoyer ni modifier un conseil", () => {
    expect(can(parent, "modifier", conseils(enfant))).toBe(false);
  });

  it("ÉCHEC : un autre parent, sans consentement, un autre cabinet, hors des conseils", () => {
    expect(can(autreParent, "confirmerLecture", conseils(enfant))).toBe(false);
    expect(can(parent, "confirmerLecture", conseils({ ...enfant, consentementIds: [] }))).toBe(
      false,
    );
    expect(can(parent, "confirmerLecture", conseils({ ...enfant, cabinetId: "cab-b" }))).toBe(
      false,
    );
    expect(can(parent, "confirmerLecture", section(enfant, "programme"))).toBe(false);
    expect(can(parent, "confirmerLecture", enfant)).toBe(false);
  });

  it("ÉCHEC : le patient adulte ne voit pas les conseils (réservés aux parents)", () => {
    expect(can(adulte, "lire", conseils(dossierAdulte))).toBe(false);
    expect(can(adulte, "confirmerLecture", conseils(dossierAdulte))).toBe(false);
  });

  it("ÉCHEC : l'orthophoniste ne marque pas un conseil comme lu à la place de la famille", () => {
    expect(can(ortho, "confirmerLecture", conseils(enfant))).toBe(false);
  });
});

describe("can() — messagerie désactivée", () => {
  it("refuse la messagerie à tout le monde, y compris l'orthophoniste", () => {
    const sansMessagerie = { ...enfant, messagerieActivee: false, section: "messagerie" as const };
    expect(can(ortho, "lire", sansMessagerie)).toBe(false);
    expect(can(parent, "lire", sansMessagerie)).toBe(false);
  });

  it("laisse le reste du dossier accessible", () => {
    expect(can(parent, "lire", { ...enfant, messagerieActivee: false, section: "programme" })).toBe(
      true,
    );
  });
});

describe("can() — refus par défaut", () => {
  it("refuse un rôle inconnu", () => {
    const inconnu = { id: "x", role: "ADMIN", cabinetId: "cab-a" } as unknown as Acteur;
    expect(can(inconnu, "lire", enfant)).toBe(false);
  });

  it("refuse un type de ressource inconnu", () => {
    // @ts-expect-error ressource hors du modèle
    expect(can(ortho, "lire", { type: "facture", id: "1" })).toBe(false);
  });
});

describe("can() — exercices de la bibliothèque", () => {
  const commun = { type: "exercice" as const, cabinetId: null };
  const duCabinet = { type: "exercice" as const, cabinetId: "cab-a" };
  const dAilleurs = { type: "exercice" as const, cabinetId: "cab-b" };

  it("l'orthophoniste lit les exercices communs et ceux de son cabinet", () => {
    expect(can(ortho, "lire", commun)).toBe(true);
    expect(can(ortho, "lire", duCabinet)).toBe(true);
  });

  it("ÉCHEC : il ne voit pas les exercices d'un autre cabinet", () => {
    expect(can(ortho, "lire", dAilleurs)).toBe(false);
    expect(can(ortho, "modifier", dAilleurs)).toBe(false);
    expect(can(ortho, "supprimer", dAilleurs)).toBe(false);
  });

  it("il modifie et supprime ses exercices, jamais les exercices communs", () => {
    expect(can(ortho, "modifier", duCabinet)).toBe(true);
    expect(can(ortho, "supprimer", duCabinet)).toBe(true);
    expect(can(ortho, "modifier", commun)).toBe(false);
    expect(can(ortho, "supprimer", commun)).toBe(false);
  });

  it("les familles n'accèdent pas à la bibliothèque", () => {
    expect(can(parent, "lire", commun)).toBe(false);
    expect(can(adulte, "lire", commun)).toBe(false);
  });
});
