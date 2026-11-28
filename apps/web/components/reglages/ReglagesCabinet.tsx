"use client";

import { useState, type FormEvent } from "react";
import { t } from "@app/shared";
import { Message } from "@/components/Message";
import { envoyerJson } from "@/lib/client/api";

const R = "web.reglages";

interface Reponse {
  id: string;
  titre: string;
  texte: string;
}

type Etat = { type: "erreur" | "succes"; texte: string } | null;

/** Interrupteur de messagerie, horaires de réponse et réponses rapides du cabinet. */
export function ReglagesCabinet({
  initial,
  reponsesInitiales,
}: {
  initial: { messagerieActivee: boolean; horairesReponse: string | null };
  reponsesInitiales: Reponse[];
}) {
  const [active, setActive] = useState(initial.messagerieActivee);
  const [horaires, setHoraires] = useState(initial.horairesReponse ?? "");
  const [etat, setEtat] = useState<Etat>(null);
  const [reponses, setReponses] = useState(reponsesInitiales);
  const [etatReponses, setEtatReponses] = useState<Etat>(null);

  async function enregistrer(e: FormEvent) {
    e.preventDefault();
    const r = await envoyerJson<{ reglages: typeof initial }>(
      "/api/cabinet/reglages",
      { messagerieActivee: active, horairesReponse: horaires },
      "PUT",
    );
    setEtat(
      r.ok ? { type: "succes", texte: t(`${R}.enregistre`) } : { type: "erreur", texte: r.message },
    );
  }

  async function ajouter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulaire = e.currentTarget;
    const f = new FormData(formulaire);
    const r = await envoyerJson<{ reponse: Reponse }>("/api/cabinet/reponses-rapides", {
      titre: f.get("titre"),
      texte: f.get("texte"),
    });
    if (!r.ok) return setEtatReponses({ type: "erreur", texte: r.message });
    setReponses((l) => [...l, r.donnees.reponse]);
    setEtatReponses(null);
    formulaire.reset();
  }

  async function modifier(reponse: Reponse) {
    const r = await envoyerJson<{ reponse: Reponse }>(
      `/api/cabinet/reponses-rapides/${encodeURIComponent(reponse.id)}`,
      { titre: reponse.titre, texte: reponse.texte },
      "PATCH",
    );
    if (!r.ok) return setEtatReponses({ type: "erreur", texte: r.message });
    setReponses((l) => l.map((x) => (x.id === reponse.id ? r.donnees.reponse : x)));
    setEtatReponses({ type: "succes", texte: t(`${R}.enregistre`) });
  }

  async function supprimer(reponse: Reponse) {
    if (!window.confirm(t(`${R}.supprimerConfirmer`))) return;
    const r = await envoyerJson(
      `/api/cabinet/reponses-rapides/${encodeURIComponent(reponse.id)}`,
      undefined,
      "DELETE",
    );
    if (!r.ok) return setEtatReponses({ type: "erreur", texte: r.message });
    setReponses((l) => l.filter((x) => x.id !== reponse.id));
  }

  return (
    <div className="reglages">
      <form className="carte" onSubmit={enregistrer} aria-labelledby="titre-messagerie">
        <h2 id="titre-messagerie">{t(`${R}.messagerie`)}</h2>
        <label className="choix">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.currentTarget.checked)}
          />
          {t(`${R}.messagerieCase`)}
        </label>
        <p className="aide">{t(`${R}.messagerieAide`)}</p>
        <label className="champ">
          <span>{t(`${R}.horaires`)}</span>
          <input
            type="text"
            maxLength={300}
            value={horaires}
            placeholder={t(`${R}.horairesAide`)}
            onChange={(e) => setHoraires(e.currentTarget.value)}
          />
        </label>
        <button type="submit">{t(`${R}.enregistrer`)}</button>
        {etat && <Message type={etat.type} texte={etat.texte} />}
      </form>

      <section className="carte" aria-labelledby="titre-reponses">
        <h2 id="titre-reponses">{t(`${R}.reponses`)}</h2>
        <p className="aide">{t(`${R}.reponsesAide`)}</p>
        {etatReponses && <Message type={etatReponses.type} texte={etatReponses.texte} />}
        {reponses.length === 0 ? (
          <p className="discret">{t(`${R}.aucuneReponse`)}</p>
        ) : (
          <ul className="liste-reponses">
            {reponses.map((r) => (
              <LigneReponse
                key={r.id}
                reponse={r}
                onModifier={modifier}
                onSupprimer={() => supprimer(r)}
              />
            ))}
          </ul>
        )}
        <form className="formulaire-reponse" onSubmit={ajouter}>
          <label className="champ">
            <span>{t(`${R}.titreReponse`)}</span>
            <input type="text" name="titre" required maxLength={80} />
          </label>
          <label className="champ">
            <span>{t(`${R}.texteReponse`)}</span>
            <textarea name="texte" required rows={3} maxLength={2000} />
          </label>
          <button type="submit">{t(`${R}.ajouterReponse`)}</button>
        </form>
      </section>
    </div>
  );
}

function LigneReponse({
  reponse,
  onModifier,
  onSupprimer,
}: {
  reponse: Reponse;
  onModifier: (r: Reponse) => void;
  onSupprimer: () => void;
}) {
  const [titre, setTitre] = useState(reponse.titre);
  const [texte, setTexte] = useState(reponse.texte);
  const change = titre !== reponse.titre || texte !== reponse.texte;
  return (
    <li className="ligne-reponse" aria-label={reponse.titre}>
      <label className="champ">
        <span>{t(`${R}.titreReponse`)}</span>
        <input
          type="text"
          maxLength={80}
          value={titre}
          onChange={(e) => setTitre(e.currentTarget.value)}
        />
      </label>
      <label className="champ">
        <span>{t(`${R}.texteReponse`)}</span>
        <textarea
          rows={2}
          maxLength={2000}
          value={texte}
          onChange={(e) => setTexte(e.currentTarget.value)}
        />
      </label>
      <div className="actions">
        <button
          type="button"
          disabled={!change}
          onClick={() => onModifier({ ...reponse, titre, texte })}
        >
          {t(`${R}.modifierReponse`)}
        </button>
        <button type="button" className="bouton-lien bouton-danger" onClick={onSupprimer}>
          {t(`${R}.supprimerReponse`)}
        </button>
      </div>
    </li>
  );
}
