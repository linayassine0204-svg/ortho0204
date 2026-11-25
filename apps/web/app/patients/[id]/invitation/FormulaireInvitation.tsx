"use client";

import { useState, type FormEvent } from "react";
import { t } from "@app/shared";
import { Champ } from "@/components/Champ";
import { Message } from "@/components/Message";
import { champs, envoyerJson } from "@/lib/client/api";

interface Reponse {
  lien: string;
  emailEnvoye: boolean;
}

export function FormulaireInvitation({ patientId }: { patientId: string }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<Reponse | null>(null);

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreur(null);
    const r = await envoyerJson<Reponse>(
      `/api/patients/${encodeURIComponent(patientId)}/invitations`,
      champs(e.currentTarget),
    );
    if (r.ok) setResultat(r.donnees);
    else setErreur(r.message);
  }

  if (resultat) {
    return (
      <div>
        <Message type="succes" texte={t("web.invitation.lienCree")} />
        <input
          className="lien"
          readOnly
          value={resultat.lien}
          aria-label={t("web.invitation.lienCree")}
        />
        {!resultat.emailEnvoye && <p>{t("web.invitation.emailNonEnvoye")}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={soumettre}>
      <Champ libelle={t("web.invitation.email")} name="email" type="email" required />
      <fieldset>
        <legend>{t("web.invitation.role")}</legend>
        <label className="choix">
          <input type="radio" name="role" value="PARENT" defaultChecked />
          {t("web.invitation.roleParent")}
        </label>
        <label className="choix">
          <input type="radio" name="role" value="PATIENT_ADULT" />
          {t("web.invitation.rolePatient")}
        </label>
      </fieldset>
      <Message type="erreur" texte={erreur} />
      <button type="submit">{t("web.invitation.bouton")}</button>
    </form>
  );
}
