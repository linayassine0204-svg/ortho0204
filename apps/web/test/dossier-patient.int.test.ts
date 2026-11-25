import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as listerPatients, POST as creer } from "@/app/api/patients/route";
import { GET as lirePatient } from "@/app/api/patients/[id]/route";
import { GET as lireFiche, PATCH as modifierFiche } from "@/app/api/patients/[id]/fiche/route";
import { POST as ajouterDocument } from "@/app/api/patients/[id]/documents/route";
import {
  DELETE as supprimerDocument,
  GET as telechargerDocument,
} from "@/app/api/patients/[id]/documents/[documentId]/route";
import { db } from "@/lib/serveur/db";
import {
  PDF_FICTIF,
  PNG_FICTIF,
  appeler,
  creerCabinet,
  creerCompte,
  envoyerFichier,
  jetonMobile,
  jetonWeb,
  unique,
} from "./outils";

// Dossier patient : création, recherche, Fiche, documents, et refus pour un autre cabinet.

let cookieA: string;
let cookieB: string;
let cabA: { id: string };
let categories: { id: string; slug: string }[];

beforeAll(async () => {
  cabA = await creerCabinet();
  const cabB = await creerCabinet();
  cookieA = await jetonWeb((await creerCompte("ORTHO", cabA.id)).id);
  cookieB = await jetonWeb((await creerCompte("ORTHO", cabB.id)).id);
  const slugs = ["voix", "begaiement"].map((s) => `${s}-${unique()}`);
  categories = await Promise.all(
    slugs.map((slug) =>
      db().categorie.create({
        data: { nom: `Catégorie ${slug}`, slug },
        select: { id: true, slug: true },
      }),
    ),
  );
});
afterAll(() => db().$disconnect());

async function nouveauPatient(cookie: string, champs: Record<string, unknown> = {}) {
  const r = await appeler(creer, {
    cookie,
    corps: {
      prenom: "Inès",
      nom: `Exemple${unique()}`,
      dateNaissance: "2018-04-12",
      pathologieIds: [categories[0]?.id],
      ...champs,
    },
  });
  expect(r.status).toBe(201);
  return r.corps.id as string;
}

describe("création d'un patient", () => {
  it("crée le patient dans le cabinet de l'orthophoniste, avec ses pathologies", async () => {
    const id = await nouveauPatient(cookieA, { cabinetId: "cabinet-pirate" });
    const p = await db().patient.findUniqueOrThrow({
      where: { id },
      include: { pathologies: true },
    });
    expect(p.cabinetId).toBe(cabA.id); // jamais le cabinet envoyé par le client
    expect(p.dateNaissance.toISOString().slice(0, 10)).toBe("2018-04-12");
    expect(p.pathologies.map((x) => x.categorieId)).toEqual([categories[0]?.id]);
  });

  it("refuse des données invalides (date future, date impossible, nom vide)", async () => {
    for (const champs of [
      { dateNaissance: "2999-01-01" },
      { dateNaissance: "2020-02-30" },
      { nom: "  " },
    ]) {
      const r = await appeler(creer, {
        cookie: cookieA,
        corps: { prenom: "A", nom: "B", dateNaissance: "2018-01-01", ...champs },
      });
      expect(r.status).toBe(400);
    }
  });

  it("refuse une pathologie inconnue", async () => {
    const r = await appeler(creer, {
      cookie: cookieA,
      corps: { prenom: "A", nom: "B", dateNaissance: "2018-01-01", pathologieIds: ["inconnue"] },
    });
    expect(r.status).toBe(400);
    expect(r.corps.erreur.code).toBe("pathologie_inconnue");
  });

  it("ÉCHEC : un parent ne peut pas créer de patient", async () => {
    const parent = await creerCompte("PARENT", cabA.id);
    const r = await appeler(creer, {
      bearer: await jetonMobile(parent.id),
      corps: { prenom: "A", nom: "B", dateNaissance: "2018-01-01" },
    });
    expect(r.status).toBe(404);
  });
});

