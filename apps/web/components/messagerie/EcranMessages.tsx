"use client";

import { useState, type FormEvent } from "react";
import {
  EXTENSIONS_PIECE_JOINTE,
  LIMITES_PIECE_JOINTE,
  t,
  type FilVue,
  type MessageVue,
  type PieceJointeVue,
  type TypePieceJointe,
} from "@app/shared";
import { Message } from "@/components/Message";
import { envoyerJson } from "@/lib/client/api";
import { useVocalNavigateur, type Vocal } from "@/lib/client/vocal";

const M = "web.messages";

interface Reponse {
  id: string;
  titre: string;
  texte: string;
}

const heure = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Messages d'un patient (orthophoniste) : le fil, les horaires affichés aux familles, et
 * l'envoi d'un message (texte, réponse rapide, photo ou message vocal).
 */
export function EcranMessages({
  patientId,
  initial,
  reponses,
}: {
  patientId: string;
  initial: FilVue & { interlocuteurs?: string[] };
  reponses: Reponse[];
}) {
  const [fil, setFil] = useState(initial);
  const [texte, setTexte] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [vocal, setVocal] = useState<Vocal | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const enregistreur = useVocalNavigateur(LIMITES_PIECE_JOINTE.VOCAL.dureeMaxSecondes);
  const base = `/api/patients/${encodeURIComponent(patientId)}/messagerie`;
  const interlocuteurs = initial.interlocuteurs ?? [];

  async function actualiser() {
    const r = await fetch(base, { credentials: "same-origin" });
    if (r.ok) setFil((await r.json()) as FilVue);
  }

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (!texte.trim() && !photo && !vocal) return;
    setEnvoi(true);
    let corps: unknown = { contenu: texte };
    if (photo || vocal) {
      const f = new FormData();
      f.set("contenu", texte);
      if (photo) f.set("fichier", photo);
      if (vocal) {
        const type = vocal.fichier.type as TypePieceJointe;
        f.set("fichier", vocal.fichier, `vocal.${EXTENSIONS_PIECE_JOINTE[type] ?? "webm"}`);
        f.set("dureeSecondes", String(vocal.secondes));
      }
      corps = f;
    }
    const r = await envoyerJson<{ message: MessageVue }>(`${base}/messages`, corps);
    setEnvoi(false);
    if (!r.ok) return setErreur(r.message);
    setErreur(null);
    setFil((f) => ({ ...f, messages: [...f.messages, r.donnees.message] }));
    setTexte("");
    setPhoto(null);
    setVocal(null);
  }

  return (
    <div className="messagerie">
      <p className="discret">
        {interlocuteurs.length > 0
          ? t(`${M}.avec`, { noms: interlocuteurs.join(", ") })
          : t(`${M}.personne`)}
      </p>
      <p className="bandeau-horaires">
        {fil.horairesReponse
          ? t(`${M}.horaires`, { texte: fil.horairesReponse })
          : t(`${M}.aucunHoraire`)}
      </p>

      {fil.messages.length === 0 ? (
        <p className="carte">{t(`${M}.vide`)}</p>
      ) : (
        <ol className="fil-messages" aria-label={t(`${M}.titre`)}>
          {fil.messages.map((m) => (
            <li key={m.id} className={`bulle ${m.deMoi ? "bulle-moi" : "bulle-autre"}`}>
              <p className="bulle-auteur">
                {m.deMoi
                  ? t(`${M}.moi`)
                  : `${m.auteur ?? ""} (${m.cote === "FAMILLE" ? t(`${M}.famille`) : t(`${M}.cabinet`)})`}
                <span className="discret"> · {heure(m.envoyeLe)}</span>
              </p>
              {m.contenu && <p className="bulle-texte">{m.contenu}</p>}
              {m.piecesJointes.map((p) => (
                <PieceJointe
                  key={p.id}
                  piece={p}
                  url={`${base}/pieces-jointes/${encodeURIComponent(p.id)}`}
                />
              ))}
              {m.deMoi && (
                <p className="bulle-lu discret">{m.luLe ? t(`${M}.lu`) : t(`${M}.nonLu`)}</p>
              )}
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="bouton-lien" onClick={actualiser}>
        {t(`${M}.actualiser`)}
      </button>

      <form className="carte composer" onSubmit={envoyer}>
        {reponses.length > 0 && (
          <label className="champ">
            <span>{t(`${M}.reponseRapide`)}</span>
            <select
              value=""
              onChange={(e) => {
                const r = reponses.find((x) => x.id === e.currentTarget.value);
                if (r) setTexte((v) => (v ? `${v}\n${r.texte}` : r.texte));
              }}
            >
              <option value="">{t(`${M}.choisirReponse`)}</option>
              {reponses.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.titre}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="champ">
          <span>{t(`${M}.ecrire`)}</span>
          <textarea
            rows={3}
            maxLength={5000}
            value={texte}
            onChange={(e) => setTexte(e.currentTarget.value)}
          />
        </label>
        <div className="pieces-a-joindre">
          <label className="bouton bouton-secondaire-vert bouton-fichier">
            {t(`${M}.photo`)}
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="visuellement-cache"
              onChange={(e) => {
                setPhoto(e.currentTarget.files?.[0] ?? null);
                setVocal(null);
                e.currentTarget.value = "";
              }}
            />
          </label>
          {enregistreur.possible ? (
            <button
              type="button"
              className={`bouton-dictee ${enregistreur.enCours ? "actif" : ""}`}
              aria-pressed={enregistreur.enCours}
              onClick={async () => {
                if (enregistreur.enCours) return enregistreur.arreter();
                const ok = await enregistreur.demarrer((v) => {
                  setVocal(v);
                  if (v) setPhoto(null);
                });
                if (!ok) setErreur(t(`${M}.vocalIndisponible`));
              }}
            >
              {enregistreur.enCours ? t(`${M}.arreterVocal`) : t(`${M}.vocal`)}
            </button>
          ) : (
            <span className="aide">{t(`${M}.vocalIndisponible`)}</span>
          )}
        </div>
        {photo && (
          <p className="statut">
            {t(`${M}.photoJointe`, { nom: photo.name })}{" "}
            <button type="button" className="bouton-lien" onClick={() => setPhoto(null)}>
              {t(`${M}.retirerPhoto`)}
            </button>
          </p>
        )}
        {vocal && (
          <p className="statut">
            {t(`${M}.vocalPret`, { secondes: vocal.secondes })}{" "}
            <button type="button" className="bouton-lien" onClick={() => setVocal(null)}>
              {t(`${M}.retirerVocal`)}
            </button>
          </p>
        )}
        <p className="aide">{t(`${M}.limites`)}</p>
        {erreur && <Message type="erreur" texte={erreur} />}
        <button
          type="submit"
          disabled={envoi || enregistreur.enCours || (!texte.trim() && !photo && !vocal)}
        >
          {t(`${M}.envoyer`)}
        </button>
      </form>
    </div>
  );
}

function PieceJointe({ piece, url }: { piece: PieceJointeVue; url: string }) {
  if (piece.genre === "PHOTO") {
    return (
      <a href={url} target="_blank" rel="noopener">
        {/* eslint-disable-next-line @next/next/no-img-element -- fichier servi par l'API, avec droits */}
        <img src={url} alt={t(`${M}.photoAlt`)} className="photo-message" />
      </a>
    );
  }
  return (
    <div className="vocal-message">
      <span className="discret">
        {t(`${M}.vocalDuree`, { secondes: piece.dureeSecondes ?? "?" })}
      </span>
      <audio controls preload="none" src={url} />
    </div>
  );
}
