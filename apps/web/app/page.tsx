import Link from "next/link";
import { t } from "@app/shared";

export default function HomePage() {
  return (
    <main className="accueil">
      <h1>{t("web.accueil.titre")}</h1>
      <p>{t("web.accueil.sousTitre")}</p>
      <p className="actions">
        <Link className="bouton" href="/connexion">
          {t("web.accueil.seConnecter")}
        </Link>
        <Link href="/inscription">{t("web.accueil.creerCompte")}</Link>
      </p>
    </main>
  );
}
