import type { ActionAcces, PrismaClient } from "@app/db";
import type { SectionPatient } from "./droits";

/**
 * Écrit une ligne dans le journal d'accès. Appelé à chaque lecture d'un dossier
 * patient, après la vérification des droits. Aucun contenu médical n'y est écrit.
 */
export async function journaliserAcces(
  prisma: PrismaClient,
  entree: {
    userId: string;
    patientId: string;
    section?: SectionPatient | "resume";
    action?: ActionAcces;
  },
): Promise<void> {
  await prisma.journalAcces.create({
    data: {
      userId: entree.userId,
      patientId: entree.patientId,
      section: entree.section ?? "resume",
      action: entree.action ?? "LECTURE",
    },
  });
}
