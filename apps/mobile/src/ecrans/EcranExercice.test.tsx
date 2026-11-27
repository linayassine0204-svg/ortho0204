import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { exercice } from "../../test/fixtures";
import type { EnregistreurVoix } from "../audio/types";
import { EcranExercice } from "./EcranExercice";

const enregistreur: EnregistreurVoix = {
  enCours: false,
  dureeMs: 0,
  demarrer: async () => true,
  arreter: async () => null,
};

function afficher(options: { modeEnfant?: boolean; scoreMax?: number | null } = {}) {
  const onEnregistrer = vi.fn(async () => ({ envoyee: true }));
  const onFermer = vi.fn();
  render(
    <EcranExercice
      exercice={exercice({
        scoreMax: options.scoreMax ?? null,
        niveau: 2,
        consigne: "Consigne N2.",
      })}
      modeEnfant={options.modeEnfant ?? false}
      accordAudio={false}
      onDonnerAccord={async () => undefined}
      enregistreur={enregistreur}
      supprimerVoix={() => undefined}
      onEnregistrer={onEnregistrer}
      onFermer={onFermer}
    />,
  );
  return { onEnregistrer, onFermer };
}

describe("<EcranExercice>", () => {
  it("montre la consigne du niveau choisi, l'aperçu et le bouton « C'est fait »", () => {
    afficher();
    expect(screen.getByRole("heading", { name: "Trouver les rimes" })).toBeTruthy();
    expect(screen.getByText("Consigne N2.")).toBeTruthy();
    expect(screen.getByText(/Niv\. 2/)).toBeTruthy();
    expect(screen.getByText("Matériel : Cartes images")).toBeTruthy();
    expect(screen.getByRole("button", { name: "C'est fait !" })).toBeTruthy();
  });

  it("ressenti obligatoire ; score proposé seulement si l'exercice en prévoit un", async () => {
    const { onEnregistrer } = afficher({ scoreMax: 10 });
    fireEvent.click(screen.getByRole("button", { name: "C'est fait !" }));
    const valider = await screen.findByRole("button", { name: "Valider" });
    expect(valider.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getAllByRole("radio", { name: /Score/ })).toHaveLength(11);
    fireEvent.click(screen.getByRole("radio", { name: "Facile" }));
    fireEvent.click(screen.getByRole("radio", { name: "Score 7 sur 10" }));
    expect(screen.getByText("7 sur 10")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    await waitFor(() =>
      expect(onEnregistrer).toHaveBeenCalledWith({ ressenti: "FACILE", score: 7, audio: null }),
    );
  });

  it("sans score prévu : pas de choix de score", async () => {
    afficher({ scoreMax: null });
    fireEvent.click(screen.getByRole("button", { name: "C'est fait !" }));
    await screen.findByRole("radio", { name: "Moyen" });
    expect(screen.queryByRole("radio", { name: /Score/ })).toBeNull();
  });

  it("mode enfant : étoiles et encouragements, même si c'était difficile", async () => {
    const { onFermer } = afficher({ modeEnfant: true });
    fireEvent.click(screen.getByRole("button", { name: "C'est fait !" }));
    expect(await screen.findByText("C'était comment ?")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Difficile" }));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(await screen.findByLabelText("Tu as gagné 3 étoiles !")).toBeTruthy();
    expect(screen.getByText(/Bravo d'avoir essayé/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect(onFermer).toHaveBeenCalledWith(true);
  });

  it("vue adulte : message sobre, sans étoiles", async () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: "C'est fait !" }));
    fireEvent.click(await screen.findByRole("radio", { name: "Moyen" }));
    fireEvent.click(screen.getByRole("button", { name: "Valider" }));
    expect(await screen.findByText("Réalisation enregistrée.")).toBeTruthy();
    expect(screen.queryByText(/étoiles/)).toBeNull();
  });

  it("« Retour » sans avoir fini : on ferme sans rien enregistrer", () => {
    const { onEnregistrer, onFermer } = afficher();
    fireEvent.click(screen.getByRole("button", { name: "Retour" }));
    expect(onFermer).toHaveBeenCalledWith(false);
    expect(onEnregistrer).not.toHaveBeenCalled();
  });
});
