import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EcranChoixProfil } from "./EcranChoixProfil";

describe("<EcranChoixProfil> « Qui fait les exercices ? »", () => {
  it("un gros bouton par enfant ; choisir Léa transmet son profil", () => {
    const onChoisir = vi.fn();
    render(
      <EcranChoixProfil
        patients={[
          { id: "p-lea", prenom: "Léa", messagerieActivee: true },
          { id: "p-tom", prenom: "Tom", messagerieActivee: false },
        ]}
        onChoisir={onChoisir}
        onDeconnexion={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Qui fait les exercices ?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Choisir Léa" }));
    expect(onChoisir).toHaveBeenCalledWith({
      patientId: "p-lea",
      prenom: "Léa",
      messagerieActivee: true,
    });
    expect(screen.getByRole("button", { name: "Choisir Tom" })).toBeTruthy();
  });

  it("enfant sans consentement : pas de bouton, explication affichée", () => {
    render(
      <EcranChoixProfil
        patients={[{ id: "p", prenom: "Sacha", consentementRequis: true }]}
        onChoisir={vi.fn()}
        onDeconnexion={vi.fn()}
      />,
    );
    expect(screen.getByText("Sacha")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Choisir Sacha" })).toBeNull();
    expect(screen.getByText(/Votre accord est nécessaire/)).toBeTruthy();
  });

  it("aucun enfant relié : message", () => {
    render(<EcranChoixProfil patients={[]} onChoisir={vi.fn()} onDeconnexion={vi.fn()} />);
    expect(screen.getByText(/Aucun enfant n'est encore relié/)).toBeTruthy();
  });
});
