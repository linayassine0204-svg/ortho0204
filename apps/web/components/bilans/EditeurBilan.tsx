"use client";

import Link from "next/link";
import { useState } from "react";
import {
  STATUTS_DOCUMENT,
  estCourrier,
  jourFr,
  statutSection,
  t,
  type SectionDocument,
} from "@app/shared";
import { Message } from "@/components/Message";
import type { MessageEcran } from "@/components/programme/useProgramme";
import { envoyerJson, type ResultatApi } from "@/lib/client/api";
import type { VueBilan } from "@/lib/serveur/bilans";
import { BadgeStatut } from "./BadgeStatut";

const B = "web.bilans";
type Reponse = { bilan: VueBilan; partageRetire?: boolean };

/**
 * Éditeur d'un document : parties automatiques (à relire) et parties à écrire,
 * export PDF / Word, et case « Partager avec la famille » (décochée par défaut).
 */
export function EditeurBilan({
  patientId,
  initial,
  familleConsentante,
  naviguer = (url) => window.location.assign(url),
}: {
  patientId: string;
  initial: VueBilan;
  familleConsentante: number;
  naviguer?: (url: string) => void;
}) {
  const [bilan, setBilan] = useState(initial);
  const [message, setMessage] = useState<MessageEcran>(null);
  const liste = `/patients/${encodeURIComponent(patientId)}/bilans`;
  const api = `/api${liste}/${encodeURIComponent(bilan.id)}`;

  /** Applique la réponse de l'API ; signale un partage retiré par la modification. */
  function appliquer(r: ResultatApi<Reponse>, succes?: string): boolean {
    if (!r.ok) {
      setMessage({ type: "erreur", texte: r.message });
      return false;
    }
    setBilan(r.donnees.bilan);
    if (r.donnees.partageRetire)
      setMessage({ type: "erreur", texte: t(`${B}.partage.retireAuto`) });
    else setMessage(succes ? { type: "succes", texte: succes } : null);
    return true;
  }

  async function enregistrerPartie(s: SectionDocument, corps: { contenu?: string; relu?: true }) {
    return appliquer(
      await envoyerJson<Reponse>(`${api}/sections/${encodeURIComponent(s.cle)}`, corps, "PATCH"),
    );
  }

  async function actualiser() {
    if (!window.confirm(t(`${B}.editeur.actualiserConfirmer`))) return;
    appliquer(await envoyerJson<Reponse>(`${api}/actualiser`, {}), t(`${B}.editeur.actualise`));
  }

  async function partager(partage: boolean) {
    const avant = bilan;
    setBilan({ ...bilan, partage }); // affichage immédiat, annulé si le serveur refuse
    if (!appliquer(await envoyerJson<Reponse>(`${api}/partage`, { partage }, "PUT"))) {
      setBilan(avant);
    }
  }

  async function supprimer() {
    if (!window.confirm(t(`${B}.editeur.supprimerConfirmer`))) return;
    const r = await envoyerJson(api, undefined, "DELETE");
    if (r.ok) naviguer(liste);
    else setMessage({ type: "erreur", texte: r.message });
  }

  const relu = bilan.statut === "REMPLI";

  return (
    <div className="editeur-bilan">
      <p>
        <Link href={liste}>← {t(`${B}.editeur.retour`)}</Link>
      </p>

      <EnTete
        bilan={bilan}
        api={api}
        onReponse={(r) => appliquer(r, t(`${B}.editeur.enregistre`))}
      />

      <div className="barre-bilan">
        <span>
          {t(`${B}.editeur.statut`, { statut: "" })}
          <BadgeStatut statut={bilan.statut} />
        </span>
        <button type="button" className="bouton-secondaire-vert" onClick={actualiser}>
          {t(`${B}.editeur.actualiser`)}
        </button>
        <a className="bouton bouton-exporter" href={`${api}/pdf`} target="_blank" rel="noopener">
          {t(`${B}.editeur.exporterPdf`)}
        </a>
        <a className="bouton bouton-exporter" href={`${api}/docx`}>
          {t(`${B}.editeur.exporterWord`)}
        </a>
      </div>
      {bilan.modele && <p className="badge-a-valider">{t(`${B}.modeles.aValider`)}</p>}
      {!relu && <p className="aide">{t(`${B}.editeur.brouillon`)}</p>}
      {message && <Message type={message.type} texte={message.texte} />}

      <ul className="legende-statuts" aria-label={t(`${B}.liste.colStatut`)}>
        {STATUTS_DOCUMENT.map((s) => (
          <li key={s}>
            <BadgeStatut statut={s} /> {t(`${B}.statutsAide.${s}`)}
          </li>
        ))}
      </ul>

      <ol className="parties-bilan">
        {bilan.sections.map((s) => (
          <Partie
            key={`${s.cle}-${bilan.modifieLe}`}
            section={s}
            onEnregistrer={(contenu) => enregistrerPartie(s, { contenu })}
            onRelu={() => enregistrerPartie(s, { relu: true })}
          />
        ))}
      </ol>

      <section className="carte partage-bilan" aria-labelledby="titre-partage">
        <h2 id="titre-partage">{t(`${B}.partage.titre`)}</h2>
        <label className="choix">
          <input
            type="checkbox"
            checked={bilan.partage}
            disabled={!bilan.partage && !relu}
            onChange={(e) => void partager(e.currentTarget.checked)}
          />
          {t(`${B}.partage.case`)}
        </label>
        <p className="aide">{t(`${B}.partage.aide`)}</p>
        {!relu && !bilan.partage && <p className="aide">{t(`${B}.partage.pasRelu`)}</p>}
        {bilan.partage && bilan.partageLe && (
          <p className="statut-ok">
            {t(`${B}.partage.partageLe`, {
              date: new Date(bilan.partageLe).toLocaleDateString("fr-FR", {
                timeZone: "Europe/Paris",
              }),
            })}
          </p>
        )}
        {familleConsentante === 0 && <p className="aide">{t(`${B}.partage.personne`)}</p>}
      </section>

      <button type="button" className="bouton-lien bouton-danger" onClick={supprimer}>
        {t(`${B}.editeur.supprimer`)}
      </button>
    </div>
  );
}

