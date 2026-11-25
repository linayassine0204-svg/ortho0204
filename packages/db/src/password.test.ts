import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.ts";

describe("mots de passe", () => {
  it("ne stocke jamais le mot de passe en clair", async () => {
    const hash = await hashPassword("un-mot-de-passe-fictif");
    expect(hash).not.toContain("un-mot-de-passe-fictif");
    expect(hash.startsWith("scrypt$")).toBe(true);
  });

  it("vérifie le bon mot de passe et refuse un mauvais", async () => {
    const hash = await hashPassword("un-mot-de-passe-fictif");
    expect(await verifyPassword("un-mot-de-passe-fictif", hash)).toBe(true);
    expect(await verifyPassword("mauvais-mot-de-passe", hash)).toBe(false);
  });

  it("produit un hachage différent à chaque fois (sel aléatoire)", async () => {
    const a = await hashPassword("un-mot-de-passe-fictif");
    const b = await hashPassword("un-mot-de-passe-fictif");
    expect(a).not.toBe(b);
  });

  it("refuse un mot de passe trop court", async () => {
    await expect(hashPassword("court")).rejects.toThrow(/12 caractères/);
  });

  it("refuse un format de hachage inconnu", async () => {
    expect(await verifyPassword("peu-importe-ici", "md5$abc")).toBe(false);
  });
});
