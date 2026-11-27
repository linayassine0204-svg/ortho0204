import { StyleSheet, Text, View } from "react-native";
import { t } from "@app/shared";
import { Bouton } from "../composants/Bouton";
import { Message } from "../composants/Message";
import { Titre } from "../composants/Titre";
import { fontSizes, palette, police } from "../theme";
import { Page } from "./Page";

interface Props {
  onInvitation: () => void;
  onConnexion: () => void;
  message?: string | null;
}

export function EcranAccueil({ onInvitation, onConnexion, message }: Props) {
  return (
    <Page>
      <View style={styles.centre}>
        <Text style={styles.app}>{t("app.nom")}</Text>
        <Titre>{t("mobile.accueil.titre")}</Titre>
        <Text style={styles.texte}>{t("mobile.accueil.sousTitre")}</Text>
        <Message texte={message} type="erreur" />
        <Bouton libelle={t("mobile.accueil.invitation")} onPress={onInvitation} />
        <Bouton
          libelle={t("mobile.accueil.connexion")}
          onPress={onConnexion}
          variante="secondaire"
        />
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, justifyContent: "center" },
  app: {
    fontFamily: police,
    fontSize: fontSizes.intermediaire,
    color: palette.vertFonce,
    fontWeight: "700",
    marginBottom: 8,
  },
  texte: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texte,
    lineHeight: 24,
    marginBottom: 24,
  },
});
