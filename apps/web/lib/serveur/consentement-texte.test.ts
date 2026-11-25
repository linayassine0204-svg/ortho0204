import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { CONSENTEMENT_DONNEES_SANTE, t } from "@app/shared";

describe("texte de consentement versionné", () => {
  it("le texte affiché correspond à la version déclarée", () => {
    const empreinte = createHash("sha256")
      .update(t("consentement.donneesSante.texte"))
      .digest("hex")
      .slice(0, 16);
    // Échec ? Le texte a changé : créez une NOUVELLE version (ex. 2027-01-v2) et
    // mettez à jour `empreinteTexte`. Les consentements déjà donnés gardent leur version.
    expect(empreinte).toBe(CONSENTEMENT_DONNEES_SANTE.empreinteTexte);
  });

  it("le texte ne contient plus de variable non remplacée", () => {
    expect(t("consentement.donneesSante.texte")).not.toContain("{{");
  });
});
