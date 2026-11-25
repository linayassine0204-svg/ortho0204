import { NextResponse } from "next/server";
import { getHealth } from "@/lib/health";
import { routePublique } from "@/lib/serveur/routes";

// Point de contrôle technique de l'API REST (aucune donnée de santé).
export const GET = routePublique(async () => NextResponse.json(getHealth()));