function EnTete({
  bilan,
  api,
  onReponse,
}: {
  bilan: VueBilan;
  api: string;
  onReponse: (r: ResultatApi<Reponse>) => void;
}) {
  const [titre, setTitre] = useState(bilan.titre);
  const [destinataire, setDestinataire] = useState(bilan.destinataire ?? "");
  const change = titre !== bilan.titre || destinataire !== (bilan.destinataire ?? "");
  return (
    <div className="entete-bilan">
      <label className="champ">
        <span>{t(`${B}.editeur.titreDocument`)}</span>
        <input
          type="text"
          maxLength={200}
          value={titre}
          onChange={(e) => setTitre(e.currentTarget.value)}
        />
      </label>
      <p className="discret">
        {t(`${B}.types.${bilan.type}`)} ·{" "}
        {bilan.dateDebut
          ? t(`${B}.editeur.periode`, { debut: jourFr(bilan.dateDebut), fin: jourFr(bilan.date) })
          : t(`${B}.editeur.periodeFin`, { fin: jourFr(bilan.date) })}
      </p>
      {estCourrier(bilan.type) && (
        <label className="champ">
          <span>{t(`${B}.editeur.destinataire`)}</span>
          <input
            type="text"
            maxLength={300}
            value={destinataire}
            onChange={(e) => setDestinataire(e.currentTarget.value)}
          />
        </label>
      )}
      {change && (
        <button
          type="button"
          onClick={async () =>
            onReponse(
              await envoyerJson<Reponse>(
                api,
                { titre, ...(estCourrier(bilan.type) ? { destinataire } : {}) },
                "PATCH",
              ),
            )
          }
        >
          {t(`${B}.editeur.enregistrer`)}
        </button>
      )}
    </div>
  );
}

/** Une partie : texte (éditeur simple), statut, « Enregistrer » et « Marquer comme relu ». */
function Partie({
  section,
  onEnregistrer,
  onRelu,
}: {
  section: SectionDocument;
  onEnregistrer: (contenu: string) => Promise<boolean>;
  onRelu: () => Promise<boolean>;
}) {
  const [texte, setTexte] = useState(section.contenu);
  const modifie = texte !== section.contenu;
  const statut = statutSection(section);
  const id = `partie-${section.cle}`;
  return (
    <li
      className={`partie-bilan partie-${section.type.toLowerCase()}`}
      aria-labelledby={`${id}-titre`}
    >
      <div className="partie-entete">
        <h3 id={`${id}-titre`}>{section.titre}</h3>
        <BadgeStatut statut={statut} />
        {modifie && <span className="statut statut-attente">{t(`${B}.editeur.modifie`)}</span>}
      </div>
      {section.type === "AUTO" && <p className="aide">{t(`${B}.editeur.automatiqueAide`)}</p>}
      <label className="visuellement-cache" htmlFor={id}>
        {section.titre}
      </label>
      <textarea
        id={id}
        rows={Math.min(14, Math.max(4, texte.split("\n").length + 1))}
        maxLength={20_000}
        value={texte}
        placeholder={section.aide ?? undefined}
        onChange={(e) => setTexte(e.currentTarget.value)}
      />
      <p className="aide">{t(`${B}.editeur.listeAide`)}</p>
      <div className="actions">
        <button type="button" disabled={!modifie} onClick={() => void onEnregistrer(texte)}>
          {t(`${B}.editeur.enregistrer`)}
        </button>
        {!section.relu && !modifie && texte.trim() !== "" && (
          <button type="button" className="bouton-secondaire-vert" onClick={() => void onRelu()}>
            {t(`${B}.editeur.marquerRelu`)}
          </button>
        )}
      </div>
    </li>
  );
}
