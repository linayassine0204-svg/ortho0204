import type { ElementEnvoye } from "@app/shared";
import type { ProgrammeEnvoye } from "../src/session/types";

// Données FICTIVES pour les tests (proches du seed : Léa, programme « Sons et syllabes »).

/** Vendredi 27 novembre 2026, 10 h à Paris. */
export const VENDREDI = new Date("2026-11-27T09:00:00Z");

export function exercice(partiel: Partial<ElementEnvoye> = {}): ElementEnvoye {
  return {
    elementId: "el-rimes",
    exerciceId: "ex-rimes",
    titre: "Trouver les rimes",
    description: "Description fictive.",
    apercuConsigne: "Dire si deux mots riment.",
    apercuImage: null,
    materiel: ["Cartes images"],
    dureeMinutes: 10,
    categorie: { nom: "Langage écrit", slug: "langage-ecrit" },
    niveau: 1,
    consigne: "Consigne du niveau 1.",
    foisParSemaine: 3,
    jours: ["LUNDI", "MERCREDI", "VENDREDI"],
    motFamille: "Faites-le après le goûter, 10 minutes suffisent.",
    aValider: false,
    ...partiel,
  };
}

export const programmeLea: ProgrammeEnvoye = {
  titre: "Sons et syllabes",
  version: 1,
  envoyeLe: "2026-10-16T08:00:00.000Z",
  elements: [
    exercice(),
    exercice({
      elementId: "el-syllabes",
      exerciceId: "ex-syllabes",
      titre: "Compter les syllabes",
      apercuConsigne: "Taper dans les mains à chaque syllabe.",
      niveau: 2,
      dureeMinutes: 5,
      foisParSemaine: 2,
      jours: ["MARDI", "SAMEDI"],
      motFamille: "Transformez-le en jeu, sans pression.",
    }),
    exercice({
      elementId: "el-libre",
      exerciceId: "ex-libre",
      titre: "Lecture partagée",
      apercuConsigne: "Lire une histoire ensemble.",
      niveau: 3,
      dureeMinutes: 15,
      foisParSemaine: 2,
      jours: [],
      motFamille: null,
    }),
  ],
};

interface Compte {
  email: string;
  motDePasse: string;
  utilisateur: { id: string; prenom: string; role: "PARENT" | "PATIENT_ADULT" | "ORTHO" };
  patients: {
    id: string;
    prenom: string;
    messagerieActivee?: boolean;
    consentementRequis?: true;
  }[];
}

export const MOT_DE_PASSE = "motdepasse-fictif-dev";

export const comptes: Compte[] = [
  {
    email: "parent.lea@exemple.test",
    motDePasse: MOT_DE_PASSE,
    utilisateur: { id: "u-julie", prenom: "Julie", role: "PARENT" },
    patients: [
      { id: "p-lea", prenom: "Léa", messagerieActivee: true },
      { id: "p-sacha", prenom: "Sacha", consentementRequis: true },
    ],
  },
  {
    email: "paul@exemple.test",
    motDePasse: MOT_DE_PASSE,
    utilisateur: { id: "u-paul", prenom: "Paul", role: "PATIENT_ADULT" },
    patients: [{ id: "p-paul", prenom: "Paul", messagerieActivee: false }],
  },
];

/**
 * Faux serveur (remplace `fetch`) : connexion mobile, renouvellement, compte, patients,
 * programme. `horsLigne = true` simule l'absence de réseau.
 */
export function fauxServeur(options: { programmes?: Record<string, ProgrammeEnvoye | null> } = {}) {
  const programmes = options.programmes ?? { "p-lea": programmeLea, "p-paul": programmeLea };
  const sessions = new Map<string, Compte>();
  const renouvellements = new Map<string, Compte>();
  let n = 0;
  const etat = { horsLigne: false, appels: [] as string[] };

  const reponse = (status: number, corps?: unknown) =>
    new Response(corps === undefined ? null : JSON.stringify(corps), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  const erreur = (status: number, code: string) =>
    reponse(status, { erreur: { code, message: `Erreur fictive ${code}` } });

  function ouvrir(compte: Compte) {
    n += 1;
    const jetons = {
      jetonAcces: `acces-${n}`,
      expireDans: 900,
      jetonRenouvellement: `renouv-${n}`,
    };
    sessions.set(jetons.jetonAcces, compte);
    renouvellements.set(jetons.jetonRenouvellement, compte);
    return jetons;
  }

  const fetch = async (entree: RequestInfo | URL, init: RequestInit = {}) => {
    if (etat.horsLigne) throw new TypeError("Network request failed");
    const url = new URL(String(entree));
    const chemin = url.pathname.replace(/^\/api/, "");
    etat.appels.push(`${init.method ?? "GET"} ${chemin}`);
    const corps = init.body ? JSON.parse(String(init.body)) : {};
    const entetes = new Headers(init.headers);
    const compte = sessions.get((entetes.get("Authorization") ?? "").replace("Bearer ", ""));

    if (chemin === "/auth/mobile/connexion") {
      const c = comptes.find((x) => x.email === corps.email && x.motDePasse === corps.motDePasse);
      return c ? reponse(200, ouvrir(c)) : erreur(401, "identifiants_incorrects");
    }
    if (chemin === "/auth/mobile/renouvellement") {
      const c = renouvellements.get(corps.jetonRenouvellement);
      if (!c) return erreur(401, "non_connecte");
      renouvellements.delete(corps.jetonRenouvellement);
      return reponse(200, ouvrir(c));
    }
    if (chemin === "/invitations/accepter") {
      return corps.jeton === "j".repeat(43)
        ? reponse(201, { role: "PARENT" })
        : erreur(400, "invitation_invalide");
    }
    if (!compte) return erreur(401, "non_connecte");
    if (chemin === "/auth/deconnexion") return reponse(204);
    if (chemin === "/auth/moi") return reponse(200, { utilisateur: compte.utilisateur });
    if (chemin === "/patients") return reponse(200, { patients: compte.patients });
    const m = /^\/patients\/([^/]+)\/programme\/semaine$/.exec(chemin);
    if (m) {
      const p = compte.patients.find((x) => x.id === m[1]);
      if (!p) return erreur(404, "introuvable");
      if (p.consentementRequis) return erreur(403, "consentement_requis");
      return reponse(200, { programme: programmes[p.id] ?? null, semaine: null });
    }
    return erreur(404, "introuvable");
  };

  return { fetch: fetch as typeof globalThis.fetch, etat, sessions };
}
