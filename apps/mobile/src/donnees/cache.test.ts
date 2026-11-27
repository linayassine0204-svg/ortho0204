import { describe, expect, it } from "vitest";
import { coffreMemoire } from "./coffre";
import { creerCacheChiffre, stockageMemoire } from "./cache";

const aleatoire = (n: number) => crypto.getRandomValues(new Uint8Array(n));

function monter() {
  const coffre = coffreMemoire();
  const stockage = stockageMemoire();
  return { coffre, stockage, cache: creerCacheChiffre({ coffre, stockage, aleatoire }) };
}

describe("cache hors ligne chiffré", () => {
  it("relit ce qui a été enregistré", async () => {
    const { cache } = monter();
    await cache.enregistrer("programme.p1", { titre: "Sons et syllabes", n: 2 });
    expect(await cache.lire("programme.p1")).toEqual({ titre: "Sons et syllabes", n: 2 });
    expect(await cache.lire("absent")).toBeNull();
  });

  it("n'écrit jamais le contenu en clair ; la clé est dans le coffre-fort", async () => {
    const { cache, stockage, coffre } = monter();
    await cache.enregistrer("programme.p1", { prenom: "Léa", mot: "Après le goûter" });
    const brut = [...stockage.contenu.values()].join("");
    expect(brut).not.toContain("Léa");
    expect(brut).not.toContain("goûter");
    expect(coffre.contenu.has("cache.cle")).toBe(true);
    expect([...stockage.contenu.values()].join("")).not.toContain(coffre.contenu.get("cache.cle"));
  });

  it("rejette un contenu modifié ou déplacé sous un autre nom", async () => {
    const { cache, stockage } = monter();
    await cache.enregistrer("a", { x: 1 });
    const brut = stockage.contenu.get("cache.v1.a") as string;
    stockage.contenu.set("cache.v1.b", brut);
    expect(await cache.lire("b")).toBeNull();
    stockage.contenu.set("cache.v1.a", brut.slice(0, -2) + (brut.endsWith("00") ? "11" : "00"));
    expect(await cache.lire("a")).toBeNull();
  });

  it("tout effacer supprime le contenu et la clé", async () => {
    const { cache, stockage, coffre } = monter();
    await cache.enregistrer("a", 1);
    await stockage.setItem("autre.application", "garde");
    await cache.toutEffacer();
    expect(await cache.lire("a")).toBeNull();
    expect(coffre.contenu.size).toBe(0);
    expect([...stockage.contenu.keys()]).toEqual(["autre.application"]);
  });
});
