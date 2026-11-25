import { afterAll, describe, expect, it } from "vitest";
import { t } from "@app/shared";
import { POST as inscription } from "@/app/api/auth/inscription/route";
import { POST as connexionWeb } from "@/app/api/auth/connexion/route";
import { POST as deconnexion } from "@/app/api/auth/deconnexion/route";
import { GET as moi } from "@/app/api/auth/moi/route";
import { POST as connexionMobile } from "@/app/api/auth/mobile/connexion/route";
import { POST as renouvellement } from "@/app/api/auth/mobile/renouvellement/route";
import { GET as health } from "@/app/api/health/route";
import { db } from "@/lib/serveur/db";
import {
  MOT_DE_PASSE,
  appeler,
  cookieSession,
  creerCabinet,
  creerCompte,
  emailFictif,
  exiger,
  ipFictive,
} from "./outils";

afterAll(() => db().$disconnect());

describe("inscription d'un orthophoniste", () => {
  it("crée le compte et le cabinet, mot de passe haché (jamais en clair)", async () => {
    const email = emailFictif("nouvelle.ortho");
    const r = await appeler(inscription, {
      corps: {
        email: `  ${email.toUpperCase()} `,
        motDePasse: MOT_DE_PASSE,
        prenom: "Camille",
        nom: "Exemple",
        nomCabinet: "Cabinet fictif des Lilas",
      },
    });
    expect(r.status).toBe(202);
    const user = await db().user.findUniqueOrThrow({
      where: { email },
      include: { cabinet: true },
    });
    expect(user.role).toBe("ORTHO");
    expect(user.cabinet.nom).toBe("Cabinet fictif des Lilas");
    expect(user.motDePasseHash).not.toContain(MOT_DE_PASSE);
    expect(user.motDePasseHash).toMatch(/^scrypt\$/);
  });

  it("répond exactement pareil si l'e-mail existe déjà (ne révèle rien), sans rien créer", async () => {
    const cab = await creerCabinet();
    const existant = await creerCompte("ORTHO", cab.id);
    const corps = {
      motDePasse: "autre-mot-de-passe-fictif",
      prenom: "Intrus",
      nom: "Exemple",
      nomCabinet: "Cabinet pirate",
    };
    const nouveau = await appeler(inscription, {
      corps: { ...corps, email: emailFictif("libre") },
    });
    const doublon = await appeler(inscription, { corps: { ...corps, email: existant.email } });
    expect(doublon.status).toBe(nouveau.status);
    expect(doublon.corps).toEqual(nouveau.corps);
    expect(await db().cabinet.count({ where: { nom: "Cabinet pirate" } })).toBe(1);
    const inchange = await db().user.findUniqueOrThrow({ where: { id: existant.id } });
    expect(inchange.motDePasseHash).toBe(existant.motDePasseHash);
  });

  it("refuse un mot de passe trop court (sans renvoyer la valeur)", async () => {
    const r = await appeler(inscription, {
      corps: {
        email: emailFictif("court"),
        motDePasse: "court123",
        prenom: "A",
        nom: "B",
        nomCabinet: "C",
      },
    });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.corps)).not.toContain("court123");
  });

  it("limite le nombre d'inscriptions par adresse IP", async () => {
    const ip = ipFictive();
    const essai = () =>
      appeler(inscription, {
        ip,
        corps: {
          email: emailFictif("rafale"),
          motDePasse: MOT_DE_PASSE,
          prenom: "A",
          nom: "B",
          nomCabinet: "C",
        },
      });
    for (let i = 0; i < 10; i++) expect((await essai()).status).toBe(202);
    expect((await essai()).status).toBe(429);
  }, 60_000);
});

