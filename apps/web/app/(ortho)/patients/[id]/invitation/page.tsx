import Link from "next/link";
import { notFound } from "next/navigation";
import { t } from "@app/shared";
import { DUREES } from "@/lib/serveur/config";
import { db } from "@/lib/serveur/db";
import { ErreurApi } from "@/lib/serveur/erreurs";
import { patientAutorise } from "@/lib/serveur/patients";
import { orthoConnecte } from "@/lib/serveur/session-page";
import { FormulaireInvitation } from "./FormulaireInvitation";

export default async function InvitationPage({ params }: PageProps<"/patients/[id]/invitation">) {
  const { id } = await params;
  const utilisateur = await orthoConnecte();
  let prenom: string;
  try {
    // Même vérification de droits que l'API.
    prenom = (await patientAutorise(db(), utilisateur, id, "inviter")).prenom;
  } catch (erreur) {
    if (erreur instanceof ErreurApi) notFound();
    throw erreur;
  }
  return (
    <main className="contenu contenu-etroit">
      <h1>{t("web.invitation.titre", { prenom })}</h1>
      <p>{t("web.invitation.explication", { heures: DUREES.invitationMs / 3_600_000 })}</p>
      <FormulaireInvitation patientId={id} />
      <p>
        <Link href={`/patients/${id}/fiche`}>{t("web.invitation.retour")}</Link>
      </p>
    </main>
  );
}
