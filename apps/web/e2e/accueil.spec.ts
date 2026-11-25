import { expect, test } from "@playwright/test";
import { t } from "@app/shared";

test("la page d'accueil affiche les textes du fichier de traduction", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(t("app.nom"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t("web.accueil.titre"));
  await expect(page.getByText(t("web.accueil.sousTitre"))).toBeVisible();
});

test("l'API répond sur /api/health", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});
