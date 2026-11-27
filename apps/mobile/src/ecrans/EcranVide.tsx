import { StyleSheet, View } from "react-native";
import { Message } from "../composants/Message";
import { Titre } from "../composants/Titre";
import { palette } from "../theme";

/** Écran d'onglet pas encore rempli (Conseils, Messages). */
export function EcranVide({ titre, texte }: { titre: string; texte: string }) {
  return (
    <View style={styles.plein}>
      <Titre>{titre}</Titre>
      <Message texte={texte} />
    </View>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1, padding: 20, backgroundColor: palette.fond },
});
