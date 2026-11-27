import { describe, expect, it } from "vitest";
import { fauxServeur, MOT_DE_PASSE, programmeLea, VENDREDI } from "../../test/fixtures";
import { creerClientApi } from "../api/client";
import { creerCacheChiffre, stockageMemoire } from "./cache";
import { coffreMemoire } from "./coffre";
import { chargerProgramme, cleCacheProgramme, exercicesDuJour } from "./programme";

async function monter() {
  const serveur = fauxServeur();
  const coffre = coffreMemoire();
  const client = creerClientApi({ baseUrl: "https://x.test/api", coffre, fetch: serveur.fetch });
  const cache = creerCacheChiffre({
    coffre,
    stockage: stockageMemoire(),
    aleatoire: (n) => crypto.getRandomValues(new Uint8Array(n)),
  });
  await client.connexion("parent.lea@exemple.test", MOT_DE_PASSE);
  return { serveur, client, cache };
}

describe("chargement du programme et cache hors ligne", () => {
  it("avec réseau : programme à jour, demandé pour la date du jour (Paris)", async () => {
    const { client, cache, serveur } = await monter();
    const r = await chargerProgramme(client, cache, "p-lea", VENDREDI);
    expect(r).toEqual({ etat: "ok", programme: programmeLea, horsLigne: false });
    expect(serveur.etat.appels).toContain("GET /patients/p-lea/programme/semaine");
  });

  it("sans réseau : le dernier programme enregistré s'affiche, avec sa date", async () => {
    const { client, cache, serveur } = await monter();
    await chargerProgramme(client, cache, "p-lea", VENDREDI);
    serveur.etat.horsLigne = true;
    const r = await chargerProgramme(client, cache, "p-lea", new Date("2026-11-29T09:00:00Z"));
    expect(r).toEqual({
      etat: "ok",
      programme: programmeLea,
      horsLigne: true,
      enregistreLe: VENDREDI.toISOString(),
    });
  });

  it("sans réseau et sans copie : état dédié", async () => {
    const { client, cache, serveur } = await monter();
    serveur.etat.horsLigne = true;
    expect(await chargerProgramme(client, cache, "p-lea")).toEqual({ etat: "horsLigneSansCache" });
  });

  it("accès retiré (404) : la copie locale est effacée", async () => {
    const { client, cache } = await monter();
    await cache.enregistrer(cleCacheProgramme("p-autre"), { programme: programmeLea });
    const r = await chargerProgramme(client, cache, "p-autre");
    expect(r.etat).toBe("erreur");
    expect(await cache.lire(cleCacheProgramme("p-autre"))).toBeNull();
  });

  it("consentement manquant (403) : état dédié", async () => {
    const { client, cache } = await monter();
    expect(await chargerProgramme(client, cache, "p-sacha")).toEqual({
      etat: "consentementRequis",
    });
  });

  it("session expirée (401) : l'erreur remonte", async () => {
    const { client, cache, serveur } = await monter();
    serveur.sessions.clear();
    await client.deconnexion();
    await expect(chargerProgramme(client, cache, "p-lea")).rejects.toMatchObject({ status: 401 });
  });
});

describe("exercices du jour", () => {
  it("vendredi : les exercices du vendredi, puis ceux à placer dans la semaine", () => {
    const plan = exercicesDuJour(programmeLea, VENDREDI);
    expect(plan.jour).toBe("VENDREDI");
    expect(plan.elements.map((e) => e.titre)).toEqual(["Trouver les rimes"]);
    expect(plan.sansJourFixe.map((e) => e.titre)).toEqual(["Lecture partagée"]);
  });

  it("le jour est celui de Paris (23 h 30 UTC un vendredi = samedi à Paris)", () => {
    const plan = exercicesDuJour(programmeLea, new Date("2026-11-27T23:30:00Z"));
    expect(plan.jour).toBe("SAMEDI");
    expect(plan.elements.map((e) => e.titre)).toEqual(["Compter les syllabes"]);
  });

  it("pas de programme : listes vides", () => {
    expect(exercicesDuJour(null, VENDREDI).elements).toEqual([]);
  });
});
