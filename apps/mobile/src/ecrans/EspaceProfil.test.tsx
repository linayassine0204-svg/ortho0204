import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { conseilRecu, profil, programmeLea, VENDREDI } from "../../test/fixtures";
import type { ChargementProgramme } from "../donnees/programme";
import { EspaceProfil } from "./EspaceProfil";

const charger = async (): Promise<ChargementProgramme> => ({
  etat: "ok",
  programme: programmeLea,
  horsLigne: false,
});

function afficher(messagerieActivee: boolean) {
  return render(
    <EspaceProfil
      profil={profil({ messagerieActivee })}
      chargerProgramme={charger}
      onDeconnexion={vi.fn()}
      maintenant={() => VENDREDI}
    />,
  );
}

describe("<EspaceProfil> : barre d'onglets", () => {
  it("messagerie activée : trois onglets, dont Messages", async () => {
    afficher(true);
    const onglets = screen.getAllByRole("tab").map((o) => o.getAttribute("aria-label"));
    expect(onglets).toEqual(["Aujourd'hui", "Conseils", "Messages"]);
    fireEvent.click(screen.getByRole("tab", { name: "Messages" }));
    expect(await screen.findByText("La messagerie arrive bientôt.")).toBeTruthy();
  });

  it("messagerie désactivée : l'onglet Messages est absent", () => {
    afficher(false);
    const onglets = screen.getAllByRole("tab").map((o) => o.getAttribute("aria-label"));
    expect(onglets).toEqual(["Aujourd'hui", "Conseils"]);
    expect(screen.queryByRole("tab", { name: "Messages" })).toBeNull();
  });

  it("onglet Conseils : la liste des conseils reçus", async () => {
    render(
      <EspaceProfil
        profil={profil({ messagerieActivee: false })}
        chargerProgramme={charger}
        chargerConseils={async () => ({ etat: "ok", conseils: [conseilRecu()] })}
        onDeconnexion={vi.fn()}
        maintenant={() => VENDREDI}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Conseils" }));
    expect(await screen.findByText("Lire ensemble chaque soir")).toBeTruthy();
    expect(screen.getByRole("button", { name: "J'ai compris" })).toBeTruthy();
  });

  it("patient adulte sans messagerie : ni Conseils ni barre d'onglets", () => {
    render(
      <EspaceProfil
        profil={profil({ messagerieActivee: false })}
        role="PATIENT_ADULT"
        chargerProgramme={charger}
        onDeconnexion={vi.fn()}
        maintenant={() => VENDREDI}
      />,
    );
    expect(screen.queryByRole("tab")).toBeNull();
  });
});
