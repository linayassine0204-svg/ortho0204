import { hashPassword, verifyPassword, type PrismaClient } from "@app/db";
import type { Connexion, Inscription } from "@app/shared";
import { LIMITES } from "./config";
import { erreurs } from "./erreurs";
import {
  effacerTentatives,
  enregistrerTentative,
  limiteAtteinte,
  type CleLimite,
} from "./limiteur";

/** Empreinte factice : on vérifie quand même un mot de passe si l'e-mail est inconnu
 * (même durée de réponse, pour ne pas révéler si l'e-mail existe). */
let empreinteFactice: Promise<string> | undefined;
function obtenirEmpreinteFactice(): Promise<string> {
  empreinteFactice ??= hashPassword("mot-de-passe-factice-pour-egaliser-le-temps");
  return empreinteFactice;
}

/** Inscription d'un orthophoniste : crée son cabinet et son compte. */
export async function inscrire(prisma: PrismaClient, donnees: Inscription, ip: string) {
  const cleIp = { type: "inscription:ip", valeur: ip, limite: LIMITES.inscriptionParIp };
  if (await limiteAtteinte(prisma, [cleIp])) throw erreurs.tropDeTentatives();
  await enregistrerTentative(prisma, [cleIp]);

  // Hachage fait dans tous les cas : même durée, que l'e-mail existe ou non.
  const motDePasseHash = await hashPassword(donnees.motDePasse);
  const existant = await prisma.user.findUnique({ where: { email: donnees.email } });
  if (existant) return; // Réponse identique : on ne révèle pas que l'adresse est prise.

  try {
    await prisma.$transaction(async (tx) => {
      const cabinet = await tx.cabinet.create({ data: { nom: donnees.nomCabinet } });
      await tx.user.create({
        data: {
          email: donnees.email,
          motDePasseHash,
          role: "ORTHO",
          prenom: donnees.prenom,
          nom: donnees.nom,
          cabinetId: cabinet.id,
        },
      });
    });
  } catch (erreur) {
    // Inscription simultanée avec le même e-mail : même réponse silencieuse.
    if (estViolationUnicite(erreur)) return;
    throw erreur;
  }
}

function estViolationUnicite(erreur: unknown): boolean {
  return (
    typeof erreur === "object" &&
    erreur !== null &&
    "code" in erreur &&
    (erreur as { code: unknown }).code === "P2002"
  );
}

/**
 * Vérifie e-mail et mot de passe, avec limitation des essais.
 * Tous les rôles peuvent se connecter au web et au mobile ; ce que chacun voit
 * est décidé ensuite par `can()`. Tout échec renvoie le même message.
 */
export async function verifierIdentifiants(prisma: PrismaClient, donnees: Connexion, ip: string) {
  const cles: CleLimite[] = [
    { type: "connexion:email", valeur: donnees.email, limite: LIMITES.connexionParEmail },
    { type: "connexion:ip", valeur: ip, limite: LIMITES.connexionParIp },
  ];
  if (await limiteAtteinte(prisma, cles)) throw erreurs.tropDeTentatives();

  const user = await prisma.user.findUnique({ where: { email: donnees.email } });
  const motDePasseOk = await verifyPassword(
    donnees.motDePasse,
    user?.motDePasseHash ?? (await obtenirEmpreinteFactice()),
  );

  if (!user || !motDePasseOk) {
    await enregistrerTentative(prisma, cles);
    throw erreurs.identifiantsIncorrects();
  }
  await effacerTentatives(prisma, cles[0] as CleLimite);
  return user;
}
