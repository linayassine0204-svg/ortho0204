import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t, type FilVue, type MessageVue } from "@app/shared";
import { Coquille, sectionsVisibles } from "@/components/Coquille";
import { MessageriePatient } from "@/components/fiche/MessageriePatient";
import { ReglagesCabinet } from "@/components/reglages/ReglagesCabinet";
import { EcranMessages } from "./EcranMessages";

vi.mock("next/navigation", () => ({
  usePathname: () => "/patients/p1/fiche",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

// Messagerie (web) : menu du dossier selon le réglage, fil, envoi (texte, réponse rapide,
// photo), réglages du cabinet et exception par patient. Données fictives, API simulée.

const M = "web.messages";
const message = (m: Partial<MessageVue>): MessageVue => ({
  id: "m1",
  deMoi: false,
  cote: "FAMILLE",
  auteur: "Julie",
  contenu: "Bonjour (fictif) ?",
  envoyeLe: "2026-11-27T09:00:00Z",
  luLe: null,
  piecesJointes: [],
  ...m,
});
const fil: FilVue & { interlocuteurs: string[] } = {
  horairesReponse: "Je réponds sous 48 h (fictif).",
  interlocuteurs: ["Julie Exemple"],
  messages: [
    message({}),
    message({
      id: "m2",
      deMoi: true,
      cote: "CABINET",
      auteur: "Alice",
      contenu: "",
      luLe: "2026-11-27T10:00:00Z",
      piecesJointes: [
        {
          id: "pj1",
          genre: "PHOTO",
          typeMime: "image/jpeg",
          tailleOctets: 10,
          dureeSecondes: null,
        },
        { id: "pj2", genre: "VOCAL", typeMime: "audio/mp4", tailleOctets: 10, dureeSecondes: 12 },
      ],
    }),
  ],
};

let appels: { url: string; methode: string; corps: unknown }[];
beforeEach(() => {
  appels = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const corps =
        init.body instanceof FormData
          ? Object.fromEntries(
              [...init.body.entries()].map(([k, v]) => [k, typeof v === "string" ? v : "fichier"]),
            )
          : init.body
            ? JSON.parse(String(init.body))
            : undefined;
      appels.push({ url, methode: init.method ?? "GET", corps });
      const donnees = url.endsWith("/messages")
        ? {
            message: message({
              id: "nouveau",
              deMoi: true,
              cote: "CABINET",
              contenu: String(corps?.contenu ?? ""),
            }),
          }
        : {};
      return new Response(JSON.stringify(donnees), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  vi.stubGlobal("location", { ...window.location, reload: vi.fn() });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("menu du dossier", () => {
  const patient = { id: "p1", prenom: "Léa", nom: "Exemple" };
  it("Messages disparaît quand la messagerie est désactivée", () => {
    expect(sectionsVisibles({ ...patient, messagerieActivee: true })).toContain("messagerie");
    expect(sectionsVisibles({ ...patient, messagerieActivee: false })).not.toContain("messagerie");
    render(<Coquille patient={{ ...patient, messagerieActivee: false }}>x</Coquille>);
    expect(screen.queryByRole("link", { name: t("web.sections.messagerie") })).toBeNull();
    expect(screen.getByRole("link", { name: t("web.menu.reglages") })).toBeTruthy();
  });
});

describe("<EcranMessages>", () => {
  it("affiche le fil, les horaires affichés aux familles et les pièces jointes", () => {
    render(<EcranMessages patientId="p1" initial={fil} reponses={[]} />);
    expect(
      screen.getByText(t(`${M}.horaires`, { texte: "Je réponds sous 48 h (fictif)." })),
    ).toBeTruthy();
    expect(screen.getByText(t(`${M}.avec`, { noms: "Julie Exemple" }))).toBeTruthy();
    const liste = screen.getByRole("list", { name: t(`${M}.titre`) });
    expect(within(liste).getByText("Bonjour (fictif) ?")).toBeTruthy();
    const photo = within(liste).getByRole("img", { name: t(`${M}.photoAlt`) });
    expect(photo.getAttribute("src")).toBe("/api/patients/p1/messagerie/pieces-jointes/pj1");
    expect(within(liste).getByText(t(`${M}.vocalDuree`, { secondes: 12 }))).toBeTruthy();
    expect(within(liste).getByText(t(`${M}.lu`))).toBeTruthy();
  });

  it("envoie un texte complété par une réponse rapide", async () => {
    render(
      <EcranMessages
        patientId="p1"
        initial={fil}
        reponses={[{ id: "r1", titre: "Absence", texte: "Merci de m'avoir prévenue." }]}
      />,
    );
    fireEvent.change(screen.getByLabelText(t(`${M}.reponseRapide`)), { target: { value: "r1" } });
    const zone = screen.getByLabelText(t(`${M}.ecrire`)) as HTMLTextAreaElement;
    expect(zone.value).toBe("Merci de m'avoir prévenue.");
    fireEvent.click(screen.getByRole("button", { name: t(`${M}.envoyer`) }));
    await waitFor(() =>
      expect(appels[0]).toMatchObject({
        url: "/api/patients/p1/messagerie/messages",
        methode: "POST",
        corps: { contenu: "Merci de m'avoir prévenue." },
      }),
    );
    await screen.findAllByText("Merci de m'avoir prévenue.");
    expect(zone.value).toBe("");
  });

  it("joint une photo : envoi en multipart vers notre serveur", async () => {
    render(<EcranMessages patientId="p1" initial={fil} reponses={[]} />);
    const entree = screen.getByLabelText(t(`${M}.photo`)) as HTMLInputElement;
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff])], "photo.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(entree, { target: { files: [photo] } });
    expect(screen.getByText(t(`${M}.photoJointe`, { nom: "photo.jpg" }))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t(`${M}.envoyer`) }));
    await waitFor(() =>
      expect(appels[0]).toMatchObject({
        url: "/api/patients/p1/messagerie/messages",
        corps: { contenu: "", fichier: "fichier" },
      }),
    );
  });
});

describe("réglages", () => {
  it("interrupteur de messagerie et horaires du cabinet", async () => {
    render(
      <ReglagesCabinet
        initial={{ messagerieActivee: true, horairesReponse: null }}
        reponsesInitiales={[]}
      />,
    );
    fireEvent.click(screen.getByLabelText(t("web.reglages.messagerieCase")));
    fireEvent.change(screen.getByLabelText(t("web.reglages.horaires")), {
      target: { value: "Sous 48 h (fictif)." },
    });
    fireEvent.click(screen.getByRole("button", { name: t("web.reglages.enregistrer") }));
    await waitFor(() =>
      expect(appels[0]).toMatchObject({
        url: "/api/cabinet/reglages",
        methode: "PUT",
        corps: { messagerieActivee: false, horairesReponse: "Sous 48 h (fictif)." },
      }),
    );
  });

  it("exception pour un patient : comme le cabinet, activée ou désactivée", async () => {
    render(<MessageriePatient patientId="p1" cabinet={true} initial={null} />);
    const choix = screen.getByLabelText(t("web.fiche.messagerie.titre")) as HTMLSelectElement;
    expect(choix.value).toBe("cabinet");
    expect(screen.getByText("Comme le cabinet (activée)")).toBeTruthy();
    fireEvent.change(choix, { target: { value: "non" } });
    await waitFor(() =>
      expect(appels[0]).toMatchObject({
        url: "/api/patients/p1/reglages/messagerie",
        methode: "PUT",
        corps: { messagerieActivee: false },
      }),
    );
  });
});
