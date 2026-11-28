import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { GET as fil } from "@/app/api/patients/[id]/messagerie/route";
import { POST as ecrire } from "@/app/api/patients/[id]/messagerie/messages/route";
import { GET as piece } from "@/app/api/patients/[id]/messagerie/pieces-jointes/[pieceId]/route";
import { PUT as exception } from "@/app/api/patients/[id]/reglages/messagerie/route";
import { GET as lireReglages, PUT as reglages } from "@/app/api/cabinet/reglages/route";
import {
  GET as listerReponses,
  POST as creerReponse,
} from "@/app/api/cabinet/reponses-rapides/route";
import {
  DELETE as supprimerReponse,
  PATCH as modifierReponse,
} from "@/app/api/cabinet/reponses-rapides/[reponseId]/route";
import { GET as patients } from "@/app/api/patients/route";
import type { GestionnaireNext } from "@/lib/serveur/routes";
import { db } from "@/lib/serveur/db";
import {
  PDF_FICTIF,
  PNG_FICTIF,
  appeler,
  creerCabinet,
  creerCompte,
  creerPatient,
  ipFictive,
  jetonMobile,
  jetonWeb,
} from "./outils";

// Messagerie : activation / désactivation (y compris refus de l'API), exception par patient,
// droits, pièces jointes, journal d'accès, réglages et réponses rapides. Données FICTIVES.

const JPEG_FICTIF = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const M4A_FICTIF = new Uint8Array([0, 0, 0, 0x20, ...[..."ftypM4A "].map((c) => c.charCodeAt(0))]);

/** Cabinet (messagerie au choix), orthophoniste, enfant avec un parent consentant. */
async function cabinet(messagerieActivee = true) {
  const cab = await creerCabinet(messagerieActivee);
  const ortho = await creerCompte("ORTHO", cab.id);
  const parent = await creerCompte("PARENT", cab.id);
  const enfant = await creerPatient(cab.id, { tuteurIds: [parent.id] });
  return {
    cab,
    ortho,
    parent,
    enfant,
    cookie: await jetonWeb(ortho.id),
    bearer: await jetonMobile(parent.id),
  };
}

type Auth = { cookie?: string; bearer?: string };
const lire = (patientId: string, auth: Auth) =>
  appeler(fil, { ...auth, params: { id: patientId } });
const texte = (patientId: string, contenu: string, auth: Auth) =>
  appeler(ecrire, { ...auth, params: { id: patientId }, corps: { contenu } });

/** Message avec pièce jointe (multipart), comme le mobile ou le navigateur. */
async function avecFichier(
  patientId: string,
  auth: Auth,
  fichier: { octets: Uint8Array; nom: string; type: string },
  champs: Record<string, string> = {},
) {
  const formulaire = new FormData();
  for (const [k, v] of Object.entries(champs)) formulaire.set(k, v);
  formulaire.set(
    "fichier",
    new File([new Uint8Array(fichier.octets)], fichier.nom, { type: fichier.type }),
  );
  return brut(ecrire, { id: patientId }, auth, { method: "POST", body: formulaire });
}

async function brut(
  gestionnaire: GestionnaireNext,
  params: Record<string, string>,
  auth: Auth,
  init: { method?: string; body?: FormData } = {},
) {
  const entetes = new Headers({ "x-forwarded-for": ipFictive() });
  if (auth.cookie) entetes.set("cookie", `session=${auth.cookie}`);
  if (auth.bearer) entetes.set("authorization", `Bearer ${auth.bearer}`);
  const req = new NextRequest("http://localhost:3000/api/test", { ...init, headers: entetes });
  const reponse = await gestionnaire(req, { params: Promise.resolve(params) });
  return reponse;
}

const json = async (r: Response) => ({ status: r.status, corps: await r.json() });

afterAll(() => db().$disconnect());

