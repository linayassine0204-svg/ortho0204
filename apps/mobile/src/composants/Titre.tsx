import { StyleSheet, Text } from "react-native";
import { fontSizes, palette, police } from "../theme";

export function Titre({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" style={styles.titre}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  titre: {
    fontFamily: police,
    color: palette.texte,
    fontSize: fontSizes.titre,
    fontWeight: "700",
    marginBottom: 16,
  },
});
