import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fauxServeur, MOT_DE_PASSE, VENDREDI } from "../test/fixtures";
import { creerClientApi } from "./api/client";
import App from "./App";
import { creerCacheChiffre, stockageMemoire } from "./donnees/cache";
import { coffreMemoire } from "./donnees/coffre";
import type { Dependances } from "./dependances";

/** Un « téléphone » : coffre-fort et stockage qui survivent au redémarrage de l'appli. */
function telephone() {
  const serveur = fauxServeur();
  const coffre = coffreMemoire();
  const stockage = stockageMemoire();
  const dependances = (): Dependances => ({
    client: creerClientApi({ baseUrl: "https://x.test/api", coffre, fetch: serveur.fetch }),
    cache: creerCacheChiffre({
      coffre,
      stockage,
      aleatoire: (n) => crypto.getRandomValues(new Uint8Array(n)),
    }),
    maintenant: () => VENDREDI,
  });
  return { serveur, coffre, stockage, dependances };
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
    expect(await screen.findByText("Trouver les rimes")).toBeTruthy();
    expect(screen.getByText("Niv. 1")).toBeTruthy();
    expect(screen.getByText("10 min")).toBeTruthy();
    expect(screen.getByText("Faites-le après le goûter, 10 minutes suffisent.")).toBeTruthy();
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
    expect(screen.getByRole("tab", { name: "Conseils" })).toBeTruthy();
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
