import { t } from "@app/shared";
import { ErreurApi, ErreurReseau } from "./client";

/** Message à afficher pour une erreur (jamais de détail technique). */
export function messageErreur(erreur: unknown): string {
  if (erreur instanceof ErreurReseau || erreur instanceof ErreurApi) return erreur.message;
  return t("erreurs.inconnue");
}
