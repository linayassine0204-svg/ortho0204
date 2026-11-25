import { afterAll, describe, expect, it } from "vitest";
import { t } from "@app/shared";
import { POST as inscription } from "@/app/api/auth/inscription/route";
import { POST as connexionWeb } from "@/app/api/auth/connexion/route";
import { POST as connexionMobile } from "@/app/api/auth/mobile/connexion/route";
import { GET as listerPatients } from "@/app/api/patients/route";
import { GET as lirePatient } from "@/app/api/patients/[id]/route";
import { POST as inviter } from "@/app/api/patients/[id]/invitations/route";
import { POST as accepter } from "@/app/api/invitations/accepter/route";
import { POST as consentir } from "@/app/api/patients/[id]/consentement/route";
import { db } from "@/lib/serveur/db";
import { empreinteJeton } from "@/lib/serveur/jetons";
import {
  MOT_DE_PASSE,
  appeler,
  cookieSession,
  creerCabinet,
  creerCompte,
  creerPatient,
  emailFictif,
  exiger,
  jetonWeb,
} from "./outils";

afterAll(() => db().$disconnect());

const jetonDuLien = (lien: string) => exiger(lien.split("#")[1], "jeton");

async function orthoEtEnfant(age = 8) {
  const cab = await creerCabinet();
  const ortho = await creerCompte("ORTHO", cab.id);
  const enfant = await creerPatient(cab.id, { age });
  return { cab, ortho, enfant, cookie: await jetonWeb(ortho.id) };
}

async function creerLien(cookie: string, patientId: string, email: string, role = "PARENT") {
  const r = await appeler(inviter, { cookie, params: { id: patientId }, corps: { email, role } });
  expect(r.status).toBe(201);
  return r.corps as { lien: string; expireLe: string; emailEnvoye: boolean };
}

