"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { t } from "@app/shared";
import { Champ } from "@/components/Champ";
import { CasesPathologies } from "@/components/fiche/CasesPathologies";
import { Message } from "@/components/Message";
import { envoyerJson } from "@/lib/client/api";
import type { Categorie } from "@/lib/serveur/categories";

export function FormulaireNouveauPatient({ categories }: { categories: Categorie[] }) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEnvoi(true);
    setErreur(null);
    const donnees = new FormData(e.currentTarget);
    const r = await envoyerJson<{ id: string }>("/api/patients", {
      prenom: donnees.get("prenom"),
      nom: donnees.get("nom"),
      dateNaissance: donnees.get("dateNaissance"),
      pathologieIds: donnees.getAll("pathologieIds"),
    });
    if (r.ok) {
      router.push(`/patients/${r.donnees.id}/fiche`);
    } else {
      setEnvoi(false);
      setErreur(r.message);
    }
  }

  return (
    <form onSubmit={soumettre} className="carte">
      <Champ libelle={t("web.nouveauPatient.prenom")} name="prenom" required autoComplete="off" />
      <Champ libelle={t("web.nouveauPatient.nom")} name="nom" required autoComplete="off" />
      <Champ
        libelle={t("web.nouveauPatient.dateNaissance")}
        name="dateNaissance"
        type="date"
        required
        max={new Date().toISOString().slice(0, 10)}
      />
      <CasesPathologies
        legende={t("web.nouveauPatient.pathologies")}
        categories={categories}
        cochees={[]}
      />
      <Message type="erreur" texte={erreur} />
      <div className="actions">
        <button type="submit" disabled={envoi}>
          {t("web.nouveauPatient.bouton")}
        </button>
        <Link href="/patients">{t("web.nouveauPatient.annuler")}</Link>
      </div>
    </form>
  );
}
