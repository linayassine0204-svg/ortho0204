import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { t, type AcceptationInvitation } from "@app/shared";
import { messageErreur } from "../api/erreurs";
import { Bouton } from "../composants/Bouton";
import { Champ } from "../composants/Champ";
import { Message } from "../composants/Message";
import { Titre } from "../composants/Titre";
import { extraireJetonInvitation } from "../session/invitation";
import { fontSizes, palette, police } from "../theme";
import { Page } from "./Page";

interface Props {
  /** Lien reçu à l'ouverture de l'application par le lien d'invitation. */
  lienInitial?: string;
  onActiver: (donnees: AcceptationInvitation) => Promise<unknown>;
  onSucces: () => void;
  onRetour: () => void;
}

/** Activation du compte avec le lien d'invitation de l'orthophoniste. */
export function EcranInvitation({ lienInitial = "", onActiver, onSucces, onRetour }: Props) {
  const [lien, setLien] = useState(lienInitial);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function soumettre() {
    setErreur(null);
    const jeton = extraireJetonInvitation(lien);
    if (!jeton) {
      setErreur(t("mobile.invitation.lienInvalide"));
      return;
    }
    if (!motDePasse) {
      setErreur(t("erreurs.donneesInvalides"));
      return;
    }
    setOccupe(true);
    try {
      await onActiver({
        jeton,
        motDePasse,
        ...(prenom.trim() ? { prenom: prenom.trim() } : {}),
        ...(nom.trim() ? { nom: nom.trim() } : {}),
      });
      onSucces();
    } catch (e) {
      setErreur(messageErreur(e));
      setOccupe(false);
    }
  }

  return (
    <Page>
      <Titre>{t("mobile.invitation.titre")}</Titre>
      <Text style={styles.texte}>{t("mobile.invitation.explication")}</Text>
      <Champ
        libelle={t("mobile.invitation.lien")}
        value={lien}
        onChangeText={setLien}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Champ
        libelle={t("mobile.invitation.prenom")}
        value={prenom}
        onChangeText={setPrenom}
        autoComplete="given-name"
      />
      <Champ
        libelle={t("mobile.invitation.nom")}
        value={nom}
        onChangeText={setNom}
        autoComplete="family-name"
      />
      <Champ
        libelle={t("mobile.invitation.motDePasse")}
        value={motDePasse}
        onChangeText={setMotDePasse}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Text style={styles.aide}>{t("mobile.invitation.dejaUnCompte")}</Text>
      <Message texte={erreur} type="erreur" />
      <Bouton libelle={t("mobile.invitation.bouton")} onPress={soumettre} occupe={occupe} />
      <Bouton libelle={t("mobile.commun.retour")} onPress={onRetour} variante="discret" />
    </Page>
  );
}

const styles = StyleSheet.create({
  texte: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texte,
    lineHeight: 24,
    marginBottom: 16,
  },
  aide: {
    fontFamily: police,
    fontSize: fontSizes.corps,
    color: palette.texteDiscret,
    lineHeight: 24,
    marginBottom: 8,
  },
});
