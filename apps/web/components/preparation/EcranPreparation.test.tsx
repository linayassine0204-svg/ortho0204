import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contenuProgramme, t, type ExerciceBibliotheque } from "@app/shared";
import type { ElementSeanceVue, Preparation } from "@/lib/serveur/seances";
import { EcranPreparation } from "./EcranPreparation";

// Écran Préparation : résumé, séance proposée, programme et panneau Bibliothèque
// (le composant <BibliothequeSelecteur>, réutilisé). Données fictives, API simulée.

const categorie = { id: "c1", nom: "Langage écrit", slug: "langage-ecrit" };
function exercice(id: string, titre: string, materiel: string[]): ExerciceBibliotheque {
  return {
    id,
    titre,
    description: "Description fictive.",
    apercuConsigne: "Consigne courte.",
    apercuImage: null,
    materiel,
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
  exercice("e1", "Rimes", ["Cartes images"]),
  exercice("e2", "Syllabes", ["Miroir"]),
  exercice("e3", "Lecture flash", ["miroir", "Liste de mots"]),
];
const patient = { id: "p1", prenom: "Léa", age: 7, pathologies: ["langage-ecrit"] };

function vue(ex: ExerciceBibliotheque, niveau: 1 | 2 | 3, autres: Partial<ElementSeanceVue> = {}) {
  return {
    id: `s-${ex.id}`,
    exerciceId: ex.id,
    titre: ex.titre,
    apercuConsigne: ex.apercuConsigne,
    categorie: { nom: categorie.nom, slug: categorie.slug },
    niveau,
    consigne: `${ex.titre} — ${niveau}`,
    dureeMinutes: ex.dureeMinutes,
    materiel: ex.materiel,
    aValider: true,
    origine: "BIBLIOTHEQUE",
    raison: null,
    retenu: true,
    ...autres,
  } satisfies ElementSeanceVue;
}

const preparation: Preparation = {
  seance: {
    id: "seance1",
    date: new Date("2026-11-27T09:00:00Z"),
    objectifs: null,
    materiel: null,
    notes: null,
    pointsAReprendre: null,
    elements: [
      vue(exercices[0] as ExerciceBibliotheque, 2, {
        origine: "PROPOSITION",
        raison: "NIVEAU_SUIVANT",
        retenu: false,
      }),
    ],
  },
  resume: {
    maison: {
      depuis: "2026-11-20",
      jusqua: "2026-11-26",
      prevues: 5,
      faites: 4,
      taux: 0.8,
      ressentis: { FACILE: 3, MOYEN: 1, DIFFICILE: 0 },
      lignes: [],
    },
    derniereSeance: {
      date: new Date("2026-11-20T09:00:00Z"),
      notes: "Notes fictives de la séance précédente.",
      pointsAReprendre: "Reprendre les rimes (fictif).",
    },
  },
  seancesPassees: [
    {
      id: "passee1",
      date: new Date("2026-11-20T09:00:00Z"),
      exercices: [{ titre: "Syllabes", niveau: 2 }],
    },
  ],
};

let appels: { url: string; methode: string; corps: unknown }[];

beforeEach(() => {
  appels = [];
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
      const ex = (id: string) => exercices.find((e) => e.id === id) as ExerciceBibliotheque;
      if (url.endsWith("/seances/seance1/elements")) {
        return json({ element: vue(ex(corps.exerciceId), corps.niveau) }, 201);
      }
      if (url.endsWith("/seances/seance1/elements/s-e1") && init.method === "PATCH") {
        return json({
          element: vue(ex("e1"), corps.niveau ?? 2, {
            origine: "PROPOSITION",
            raison: "NIVEAU_SUIVANT",
          }),
        });
      }
      if (url.endsWith("/copie")) {
        return json({
          copies: 1,
          elements: [...preparation.seance.elements, vue(ex("e2"), 2, { origine: "COPIE" })],
        });
      }
      if (url.endsWith("/programme/elements")) {
        const e = ex(corps.exerciceId);
        const [element] = contenuProgramme([
          {
            id: "pe1",
            ordre: 1,
            niveau: corps.niveau,
            foisParSemaine: 3,
            jours: [],
            motFamille: null,
            exercice: e,
          },
        ]);
        return json({ element }, 201);
      }
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
    <EcranPreparation
      patient={patient}
      initial={preparation}
      programme={{
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
const P = "web.preparation";

describe("<EcranPreparation>", () => {
  it("affiche le résumé, la séance proposée, le programme et la bibliothèque à droite", () => {
    afficher();
    expect(screen.getByRole("heading", { name: t(`${P}.resume.titre`) })).toBeTruthy();
    expect(screen.getByText("4 sur 5 faits (80 %)")).toBeTruthy();
    expect(screen.getByText("Notes fictives de la séance précédente.")).toBeTruthy();
    expect(screen.getByText("Reprendre les rimes (fictif).")).toBeTruthy();

    const proposee = screen.getByRole("list", { name: t(`${P}.seance.proposee`) });
    expect(within(proposee).getByText(/Niveau suivant : derniers résultats bons/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: t(`${P}.programme.titre`) })).toBeTruthy();
    // Le panneau de droite est bien le composant de la bibliothèque, pré-réglé sur le patient.
    expect(within(panneau()).getByText(/Léa/)).toBeTruthy();
    expect(within(panneau()).getByRole("search")).toBeTruthy();
  });

  it("« Ajouter à la séance » depuis le panneau, au niveau choisi ; le matériel suit", async () => {
    afficher();
    expect(screen.getByText(t(`${P}.materiel.aucun`))).toBeTruthy();

    fireEvent.click(within(panneau()).getByRole("button", { name: /Lecture flash/ }));
    fireEvent.click(
      within(panneau()).getByLabelText(t("web.bibliotheque.niveauCourt", { niveau: 3 })),
    );
    fireEvent.click(
      within(panneau()).getByRole("button", { name: new RegExp(`^${t(`${P}.seance.ajouter`)}`) }),
    );

    const retenus = await screen.findByRole("list", { name: t(`${P}.seance.retenus`) });
    expect(within(retenus).getByRole("listitem", { name: "Lecture flash" })).toBeTruthy();
    expect(within(retenus).getByText("Lecture flash — 3")).toBeTruthy();
    expect(appels.find((a) => a.url.endsWith("/seances/seance1/elements"))?.corps).toEqual({
      exerciceId: "e3",
      niveau: 3,
    });
    const materiel = screen.getByRole("list", { name: t(`${P}.materiel.titre`) });
    expect(within(materiel).getByText("Liste de mots")).toBeTruthy();
    expect(within(materiel).getByText("miroir")).toBeTruthy();
  });

  it("« Ajouter au programme » depuis le même panneau : même programme que l'écran Programme", async () => {
    afficher();
    fireEvent.click(within(panneau()).getByRole("button", { name: /Syllabes/ }));
    fireEvent.click(
      within(panneau()).getByLabelText(t("web.bibliotheque.niveauCourt", { niveau: 2 })),
    );
    fireEvent.click(
      within(panneau()).getByRole("button", { name: new RegExp(`^${t("web.programme.ajouter")}`) }),
    );
    const programme = await screen.findByRole("list", { name: t(`${P}.programme.titre`) });
    expect(within(programme).getByRole("listitem", { name: "Syllabes" })).toBeTruthy();
    const ajout = appels.find((a) => a.url.endsWith("/programme/elements"));
    expect(ajout).toMatchObject({
      url: "/api/patients/p1/programme/elements",
      corps: { exerciceId: "e2", niveau: 2 },
    });
  });

  it("accepter une proposition la fait entrer dans la séance", async () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: `${t(`${P}.seance.accepter`)} : Rimes` }));
    const retenus = await screen.findByRole("list", { name: t(`${P}.seance.retenus`) });
    expect(within(retenus).getByRole("listitem", { name: "Rimes" })).toBeTruthy();
    expect(appels.at(-1)).toMatchObject({ methode: "PATCH", corps: { retenu: true } });
    expect(screen.getByText(t(`${P}.seance.duree`, { minutes: 10 }))).toBeTruthy();
  });

  it("changer le niveau d'une proposition, ou la retirer", async () => {
    afficher();
    fireEvent.click(screen.getByRole("button", { name: `${t(`${P}.seance.changer`)} : Rimes` }));
    fireEvent.change(screen.getByLabelText(`${t(`${P}.seance.niveau`)} : Rimes`), {
      target: { value: "3" },
    });
    await waitFor(() => expect(appels.at(-1)?.corps).toEqual({ niveau: 3 }));

    cleanup();
    afficher();
    fireEvent.click(screen.getByRole("button", { name: `${t(`${P}.seance.retirer`)} : Rimes` }));
    await waitFor(() => expect(screen.getByText(t(`${P}.seance.aucuneProposition`))).toBeTruthy());
    expect(appels.at(-1)?.methode).toBe("DELETE");
  });

  it("copier une séance passée ; lien d'export PDF de la séance", async () => {
    afficher();
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`^${t(`${P}.reutiliser.copier`)}`) }),
    );
    await screen.findByText(t(`${P}.reutiliser.copiee`, { n: 1 }));
    expect(appels.at(-1)).toMatchObject({ corps: { depuisSeanceId: "passee1" } });

    const lien = screen.getByRole("link", { name: t(`${P}.pdf.exporter`) });
    expect(lien.getAttribute("href")).toBe("/api/patients/p1/seances/seance1/pdf");
  });

  it("notes de séance enregistrées ; sans dictée locale, aucun bouton « Dicter »", async () => {
    afficher();
    fireEvent.change(screen.getByLabelText(t(`${P}.notes.notes`)), {
      target: { value: "Notes fictives." },
    });
    fireEvent.click(screen.getByRole("button", { name: t(`${P}.notes.enregistrer`) }));
    await screen.findByText(t(`${P}.notes.enregistrees`));
    expect(appels.at(-1)).toMatchObject({
      url: "/api/patients/p1/seances/seance1",
      methode: "PATCH",
      corps: { notes: "Notes fictives." },
    });
    // jsdom n'a pas de reconnaissance vocale : la dictée est annoncée indisponible.
    expect((await screen.findAllByText(t(`${P}.notes.dicteeIndisponible`))).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByRole("button", { name: /Dicter/ })).toBeNull();
  });
});
