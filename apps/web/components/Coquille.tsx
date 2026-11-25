import type { ReactNode } from "react";
import { t } from "@app/shared";
import { BoutonDeconnexion } from "@/components/BoutonDeconnexion";
import { LienMenu } from "@/components/LienMenu";
import { SECTIONS_PATIENT, type SectionPatient } from "@/lib/serveur/droits";

export interface PatientMenu {
  id: string;
  prenom: string;
  nom: string;
  messagerieActivee: boolean;
}

/** Sous-parties visibles : la messagerie disparaît si elle est désactivée (règle produit). */
export function sectionsVisibles(patient: PatientMenu): SectionPatient[] {
  return SECTIONS_PATIENT.filter((s) => s !== "messagerie" || patient.messagerieActivee);
}

/**
 * Mise en page du logiciel : menu principal à gauche (Patients, Bibliothèque).
 * Dans un dossier, les sous-parties du patient s'affichent sous son nom, dans
 * l'entrée « Patients ». La Bibliothèque reste une partie à part.
 */
export function Coquille({ patient, children }: { patient?: PatientMenu; children: ReactNode }) {
  return (
    <div className="coquille">
      <aside className="menu-gauche">
        <p className="nom-app">{t("app.nom")}</p>
        <nav aria-label={t("web.menu.principal")}>
          <ul>
            <li>
              <LienMenu href="/patients" prefixe>
                {t("web.menu.patients")}
              </LienMenu>
              {patient && (
                <div className="menu-dossier">
                  <p className="nom-patient">
                    {patient.prenom} {patient.nom}
                  </p>
                  <ul aria-label={t("web.menu.dossier", { prenom: patient.prenom })}>
                    {sectionsVisibles(patient).map((section) => (
                      <li key={section}>
                        <LienMenu
                          href={`/patients/${patient.id}/${section}`}
                          className="lien-section"
                        >
                          {t(`web.sections.${section}`)}
                        </LienMenu>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
            <li>
              <LienMenu href="/bibliotheque" prefixe>
                {t("web.menu.bibliotheque")}
              </LienMenu>
            </li>
          </ul>
        </nav>
        <div className="menu-bas">
          <BoutonDeconnexion />
        </div>
      </aside>
      <div className="zone-principale">{children}</div>
    </div>
  );
}
