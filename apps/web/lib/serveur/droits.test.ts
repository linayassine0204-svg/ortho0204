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
};
const dossierAdulte: RessourcePatient = {
  type: "patient",
  cabinetId: "cab-a",
  compteUserId: "adulte-1",
  tuteurIds: [],
  messagerieActivee: true,
};
const section = (r: RessourcePatient, s: RessourcePatient["section"]) => ({ ...r, section: s });

describe("can() — orthophoniste", () => {
  it("voit, modifie et invite pour les patients de son cabinet, toutes sections", () => {
    for (const action of ["lire", "modifier", "supprimer", "inviter"] as const) {
      expect(can(ortho, action, enfant)).toBe(true);
    }
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

  it("ne gère pas le cabinet", () => {
    expect(can(parent, "lire", { type: "cabinet", id: "cab-a" })).toBe(false);
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
