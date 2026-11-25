import Link from "next/link";
import { recherchePatientsSchema, t } from "@app/shared";
import { Coquille } from "@/components/Coquille";
import { dateFr, libelleAge } from "@/lib/format";
import { listerCategories } from "@/lib/serveur/categories";
import { db } from "@/lib/serveur/db";
import { ageEnAnnees, listerPatientsVisibles } from "@/lib/serveur/patients";
import { orthoConnecte } from "@/lib/serveur/session-page";

// Liste des patients du cabinet, avec recherche (prénom, nom) et filtre par pathologie.
// Formulaire GET simple : fonctionne sans JavaScript, l'adresse garde la recherche.
export default async function PatientsPage({ searchParams }: PageProps<"/patients">) {
  const utilisateur = await orthoConnecte();
  const brut = await searchParams;
  const lu = recherchePatientsSchema.safeParse({
    q: typeof brut.q === "string" && brut.q ? brut.q : undefined,
    pathologie:
      typeof brut.pathologie === "string" && brut.pathologie ? brut.pathologie : undefined,
  });
  const recherche = lu.success ? lu.data : {};
  const [patients, categories] = await Promise.all([
    listerPatientsVisibles(db(), utilisateur, recherche),
    listerCategories(db()),
  ]);
  const filtreActif = Boolean(recherche.q || recherche.pathologie);

  return (
    <Coquille>
      <main className="contenu">
        <div className="titre-ligne">
          <h1>{t("web.patients.titre")}</h1>
          <Link className="bouton bouton-ambre" href="/patients/nouveau">
            + {t("web.patients.nouveau")}
          </Link>
        </div>

        <form className="recherche" role="search" method="get">
          <label className="champ">
            <span>{t("web.patients.recherche")}</span>
            <input
              type="search"
              name="q"
              defaultValue={recherche.q ?? ""}
              placeholder={t("web.patients.rechercheAide")}
            />
          </label>
          <label className="champ">
            <span>{t("web.patients.filtrePathologie")}</span>
            <select name="pathologie" defaultValue={recherche.pathologie ?? ""}>
              <option value="">{t("web.patients.toutes")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
          <div className="recherche-actions">
            <button type="submit">{t("web.patients.filtrer")}</button>
            {filtreActif && <Link href="/patients">{t("web.patients.effacer")}</Link>}
          </div>
        </form>

        {patients.length === 0 ? (
          <p className="carte">
            {filtreActif ? t("web.patients.aucunResultat") : t("web.patients.aucun")}
          </p>
        ) : (
          <ul className="liste-patients">
            {patients.map((p) =>
              "consentementRequis" in p ? null : (
                <li key={p.id}>
                  <Link href={`/patients/${p.id}/fiche`} className="carte-patient">
                    <span className="patient-nom">
                      {p.prenom} {p.nom}
                    </span>
                    <span className="patient-age">
                      {libelleAge(ageEnAnnees(new Date(p.dateNaissance)))} ·{" "}
                      {dateFr(p.dateNaissance)}
                    </span>
                    {p.pathologies && p.pathologies.length > 0 && (
                      <span className="etiquettes">
                        {p.pathologies.map((c) => (
                          <span key={c.id} className="etiquette">
                            {c.nom}
                          </span>
                        ))}
                      </span>
                    )}
                  </Link>
                </li>
              ),
            )}
          </ul>
        )}
      </main>
    </Coquille>
  );
}
