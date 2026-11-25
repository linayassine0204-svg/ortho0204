import { NextResponse } from "next/server";
import { invitationSchema } from "@app/shared";
import { creerInvitation } from "@/lib/serveur/invitations";
import { lireCorps, param, routeProtegee } from "@/lib/serveur/routes";

// L'orthophoniste invite un parent ou le patient (lien à usage unique, durée limitée).
export const POST = routeProtegee(async ({ req, db, utilisateur, params }) => {
  const donnees = await lireCorps(req, invitationSchema);
  const invitation = await creerInvitation(db, utilisateur, param(params, "id"), donnees);
  return NextResponse.json(invitation, { status: 201 });
});
