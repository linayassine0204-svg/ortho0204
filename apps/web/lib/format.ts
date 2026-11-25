import { t } from "@app/shared";

/** Date au format français (jj/mm/aaaa). Les dates de naissance sont en UTC. */
export function dateFr(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

/** Âge affiché : « 1 an », « 7 ans ». */
export function libelleAge(age: number): string {
  return t(age > 1 ? "web.patients.ans" : "web.patients.an", { age });
}

/** Taille de fichier lisible (Ko, Mo). */
export function taille(octets: number): string {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
