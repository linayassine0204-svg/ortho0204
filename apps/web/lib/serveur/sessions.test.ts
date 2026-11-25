import { describe, expect, it } from "vitest";
import { jetonBearer } from "./sessions";

describe("jetonBearer", () => {
  it("lit l'en-tête Authorization: Bearer", () => {
    expect(jetonBearer(new Headers({ authorization: "Bearer abc" }))).toBe("abc");
    expect(jetonBearer(new Headers({ authorization: "bearer abc" }))).toBe("abc");
  });

  it("ignore les autres formes", () => {
    expect(jetonBearer(new Headers())).toBeNull();
    expect(jetonBearer(new Headers({ authorization: "Basic abc" }))).toBeNull();
    expect(jetonBearer(new Headers({ authorization: "Bearer" }))).toBeNull();
  });
});
