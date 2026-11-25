import type { Metadata } from "next";
import type { ReactNode } from "react";
import { t } from "@app/shared";
import "./globals.css";

export const metadata: Metadata = {
  title: t("app.nom"),
  description: t("app.description"),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
