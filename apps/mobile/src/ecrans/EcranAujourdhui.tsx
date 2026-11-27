import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { t, type ElementEnvoye } from "@app/shared";
import { Bouton } from "../composants/Bouton";
import { CarteExercice, Vignette } from "../composants/CarteExercice";
import { Etoiles } from "../composants/Etoiles";
import { Message } from "../composants/Message";
import { Titre } from "../composants/Titre";
import { etatDuJour, fileEnfant, type ChargementProgramme } from "../donnees/programme";
import type { FaitLocal } from "../donnees/realisations";
import { ETOILES_PAR_EXERCICE } from "../session/etoiles";
import type { Profil } from "../session/types";
import { fontSizes, palette, police, rayon } from "../theme";

interface Props {
  profil: Profil;
  charger: () => Promise<ChargementProgramme>;
  maintenant?: () => Date;
  /** Réalisations notées sur le téléphone cette semaine. */
  faits?: readonly FaitLocal[];
  /** Réalisations pas encore envoyées (pas de réseau). */
  enAttente?: number;
  /** Ouvre un exercice ; en mode enfant, `suite` = les exercices qui viendront après. */
  onOuvrir?: (exercice: ElementEnvoye, suite: ElementEnvoye[]) => void;
}

const formatDate = (d: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", ...options }).format(d);

/** Liste des exercices du jour, puis ceux à placer librement dans la semaine. */
export function EcranAujourdhui({
  profil,
  charger,
  maintenant = () => new Date(),
  faits = [],
  enAttente = 0,
  onOuvrir,
}: Props) {
  const [resultat, setResultat] = useState<ChargementProgramme | null>(null);
  const [rafraichit, setRafraichit] = useState(false);

  const recharger = useCallback(async () => {
    setRafraichit(true);
    try {
      setResultat(await charger());
    } catch {
      // Session expirée : gérée par l'application (retour à la connexion).
    } finally {
      setRafraichit(false);
    }
  }, [charger]);

  useEffect(() => {
    let actif = true;
    charger()
      .then((r) => {
        if (actif) setResultat(r);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [charger]);

  const aujourdhui = maintenant();
  const dateDuJour = formatDate(aujourdhui, { weekday: "long", day: "numeric", month: "long" });

  return (
    <ScrollView
      style={styles.plein}
      contentContainerStyle={styles.contenu}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={recharger} />}
    >
      <Text style={styles.date}>{dateDuJour}</Text>
      <Titre>{t("mobile.aujourdhui.bonjour", { prenom: profil.prenom })}</Titre>
      {resultat === null ? (
        <View style={styles.chargement}>
          <ActivityIndicator color={palette.vert} size="large" />
          <Text style={styles.texte}>{t("mobile.commun.chargement")}</Text>
        </View>
      ) : (
        <>
          {enAttente > 0 ? (
            <Message texte={t("mobile.aujourdhui.enAttente", { n: enAttente })} />
          ) : null}
          <Contenu
            resultat={resultat}
            maintenant={aujourdhui}
            onReessayer={recharger}
            profil={profil}
            faits={faits}
            {...(onOuvrir ? { onOuvrir } : {})}
          />
        </>
      )}
    </ScrollView>
  );
}

function Contenu({
  resultat,
  maintenant,
  onReessayer,
  profil,
  faits,
  onOuvrir,
}: {
  resultat: ChargementProgramme;
  maintenant: Date;
  onReessayer: () => void;
  profil: Profil;
  faits: readonly FaitLocal[];
  onOuvrir?: (exercice: ElementEnvoye, suite: ElementEnvoye[]) => void;
}) {
  switch (resultat.etat) {
    case "horsLigneSansCache":
      return (
        <>
          <Message texte={t("mobile.aujourdhui.horsLigneSansCache")} type="erreur" />
          <Bouton libelle={t("mobile.commun.reessayer")} onPress={onReessayer} />
        </>
      );
    case "consentementRequis":
      return <Message texte={t("mobile.profil.consentementRequis")} />;
    case "erreur":
      return (
        <>
          <Message texte={resultat.message || t("mobile.aujourdhui.erreur")} type="erreur" />
          <Bouton libelle={t("mobile.commun.reessayer")} onPress={onReessayer} />
        </>
      );
    case "ok": {
      const bandeau = resultat.horsLigne ? (
        <Message
          texte={t("mobile.aujourdhui.horsLigne", {
            date: formatDate(new Date(resultat.enregistreLe), {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        />
      ) : null;
      if (!resultat.programme) {
        return (
          <>
            {bandeau}
            <Message texte={t("mobile.aujourdhui.aucunProgramme")} />
          </>
        );
      }
      const etat = etatDuJour(resultat.programme, faits, maintenant);
      if (profil.modeEnfant) {
        return (
          <>
            {bandeau}
            <VueEnfant
              file={fileEnfant(etat)}
              faitsAujourdhui={
                [...etat.duJour, ...etat.dansLaSemaine].filter((x) => x.faitAujourdhui).length
              }
              {...(onOuvrir ? { onOuvrir } : {})}
            />
          </>
        );
      }
      const ouvrir = (e: ElementEnvoye) => (onOuvrir ? () => onOuvrir(e, []) : undefined);
      return (
        <>
          {bandeau}
          {etat.duJour.length === 0 ? (
            <Message texte={t("mobile.aujourdhui.aucunExercice")} type="succes" />
          ) : (
            etat.duJour.map((x) => (
              <CarteExercice
                key={x.element.elementId}
                exercice={x.element}
                faitAujourdhui={x.faitAujourdhui}
                {...optionnel("onOuvrir", ouvrir(x.element))}
              />
            ))
          )}
          {etat.dansLaSemaine.length > 0 ? (
            <>
              <Text accessibilityRole="header" style={styles.sousTitre}>
                {t("mobile.aujourdhui.dansLaSemaine")}
              </Text>
              {etat.dansLaSemaine.map((x) => (
                <CarteExercice
                  key={x.element.elementId}
                  exercice={x.element}
                  frequence
                  faitAujourdhui={x.faitAujourdhui}
                  restantSemaine={x.restantSemaine}
                  {...optionnel("onOuvrir", ouvrir(x.element))}
                />
              ))}
            </>
          ) : null}
        </>
      );
    }
  }
}

/** Propriété facultative (exactOptionalPropertyTypes) : absente si `undefined`. */
function optionnel<K extends string, V>(cle: K, valeur: V | undefined) {
  return (valeur === undefined ? {} : { [cle]: valeur }) as Partial<Record<K, V>>;
}

/**
 * Mode enfant : UN exercice à l'écran, très gros bouton, étoiles à la fin.
 * Pas de compteur d'échecs, pas de comparaison : seulement ce qui est fait.
 */
function VueEnfant({
  file,
  faitsAujourdhui,
  onOuvrir,
}: {
  file: ElementEnvoye[];
  faitsAujourdhui: number;
  onOuvrir?: (exercice: ElementEnvoye, suite: ElementEnvoye[]) => void;
}) {
  const [premier, ...suite] = file;
  if (!premier) {
    if (faitsAujourdhui === 0) return <Message texte={t("mobile.enfant.rien")} type="succes" />;
    const etoiles = faitsAujourdhui * ETOILES_PAR_EXERCICE;
    return (
      <View style={styles.enfant}>
        <Etoiles
          nombre={Math.min(etoiles, 9)}
          libelle={t("mobile.enfant.etoilesDuJour", { n: etoiles })}
        />
        <Text accessibilityRole="header" style={styles.enfantTitre}>
          {t("mobile.enfant.toutFait")}
        </Text>
        <Text style={styles.enfantTexte}>{t("mobile.enfant.etoilesDuJour", { n: etoiles })}</Text>
      </View>
    );
  }
  return (
    <View style={styles.enfant}>
      <Text style={styles.enfantCompteur}>
        {t("mobile.enfant.exerciceNumero", {
          n: faitsAujourdhui + 1,
          total: faitsAujourdhui + file.length,
        })}
      </Text>
      <View style={styles.enfantCarte}>
        <Vignette exercice={premier} taille={140} />
        <Text accessibilityRole="header" style={styles.enfantTitre}>
          {premier.titre}
        </Text>
        <Text style={styles.enfantTexte}>
          {t("mobile.exercice.niveau", { n: premier.niveau })} ·{" "}
          {t("mobile.exercice.duree", { n: premier.dureeMinutes })}
        </Text>
      </View>
      {premier.motFamille ? (
        <Message texte={`${t("mobile.exercice.motPro")} : ${premier.motFamille}`} />
      ) : null}
      {onOuvrir ? (
        <Bouton
          libelle={t("mobile.enfant.cestParti")}
          onPress={() => onOuvrir(premier, suite)}
          taille="grand"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  enfant: { paddingVertical: 8 },
  enfantCompteur: {
    fontFamily: police,
    fontSize: fontSizes.intermediaire,
    color: palette.vertFonce,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  enfantCarte: {
    alignItems: "center",
    backgroundColor: palette.menthe,
    borderRadius: 24,
    padding: 24,
    marginBottom: 12,
    gap: 12,
  },
  enfantTitre: {
    fontFamily: police,
    fontSize: 32,
    fontWeight: "700",
    color: palette.texte,
    textAlign: "center",
  },
  enfantTexte: {
    fontFamily: police,
    fontSize: fontSizes.enfant,
    color: palette.texte,
    textAlign: "center",
    borderRadius: rayon,
  },
  plein: { flex: 1, backgroundColor: palette.fond },
  contenu: { padding: 20 },
  date: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.vertFonce,
    fontWeight: "700",
    textTransform: "capitalize",
    marginBottom: 4,
  },
  chargement: { alignItems: "center", paddingVertical: 32 },
  texte: { fontFamily: police, fontSize: fontSizes.corps, color: palette.texte, marginTop: 12 },
  sousTitre: {
    fontFamily: police,
    fontSize: fontSizes.intermediaire,
    fontWeight: "700",
    color: palette.vertFonce,
    marginTop: 8,
    marginBottom: 12,
  },
});
