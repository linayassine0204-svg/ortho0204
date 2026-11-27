import { describe, expect, it } from "vitest";
import { ageEnAnnees, destinationApresConnexion, estModeEnfant, profilDe } from "./profils";

const lea = {
  id: "p-lea",
  prenom: "Léa",
  messagerieActivee: true,
  accordAudio: false,
  modeEnfant: true,
};

describe("après la connexion", () => {
  it("un parent choisit qui fait les exercices (même avec un seul enfant)", () => {
    expect(destinationApresConnexion("PARENT", [lea])).toEqual({ ecran: "choixProfil" });
    expect(destinationApresConnexion("PARENT", [])).toEqual({ ecran: "choixProfil" });
  });

  it("un patient adulte arrive directement sur son programme", () => {
    const paul = {
      id: "p-paul",
      prenom: "Paul",
      messagerieActivee: false,
      accordAudio: true,
      modeEnfant: false,
    };
    expect(destinationApresConnexion("PATIENT_ADULT", [paul])).toEqual({
      ecran: "programme",
      profil: {
        patientId: "p-paul",
        prenom: "Paul",
        messagerieActivee: false,
        accordAudio: true,
        modeEnfant: false,
      },
    });
  });

  it("un patient adulte sans dossier (ou sans consentement) n'a pas de programme", () => {
    expect(destinationApresConnexion("PATIENT_ADULT", [])).toEqual({ ecran: "aucunDossier" });
    expect(
      destinationApresConnexion("PATIENT_ADULT", [
        { id: "p", prenom: "Paul", consentementRequis: true },
      ]),
    ).toEqual({ ecran: "aucunDossier" });
  });

  it("un compte orthophoniste est renvoyé vers le logiciel web", () => {
    expect(destinationApresConnexion("ORTHO", [])).toEqual({ ecran: "reserveeFamilles" });
  });

  it("un enfant sans consentement ne peut pas être choisi", () => {
    expect(profilDe({ id: "p", prenom: "Sacha", consentementRequis: true })).toBeNull();
    expect(profilDe(lea)?.patientId).toBe("p-lea");
  });
});

describe("mode enfant", () => {
  const le = new Date("2026-11-27T10:00:00Z");

  it("âge en années révolues (anniversaire passé ou non)", () => {
    expect(ageEnAnnees("2019-09-28", le)).toBe(7);
    expect(ageEnAnnees("2011-11-28", le)).toBe(14);
    expect(ageEnAnnees("2011-11-27", le)).toBe(15);
  });

  it("enfant de moins de 15 ans avec le compte du parent : mode enfant", () => {
    expect(estModeEnfant("PARENT", "2019-09-28", le)).toBe(true);
    expect(estModeEnfant("PARENT", "2011-11-28", le)).toBe(true);
  });

  it("15 ans et plus, ou patient avec son propre compte : vue adulte", () => {
    expect(estModeEnfant("PARENT", "2011-11-27", le)).toBe(false);
    expect(estModeEnfant("PATIENT_ADULT", "2010-01-01", le)).toBe(false);
  });
});
