import { NextResponse } from "next/server";
import { accepterInvitationSchema } from "@app/shared";
import { accepterInvitation } from "@/lib/serveur/invitations";
import { adresseIp } from "@/lib/serveur/limiteur";
import { lireCorps, routePublique } from "@/lib/serveur/routes";

// Activation d'un compte invité. Publique : le jeton d'invitation fait office de preuve.
export const POST = routePublique(async ({ req, db }) => {
  const donnees = await lireCorps(req, accepterInvitationSchema);
  return NextResponse.json(await accepterInvitation(db, donnees, adresseIp(req.headers)), {
    status: 201,
  });
});
