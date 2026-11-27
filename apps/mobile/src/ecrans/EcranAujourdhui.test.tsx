import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { programmeLea, VENDREDI } from "../../test/fixtures";
import type { ChargementProgramme } from "../donnees/programme";
import { EcranAujourdhui } from "./EcranAujourdhui";

const profil = { patientId: "p-lea", prenom: "Léa", messagerieActivee: true };
const afficher = (resultat: ChargementProgramme) =>
  render(
    <EcranAujourdhui profil={profil} charger={async () => resultat} maintenant={() => VENDREDI} />,
  );

describe("<EcranAujourdhui>", () => {
  it("liste les exercices du jour puis ceux à placer dans la semaine", async () => {
    afficher({ etat: "ok", programme: programmeLea, horsLigne: false });
    expect(await screen.findByText("Trouver les rimes")).toBeTruthy();
    expect(screen.getByText("Bonjour Léa !")).toBeTruthy();
    expect(screen.getByText(/vendredi 27 novembre/i)).toBeTruthy();
    expect(screen.queryByText("Compter les syllabes")).toBeNull(); // mardi et samedi
    expect(screen.getByText("À placer dans la semaine")).toBeTruthy();
    expect(screen.getByText("Lecture partagée")).toBeTruthy();
    expect(screen.queryByText(/Hors connexion/)).toBeNull();
  });

  it("hors ligne : affiche le programme enregistré et le signale", async () => {
    afficher({
      etat: "ok",
      programme: programmeLea,
      horsLigne: true,
      enregistreLe: "2026-11-26T17:00:00.000Z",
    });
    expect(await screen.findByText("Trouver les rimes")).toBeTruthy();
    expect(screen.getByText(/Hors connexion\. Programme enregistré le 26 novembre/)).toBeTruthy();
  });

  it("hors ligne sans copie : message et bouton Réessayer", async () => {
    afficher({ etat: "horsLigneSansCache" });
    expect(await screen.findByText(/aucun programme enregistré/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
  });

  it("aucun programme envoyé", async () => {
    afficher({ etat: "ok", programme: null, horsLigne: false });
    expect(await screen.findByText(/n'a pas encore envoyé de programme/)).toBeTruthy();
  });
});
