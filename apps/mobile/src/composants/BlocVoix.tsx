import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AUDIO, t } from "@app/shared";
import { messageErreur } from "../api/erreurs";
import type { EnregistreurVoix } from "../audio/types";
import type { AudioLocal } from "../donnees/realisations";
import { fontSizes, palette, police, rayon } from "../theme";
import { Bouton } from "./Bouton";
import { Message } from "./Message";

interface Props {
  /** Accord de ce compte pour l'enregistrement de la voix (facultatif). */
  accordAudio: boolean;
  onDonnerAccord: () => Promise<void>;
  enregistreur: EnregistreurVoix;
  audio: AudioLocal | null;
  onAudio: (audio: AudioLocal | null) => void;
  /** Supprime le fichier local quand on recommence. */
  onEffacer: (audio: AudioLocal) => void;
}

const minSec = (secondes: number) =>
  `${Math.floor(secondes / 60)}:${String(Math.floor(secondes % 60)).padStart(2, "0")}`;

/** Enregistrement facultatif de la voix pendant l'exercice. */
export function BlocVoix({
  accordAudio,
  onDonnerAccord,
  enregistreur,
  audio,
  onAudio,
  onEffacer,
}: Props) {
  const [demandeAccord, setDemandeAccord] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const arreter = async () => {
    const fichier = await enregistreur.arreter().catch(() => null);
    if (fichier) onAudio(fichier);
  };

  // Durée maximale atteinte : arrêt automatique.
  const tropLong = enregistreur.enCours && enregistreur.dureeMs >= AUDIO.dureeMaxSecondes * 1000;
  useEffect(() => {
    if (tropLong) void arreter();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uniquement quand la limite est atteinte
  }, [tropLong]);

  if (!accordAudio) {
    if (!demandeAccord) {
      return (
        <Bouton
          libelle={t("mobile.voix.proposer")}
          onPress={() => setDemandeAccord(true)}
          variante="secondaire"
        />
      );
    }
    return (
      <View style={styles.boite}>
        <Text accessibilityRole="header" style={styles.titre}>
          {t("consentement.enregistrementAudio.titre")}
        </Text>
        <Text style={styles.texte}>{t("consentement.enregistrementAudio.texte")}</Text>
        <Message texte={erreur} type="erreur" />
        <Bouton
          libelle={t("consentement.enregistrementAudio.bouton")}
          occupe={occupe}
          onPress={async () => {
            setErreur(null);
            setOccupe(true);
            try {
              await onDonnerAccord();
              setDemandeAccord(false);
            } catch (e) {
              setErreur(messageErreur(e));
            } finally {
              setOccupe(false);
            }
          }}
        />
        <Bouton
          libelle={t("consentement.enregistrementAudio.plusTard")}
          onPress={() => setDemandeAccord(false)}
          variante="discret"
        />
      </View>
    );
  }

  return (
    <View style={styles.boite}>
      <Text accessibilityRole="header" style={styles.titre}>
        {t("mobile.voix.titre")}
      </Text>
      <Message texte={erreur} type="erreur" />
      {audio ? (
        <>
          <Text style={styles.texte}>
            {t("mobile.voix.enregistree", { duree: minSec(audio.dureeSecondes) })}
          </Text>
          <Bouton
            libelle={t("mobile.voix.effacer")}
            variante="discret"
            onPress={() => {
              onEffacer(audio);
              onAudio(null);
            }}
          />
        </>
      ) : enregistreur.enCours ? (
        <>
          <Text accessibilityLiveRegion="polite" style={styles.enCours}>
            {t("mobile.voix.enCours", { duree: minSec(enregistreur.dureeMs / 1000) })}
          </Text>
          <Bouton libelle={`⏹ ${t("mobile.voix.arreter")}`} onPress={() => void arreter()} />
        </>
      ) : (
        <Bouton
          libelle={`🎙️ ${t("mobile.voix.demarrer")}`}
          accessibilityLabel={t("mobile.voix.demarrer")}
          variante="secondaire"
          onPress={async () => {
            setErreur(null);
            try {
              if (!(await enregistreur.demarrer())) setErreur(t("mobile.voix.micRefuse"));
            } catch {
              setErreur(t("mobile.voix.erreur"));
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  boite: {
    borderWidth: 1,
    borderColor: palette.bordure,
    borderRadius: rayon,
    padding: 14,
    marginVertical: 12,
  },
  titre: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    fontWeight: "700",
    color: palette.texte,
    marginBottom: 6,
  },
  texte: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texte,
    lineHeight: 24,
    marginBottom: 6,
  },
  enCours: {
    fontFamily: police,
    fontSize: fontSizes.intermediaire,
    color: palette.erreur,
    fontWeight: "700",
    marginBottom: 6,
  },
});
