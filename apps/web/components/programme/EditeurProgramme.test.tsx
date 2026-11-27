import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contenuProgramme, t, type ExerciceBibliotheque } from "@app/shared";
import { EditeurProgramme } from "./EditeurProgramme";

// Composition depuis le panneau Bibliothèque : le composant <BibliothequeSelecteur>
// est bien celui de la tâche 4, et « Ajouter au programme » appelle l'API avec le bon niveau.

const categorie = { id: "c1", nom: "Articulation et parole", slug: "articulation" };
function exercice(id: string, titre: string): ExerciceBibliotheque {
  return {
    id,
    titre,
    description: "Description fictive.",
    apercuConsigne: "Consigne courte.",
    apercuImage: null,
    materiel: [],
    dureeMinutes: 10,
    scoreMax: null,
    ageMin: 4,
    ageMax: 9,
    categorie,
    niveaux: [1, 2, 3].map((niveau) => ({
      niveau: niveau as 1 | 2 | 3,
      consigne: `${titre} — ${niveau}`,
    })),
    perso: false,
    aValider: true,
    favori: false,
  };
}
const exercices = [
  exercice("e1", "Sons ch / j"),
  exercice("e2", "Le lion qui ronronne"),
  exercice("e3", "Grimaces"),
];
const patient = { id: "p1", prenom: "Léa", age: 7, pathologies: ["articulation"] };

/** Élément tel que le renvoie l'API. */
function element(ex: ExerciceBibliotheque, niveau: number, n: number) {
  return contenuProgramme([
    {
      id: `el${n}`,
      ordre: n,
      niveau,
      foisParSemaine: 3,
      jours: [],
      motFamille: null,
      exercice: { ...ex, niveaux: ex.niveaux },
    },
  ])[0];
}

let appels: { url: string; methode: string; corps: unknown }[];

beforeEach(() => {
  appels = [];
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const corps = init.body ? JSON.parse(String(init.body)) : undefined;
      appels.push({ url, methode: init.method ?? "GET", corps });
      const json = (donnees: unknown, status = 200) =>
        new Response(JSON.stringify(donnees), {
          status,
          headers: { "content-type": "application/json" },
        });
      if (url.endsWith("/programme/elements")) {
        const ex = exercices.find((e) => e.id === corps.exerciceId) as ExerciceBibliotheque;
        n += 1;
        return json({ element: element(ex, corps.niveau, n) }, 201);
      }
      if (url.endsWith("/ajuster"))
        return json({ element: element(exercices[1] as ExerciceBibliotheque, 3, 1) });
      if (url.endsWith("/envoi"))
        return json({ version: { numero: 1, envoyeLe: "2026-11-27T10:00:00Z" } }, 201);
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function afficher() {
  render(
    <EditeurProgramme
      patient={patient}
      initial={{
        elements: [],
        derniereVersion: null,
        modifieDepuisEnvoi: false,
        destinataires: [],
      }}
      exercices={exercices}
      categories={[categorie]}
    />,
  );
}

const panneau = () => screen.getByRole("complementary");
const boutonAjouter = () =>
  within(panneau()).getByRole("button", { name: new RegExp(`^${t("web.programme.ajouter")}`) });

describe("<EditeurProgramme>", () => {
  it("compose 3 exercices depuis le panneau Bibliothèque, avec le niveau choisi", async () => {
    afficher();
    expect(screen.getByText(t("web.programme.vide"))).toBeTruthy();

    for (const [i, ex] of exercices.entries()) {
      fireEvent.click(within(panneau()).getByRole("button", { name: new RegExp(ex.titre) }));
      fireEvent.click(
        within(panneau()).getByLabelText(t("web.bibliotheque.niveauCourt", { niveau: i + 1 })),
      );
      fireEvent.click(boutonAjouter());
      await screen.findByRole("listitem", { name: ex.titre });
    }

    const ajouts = appels.filter((a) => a.url.endsWith("/programme/elements"));
    expect(ajouts.map((a) => a.corps)).toEqual([
      { exerciceId: "e1", niveau: 1 },
      { exerciceId: "e2", niveau: 2 },
      { exerciceId: "e3", niveau: 3 },
    ]);
    expect(ajouts[0]?.url).toBe("/api/patients/p1/programme/elements");
    const liste = screen.getByRole("list", { name: t("web.programme.actuel") });
    expect(within(liste).getAllByRole("listitem")).toHaveLength(3);
    expect(within(liste).getByText(t("web.programme.niveau", { niveau: 3 }))).toBeTruthy();
  });

  it("passe au niveau supérieur en un clic, puis envoie", async () => {
    afficher();
    fireEvent.click(within(panneau()).getByRole("button", { name: /Le lion/ }));
    fireEvent.click(
      within(panneau()).getByLabelText(t("web.bibliotheque.niveauCourt", { niveau: 2 })),
    );
    fireEvent.click(boutonAjouter());
    await screen.findByRole("listitem", { name: "Le lion qui ronronne" });

    fireEvent.click(
      screen.getByRole("button", { name: `${t("web.programme.monter")} : Le lion qui ronronne` }),
    );
    await screen.findByText(t("web.programme.niveau", { niveau: 3 }));
    expect(appels.at(-1)).toMatchObject({
      url: "/api/patients/p1/programme/elements/el1/ajuster",
      corps: { sens: "monter" },
    });

    fireEvent.click(screen.getByRole("button", { name: t("web.programme.envoyer") }));
    await waitFor(() =>
      expect(screen.getByText(t("web.programme.envoiOk", { numero: 1 }))).toBeTruthy(),
    );
    expect(appels.at(-1)).toMatchObject({
      url: "/api/patients/p1/programme/envoi",
      methode: "POST",
    });
    expect(screen.getByText(/Envoyé le .* \(version 1\)/)).toBeTruthy();
  });

  it("filtres de la bibliothèque pré-réglés sur le patient", () => {
    afficher();
    expect(
      (within(panneau()).getByLabelText(t("web.bibliotheque.age")) as HTMLInputElement).value,
    ).toBe("7");
    expect(
      (within(panneau()).getByLabelText(t("web.bibliotheque.pathologie")) as HTMLSelectElement)
        .value,
    ).toBe("articulation");
  });
});
