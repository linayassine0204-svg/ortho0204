import { describe, expect, it } from "vitest";
import { ongletActif, ongletsVisibles } from "./onglets";

describe("onglet Messages visible ou non", () => {
  it("messagerie activée pour le patient : Aujourd'hui, Conseils et Messages", () => {
    expect(ongletsVisibles({ messagerieActivee: true })).toEqual([
      "aujourdhui",
      "conseils",
      "messages",
    ]);
  });

  it("messagerie désactivée : l'onglet Messages est absent", () => {
    const onglets = ongletsVisibles({ messagerieActivee: false });
    expect(onglets).toEqual(["aujourdhui", "conseils"]);
    expect(onglets).not.toContain("messages");
  });

  it("patient adulte : pas d'onglet Conseils (réservés aux parents)", () => {
    expect(ongletsVisibles({ messagerieActivee: true, role: "PATIENT_ADULT" })).toEqual([
      "aujourdhui",
      "messages",
    ]);
    expect(ongletsVisibles({ messagerieActivee: false, role: "PATIENT_ADULT" })).toEqual([
      "aujourdhui",
    ]);
  });

  it("si l'onglet ouvert disparaît (messagerie coupée), retour sur Aujourd'hui", () => {
    expect(ongletActif("messages", ongletsVisibles({ messagerieActivee: false }))).toBe(
      "aujourdhui",
    );
    expect(ongletActif("conseils", ongletsVisibles({ messagerieActivee: false }))).toBe("conseils");
  });
});
