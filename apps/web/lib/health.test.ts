import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "@app/shared";
import { getHealth } from "./health";

describe("getHealth", () => {
  it("renvoie une réponse conforme au schéma partagé", () => {
    expect(healthResponseSchema.safeParse(getHealth()).success).toBe(true);
  });
});
