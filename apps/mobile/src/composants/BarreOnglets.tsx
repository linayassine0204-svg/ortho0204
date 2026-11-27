import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "@app/shared";
import { LIBELLES_ONGLETS, type Onglet } from "../navigation/onglets";
import { fontSizes, palette, police, TAILLE_TACTILE } from "../theme";

const SYMBOLES: Record<Onglet, string> = { aujourdhui: "☀️", conseils: "💡", messages: "✉️" };

interface Props {
  onglets: readonly Onglet[];
  actif: Onglet;
  onChoisir: (onglet: Onglet) => void;
}

/** Barre d'onglets du bas. Ne montre que les onglets reçus (voir `ongletsVisibles`). */
export function BarreOnglets({ onglets, actif, onChoisir }: Props) {
  return (
    <View accessibilityRole="tablist" style={styles.barre}>
      {onglets.map((onglet) => {
        const selectionne = onglet === actif;
        return (
          <Pressable
            key={onglet}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectionne }}
            accessibilityLabel={t(LIBELLES_ONGLETS[onglet])}
            onPress={() => onChoisir(onglet)}
            style={[styles.onglet, selectionne && styles.ongletActif]}
          >
            <Text style={styles.symbole} accessible={false}>
              {SYMBOLES[onglet]}
            </Text>
            <Text style={[styles.libelle, selectionne && styles.libelleActif]}>
              {t(LIBELLES_ONGLETS[onglet])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: palette.bordure,
    backgroundColor: palette.fond,
  },
  onglet: {
    flex: 1,
    minHeight: TAILLE_TACTILE + 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderTopWidth: 4,
    borderTopColor: "transparent",
  },
  ongletActif: { borderTopColor: palette.vert, backgroundColor: palette.menthe },
  symbole: { fontSize: 22 },
  libelle: { fontFamily: police, fontSize: fontSizes.corps, color: palette.texteDiscret },
  libelleActif: { color: palette.vertFonce, fontWeight: "700" },
});
