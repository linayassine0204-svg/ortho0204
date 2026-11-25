"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { LONGUEUR_MIN_MOT_DE_PASSE, t } from "@app/shared";
import { Champ } from "@/components/Champ";
import { Message } from "@/components/Message";
import { champs, envoyerJson } from "@/lib/client/api";

export default function InscriptionPage() {
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const r = await envoyerJson<{ message: string }>(
      "/api/auth/inscription",
      champs(e.currentTarget),
    );
    setEnvoi(false);
    if (r.ok) setSucces(r.donnees.message);
    else setErreur(r.message);
  }

  return (
    <main className="page-formulaire">
      <h1>{t("web.inscription.titre")}</h1>
      {succes ? (
        <>
          <Message type="succes" texte={succes} />
          <Link className="bouton" href="/connexion">
            {t("web.accueil.seConnecter")}
          </Link>
        </>
      ) : (
        <form onSubmit={soumettre}>
          <Champ
            libelle={t("web.inscription.prenom")}
            name="prenom"
            required
            autoComplete="given-name"
          />
          <Champ
            libelle={t("web.inscription.nom")}
            name="nom"
            required
            autoComplete="family-name"
          />
          <Champ libelle={t("web.inscription.nomCabinet")} name="nomCabinet" required />
          <Champ
            libelle={t("web.inscription.email")}
            name="email"
            type="email"
            required
            autoComplete="email"
          />
          <Champ
            libelle={t("web.inscription.motDePasse")}
            name="motDePasse"
            type="password"
            required
            minLength={LONGUEUR_MIN_MOT_DE_PASSE}
            autoComplete="new-password"
          />
          <Message type="erreur" texte={erreur} />
          <button type="submit" disabled={envoi}>
            {t("web.inscription.bouton")}
          </button>
          <p>
            <Link href="/connexion">{t("web.inscription.dejaUnCompte")}</Link>
          </p>
        </form>
      )}
    </main>
  );
}
