// Le lien d'invitation a la forme https://…/invitation#JETON (ou, ouvert dans
// l'application, suivipatients://invitation#JETON). Le jeton est après « # » : il
// n'est jamais envoyé dans une URL, seulement dans le corps de la requête d'activation.

const FORMAT_JETON = /^[A-Za-z0-9_-]{20,200}$/;

/** Extrait le jeton d'un lien d'invitation collé (ou du jeton seul). `null` si invalide. */
export function extraireJetonInvitation(texte: string): string | null {
  const nettoye = texte.trim();
  const diese = nettoye.indexOf("#");
  if (diese >= 0) {
    const avant = nettoye.slice(0, diese);
    if (!/(^|\/)invitation\/?$/.test(avant)) return null;
  }
  const jeton = diese >= 0 ? nettoye.slice(diese + 1) : nettoye;
  return FORMAT_JETON.test(jeton) ? jeton : null;
}
