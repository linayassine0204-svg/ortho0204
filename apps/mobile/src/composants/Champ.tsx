import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { fontSizes, palette, police, rayon, TAILLE_TACTILE } from "../theme";

interface Props extends Omit<TextInputProps, "style"> {
  libelle: string;
}

export function Champ({ libelle, ...props }: Props) {
  return (
    <View style={styles.bloc}>
      <Text style={styles.libelle}>{libelle}</Text>
      <TextInput
        accessibilityLabel={libelle}
        placeholderTextColor={palette.texteDiscret}
        style={styles.saisie}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { marginBottom: 16 },
  libelle: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    fontWeight: "600",
    color: palette.texte,
    marginBottom: 6,
  },
  saisie: {
    fontFamily: police,
    minHeight: TAILLE_TACTILE,
    borderWidth: 2,
    borderColor: palette.bordure,
    borderRadius: rayon,
    paddingHorizontal: 14,
    fontSize: fontSizes.intermediaire,
    color: palette.texte,
    backgroundColor: palette.fond,
  },
});
