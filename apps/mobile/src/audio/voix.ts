import {
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { Directory, File, Paths } from "expo-file-system";
import type { EnregistreurVoix } from "./types";

// Enregistrement de la voix avec le micro du téléphone (AAC, fichier .m4a).
// Le fichier reste dans le dossier PRIVÉ de l'application (inaccessible aux autres
// applis, exclu des sauvegardes Android) jusqu'à son envoi à notre serveur, puis il est
// supprimé. Il n'est jamais envoyé à un autre service.

const dossierVoix = () => new Directory(Paths.document, "voix");

/** Déplace l'enregistrement du cache (que le système peut vider) vers le dossier privé. */
async function conserver(uri: string): Promise<string> {
  const dossier = dossierVoix();
  dossier.create({ idempotent: true, intermediates: true });
  const fichier = new File(uri);
  await fichier.move(dossier);
  return fichier.uri;
}

/** Supprime un enregistrement local (après envoi ou abandon). */
export async function supprimerFichierVoix(uri: string): Promise<void> {
  const fichier = new File(uri);
  if (fichier.exists) fichier.delete();
}

/** Supprime toutes les voix locales (déconnexion). */
export async function supprimerToutesLesVoix(): Promise<void> {
  const dossier = dossierVoix();
  if (dossier.exists) dossier.delete();
}

export function useEnregistreurVoix(): EnregistreurVoix {
  const enregistreur = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const etat = useAudioRecorderState(enregistreur, 250);
  return {
    enCours: etat.isRecording,
    dureeMs: etat.durationMillis,
    async demarrer() {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) return false;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await enregistreur.prepareToRecordAsync();
      enregistreur.record();
      return true;
    },
    async arreter() {
      const duree = etat.durationMillis;
      await enregistreur.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (!enregistreur.uri) return null;
      return {
        uri: await conserver(enregistreur.uri),
        dureeSecondes: Math.max(1, Math.round(duree / 1000)),
      };
    },
  };
}
