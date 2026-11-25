"use client";

import { useRouter } from "next/navigation";
import { t } from "@app/shared";
import { envoyerJson } from "@/lib/client/api";

export function BoutonDeconnexion() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="bouton-secondaire"
      onClick={async () => {
        await envoyerJson("/api/auth/deconnexion");
        router.push("/connexion");
      }}
    >
      {t("web.menu.deconnexion")}
    </button>
  );
}
