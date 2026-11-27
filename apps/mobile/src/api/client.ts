import {
  erreurApiSchema,
  jetonsMobileSchema,
  t,
  type AcceptationInvitation,
  type JetonsMobile,
} from "@app/shared";
import type { Coffre } from "../donnees/coffre";

/** Pas de réseau (ou serveur injoignable) : on peut se rabattre sur le cache. */
export class ErreurReseau extends Error {
  constructor() {
    super(t("mobile.erreurs.reseau"));
  }
}

/** Réponse d'erreur de l'API (message déjà en français, venant du serveur). */
export class ErreurApi extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface JetonsRanges {
  acces: string;
  renouvellement: string;
  /** Instant (ms) d'expiration du jeton d'accès. */
  expireLe: number;
}

const CLE_JETONS = "session.jetons";
/** Marge avant expiration pour renouveler sans attendre un refus. */
const MARGE_MS = 30_000;

export interface ClientApi {
  connexion(email: string, motDePasse: string): Promise<void>;
  accepterInvitation(donnees: AcceptationInvitation): Promise<{ role: string }>;
  get<T>(chemin: string): Promise<T>;
  post<T>(chemin: string, corps?: unknown): Promise<T>;
  estConnecte(): Promise<boolean>;
  deconnexion(): Promise<void>;
}

export function creerClientApi(dependances: {
  baseUrl: string;
  coffre: Coffre;
  fetch?: typeof fetch;
  maintenant?: () => number;
}): ClientApi {
  const { baseUrl, coffre } = dependances;
  const fetcher = dependances.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const maintenant = dependances.maintenant ?? Date.now;
  let renouvellementEnCours: Promise<JetonsRanges | null> | null = null;

  async function lireJetons(): Promise<JetonsRanges | null> {
    const brut = await coffre.lire(CLE_JETONS);
    if (!brut) return null;
    try {
      return JSON.parse(brut) as JetonsRanges;
    } catch {
      return null;
    }
  }

  async function rangerJetons(j: JetonsMobile): Promise<JetonsRanges> {
    const ranges = {
      acces: j.jetonAcces,
      renouvellement: j.jetonRenouvellement,
      expireLe: maintenant() + j.expireDans * 1000,
    };
    await coffre.ecrire(CLE_JETONS, JSON.stringify(ranges));
    return ranges;
  }

  async function appel(chemin: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetcher(`${baseUrl}${chemin}`, {
        ...init,
        headers: { Accept: "application/json", ...(init.headers ?? {}) },
      });
    } catch {
      throw new ErreurReseau();
    }
  }

  async function erreurDe(reponse: Response): Promise<ErreurApi> {
    const corps = erreurApiSchema.safeParse(await reponse.json().catch(() => null));
    return corps.success
      ? new ErreurApi(reponse.status, corps.data.erreur.code, corps.data.erreur.message)
      : new ErreurApi(reponse.status, "inconnue", t("erreurs.inconnue"));
  }

  async function lireJson<T>(reponse: Response): Promise<T> {
    if (!reponse.ok) throw await erreurDe(reponse);
    if (reponse.status === 204) return undefined as T;
    return (await reponse.json()) as T;
  }

  const json = (corps: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps ?? {}),
  });

  /**
   * Le jeton de renouvellement ne sert qu'une fois (le serveur révoque tout s'il revient) :
   * un seul renouvellement à la fois, partagé par les requêtes simultanées.
   */
  function renouveler(actuels: JetonsRanges): Promise<JetonsRanges | null> {
    renouvellementEnCours ??= (async () => {
      try {
        const r = await appel(
          "/auth/mobile/renouvellement",
          json({ jetonRenouvellement: actuels.renouvellement }),
        );
        if (!r.ok) {
          // Refus définitif : session terminée. (Erreur réseau : on garde les jetons.)
          if (r.status === 401 || r.status === 400) await coffre.effacer(CLE_JETONS);
          return null;
        }
        return rangerJetons(jetonsMobileSchema.parse(await r.json()));
      } finally {
        renouvellementEnCours = null;
      }
    })();
    return renouvellementEnCours;
  }

  async function jetonValide(): Promise<JetonsRanges> {
    const jetons = await lireJetons();
    if (!jetons) throw new ErreurApi(401, "non_connecte", t("erreurs.nonConnecte"));
    if (jetons.expireLe - MARGE_MS > maintenant()) return jetons;
    const neufs = await renouveler(jetons);
    if (!neufs) throw new ErreurApi(401, "non_connecte", t("erreurs.nonConnecte"));
    return neufs;
  }

  async function protege<T>(chemin: string, init: RequestInit = {}): Promise<T> {
    let jetons = await jetonValide();
    const avec = (j: JetonsRanges) =>
      appel(chemin, { ...init, headers: { ...init.headers, Authorization: `Bearer ${j.acces}` } });
    let reponse = await avec(jetons);
    if (reponse.status === 401) {
      // Jeton d'accès refusé (expiré plus tôt que prévu) : un seul nouvel essai.
      const neufs = await renouveler(jetons);
      if (!neufs) throw new ErreurApi(401, "non_connecte", t("erreurs.nonConnecte"));
      jetons = neufs;
      reponse = await avec(jetons);
    }
    return lireJson<T>(reponse);
  }

  return {
    async connexion(email, motDePasse) {
      const r = await appel("/auth/mobile/connexion", json({ email, motDePasse }));
      await rangerJetons(jetonsMobileSchema.parse(await lireJson(r)));
    },

    async accepterInvitation(donnees) {
      return lireJson(await appel("/invitations/accepter", json(donnees)));
    },

    get: (chemin) => protege(chemin),
    post: (chemin, corps) => protege(chemin, json(corps)),

    async estConnecte() {
      return (await lireJetons()) !== null;
    },

    async deconnexion() {
      // Jeton d'accès encore valide (renouvelé si besoin) pour révoquer la session.
      const jetons = await jetonValide().catch(() => lireJetons());
      await coffre.effacer(CLE_JETONS);
      if (!jetons) return;
      // Révocation côté serveur ; sans réseau, les jetons sont de toute façon effacés ici.
      await appel("/auth/deconnexion", {
        method: "POST",
        headers: { Authorization: `Bearer ${jetons.acces}` },
      }).catch(() => undefined);
    },
  };
}
