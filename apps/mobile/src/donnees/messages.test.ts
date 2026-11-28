import { describe, expect, it, vi } from "vitest";
import { ErreurApi, ErreurReseau, type ClientApi } from "../api/client";
import { chargerMessages, envoyerMessage } from "./messages";

// Messagerie : appels à l'API (texte en JSON, pièce jointe en multipart) et erreurs.

function client(autres: Partial<ClientApi>): ClientApi {
  return {
    connexion: vi.fn(),
    accepterInvitation: vi.fn(),
    get: vi.fn(),
    post: vi.fn(async () => ({ message: { id: "m" } })),
    postFormulaire: vi.fn(async () => ({ message: { id: "m" } })),
    delete: vi.fn(),
    sourceProtegee: vi.fn(),
    estConnecte: vi.fn(),
    deconnexion: vi.fn(),
    ...autres,
  } as ClientApi;
}

describe("messagerie (mobile)", () => {
  it("désactivée, sans consentement, hors ligne : états distincts ; 401 remonte", async () => {
    const erreur = (e: Error) => client({ get: vi.fn(async () => Promise.reject(e)) });
    expect(
      await chargerMessages(erreur(new ErreurApi(403, "messagerie_desactivee", "x")), "p1"),
    ).toEqual({ etat: "desactivee" });
    expect(
      await chargerMessages(erreur(new ErreurApi(403, "consentement_requis", "x")), "p1"),
    ).toEqual({ etat: "consentementRequis" });
    expect(await chargerMessages(erreur(new ErreurReseau()), "p1")).toEqual({ etat: "horsLigne" });
    await expect(
      chargerMessages(erreur(new ErreurApi(401, "non_connecte", "x")), "p1"),
    ).rejects.toBeInstanceOf(ErreurApi);
  });

  it("texte seul en JSON ; message vocal en multipart avec sa durée", async () => {
    const c = client({});
    await envoyerMessage(c, "p1", { contenu: "Bonjour" });
    expect(c.post).toHaveBeenCalledWith("/patients/p1/messagerie/messages", { contenu: "Bonjour" });

    await envoyerMessage(c, "p1", {
      contenu: "",
      vocal: { uri: "file:///voix/1.m4a", dureeSecondes: 8 },
    });
    const [chemin, formulaire] = vi.mocked(c.postFormulaire).mock.calls[0] ?? [];
    expect(chemin).toBe("/patients/p1/messagerie/messages");
    expect((formulaire as FormData).get("dureeSecondes")).toBe("8");
    expect((formulaire as FormData).get("contenu")).toBe("");
    expect((formulaire as FormData).has("fichier")).toBe(true);
  });
});
