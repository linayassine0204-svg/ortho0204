import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as lirePatient } from "@/app/api/patients/[id]/route";
import { GET as listerPatients } from "@/app/api/patients/route";
import { POST as inviter } from "@/app/api/patients/[id]/invitations/route";
import { GET as moi } from "@/app/api/auth/moi/route";
import { db } from "@/lib/serveur/db";
import { appeler, deuxCabinets, emailFictif, jetonMobile, jetonWeb } from "./outils";

// Règles de droits vérifiées DE BOUT EN BOUT dans l'API (pas seulement dans `can()`),
// avec des tentatives d'accès au dossier d'un autre utilisateur, qui doivent échouer.

let d: Awaited<ReturnType<typeof deuxCabinets>>;
const jetons: Record<string, string> = {};

beforeAll(async () => {
  d = await deuxCabinets();
  jetons.orthoA = await jetonWeb(d.orthoA.id);
  jetons.orthoB = await jetonWeb(d.orthoB.id);
  jetons.parentA1 = await jetonMobile(d.parentA1.id);
  jetons.parentA2 = await jetonMobile(d.parentA2.id);
  jetons.parentB = await jetonMobile(d.parentB.id);
  jetons.adulteA = await jetonMobile(d.adulteA.id);
  jetons.adulteA2 = await jetonMobile(d.adulteA2.id);
});
afterAll(() => db().$disconnect());

const lire = (patientId: string, auth: { cookie?: string; bearer?: string }) =>
  appeler(lirePatient, { ...auth, params: { id: patientId } });

describe("sans connexion", () => {
  it("toutes les routes protégées répondent 401", async () => {
    expect((await lire(d.enfantA1.id, {})).status).toBe(401);
    expect((await appeler(listerPatients)).status).toBe(401);
    expect((await appeler(moi)).status).toBe(401);
    const r = await appeler(inviter, {
      params: { id: d.enfantA1.id },
      corps: { email: emailFictif("x"), role: "PARENT" },
    });
    expect(r.status).toBe(401);
  });

  it("un jeton inventé ou un jeton mobile dans le cookie web est refusé", async () => {
    expect((await lire(d.enfantA1.id, { cookie: "jeton-invente" })).status).toBe(401);
    expect((await lire(d.enfantA1.id, { bearer: "jeton-invente" })).status).toBe(401);
    expect((await lire(d.enfantA1.id, { cookie: jetons.parentA1 })).status).toBe(401);
    expect((await lire(d.enfantA1.id, { bearer: jetons.orthoA })).status).toBe(401);
  });
});

describe("orthophoniste : seulement les patients de son cabinet", () => {
  it("lit le dossier d'un patient de son cabinet, notes comprises", async () => {
    const r = await lire(d.enfantA1.id, { cookie: jetons.orthoA });
    expect(r.status).toBe(200);
    expect(r.corps.patient.prenom).toBe(d.enfantA1.prenom);
    expect(r.corps.patient.notes).toBe("Note clinique fictive");
  });

  it("ÉCHEC : lire le dossier d'un patient d'un autre cabinet (404, sans rien révéler)", async () => {
    const r = await lire(d.enfantB.id, { cookie: jetons.orthoA });
    expect(r.status).toBe(404);
    expect(JSON.stringify(r.corps)).not.toContain(d.enfantB.prenom);
    // Même réponse qu'un dossier qui n'existe pas.
    const inexistant = await lire("patient-inexistant", { cookie: jetons.orthoA });
    expect(inexistant.status).toBe(404);
    expect(inexistant.corps).toEqual(r.corps);
  });

  it("la liste ne contient que les patients de son cabinet", async () => {
    const r = await appeler(listerPatients, { cookie: jetons.orthoA });
    const ids = r.corps.patients.map((p: { id: string }) => p.id).sort();
    expect(ids).toEqual(
      [d.enfantA1.id, d.enfantA2.id, d.dossierAdulteA.id, d.dossierAdulteA2.id].sort(),
    );
  });

  it("ÉCHEC : inviter quelqu'un sur le patient d'un autre cabinet", async () => {
    const r = await appeler(inviter, {
      cookie: jetons.orthoB,
      params: { id: d.enfantA1.id },
      corps: { email: emailFictif("intrus"), role: "PARENT" },
    });
    expect(r.status).toBe(404);
    expect(await db().invitation.count({ where: { patientId: d.enfantA1.id } })).toBe(0);
  });
});

