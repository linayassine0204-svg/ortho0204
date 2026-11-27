// Dictée vocale du navigateur, UNIQUEMENT si la voix est reconnue sur l'ordinateur.
//
// Attention : par défaut, la reconnaissance vocale de certains navigateurs (Chrome
// notamment) envoie l'audio à un service externe. C'est interdit pour des notes de
// séance. On n'active donc la dictée que si le navigateur sait reconnaître la voix
// localement (`processLocally`, API Web Speech récente) et confirme que la langue
// française est disponible sur l'ordinateur. Sinon : pas de dictée, saisie au clavier.

export type EtatDictee = "locale" | "a-installer" | "indisponible";

interface OptionsLocales {
  langs: string[];
  processLocally: boolean;
}

interface ResultatReconnaissance {
  isFinal: boolean;
  0: { transcript: string };
}

export interface Reconnaissance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally?: boolean;
  onresult:
    ((e: { resultIndex: number; results: ArrayLike<ResultatReconnaissance> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

export interface ConstructeurReconnaissance {
  new (): Reconnaissance;
  prototype: object;
  available?: (o: OptionsLocales) => Promise<string>;
  install?: (o: OptionsLocales) => Promise<boolean>;
}

const LANGUE = "fr-FR";
const LOCAL: OptionsLocales = { langs: [LANGUE], processLocally: true };

/** Constructeur de reconnaissance vocale du navigateur, s'il existe. */
export function constructeurDictee(
  fenetre: object = globalThis,
): ConstructeurReconnaissance | null {
  const f = fenetre as {
    SpeechRecognition?: ConstructeurReconnaissance;
    webkitSpeechRecognition?: ConstructeurReconnaissance;
  };
  return f.SpeechRecognition ?? f.webkitSpeechRecognition ?? null;
}

/**
 * Vérification immédiate (sans rien appeler) : le navigateur connaît-il le mode local ?
 * La vraie vérification (`etatDictee`) n'est faite qu'au clic sur « Dicter ».
 */
export function dicteeLocalePossible(
  C: ConstructeurReconnaissance | null,
): C is ConstructeurReconnaissance {
  return Boolean(C && typeof C.available === "function" && "processLocally" in C.prototype);
}

/** La dictée peut-elle fonctionner sans rien envoyer hors de l'ordinateur ? */
export async function etatDictee(
  C: ConstructeurReconnaissance | null = constructeurDictee(),
): Promise<EtatDictee> {
  if (!dicteeLocalePossible(C)) return "indisponible";
  try {
    const dispo = await C.available?.(LOCAL);
    if (dispo === "available") return "locale";
    if ((dispo === "downloadable" || dispo === "downloading") && typeof C.install === "function") {
      return "a-installer";
    }
  } catch {
    // Le navigateur refuse de répondre : on ne prend aucun risque.
  }
  return "indisponible";
}

/** Télécharge la reconnaissance du français sur l'ordinateur (aucun audio envoyé). */
export async function installerDictee(C: ConstructeurReconnaissance): Promise<boolean> {
  try {
    return (await C.install?.(LOCAL)) === true;
  } catch {
    return false;
  }
}

/**
 * Lance la dictée en reconnaissance LOCALE. Si le navigateur n'accepte pas le mode
 * local, rien ne démarre (renvoie null). Renvoie une fonction pour arrêter.
 */
export function demarrerDictee(
  C: ConstructeurReconnaissance,
  rappels: { onTexte: (texte: string) => void; onFin: () => void; onErreur: () => void },
): (() => void) | null {
  const r = new C();
  r.lang = LANGUE;
  r.continuous = true;
  r.interimResults = false;
  r.processLocally = true;
  if (r.processLocally !== true) return null;
  r.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const resultat = e.results[i];
      if (resultat?.isFinal) {
        const texte = resultat[0].transcript.trim();
        if (texte) rappels.onTexte(texte);
      }
    }
  };
  r.onerror = () => rappels.onErreur();
  r.onend = () => rappels.onFin();
  r.start();
  return () => r.stop();
}
