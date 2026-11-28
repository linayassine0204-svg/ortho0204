import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Outils communs des PDF produits sur NOTRE serveur (fiche de séance, bilans) avec
// pdf-lib : aucun service externe ne reçoit le contenu. Polices standard du PDF.

export const A4 = { largeur: 595.28, hauteur: 841.89 };
export const MARGE = 50;
export const LARGEUR_TEXTE = A4.largeur - 2 * MARGE;
export const BAS = MARGE + 30; // place du pied de page
export const COULEURS = {
  texte: rgb(0.106, 0.165, 0.255), // bleu nuit #1B2A41
  vert: rgb(0.18, 0.49, 0.42), // vert #2E7D6B
  discret: rgb(0.35, 0.38, 0.43),
  alerte: rgb(0.54, 0.11, 0.07), // rouge #8A1C13
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
export class Redacteur {
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

/** Nouveau document A4 aux métadonnées neutres (ni nom, ni contenu médical). */
export async function nouveauPdf(titre: string, creeLe: Date) {
  const doc = await PDFDocument.create();
  doc.setTitle(titre);
  doc.setCreator("");
  doc.setProducer("");
  doc.setCreationDate(creeLe);
  doc.setModificationDate(creeLe);
  const normale = await doc.embedFont(StandardFonts.Helvetica);
  const grasse = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, normale, grasse, redacteur: new Redacteur(doc, normale, grasse) };
}

/** Pied de page sur chaque page (confidentialité, numéro de page). */
export function piedDePage(
  doc: PDFDocument,
  police: PDFFont,
  texte: (page: number, total: number) => string,
) {
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    page.drawText(texteImprimable(texte(i + 1, pages.length), police), {
      x: MARGE,
      y: MARGE - 10,
      size: 8,
      font: police,
      color: COULEURS.discret,
    });
  });
}
