import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { t, type ElementEnvoye, type Ressenti } from "@app/shared";
import type { EnregistreurVoix } from "../audio/types";
import { BlocVoix } from "../composants/BlocVoix";
import { Bouton } from "../composants/Bouton";
import { ChoixRessenti } from "../composants/ChoixRessenti";
import { ChoixScore } from "../composants/ChoixScore";
import { Vignette } from "../composants/CarteExercice";
import { Etoiles } from "../composants/Etoiles";
import { Message } from "../composants/Message";
import type { AudioLocal } from "../donnees/realisations";
import { etoilesGagnees, messageEncourageant } from "../session/etoiles";
import { fontSizes, palette, police, rayon } from "../theme";

export interface Resultat {
  ressenti: Ressenti;
  score: number | null;
  audio: AudioLocal | null;
}

interface Props {
  exercice: ElementEnvoye;
  /** Enfant de moins de 15 ans : très gros boutons, étoiles, ton encourageant. */
  modeEnfant: boolean;
  accordAudio: boolean;
  onDonnerAccord: () => Promise<void>;
  enregistreur: EnregistreurVoix;
  supprimerVoix: (audio: AudioLocal) => void;
  /** Range la réalisation (téléphone, puis serveur). */
  onEnregistrer: (resultat: Resultat) => Promise<{ envoyee: boolean }>;
  /** Fermer : `termine` = après la réalisation (mode enfant : exercice suivant). */
  onFermer: (termine: boolean) => void;
  /** Mode enfant : reste-t-il un exercice après celui-ci ? */
  encoreDesExercices?: boolean;
}

type Etape = "consigne" | "ressenti" | "fin";

