import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "@app/shared";
import { fontSizes, palette, police, TAILLE_TACTILE } from "../theme";

interface Props {
  max: number;
  valeur: number | null;
  /** null : pas de score (le score est facultatif). */
  onChoisir: (score: number | null) => void;
}

/**
 * Score simple « sur N ». Jusqu'à 10 : une pastille par valeur ; au-delà : − et +.
 * Toucher de nouveau la valeur choisie l'efface.
 */
export function ChoixScore({ max, valeur, onChoisir }: Props) {
  return (
    <View>
      <Text style={styles.titre}>{t("mobile.exercice.score")}</Text>
      {max <= 10 ? (
        <View style={styles.pastilles}>
          {Array.from({ length: max + 1 }, (_, n) => {
            const choisi = valeur === n;
            return (
              <Pressable
                key={n}
                accessibilityRole="radio"
                accessibilityState={{ checked: choisi }}
                accessibilityLabel={t("mobile.exercice.scoreChoisir", { n, max })}
                onPress={() => onChoisir(choisi ? null : n)}
                style={[styles.pastille, choisi && styles.choisie]}
              >
                <Text style={[styles.nombre, choisi && styles.nombreChoisi]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.compteur}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="−"
            onPress={() => onChoisir(valeur === null || valeur <= 0 ? null : valeur - 1)}
            style={styles.pastille}
          >
            <Text style={styles.nombre}>−</Text>
          </Pressable>
          <Text style={styles.valeur}>{valeur === null ? "—" : valeur}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="+"
            onPress={() => onChoisir(Math.min(max, (valeur ?? -1) + 1))}
            style={styles.pastille}
          >
            <Text style={styles.nombre}>+</Text>
          </Pressable>
        </View>
      )}
      {valeur !== null ? (
        <Text style={styles.resume}>{t("mobile.exercice.scoreSur", { n: valeur, max })}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titre: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    fontWeight: "700",
    color: palette.texte,
    marginTop: 12,
    marginBottom: 8,
  },
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  compteur: { flexDirection: "row", alignItems: "center", gap: 16 },
  pastille: {
    width: TAILLE_TACTILE,
    height: TAILLE_TACTILE,
    borderRadius: TAILLE_TACTILE / 2,
    borderWidth: 2,
    borderColor: palette.bordure,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.fond,
  },
  choisie: { backgroundColor: palette.vert, borderColor: palette.vert },
  nombre: { fontFamily: police, fontSize: fontSizes.intermediaire, color: palette.texte },
  nombreChoisi: { color: palette.fond, fontWeight: "700" },
  valeur: { fontFamily: police, fontSize: fontSizes.titre, color: palette.texte, minWidth: 48 },
  resume: { fontFamily: police, fontSize: fontSizes.corps, color: palette.vertFonce, marginTop: 8 },
});
