import { describe, expect, it } from "vitest";
import { lireConfig } from "./config";

const SECRET = "x".repeat(32);

describe("lireConfig", () => {
  it("exige AUTH_SECRET sans révéler sa valeur", () => {
    expect(() => lireConfig({})).toThrow(/AUTH_SECRET/);
    expect(() => lireConfig({ AUTH_SECRET: "court-et-secret" })).toThrow(/32/);
    expect(() => lireConfig({ AUTH_SECRET: "court-et-secret" })).not.toThrow(/court-et-secret/);
  });

  it("donne l'origine publique et le mode production", () => {
    const c = lireConfig({ AUTH_SECRET: SECRET, APP_URL: "https://ortho.exemple.test/x" });
    expect(c.appOrigin).toBe("https://ortho.exemple.test");
    expect(c.production).toBe(false);
    expect(lireConfig({ AUTH_SECRET: SECRET, NODE_ENV: "production" }).production).toBe(true);
  });
});
