import { t } from "@app/shared";

/** Appel JSON vers l'API depuis le navigateur. Le message d'erreur vient de l'API. */
export async function envoyerJson<T = unknown>(
  url: string,
  corps?: unknown,
): Promise<{ ok: true; donnees: T } | { ok: false; message: string }> {
  try {
    const reponse = await fetch(url, {
      method: "POST",
      headers: corps === undefined ? {} : { "content-type": "application/json" },
      body: corps === undefined ? undefined : JSON.stringify(corps),
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
