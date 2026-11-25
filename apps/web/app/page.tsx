import { t } from "@app/shared";

export default function HomePage() {
  return (
    <main className="accueil">
      <h1>{t("web.accueil.titre")}</h1>
      <p>{t("web.accueil.sousTitre")}</p>
    </main>
  );
}
