import type { ReactNode } from "react";
import { orthoConnecte } from "@/lib/serveur/session-page";

// Espace orthophoniste : connexion obligatoire. Les droits sur chaque dossier
// sont vérifiés en plus par `can()` dans chaque page et chaque route de l'API.
export default async function EspaceOrthoLayout({ children }: { children: ReactNode }) {
  await orthoConnecte();
  return children;
}
