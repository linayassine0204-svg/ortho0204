import { randomBytes } from "node:crypto";
import { inflateSync } from "node:zlib";
import { NextRequest } from "next/server";
import { hashPassword, type Role } from "@app/db";
import { db } from "@/lib/serveur/db";
import type { GestionnaireNext } from "@/lib/serveur/routes";
import { ouvrirSessionMobile, ouvrirSessionWeb } from "@/lib/serveur/sessions";

// Outils des tests d'intégration de l'API : données FICTIVES uniquement.

export const MOT_DE_PASSE = "motdepasse-de-test-fictif";
let empreinte: Promise<string> | undefined;
const empreinteMotDePasse = () => (empreinte ??= hashPassword(MOT_DE_PASSE));

export const unique = () => randomBytes(4).toString("hex");
export const emailFictif = (prefixe: string) => `${prefixe}.${unique()}@exemple.test`;
/** Adresse IP fictive (plage de documentation), différente à chaque appel. */
export const ipFictive = () => `192.0.2.${Math.floor(Math.random() * 250) + 1}-${unique()}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- corps JSON lu dans les tests
type CorpsJson = Record<string, any>;

interface Appel {
  methode?: string;
  url?: string;
  corps?: unknown;
  cookie?: string;
  bearer?: string;
  params?: Record<string, string>;
  entetes?: Record<string, string>;
  ip?: string;
}

/** Appelle un gestionnaire de route comme le ferait Next.js. */
export async function appeler(gestionnaire: GestionnaireNext, appel: Appel = {}) {
  const entetes = new Headers(appel.entetes);
  entetes.set("x-forwarded-for", appel.ip ?? ipFictive());
  if (appel.corps !== undefined) entetes.set("content-type", "application/json");
  if (appel.cookie) entetes.set("cookie", `session=${appel.cookie}`);
  if (appel.bearer) entetes.set("authorization", `Bearer ${appel.bearer}`);
  const req = new NextRequest(appel.url ?? "http://localhost:3000/api/test", {
    method: appel.methode ?? (appel.corps === undefined ? "GET" : "POST"),
    headers: entetes,
    ...(appel.corps === undefined ? {} : { body: JSON.stringify(appel.corps) }),
  });
  const reponse = await gestionnaire(req, { params: Promise.resolve(appel.params ?? {}) });
  const texte = await reponse.text();
  return {
    status: reponse.status,
    corps: (texte ? JSON.parse(texte) : null) as CorpsJson,
    entetes: reponse.headers,
  };
}

export async function creerCabinet(messagerieActivee = true) {
  return db().cabinet.create({ data: { nom: `Cabinet fictif ${unique()}`, messagerieActivee } });
}

export async function creerCompte(role: Role, cabinetId: string, prefixe = role.toLowerCase()) {
  return db().user.create({
    data: {
      email: emailFictif(prefixe),
      motDePasseHash: await empreinteMotDePasse(),
      role,
      prenom: "Prénom",
      nom: "Exemple",
      cabinetId,
    },
  });
}

export function naissanceIlYa(ans: number): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear() - ans, 0, 1));
}

export async function creerPatient(
  cabinetId: string,
  options: {
    age?: number;
    tuteurIds?: string[];
    compteUserId?: string;
    /** Consentement « données de santé » des comptes famille (oui par défaut). */
    consentement?: boolean;
  } = {},
) {
  const famille = [
    ...(options.tuteurIds ?? []),
    ...(options.compteUserId ? [options.compteUserId] : []),
  ];
  return db().patient.create({
    data: {
      cabinetId,
      prenom: `Enfant${unique()}`,
      nom: "Exemple",
      dateNaissance: naissanceIlYa(options.age ?? 8),
      notes: "Note clinique fictive",
      compteUserId: options.compteUserId ?? null,
      tuteurs: { create: (options.tuteurIds ?? []).map((parentId) => ({ parentId })) },
      consentements: {
        create: (options.consentement === false ? [] : famille).map((userId) => ({
          userId,
          type: "DONNEES_SANTE" as const,
          versionTexte: "test",
        })),
      },
    },
  });
}

export async function jetonWeb(userId: string) {
  return (await ouvrirSessionWeb(db(), userId)).jeton;
}

export async function jetonMobile(userId: string) {
  return (await ouvrirSessionMobile(db(), userId)).jetonAcces;
}

/**
 * Deux cabinets complets : A (ortho, 2 parents, 2 enfants, 1 adulte) et B (ortho, parent, enfant).
 */
export async function deuxCabinets() {
  const cabA = await creerCabinet();
  const cabB = await creerCabinet();
  const orthoA = await creerCompte("ORTHO", cabA.id);
  const orthoB = await creerCompte("ORTHO", cabB.id);
  const parentA1 = await creerCompte("PARENT", cabA.id);
  const parentA2 = await creerCompte("PARENT", cabA.id);
  const parentB = await creerCompte("PARENT", cabB.id);
  const adulteA = await creerCompte("PATIENT_ADULT", cabA.id);
  const adulteA2 = await creerCompte("PATIENT_ADULT", cabA.id);
  const enfantA1 = await creerPatient(cabA.id, { tuteurIds: [parentA1.id] });
  const enfantA2 = await creerPatient(cabA.id, { tuteurIds: [parentA2.id] });
  const dossierAdulteA = await creerPatient(cabA.id, { age: 34, compteUserId: adulteA.id });
  const dossierAdulteA2 = await creerPatient(cabA.id, { age: 40, compteUserId: adulteA2.id });
  const enfantB = await creerPatient(cabB.id, { tuteurIds: [parentB.id] });
  return {
    cabA,
    cabB,
    orthoA,
    orthoB,
    parentA1,
    parentA2,
    parentB,
    adulteA,
    adulteA2,
    enfantA1,
    enfantA2,
    dossierAdulteA,
    dossierAdulteA2,
    enfantB,
  };
}

/** Valeur obligatoire dans un test (échoue clairement si absente). */
export function exiger<T>(valeur: T | null | undefined, quoi = "valeur"): T {
  if (valeur === null || valeur === undefined) throw new Error(`${quoi} absente`);
  return valeur;
}

/** Cookie de session posé par une réponse (brut = en-tête Set-Cookie complet). */
export function cookieSession(entetes: Headers): { valeur: string; brut: string } | null {
  const brut = entetes.getSetCookie().find((c) => c.startsWith("session="));
  if (!brut) return null;
  return { valeur: exiger(brut.split(";")[0]).slice("session=".length), brut };
}

/** Envoie un fichier en multipart, comme le formulaire de la Fiche. */
export async function envoyerFichier(
  gestionnaire: GestionnaireNext,
  appel: { cookie?: string; bearer?: string; params: Record<string, string> },
  fichier: { nom: string; octets: Uint8Array; type?: string },
) {
  const formulaire = new FormData();
  formulaire.set(
    "fichier",
    new File([new Uint8Array(fichier.octets)], fichier.nom, {
      type: fichier.type ?? "application/octet-stream",
    }),
  );
  const entetes = new Headers({ "x-forwarded-for": ipFictive() });
  if (appel.cookie) entetes.set("cookie", `session=${appel.cookie}`);
  if (appel.bearer) entetes.set("authorization", `Bearer ${appel.bearer}`);
  const req = new NextRequest("http://localhost:3000/api/test", {
    method: "POST",
    headers: entetes,
    body: formulaire,
  });
  const reponse = await gestionnaire(req, { params: Promise.resolve(appel.params) });
  const texte = await reponse.text();
  return { status: reponse.status, corps: (texte ? JSON.parse(texte) : null) as CorpsJson };
}

/** Faux fichiers : seuls les premiers octets (signature) comptent. */
export const PDF_FICTIF = new TextEncoder().encode("%PDF-1.4\n% document fictif\n%%EOF\n");
export const PNG_FICTIF = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);

/** Texte d'un PDF produit par pdf-lib (flux décompressés, chaînes en hexadécimal). */
export function textePdf(octets: Uint8Array): string {
  const brut = Buffer.from(octets).toString("latin1");
  const morceaux: string[] = [];
  for (const m of brut.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const flux = Buffer.from(m[1] ?? "", "latin1");
    let contenu: string;
    try {
      contenu = inflateSync(flux).toString("latin1");
    } catch {
      contenu = flux.toString("latin1");
    }
    for (const t of contenu.matchAll(/<([0-9A-Fa-f]+)> Tj/g)) {
      // Polices standard : codage WinAnsi (latin-1, sauf quelques signes comme « — »).
      const winAnsi: Record<number, string> = {
        0x95: "•",
        0x96: "–",
        0x97: "—",
        0x92: "’",
        0x9c: "œ",
      };
      morceaux.push(
        [...Buffer.from(t[1] ?? "", "hex")]
          .map((o) => winAnsi[o] ?? String.fromCharCode(o))
          .join(""),
      );
    }
  }
  return morceaux.join("\n");
}
