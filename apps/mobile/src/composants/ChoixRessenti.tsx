import { Pressable, StyleSheet, Text, View } from "react-native";
import { RESSENTIS, t, type Ressenti, type TranslationKey } from "@app/shared";
import { fontSizes, palette, police, rayon, TAILLE_TACTILE, TAILLE_TACTILE_ENFANT } from "../theme";

// Visages bienveillants : même « difficile » n'est pas un visage triste.
const VISAGES: Record<Ressenti, string> = { FACILE: "😄", MOYEN: "🙂", DIFFICILE: "😮‍💨" };
const LIBELLES: Record<Ressenti, TranslationKey> = {
  FACILE: "mobile.exercice.facile",
  MOYEN: "mobile.exercice.moyen",
  DIFFICILE: "mobile.exercice.difficile",
};

interface Props {
  valeur: Ressenti | null;
  onChoisir: (r: Ressenti) => void;
  grand?: boolean;
}

/** Ressenti en trois choix, avec des visages. */
export function ChoixRessenti({ valeur, onChoisir, grand = false }: Props) {
  return (
    <View accessibilityRole="radiogroup" style={styles.ligne}>
      {RESSENTIS.map((r) => {
        const choisi = valeur === r;
        return (
          <Pressable
            key={r}
            accessibilityRole="radio"
            accessibilityState={{ checked: choisi }}
            accessibilityLabel={t(LIBELLES[r])}
            onPress={() => onChoisir(r)}
            style={[styles.choix, grand && styles.choixGrand, choisi && styles.choisi]}
          >
            <Text style={[styles.visage, grand && styles.visageGrand]} accessible={false}>
              {VISAGES[r]}
            </Text>
            <Text style={[styles.libelle, choisi && styles.libelleChoisi]}>{t(LIBELLES[r])}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: "row", gap: 10, marginVertical: 12 },
  choix: {
    flex: 1,
    minHeight: TAILLE_TACTILE + 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: palette.bordure,
    borderRadius: rayon,
    paddingVertical: 10,
    backgroundColor: palette.fond,
  },
  choixGrand: { minHeight: TAILLE_TACTILE_ENFANT + 50, borderRadius: 24 },
  choisi: { borderColor: palette.vert, borderWidth: 4, backgroundColor: palette.menthe },
  visage: { fontSize: 36 },
  visageGrand: { fontSize: 52 },
  libelle: { fontFamily: police, fontSize: fontSizes.corps, color: palette.texte, marginTop: 4 },
  libelleChoisi: { fontWeight: "700", color: palette.vertFonce },
});