describe("connexion web (orthophoniste)", () => {
  it("pose un cookie de session HttpOnly, SameSite=Strict, et donne accès à /moi", async () => {
    const cab = await creerCabinet();
    const ortho = await creerCompte("ORTHO", cab.id);
    const r = await appeler(connexionWeb, {
      corps: { email: ortho.email, motDePasse: MOT_DE_PASSE },
    });
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.corps)).not.toContain("motDePasse");
    const cookie = exiger(cookieSession(r.entetes), "cookie");
    expect(cookie.brut).toMatch(/HttpOnly/i);
    expect(cookie.brut).toMatch(/SameSite=Strict/i);
    expect(cookie.brut).toMatch(/Path=\//);
    // Seule l'empreinte du jeton est en base.
    expect(await db().session.count({ where: { jetonHash: cookie.valeur } })).toBe(0);

    const moiR = await appeler(moi, { cookie: cookie.valeur });
    expect(moiR.status).toBe(200);
    expect(moiR.corps.utilisateur.id).toBe(ortho.id);
    expect(moiR.entetes.get("cache-control")).toBe("no-store");
  });

  it("même message pour un e-mail inconnu et un mauvais mot de passe", async () => {
    const cab = await creerCabinet();
    const ortho = await creerCompte("ORTHO", cab.id);
    const inconnu = await appeler(connexionWeb, {
      corps: { email: emailFictif("inconnu"), motDePasse: MOT_DE_PASSE },
    });
    const mauvais = await appeler(connexionWeb, {
      corps: { email: ortho.email, motDePasse: "mauvais-mot-de-passe" },
    });
    expect(inconnu.status).toBe(401);
    expect(mauvais.status).toBe(401);
    expect(inconnu.corps).toEqual(mauvais.corps);
    expect(inconnu.corps.erreur.message).toBe(t("erreurs.identifiantsIncorrects"));
    expect(cookieSession(mauvais.entetes)).toBeNull();
  });

  it("refuse un compte parent sur le web, avec le même message", async () => {
    const cab = await creerCabinet();
    const parent = await creerCompte("PARENT", cab.id);
    const r = await appeler(connexionWeb, {
      corps: { email: parent.email, motDePasse: MOT_DE_PASSE },
    });
    expect(r.status).toBe(401);
    expect(r.corps.erreur.message).toBe(t("erreurs.identifiantsIncorrects"));
  });

  it("bloque après 5 échecs sur un e-mail, même avec le bon mot de passe ensuite", async () => {
    const cab = await creerCabinet();
    const ortho = await creerCompte("ORTHO", cab.id);
    for (let i = 0; i < 5; i++) {
      const r = await appeler(connexionWeb, {
        corps: { email: ortho.email, motDePasse: `mauvais-${i}` },
      });
      expect(r.status).toBe(401);
    }
    const bloque = await appeler(connexionWeb, {
      corps: { email: ortho.email, motDePasse: MOT_DE_PASSE },
    });
    expect(bloque.status).toBe(429);
    expect(bloque.corps.erreur.message).toBe(t("erreurs.tropDeTentatives"));
  });

  it("le blocage ne révèle pas si l'e-mail existe (même comportement pour un inconnu)", async () => {
    const email = emailFictif("fantome");
    for (let i = 0; i < 5; i++) {
      await appeler(connexionWeb, { corps: { email, motDePasse: `mauvais-${i}` } });
    }
    expect((await appeler(connexionWeb, { corps: { email, motDePasse: "x" } })).status).toBe(429);
  });

  it("limite aussi les essais par adresse IP (e-mails différents)", async () => {
    const ip = ipFictive();
    for (let i = 0; i < 50; i++) {
      await appeler(connexionWeb, {
        ip,
        corps: { email: emailFictif("balayage"), motDePasse: "mauvais" },
      });
    }
    const r = await appeler(connexionWeb, {
      ip,
      corps: { email: emailFictif("balayage"), motDePasse: "mauvais" },
    });
    expect(r.status).toBe(429);
  }, 60_000);

  it("ne stocke ni l'e-mail ni l'IP en clair dans les tentatives", async () => {
    const email = emailFictif("trace");
    await appeler(connexionWeb, { ip: "198.51.100.77", corps: { email, motDePasse: "mauvais" } });
    const lignes = await db().tentativeConnexion.findMany();
    for (const l of lignes) {
      expect(l.cle).not.toContain(email);
      expect(l.cle).not.toContain("198.51.100.77");
    }
  });

  it("la déconnexion révoque la session et efface le cookie", async () => {
    const cab = await creerCabinet();
    const ortho = await creerCompte("ORTHO", cab.id);
    const r = await appeler(connexionWeb, {
      corps: { email: ortho.email, motDePasse: MOT_DE_PASSE },
    });
    const jeton = exiger(cookieSession(r.entetes)).valeur;
    const out = await appeler(deconnexion, { methode: "POST", cookie: jeton });
    expect(out.status).toBe(204);
    expect(cookieSession(out.entetes)?.valeur).toBe("");
    expect((await appeler(moi, { cookie: jeton })).status).toBe(401);
  });

  it("une session expirée est refusée", async () => {
    const cab = await creerCabinet();
    const ortho = await creerCompte("ORTHO", cab.id);
    const r = await appeler(connexionWeb, {
      corps: { email: ortho.email, motDePasse: MOT_DE_PASSE },
    });
    const jeton = exiger(cookieSession(r.entetes)).valeur;
    await db().session.updateMany({
      where: { userId: ortho.id },
      data: { expireLe: new Date(Date.now() - 1000) },
    });
    expect((await appeler(moi, { cookie: jeton })).status).toBe(401);
  });

  it("refuse une requête qui modifie venant d'un autre site (en-tête Origin)", async () => {
    const cab = await creerCabinet();
    const ortho = await creerCompte("ORTHO", cab.id);
    const r = await appeler(connexionWeb, {
      corps: { email: ortho.email, motDePasse: MOT_DE_PASSE },
      entetes: { origin: "https://site-malveillant.exemple.test" },
    });
    expect(r.status).toBe(403);
  });
});