describe("messagerie activée", () => {
  it("l'orthophoniste (web) et le parent (mobile) échangent dans le fil du patient", async () => {
    const { enfant, cookie, bearer } = await cabinet(true);
    expect((await texte(enfant.id, "Bonjour (fictif) ?", { bearer })).status).toBe(201);
    const reponse = await texte(enfant.id, "Bonjour, oui (fictif).", { cookie });
    expect(reponse.corps.message).toMatchObject({ deMoi: true, cote: "CABINET" });

    const vuParent = await lire(enfant.id, { bearer });
    expect(vuParent.status).toBe(200);
    expect(vuParent.corps.messages.map((m: { contenu: string }) => m.contenu)).toEqual([
      "Bonjour (fictif) ?",
      "Bonjour, oui (fictif).",
    ]);
    expect(vuParent.corps.messages[0]).toMatchObject({ deMoi: true, cote: "FAMILLE" });
    expect(vuParent.corps.messages[1]).toMatchObject({ deMoi: false, cote: "CABINET" });
    // La famille ne reçoit pas la liste des interlocuteurs (réservée à l'orthophoniste).
    expect(vuParent.corps.interlocuteurs).toBeUndefined();
    expect((await lire(enfant.id, { cookie })).corps.interlocuteurs).toHaveLength(1);
  });

  it("un message lu par l'autre côté est marqué lu", async () => {
    const { enfant, cookie, bearer } = await cabinet(true);
    await texte(enfant.id, "Question fictive.", { bearer });
    expect((await lire(enfant.id, { bearer })).corps.messages[0].luLe).toBeNull();
    await lire(enfant.id, { cookie });
    expect((await lire(enfant.id, { bearer })).corps.messages[0].luLe).not.toBeNull();
  });

  it("une seule conversation par patient, gardée au dossier", async () => {
    const { enfant, cookie, bearer } = await cabinet(true);
    await Promise.all([
      texte(enfant.id, "Premier (fictif).", { bearer }),
      texte(enfant.id, "Deuxième (fictif).", { cookie }),
    ]);
    expect(await db().filMessages.count({ where: { patientId: enfant.id } })).toBe(1);
    expect(await db().message.count({ where: { fil: { patientId: enfant.id } } })).toBe(2);
  });

  it("chaque lecture du fil est inscrite au journal d'accès", async () => {
    const { enfant, ortho, parent, cookie, bearer } = await cabinet(true);
    await lire(enfant.id, { cookie });
    await lire(enfant.id, { bearer });
    const lignes = await db().journalAcces.findMany({
      where: { patientId: enfant.id, section: "messagerie", action: "LECTURE" },
    });
    expect(lignes.map((l) => l.userId).sort()).toEqual([ortho.id, parent.id].sort());
  });

  it("horaires de réponse affichés aux familles", async () => {
    const { enfant, cookie, bearer } = await cabinet(true);
    await appeler(reglages, {
      cookie,
      methode: "PUT",
      corps: { horairesReponse: "Je réponds sous 48 h (fictif)." },
    });
    expect((await lire(enfant.id, { bearer })).corps.horairesReponse).toBe(
      "Je réponds sous 48 h (fictif).",
    );
  });

  it("refuse un message vide", async () => {
    const { enfant, bearer } = await cabinet(true);
    expect((await texte(enfant.id, "   ", { bearer })).status).toBe(400);
  });
});

describe("messagerie désactivée : l'API refuse tout", () => {
  it("cabinet désactivé : lecture, écriture et pièces jointes refusées (403 clair)", async () => {
    const { enfant, cookie, bearer } = await cabinet(true);
    const envoi = await avecFichier(
      enfant.id,
      { bearer },
      {
        octets: JPEG_FICTIF,
        nom: "photo.jpg",
        type: "image/jpeg",
      },
    );
    const pieceId = (await envoi.json()).message.piecesJointes[0].id;

    await appeler(reglages, { cookie, methode: "PUT", corps: { messagerieActivee: false } });
    for (const auth of [{ cookie }, { bearer }]) {
      const l = await lire(enfant.id, auth);
      expect(l.status).toBe(403);
      expect(l.corps.erreur.code).toBe("messagerie_desactivee");
      expect(l.corps.erreur.message).toBe("La messagerie est désactivée pour ce patient.");
      expect((await texte(enfant.id, "x", auth)).corps.erreur.code).toBe("messagerie_desactivee");
      expect((await brut(piece, { id: enfant.id, pieceId }, auth)).status).toBe(403);
    }
    // L'historique est gardé au dossier.
    expect(await db().message.count({ where: { fil: { patientId: enfant.id } } })).toBe(1);
  });

  it("l'onglet disparaît du mobile : la liste des patients l'indique", async () => {
    const { enfant, cookie, bearer } = await cabinet(true);
    const avant = await appeler(patients, { bearer });
    expect(avant.corps.patients.find((p: { id: string }) => p.id === enfant.id)).toMatchObject({
      messagerieActivee: true,
    });
    await appeler(reglages, { cookie, methode: "PUT", corps: { messagerieActivee: false } });
    const apres = await appeler(patients, { bearer });
    expect(apres.corps.patients.find((p: { id: string }) => p.id === enfant.id)).toMatchObject({
      messagerieActivee: false,
    });
  });

  it("un compte sans lien reçoit 404 (rien n'est révélé), même messagerie désactivée", async () => {
    const { enfant } = await cabinet(false);
    const { bearer: autreParent, cookie: autreOrtho } = await cabinet(false);
    expect((await lire(enfant.id, { bearer: autreParent })).status).toBe(404);
    expect((await lire(enfant.id, { cookie: autreOrtho })).status).toBe(404);
  });
});

