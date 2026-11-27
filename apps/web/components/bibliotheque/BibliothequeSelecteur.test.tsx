import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t, type ExerciceBibliotheque } from "@app/shared";
import { BibliothequeSelecteur } from "./BibliothequeSelecteur";

afterEach(cleanup);

const articulation = { id: "c1", nom: "Articulation et parole", slug: "articulation" };
const voix = { id: "c2", nom: "Voix", slug: "voix" };
const categories = [articulation, voix];

function exercice(
  p: Partial<ExerciceBibliotheque> & { id: string; titre: string },
): ExerciceBibliotheque {
  return {
    description: "Description fictive.",
    apercuConsigne: "Consigne courte.",
    apercuImage: null,
    materiel: ["Miroir"],
    dureeMinutes: 10,
    scoreMax: null,
    ageMin: 4,
    ageMax: 9,
    categorie: articulation,
    niveaux: [
      { niveau: 1, consigne: `${p.titre} — consigne 1` },
      { niveau: 2, consigne: `${p.titre} — consigne 2` },
      { niveau: 3, consigne: `${p.titre} — consigne 3` },
    ],
    perso: false,
    aValider: true,
    favori: false,
    ...p,
  };
}

const chJ = exercice({ id: "ch-j", titre: "Sons ch / j : le train et l'abeille" });
const r = exercice({ id: "r", titre: "Le lion qui ronronne", ageMin: 4, ageMax: 10 });
const sirene = exercice({
  id: "sirene",
  titre: "La sirène",
  categorie: voix,
  ageMin: 8,
  ageMax: 99,
  dureeMinutes: 5,
});
const exercices = [r, sirene, chJ];
const patient = { id: "p1", prenom: "Léa", age: 7, pathologies: ["articulation"] };

const liste = () => screen.getByRole("list", { name: t("web.bibliotheque.liste") });
const titresListe = () =>
  within(liste())
    .getAllByRole("button")
    .map((b) => b.querySelector(".ligne-titre")?.firstChild?.textContent);

describe("<BibliothequeSelecteur> mode complet", () => {
  it("cherche « sons ch / j », filtre par niveau 2 et affiche l'aperçu", () => {
    render(<BibliothequeSelecteur mode="complet" exercices={exercices} categories={categories} />);
    fireEvent.change(screen.getByLabelText(t("web.bibliotheque.recherche")), {
      target: { value: "sons ch / j" },
    });
    expect(titresListe()).toEqual([chJ.titre]);

    fireEvent.change(screen.getByLabelText(t("web.bibliotheque.niveau")), {
      target: { value: "2" },
    });
    const apercu = screen.getByRole("region", { name: t("web.bibliotheque.apercu") });
    expect(within(apercu).getByRole("heading", { name: chJ.titre })).toBeTruthy();
    expect(within(apercu).getByText(`${chJ.titre} — consigne 2`)).toBeTruthy();
    // Aperçu : matériel, durée, et étiquette « à valider ».
    expect(within(apercu).getByText("Miroir")).toBeTruthy();
    expect(within(apercu).getByText(t("web.bibliotheque.minutes", { minutes: 10 }))).toBeTruthy();
    expect(within(apercu).getAllByText(t("web.bibliotheque.aValider")).length).toBeGreaterThan(0);
  });

  it("n'affiche pas de bouton « Ajouter » sans patient", () => {
    render(<BibliothequeSelecteur mode="complet" exercices={exercices} categories={categories} />);
    expect(
      screen.queryByRole("button", { name: new RegExp(t("web.bibliotheque.ajouter")) }),
    ).toBeNull();
  });

  it("filtre par pathologie et par durée", () => {
    render(<BibliothequeSelecteur mode="complet" exercices={exercices} categories={categories} />);
    fireEvent.change(screen.getByLabelText(t("web.bibliotheque.pathologie")), {
      target: { value: "voix" },
    });
    expect(titresListe()).toEqual([sirene.titre]);
    fireEvent.change(screen.getByLabelText(t("web.bibliotheque.pathologie")), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText(t("web.bibliotheque.duree")), {
      target: { value: "5" },
    });
    expect(titresListe()).toEqual([sirene.titre]);
  });

  it("marque un favori via onFavori", async () => {
    const onFavori = vi.fn().mockResolvedValue(true);
    render(
      <BibliothequeSelecteur
        mode="complet"
        exercices={exercices}
        categories={categories}
        onFavori={onFavori}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(t("web.bibliotheque.favoriAjouter")) }),
    );
    expect(onFavori).toHaveBeenCalledWith(r, true);
    expect(
      await screen.findByRole("button", { name: new RegExp(t("web.bibliotheque.favoriRetirer")) }),
    ).toBeTruthy();
  });
});

describe("<BibliothequeSelecteur> mode sélection", () => {
  it("pré-règle les filtres sur la pathologie et l'âge du patient", () => {
    render(
      <BibliothequeSelecteur
        mode="selection"
        patient={patient}
        onAjouter={() => {}}
        exercices={exercices}
        categories={categories}
      />,
    );
    expect(
      (screen.getByLabelText(t("web.bibliotheque.pathologie")) as HTMLSelectElement).value,
    ).toBe("articulation");
    expect((screen.getByLabelText(t("web.bibliotheque.age")) as HTMLInputElement).value).toBe("7");
    // La sirène (voix, 8 ans et plus) est écartée.
    expect(titresListe()).toEqual([r.titre, chJ.titre]);
    expect(
      screen.getByText(t("web.bibliotheque.filtresPatient", { prenom: "Léa", age: 7 })),
    ).toBeTruthy();
  });

  it("« Ajouter » appelle onAjouter avec l'exercice et le niveau choisi", async () => {
    const onAjouter = vi.fn();
    render(
      <BibliothequeSelecteur
        mode="selection"
        patient={patient}
        onAjouter={onAjouter}
        exercices={exercices}
        categories={categories}
      />,
    );
    fireEvent.click(within(liste()).getByRole("button", { name: new RegExp("Sons ch / j") }));
    fireEvent.click(screen.getByLabelText(t("web.bibliotheque.niveauCourt", { niveau: 2 })));
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`^${t("web.bibliotheque.ajouter")}`) }),
    );
    expect(onAjouter).toHaveBeenCalledTimes(1);
    expect(onAjouter).toHaveBeenCalledWith(chJ, 2);
    expect((await screen.findByRole("status")).textContent).toBe(
      t("web.bibliotheque.ajoute", { titre: chJ.titre, niveau: 2 }),
    );
  });

  it("le niveau 3 choisi est bien celui transmis", async () => {
    const onAjouter = vi.fn();
    render(
      <BibliothequeSelecteur
        mode="selection"
        patient={patient}
        onAjouter={onAjouter}
        exercices={exercices}
        categories={categories}
      />,
    );
    fireEvent.click(screen.getByLabelText(t("web.bibliotheque.niveauCourt", { niveau: 3 })));
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`^${t("web.bibliotheque.ajouter")}`) }),
    );
    expect(onAjouter).toHaveBeenCalledWith(r, 3);
  });

  it("si onAjouter renvoie false (échec), aucun message « ajouté »", async () => {
    const onAjouter = vi.fn().mockResolvedValue(false);
    render(
      <BibliothequeSelecteur
        mode="selection"
        patient={patient}
        onAjouter={onAjouter}
        exercices={exercices}
        categories={categories}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`^${t("web.bibliotheque.ajouter")}`) }),
    );
    await Promise.resolve();
    expect(onAjouter).toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
  });
});
