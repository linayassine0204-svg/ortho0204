"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Lien du menu de gauche, marqué « page actuelle » quand on y est. */
export function LienMenu({
  href,
  children,
  prefixe = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  /** Actif aussi sur les sous-pages (ex. /patients/… pour « Patients »). */
  prefixe?: boolean;
  className?: string;
}) {
  const chemin = usePathname();
  const actif = prefixe ? chemin === href || chemin.startsWith(`${href}/`) : chemin === href;
  return (
    <Link
      href={href}
      className={`lien-menu ${actif ? "actif" : ""} ${className}`}
      aria-current={actif ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
