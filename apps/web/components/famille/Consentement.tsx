"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { t } from "@app/shared";
import { Message } from "@/components/Message";
import { envoyerJson } from "@/lib/client/api";

/**
 * Écran de consentement « données de santé » pour un patient. Le texte vient du
 * fichier de traduction ; sa version est enregistrée côté serveur avec la date.
 */
export function DemandeConsentement({ patientId, prenom }: { patientId: string; prenom: string }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const paragraphes = t("consentement.donneesSante.texte").split("\n\n");

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnvoi(true);
    const r = await envoyerJson(`/api/patients/${encodeURIComponent(patientId)}/consentement`);
    setEnvoi(false);
    if (r.ok) router.refresh();
    else setErreur(r.message);
  }

  return (
    <section className="carte carte-consentement" aria-labelledby={`consentement-${patientId}`}>
      <h2 id={`consentement-${patientId}`}>{t("consentement.donneesSante.titre")}</h2>
      <p className="alerte">{t("consentement.donneesSante.requisPour", { prenom })}</p>
      {paragraphes.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <form onSubmit={soumettre}>
        <label className="choix">
          <input type="checkbox" required />
          {t("consentement.donneesSante.case")}
        </label>
        <Message type="erreur" texte={erreur} />
        <div>
          <button type="submit" disabled={envoi}>
            {t("consentement.donneesSante.bouton")}
          </button>
        </div>
      </form>
    </section>
  );
}

/** Retrait du consentement : plus aucune donnée n'est envoyée à ce compte. */
export function RetirerConsentement({ patientId }: { patientId: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="bouton-lien"
      onClick={async () => {
        const r = await envoyerJson(
          `/api/patients/${encodeURIComponent(patientId)}/consentement`,
          undefined,
          "DELETE",
        );
        if (r.ok) router.refresh();
      }}
    >
      {t("consentement.donneesSante.retirer")}
    </button>
  );
}
