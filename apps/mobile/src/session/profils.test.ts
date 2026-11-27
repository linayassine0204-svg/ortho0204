import { describe, expect, it } from "vitest";
import { destinationApresConnexion, profilDe } from "./profils";

const lea = { id: "p-lea", prenom: "Léa", messagerieActivee: true };

describe("après la connexion", () => {
  it("un parent choisit qui fait les exercices (même avec un seul enfant)", () => {
    expect(destinationApresConnexion("PARENT", [lea])).toEqual({ ecran: "choixProfil" });
    expect(destinationApresConnexion("PARENT", [])).toEqual({ ecran: "choixProfil" });
  });

  it("un patient adulte arrive directement sur son programme", () => {
    const paul = { id: "p-paul", prenom: "Paul", messagerieActivee: false };
    expect(destinationApresConnexion("PATIENT_ADULT", [paul])).toEqual({
      ecran: "programme",
      profil: { patientId: "p-paul", prenom: "Paul", messagerieActivee: false },
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
