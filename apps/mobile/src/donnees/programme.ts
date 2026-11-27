import { jourLocal, planJour, planSemaine, type ElementEnvoye } from "@app/shared";
import { ErreurApi, ErreurReseau, type ClientApi } from "../api/client";
import type { ProgrammeEnvoye } from "../session/types";
import type { Cache } from "./cache";
import type { FaitLocal } from "./realisations";

/** Copie locale (chiffrée) du programme envoyé, pour l'afficher sans réseau. */
interface ProgrammeEnCache {
  programme: ProgrammeEnvoye | null;
  enregistreLe: string;
}

export type ChargementProgramme =
  | { etat: "ok"; programme: ProgrammeEnvoye | null; horsLigne: false }
  | { etat: "ok"; programme: ProgrammeEnvoye | null; horsLigne: true; enregistreLe: string }
  | { etat: "horsLigneSansCache" }
  | { etat: "consentementRequis" }
  | { etat: "erreur"; message: string };

export const cleCacheProgramme = (patientId: string) => `programme.${patientId}`;

/**
 * Charge le programme envoyé du patient. On demande la semaine au serveur, mais on ne
 * garde que le programme : le plan du jour se recalcule sur le téléphone (mêmes
 * fonctions que le serveur, `@app/shared`), donc il reste juste hors ligne même un
 * autre jour de la semaine.
 * - Réseau OK : le cache est mis à jour.
 * - Pas de réseau : on affiche le cache, avec sa date.
 * - Accès retiré (404) ou consentement retiré (403) : le cache est effacé.
 * - Session expirée (401) : l'erreur remonte (retour à la connexion).
 */
export async function chargerProgramme(
  client: ClientApi,
  cache: Cache,
  patientId: string,
  maintenant = new Date(),
): Promise<ChargementProgramme> {
  const cle = cleCacheProgramme(patientId);
  try {
    const { date } = jourLocal(maintenant);
    const reponse = await client.get<{ programme: ProgrammeEnvoye | null }>(
      `/patients/${encodeURIComponent(patientId)}/programme/semaine?date=${date}`,
    );
    const programme = reponse.programme;
    await cache.enregistrer<ProgrammeEnCache>(cle, {
      programme,
      enregistreLe: maintenant.toISOString(),
    });
    return { etat: "ok", programme, horsLigne: false };
  } catch (erreur) {
    if (erreur instanceof ErreurReseau) {
      const copie = await cache.lire<ProgrammeEnCache>(cle);
      if (!copie) return { etat: "horsLigneSansCache" };
      return {
        etat: "ok",
        programme: copie.programme,
        horsLigne: true,
        enregistreLe: copie.enregistreLe,
      };
    }
    if (erreur instanceof ErreurApi) {
      if (erreur.status === 401) throw erreur;
      if (erreur.status === 404 || erreur.status === 403) await cache.effacer(cle);
      if (erreur.code === "consentement_requis") return { etat: "consentementRequis" };
      return { etat: "erreur", message: erreur.message };
    }
    throw erreur;
  }
}

/** Exercices du jour (jours fixés) et ceux à placer librement dans la semaine. */
export function exercicesDuJour(programme: ProgrammeEnvoye | null, maintenant = new Date()) {
  const { date } = jourLocal(maintenant);
  return planJour(programme?.elements ?? [], date);
}

/** Un exercice de l'écran « Aujourd'hui », avec ce qui a déjà été fait. */
export interface ExerciceDuJour {
  element: ElementEnvoye;
  /** Déjà fait aujourd'hui (sur ce téléphone). */
  faitAujourdhui: boolean;
  /** Exercice sans jour fixé : fois restantes cette semaine (sinon null). */
  restantSemaine: number | null;
}

/**
 * Exercices du jour et de la semaine, croisés avec les réalisations notées sur le
 * téléphone. Sert à la liste (vue adulte) et à la file « un exercice à la fois »
 * (mode enfant).
 */
export function etatDuJour(
  programme: ProgrammeEnvoye | null,
  faits: readonly FaitLocal[],
  maintenant = new Date(),
): { duJour: ExerciceDuJour[]; dansLaSemaine: ExerciceDuJour[] } {
  const elements = programme?.elements ?? [];
  const { date } = jourLocal(maintenant);
  const semaine = planSemaine(elements, date);
  const faitLe = (e: ElementEnvoye, jour: string) =>
    faits.some((f) => f.elementId === e.elementId && f.date === jour);
  const faitsSemaine = (e: ElementEnvoye) =>
    faits.filter(
      (f) => f.elementId === e.elementId && f.date >= semaine.debut && f.date <= semaine.fin,
    ).length;
  const plan = planJour(elements, date);
  return {
    duJour: plan.elements.map((element) => ({
      element,
      faitAujourdhui: faitLe(element, date),
      restantSemaine: null,
    })),
    dansLaSemaine: plan.sansJourFixe.map((element) => ({
      element,
      faitAujourdhui: faitLe(element, date),
      restantSemaine: Math.max(0, element.foisParSemaine - faitsSemaine(element)),
    })),
  };
}

/** Mode enfant : les exercices encore à faire aujourd'hui, dans l'ordre du programme. */
export function fileEnfant(etat: ReturnType<typeof etatDuJour>): ElementEnvoye[] {
  return [
    ...etat.duJour.filter((x) => !x.faitAujourdhui),
    ...etat.dansLaSemaine.filter((x) => !x.faitAujourdhui && (x.restantSemaine ?? 0) > 0),
  ].map((x) => x.element);
}
