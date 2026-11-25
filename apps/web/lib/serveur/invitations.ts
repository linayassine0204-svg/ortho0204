import { hashPassword, verifyPassword, type PrismaClient } from "@app/db";
import {
  nouveauMotDePasseSchema,
  type AcceptationInvitation,
  type NouvelleInvitation,
} from "@app/shared";
import { DUREES, LIMITES, lireConfig } from "./config";
import { ErreurApi, erreurs } from "./erreurs";
import { empreinteJeton, genererJeton } from "./jetons";
import { enregistrerTentative, limiteAtteinte } from "./limiteur";
import { ageEnAnnees, patientAutorise } from "./patients";
import { expediteur } from "./email";
import type { UtilisateurConnecte } from "./sessions";

/** Âge à partir duquel un patient peut avoir son propre compte (règle produit). */
export const AGE_MIN_COMPTE_PATIENT = 15;

/**
 * L'orthophoniste invite un parent ou le patient lui-même.
 * Le lien porte le jeton après « # » : il n'est jamais envoyé au serveur dans
 * l'URL (ni journaux du serveur, ni en-tête Referer).
 */
export async function creerInvitation(
  prisma: PrismaClient,
  utilisateur: UtilisateurConnecte,
  patientId: string,
  donnees: NouvelleInvitation,
  maintenant = new Date(),
) {
  const patient = await patientAutorise(prisma, utilisateur, patientId, "inviter");

  if (donnees.role === "PATIENT_ADULT") {
    if (patient.compteUserId) {
      throw new ErreurApi(409, "patient_deja_un_compte", "erreurs.patientDejaUnCompte");
    }
    if (ageEnAnnees(patient.dateNaissance, maintenant) < AGE_MIN_COMPTE_PATIENT) {
      throw new ErreurApi(422, "patient_trop_jeune", "erreurs.patientTropJeune");
    }
  }

  const jeton = genererJeton();
  const expireLe = new Date(maintenant.getTime() + DUREES.invitationMs);
  await prisma.invitation.create({
    data: {
      cabinetId: patient.cabinetId,
      patientId: patient.id,
      email: donnees.email,
      role: donnees.role,
      jetonHash: empreinteJeton(jeton),
      expireLe,
      creeParId: utilisateur.id,
    },
  });

  const lien = `${lireConfig().appOrigin}/invitation#${jeton}`;
  const { envoye } = await expediteur().envoyerInvitation(donnees.email, lien);
  return { lien, expireLe, emailEnvoye: envoye };
}

/**
 * La personne invitée active son compte (ou relie son compte parent existant).
 * Le lien ne sert qu'une fois et expire. Tout lien invalide donne le même message.
 */
export async function accepterInvitation(
  prisma: PrismaClient,
  donnees: AcceptationInvitation,
  ip: string,
  maintenant = new Date(),
) {
  const cleIp = { type: "invitation:ip", valeur: ip, limite: LIMITES.invitationParIp };
  if (await limiteAtteinte(prisma, [cleIp], maintenant)) throw erreurs.tropDeTentatives();
  await enregistrerTentative(prisma, [cleIp], maintenant);

  const invitation = await prisma.invitation.findUnique({
    where: { jetonHash: empreinteJeton(donnees.jeton) },
    include: { patient: { select: { id: true, cabinetId: true, compteUserId: true } } },
  });
  if (
    !invitation ||
    invitation.utiliseeLe !== null ||
    invitation.expireLe <= maintenant ||
    invitation.patient.cabinetId !== invitation.cabinetId
  ) {
    throw erreurs.invitationInvalide();
  }

  const existant = await prisma.user.findUnique({ where: { email: invitation.email } });

  // Préparation hors transaction (hachage lent).
  let nouveauCompte: { motDePasseHash: string; prenom: string; nom: string } | null = null;
  if (existant) {
    // Seul cas accepté : un parent du même cabinet ajoute un enfant à son compte.
    const ok =
      existant.role === "PARENT" &&
      invitation.role === "PARENT" &&
      existant.cabinetId === invitation.cabinetId &&
      (await verifyPassword(donnees.motDePasse, existant.motDePasseHash));
    if (!ok) throw erreurs.invitationInvalide();
  } else {
    const motDePasse = nouveauMotDePasseSchema.safeParse(donnees.motDePasse);
    if (!motDePasse.success || !donnees.prenom || !donnees.nom) throw erreurs.donneesInvalides();
    nouveauCompte = {
      motDePasseHash: await hashPassword(motDePasse.data),
      prenom: donnees.prenom,
      nom: donnees.nom,
    };
  }

  return prisma.$transaction(async (tx) => {
    // Usage unique garanti même en cas de double clic simultané.
    const { count } = await tx.invitation.updateMany({
      where: { id: invitation.id, utiliseeLe: null, expireLe: { gt: maintenant } },
      data: { utiliseeLe: maintenant },
    });
    if (count !== 1) throw erreurs.invitationInvalide();

    const userId = existant
      ? existant.id
      : (
          await tx.user.create({
            data: {
              email: invitation.email,
              role: invitation.role,
              cabinetId: invitation.cabinetId,
              ...(nouveauCompte as NonNullable<typeof nouveauCompte>),
            },
          })
        ).id;

    if (invitation.role === "PARENT") {
      await tx.lienTuteur.upsert({
        where: { parentId_patientId: { parentId: userId, patientId: invitation.patientId } },
        create: { parentId: userId, patientId: invitation.patientId },
        update: {},
      });
    } else {
      const lie = await tx.patient.updateMany({
        where: { id: invitation.patientId, compteUserId: null },
        data: { compteUserId: userId },
      });
      if (lie.count !== 1) throw erreurs.invitationInvalide();
    }
    return { role: invitation.role };
  });
}
