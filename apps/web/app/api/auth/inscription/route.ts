import { NextResponse } from "next/server";
import { inscriptionSchema, t } from "@app/shared";
import { inscrire } from "@/lib/serveur/comptes";
import { adresseIp } from "@/lib/serveur/limiteur";
import { lireCorps, routePublique } from "@/lib/serveur/routes";

// Inscription d'un orthophoniste et création de son cabinet.
// Réponse identique que l'adresse soit libre ou déjà utilisée.
export const POST = routePublique(async ({ req, db }) => {
  const donnees = await lireCorps(req, inscriptionSchema);
  await inscrire(db, donnees, adresseIp(req.headers));
  return NextResponse.json({ message: t("web.inscription.succes") }, { status: 202 });
});