describe("liste : recherche et filtre par pathologie", () => {
  it("cherche par prénom ou nom, sans tenir compte des majuscules", async () => {
    const nom = `Recherche${unique()}`;
    const id = await nouveauPatient(cookieA, { prenom: "Zoé", nom });
    const parNom = await appeler(listerPatients, {
      cookie: cookieA,
      url: `http://localhost:3000/api/patients?q=${nom.toLowerCase()}`,
    });
    expect(parNom.corps.patients.map((p: { id: string }) => p.id)).toEqual([id]);
    const parPrenom = await appeler(listerPatients, {
      cookie: cookieA,
      url: "http://localhost:3000/api/patients?q=zo",
    });
    expect(parPrenom.corps.patients.map((p: { id: string }) => p.id)).toContain(id);
  });

  it("filtre par pathologie", async () => {
    const avec = await nouveauPatient(cookieA, { pathologieIds: [categories[1]?.id] });
    await nouveauPatient(cookieA, { pathologieIds: [] });
    const r = await appeler(listerPatients, {
      cookie: cookieA,
      url: `http://localhost:3000/api/patients?pathologie=${categories[1]?.slug}`,
    });
    expect(r.corps.patients.map((p: { id: string }) => p.id)).toEqual([avec]);
    expect(r.corps.patients[0].pathologies[0].slug).toBe(categories[1]?.slug);
  });

  it("ÉCHEC : la recherche ne trouve jamais les patients d'un autre cabinet", async () => {
    const nom = `Cloison${unique()}`;
    await nouveauPatient(cookieA, { nom });
    const r = await appeler(listerPatients, {
      cookie: cookieB,
      url: `http://localhost:3000/api/patients?q=${nom}`,
    });
    expect(r.corps.patients).toEqual([]);
  });
});

describe("Fiche", () => {
  it("se lit en entier et la lecture est écrite dans le journal (section « fiche »)", async () => {
    const id = await nouveauPatient(cookieA);
    const r = await appeler(lireFiche, { cookie: cookieA, params: { id } });
    expect(r.status).toBe(200);
    expect(r.corps.fiche).toMatchObject({ id, prenom: "Inès", contacts: [], documents: [] });
    const journal = await db().journalAcces.findMany({
      where: { patientId: id, action: "LECTURE" },
    });
    expect(journal.map((l) => l.section)).toEqual(["fiche"]);
  });

  it("se remplit : identité, pathologies, médecin, notes (et on peut effacer un champ)", async () => {
    const id = await nouveauPatient(cookieA);
    const r = await appeler(modifierFiche, {
      methode: "PATCH",
      cookie: cookieA,
      params: { id },
      corps: {
        nom: "Nouveau",
        pathologieIds: [categories[0]?.id, categories[1]?.id],
        medecinNom: "Dr Exemple (fictif)",
        medecinContact: "01 00 00 00 00",
        notes: "Note fictive",
      },
    });
    expect(r.status).toBe(204);
    await appeler(modifierFiche, {
      methode: "PATCH",
      cookie: cookieA,
      params: { id },
      corps: { medecinContact: "" },
    });
    const fiche = (await appeler(lireFiche, { cookie: cookieA, params: { id } })).corps.fiche;
    expect(fiche.nom).toBe("Nouveau");
    expect(fiche.pathologies).toHaveLength(2);
    expect(fiche.medecinNom).toBe("Dr Exemple (fictif)");
    expect(fiche.medecinContact).toBeNull();
    expect(fiche.notes).toBe("Note fictive");
    const modifs = await db().journalAcces.count({
      where: { patientId: id, action: "MODIFICATION" },
    });
    expect(modifs).toBe(3); // création + 2 modifications
  });

  it("montre les contacts et l'état de leur consentement", async () => {
    const parentOk = await creerCompte("PARENT", cabA.id);
    const parentSans = await creerCompte("PARENT", cabA.id);
    const p = await db().patient.create({
      data: {
        cabinetId: cabA.id,
        prenom: "Contact",
        nom: "Exemple",
        dateNaissance: new Date("2019-01-01"),
        tuteurs: { create: [{ parentId: parentOk.id }, { parentId: parentSans.id }] },
        consentements: {
          create: { userId: parentOk.id, type: "DONNEES_SANTE", versionTexte: "2026-11-v1" },
        },
      },
    });
    const fiche = (await appeler(lireFiche, { cookie: cookieA, params: { id: p.id } })).corps.fiche;
    const parId = (uid: string) => fiche.contacts.find((c: { id: string }) => c.id === uid);
    expect(parId(parentOk.id).consentement.version).toBe("2026-11-v1");
    expect(parId(parentSans.id).consentement).toBeNull();
  });

  it("ÉCHEC : un parent, même relié et consentant, ne lit pas la Fiche", async () => {
    const parent = await creerCompte("PARENT", cabA.id);
    const p = await db().patient.create({
      data: {
        cabinetId: cabA.id,
        prenom: "A",
        nom: "B",
        dateNaissance: new Date("2019-01-01"),
        tuteurs: { create: { parentId: parent.id } },
        consentements: { create: { userId: parent.id, type: "DONNEES_SANTE", versionTexte: "t" } },
      },
    });
    const r = await appeler(lireFiche, {
      bearer: await jetonMobile(parent.id),
      params: { id: p.id },
    });
    expect(r.status).toBe(404);
  });
});

