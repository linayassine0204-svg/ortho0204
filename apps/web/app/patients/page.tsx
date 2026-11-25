import Link from "next/link";
import { t } from "@app/shared";
import { db } from "@/lib/serveur/db";
import { listerPatientsVisibles } from "@/lib/serveur/patients";
import { orthoConnecte } from "@/lib/serveur/session-page";

export default async function PatientsPage() {
  const utilisateur = await orthoConnecte();
  const patients = await listerPatientsVisibles(db(), utilisateur);
  return (
    <main className="contenu">
      <h1>{t("web.patients.titre")}</h1>
      {patients.length === 0 ? (
        <p>{t("web.patients.aucun")}</p>
      ) : (
        <ul className="liste">
          {patients.map((p) => (
            <li key={p.id}>
              <span>{p.prenom}</span>
              <Link href={`/patients/${p.id}/invitation`}>{t("web.patients.inviter")}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
