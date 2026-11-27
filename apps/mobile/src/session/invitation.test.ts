import { describe, expect, it } from "vitest";
import { extraireJetonInvitation } from "./invitation";

const JETON = "AbC_def-0123456789abcdefghijklmnopqrstuvwx";

describe("lien d'invitation", () => {
  it("extrait le jeton du lien web ou du lien de l'application", () => {
    expect(extraireJetonInvitation(`https://exemple.test/invitation#${JETON}`)).toBe(JETON);
    expect(extraireJetonInvitation(`  suivipatients://invitation#${JETON}\n`)).toBe(JETON);
  });

  it("accepte le jeton seul", () => {
    expect(extraireJetonInvitation(JETON)).toBe(JETON);
  });

  it("refuse un texte qui n'est pas un lien d'invitation", () => {
    expect(extraireJetonInvitation("")).toBeNull();
    expect(extraireJetonInvitation("bonjour")).toBeNull();
    expect(extraireJetonInvitation(`https://exemple.test/autre#${JETON}`)).toBeNull();
    expect(extraireJetonInvitation("https://exemple.test/invitation#a b")).toBeNull();
  });
});
