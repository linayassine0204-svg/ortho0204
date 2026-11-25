"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { LONGUEUR_MIN_MOT_DE_PASSE, t } from "@app/shared";
import { Champ } from "@/components/Champ";
import { Message } from "@/components/Message";
import { champs, envoyerJson } from "@/lib/client/api";

// Le jeton est après « # » dans le lien : le navigateur ne l'envoie jamais au
// serveur dans l'URL (ni journaux, ni en-tête Referer). Il n'est transmis que
// dans le corps de la requête d'activation.
const lireJeton = () => window.location.hash.slice(1);
const abonnement = (rappel: () => void) => {
  window.addEventListener("hashchange", rappel);
  return () => window.removeEventListener("hashchange", rappel);
};

export default function AccepterInvitationPage() {
  const jeton = useSyncExternalStore(abonnement, lireJeton, () => "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreur(null);
    const saisie = champs(e.currentTarget);
    const corps = {
      jeton,
      motDePasse: saisie.motDePasse,
      ...(saisie.prenom ? { prenom: saisie.prenom } : {}),
      ...(saisie.nom ? { nom: saisie.nom } : {}),
    };
    const r = await envoyerJson("/api/invitations/accepter", corps);
    if (r.ok) {
      setSucces(true);
      window.history.replaceState(null, "", window.location.pathname);
    } else setErreur(r.message);
  }

  return (
    <main className="page-formulaire">
      <h1>{t("web.accepterInvitation.titre")}</h1>
      {succes ? (
        <>
          <Message type="succes" texte={t("web.accepterInvitation.succes")} />
          <Link className="bouton" href="/connexion">
            {t("web.accepterInvitation.seConnecter")}
          </Link>
        </>
      ) : !jeton ? (
        <Message type="erreur" texte={t("web.accepterInvitation.lienAbsent")} />
      ) : (
        <form onSubmit={soumettre}>
          <p>{t("web.accepterInvitation.explication")}</p>
          <Champ
            libelle={t("web.accepterInvitation.prenom")}
            name="prenom"
            autoComplete="given-name"
          />
          <Champ libelle={t("web.accepterInvitation.nom")} name="nom" autoComplete="family-name" />
          <Champ
            libelle={t("web.accepterInvitation.motDePasse")}
            name="motDePasse"
            type="password"
            required
            autoComplete="new-password"
            minLength={LONGUEUR_MIN_MOT_DE_PASSE}
          />
          <p className="aide">{t("web.accepterInvitation.dejaUnCompte")}</p>
          <Message type="erreur" texte={erreur} />
          <button type="submit">{t("web.accepterInvitation.bouton")}</button>
        </form>
      )}
    </main>
  );
}
