import type { ExpoConfig } from "expo/config";
import { t } from "@app/shared";

// Le nom affiché sous l'icône vient du fichier de traduction.
const config: ExpoConfig = {
  name: t("app.nom"),
  slug: "suivi-patients",
  version: "0.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  backgroundColor: "#FFFFFF",
  ios: { supportsTablet: true },
};

export default config;
