import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { t, type MessageVue } from "@app/shared";
import type { EnregistreurVoix } from "../audio/types";
import type { ChargementMessages } from "../donnees/messages";
import { EcranMessages } from "./EcranMessages";

// Onglet Messages (famille) : fil, horaires, envoi d'un texte, d'une photo ou d'un vocal,
// et messagerie désactivée. Données fictives.

const message = (m: Partial<MessageVue>): MessageVue => ({
  id: "m1",
  deMoi: false,
  cote: "CABINET",
  auteur: "Alice",
  contenu: "Bonjour, comment s'est passée la semaine ? (fictif)",
  envoyeLe: "2026-11-27T09:00:00Z",
  luLe: null,
  piecesJointes: [],
  ...m,
});

const enregistreur = (
  audio = { uri: "file:///voix/1.m4a", dureeSecondes: 8 },
): EnregistreurVoix => {
  let enCours = false;
  return {
    get enCours() {
      return enCours;
    },
    dureeMs: 0,
    demarrer: async () => {
      enCours = true;
      return true;
    },
    arreter: async () => {
      enCours = false;
      return audio;
    },
  };
};

function afficher(
  charger: () => Promise<ChargementMessages>,
  autres: Partial<Parameters<typeof EcranMessages>[0]> = {},
) {
  const envoyer = vi.fn(async (e: { contenu: string }) =>
    message({ id: "nouveau", deMoi: true, cote: "FAMILLE", auteur: "Julie", contenu: e.contenu }),
  );
  render(
    <EcranMessages
      charger={charger}
      envoyer={envoyer}
      enregistreur={enregistreur()}
      choisirPhoto={async () => ({
        uri: "file:///photo.jpg",
        type: "image/jpeg",
        nom: "photo.jpg",
      })}
      sourcePieceJointe={async (id) => ({
        uri: `https://x.test/pj/${id}`,
        headers: { Authorization: "Bearer fictif" },
      })}
      LecteurVocal={({ source }) => <>{`lecteur:${source.uri}`}</>}
      supprimerVoix={vi.fn()}
      {...autres}
    />,
  );
  return { envoyer };
}

const ok =
  (messages: MessageVue[]): (() => Promise<ChargementMessages>) =>
  async () => ({
    etat: "ok",
    fil: { horairesReponse: "Je réponds sous 48 h (fictif).", messages },
  });

describe("<EcranMessages>", () => {
  it("affiche la conversation et les horaires de réponse", async () => {
    afficher(ok([message({})]));
    expect(await screen.findByText("Je réponds sous 48 h (fictif).")).toBeTruthy();
    expect(screen.getByText("Bonjour, comment s'est passée la semaine ? (fictif)")).toBeTruthy();
  });

  it("envoie un texte, qui s'ajoute au fil", async () => {
    const { envoyer } = afficher(ok([]));
    fireEvent.change(await screen.findByLabelText(t("mobile.messages.ecrire")), {
      target: { value: "Très bien, merci (fictif)." },
    });
    fireEvent.click(screen.getByRole("button", { name: t("mobile.messages.envoyer") }));
    await screen.findByText("Très bien, merci (fictif).");
    expect(envoyer).toHaveBeenCalledWith({
      contenu: "Très bien, merci (fictif).",
      photo: null,
      vocal: null,
    });
  });

  it("joint une photo choisie dans la galerie", async () => {
    const { envoyer } = afficher(ok([]));
    fireEvent.click(await screen.findByRole("button", { name: t("mobile.messages.photo") }));
    await screen.findByText(t("mobile.messages.photoPrete"));
    fireEvent.click(screen.getByRole("button", { name: t("mobile.messages.envoyer") }));
    await waitFor(() =>
      expect(envoyer).toHaveBeenCalledWith({
        contenu: "",
        photo: { uri: "file:///photo.jpg", type: "image/jpeg", nom: "photo.jpg" },
        vocal: null,
      }),
    );
  });

  it("enregistre un message vocal, l'envoie, puis supprime le fichier du téléphone", async () => {
    const supprimerVoix = vi.fn();
    const { envoyer } = afficher(ok([]), { supprimerVoix });
    fireEvent.click(await screen.findByRole("button", { name: t("mobile.messages.vocal") }));
    fireEvent.click(await screen.findByRole("button", { name: t("mobile.messages.vocal") }));
    await screen.findByText(t("mobile.messages.vocalPret", { secondes: 8 }));
    fireEvent.click(screen.getByRole("button", { name: t("mobile.messages.envoyer") }));
    await waitFor(() => expect(envoyer).toHaveBeenCalled());
    expect(envoyer.mock.calls[0]?.[0]).toMatchObject({ vocal: { uri: "file:///voix/1.m4a" } });
    await waitFor(() =>
      expect(supprimerVoix).toHaveBeenCalledWith({ uri: "file:///voix/1.m4a", dureeSecondes: 8 }),
    );
  });

  it("pièces jointes reçues : photo et message vocal lus depuis notre serveur", async () => {
    afficher(
      ok([
        message({
          piecesJointes: [
            {
              id: "pj1",
              genre: "PHOTO",
              typeMime: "image/jpeg",
              tailleOctets: 10,
              dureeSecondes: null,
            },
            {
              id: "pj2",
              genre: "VOCAL",
              typeMime: "audio/mp4",
              tailleOctets: 10,
              dureeSecondes: 12,
            },
          ],
        }),
      ]),
    );
    expect(await screen.findByText("lecteur:https://x.test/pj/pj2")).toBeTruthy();
    expect(screen.getByText(t("mobile.messages.vocalDuree", { secondes: 12 }))).toBeTruthy();
    expect(
      await screen.findByLabelText(t("mobile.messages.photo"), { selector: "img,div" }),
    ).toBeTruthy();
  });

  it("messagerie désactivée par le cabinet : message clair, pas de saisie", async () => {
    afficher(async () => ({ etat: "desactivee" }));
    expect(await screen.findByText(t("mobile.messages.desactivee"))).toBeTruthy();
    expect(screen.queryByLabelText(t("mobile.messages.ecrire"))).toBeNull();
  });
});
