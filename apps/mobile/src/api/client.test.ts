import { describe, expect, it } from "vitest";
import { fauxServeur, MOT_DE_PASSE } from "../../test/fixtures";
import { coffreMemoire } from "../donnees/coffre";
import { creerClientApi, ErreurApi, ErreurReseau } from "./client";

function monter(maintenant = () => 1_000_000) {
  const serveur = fauxServeur();
  const coffre = coffreMemoire();
  const client = creerClientApi({
    baseUrl: "https://api.exemple.test/api",
    coffre,
    fetch: serveur.fetch,
    maintenant,
  });
  return { serveur, coffre, client };
}

const parent = { email: "parent.lea@exemple.test" };

describe("client API mobile", () => {
  it("la connexion range les jetons dans le coffre-fort du téléphone", async () => {
    const { client, coffre } = monter();
    expect(await client.estConnecte()).toBe(false);
    await client.connexion(parent.email, MOT_DE_PASSE);
    expect(await client.estConnecte()).toBe(true);
    const ranges = JSON.parse(coffre.contenu.get("session.jetons") as string);
    expect(ranges.acces).toMatch(/^acces-/);
    expect(ranges.renouvellement).toMatch(/^renouv-/);
  });

  it("mauvais mot de passe : erreur de l'API, aucun jeton", async () => {
    const { client, coffre } = monter();
    await expect(client.connexion(parent.email, "faux")).rejects.toBeInstanceOf(ErreurApi);
    expect(coffre.contenu.size).toBe(0);
  });

  it("envoie le jeton d'accès dans l'en-tête Authorization", async () => {
    const { client } = monter();
    await client.connexion(parent.email, MOT_DE_PASSE);
    const r = await client.get<{ utilisateur: { prenom: string } }>("/auth/moi");
    expect(r.utilisateur.prenom).toBe("Julie");
  });

  it("jeton refusé : un seul renouvellement, même pour des requêtes simultanées", async () => {
    const { client, serveur } = monter();
    await client.connexion(parent.email, MOT_DE_PASSE);
    serveur.sessions.clear(); // le jeton d'accès n'est plus reconnu
    const [a, b] = await Promise.all([client.get("/auth/moi"), client.get("/patients")]);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    const renouvellements = serveur.etat.appels.filter((x) => x.includes("renouvellement"));
    expect(renouvellements).toHaveLength(1);
  });

  it("jeton expiré : renouvelé avant l'appel", async () => {
    let maintenant = 1_000_000;
    const { client, serveur } = monter(() => maintenant);
    await client.connexion(parent.email, MOT_DE_PASSE);
    maintenant += 16 * 60 * 1000;
    await client.get("/auth/moi");
    expect(serveur.etat.appels).toContain("POST /auth/mobile/renouvellement");
  });

  it("renouvellement refusé : jetons effacés, erreur 401", async () => {
    const { client, serveur, coffre } = monter();
    await client.connexion(parent.email, MOT_DE_PASSE);
    coffre.contenu.set(
      "session.jetons",
      JSON.stringify({ acces: "x", renouvellement: "volé", expireLe: 0 }),
    );
    await expect(client.get("/auth/moi")).rejects.toMatchObject({ status: 401 });
    expect(coffre.contenu.has("session.jetons")).toBe(false);
    expect(serveur.etat.appels).not.toContain("GET /auth/moi");
  });

  it("sans réseau : ErreurReseau, et les jetons sont gardés", async () => {
    const { client, serveur } = monter();
    await client.connexion(parent.email, MOT_DE_PASSE);
    serveur.etat.horsLigne = true;
    await expect(client.get("/auth/moi")).rejects.toBeInstanceOf(ErreurReseau);
    expect(await client.estConnecte()).toBe(true);
  });

  it("la déconnexion révoque la session et efface les jetons", async () => {
    const { client, serveur } = monter();
    await client.connexion(parent.email, MOT_DE_PASSE);
    await client.deconnexion();
    expect(await client.estConnecte()).toBe(false);
    expect(serveur.etat.appels).toContain("POST /auth/deconnexion");
  });

  it("serveur qui ne répond pas : abandon après le délai maximal (ErreurReseau)", async () => {
    const jamais = (_u: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, refuser) => {
        init?.signal?.addEventListener("abort", () => refuser(new Error("abandon")));
      });
    const client = creerClientApi({
      baseUrl: "https://api.exemple.test/api",
      coffre: coffreMemoire(),
      fetch: jamais as typeof fetch,
      delaiMaxMs: 20,
    });
    await expect(client.connexion(parent.email, MOT_DE_PASSE)).rejects.toBeInstanceOf(ErreurReseau);
  });
});
