"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { t } from "@app/shared";
import { Message } from "@/components/Message";
import { envoyerJson } from "@/lib/client/api";

/**
 * Formulaire d'une carte de la Fiche : envoie les champs du formulaire
 * (PATCH /api/patients/:id/fiche), puis rafraîchit la page.
 * `pathologies` : envoie aussi la liste des cases cochées (même vide).
 */
export function FormulaireFiche({
  patientId,
  pathologies = false,
  children,
}: {
  patientId: string;
  pathologies?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [etat, setEtat] = useState<{ type: "erreur" | "succes"; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnvoi(true);
    setEtat(null);
    const donnees = new FormData(e.currentTarget);
    const corps: Record<string, unknown> = {};
    donnees.forEach((valeur, cle) => {
      if (cle !== "pathologieIds" && typeof valeur === "string") corps[cle] = valeur;
    });
    if (pathologies) corps.pathologieIds = donnees.getAll("pathologieIds");
    const r = await envoyerJson(
      `/api/patients/${encodeURIComponent(patientId)}/fiche`,
      corps,
      "PATCH",
    );
    setEnvoi(false);
    if (r.ok) {
      setEtat({ type: "succes", texte: t("web.fiche.enregistre") });
      router.refresh();
    } else setEtat({ type: "erreur", texte: r.message });
  }

  return (
    <form onSubmit={soumettre}>
      {children}
      {etat && <Message type={etat.type} texte={etat.texte} />}
      <div>
        <button type="submit" disabled={envoi}>
          {t("web.fiche.enregistrer")}
        </button>
      </div>
    </form>
  );
}
