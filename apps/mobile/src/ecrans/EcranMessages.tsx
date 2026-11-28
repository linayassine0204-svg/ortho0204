import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LONGUEUR_MAX_MESSAGE, t, type MessageVue, type PieceJointeVue } from "@app/shared";
import type { EnregistreurVoix } from "../audio/types";
import { Bouton } from "../composants/Bouton";
import { Message } from "../composants/Message";
import { Titre } from "../composants/Titre";
import type { ChargementMessages, PhotoLocale } from "../donnees/messages";
import type { AudioLocal } from "../donnees/realisations";
import { fontSizes, palette, police, rayon, TAILLE_TACTILE } from "../theme";

export type SourceProtegee = { uri: string; headers: Record<string, string> };

interface Props {
  charger: () => Promise<ChargementMessages>;
  envoyer: (envoi: {
    contenu: string;
    photo: PhotoLocale | null;
    vocal: AudioLocal | null;
  }) => Promise<MessageVue>;
  enregistreur: EnregistreurVoix;
  choisirPhoto: () => Promise<PhotoLocale | null>;
  /** Adresse protégée d'une pièce jointe (avec le jeton du téléphone). */
  sourcePieceJointe: (pieceId: string) => Promise<SourceProtegee>;
  /** Lecteur des messages vocaux (expo-audio ; remplaçable en test). */
  LecteurVocal: (props: { source: SourceProtegee }) => ReactNode;
  supprimerVoix: (audio: AudioLocal) => void;
}

const heure = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/**
 * Onglet Messages (parent, ou patient majeur) : la conversation avec l'orthophoniste,
 * ses horaires de réponse, et l'envoi d'un texte, d'une photo ou d'un message vocal.
 */
