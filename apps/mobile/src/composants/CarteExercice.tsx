import { Image, StyleSheet, Text, View } from "react-native";
import { t, type ElementEnvoye } from "@app/shared";
import { fontSizes, palette, police, rayon } from "../theme";

/** Symbole affiché quand l'exercice n'a pas d'image d'aperçu. */
const SYMBOLES: Record<string, string> = {
  "langage-oral": "💬",
  "langage-ecrit": "✏️",
  articulation: "👄",
  begaiement: "🌊",
  voix: "🎵",
  deglutition: "🥄",
  "cognition-mathematique": "🔢",
};

/** Seules les images en https sont affichées (pas de schéma inattendu). */
const imageAffichable = (url: string | null): url is string => !!url && url.startsWith("https://");

interface Props {
  exercice: ElementEnvoye;
  /** Affiché pour les exercices « à placer dans la semaine ». */
  frequence?: boolean;
}

/**
 * Aperçu d'un exercice du programme : image, titre, niveau, durée, consigne courte,
 * matériel et mot de l'orthophoniste. (La réalisation de l'exercice : tâche 7.)
 */
export function CarteExercice({ exercice, frequence = false }: Props) {
  const niveau = t("mobile.exercice.niveau", { n: exercice.niveau });
  const duree = t("mobile.exercice.duree", { n: exercice.dureeMinutes });
  return (
    <View style={styles.carte} testID={`exercice-${exercice.elementId}`}>
      <View style={styles.entete}>
        {imageAffichable(exercice.apercuImage) ? (
          <Image
            source={{ uri: exercice.apercuImage }}
            style={styles.image}
            accessibilityIgnoresInvertColors
            accessible={false}
          />
        ) : (
          <View style={styles.image} accessible={false}>
            <Text style={styles.symbole}>{SYMBOLES[exercice.categorie.slug] ?? "⭐"}</Text>
          </View>
        )}
        <View style={styles.titreBloc}>
          <Text accessibilityRole="header" style={styles.titre}>
            {exercice.titre}
          </Text>
          <View style={styles.pastilles}>
            <Text
              style={[styles.pastille, styles.pastilleNiveau]}
              accessibilityLabel={t("mobile.exercice.niveauLong", { n: exercice.niveau })}
            >
              {niveau}
            </Text>
            <Text
              style={[styles.pastille, styles.pastilleDuree]}
              accessibilityLabel={t("mobile.exercice.dureeLongue", { n: exercice.dureeMinutes })}
            >
              {duree}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.consigne}>{exercice.apercuConsigne}</Text>
      {exercice.materiel.length > 0 ? (
        <Text style={styles.detail}>
          {t("mobile.exercice.materiel", { liste: exercice.materiel.join(", ") })}
        </Text>
      ) : null}
      {frequence ? (
        <Text style={styles.detail}>
          {t("mobile.aujourdhui.foisParSemaine", { n: exercice.foisParSemaine })}
        </Text>
      ) : null}

      {exercice.motFamille ? (
        <View style={styles.mot}>
          <Text style={styles.motTitre}>{t("mobile.exercice.motPro")}</Text>
          <Text style={styles.motTexte}>{exercice.motFamille}</Text>
        </View>
      ) : null}
      {exercice.aValider ? (
        <Text style={styles.aValider}>{t("mobile.exercice.aValider")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: palette.fond,
    borderRadius: rayon,
    borderWidth: 1,
    borderColor: palette.bordure,
    padding: 16,
    marginBottom: 16,
  },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  image: {
    width: 72,
    height: 72,
    borderRadius: rayon,
    backgroundColor: palette.menthe,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  symbole: { fontSize: 36 },
  titreBloc: { flex: 1 },
  titre: {
    fontFamily: police,
    fontSize: fontSizes.intermediaire,
    fontWeight: "700",
    color: palette.texte,
    marginBottom: 6,
  },
  pastilles: { flexDirection: "row", flexWrap: "wrap" },
  pastille: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 4,
    overflow: "hidden",
  },
  pastilleNiveau: { backgroundColor: palette.vert, color: palette.fond },
  pastilleDuree: { backgroundColor: palette.menthe, color: palette.vertFonce },
  consigne: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texte,
    lineHeight: 24,
    marginBottom: 8,
  },
  detail: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texteDiscret,
    marginBottom: 6,
  },
  mot: {
    marginTop: 8,
    backgroundColor: palette.ambreClair,
    borderLeftWidth: 6,
    borderLeftColor: palette.accent,
    borderRadius: rayon,
    padding: 12,
  },
  motTitre: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    fontWeight: "700",
    color: palette.texte,
    marginBottom: 4,
  },
  motTexte: { fontFamily: police, fontSize: fontSizes.corps, color: palette.texte, lineHeight: 24 },
  aValider: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texteDiscret,
    fontStyle: "italic",
    marginTop: 8,
  },
});
