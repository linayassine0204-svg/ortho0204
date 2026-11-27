import { StyleSheet, Text, View } from "react-native";
import { fontSizes, palette, police, rayon } from "../theme";

interface Props {
  texte: string | null | undefined;
  type?: "erreur" | "info" | "succes";
}

/** Message annoncé par les lecteurs d'écran (VoiceOver, TalkBack). */
export function Message({ texte, type = "info" }: Props) {
  if (!texte) return null;
  return (
    <View
      accessibilityRole={type === "erreur" ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={[styles.boite, styles[type]]}
    >
      <Text style={[styles.texte, type === "erreur" && styles.texteErreur]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  boite: { borderRadius: rayon, padding: 14, marginVertical: 8, borderLeftWidth: 6 },
  erreur: { backgroundColor: "#FDECEA", borderLeftColor: palette.erreur },
  info: { backgroundColor: palette.ambreClair, borderLeftColor: palette.accent },
  succes: { backgroundColor: palette.menthe, borderLeftColor: palette.vert },
  texte: { fontFamily: police, fontSize: fontSizes.corps, color: palette.texte, lineHeight: 24 },
  texteErreur: { color: palette.erreur },
});
