import type { ReactNode } from "react";
import { Coquille } from "@/components/Coquille";
import { patientDePage } from "@/lib/serveur/dossier-page";

// Dossier patient : le menu de gauche affiche ses sous-parties sous son nom.
// (La lecture est journalisée par chaque sous-partie, pas ici.)
export default async function DossierLayout({ children, params }: LayoutProps<"/patients/[id]">) {
  const { id } = await params;
  const { patient } = await patientDePage(id);
  return <Coquille patient={patient}>{children as ReactNode}</Coquille>;
}
