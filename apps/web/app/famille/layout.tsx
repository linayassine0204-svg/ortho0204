import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@app/shared";
import { BoutonDeconnexion } from "@/components/BoutonDeconnexion";
import { familleConnectee } from "@/lib/serveur/session-page";

export default async function EspaceFamilleLayout({ children }: { children: ReactNode }) {
  await familleConnectee();
  return (
    <>
      <header className="entete">
        <nav aria-label="Menu principal">
          <Link href="/famille">{t("web.famille.menu")}</Link>
        </nav>
        <BoutonDeconnexion />
      </header>
      {children}
    </>
  );
}
