import fr from "../i18n/fr.json" with { type: "json" };

/**
 * Textes visibles par l'utilisateur.
 *
 * Toute chaîne affichée doit passer par `t()`. Le métier (« orthophoniste »)
 * n'est écrit qu'une fois, dans `terme.*` : les autres textes y font référence
 * avec `{{terme.xxx}}`. Pour passer à « logopédiste », il suffit de modifier
 * le bloc `terme` de `fr.json`.
 */
export type Messages = typeof fr;

type Join<K extends string, P extends string> = `${K}.${P}`;

/** Toutes les clés « feuilles » du dictionnaire, ex. "web.accueil.titre". */
export type LeafKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : Join<K, LeafKeys<T[K]>>;
}[keyof T & string];

export type TranslationKey = LeafKeys<Messages>;

export type TranslationParams = Record<string, string | number>;

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;
const MAX_DEPTH = 5;

function lookup(messages: unknown, key: string): string | undefined {
  let current: unknown = messages;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(
  messages: unknown,
  text: string,
  params: TranslationParams,
  depth: number,
): string {
  if (depth > MAX_DEPTH) return text;
  return text.replace(PLACEHOLDER, (match, name: string) => {
    const param = params[name];
    if (param !== undefined) return String(param);
    const nested = lookup(messages, name);
    return nested === undefined ? match : interpolate(messages, nested, params, depth + 1);
  });
}

export function createTranslator(messages: unknown) {
  return function translate(key: TranslationKey, params: TranslationParams = {}): string {
    const raw = lookup(messages, key);
    // Clé absente : on renvoie la clé elle-même plutôt que de planter l'écran.
    if (raw === undefined) return key;
    return interpolate(messages, raw, params, 0);
  };
}

export const messagesFr: Messages = fr;

export const t = createTranslator(messagesFr);
