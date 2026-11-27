"use client";

import { useState } from "react";
import { rythme, t, type ElementEnvoye, type ExerciceBibliotheque, type Niveau } from "@app/shared";
import { envoyerJson, type ResultatApi } from "@/lib/client/api";

export interface EtatProgramme {
  elements: ElementEnvoye[];
  derniereVersion: { numero: number; envoyeLe: Date | string } | null;
  modifieDepuisEnvoi: boolean;
  destinataires: { id: string; prenom: string; nom: string }[];
}

export type MessageEcran = { type: "erreur" | "succes"; texte: string } | null;

/**
 * Programme à la maison d'un patient : état et appels à l'API.
 * Partagé par l'écran Programme et par l'ajustement rapide de l'écran Préparation
 * (un seul code, un seul programme).
 */
export function useProgramme(patientId: string, initial: EtatProgramme) {
  const [elements, setElements] = useState(initial.elements);
  const [derniere, setDerniere] = useState(initial.derniereVersion);
  const [modifie, setModifie] = useState(initial.modifieDepuisEnvoi);
  const [message, setMessage] = useState<MessageEcran>(null);
  const [envoi, setEnvoi] = useState(false);
  const base = `/api/patients/${encodeURIComponent(patientId)}/programme`;

  /** Affiche l'erreur éventuelle ; renvoie true si l'appel a réussi. */
  function reussi(r: ResultatApi<unknown>): boolean {
    if (!r.ok) {
      setMessage({ type: "erreur", texte: r.message });
      return false;
    }
    setMessage(null);
    if (derniere) setModifie(true);
    return true;
  }

  /** Données de la réponse, ou null en cas d'erreur (message affiché). */
  function traiter<T>(r: ResultatApi<T>): T | null {
    return reussi(r) && r.ok ? r.donnees : null;
  }

  const remplacer = (el: ElementEnvoye) =>
    setElements((liste) => liste.map((x) => (x.elementId === el.elementId ? el : x)));

  async function ajouter(exercice: ExerciceBibliotheque, niveau: Niveau) {
    const d = traiter(
      await envoyerJson<{ element: ElementEnvoye }>(`${base}/elements`, {
        exerciceId: exercice.id,
        niveau,
      }),
    );
    if (!d) return false;
    setElements((liste) => [...liste, d.element]);
    return true;
  }

  async function modifier(el: ElementEnvoye, champs: Partial<ElementEnvoye>) {
    // Affichage immédiat (cases, listes) ; on revient en arrière si le serveur refuse.
    if (champs.jours !== undefined || champs.foisParSemaine !== undefined) {
      const jours = champs.jours ?? el.jours;
      remplacer({
        ...el,
        ...champs,
        foisParSemaine: rythme(champs.foisParSemaine ?? el.foisParSemaine, jours),
      });
    }
    const d = traiter(
      await envoyerJson<{ element: ElementEnvoye }>(
        `${base}/elements/${encodeURIComponent(el.elementId)}`,
        champs,
        "PATCH",
      ),
    );
    remplacer(d ? d.element : el);
    return Boolean(d);
  }

  async function ajuster(el: ElementEnvoye, sens: "monter" | "baisser") {
    const d = traiter(
      await envoyerJson<{ element: ElementEnvoye }>(
        `${base}/elements/${encodeURIComponent(el.elementId)}/ajuster`,
        { sens },
      ),
    );
    if (d) remplacer(d.element);
  }

  async function retirer(el: ElementEnvoye) {
    const r = await envoyerJson(
      `${base}/elements/${encodeURIComponent(el.elementId)}`,
      undefined,
      "DELETE",
    );
    if (reussi(r)) setElements((liste) => liste.filter((x) => x.elementId !== el.elementId));
  }

  async function deplacer(index: number, decalage: -1 | 1) {
    const cible = index + decalage;
    if (cible < 0 || cible >= elements.length) return;
    const nouvel = [...elements];
    [nouvel[index], nouvel[cible]] = [
      nouvel[cible] as ElementEnvoye,
      nouvel[index] as ElementEnvoye,
    ];
    const avant = elements;
    setElements(nouvel); // affichage immédiat, annulé si le serveur refuse
    const r = await envoyerJson(
      `${base}/ordre`,
      { elementIds: nouvel.map((e) => e.elementId) },
      "PUT",
    );
    if (!reussi(r)) setElements(avant);
  }

  async function envoyer() {
    setEnvoi(true);
    const d = traiter(
      await envoyerJson<{ version: { numero: number; envoyeLe: string } }>(`${base}/envoi`),
    );
    setEnvoi(false);
    if (!d) return;
    setDerniere(d.version);
    setModifie(false);
    setMessage({ type: "succes", texte: t("web.programme.envoiOk", { numero: d.version.numero }) });
  }

  return {
    elements,
    derniere,
    modifie,
    message,
    envoi,
    ajouter,
    modifier,
    ajuster,
    retirer,
    deplacer,
    envoyer,
  };
}
