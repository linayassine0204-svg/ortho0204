import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { exercice } from "../../test/fixtures";
import { CarteExercice } from "./CarteExercice";

describe("<CarteExercice>", () => {
  it("montre l'aperçu, le niveau, la durée et le mot de l'orthophoniste", () => {
    render(<CarteExercice exercice={exercice({ niveau: 2, dureeMinutes: 10 })} />);
    expect(screen.getByText("Trouver les rimes")).toBeTruthy();
    expect(screen.getByText("Niv. 2")).toBeTruthy();
    expect(screen.getByLabelText("Niveau 2 sur 3")).toBeTruthy();
    expect(screen.getByText("10 min")).toBeTruthy();
    expect(screen.getByText("Dire si deux mots riment.")).toBeTruthy();
    expect(screen.getByText("Matériel : Cartes images")).toBeTruthy();
    expect(screen.getByText("Le mot de votre orthophoniste")).toBeTruthy();
    expect(screen.getByText("Faites-le après le goûter, 10 minutes suffisent.")).toBeTruthy();
  });

  it("sans mot ni matériel : ces blocs sont absents", () => {
    render(<CarteExercice exercice={exercice({ motFamille: null, materiel: [] })} />);
    expect(screen.queryByText("Le mot de votre orthophoniste")).toBeNull();
    expect(screen.queryByText(/Matériel/)).toBeNull();
  });

  it("exercice à placer dans la semaine : affiche la fréquence", () => {
    render(<CarteExercice exercice={exercice({ jours: [], foisParSemaine: 2 })} frequence />);
    expect(screen.getByText("2 fois cette semaine")).toBeTruthy();
  });

  it("étiquette « à valider » pour le contenu d'exemple", () => {
    render(<CarteExercice exercice={exercice({ aValider: true })} />);
    expect(screen.getByText("Exemple à valider")).toBeTruthy();
  });
});