describe("exception par patient", () => {
  it("cabinet désactivé, activée pour ce patient : la messagerie marche pour lui seul", async () => {
    const { cab, enfant, cookie, bearer, parent } = await cabinet(false);
    const autre = await creerPatient(cab.id, { tuteurIds: [parent.id] });
    const r = await appeler(exception, {
      cookie,
      methode: "PUT",
      params: { id: enfant.id },
      corps: { messagerieActivee: true },
    });
    expect(r.status).toBe(200);
    expect((await texte(enfant.id, "Bonjour (fictif).", { bearer })).status).toBe(201);
    expect((await lire(autre.id, { bearer })).status).toBe(403);
  });

  it("cabinet activé, désactivée pour ce patient : refus ; « comme le cabinet » : rétablie", async () => {
    const { enfant, cookie, bearer } = await cabinet(true);
    const regler = (messagerieActivee: boolean | null) =>
      appeler(exception, {
        cookie,
        methode: "PUT",
        params: { id: enfant.id },
        corps: { messagerieActivee },
      });
    await regler(false);
    expect((await lire(enfant.id, { bearer })).status).toBe(403);
    expect((await lire(enfant.id, { cookie })).status).toBe(403);
    await regler(null);
    expect((await lire(enfant.id, { bearer })).status).toBe(200);
  });

  it("seul l'orthophoniste du cabinet règle l'exception", async () => {
    const { enfant, bearer } = await cabinet(true);
    const { cookie: autreOrtho } = await cabinet(true);
    for (const auth of [{ bearer }, { cookie: autreOrtho }]) {
      const r = await appeler(exception, {
        ...auth,
        methode: "PUT",
        params: { id: enfant.id },
        corps: { messagerieActivee: false },
      });
      expect(r.status).toBe(404);
    }
  });
});

describe("droits", () => {
  it("parent d'un autre enfant, orthophoniste d'un autre cabinet : 404", async () => {
    const { enfant } = await cabinet(true);
    const { bearer: autreParent, cookie: autreOrtho } = await cabinet(true);
    for (const auth of [{ bearer: autreParent }, { cookie: autreOrtho }]) {
      expect((await lire(enfant.id, auth)).status).toBe(404);
      expect((await texte(enfant.id, "x", auth)).status).toBe(404);
    }
  });

  it("parent relié sans consentement : 403 consentement requis", async () => {
    const { cab, enfant } = await cabinet(true);
    const sansAccord = await creerCompte("PARENT", cab.id);
    await db().lienTuteur.create({ data: { parentId: sansAccord.id, patientId: enfant.id } });
    const r = await lire(enfant.id, { bearer: await jetonMobile(sansAccord.id) });
    expect(r.status).toBe(403);
    expect(r.corps.erreur.code).toBe("consentement_requis");
  });

  it("patient majeur : sa propre conversation, pas celle des autres", async () => {
    const { cab, enfant } = await cabinet(true);
    const compte = await creerCompte("PATIENT_ADULT", cab.id);
    const dossier = await creerPatient(cab.id, { age: 30, compteUserId: compte.id });
    const bearer = await jetonMobile(compte.id);
    expect((await texte(dossier.id, "Bonjour (fictif).", { bearer })).status).toBe(201);
    expect((await lire(dossier.id, { bearer })).status).toBe(200);
    expect((await lire(enfant.id, { bearer })).status).toBe(404);
  });

  it("pièce jointe d'un autre patient : 404", async () => {
    const { enfant, bearer, cab, parent } = await cabinet(true);
    const autre = await creerPatient(cab.id, { tuteurIds: [parent.id] });
    const envoi = await json(
      await avecFichier(
        enfant.id,
        { bearer },
        { octets: PNG_FICTIF, nom: "a.png", type: "image/png" },
      ),
    );
    const pieceId = envoi.corps.message.piecesJointes[0].id;
    expect((await brut(piece, { id: autre.id, pieceId }, { bearer })).status).toBe(404);
  });
});

