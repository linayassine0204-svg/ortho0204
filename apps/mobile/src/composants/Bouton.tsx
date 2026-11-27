import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { fontSizes, palette, police, rayon, TAILLE_TACTILE, TAILLE_TACTILE_ENFANT } from "../theme";

interface Props {
  libelle: string;
  onPress: () => void;
  variante?: "primaire" | "secondaire" | "discret";
  occupe?: boolean;
  desactive?: boolean;
  accessibilityLabel?: string;
  /** « grand » : très gros bouton du mode enfant. */
  taille?: "normal" | "grand";
}

/** Gros bouton (56 px de haut au moins), texte 20 px. */
export function Bouton({
  libelle,
  onPress,
  variante = "primaire",
  occupe = false,
  desactive = false,
  accessibilityLabel,
  taille = "normal",
}: Props) {
  const inactif = desactive || occupe;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? libelle}
      accessibilityState={{ disabled: inactif, busy: occupe }}
      disabled={inactif}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variante],
        taille === "grand" && styles.grand,
        pressed && styles.appuye,
        inactif && styles.inactif,
      ]}
    >
      {occupe ? (
        <ActivityIndicator color={variante === "primaire" ? palette.fond : palette.vert} />
      ) : (
        <Text
          style={[
            styles.texte,
            variante === "primaire" ? styles.textePrimaire : null,
            taille === "grand" ? styles.texteGrand : null,
          ]}
        >
          {libelle}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TAILLE_TACTILE,
    borderRadius: rayon,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  primaire: { backgroundColor: palette.vert },
  grand: { minHeight: TAILLE_TACTILE_ENFANT, borderRadius: 24 },
  secondaire: { backgroundColor: palette.fond, borderWidth: 2, borderColor: palette.vert },
  discret: { backgroundColor: "transparent" },
  appuye: { opacity: 0.8 },
  inactif: { opacity: 0.6 },
  texte: {
    fontFamily: police,
    fontSize: fontSizes.intermediaire,
    fontWeight: "700",
    color: palette.vertFonce,
    textAlign: "center",
  },
  textePrimaire: { color: palette.fond },
  texteGrand: { fontSize: fontSizes.enfant },
});
