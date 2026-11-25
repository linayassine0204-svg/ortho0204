import { describe, expect, it } from "vitest";
import { createTranslator, messagesFr, t } from "./i18n";

describe("t()", () => {
  it("renvoie le texte d'une clé", () => {
    expect(t("web.accueil.titre")).toBe("Bienvenue");
  });

  it("remplace les références au terme métier", () => {
    expect(t("web.accueil.sousTitre")).toContain("orthophoniste");
    expect(t("web.accueil.sousTitre")).not.toContain("{{");
  });

  it("remplace les paramètres fournis", () => {
    const tr = createTranslator({ salut: "Bonjour {{nom}}" });
    // @ts-expect-error clé de test hors du dictionnaire français
    expect(tr("salut", { nom: "Camille" })).toBe("Bonjour Camille");
  });

  it("renvoie la clé si elle est absente", () => {
    const tr = createTranslator({});
    expect(tr("web.accueil.titre")).toBe("web.accueil.titre");
  });

  it("permet de changer « orthophoniste » en « logopédiste » à un seul endroit", () => {
    const logo = createTranslator({
      ...messagesFr,
      terme: {
        professionnel: "logopédiste",
        professionnelMajuscule: "Logopédiste",
        professionnels: "logopédistes",
        discipline: "logopédie",
      },
    });
    expect(logo("web.accueil.sousTitre")).toBe(
      "Espace logopédiste — projet en cours de préparation.",
    );
    expect(logo("app.nom")).toBe("Suivi en logopédie");
  });

  it("n'écrit le métier en dur nulle part ailleurs que dans `terme`", () => {
    const { terme: _terme, ...rest } = messagesFr;
    expect(JSON.stringify(rest).toLowerCase()).not.toMatch(/orthophon|logop/);
  });
});
