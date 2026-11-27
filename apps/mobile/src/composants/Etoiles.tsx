import { StyleSheet, Text } from "react-native";

/** Rangée d'étoiles (mode enfant). */
export function Etoiles({ nombre, libelle }: { nombre: number; libelle: string }) {
  return (
    <Text accessibilityLabel={libelle} style={styles.etoiles}>
      {"⭐".repeat(nombre)}
    </Text>
  );
}

const styles = StyleSheet.create({
  etoiles: { fontSize: 56, textAlign: "center", marginVertical: 16, letterSpacing: 6 },
});