/** Un exercice à l'écran : consigne du niveau, « C'est fait », ressenti, score. */
export function EcranExercice({
  exercice,
  modeEnfant,
  accordAudio,
  onDonnerAccord,
  enregistreur,
  supprimerVoix,
  onEnregistrer,
  onFermer,
  encoreDesExercices = false,
}: Props) {
  const [etape, setEtape] = useState<Etape>("consigne");
  const [audio, setAudio] = useState<AudioLocal | null>(null);
  const [ressenti, setRessenti] = useState<Ressenti | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [envoyee, setEnvoyee] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const grand = modeEnfant;
  const scoreMax = exercice.scoreMax ?? null;

  async function cestFait() {
    // Un enregistrement en cours est arrêté et gardé.
    if (enregistreur.enCours) {
      const fichier = await enregistreur.arreter().catch(() => null);
      if (fichier) setAudio(fichier);
    }
    setEtape("ressenti");
  }

  async function valider() {
    if (!ressenti) return;
    setOccupe(true);
    // La réalisation est d'abord rangée sur le téléphone : elle n'est jamais perdue.
    const r = await onEnregistrer({ ressenti, score, audio }).catch(() => ({ envoyee: false }));
    setEnvoyee(r.envoyee);
    setOccupe(false);
    setEtape("fin");
  }

  return (
    <ScrollView style={styles.plein} contentContainerStyle={styles.contenu}>
      {etape !== "fin" ? (
        <View style={styles.haut}>
          <Bouton
            libelle={t("mobile.commun.retour")}
            onPress={() => onFermer(false)}
            variante="discret"
          />
        </View>
      ) : null}

      {etape === "consigne" ? (
        <>
          <View style={styles.entete}>
            <Vignette exercice={exercice} taille={grand ? 120 : 72} />
            <View style={styles.titreBloc}>
              <Text accessibilityRole="header" style={[styles.titre, grand && styles.titreEnfant]}>
                {exercice.titre}
              </Text>
              <Text style={styles.detail}>
                {t("mobile.exercice.niveau", { n: exercice.niveau })} ·{" "}
                {t("mobile.exercice.duree", { n: exercice.dureeMinutes })}
              </Text>
            </View>
          </View>
          <View style={styles.consigne}>
            <Text style={styles.sousTitre}>{t("mobile.exercice.consigne")}</Text>
            <Text style={[styles.texteConsigne, grand && styles.texteEnfant]}>
              {exercice.consigne || exercice.apercuConsigne}
            </Text>
          </View>
          {exercice.materiel.length > 0 ? (
            <Text style={styles.detail}>
              {t("mobile.exercice.materiel", { liste: exercice.materiel.join(", ") })}
            </Text>
          ) : null}
          {exercice.motFamille ? (
            <Message texte={`${t("mobile.exercice.motPro")} : ${exercice.motFamille}`} />
          ) : null}
          <BlocVoix
            accordAudio={accordAudio}
            onDonnerAccord={onDonnerAccord}
            enregistreur={enregistreur}
            audio={audio}
            onAudio={setAudio}
            onEffacer={supprimerVoix}
          />
          <Bouton
            libelle={t("mobile.exercice.cestFait")}
            onPress={() => void cestFait()}
            taille={grand ? "grand" : "normal"}
          />
        </>
      ) : null}

      {etape === "ressenti" ? (
        <>
          <Text accessibilityRole="header" style={[styles.titre, grand && styles.titreEnfant]}>
            {grand ? t("mobile.exercice.ressentiEnfant") : t("mobile.exercice.ressentiTitre")}
          </Text>
          <ChoixRessenti valeur={ressenti} onChoisir={setRessenti} grand={grand} />
          {scoreMax ? <ChoixScore max={scoreMax} valeur={score} onChoisir={setScore} /> : null}
          <View style={styles.espace} />
          <Bouton
            libelle={t("mobile.exercice.valider")}
            onPress={() => void valider()}
            desactive={!ressenti}
            occupe={occupe}
            taille={grand ? "grand" : "normal"}
          />
        </>
      ) : null}

      {etape === "fin" && ressenti ? (
        modeEnfant ? (
          <View style={styles.fin}>
            <Etoiles
              nombre={etoilesGagnees({ ressenti, score })}
              libelle={t("mobile.enfant.etoilesGagnees", {
                n: etoilesGagnees({ ressenti, score }),
              })}
            />
            <Text
              accessibilityRole="header"
              style={[styles.titre, styles.titreEnfant, styles.centre]}
            >
              {t("mobile.enfant.etoilesGagnees", { n: etoilesGagnees({ ressenti, score }) })}
            </Text>
            <Text style={[styles.texteEnfant, styles.centre]}>{messageEncourageant(ressenti)}</Text>
            <View style={styles.espace} />
            <Bouton
              libelle={
                encoreDesExercices ? t("mobile.enfant.suivant") : t("mobile.enfant.terminer")
              }
              onPress={() => onFermer(true)}
              taille="grand"
            />
          </View>
        ) : (
          <View style={styles.fin}>
            <Message texte={t("mobile.exercice.enregistree")} type="succes" />
            <Message
              texte={envoyee ? t("mobile.exercice.envoyee") : t("mobile.exercice.enAttente")}
            />
            <Bouton libelle={t("mobile.exercice.retour")} onPress={() => onFermer(true)} />
          </View>
        )
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1, backgroundColor: palette.fond },
  contenu: { padding: 20, flexGrow: 1 },
  haut: { alignItems: "flex-start" },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 14 },
  titreBloc: { flex: 1 },
  titre: {
    fontFamily: police,
    fontSize: fontSizes.titre,
    fontWeight: "700",
    color: palette.texte,
    marginBottom: 8,
  },
  titreEnfant: { fontSize: 32 },
  detail: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texteDiscret,
    marginBottom: 6,
  },
  consigne: {
    backgroundColor: palette.menthe,
    borderRadius: rayon,
    padding: 16,
    marginBottom: 12,
  },
  sousTitre: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    fontWeight: "700",
    color: palette.vertFonce,
    marginBottom: 6,
  },
  texteConsigne: {
    fontFamily: police,
    fontSize: fontSizes.intermediaire,
    color: palette.texte,
    lineHeight: 30,
  },
  texteEnfant: {
    fontFamily: police,
    fontSize: fontSizes.enfant,
    color: palette.texte,
    lineHeight: 36,
  },
  espace: { height: 16 },
  fin: { flex: 1, justifyContent: "center" },
  centre: { textAlign: "center" },
});
