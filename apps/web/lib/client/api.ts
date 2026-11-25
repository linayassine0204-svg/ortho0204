import { t } from "@app/shared";

export type ResultatApi<T> = { ok: true; donnees: T } | { ok: false; message: string };

/**
 * Appel vers l'API depuis le navigateur (JSON, ou FormData pour un fichier).
 * Le message d'erreur affiché vient de l'API (fichier de traduction).
 */
export async function envoyerJson<T = unknown>(
  url: string,
  corps?: unknown,
  methode: "POST" | "PATCH" | "DELETE" = "POST",
): Promise<ResultatApi<T>> {
  const estFormulaire = corps instanceof FormData;
  let corpsRequete: BodyInit | undefined;
  if (estFormulaire) corpsRequete = corps;
  else if (corps !== undefined) corpsRequete = JSON.stringify(corps);
  try {
    const reponse = await fetch(url, {
      method: methode,
      headers: corps === undefined || estFormulaire ? {} : { "content-type": "application/json" },
      body: corpsRequete,
      credentials: "same-origin",
    });
    const texte = await reponse.text();
    const donnees = texte ? (JSON.parse(texte) as unknown) : null;
    if (reponse.ok) return { ok: true, donnees: donnees as T };
    const message = (donnees as { erreur?: { message?: string } } | null)?.erreur?.message;
    return { ok: false, message: message ?? t("erreurs.inconnue") };
  } catch {
    return { ok: false, message: t("erreurs.inconnue") };
  }
}

/** Lit les champs texte d'un formulaire. */
export function champs(formulaire: HTMLFormElement): Record<string, string> {
  const resultat: Record<string, string> = {};
  new FormData(formulaire).forEach((valeur, cle) => {
    if (typeof valeur === "string") resultat[cle] = valeur;
  });
  return resultat;
}
