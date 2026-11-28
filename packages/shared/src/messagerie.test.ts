import { describe, expect, it } from "vitest";
import {
  TYPES_PIECE_JOINTE,
  detecterTypePieceJointe,
  messagerieEffective,
  nouveauMessageSchema,
  reglagesCabinetSchema,
} from "./messagerie.ts";

// Messagerie : réglage effectif (cabinet / exception patient) et type réel des pièces jointes.

const octets = (...valeurs: (number | string)[]) =>
  new Uint8Array(
    valeurs.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])),
  );

describe("réglage effectif", () => {
  it("l'exception du patient l'emporte ; sans exception, le réglage du cabinet", () => {
    expect(messagerieEffective(true, null)).toBe(true);
    expect(messagerieEffective(false, undefined)).toBe(false);
    expect(messagerieEffective(true, false)).toBe(false);
    expect(messagerieEffective(false, true)).toBe(true);
  });
});

describe("type réel des pièces jointes", () => {
  it("reconnaît photos (JPEG, PNG) et messages vocaux (M4A, WebM, Ogg)", () => {
    expect(detecterTypePieceJointe(octets(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("image/jpeg");
    expect(detecterTypePieceJointe(octets(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      "image/png",
    );
    expect(detecterTypePieceJointe(octets(0, 0, 0, 0x20, "ftypM4A ", 0, 0))).toBe("audio/mp4");
    expect(
      detecterTypePieceJointe(octets(0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84, "webm")),
    ).toBe("audio/webm");
    expect(detecterTypePieceJointe(octets("OggS", 0, 2))).toBe("audio/ogg");
    for (const type of ["image/jpeg", "audio/mp4"] as const) {
      expect(Object.keys(TYPES_PIECE_JOINTE)).toContain(type);
    }
  });

  it("refuse le reste, quel que soit le nom ou le type annoncé (PDF, exécutable, texte, vide)", () => {
    expect(detecterTypePieceJointe(octets("%PDF-1.4"))).toBeNull();
    expect(detecterTypePieceJointe(octets("MZ", 0x90, 0))).toBeNull();
    expect(detecterTypePieceJointe(octets("<html>"))).toBeNull();
    expect(detecterTypePieceJointe(new Uint8Array())).toBeNull();
    // EBML qui n'est pas du WebM (ex. vidéo Matroska) : refusé.
    expect(detecterTypePieceJointe(octets(0x1a, 0x45, 0xdf, 0xa3, "matroska"))).toBeNull();
  });
});

describe("formats", () => {
  it("message : texte non vide, 5000 caractères au plus", () => {
    expect(nouveauMessageSchema.safeParse({ contenu: "  " }).success).toBe(false);
    expect(nouveauMessageSchema.safeParse({ contenu: "x".repeat(5001) }).success).toBe(false);
    expect(nouveauMessageSchema.parse({ contenu: " Bonjour " })).toEqual({ contenu: "Bonjour" });
  });

  it("réglages du cabinet : horaires vides enregistrés comme absents", () => {
    expect(reglagesCabinetSchema.parse({ horairesReponse: " " })).toEqual({
      horairesReponse: null,
    });
    expect(reglagesCabinetSchema.safeParse({}).success).toBe(false);
  });
});
