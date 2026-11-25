"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { t } from "@app/shared";
import { Champ } from "@/components/Champ";
import { Message } from "@/components/Message";
import { champs, envoyerJson } from "@/lib/client/api";

export default function ConnexionPage() {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const r = await envoyerJson("/api/auth/connexion", champs(e.currentTarget));
    setEnvoi(false);
    if (r.ok) router.push("/patients");
    else setErreur(r.message);
  }

  return (
    <main className="page-formulaire">
      <h1>{t("web.connexion.titre")}</h1>
      <form onSubmit={soumettre}>
        <Champ
          libelle={t("web.connexion.email")}
          name="email"
          type="email"
          required
          autoComplete="username"
        />
        <Champ
          libelle={t("web.connexion.motDePasse")}
          name="motDePasse"
          type="password"
          required
          autoComplete="current-password"
        />
        <Message type="erreur" texte={erreur} />
        <button type="submit" disabled={envoi}>
          {t("web.connexion.bouton")}
        </button>
        <p>
          <Link href="/inscription">{t("web.connexion.pasDeCompte")}</Link>
        </p>
      </form>
    </main>
  );
}