describe("accès refusé au dossier d'un autre cabinet", () => {
  it("ÉCHEC partout : résumé, Fiche, modification, documents (404, rien de modifié)", async () => {
    const id = await nouveauPatient(cookieA, { nom: "Intact" });
    const doc = await envoyerFichier(
      ajouterDocument,
      { cookie: cookieA, params: { id } },
      { nom: "ordonnance.pdf", octets: PDF_FICTIF },
    );
    const documentId = doc.corps.document.id as string;

    expect((await appeler(lirePatient, { cookie: cookieB, params: { id } })).status).toBe(404);
    expect((await appeler(lireFiche, { cookie: cookieB, params: { id } })).status).toBe(404);
    const modif = await appeler(modifierFiche, {
      methode: "PATCH",
      cookie: cookieB,
      params: { id },
      corps: { nom: "Piraté" },
    });
    expect(modif.status).toBe(404);
    const ajout = await envoyerFichier(
      ajouterDocument,
      { cookie: cookieB, params: { id } },
      { nom: "x.pdf", octets: PDF_FICTIF },
    );
    expect(ajout.status).toBe(404);
    const telechargement = await appeler(telechargerDocument, {
      cookie: cookieB,
      params: { id, documentId },
    });
    expect(telechargement.status).toBe(404);
    const suppression = await appeler(supprimerDocument, {
      methode: "DELETE",
      cookie: cookieB,
      params: { id, documentId },
    });
    expect(suppression.status).toBe(404);

    const p = await db().patient.findUniqueOrThrow({ where: { id }, include: { documents: true } });
    expect(p.nom).toBe("Intact");
    expect(p.documents).toHaveLength(1);
  });

  it("ÉCHEC : un document ne se lit pas en passant par un autre patient", async () => {
    const id1 = await nouveauPatient(cookieA);
    const id2 = await nouveauPatient(cookieA);
    const doc = await envoyerFichier(
      ajouterDocument,
      { cookie: cookieA, params: { id: id1 } },
      { nom: "a.pdf", octets: PDF_FICTIF },
    );
    const r = await appeler(telechargerDocument, {
      cookie: cookieA,
      params: { id: id2, documentId: doc.corps.document.id },
    });
    expect(r.status).toBe(404);
  });
});

describe("documents de la Fiche", () => {
  it("ajout, téléchargement (journalisé EXPORT) et suppression", async () => {
    const id = await nouveauPatient(cookieA);
    const ajout = await envoyerFichier(
      ajouterDocument,
      { cookie: cookieA, params: { id } },
      { nom: "../../compte rendu.pdf", octets: PDF_FICTIF, type: "image/png" },
    );
    expect(ajout.status).toBe(201);
    // Nom nettoyé, type réel détecté (le type annoncé est ignoré).
    expect(ajout.corps.document).toMatchObject({
      nomFichier: "compte rendu.pdf",
      typeMime: "application/pdf",
    });
    const documentId = ajout.corps.document.id as string;

    const req = await telechargerDocument(
      new (await import("next/server")).NextRequest("http://localhost:3000/api/test", {
        headers: { cookie: `session=${cookieA}` },
      }),
      { params: Promise.resolve({ id, documentId }) },
    );
    expect(req.status).toBe(200);
    expect(req.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(req.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await req.arrayBuffer())).toEqual(PDF_FICTIF);
    expect(
      await db().journalAcces.count({
        where: { patientId: id, action: "EXPORT", section: "documents" },
      }),
    ).toBe(1);

    const suppression = await appeler(supprimerDocument, {
      methode: "DELETE",
      cookie: cookieA,
      params: { id, documentId },
    });
    expect(suppression.status).toBe(204);
    expect(await db().document.count({ where: { patientId: id } })).toBe(0);
  });

  it("accepte une image PNG", async () => {
    const id = await nouveauPatient(cookieA);
    const r = await envoyerFichier(
      ajouterDocument,
      { cookie: cookieA, params: { id } },
      { nom: "dessin.png", octets: PNG_FICTIF },
    );
    expect(r.corps.document.typeMime).toBe("image/png");
  });

  it("refuse un type non autorisé, même déguisé en PDF", async () => {
    const id = await nouveauPatient(cookieA);
    const r = await envoyerFichier(
      ajouterDocument,
      { cookie: cookieA, params: { id } },
      {
        nom: "piege.pdf",
        octets: new TextEncoder().encode("<script>alert(1)</script>"),
        type: "application/pdf",
      },
    );
    expect(r.status).toBe(415);
    expect(await db().document.count({ where: { patientId: id } })).toBe(0);
  });

  it("refuse un fichier de plus de 10 Mo", async () => {
    const id = await nouveauPatient(cookieA);
    const gros = new Uint8Array(10 * 1024 * 1024 + 1);
    gros.set(PDF_FICTIF);
    const r = await envoyerFichier(
      ajouterDocument,
      { cookie: cookieA, params: { id } },
      { nom: "gros.pdf", octets: gros },
    );
    expect(r.status).toBe(413);
  });
});