describe("parent : seulement ses enfants", () => {
  it("lit le dossier de son enfant, sans les notes cliniques", async () => {
    const r = await lire(d.enfantA1.id, { bearer: jetons.parentA1 });
    expect(r.status).toBe(200);
    expect(r.corps.patient.notes).toBeUndefined();
  });

  it("ÉCHEC : lire l'enfant d'un autre parent du même cabinet", async () => {
    expect((await lire(d.enfantA2.id, { bearer: jetons.parentA1 })).status).toBe(404);
  });

  it("ÉCHEC : lire l'enfant d'un parent d'un autre cabinet", async () => {
    expect((await lire(d.enfantB.id, { bearer: jetons.parentA1 })).status).toBe(404);
  });

  it("ÉCHEC : lire le dossier d'un patient adulte", async () => {
    expect((await lire(d.dossierAdulteA.id, { bearer: jetons.parentA1 })).status).toBe(404);
  });

  it("la liste ne contient que ses enfants", async () => {
    const r = await appeler(listerPatients, { bearer: jetons.parentA1 });
    expect(r.corps.patients.map((p: { id: string }) => p.id)).toEqual([d.enfantA1.id]);
  });

  it("ÉCHEC : un parent ne peut pas inviter", async () => {
    const r = await appeler(inviter, {
      bearer: jetons.parentA1,
      params: { id: d.enfantA1.id },
      corps: { email: emailFictif("x"), role: "PARENT" },
    });
    expect(r.status).toBe(404);
  });
});

describe("patient adulte : seulement son propre dossier", () => {
  it("lit son propre dossier", async () => {
    const r = await lire(d.dossierAdulteA.id, { bearer: jetons.adulteA });
    expect(r.status).toBe(200);
    expect(r.corps.patient.notes).toBeUndefined();
  });

  it("ÉCHEC : lire le dossier d'un autre patient adulte", async () => {
    expect((await lire(d.dossierAdulteA2.id, { bearer: jetons.adulteA })).status).toBe(404);
  });

  it("ÉCHEC : lire le dossier d'un enfant", async () => {
    expect((await lire(d.enfantA1.id, { bearer: jetons.adulteA })).status).toBe(404);
  });

  it("la liste ne contient que son dossier", async () => {
    const r = await appeler(listerPatients, { bearer: jetons.adulteA2 });
    expect(r.corps.patients.map((p: { id: string }) => p.id)).toEqual([d.dossierAdulteA2.id]);
  });
});

describe("journal d'accès", () => {
  it("chaque lecture d'un dossier écrit une ligne (qui, quel patient, quelle partie)", async () => {
    const avant = await db().journalAcces.count({ where: { patientId: d.enfantA2.id } });
    await lire(d.enfantA2.id, { cookie: jetons.orthoA });
    await lire(d.enfantA2.id, { bearer: jetons.parentA2 });
    const lignes = await db().journalAcces.findMany({
      where: { patientId: d.enfantA2.id },
      orderBy: { createdAt: "asc" },
    });
    expect(lignes).toHaveLength(avant + 2);
    expect(lignes.slice(-2).map((l) => l.userId)).toEqual([d.orthoA.id, d.parentA2.id]);
    for (const l of lignes.slice(-2)) {
      expect(l.action).toBe("LECTURE");
      expect(l.section).toBe("resume");
    }
  });

  it("une tentative refusée n'écrit pas de lecture", async () => {
    const avant = await db().journalAcces.count({ where: { patientId: d.enfantB.id } });
    await lire(d.enfantB.id, { cookie: jetons.orthoA });
    expect(await db().journalAcces.count({ where: { patientId: d.enfantB.id } })).toBe(avant);
  });
});

describe("droits relus à chaque requête", () => {
  it("un parent dont le lien est retiré perd l'accès immédiatement", async () => {
    const enfant = await db().patient.create({
      data: {
        cabinetId: d.cabA.id,
        prenom: "Temporaire",
        dateNaissance: new Date("2018-01-01"),
        tuteurs: { create: { parentId: d.parentA2.id } },
      },
    });
    expect((await lire(enfant.id, { bearer: jetons.parentA2 })).status).toBe(200);
    await db().lienTuteur.deleteMany({ where: { patientId: enfant.id } });
    expect((await lire(enfant.id, { bearer: jetons.parentA2 })).status).toBe(404);
  });
});
