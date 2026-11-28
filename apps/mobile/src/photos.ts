import { launchImageLibraryAsync } from "expo-image-picker";
import type { PhotoLocale } from "./donnees/messages";

/**
 * Choix d'une photo dans la galerie du téléphone (sélecteur du système). Compressée en JPEG
 * avant l'envoi. Le serveur contrôle de toute façon le type réel du fichier.
 */
export async function choisirPhoto(): Promise<PhotoLocale | null> {
  const resultat = await launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    allowsMultipleSelection: false,
    exif: false,
  });
  const photo = resultat.canceled ? null : resultat.assets[0];
  if (!photo) return null;
  return {
    uri: photo.uri,
    type: photo.mimeType === "image/png" ? "image/png" : "image/jpeg",
    nom: photo.mimeType === "image/png" ? "photo.png" : "photo.jpg",
  };
}
