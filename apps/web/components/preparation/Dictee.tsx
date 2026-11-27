"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { t } from "@app/shared";
import {
  constructeurDictee,
  demarrerDictee,
  dicteeLocalePossible,
  etatDictee,
  installerDictee,
} from "@/lib/client/dictee";

const abonnementVide = () => () => {};

type Etat = "pret" | "verification" | "a-installer" | "installation" | "ecoute" | "indisponible";

/**
 * Bouton « Dicter » à côté d'un champ de notes. La voix n'est reconnue que SUR
 * l'ordinateur : si le navigateur ne le garantit pas, pas de dictée (saisie au clavier).
 * La disponibilité locale n'est vérifiée qu'au clic (rien n'est lancé à l'ouverture).
 */
export function Dictee({
  libelle,
  onTexte,
}: {
  libelle: string;
  onTexte: (texte: string) => void;
}) {
  // Lu dans le navigateur seulement (le serveur ne le connaît pas) ; rien n'est lancé.
  const possible = useSyncExternalStore(
    abonnementVide,
    () => dicteeLocalePossible(constructeurDictee()),
    () => null,
  );
  const [etat, setEtat] = useState<Etat>("pret");
  const [erreur, setErreur] = useState(false);
  const arreter = useRef<(() => void) | null>(null);

  // Arrêt de la dictée en quittant la page.
  useEffect(() => () => arreter.current?.(), []);

  if (possible === null) return null;
  const C = constructeurDictee();
  if (etat === "indisponible" || !dicteeLocalePossible(C)) {
    return <p className="aide">{t("web.preparation.notes.dicteeIndisponible")}</p>;
  }

  function demarrer(C: NonNullable<ReturnType<typeof constructeurDictee>>) {
    setErreur(false);
    arreter.current = demarrerDictee(C, {
      onTexte,
      onFin: () => {
        arreter.current = null;
        setEtat("pret");
      },
      onErreur: () => setErreur(true),
    });
    setEtat(arreter.current ? "ecoute" : "indisponible");
  }

  async function cliquer() {
    if (!C) return;
    if (etat === "ecoute") {
      arreter.current?.();
      return;
    }
    setEtat("verification");
    const dispo = await etatDictee(C);
    if (dispo === "locale") demarrer(C);
    else setEtat(dispo);
  }

  if (etat === "a-installer" || etat === "installation") {
    return (
      <button
        type="button"
        className="bouton-lien"
        disabled={etat === "installation"}
        onClick={async () => {
          if (!C) return;
          setEtat("installation");
          setEtat((await installerDictee(C)) ? "pret" : "indisponible");
        }}
      >
        {etat === "installation"
          ? t("web.preparation.notes.installation")
          : t("web.preparation.notes.installer")}
      </button>
    );
  }

  const ecoute = etat === "ecoute";
  const action = ecoute ? t("web.preparation.notes.arreter") : t("web.preparation.notes.dicter");
  return (
    <div className="dictee">
      <button
        type="button"
        className={`bouton-dictee ${ecoute ? "actif" : ""}`}
        aria-pressed={ecoute}
        aria-label={`${action} : ${libelle}`}
        disabled={etat === "verification"}
        onClick={cliquer}
      >
        {action}
      </button>
      {ecoute && (
        <span className="statut" role="status">
          {t("web.preparation.notes.ecoute")}
        </span>
      )}
      {erreur && (
        <span className="statut statut-attente">{t("web.preparation.notes.dicteeErreur")}</span>
      )}
      <span className="aide">{t("web.preparation.notes.dicteeLocale")}</span>
    </div>
  );
}
