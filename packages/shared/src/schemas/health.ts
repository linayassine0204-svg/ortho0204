import { z } from "zod";

/** Réponse de GET /api/health (aucune donnée de santé : simple état du service). */
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
