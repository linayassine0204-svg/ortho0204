import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@app/shared";
import { BoutonDeconnexion } from "@/components/BoutonDeconnexion";
import { orthoConnecte } from "@/lib/serveur/session-page";

export default async function EspaceOrthoLayout({ children }: { children: ReactNode }) {
  await orthoConnecte();
  return (
    <>
      <header className="entete">
        <nav aria-label="Menu principal">
          <Link href="/patients">{t("web.menu.patients")}</Link>
        </nav>
        <BoutonDeconnexion />
      </header>
      {children}
    </>
  );
}
