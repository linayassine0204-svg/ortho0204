import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConseilModele } from "@app/shared";
import { EcranConseils, type ConseilEnvoyeVue, type ConseilsPatientVue } from "./EcranConseils";

// Écran Conseils : propositions en haut, envoi tel quel / modifié / écrit, « lu / pas lu ».

const oral = { slug: "langage-oral", nom: "Langage oral" };
function modele(id: string, titre: string, partiel: Partial<ConseilModele> = {}): ConseilModele {
  return {
    id,
    titre,
    aFaire: [`${titre} : à faire`],
    aEviter: [`${titre} : à éviter`],
    ageMin: 3,
    ageMax: 8,
    pathologies: [oral],
    aValider: true,
    ...partiel,
  };
}

function envoye(partiel: Partial<ConseilEnvoyeVue> = {}): ConseilEnvoyeVue {
  return {
    id: "c1",
    titre: "Reformuler sans corriger",
    aFaire: ["Répétez correctement."],
    aEviter: ["Dire « non »."],
    aValider: true,
    origine: "modele",
    modeleSourceId: "m1",
    nbEnvois: 1,
    dernierEnvoi: {
      id: "e1",
      envoyeLe: "2026-11-20T09:00:00.000Z",
      luLe: null,
      luPar: null,
    },
    plans: [],
    ...partiel,
  };
}

function donnees(partiel: Partial<ConseilsPatientVue> = {}): ConseilsPatientVue {
  return {
    patient: { id: "p1", prenom: "Léa", age: 7, pathologies: [oral] },
    proposes: [modele("m1", "Reformuler sans corriger"), modele("m2", "Raconter sa journée")],
    autres: [modele("m9", "Parler en jouant", { ageMin: 2, ageMax: 4 })],
    envoyes: [],
    destinataires: [{ id: "u1", prenom: "Julie", nom: "Exemple" }],
    ...partiel,
  };
}

let appels: { url: string; methode: string; corps: Record<string, unknown> }[];