describe("parcours complet", () => {
  it("inscription → connexion web → invitation d'un parent → le parent se connecte et voit SON enfant", async () => {
    // 1. Inscription de l'orthophoniste.
    const emailOrtho = emailFictif("parcours.ortho");
    await appeler(inscription, {
      corps: {
        email: emailOrtho,
        motDePasse: MOT_DE_PASSE,
        prenom: "Camille",
        nom: "Exemple",
        nomCabinet: "Cabinet fictif du parcours",
      },
    });
    // 2. Connexion web.
    const co = await appeler(connexionWeb, {
      corps: { email: emailOrtho, motDePasse: MOT_DE_PASSE },
    });
    expect(co.status).toBe(200);
    const cookie = exiger(cookieSession(co.entetes), "cookie").valeur;
    const ortho = await db().user.findUniqueOrThrow({ where: { email: emailOrtho } });
    const enfant = await creerPatient(ortho.cabinetId);
    const autreEnfant = await creerPatient(ortho.cabinetId);

    // 3. Invitation d'un parent.
    const emailParent = emailFictif("parcours.parent");
    const { lien, emailEnvoye } = await creerLien(cookie, enfant.id, emailParent);
    expect(lien).toMatch(/^http:\/\/localhost:3000\/invitation#[\w-]{43}$/);
    expect(emailEnvoye).toBe(false);
    // Le jeton n'est stocké que sous forme d'empreinte.
    const stockee = await db().invitation.findFirstOrThrow({ where: { patientId: enfant.id } });
    expect(stockee.jetonHash).toBe(empreinteJeton(jetonDuLien(lien)));
    expect(stockee.jetonHash).not.toBe(jetonDuLien(lien));

    // 4. Le parent active son compte.
    const ok = await appeler(accepter, {
      corps: {
        jeton: jetonDuLien(lien),
        motDePasse: MOT_DE_PASSE,
        prenom: "Julie",
        nom: "Exemple",
      },
    });
    expect(ok.status).toBe(201);
    expect(ok.corps).toEqual({ role: "PARENT" });

    // 5. Le parent se connecte sur le mobile et ne voit que son enfant.
    const mobile = await appeler(connexionMobile, {
      corps: { email: emailParent, motDePasse: MOT_DE_PASSE },
    });
    expect(mobile.status).toBe(200);
    const bearer = mobile.corps.jetonAcces as string;

    // 6. Sans consentement : seulement le prénom (écran de consentement), aucune donnée.
    const avant = await appeler(listerPatients, { bearer });
    expect(avant.corps.patients).toEqual([
      { id: enfant.id, prenom: enfant.prenom, consentementRequis: true },
    ]);
    const refuse = await appeler(lirePatient, { bearer, params: { id: enfant.id } });
    expect(refuse.status).toBe(403);
    expect(refuse.corps.erreur.code).toBe("consentement_requis");

    // 7. Le parent donne son consentement, puis voit le dossier de son enfant.
    const ok2 = await appeler(consentir, { methode: "POST", bearer, params: { id: enfant.id } });
    expect(ok2.status).toBe(201);
    const liste = await appeler(listerPatients, { bearer });
    expect(liste.corps.patients.map((p: { id: string }) => p.id)).toEqual([enfant.id]);
    expect((await appeler(lirePatient, { bearer, params: { id: enfant.id } })).status).toBe(200);
    expect((await appeler(lirePatient, { bearer, params: { id: autreEnfant.id } })).status).toBe(
      404,
    );
  });
});

describe("lien d'invitation", () => {
  it("ne sert qu'une seule fois", async () => {
    const { enfant, cookie } = await orthoEtEnfant();
    const { lien } = await creerLien(cookie, enfant.id, emailFictif("unique"));
    const corps = { jeton: jetonDuLien(lien), motDePasse: MOT_DE_PASSE, prenom: "A", nom: "B" };
    expect((await appeler(accepter, { corps })).status).toBe(201);
    const deuxieme = await appeler(accepter, { corps });
    expect(deuxieme.status).toBe(400);
    expect(deuxieme.corps.erreur.message).toBe(t("erreurs.invitationInvalide"));
  });

  it("expire après sa durée de validité", async () => {
    const { enfant, cookie } = await orthoEtEnfant();
    const { lien, expireLe } = await creerLien(cookie, enfant.id, emailFictif("expire"));
    const duree = new Date(expireLe).getTime() - Date.now();
    expect(duree).toBeGreaterThan(71 * 3600_000);
    expect(duree).toBeLessThanOrEqual(72 * 3600_000);
    await db().invitation.updateMany({
      where: { patientId: enfant.id },
      data: { expireLe: new Date(Date.now() - 1000) },
    });
    const r = await appeler(accepter, {
      corps: { jeton: jetonDuLien(lien), motDePasse: MOT_DE_PASSE, prenom: "A", nom: "B" },
    });
    expect(r.status).toBe(400);
    expect(await db().lienTuteur.count({ where: { patientId: enfant.id } })).toBe(0);
  });

  it("un jeton inventé donne le même message qu'un lien expiré", async () => {
    const r = await appeler(accepter, {
      corps: { jeton: "jeton-invente", motDePasse: MOT_DE_PASSE, prenom: "A", nom: "B" },
    });
    expect(r.status).toBe(400);
    expect(r.corps.erreur.message).toBe(t("erreurs.invitationInvalide"));
  });

  it("deux activations simultanées : une seule réussit", async () => {
    const { enfant, cookie } = await orthoEtEnfant();
    const { lien } = await creerLien(cookie, enfant.id, emailFictif("course"));
    const corps = { jeton: jetonDuLien(lien), motDePasse: MOT_DE_PASSE, prenom: "A", nom: "B" };
    const resultats = await Promise.all([
      appeler(accepter, { corps }),
      appeler(accepter, { corps }),
    ]);
    expect(resultats.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await db().lienTuteur.count({ where: { patientId: enfant.id } })).toBe(1);
  });

  it("exige un mot de passe d'au moins 12 caractères pour un nouveau compte", async () => {
    const { enfant, cookie } = await orthoEtEnfant();
    const { lien } = await creerLien(cookie, enfant.id, emailFictif("faible"));
    const r = await appeler(accepter, {
      corps: { jeton: jetonDuLien(lien), motDePasse: "court", prenom: "A", nom: "B" },
    });
    expect(r.status).toBe(400);
    // Le lien reste utilisable après une erreur de saisie.
    const ok = await appeler(accepter, {
      corps: { jeton: jetonDuLien(lien), motDePasse: MOT_DE_PASSE, prenom: "A", nom: "B" },
    });
    expect(ok.status).toBe(201);
  });
});

describe("parent déjà inscrit (plusieurs enfants)", () => {
  it("relie le 2e enfant à son compte avec son mot de passe actuel", async () => {
    const { cab, cookie } = await orthoEtEnfant();
    const parent = await creerCompte("PARENT", cab.id);
    const frere = await creerPatient(cab.id, { tuteurIds: [parent.id] });
    const soeur = await creerPatient(cab.id);
    const { lien } = await creerLien(cookie, soeur.id, parent.email);
    const r = await appeler(accepter, {
      corps: { jeton: jetonDuLien(lien), motDePasse: MOT_DE_PASSE },
    });
    expect(r.status).toBe(201);
    const liens = await db().lienTuteur.findMany({ where: { parentId: parent.id } });
    expect(liens.map((l) => l.patientId).sort()).toEqual([frere.id, soeur.id].sort());
    expect(await db().user.count({ where: { email: parent.email } })).toBe(1);
  });

  it("ÉCHEC : avec un mauvais mot de passe, rien n'est relié et le lien reste valable", async () => {
    const { cab, cookie } = await orthoEtEnfant();
    const parent = await creerCompte("PARENT", cab.id);
    const soeur = await creerPatient(cab.id);
    const { lien } = await creerLien(cookie, soeur.id, parent.email);
    const r = await appeler(accepter, {
      corps: { jeton: jetonDuLien(lien), motDePasse: "mauvais-mot-de-passe" },
    });
    expect(r.status).toBe(400);
    expect(await db().lienTuteur.count({ where: { patientId: soeur.id } })).toBe(0);
    const invitation = await db().invitation.findFirstOrThrow({ where: { patientId: soeur.id } });
    expect(invitation.utiliseeLe).toBeNull();
  });

  it("ÉCHEC : impossible de détourner un compte d'un autre cabinet ou d'un orthophoniste", async () => {
    const { cookie, enfant } = await orthoEtEnfant();
    const autreCab = await creerCabinet();
    const parentAilleurs = await creerCompte("PARENT", autreCab.id);
    const orthoAilleurs = await creerCompte("ORTHO", autreCab.id);
    for (const cible of [parentAilleurs, orthoAilleurs]) {
      const { lien } = await creerLien(cookie, enfant.id, cible.email);
      const r = await appeler(accepter, {
        corps: { jeton: jetonDuLien(lien), motDePasse: MOT_DE_PASSE },
      });
      expect(r.status).toBe(400);
    }
    expect(await db().lienTuteur.count({ where: { patientId: enfant.id } })).toBe(0);
  });
});

describe("invitation du patient lui-même", () => {
  it("un patient de 15 ans ou plus obtient son propre compte, relié à son dossier", async () => {
    const { enfant: ado, cookie } = await orthoEtEnfant(16);
    const email = emailFictif("ado");
    const { lien } = await creerLien(cookie, ado.id, email, "PATIENT_ADULT");
    const r = await appeler(accepter, {
      corps: { jeton: jetonDuLien(lien), motDePasse: MOT_DE_PASSE, prenom: "Léo", nom: "Exemple" },
    });
    expect(r.status).toBe(201);
    const dossier = await db().patient.findUniqueOrThrow({
      where: { id: ado.id },
      include: { compte: true },
    });
    expect(dossier.compte?.email).toBe(email);
    expect(dossier.compte?.role).toBe("PATIENT_ADULT");
  });

  it("ÉCHEC : un enfant de moins de 15 ans n'a pas de compte propre", async () => {
    const { enfant, cookie } = await orthoEtEnfant(12);
    const r = await appeler(inviter, {
      cookie,
      params: { id: enfant.id },
      corps: { email: emailFictif("trop.jeune"), role: "PATIENT_ADULT" },
    });
    expect(r.status).toBe(422);
    expect(r.corps.erreur.message).toBe(t("erreurs.patientTropJeune"));
  });

  it("ÉCHEC : un patient qui a déjà un compte", async () => {
    const cab = await creerCabinet();
    const ortho = await creerCompte("ORTHO", cab.id);
    const compte = await creerCompte("PATIENT_ADULT", cab.id);
    const adulte = await creerPatient(cab.id, { age: 30, compteUserId: compte.id });
    const r = await appeler(inviter, {
      cookie: await jetonWeb(ortho.id),
      params: { id: adulte.id },
      corps: { email: emailFictif("doublon"), role: "PATIENT_ADULT" },
    });
    expect(r.status).toBe(409);
  });

  it("ÉCHEC : on ne peut pas inviter un orthophoniste par ce lien", async () => {
    const { enfant, cookie } = await orthoEtEnfant();
    const r = await appeler(inviter, {
      cookie,
      params: { id: enfant.id },
      corps: { email: emailFictif("x"), role: "ORTHO" },
    });
    expect(r.status).toBe(400);
  });
});