describe("connexion mobile (parent, patient adulte)", () => {
  async function connecterParent() {
    const cab = await creerCabinet();
    const parent = await creerCompte("PARENT", cab.id);
    const r = await appeler(connexionMobile, {
      corps: { email: parent.email, motDePasse: MOT_DE_PASSE },
    });
    return { parent, r };
  }

  it("donne un jeton d'accès court et un jeton de renouvellement", async () => {
    const { parent, r } = await connecterParent();
    expect(r.status).toBe(200);
    expect(r.corps.expireDans).toBe(15 * 60);
    expect(r.corps.jetonAcces).not.toBe(r.corps.jetonRenouvellement);
    expect(r.entetes.getSetCookie()).toEqual([]);
    const moiR = await appeler(moi, { bearer: r.corps.jetonAcces });
    expect(moiR.corps.utilisateur.id).toBe(parent.id);
  });

  it("le jeton de renouvellement ne sert pas d'accès", async () => {
    const { r } = await connecterParent();
    expect((await appeler(moi, { bearer: r.corps.jetonRenouvellement })).status).toBe(401);
  });

  it("refuse un orthophoniste sur le mobile, avec le même message", async () => {
    const cab = await creerCabinet();
    const ortho = await creerCompte("ORTHO", cab.id);
    const r = await appeler(connexionMobile, {
      corps: { email: ortho.email, motDePasse: MOT_DE_PASSE },
    });
    expect(r.status).toBe(401);
    expect(r.corps.erreur.message).toBe(t("erreurs.identifiantsIncorrects"));
  });

  it("le renouvellement donne une nouvelle paire et invalide l'ancien jeton d'accès", async () => {
    const { r } = await connecterParent();
    const nouveau = await appeler(renouvellement, {
      corps: { jetonRenouvellement: r.corps.jetonRenouvellement },
    });
    expect(nouveau.status).toBe(200);
    expect(nouveau.corps.jetonRenouvellement).not.toBe(r.corps.jetonRenouvellement);
    expect((await appeler(moi, { bearer: r.corps.jetonAcces })).status).toBe(401);
    expect((await appeler(moi, { bearer: nouveau.corps.jetonAcces })).status).toBe(200);
  });

  it("réutiliser un ancien jeton de renouvellement révoque toute la session (vol)", async () => {
    const { r } = await connecterParent();
    const n1 = await appeler(renouvellement, {
      corps: { jetonRenouvellement: r.corps.jetonRenouvellement },
    });
    const rejoue = await appeler(renouvellement, {
      corps: { jetonRenouvellement: r.corps.jetonRenouvellement },
    });
    expect(rejoue.status).toBe(401);
    // Le jeton légitime le plus récent est lui aussi révoqué.
    expect((await appeler(moi, { bearer: n1.corps.jetonAcces })).status).toBe(401);
    const n2 = await appeler(renouvellement, {
      corps: { jetonRenouvellement: n1.corps.jetonRenouvellement },
    });
    expect(n2.status).toBe(401);
  });

  it("un jeton d'accès expiré est refusé", async () => {
    const { parent, r } = await connecterParent();
    await db().session.updateMany({
      where: { userId: parent.id, type: "MOBILE_ACCES" },
      data: { expireLe: new Date(Date.now() - 1000) },
    });
    expect((await appeler(moi, { bearer: r.corps.jetonAcces })).status).toBe(401);
  });

  it("la déconnexion mobile révoque jeton d'accès et de renouvellement", async () => {
    const { r } = await connecterParent();
    const out = await appeler(deconnexion, { methode: "POST", bearer: r.corps.jetonAcces });
    expect(out.status).toBe(204);
    expect((await appeler(moi, { bearer: r.corps.jetonAcces })).status).toBe(401);
    const apres = await appeler(renouvellement, {
      corps: { jetonRenouvellement: r.corps.jetonRenouvellement },
    });
    expect(apres.status).toBe(401);
  });
});

describe("route publique technique", () => {
  it("GET /api/health répond sans connexion", async () => {
    const r = await appeler(health);
    expect(r.status).toBe(200);
    expect(r.corps).toEqual({ status: "ok" });
  });
});
