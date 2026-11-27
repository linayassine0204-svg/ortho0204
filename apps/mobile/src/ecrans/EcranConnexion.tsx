import { useState } from "react";
import { t } from "@app/shared";
import { messageErreur } from "../api/erreurs";
import { Bouton } from "../composants/Bouton";
import { Champ } from "../composants/Champ";
import { Message } from "../composants/Message";
import { Titre } from "../composants/Titre";
import { Page } from "./Page";

interface Props {
  onConnexion: (email: string, motDePasse: string) => Promise<void>;
  onRetour: () => void;
  /** Message affiché en haut (ex. compte activé). */
  information?: string | null;
}

export function EcranConnexion({ onConnexion, onRetour, information }: Props) {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function soumettre() {
    setErreur(null);
    if (!email.trim() || !motDePasse) {
      setErreur(t("erreurs.donneesInvalides"));
      return;
    }
    setOccupe(true);
    try {
      await onConnexion(email.trim(), motDePasse);
    } catch (e) {
      setErreur(messageErreur(e));
      setOccupe(false);
    }
  }

  return (
    <Page>
      <Titre>{t("mobile.connexion.titre")}</Titre>
      <Message texte={information} type="succes" />
      <Champ
        libelle={t("mobile.connexion.email")}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="username"
      />
      <Champ
        libelle={t("mobile.connexion.motDePasse")}
        value={motDePasse}
        onChangeText={setMotDePasse}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={soumettre}
      />
      <Message texte={erreur} type="erreur" />
      <Bouton libelle={t("mobile.connexion.bouton")} onPress={soumettre} occupe={occupe} />
      <Bouton libelle={t("mobile.commun.retour")} onPress={onRetour} variante="discret" />
    </Page>
  );
}