describe("pièces jointes", () => {
  it("photo : type réel contrôlé, relue telle quelle (orthophoniste et famille)", async () => {
    const { enfant, cookie, bearer } = await cabinet(true);
    const envoi = await json(
      await avecFichier(
        enfant.id,
        { bearer },
        { octets: JPEG_FICTIF, nom: "IMG_0001.jpeg", type: "image/jpeg" },
        { contenu: "Voici l'exercice fait (fictif)." },
      ),
    );
    expect(envoi.status).toBe(201);
    const pj = envoi.corps.message.piecesJointes[0];
    expect(pj).toMatchObject({ genre: "PHOTO", typeMime: "image/jpeg", tailleOctets: 10 });
    expect(envoi.corps.message.contenu).toBe("Voici l'exercice fait (fictif).");

    const r = await brut(piece, { id: enfant.id, pieceId: pj.id }, { cookie });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(JPEG_FICTIF);
    // Le nom d'origine n'est pas gardé.
    expect(r.headers.get("content-disposition")).toContain("piece-jointe.jpg");
  });

  it("message vocal (M4A) avec sa durée", async () => {
    const { enfant, bearer } = await cabinet(true);
    const envoi = await json(
      await avecFichier(
        enfant.id,
        { bearer },
        { octets: M4A_FICTIF, nom: "voix.m4a", type: "audio/mp4" },
        { dureeSecondes: "12" },
      ),
    );
    expect(envoi.corps.message.piecesJointes[0]).toMatchObject({
      genre: "VOCAL",
      typeMime: "audio/mp4",
      dureeSecondes: 12,
    });
    expect(envoi.corps.message.contenu).toBe("");
  });

  it("refuse un fichier déguisé (PDF nommé .jpg), trop gros, ou un vocal trop long", async () => {
    const { enfant, bearer } = await cabinet(true);
    const deguise = await json(
      await avecFichier(
        enfant.id,
        { bearer },
        { octets: PDF_FICTIF, nom: "photo.jpg", type: "image/jpeg" },
      ),
    );
    expect(deguise.status).toBe(415);
    expect(deguise.corps.erreur.code).toBe("piece_jointe_type_refuse");

    const gros = new Uint8Array(10 * 1024 * 1024 + 1);
    gros.set(JPEG_FICTIF);
    const tropGros = await avecFichier(
      enfant.id,
      { bearer },
      { octets: gros, nom: "a.jpg", type: "image/jpeg" },
    );
    expect(tropGros.status).toBe(413);

    const long = await avecFichier(
      enfant.id,
      { bearer },
      { octets: M4A_FICTIF, nom: "v.m4a", type: "audio/mp4" },
      { dureeSecondes: "301" },
    );
    expect(long.status).toBe(413);
    // Aucun message créé par ces refus.
    expect(await db().message.count({ where: { fil: { patientId: enfant.id } } })).toBe(0);
  });
});

describe("réglages et réponses rapides", () => {
  it("l'orthophoniste lit et règle la messagerie du cabinet ; la famille ne peut pas", async () => {
    const { cookie, bearer } = await cabinet(true);
    const r = await appeler(reglages, {
      cookie,
      methode: "PUT",
      corps: { messagerieActivee: false, horairesReponse: "Réponse sous 48 h (fictif)." },
    });
    expect(r.corps.reglages).toEqual({
      messagerieActivee: false,
      horairesReponse: "Réponse sous 48 h (fictif).",
    });
    expect((await appeler(lireReglages, { cookie })).corps.reglages.messagerieActivee).toBe(false);
    expect(
      (await appeler(reglages, { bearer, methode: "PUT", corps: { messagerieActivee: true } }))
        .status,
    ).toBe(404);
  });

  it("réponses rapides : créer, modifier, supprimer ; propres au cabinet", async () => {
    const { cookie } = await cabinet(true);
    const { cookie: autreOrtho } = await cabinet(true);
    const cree = await appeler(creerReponse, {
      cookie,
      corps: { titre: "Absence", texte: "Merci de m'avoir prévenue (fictif)." },
    });
    expect(cree.status).toBe(201);
    const id = cree.corps.reponse.id;
    expect((await appeler(listerReponses, { cookie })).corps.reponses).toHaveLength(1);
    expect((await appeler(listerReponses, { cookie: autreOrtho })).corps.reponses).toHaveLength(0);
    const modif = { titre: "Absence", texte: "Texte modifié (fictif)." };
    expect(
      (
        await appeler(modifierReponse, {
          cookie: autreOrtho,
          methode: "PATCH",
          params: { reponseId: id },
          corps: modif,
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await appeler(modifierReponse, {
          cookie,
          methode: "PATCH",
          params: { reponseId: id },
          corps: modif,
        })
      ).corps.reponse.texte,
    ).toBe("Texte modifié (fictif).");
    expect(
      (await appeler(supprimerReponse, { cookie, methode: "DELETE", params: { reponseId: id } }))
        .status,
    ).toBe(204);
  });
});
