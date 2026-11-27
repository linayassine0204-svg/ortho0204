import { describe, expect, it } from "vitest";
import { fauxServeur, MOT_DE_PASSE, VENDREDI } from "../../test/fixtures";
import { creerClientApi } from "../api/client";
import { creerCacheChiffre, stockageMemoire } from "./cache";
import { coffreMemoire } from "./coffre";
import { creerServiceRealisations } from "./realisations";

async function monter(
  email = "parent.lea@exemple.test",
  envelopper: (f: typeof fetch) => typeof fetch = (f) => f,
) {
  const serveur = fauxServeur();
  const coffre = coffreMemoire();
  const stockage = stockageMemoire();
  const client = creerClientApi({
    baseUrl: "https://x.test/api",
    coffre,
    fetch: envelopper(serveur.fetch),
  });
  const cache = creerCacheChiffre({
    coffre,
    stockage,
    aleatoire: (n) => crypto.getRandomValues(new Uint8Array(n)),
  });
  const supprimes: string[] = [];
  const service = creerServiceRealisations({
    client,
    cache,
    uuid: () => crypto.randomUUID(),
    supprimerFichier: async (uri) => {
      supprimes.push(uri);
    },
    maintenant: () => VENDREDI,
  });
  await client.connexion(email, MOT_DE_PASSE);
  return { serveur, service, stockage, supprimes };
}

const saisie = {
  patientId: "p-lea",
  elementId: "el-rimes",
  ressenti: "MOYEN" as const,
  score: 7,
  audio: null,
};

describe("réalisations : téléphone d'abord, serveur ensuite", () => {
  it("avec réseau : envoyée tout de suite, rien ne reste en attente", async () => {
    const { serveur, service } = await monter();
    expect(await service.enregistrer(saisie)).toEqual({ envoyee: true });
    expect(serveur.etat.realisations).toHaveLength(1);
    expect(await service.enAttente()).toBe(0);
    expect(await service.faits("p-lea")).toEqual([{ elementId: "el-rimes", date: "2026-11-27" }]);
  });

  it("hors ligne puis synchro : envoyée une seule fois, même avec plusieurs synchros", async () => {
    const { serveur, service, stockage } = await monter();
    serveur.etat.horsLigne = true;
    expect(await service.enregistrer(saisie)).toEqual({ envoyee: false });
    expect(await service.enAttente()).toBe(1);
    // Gardée chiffrée sur le téléphone.
    expect([...stockage.contenu.values()].join("")).not.toContain("el-rimes");
    expect((await service.synchroniser()).arret).toBe("reseau");

    serveur.etat.horsLigne = false;
    const [a, b, c] = await Promise.all([
      service.synchroniser(),
      service.synchroniser(),
      service.synchroniser(),
    ]);
    // Les synchros simultanées n'en font qu'une (même résultat partagé).
    expect(a.envoyees).toBe(1);
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(await service.synchroniser()).toMatchObject({ envoyees: 0, restantes: 0 });
    expect(serveur.etat.realisations).toHaveLength(1);
    expect(serveur.etat.realisations[0]).toMatchObject({ ressenti: "MOYEN", score: 7 });
  });

  it("réponse perdue (le serveur a enregistré, le téléphone ne le sait pas) : pas de doublon", async () => {
    const { serveur, service } = await monter();
    serveur.etat.perdreLaReponse = true;
    expect(await service.enregistrer(saisie)).toEqual({ envoyee: false });
    expect(serveur.etat.realisations).toHaveLength(1);
    expect(await service.synchroniser()).toMatchObject({ envoyees: 1, restantes: 0 });
    expect(serveur.etat.realisations).toHaveLength(1);
  });

  it("plusieurs réalisations hors ligne : toutes envoyées, dans l'ordre", async () => {
    const { serveur, service } = await monter();
    serveur.etat.horsLigne = true;
    await service.enregistrer(saisie);
    await service.enregistrer({ ...saisie, elementId: "el-libre", score: null });
    serveur.etat.horsLigne = false;
    expect(await service.synchroniser()).toMatchObject({ envoyees: 2, restantes: 0 });
    expect(serveur.etat.realisations.map((r) => r.elementId)).toEqual(["el-rimes", "el-libre"]);
  });

  it("refus définitif (accès retiré) : abandonnée, sa voix locale supprimée, la file continue", async () => {
    const { serveur, service, supprimes } = await monter();
    serveur.etat.horsLigne = true;
    await service.enregistrer({
      ...saisie,
      elementId: "el-inconnu",
      audio: { uri: "file:///voix/a.m4a", dureeSecondes: 3 },
    });
    await service.enregistrer(saisie);
    serveur.etat.horsLigne = false;
    expect(await service.synchroniser()).toMatchObject({
      envoyees: 1,
      abandonnees: 1,
      restantes: 0,
    });
    expect(supprimes).toEqual(["file:///voix/a.m4a"]);
  });

  it("voix : envoyée après la réalisation, puis supprimée du téléphone", async () => {
    const { serveur, service, supprimes } = await monter();
    serveur.etat.accordsAudio.add("u-julie:p-lea");
    await service.enregistrer({
      ...saisie,
      audio: { uri: "file:///voix/b.m4a", dureeSecondes: 4 },
    });
    expect(serveur.etat.realisations[0]?.voix).toBe(1);
    expect(supprimes).toEqual(["file:///voix/b.m4a"]);
  });

  it("voix refusée (accord retiré) : la réalisation reste enregistrée", async () => {
    const { serveur, service } = await monter();
    const r = await service.enregistrer({
      ...saisie,
      audio: { uri: "file:///voix/c.m4a", dureeSecondes: 4 },
    });
    expect(r.envoyee).toBe(true);
    expect(serveur.etat.realisations).toHaveLength(1);
    expect(serveur.etat.realisations[0]?.voix).toBe(0);
  });

  it("coupure pendant l'envoi de la voix : seule la voix est renvoyée ensuite", async () => {
    let couperVoix = true;
    const { serveur, service, supprimes } = await monter(
      "parent.lea@exemple.test",
      (f) =>
        (async (u: RequestInfo | URL, i?: RequestInit) => {
          if (String(u).endsWith("/enregistrement") && couperVoix) {
            throw new TypeError("Network request failed");
          }
          return f(u, i);
        }) as typeof fetch,
    );
    serveur.etat.accordsAudio.add("u-julie:p-lea");
    const audio = { uri: "file:///voix/d.m4a", dureeSecondes: 4 };
    expect(await service.enregistrer({ ...saisie, audio })).toEqual({ envoyee: false });
    expect(serveur.etat.realisations).toHaveLength(1);
    expect(supprimes).toEqual([]);

    couperVoix = false;
    expect(await service.synchroniser()).toMatchObject({ envoyees: 1, restantes: 0 });
    expect(serveur.etat.realisations).toHaveLength(1);
    expect(serveur.etat.realisations[0]?.voix).toBe(1);
    expect(supprimes).toEqual(["file:///voix/d.m4a"]);
  });
});
