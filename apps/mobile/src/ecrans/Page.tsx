import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { palette } from "../theme";

/** Contenu d'écran défilant, avec marges et place pour le clavier. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <KeyboardAvoidingView
      style={styles.plein}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  plein: { flex: 1, backgroundColor: palette.fond },
  contenu: { padding: 24, flexGrow: 1 },
});
