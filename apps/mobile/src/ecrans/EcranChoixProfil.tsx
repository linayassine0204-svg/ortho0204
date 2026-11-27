import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "@app/shared";
import { Bouton } from "../composants/Bouton";
import { Message } from "../composants/Message";
import { Titre } from "../composants/Titre";
import { profilDe } from "../session/profils";
import type { PatientFamille, Profil } from "../session/types";
import { fontSizes, palette, police, rayon } from "../theme";
import { Page } from "./Page";

interface Props {
  patients: readonly PatientFamille[];
  onChoisir: (profil: Profil) => void;
  onDeconnexion: () => void;
}

/** « Qui fait les exercices ? » : un gros bouton par enfant relié au compte parent. */
export function EcranChoixProfil({ patients, onChoisir, onDeconnexion }: Props) {
  return (
    <Page>
      <Titre>{t("mobile.profil.titre")}</Titre>
      {patients.length === 0 ? <Message texte={t("mobile.profil.aucun")} /> : null}
      <View>
        {patients.map((patient) => {
          const profil = profilDe(patient);
          if (!profil) {
            return (
              <View key={patient.id} style={[styles.carte, styles.carteInactive]}>
                <Text style={styles.prenom}>{patient.prenom}</Text>
                <Text style={styles.aide}>{t("mobile.profil.consentementRequis")}</Text>
              </View>
            );
          }
          return (
            <Pressable
              key={patient.id}
              accessibilityRole="button"
              accessibilityLabel={t("mobile.profil.choisir", { prenom: patient.prenom })}
              onPress={() => onChoisir(profil)}
              style={({ pressed }) => [styles.carte, pressed && styles.appuye]}
            >
              <View style={styles.pastille} accessible={false}>
                <Text style={styles.initiale}>{patient.prenom.slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text style={styles.prenom}>{patient.prenom}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.bas}>
        <Bouton
          libelle={t("mobile.commun.deconnexion")}
          onPress={onDeconnexion}
          variante="discret"
        />
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  carte: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    minHeight: 88,
    padding: 16,
    marginBottom: 16,
    borderRadius: rayon,
    borderWidth: 2,
    borderColor: palette.vert,
    backgroundColor: palette.menthe,
  },
  carteInactive: { borderColor: palette.bordure, backgroundColor: palette.fond },
  appuye: { opacity: 0.8 },
  pastille: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.vert,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  initiale: {
    fontFamily: police,
    fontSize: fontSizes.titre,
    color: palette.fond,
    fontWeight: "700",
  },
  prenom: {
    fontFamily: police,
    fontSize: fontSizes.titre,
    fontWeight: "700",
    color: palette.texte,
  },
  aide: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texteDiscret,
    lineHeight: 24,
    marginTop: 8,
    width: "100%",
  },
  bas: { marginTop: "auto", paddingTop: 24 },
});
