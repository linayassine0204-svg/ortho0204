"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { TAILLE_MAX_DOCUMENT, TYPES_DOCUMENT, t } from "@app/shared";
import { Message } from "@/components/Message";
import { envoyerJson } from "@/lib/client/api";
import { dateFr, taille } from "@/lib/format";

interface Document {
  id: string;
  nomFichier: string;
  tailleOctets: number;
  createdAt: Date | string;
}

/** Documents de la Fiche : liste, téléchargement, ajout et suppression. */
export function Documents({ patientId, documents }: { patientId: string; documents: Document[] }) {
  const router = useRouter();
  const champ = useRef<HTMLInputElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const base = `/api/patients/${encodeURIComponent(patientId)}/documents`;

  async function ajouter(fichier: File | undefined) {
    if (!fichier) return;
    setErreur(null);
    if (fichier.size > TAILLE_MAX_DOCUMENT) {
      setErreur(t("erreurs.documentTropGros"));
      return;
    }
    setEnvoi(true);
    const formulaire = new FormData();
    formulaire.set("fichier", fichier);
    const r = await envoyerJson(base, formulaire);
    setEnvoi(false);
    if (champ.current) champ.current.value = "";
    if (r.ok) router.refresh();
    else setErreur(r.message);
  }

  async function supprimer(id: string) {
    if (!window.confirm(t("web.fiche.confirmerSuppression"))) return;
    const r = await envoyerJson(`${base}/${encodeURIComponent(id)}`, undefined, "DELETE");
    if (r.ok) router.refresh();
    else setErreur(r.message);
  }

  return (
    <div>
      {documents.length === 0 ? (
        <p>{t("web.fiche.aucunDocument")}</p>
      ) : (
        <ul className="liste-documents">
          {documents.map((d) => (
            <li key={d.id}>
              <span>
                <strong>{d.nomFichier}</strong>
                <span className="discret">
                  {" "}
                  · {taille(d.tailleOctets)} · {dateFr(d.createdAt)}
                </span>
              </span>
              <span className="actions">
                <a href={`${base}/${encodeURIComponent(d.id)}`}>{t("web.fiche.telecharger")}</a>
                <button type="button" className="bouton-lien" onClick={() => supprimer(d.id)}>
                  {t("web.fiche.supprimer")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <label className="champ champ-fichier">
        <span>{t("web.fiche.ajouterDocument")}</span>
        <input
          ref={champ}
          type="file"
          accept={TYPES_DOCUMENT.join(",")}
          disabled={envoi}
          onChange={(e) => ajouter(e.currentTarget.files?.[0])}
        />
        <span className="aide">{t("web.fiche.documentAide")}</span>
      </label>
      <Message type="erreur" texte={erreur} />
    </div>
  );
}
