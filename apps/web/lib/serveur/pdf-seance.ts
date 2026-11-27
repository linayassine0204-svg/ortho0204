import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { dureeSeance, t, type MaterielAPreparer } from "@app/shared";
import { jourFr, libelleAge } from "@/lib/format";

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

const A4 = { largeur: 595.28, hauteur: 841.89 };
const MARGE = 50;
const LARGEUR_TEXTE = A4.largeur - 2 * MARGE;
const BAS = MARGE + 30; // place du pied de page
const COULEURS = {
  texte: rgb(0.106, 0.165, 0.255), // bleu nuit #1B2A41
  vert: rgb(0.18, 0.49, 0.42), // vert #2E7D6B
  discret: rgb(0.35, 0.38, 0.43),
};

/**
 * Les polices standard du PDF ne savent écrire que l'alphabet « WinAnsi » (français
 * compris). Tout autre caractère (emoji, etc.) est remplacé, pour ne jamais échouer.
 */
export function texteImprimable(texte: string, police: PDFFont): string {
  const connus = new Set(police.getCharacterSet());
  return [...texte.normalize("NFC").replace(/\t/g, "    ")]
    .map((c) => (c === "\n" || connus.has(c.codePointAt(0) ?? -1) ? c : "?"))
    .join("");
}

/** Découpe un texte en lignes qui tiennent dans `largeur` (les retours à la ligne sont gardés). */
export function couperLignes(
  texte: string,
  police: PDFFont,
  taille: number,
  largeur: number,
): string[] {
  const lignes: string[] = [];
  for (const paragraphe of texte.split("\n")) {
    let ligne = "";
    for (const mot of paragraphe.split(/ +/)) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, taille) <= largeur) {
        ligne = essai;
        continue;
      }
      if (ligne) lignes.push(ligne);
      // Mot plus long que la ligne : coupé en morceaux.
      let reste = mot;
      while (police.widthOfTextAtSize(reste, taille) > largeur) {
        let n = reste.length - 1;
        while (n > 1 && police.widthOfTextAtSize(reste.slice(0, n), taille) > largeur) n--;
        lignes.push(reste.slice(0, n));
        reste = reste.slice(n);
      }
      ligne = reste;
    }
    lignes.push(ligne);
  }
  return lignes;
}

/** Écrit de haut en bas, en ajoutant des pages quand il le faut. */
class Redacteur {
  private page!: PDFPage;
  private y = 0;

  constructor(
    private readonly doc: PDFDocument,
    private readonly normale: PDFFont,
    private readonly grasse: PDFFont,
  ) {
    this.nouvellePage();
  }

  private nouvellePage() {
    this.page = this.doc.addPage([A4.largeur, A4.hauteur]);
    this.y = A4.hauteur - MARGE;
  }

  /** Garantit `hauteur` points libres sur la page, sinon page suivante. */
  place(hauteur: number) {
    if (this.y - hauteur < BAS) this.nouvellePage();
  }

  espace(points: number) {
    this.y -= points;
  }

  texte(
    contenu: string,
    options: {
      taille?: number;
      gras?: boolean;
      couleur?: ReturnType<typeof rgb>;
      retrait?: number;
    } = {},
  ) {
    const taille = options.taille ?? 11;
    const police = options.gras ? this.grasse : this.normale;
    const retrait = options.retrait ?? 0;
    const interligne = taille * 1.35;
    for (const ligne of couperLignes(
      texteImprimable(contenu, police),
      police,
      taille,
      LARGEUR_TEXTE - retrait,
    )) {
      this.place(interligne);
      this.y -= interligne;
      this.page.drawText(ligne, {
        x: MARGE + retrait,
        y: this.y + taille * 0.3,
        size: taille,
        font: police,
        color: options.couleur ?? COULEURS.texte,
      });
    }
  }

  titreSection(contenu: string) {
    this.place(40);
    this.espace(10);
    this.texte(contenu, { taille: 14, gras: true, couleur: COULEURS.vert });
    this.page.drawLine({
      start: { x: MARGE, y: this.y - 2 },
      end: { x: A4.largeur - MARGE, y: this.y - 2 },
      thickness: 1,
      color: COULEURS.vert,
    });
    this.espace(6);
  }

  /** Case à cocher (matériel préparé), suivie du texte. */
  caseACocher(contenu: string, detail: string) {
    this.place(18);
    this.page.drawRectangle({
      x: MARGE,
      y: this.y - 13,
      width: 10,
      height: 10,
      borderColor: COULEURS.texte,
      borderWidth: 1,
    });
    this.texte(contenu, { retrait: 18, gras: true });
    if (detail) this.texte(detail, { retrait: 18, taille: 9, couleur: COULEURS.discret });
  }

  /** Lignes vides pour écrire à la main. */
  lignesAEcrire(nombre: number) {
    for (let i = 0; i < nombre; i++) {
      this.place(24);
      this.y -= 24;
      this.page.drawLine({
        start: { x: MARGE, y: this.y },
        end: { x: A4.largeur - MARGE, y: this.y },
        thickness: 0.5,
        color: COULEURS.discret,
      });
    }
  }
}

export async function ficheSeancePdf(d: DonneesFiche): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  // Métadonnées neutres : ni nom ni contenu médical.
  doc.setTitle(t("web.preparation.pdf.titre"));
  doc.setCreator("");
  doc.setProducer("");
  doc.setCreationDate(d.creeLe);
  doc.setModificationDate(d.creeLe);
  const normale = await doc.embedFont(StandardFonts.Helvetica);
  const grasse = await doc.embedFont(StandardFonts.HelveticaBold);
  const r = new Redacteur(doc, normale, grasse);
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

  // Pied de page : confidentialité et numéro de page.
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const pied = texteImprimable(t(`${p}.pied`, { page: i + 1, total: pages.length }), normale);
    page.drawText(pied, {
      x: MARGE,
      y: MARGE - 10,
      size: 8,
      font: normale,
      color: COULEURS.discret,
    });
  });

  return doc.save();
}
