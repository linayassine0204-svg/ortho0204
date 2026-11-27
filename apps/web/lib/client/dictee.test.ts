import { describe, expect, it, vi } from "vitest";
import {
  constructeurDictee,
  demarrerDictee,
  etatDictee,
  type ConstructeurReconnaissance,
  type Reconnaissance,
} from "./dictee";

// La dictée n'est proposée que si la voix est reconnue SUR l'ordinateur :
// jamais d'audio envoyé à un service externe.

function fauxNavigateur(options: { local?: boolean; dispo?: string; accepteLocal?: boolean }): {
  C: ConstructeurReconnaissance;
  instances: Reconnaissance[];
} {
  const instances: Reconnaissance[] = [];
  class Faux {
    lang = "";
    continuous = false;
    interimResults = true;
    onresult = null;
    onerror = null;
    onend = null;
    start = vi.fn();
    stop = vi.fn();
    private local = false;
    constructor() {
      instances.push(this as unknown as Reconnaissance);
    }
  }
  if (options.local !== false) {
    Object.defineProperty(Faux.prototype, "processLocally", {
      get(this: { local: boolean }) {
        return this.local;
      },
      set(this: { local: boolean }, v: boolean) {
        // Un navigateur qui ne sait pas faire en local ignore la demande.
        if (options.accepteLocal !== false) this.local = v;
      },
    });
  }
  const C = Faux as unknown as ConstructeurReconnaissance;
  C.available = vi.fn(async () => options.dispo ?? "available");
  C.install = vi.fn(async () => true);
  return { C, instances };
}

describe("dictée locale seulement", () => {
  it("pas de reconnaissance vocale : indisponible", async () => {
    expect(constructeurDictee({})).toBeNull();
    expect(await etatDictee(null)).toBe("indisponible");
  });

  it("reconnaissance qui ne sait pas faire en local (ancienne API) : indisponible", async () => {
    const { C } = fauxNavigateur({ local: false });
    expect(await etatDictee(C)).toBe("indisponible");
    const ancienne = function () {} as unknown as ConstructeurReconnaissance;
    expect(await etatDictee(ancienne)).toBe("indisponible");
  });

  it("français disponible sur l'ordinateur : dictée locale ; à télécharger : à installer", async () => {
    expect(await etatDictee(fauxNavigateur({ dispo: "available" }).C)).toBe("locale");
    expect(await etatDictee(fauxNavigateur({ dispo: "downloadable" }).C)).toBe("a-installer");
    expect(await etatDictee(fauxNavigateur({ dispo: "unavailable" }).C)).toBe("indisponible");
    const { C } = fauxNavigateur({});
    await etatDictee(C);
    expect(C.available).toHaveBeenCalledWith({ langs: ["fr-FR"], processLocally: true });
  });

  it("démarre en mode local et renvoie le texte reconnu", () => {
    const { C, instances } = fauxNavigateur({});
    const textes: string[] = [];
    const arreter = demarrerDictee(C, {
      onTexte: (t) => textes.push(t),
      onFin: () => {},
      onErreur: () => {},
    });
    const r = instances[0] as Reconnaissance;
    expect(r.processLocally).toBe(true);
    expect(r.lang).toBe("fr-FR");
    expect(r.start).toHaveBeenCalled();
    r.onresult?.({
      resultIndex: 0,
      results: [
        { isFinal: true, 0: { transcript: " bonne séance " } },
        { isFinal: false, 0: { transcript: "provisoire" } },
      ],
    });
    expect(textes).toEqual(["bonne séance"]);
    arreter?.();
    expect(r.stop).toHaveBeenCalled();
  });

  it("si le navigateur refuse le mode local au démarrage, rien ne démarre", () => {
    const { C, instances } = fauxNavigateur({ accepteLocal: false });
    const arreter = demarrerDictee(C, { onTexte: () => {}, onFin: () => {}, onErreur: () => {} });
    expect(arreter).toBeNull();
    expect(instances[0]?.start).not.toHaveBeenCalled();
  });
});
