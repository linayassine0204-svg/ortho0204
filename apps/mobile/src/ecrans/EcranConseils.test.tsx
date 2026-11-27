import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { conseilRecu } from "../../test/fixtures";
import type { ChargementConseils } from "../donnees/conseils";
import { EcranConseils } from "./EcranConseils";

const afficher = (
  resultat: ChargementConseils,
  marquerLu = vi.fn(async () => "2026-11-27T09:05:00Z"),
) => {
  render(<EcranConseils charger={async () => resultat} marquerLu={marquerLu} />);
  return marquerLu;
};

describe("<EcranConseils> (mobile)", () => {
  it("affiche chaque conseil avec « À faire », « À éviter » et l'étiquette « à valider »", async () => {
    afficher({ etat: "ok", conseils: [conseilRecu()] });
    const carte = await screen.findByLabelText("Lire ensemble chaque soir");
    expect(within(carte).getByText("À faire")).toBeTruthy();
    expect(within(carte).getByText("Laissez-le lire un mot sur deux.")).toBeTruthy();
    expect(within(carte).getByText("À éviter")).toBeTruthy();
    expect(within(carte).getByText("Exemple à valider")).toBeTruthy();
    expect(within(carte).getByText("Nouveau")).toBeTruthy();
    expect(within(carte).getByText("Reçu le 24 novembre")).toBeTruthy();
  });

  it("« J'ai compris » marque le conseil comme lu", async () => {
    const marquerLu = afficher({ etat: "ok", conseils: [conseilRecu()] });
    fireEvent.click(await screen.findByRole("button", { name: "J'ai compris" }));
    expect(marquerLu).toHaveBeenCalledWith("env-lecture");
    expect(await screen.findByLabelText("Conseil marqué comme lu")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "J'ai compris" })).toBeNull();
    expect(screen.queryByText("Nouveau")).toBeNull();
  });

  it("déjà lu : pas de bouton, « Lu ✓ »", async () => {
    afficher({ etat: "ok", conseils: [conseilRecu({ luLe: "2026-11-25T18:00:00Z" })] });
    expect(await screen.findByText("Lu ✓")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "J'ai compris" })).toBeNull();
  });

  it("échec de « J'ai compris » : message, le bouton reste", async () => {
    afficher(
      { etat: "ok", conseils: [conseilRecu()] },
      vi.fn(async () => {
        throw new Error("réseau");
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "J'ai compris" }));
    expect(await screen.findByText("Impossible d'enregistrer la lecture. Réessayez.")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "J'ai compris" })).toBeTruthy());
  });

  it("aucun conseil : message d'attente", async () => {
    afficher({ etat: "ok", conseils: [] });
    expect(
      await screen.findByText("Les conseils de votre orthophoniste apparaîtront ici."),
    ).toBeTruthy();
  });

  it("hors ligne : message clair", async () => {
    afficher({ etat: "horsLigne" });
    expect(await screen.findByText(/Pas de connexion internet/)).toBeTruthy();
  });
});
