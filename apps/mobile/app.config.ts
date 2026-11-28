import type { ExpoConfig } from "expo/config";
import { t } from "@app/shared";

// Le nom affiché sous l'icône vient du fichier de traduction.
const config: ExpoConfig = {
  name: t("app.nom"),
  slug: "suivi-patients",
  // Ouverture par lien : suivipatients://invitation#JETON
  scheme: "suivipatients",
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  backgroundColor: "#FFFFFF",
  ios: { supportsTablet: true },
  // Pas de sauvegarde automatique des données de l'application (cache chiffré, jetons).
  android: { allowBackup: false },
  plugins: [
    // Micro : seulement pour enregistrer la voix pendant un exercice, si on le décide.
    [
      "expo-audio",
      {
        microphonePermission: t("mobile.voix.permissionSysteme"),
        // Rien en arrière-plan : on n'enregistre que pendant l'exercice, appli ouverte.
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ],
    // Photos : seulement pour joindre une photo à un message, choisie par la famille.
    [
      "expo-image-picker",
      {
        photosPermission: t("mobile.messages.permissionPhotos"),
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
};

export default config;
