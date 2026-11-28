import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { jourFr, t } from "@app/shared";
import { COULEURS, nouveauPdf, piedDePage } from "./pdf-outils";

// Export d'un bilan, compte rendu ou courrier en PDF (pdf-lib) et en Word (.docx, docx).
// Les deux fichiers sont produits sur NOTRE serveur : aucun service externe.

export interface ContenuExport {
  titre: string;
  patient: { prenom: string; nom: string; dateNaissance: string };
  /** AAAA-MM-JJ */
  date: string;
  periode: { debut: string; fin: string } | null;
  destinataire: string | null;
  professionnel: string | null;
  sections: { titre: string; contenu: string }[];
  /** Des parties ne sont pas relues : mention « Brouillon ». */
  brouillon: boolean;
}

const E = "web.bilans.export";

/** Lignes d'en-tête communes (patient, date, période, destinataire, auteur). */
export function lignesEntete(c: ContenuExport): string[] {
  return [
    t(`${E}.patient`, {
      nom: `${c.patient.prenom} ${c.patient.nom}`,
      naissance: jourFr(c.patient.dateNaissance),
    }),
    c.periode
      ? t(`${E}.periode`, { debut: jourFr(c.periode.debut), fin: jourFr(c.periode.fin) })
      : t(`${E}.date`, { date: jourFr(c.date) }),
    ...(c.destinataire ? [t(`${E}.destinataire`, { destinataire: c.destinataire })] : []),
    ...(c.professionnel ? [t(`${E}.professionnel`, { nom: c.professionnel })] : []),
  ];
}

/** Ligne de texte : élément de liste (« - … ») ou paragraphe. */
export function analyserLigne(ligne: string): { puce: boolean; texte: string } {
  const m = /^\s*[-•]\s+(.*)$/.exec(ligne);
  return m ? { puce: true, texte: m[1] ?? "" } : { puce: false, texte: ligne };
}

export async function exporterPdf(c: ContenuExport, creeLe: Date): Promise<Uint8Array> {
  const { doc, normale, redacteur: r } = await nouveauPdf(c.titre, creeLe);
  if (c.brouillon) {
    r.texte(t(`${E}.brouillon`), { gras: true, couleur: COULEURS.alerte });
    r.espace(4);
  }
  r.texte(c.titre, { taille: 20, gras: true, couleur: COULEURS.vert });
  r.espace(4);
  for (const ligne of lignesEntete(c)) r.texte(ligne);
  for (const s of c.sections) {
    r.titreSection(s.titre);
    if (s.contenu.trim() === "") {
      r.texte(t(`${E}.vide`), { couleur: COULEURS.discret });
      continue;
    }
    for (const brute of s.contenu.split("\n")) {
      const { puce, texte } = analyserLigne(brute);
      if (puce) r.texte(`• ${texte}`, { retrait: 12 });
      else if (texte.trim() === "") r.espace(6);
      else r.texte(texte);
    }
  }
  piedDePage(doc, normale, (page, total) => t(`${E}.pied`, { page, total }));
  return doc.save();
}

const VERT = "2E7D6B";
const ROUGE = "8A1C13";

export async function exporterDocx(c: ContenuExport): Promise<Uint8Array> {
  const corps: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: c.titre, color: VERT, bold: true })],
    }),
    ...lignesEntete(c).map((l) => new Paragraph({ children: [new TextRun(l)] })),
  ];
  for (const s of c.sections) {
    corps.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240 },
        children: [new TextRun({ text: s.titre, color: VERT, bold: true })],
      }),
    );
    if (s.contenu.trim() === "") {
      corps.push(
        new Paragraph({ children: [new TextRun({ text: t(`${E}.vide`), italics: true })] }),
      );
      continue;
    }
    for (const brute of s.contenu.split("\n")) {
      const { puce, texte } = analyserLigne(brute);
      corps.push(
        puce
          ? new Paragraph({ text: texte, bullet: { level: 0 } })
          : new Paragraph({ children: [new TextRun(texte)] }),
      );
    }
  }
  const document = new Document({
    // Métadonnées neutres : ni nom ni contenu médical.
    title: c.titre,
    creator: "",
    lastModifiedBy: "",
    description: "",
    sections: [
      {
        headers: c.brouillon
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: t(`${E}.brouillon`), bold: true, color: ROUGE }),
                    ],
                  }),
                ],
              }),
            }
          : undefined,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [new TextRun({ text: t(`${E}.piedWord`), size: 16, color: "4A5A6E" })],
              }),
            ],
          }),
        },
        children: corps,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(document));
}