beforeEach(() => {
  appels = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const corps = init.body ? JSON.parse(String(init.body)) : {};
      appels.push({ url, methode: init.method ?? "GET", corps });
      const c = corps.contenu ?? { titre: "Reformuler sans corriger", aFaire: ["x"], aEviter: [] };
      return new Response(
        JSON.stringify({
          conseil: envoye({ id: "nouveau", ...c, modeleSourceId: corps.modeleId ?? null }),
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<EcranConseils>", () => {
  it("affiche en haut les conseils proposés, avec étiquettes, tranche d'âge et « à valider »", () => {
    render(<EcranConseils initial={donnees()} />);
    const liste = screen.getByRole("list", { name: "Conseils proposés pour Léa" });
    const cartes = within(liste)
      .getAllByRole("listitem")
      .filter((li) => li.parentElement === liste);
    expect(cartes.map((c) => c.getAttribute("aria-label"))).toEqual([
      "Reformuler sans corriger",
      "Raconter sa journée",
    ]);
    const carte = within(cartes[0] as HTMLElement);
    expect(carte.getByText("3 à 8 ans")).toBeTruthy();
    expect(carte.getByText("À faire")).toBeTruthy();
    expect(carte.getByText("À éviter")).toBeTruthy();
    expect(carte.getByText(/à valider par un orthophoniste/)).toBeTruthy();
    expect(screen.getByText(/Langage oral\) et âge \(7 ans\)/)).toBeTruthy();
  });

  it("« Envoyer tel quel » : envoie le modèle sans contenu, maintenant, une fois", async () => {
    render(<EcranConseils initial={donnees()} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Envoyer tel quel" })[0] as HTMLElement);
    expect(screen.getByRole("heading", { name: "Envoyer ce conseil tel quel" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(appels).toHaveLength(1));
    expect(appels[0]).toEqual({
      url: "/api/patients/p1/conseils",
      methode: "POST",
      corps: { modeleId: "m1", planification: { repetition: "UNE_FOIS" } },
    });
    expect(await screen.findByText("Conseil envoyé à la famille.")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("Pas lu")).toBeTruthy();
  });

  it("« Modifier avant envoi » : le texte modifié part, une idée par ligne, chaque semaine", async () => {
    render(<EcranConseils initial={donnees()} />);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Modifier avant envoi" })[1] as HTMLElement,
    );
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Raconter avec Léa" } });
    fireEvent.change(screen.getByLabelText("À faire (une idée par ligne)"), {
      target: { value: "- Un moment par soir\n\n- Avec des mots du temps" },
    });
    fireEvent.click(screen.getByLabelText("Chaque semaine"));
    fireEvent.click(screen.getByRole("button", { name: "Envoyer" }));
    await waitFor(() => expect(appels).toHaveLength(1));
    expect(appels[0]?.corps).toEqual({
      modeleId: "m2",
      contenu: {
        titre: "Raconter avec Léa",
        aFaire: ["Un moment par soir", "Avec des mots du temps"],
        aEviter: ["Raconter sa journée : à éviter"],
      },
      planification: { repetition: "HEBDOMADAIRE" },
    });
  });

  it("« Écrire un conseil » : sans modèle, à une date choisie", async () => {
    render(<EcranConseils initial={donnees()} />);
    fireEvent.click(screen.getByRole("button", { name: "Écrire un conseil" }));
    expect(screen.queryByText(/à valider par un orthophoniste/, { selector: "strong" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Titre"), { target: { value: "Mon conseil" } });
    fireEvent.change(screen.getByLabelText("À éviter (une idée par ligne)"), {
      target: { value: "Les écrans le soir" },
    });
    fireEvent.click(screen.getByLabelText("À une date choisie"));
    fireEvent.change(screen.getByLabelText("Date d'envoi"), { target: { value: "2099-01-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Programmer l'envoi" }));
    await waitFor(() => expect(appels).toHaveLength(1));
    expect(appels[0]?.corps).toEqual({
      contenu: { titre: "Mon conseil", aFaire: [], aEviter: ["Les écrans le soir"] },
      planification: { repetition: "UNE_FOIS", date: "2099-01-15" },
    });
    expect(await screen.findByText("Envoi prévu le 15/01/2099.")).toBeTruthy();
  });

  it("vue « lu / pas lu » par conseil, et « déjà envoyé » sur le modèle", () => {
    render(
      <EcranConseils
        initial={donnees({
          envoyes: [
            envoye({
              dernierEnvoi: {
                id: "e1",
                envoyeLe: "2026-11-20T09:00:00.000Z",
                luLe: "2026-11-21T18:00:00.000Z",
                luPar: "Julie",
              },
            }),
            envoye({
              id: "c2",
              titre: "Mon conseil",
              origine: "libre",
              modeleSourceId: null,
              aValider: false,
            }),
          ],
        })}
      />,
    );
    const lignes = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(within(lignes[0] as HTMLElement).getByText(/Lu le 21\/11\/2026 par Julie/)).toBeTruthy();
    expect(within(lignes[1] as HTMLElement).getByText("Pas lu")).toBeTruthy();
    expect(within(lignes[1] as HTMLElement).getByText(/Écrit par vous/)).toBeTruthy();
    const carte = screen.getByRole("listitem", { name: "Reformuler sans corriger" });
    expect(within(carte).getByText("Déjà envoyé")).toBeTruthy();
  });

  it("répétition : affiche le prochain envoi et permet de l'arrêter", async () => {
    render(
      <EcranConseils
        initial={donnees({
          envoyes: [
            envoye({
              plans: [
                { id: "pl1", repetition: "HEBDOMADAIRE", prochainEnvoi: "2026-11-27T09:00:00Z" },
              ],
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText("Chaque semaine — prochain envoi le 27/11/2026")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Arrêter la répétition : Reformuler sans corriger" }),
    );
    await waitFor(() => expect(appels).toHaveLength(1));
    expect(appels[0]).toMatchObject({
      url: "/api/patients/p1/conseils/plans/pl1",
      methode: "DELETE",
    });
  });

  it("sans pathologie renseignée : invite à compléter la Fiche", () => {
    render(
      <EcranConseils
        initial={donnees({
          patient: { id: "p1", prenom: "Léa", age: 7, pathologies: [] },
          proposes: [],
        })}
      />,
    );
    expect(screen.getByText(/Renseignez la pathologie de Léa/)).toBeTruthy();
  });
});
