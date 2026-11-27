import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { t } from "@app/shared";
import { Bouton } from "../composants/Bouton";
import { CarteExercice } from "../composants/CarteExercice";
import { Message } from "../composants/Message";
import { Titre } from "../composants/Titre";
import { exercicesDuJour, type ChargementProgramme } from "../donnees/programme";
import type { Profil } from "../session/types";
import { fontSizes, palette, police } from "../theme";

interface Props {
  profil: Profil;
  charger: () => Promise<ChargementProgramme>;
  maintenant?: () => Date;
}

const formatDate = (d: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", ...options }).format(d);

/** Liste des exercices du jour, puis ceux à placer librement dans la semaine. */
export function EcranAujourdhui({ profil, charger, maintenant = () => new Date() }: Props) {
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
        <Contenu resultat={resultat} maintenant={aujourdhui} onReessayer={recharger} />
      )}
    </ScrollView>
  );
}

function Contenu({
  resultat,
  maintenant,
  onReessayer,
}: {
  resultat: ChargementProgramme;
  maintenant: Date;
  onReessayer: () => void;
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
      const plan = exercicesDuJour(resultat.programme, maintenant);
      return (
        <>
          {bandeau}
          {plan.elements.length === 0 ? (
            <Message texte={t("mobile.aujourdhui.aucunExercice")} type="succes" />
          ) : (
            plan.elements.map((e) => <CarteExercice key={e.elementId} exercice={e} />)
          )}
          {plan.sansJourFixe.length > 0 ? (
            <>
              <Text accessibilityRole="header" style={styles.sousTitre}>
                {t("mobile.aujourdhui.dansLaSemaine")}
              </Text>
              {plan.sansJourFixe.map((e) => (
                <CarteExercice key={e.elementId} exercice={e} frequence />
              ))}
            </>
          ) : null}
        </>
      );
    }
  }
}

const styles = StyleSheet.create({
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
