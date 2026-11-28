import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { t } from "@app/shared";
import { Bouton } from "../composants/Bouton";

/**
 * Écoute d'un message vocal reçu, lu directement depuis notre serveur (avec le jeton du
 * téléphone). Rien n'est envoyé ailleurs.
 */
export function LecteurVocal({
  source,
}: {
  source: { uri: string; headers: Record<string, string> };
}) {
  const lecteur = useAudioPlayer(source);
  const etat = useAudioPlayerStatus(lecteur);
  return (
    <Bouton
      variante="discret"
      libelle={etat.playing ? t("mobile.messages.pause") : t("mobile.messages.ecouter")}
      onPress={() => {
        if (etat.playing) lecteur.pause();
        else {
          if (etat.didJustFinish || (etat.duration > 0 && etat.currentTime >= etat.duration)) {
            void lecteur.seekTo(0);
          }
          lecteur.play();
        }
      }}
    />
  );
}
