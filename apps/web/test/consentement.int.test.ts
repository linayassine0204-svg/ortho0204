import { afterAll, describe, expect, it } from "vitest";
import { CONSENTEMENT_DONNEES_SANTE } from "@app/shared";
import { GET as listerPatients } from "@/app/api/patients/route";
import { GET as lirePatient } from "@/app/api/patients/[id]/route";
import { DELETE as retirer, POST as consentir } from "@/app/api/patients/[id]/consentement/route";
import { db } from "@/lib/serveur/db";
import { appeler, creerCabinet, creerCompte, creerPatient, jetonMobile, jetonWeb } from "./outils";

// Consentement : sans lui, aucune donnée n'est envoyée à l'application de la famille.

afterAll(() => db().$disconnect());

async function enfantAvecParent() {
  const cab = await creerCabinet();
  const parent = await creerCompte("PARENT", cab.id);
  const enfant = await creerPatient(cab.id, {
    age: 8,
    tuteurIds: [parent.id],
    consentement: false,
  });
  return { cab, parent, enfant, bearer: await jetonMobile(parent.id) };
}

describe("enfant de moins de 15 ans : consentement du parent", () => {
  it("sans consentement : prénom seulement dans la liste, dossier refusé (403)", async () => {
    const { enfant, bearer } = await enfantAvecParent();
    const liste = await appeler(listerPatients, { bearer });
    expect(liste.corps.patients).toEqual([
      { id: enfant.id, prenom: enfant.prenom, consentementRequis: true },
    ]);
    const r = await appeler(lirePatient, { bearer, params: { id: enfant.id } });
    expect(r.status).toBe(403);
    expect(r.corps.erreur.code).toBe("consentement_requis");
    expect(JSON.stringify(r.corps)).not.toContain("dateNaissance");
    // Une tentative refusée n'est pas une lecture du dossier.
    expect(await db().journalAcces.count({ where: { patientId: enfant.id } })).toBe(0);
  });

  it("le parent consent : texte versionné et date enregistrés, puis accès au dossier", async () => {
    const { parent, enfant, bearer } = await enfantAvecParent();
    const avant = new Date();
    const r = await appeler(consentir, { methode: "POST", bearer, params: { id: enfant.id } });
    expect(r.status).toBe(201);
    expect(r.corps.consentement.version).toBe(CONSENTEMENT_DONNEES_SANTE.version);
    const enBase = await db().consentement.findFirstOrThrow({
      where: { userId: parent.id, patientId: enfant.id, type: "DONNEES_SANTE" },
    });
    expect(enBase.versionTexte).toBe(CONSENTEMENT_DONNEES_SANTE.version);
    expect(enBase.accordeLe.getTime()).toBeGreaterThanOrEqual(avant.getTime() - 1000);
    expect(enBase.retire).toBe(false);
    expect((await appeler(lirePatient, { bearer, params: { id: enfant.id } })).status).toBe(200);
  });

  it("consentir deux fois ne crée qu'une preuve", async () => {
    const { parent, enfant, bearer } = await enfantAvecParent();
    await appeler(consentir, { methode: "POST", bearer, params: { id: enfant.id } });
    await appeler(consentir, { methode: "POST", bearer, params: { id: enfant.id } });
    expect(
      await db().consentement.count({ where: { userId: parent.id, patientId: enfant.id } }),
    ).toBe(1);
  });

  it("retirer son consentement coupe l'accès ; la preuve est gardée avec la date du retrait", async () => {
    const { parent, enfant, bearer } = await enfantAvecParent();
    await appeler(consentir, { methode: "POST", bearer, params: { id: enfant.id } });
    const r = await appeler(retirer, { methode: "DELETE", bearer, params: { id: enfant.id } });
    expect(r.status).toBe(204);
    expect((await appeler(lirePatient, { bearer, params: { id: enfant.id } })).status).toBe(403);
    const preuve = await db().consentement.findFirstOrThrow({
      where: { userId: parent.id, patientId: enfant.id },
    });
    expect(preuve.retire).toBe(true);
    expect(preuve.retireLe).not.toBeNull();
  });

  it("chaque parent consent pour lui-même : le consentement de l'autre parent ne suffit pas", async () => {
    const cab = await creerCabinet();
    const mere = await creerCompte("PARENT", cab.id);
    const pere = await creerCompte("PARENT", cab.id);
    const enfant = await creerPatient(cab.id, {
      tuteurIds: [mere.id, pere.id],
      consentement: false,
    });
    await appeler(consentir, {
      methode: "POST",
      bearer: await jetonMobile(mere.id),
      params: { id: enfant.id },
    });
    const pereBearer = await jetonMobile(pere.id);
    expect(
      (await appeler(lirePatient, { bearer: pereBearer, params: { id: enfant.id } })).status,
    ).toBe(403);
  });

  it("ÉCHEC : un parent ne peut pas consentir pour l'enfant d'un autre (404)", async () => {
    const { enfant } = await enfantAvecParent();
    const intrus = await creerCompte("PARENT", (await creerCabinet()).id);
    const r = await appeler(consentir, {
      methode: "POST",
      bearer: await jetonMobile(intrus.id),
      params: { id: enfant.id },
    });
    expect(r.status).toBe(404);
    expect(await db().consentement.count({ where: { patientId: enfant.id } })).toBe(0);
  });

  it("ÉCHEC : l'orthophoniste ne peut pas consentir à la place de la famille", async () => {
    const { cab, enfant } = await enfantAvecParent();
    const ortho = await creerCompte("ORTHO", cab.id);
    const r = await appeler(consentir, {
      methode: "POST",
      cookie: await jetonWeb(ortho.id),
      params: { id: enfant.id },
    });
    expect(r.status).toBe(404);
  });

  it("la règle vaut aussi pour un parent connecté au web", async () => {
    const { parent, enfant } = await enfantAvecParent();
    const cookie = await jetonWeb(parent.id);
    expect((await appeler(lirePatient, { cookie, params: { id: enfant.id } })).status).toBe(403);
  });
});

describe("patient adulte : son propre consentement", () => {
  it("sans consentement rien ; après son consentement, son dossier", async () => {
    const cab = await creerCabinet();
    const compte = await creerCompte("PATIENT_ADULT", cab.id);
    const dossier = await creerPatient(cab.id, {
      age: 30,
      compteUserId: compte.id,
      consentement: false,
    });
    const bearer = await jetonMobile(compte.id);
    expect((await appeler(lirePatient, { bearer, params: { id: dossier.id } })).status).toBe(403);
    const r = await appeler(consentir, { methode: "POST", bearer, params: { id: dossier.id } });
    expect(r.status).toBe(201);
    const enBase = await db().consentement.findFirstOrThrow({
      where: { userId: compte.id, patientId: dossier.id },
    });
    expect(enBase.versionTexte).toBe(CONSENTEMENT_DONNEES_SANTE.version);
    expect((await appeler(lirePatient, { bearer, params: { id: dossier.id } })).status).toBe(200);
  });
});
