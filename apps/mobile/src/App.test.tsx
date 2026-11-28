import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fauxServeur, MOT_DE_PASSE, useEnregistreurFictif, VENDREDI } from "../test/fixtures";
import { creerClientApi } from "./api/client";
import App from "./App";
import { creerCacheChiffre, stockageMemoire } from "./donnees/cache";
import { coffreMemoire } from "./donnees/coffre";
import { creerServiceRealisations } from "./donnees/realisations";
import type { Dependances } from "./dependances";

/** Un « téléphone » : coffre-fort et stockage qui survivent au redémarrage de l'appli. */
function telephone() {
  const serveur = fauxServeur();
  const coffre = coffreMemoire();
  const stockage = stockageMemoire();
  const fichiersSupprimes: string[] = [];
  /** Simule le retour du réseau (NetInfo). */
  const reseau: { revenu: () => void } = { revenu: () => undefined };
  const dependances = (): Dependances => {
    const client = creerClientApi({ baseUrl: "https://x.test/api", coffre, fetch: serveur.fetch });
    const cache = creerCacheChiffre({
      coffre,
      stockage,
      aleatoire: (n) => crypto.getRandomValues(new Uint8Array(n)),
    });
    const supprimerVoix = async (uri: string) => {
      fichiersSupprimes.push(uri);
    };
    return {
      client,
      cache,
      maintenant: () => VENDREDI,
      realisations: creerServiceRealisations({
        client,
        cache,
        uuid: () => crypto.randomUUID(),
        supprimerFichier: supprimerVoix,
        maintenant: () => VENDREDI,
      }),
      useEnregistreurVoix: useEnregistreurFictif,
      supprimerVoix,
      effacerVoix: async () => undefined,
      choisirPhoto: async () => null,
      surRetourReseau: (rappel) => {
        reseau.revenu = rappel;
        return () => undefined;
      },
    };
  };
  return { serveur, coffre, stockage, dependances, reseau, fichiersSupprimes };
}

function saisir(libelle: string, valeur: string) {
  fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } });
}

async function seConnecter(email: string) {
  fireEvent.click(await screen.findByRole("button", { name: "J'ai déjà un compte" }));
  saisir("Adresse e-mail", email);
  saisir("Mot de passe", MOT_DE_PASSE);
  fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
}

