import { describe, expect, it } from "vitest";
import { verifierAdresseApi } from "./config";

describe("adresse de l'API", () => {
  it("production : https obligatoire (connexion chiffrée)", () => {
    expect(verifierAdresseApi("https://api.exemple.test/api/", false)).toBe(
      "https://api.exemple.test/api",
    );
    expect(() => verifierAdresseApi("http://api.exemple.test/api", false)).toThrow();
  });

  it("développement : http accepté sur le réseau local", () => {
    expect(verifierAdresseApi("http://192.168.1.33:3000/api", true)).toBe(
      "http://192.168.1.33:3000/api",
    );
  });
});
