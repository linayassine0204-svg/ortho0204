import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { t } from "@app/shared";
import { fontSizes, palette } from "./theme";

// Écran vide de démarrage : aucune fonctionnalité pour l'instant.
export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View>
          <Text accessibilityRole="header" style={styles.title}>
            {t("mobile.accueil.titre")}
          </Text>
          <Text style={styles.body}>{t("mobile.accueil.sousTitre")}</Text>
        </View>
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.fond,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: palette.titre,
    fontSize: fontSizes.titre,
    fontWeight: "700",
    marginBottom: 8,
  },
  body: {
    color: palette.texte,
    fontSize: fontSizes.corps,
  },
});
