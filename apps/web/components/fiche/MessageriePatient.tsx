"use client";

import { useState } from "react";
import { t } from "@app/shared";
import { Message } from "@/components/Message";
import { envoyerJson } from "@/lib/client/api";

const F = "web.fiche.messagerie";

/** Exception de messagerie pour ce patient : comme le cabinet, activée ou désactivée. */
export function MessageriePatient({
  patientId,
  cabinet,
  initial,
}: {
  patientId: string;
  cabinet: boolean;
  initial: boolean | null;
}) {
  const [valeur, setValeur] = useState(initial === null ? "cabinet" : initial ? "oui" : "non");
  const [etat, setEtat] = useState<{ type: "erreur" | "succes"; texte: string } | null>(null);

  async function changer(nouvelle: string) {
    const avant = valeur;
    setValeur(nouvelle);
    const messagerieActivee = nouvelle === "cabinet" ? null : nouvelle === "oui";
    const r = await envoyerJson(
      `/api/patients/${encodeURIComponent(patientId)}/reglages/messagerie`,
      { messagerieActivee },
      "PUT",
    );
    if (!r.ok) {
      setValeur(avant);
      return setEtat({ type: "erreur", texte: r.message });
    }
    setEtat({ type: "succes", texte: t(`${F}.enregistre`) });
    // Le menu du dossier (onglet Messages) suit le nouveau réglage.
    window.location.reload();
  }

  return (
    <>
      <label className="champ">
        <span className="visuellement-cache">{t(`${F}.titre`)}</span>
        <select value={valeur} onChange={(e) => void changer(e.currentTarget.value)}>
          <option value="cabinet">
            {t(`${F}.commeCabinet`, {
              etat: cabinet ? t(`${F}.etatActivee`) : t(`${F}.etatDesactivee`),
            })}
          </option>
          <option value="oui">{t(`${F}.activee`)}</option>
          <option value="non">{t(`${F}.desactivee`)}</option>
        </select>
      </label>
      <p className="aide">{t(`${F}.aide`)}</p>
      {etat && <Message type={etat.type} texte={etat.texte} />}
    </>
  );
}
