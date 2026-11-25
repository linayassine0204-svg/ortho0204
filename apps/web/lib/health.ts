import { healthResponseSchema, type HealthResponse } from "@app/shared";

export function getHealth(): HealthResponse {
  return healthResponseSchema.parse({ status: "ok" });
}
