import { describe, expect, it } from "vitest";
import { readDatabaseUrl } from "./env.ts";

describe("readDatabaseUrl", () => {
  it("accepte une URL PostgreSQL", () => {
    const url = "postgresql://user:pass@localhost:5432/db";
    expect(readDatabaseUrl({ DATABASE_URL: url })).toBe(url);
  });

  it("refuse une variable absente", () => {
    expect(() => readDatabaseUrl({})).toThrow(/manquante/);
  });

  it("refuse une URL non PostgreSQL sans divulguer sa valeur", () => {
    const secret = "mysql://user:tres-secret@host/db";
    expect(() => readDatabaseUrl({ DATABASE_URL: secret })).toThrow(/PostgreSQL/);
    try {
      readDatabaseUrl({ DATABASE_URL: secret });
    } catch (error) {
      expect(String(error)).not.toContain("tres-secret");
    }
  });
});
