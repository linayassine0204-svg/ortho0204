import { NextResponse } from "next/server";
import { getHealth } from "@/lib/health";

// Point de contrôle technique de l'API REST (aucune donnée de santé).
export function GET() {
  return NextResponse.json(getHealth());
}