describe("parcours dans l'application", () => {
  it("parent : connexion, choix de Léa, exercices du jour ; puis sans réseau", async () => {
    const tel = telephone();
    const premier = render(<App dependances={tel.dependances()} />);

    await seConnecter("parent.lea@exemple.test");
    fireEvent.click(await screen.findByRole("button", { name: "Choisir Léa" }));
    // Léa a 7 ans : mode enfant, un exercice à la fois.
    expect(await screen.findByText("Trouver les rimes")).toBeTruthy();
    expect(screen.getByText("Exercice 1 sur 2")).toBeTruthy();
    expect(screen.getByText(/Niv\. 1 · 10 min/)).toBeTruthy();
    expect(screen.getByText(/Faites-le après le goûter/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "C'est parti !" })).toBeTruthy();
    // Messagerie activée pour Léa : l'onglet existe.
    expect(screen.getByRole("tab", { name: "Messages" })).toBeTruthy();

    // Jetons dans le coffre-fort ; aucun texte du programme en clair dans le stockage.
    expect(tel.coffre.contenu.has("session.jetons")).toBe(true);
    const stocke = [...tel.stockage.contenu.values()].join("");
    expect(stocke).not.toContain("rimes");
    expect(stocke).not.toContain("Léa");

    // L'application est fermée, puis rouverte SANS réseau.
    premier.unmount();
    tel.serveur.etat.horsLigne = true;
    render(<App dependances={tel.dependances()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Choisir Léa" }));
    expect(await screen.findByText("Trouver les rimes")).toBeTruthy();
    expect(screen.getByText(/Hors connexion/)).toBeTruthy();
  });

  it("patient adulte : directement son programme, sans onglet Messages", async () => {
    const tel = telephone();
    render(<App dependances={tel.dependances()} />);
    await seConnecter("paul@exemple.test");
    expect(await screen.findByText("Bonjour Paul !")).toBeTruthy();
    expect(screen.queryByText("Qui fait les exercices ?")).toBeNull();
    expect(screen.queryByRole("tab", { name: "Messages" })).toBeNull();
    // Conseils réservés aux parents (CLAUDE.md) : pas d'onglet pour le patient adulte.
    expect(screen.queryByRole("tab", { name: "Conseils" })).toBeNull();
  });

  it("parent : onglet Conseils, « J'ai compris », le serveur enregistre la lecture", async () => {
    const tel = telephone();
    render(<App dependances={tel.dependances()} />);
    await seConnecter("parent.lea@exemple.test");
    fireEvent.click(await screen.findByRole("button", { name: "Choisir Léa" }));
    fireEvent.click(await screen.findByRole("tab", { name: "Conseils" }));
    expect(await screen.findByText("Lire ensemble chaque soir")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "J'ai compris" }));
    expect(await screen.findByText("Lu ✓")).toBeTruthy();
    expect(tel.serveur.etat.appels).toContain(
      "POST /patients/p-lea/conseils/envois/env-lecture/lu",
    );
    expect(tel.serveur.conseils["p-lea"]?.[0]?.luLe).toBeTruthy();
  });

  it("mauvais mot de passe : message d'erreur, reste sur la connexion", async () => {
    const tel = telephone();
    render(<App dependances={tel.dependances()} />);
    fireEvent.click(await screen.findByRole("button", { name: "J'ai déjà un compte" }));
    saisir("Adresse e-mail", "parent.lea@exemple.test");
    saisir("Mot de passe", "mauvais");
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(tel.coffre.contenu.has("session.jetons")).toBe(false);
  });

  it("invitation : lien collé, compte activé, puis connexion", async () => {
    const tel = telephone();
    render(<App dependances={tel.dependances()} />);
    fireEvent.click(await screen.findByRole("button", { name: "J'ai reçu une invitation" }));
    saisir("Lien d'invitation", "lien sans jeton");
    saisir("Mot de passe (12 caractères au moins)", "un-mot-de-passe-long");
    fireEvent.click(screen.getByRole("button", { name: "Activer mon compte" }));
    expect(await screen.findByText(/Ce lien n'est pas reconnu/)).toBeTruthy();

    saisir("Lien d'invitation", `https://exemple.test/invitation#${"j".repeat(43)}`);
    saisir("Prénom", "Julie");
    saisir("Nom", "Exemple");
    fireEvent.click(screen.getByRole("button", { name: "Activer mon compte" }));
    expect(await screen.findByText(/Votre compte est prêt/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeTruthy();
  });

  it("déconnexion : jetons et copie hors ligne effacés", async () => {
    const tel = telephone();
    render(<App dependances={tel.dependances()} />);
    await seConnecter("parent.lea@exemple.test");
    fireEvent.click(await screen.findByRole("button", { name: "Choisir Léa" }));
    await screen.findByText("Trouver les rimes");
    fireEvent.click(screen.getByRole("button", { name: "Changer d'enfant" }));
    fireEvent.click(await screen.findByRole("button", { name: "Se déconnecter" }));
    expect(await screen.findByRole("button", { name: "J'ai déjà un compte" })).toBeTruthy();
    expect(tel.coffre.contenu.size).toBe(0);
    expect(tel.stockage.contenu.size).toBe(0);
  });
});

/** Fait l'exercice ouvert : « C'est fait », ressenti, score éventuel, Valider. */
async function faireLExercice(ressenti: string, score?: string) {
  fireEvent.click(await screen.findByRole("button", { name: "C'est fait !" }));
  fireEvent.click(await screen.findByRole("radio", { name: ressenti }));
  if (score) fireEvent.click(screen.getByRole("radio", { name: score }));
  fireEvent.click(screen.getByRole("button", { name: "Valider" }));
}

describe("faire un exercice (tâche 7)", () => {
  it("mode enfant : exercice, ressenti, score, étoiles ; la réalisation arrive au serveur", async () => {
    const tel = telephone();
    render(<App dependances={tel.dependances()} />);
    await seConnecter("parent.lea@exemple.test");
    fireEvent.click(await screen.findByRole("button", { name: "Choisir Léa" }));
    fireEvent.click(await screen.findByRole("button", { name: "C'est parti !" }));

    // Écran de l'exercice : consigne du niveau, sans la barre d'onglets.
    expect(await screen.findByText("Consigne du niveau 1.")).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();

    await faireLExercice("Difficile", "Score 3 sur 10");
    // Difficile et 3 sur 10 : autant d'étoiles, message encourageant.
    expect(await screen.findByText("Tu as gagné 3 étoiles !")).toBeTruthy();
    expect(screen.getByText(/Bravo d'avoir essayé/)).toBeTruthy();

    await waitFor(() => expect(tel.serveur.etat.realisations).toHaveLength(1));
    expect(tel.serveur.etat.realisations[0]).toMatchObject({
      patientId: "p-lea",
      elementId: "el-rimes",
      ressenti: "DIFFICILE",
      score: 3,
    });

    // Un seul exercice à la fois : on enchaîne directement sur le suivant.
    fireEvent.click(screen.getByRole("button", { name: "Exercice suivant" }));
    expect(await screen.findByRole("heading", { name: "Lecture partagée" })).toBeTruthy();
    await faireLExercice("Facile"); // pas de score prévu pour cet exercice
    expect(await screen.findByText(/Super ! C'était facile/)).toBeTruthy();
    // Plus d'exercice : « Terminer » ramène à Aujourd'hui, où tout est fait.
    fireEvent.click(screen.getByRole("button", { name: "Terminer" }));
    expect(await screen.findByText("Bravo, tout est fait pour aujourd'hui !")).toBeTruthy();
    expect(screen.getByText("6 étoiles gagnées aujourd'hui")).toBeTruthy();
    await waitFor(() => expect(tel.serveur.etat.realisations).toHaveLength(2));
  });

  it("sans réseau : gardée sur le téléphone, puis envoyée UNE fois au retour du réseau", async () => {
    const tel = telephone();
    render(<App dependances={tel.dependances()} />);
    await seConnecter("paul@exemple.test");
    await screen.findByText("Bonjour Paul !");

    tel.serveur.etat.horsLigne = true;
    fireEvent.click(
      await screen.findByRole("button", { name: "Faire l'exercice : Trouver les rimes" }),
    );
    await faireLExercice("Facile");
    expect(await screen.findByText(/Pas de réseau pour l'instant/)).toBeTruthy();
    expect(tel.serveur.etat.realisations).toHaveLength(0);
    // Rien en clair sur le téléphone.
    expect([...tel.stockage.contenu.values()].join("")).not.toContain("el-rimes");

    fireEvent.click(screen.getByRole("button", { name: "Retour au programme" }));
    expect(await screen.findByText(/Réalisations en attente d'envoi : 1/)).toBeTruthy();
    expect(screen.getByText("Fait aujourd'hui ✓")).toBeTruthy();

    // Le réseau revient : envoi automatique, une seule fois même si l'événement se répète.
    tel.serveur.etat.horsLigne = false;
    await act(async () => {
      tel.reseau.revenu();
      tel.reseau.revenu();
    });
    await waitFor(() => expect(tel.serveur.etat.realisations).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText(/en attente d'envoi/)).toBeNull());
    await act(async () => tel.reseau.revenu());
    expect(tel.serveur.etat.realisations).toHaveLength(1);
  });

  it("vue adulte : plus sobre (pas d'étoiles), réalisation envoyée", async () => {
    const tel = telephone();
    render(<App dependances={tel.dependances()} />);
    await seConnecter("paul@exemple.test");
    fireEvent.click(
      await screen.findByRole("button", { name: "Faire l'exercice : Trouver les rimes" }),
    );
    await faireLExercice("Moyen", "Score 7 sur 10");
    expect(await screen.findByText("Réalisation enregistrée.")).toBeTruthy();
    expect(screen.getByText(/Elle a été envoyée/)).toBeTruthy();
    expect(screen.queryByText(/étoiles/)).toBeNull();
    expect(tel.serveur.etat.realisations[0]).toMatchObject({ ressenti: "MOYEN", score: 7 });
  });

  it("voix : accord demandé une fois, enregistrement envoyé puis supprimé du téléphone", async () => {
    const tel = telephone();
    render(<App dependances={tel.dependances()} />);
    await seConnecter("paul@exemple.test");
    fireEvent.click(
      await screen.findByRole("button", { name: "Faire l'exercice : Trouver les rimes" }),
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Enregistrer la voix pendant l'exercice ?" }),
    );
    expect(screen.getByText(/connexion chiffrée/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "J'accepte l'enregistrement de la voix" }));
    fireEvent.click(await screen.findByRole("button", { name: "Enregistrer" }));
    expect(await screen.findByText(/Enregistrement en cours/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "⏹ Arrêter" }));
    expect(await screen.findByText("Voix enregistrée (0:05)")).toBeTruthy();

    await faireLExercice("Facile");
    await screen.findByText("Réalisation enregistrée.");
    await waitFor(() => expect(tel.serveur.etat.realisations[0]?.voix).toBe(1));
    expect(tel.fichiersSupprimes).toEqual(["file:///appli/voix/fictive.m4a"]);
  });
});
