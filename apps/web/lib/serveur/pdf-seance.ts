import { dureeSeance, t, type MaterielAPreparer } from "@app/shared";
import { jourFr, libelleAge } from "@/lib/format";
import { COULEURS, nouveauPdf, piedDePage } from "./pdf-outils";

// Fiche de séance imprimable (A4), produite entièrement sur notre serveur avec pdf-lib :
// aucun service externe ne reçoit le contenu. Les polices standard du PDF sont utilisées
// (pas de fichier de police à charger).

export interface DonneesFiche {
  patient: { prenom: string; nom: string; age: number };
  date: Date;
  professionnel: string | null;
  objectifs: string | null;
  pointsAReprendre: { date: Date; texte: string } | null;
  exercices: {
    titre: string;
    niveau: number;
    consigne: string;
    dureeMinutes: number;
    materiel: string[];
    aValider: boolean;
  }[];
  materiel: MaterielAPreparer[];
  materielEnPlus: string | null;
  notes: string | null;
  creeLe: Date;
}

export async function ficheSeancePdf(d: DonneesFiche): Promise<Uint8Array> {
  const { doc, normale, redacteur: r } = await nouveauPdf(t("web.preparation.pdf.titre"), d.creeLe);
  const p = "web.preparation.pdf";

  r.texte(t(`${p}.titre`), { taille: 22, gras: true, couleur: COULEURS.vert });
  r.espace(4);
  r.texte(
    t(`${p}.patient`, {
      nom: `${d.patient.prenom} ${d.patient.nom}`,
      age: libelleAge(d.patient.age),
    }),
    { gras: true },
  );
  r.texte(t(`${p}.date`, { date: jourFr(d.date) }));
  if (d.professionnel) r.texte(t(`${p}.professionnel`, { nom: d.professionnel }));

  if (d.objectifs) {
    r.titreSection(t(`${p}.objectifs`));
    r.texte(d.objectifs);
  }
  if (d.pointsAReprendre) {
    r.titreSection(t(`${p}.points`, { date: jourFr(d.pointsAReprendre.date) }));
    r.texte(d.pointsAReprendre.texte);
  }

  r.titreSection(t(`${p}.exercices`, { n: d.exercices.length, minutes: dureeSeance(d.exercices) }));
  if (d.exercices.length === 0) r.texte(t(`${p}.aucunExercice`));
  d.exercices.forEach((e, i) => {
    r.place(50);
    r.texte(
      t(`${p}.ligneExercice`, {
        numero: i + 1,
        titre: e.titre,
        niveau: e.niveau,
        minutes: e.dureeMinutes,
      }),
      { gras: true, taille: 12 },
    );
    if (e.consigne) r.texte(e.consigne, { retrait: 14 });
    if (e.materiel.length > 0) {
      r.texte(t(`${p}.materielExercice`, { materiel: e.materiel.join(", ") }), {
        retrait: 14,
        taille: 10,
        couleur: COULEURS.discret,
      });
    }
    if (e.aValider) {
      r.texte(t(`${p}.aValider`), { retrait: 14, taille: 9, couleur: COULEURS.discret });
    }
    r.espace(6);
  });

  r.titreSection(t(`${p}.materiel`));
  if (d.materiel.length === 0 && !d.materielEnPlus) r.texte(t(`${p}.aucunMateriel`));
  for (const m of d.materiel) {
    r.caseACocher(m.nom, t("web.preparation.materiel.pour", { exercices: m.exercices.join(", ") }));
  }
  if (d.materielEnPlus) r.caseACocher(t(`${p}.materielEnPlus`, { texte: d.materielEnPlus }), "");

  r.titreSection(t(`${p}.notes`));
  if (d.notes) r.texte(d.notes);
  r.lignesAEcrire(d.notes ? 3 : 8);

  piedDePage(doc, normale, (page, total) => t(`${p}.pied`, { page, total }));

  return doc.save();
}
