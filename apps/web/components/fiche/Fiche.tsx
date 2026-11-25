import Link from "next/link";
import { t } from "@app/shared";
import { Champ } from "@/components/Champ";
import { dateFr, libelleAge } from "@/lib/format";
import type { Categorie } from "@/lib/serveur/categories";
import { AGE_MIN_COMPTE_PATIENT } from "@/lib/serveur/invitations";
import type { Fiche as DonneesFiche } from "@/lib/serveur/patients";
import { CasesPathologies } from "./CasesPathologies";
import { Documents } from "./Documents";
import { FormulaireFiche } from "./FormulaireFiche";

/** Sous-partie Fiche du dossier patient. */
export function Fiche({ fiche, categories }: { fiche: DonneesFiche; categories: Categorie[] }) {
  const naissanceIso = new Date(fiche.dateNaissance).toISOString().slice(0, 10);
  const enfant = fiche.age < AGE_MIN_COMPTE_PATIENT;
  const aUnParent = fiche.contacts.some((c) => c.role === "PARENT");
  const aUnCompte = fiche.contacts.some((c) => c.role === "PATIENT_ADULT");
  let alerte: string | null = null;
  if (enfant && !aUnParent) alerte = t("web.fiche.alerteSansParent");
  else if (!enfant && !aUnCompte && !aUnParent) alerte = t("web.fiche.alerteSansCompteAdulte");

  return (
    <main className="contenu">
      <h1>
        {fiche.prenom} {fiche.nom}
        <span className="sous-titre">
          {libelleAge(fiche.age)} · {dateFr(fiche.dateNaissance)}
        </span>
      </h1>

      <div className="grille-fiche">
        <section className="carte" aria-labelledby="titre-identite">
          <h2 id="titre-identite">{t("web.fiche.identite")}</h2>
          <FormulaireFiche patientId={fiche.id}>
            <Champ
              libelle={t("web.fiche.prenom")}
              name="prenom"
              defaultValue={fiche.prenom}
              required
            />
            <Champ libelle={t("web.fiche.nom")} name="nom" defaultValue={fiche.nom} required />
            <Champ
              libelle={t("web.fiche.dateNaissance")}
              name="dateNaissance"
              type="date"
              defaultValue={naissanceIso}
              required
            />
          </FormulaireFiche>
        </section>

        <section className="carte" aria-labelledby="titre-pathologies">
          <h2 id="titre-pathologies">{t("web.fiche.pathologies")}</h2>
          <FormulaireFiche patientId={fiche.id} pathologies>
            <CasesPathologies
              legende={t("web.fiche.pathologies")}
              categories={categories}
              cochees={fiche.pathologies.map((p) => p.id)}
              legendeCachee
            />
          </FormulaireFiche>
        </section>

        <section className="carte" aria-labelledby="titre-contacts">
          <h2 id="titre-contacts">{t("web.fiche.contacts")}</h2>
          {alerte && <p className="alerte">{alerte}</p>}
          {fiche.contacts.length === 0 ? (
            <p>{t("web.fiche.aucunContact")}</p>
          ) : (
            <ul className="liste-contacts">
              {fiche.contacts.map((c) => (
                <li key={c.id}>
                  <strong>
                    {c.prenom} {c.nom}
                  </strong>{" "}
                  — {c.role === "PARENT" ? t("web.fiche.parent") : t("web.fiche.patientLuiMeme")}
                  <br />
                  <span className="discret">{c.email}</span>
                  <br />
                  {c.consentement ? (
                    <span className="statut statut-ok">
                      ✓ {t("web.fiche.consentementOk", { date: dateFr(c.consentement.accordeLe) })}
                    </span>
                  ) : (
                    <span className="statut statut-attente">
                      {t("web.fiche.consentementManquant")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {fiche.invitationsEnAttente.map((i) => (
            <p key={i.id} className="discret">
              {t("web.fiche.invitationEnAttente", { email: i.email, date: dateFr(i.expireLe) })}
            </p>
          ))}
          <Link className="bouton bouton-secondaire-vert" href={`/patients/${fiche.id}/invitation`}>
            {t("web.patients.inviter")}
          </Link>
        </section>

        <section className="carte" aria-labelledby="titre-medecin">
          <h2 id="titre-medecin">{t("web.fiche.medecin")}</h2>
          <FormulaireFiche patientId={fiche.id}>
            <Champ
              libelle={t("web.fiche.medecinNom")}
              name="medecinNom"
              defaultValue={fiche.medecinNom ?? ""}
              maxLength={200}
            />
            <Champ
              libelle={t("web.fiche.medecinContact")}
              name="medecinContact"
              defaultValue={fiche.medecinContact ?? ""}
              maxLength={200}
            />
          </FormulaireFiche>
        </section>

        <section className="carte" aria-labelledby="titre-documents">
          <h2 id="titre-documents">{t("web.fiche.documents")}</h2>
          <Documents patientId={fiche.id} documents={fiche.documents} />
        </section>

        <section className="carte carte-large" aria-labelledby="titre-notes">
          <h2 id="titre-notes">{t("web.fiche.notes")}</h2>
          <FormulaireFiche patientId={fiche.id}>
            <label className="champ">
              <span className="visuellement-cache">{t("web.fiche.notes")}</span>
              <textarea name="notes" rows={8} defaultValue={fiche.notes ?? ""} maxLength={20000} />
            </label>
          </FormulaireFiche>
        </section>
      </div>
    </main>
  );
}
