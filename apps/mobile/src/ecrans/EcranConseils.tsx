import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { t, type ConseilRecu } from "@app/shared";
import { Bouton } from "../composants/Bouton";
import { Message } from "../composants/Message";
import { Titre } from "../composants/Titre";
import type { ChargementConseils } from "../donnees/conseils";
import { fontSizes, palette, police, rayon } from "../theme";

interface Props {
  charger: () => Promise<ChargementConseils>;
  /** « J'ai compris » : renvoie la date de lecture (ISO). */
  marquerLu: (envoiId: string) => Promise<string>;
}

const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));

/** Onglet Conseils : la liste des conseils reçus, avec « J'ai compris ». */
export function EcranConseils({ charger, marquerLu }: Props) {
  const [resultat, setResultat] = useState<ChargementConseils | null>(null);
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

  const marquer = (envoiId: string, luLe: string) =>
    setResultat((r) =>
      r?.etat === "ok"
        ? { ...r, conseils: r.conseils.map((c) => (c.envoiId === envoiId ? { ...c, luLe } : c)) }
        : r,
    );

  return (
    <ScrollView
      style={styles.plein}
      contentContainerStyle={styles.contenu}
      refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={recharger} />}
    >
      <Titre>{t("mobile.conseils.titre")}</Titre>
      {resultat === null ? (
        <ActivityIndicator
          color={palette.vert}
          accessibilityLabel={t("mobile.commun.chargement")}
        />
      ) : resultat.etat === "horsLigne" ? (
        <Message texte={t("mobile.conseils.horsLigne")} />
      ) : resultat.etat === "consentementRequis" ? (
        <Message type="erreur" texte={t("erreurs.consentementRequis")} />
      ) : resultat.etat === "erreur" ? (
        <>
          <Message type="erreur" texte={t("mobile.conseils.erreur")} />
          <Bouton
            libelle={t("mobile.commun.reessayer")}
            onPress={recharger}
            variante="secondaire"
          />
        </>
      ) : resultat.conseils.length === 0 ? (
        <Message texte={t("mobile.conseils.vide")} />
      ) : (
        <>
          <Text style={styles.intro}>{t("mobile.conseils.intro")}</Text>
          {resultat.conseils.map((c) => (
            <CarteConseil
              key={c.envoiId}
              conseil={c}
              onCompris={async () => marquer(c.envoiId, await marquerLu(c.envoiId))}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function Bloc({
  titre,
  lignes,
  symbole,
  style,
}: {
  titre: string;
  lignes: string[];
  symbole: string;
  style: object;
}) {
  if (lignes.length === 0) return null;
  return (
    <View style={[styles.bloc, style]}>
      <Text accessibilityRole="header" style={styles.titreBloc}>
        {titre}
      </Text>
      {lignes.map((l, i) => (
        <View key={i} style={styles.ligne}>
          <Text style={styles.symbole} accessible={false}>
            {symbole}
          </Text>
          <Text style={styles.texte}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

function CarteConseil({
  conseil,
  onCompris,
}: {
  conseil: ConseilRecu;
  onCompris: () => Promise<void>;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(false);
  const lu = conseil.luLe !== null;

  async function compris() {
    setEnCours(true);
    setErreur(false);
    try {
      await onCompris();
    } catch {
      setErreur(true);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <View accessibilityLabel={conseil.titre} style={[styles.carte, !lu && styles.carteNouvelle]}>
      <View style={styles.entete}>
        <Text accessibilityRole="header" style={styles.titre}>
          {conseil.titre}
        </Text>
        {!lu && <Text style={styles.nouveau}>{t("mobile.conseils.nouveau")}</Text>}
      </View>
      <Text style={styles.discret}>
        {t("mobile.conseils.recuLe", { date: dateFr(conseil.envoyeLe) })}
      </Text>
      {conseil.aValider && <Text style={styles.aValider}>{t("mobile.conseils.aValider")}</Text>}
      <Bloc
        titre={t("mobile.conseils.aFaire")}
        lignes={conseil.aFaire}
        symbole="✓"
        style={styles.aFaire}
      />
      <Bloc
        titre={t("mobile.conseils.aEviter")}
        lignes={conseil.aEviter}
        symbole="✗"
        style={styles.aEviter}
      />
      {erreur && <Message type="erreur" texte={t("mobile.conseils.erreurLu")} />}
      {lu ? (
        <Text accessibilityLabel={t("mobile.conseils.luAccessible")} style={styles.lu}>
          {t("mobile.conseils.lu")}
        </Text>
      ) : (
        <Bouton libelle={t("mobile.conseils.compris")} onPress={compris} occupe={enCours} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1, backgroundColor: palette.fond },
  contenu: { padding: 20, paddingBottom: 40 },
  intro: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texteDiscret,
    marginBottom: 12,
  },
  carte: {
    borderWidth: 1,
    borderColor: palette.bordure,
    borderRadius: rayon,
    padding: 16,
    marginBottom: 16,
    backgroundColor: palette.fond,
  },
  carteNouvelle: { borderColor: palette.vert, borderWidth: 2 },
  entete: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  titre: {
    flex: 1,
    fontFamily: police,
    fontSize: fontSizes.intermediaire,
    fontWeight: "700",
    color: palette.texte,
  },
  nouveau: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    fontWeight: "700",
    color: palette.fond,
    backgroundColor: palette.vertFonce,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    overflow: "hidden",
  },
  discret: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texteDiscret,
    marginTop: 4,
  },
  aValider: {
    alignSelf: "flex-start",
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: "#7A4F00",
    backgroundColor: palette.ambreClair,
    borderColor: palette.accent,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  bloc: { borderRadius: rayon, padding: 12, marginTop: 12 },
  aFaire: { backgroundColor: palette.menthe },
  aEviter: { backgroundColor: palette.ambreClair },
  titreBloc: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    fontWeight: "700",
    color: palette.texte,
    marginBottom: 6,
  },
  ligne: { flexDirection: "row", gap: 8, marginVertical: 3 },
  symbole: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    fontWeight: "700",
    color: palette.texte,
    width: 18,
  },
  texte: {
    flex: 1,
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texte,
    lineHeight: 24,
  },
  lu: {
    fontFamily: police,
    fontSize: fontSizes.intermediaire,
    fontWeight: "700",
    color: palette.vertFonce,
    textAlign: "center",
    marginTop: 14,
  },
});
