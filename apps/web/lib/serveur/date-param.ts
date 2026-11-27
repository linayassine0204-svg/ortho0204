import { z } from "zod";
import type { NextRequest } from "next/server";
import { erreurs } from "./erreurs";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v);

/** Paramètre ?date=AAAA-MM-JJ facultatif (absent : aujourd'hui, heure de Paris). */
export function dateFacultative(req: NextRequest): string | undefined {
  const brute = req.nextUrl.searchParams.get("date");
  if (brute === null) return undefined;
  const lu = dateSchema.safeParse(brute);
  if (!lu.success) throw erreurs.donneesInvalides();
  return lu.data;
}