export function EcranMessages({
  charger,
  envoyer,
  enregistreur,
  choisirPhoto,
  sourcePieceJointe,
  LecteurVocal,
  supprimerVoix,
}: Props) {
  const [resultat, setResultat] = useState<ChargementMessages | null>(null);
  const [rafraichit, setRafraichit] = useState(false);
  const [texte, setTexte] = useState("");
  const [photo, setPhoto] = useState<PhotoLocale | null>(null);
  const [vocal, setVocal] = useState<AudioLocal | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

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

  async function basculerVocal() {
    if (enregistreur.enCours) {
      const audio = await enregistreur.arreter();
      if (audio) {
        if (vocal) supprimerVoix(vocal);
        setVocal(audio);
        setPhoto(null);
      }
      return;
    }
    await enregistreur.demarrer();
  }

  async function prendrePhoto() {
    try {
      const choisie = await choisirPhoto();
      if (!choisie) return;
      setPhoto(choisie);
      if (vocal) supprimerVoix(vocal);
      setVocal(null);
    } catch {
      setErreur(t("mobile.messages.photoRefusee"));
    }
  }

  async function envoyerMessage() {
    if (!texte.trim() && !photo && !vocal) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const message = await envoyer({ contenu: texte.trim(), photo, vocal });
      setResultat((r) =>
        r?.etat === "ok" ? { ...r, fil: { ...r.fil, messages: [...r.fil.messages, message] } } : r,
      );
      if (vocal) supprimerVoix(vocal);
      setTexte("");
      setPhoto(null);
      setVocal(null);
    } catch (e) {
      setErreur(e instanceof Error && e.message ? e.message : t("mobile.messages.envoiImpossible"));
    } finally {
      setEnvoi(false);
    }
  }

  if (!resultat) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator
          color={palette.vert}
          accessibilityLabel={t("mobile.commun.chargement")}
        />
      </View>
    );
  }
  if (resultat.etat !== "ok") {
    const texteEtat =
      resultat.etat === "horsLigne"
        ? t("mobile.messages.horsLigne")
        : resultat.etat === "desactivee"
          ? t("mobile.messages.desactivee")
          : resultat.etat === "consentementRequis"
            ? t("mobile.messages.consentement")
            : resultat.message;
    return (
      <View style={styles.page}>
        <Titre>{t("mobile.messages.titre")}</Titre>
        <Message type="info" texte={texteEtat} />
        <Bouton
          libelle={t("mobile.messages.actualiser")}
          onPress={recharger}
          variante="secondaire"
        />
      </View>
    );
  }

  const { fil } = resultat;
  const pret = Boolean(texte.trim() || photo || vocal);
  return (
    <View style={styles.plein}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={recharger} />}
      >
        <Titre>{t("mobile.messages.titre")}</Titre>
        {fil.horairesReponse && (
          <Text style={styles.horaires}>
            {t("mobile.messages.horaires", { texte: fil.horairesReponse })}
          </Text>
        )}
        {fil.messages.length === 0 && <Text style={styles.vide}>{t("mobile.messages.vide")}</Text>}
        {fil.messages.map((m) => (
          <View
            key={m.id}
            style={[styles.bulle, m.deMoi ? styles.bulleMoi : styles.bulleAutre]}
            accessible
            accessibilityLabel={`${m.deMoi ? t("mobile.messages.moi") : t("mobile.messages.cabinet")}, ${heure(m.envoyeLe)}`}
          >
            <Text style={styles.auteur}>
              {m.deMoi ? t("mobile.messages.moi") : (m.auteur ?? t("mobile.messages.cabinet"))}
              <Text style={styles.heure}> · {heure(m.envoyeLe)}</Text>
            </Text>
            {m.contenu !== "" && <Text style={styles.texte}>{m.contenu}</Text>}
            {m.piecesJointes.map((p) => (
              <PieceJointe
                key={p.id}
                piece={p}
                source={() => sourcePieceJointe(p.id)}
                LecteurVocal={LecteurVocal}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.composer}>
        {photo && (
          <View style={styles.pret}>
            <Text style={styles.texte}>{t("mobile.messages.photoPrete")}</Text>
            <Bouton
              libelle={t("mobile.messages.retirer")}
              onPress={() => setPhoto(null)}
              variante="discret"
            />
          </View>
        )}
        {vocal && (
          <View style={styles.pret}>
            <Text style={styles.texte}>
              {t("mobile.messages.vocalPret", { secondes: vocal.dureeSecondes })}
            </Text>
            <Bouton
              libelle={t("mobile.messages.retirer")}
              onPress={() => {
                supprimerVoix(vocal);
                setVocal(null);
              }}
              variante="discret"
            />
          </View>
        )}
        <TextInput
          accessibilityLabel={t("mobile.messages.ecrire")}
          placeholder={t("mobile.messages.ecrire")}
          placeholderTextColor={palette.texteDiscret}
          multiline
          maxLength={LONGUEUR_MAX_MESSAGE}
          value={texte}
          onChangeText={setTexte}
          style={styles.saisie}
        />
        {erreur && <Message type="erreur" texte={erreur} />}
        <View style={styles.actions}>
          <Bouton
            libelle={t("mobile.messages.photo")}
            onPress={prendrePhoto}
            variante="secondaire"
          />
          <Bouton
            libelle={
              enregistreur.enCours ? t("mobile.messages.arreter") : t("mobile.messages.vocal")
            }
            onPress={basculerVocal}
            variante="secondaire"
          />
          <Bouton
            libelle={t("mobile.messages.envoyer")}
            onPress={envoyerMessage}
            desactive={!pret || envoi || enregistreur.enCours}
          />
        </View>
      </View>
    </View>
  );
}

function PieceJointe({
  piece,
  source,
  LecteurVocal,
}: {
  piece: PieceJointeVue;
  source: () => Promise<SourceProtegee>;
  LecteurVocal: Props["LecteurVocal"];
}) {
  const [s, setS] = useState<SourceProtegee | null>(null);
  useEffect(() => {
    let actif = true;
    source()
      .then((r) => {
        if (actif) setS(r);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
    // La source ne dépend que de la pièce jointe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piece.id]);
  if (piece.genre === "VOCAL") {
    return (
      <View style={styles.vocal}>
        <Text style={styles.heure}>
          {t("mobile.messages.vocalDuree", { secondes: piece.dureeSecondes ?? "?" })}
        </Text>
        {s && <LecteurVocal source={s} />}
      </View>
    );
  }
  return s ? (
    <Image
      source={s}
      style={styles.photo}
      resizeMode="cover"
      accessibilityLabel={t("mobile.messages.photo")}
    />
  ) : null;
}

const styles = StyleSheet.create({
  plein: { flex: 1, backgroundColor: palette.fond },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  page: { padding: 16, gap: 12 },
  horaires: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texte,
    backgroundColor: palette.menthe,
    padding: 12,
    borderRadius: rayon,
  },
  vide: { fontFamily: police, fontSize: fontSizes.corps, color: palette.texteDiscret },
  bulle: { padding: 12, borderRadius: rayon, maxWidth: "88%", gap: 6, borderWidth: 1 },
  bulleMoi: { alignSelf: "flex-end", backgroundColor: palette.menthe, borderColor: palette.vert },
  bulleAutre: {
    alignSelf: "flex-start",
    backgroundColor: palette.fond,
    borderColor: palette.bordure,
  },
  auteur: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    fontWeight: "700",
    color: palette.texte,
  },
  heure: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    fontWeight: "400",
    color: palette.texteDiscret,
  },
  texte: { fontFamily: police, fontSize: fontSizes.corps, color: palette.texte },
  photo: { width: 220, height: 220, borderRadius: rayon },
  vocal: { gap: 4 },
  composer: {
    borderTopWidth: 1,
    borderColor: palette.bordure,
    padding: 12,
    gap: 8,
    backgroundColor: palette.fond,
  },
  pret: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  saisie: {
    minHeight: TAILLE_TACTILE,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: palette.bordure,
    borderRadius: rayon,
    padding: 12,
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texte,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
