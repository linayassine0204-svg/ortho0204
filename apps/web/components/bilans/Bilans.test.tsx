import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { statutDocument, t, type SectionDocument } from "@app/shared";
import type { ListeBilans as Donnees, VueBilan } from "@/lib/serveur/bilans";
import { EditeurBilan } from "./EditeurBilan";
import { ListeBilans } from "./ListeBilans";

// Écrans Bilans : liste avec statuts, création depuis un modèle, éditeur (relecture,
// partage décoché par défaut, exports). Données fictives, API simulée.

const B = "web.bilans";

const partie = (s: Partial<SectionDocument>): SectionDocument => ({
  cle: "conclusion",
  titre: "Conclusion",
  type: "LIBRE",
  source: null,
  aide: "Exemple : synthèse.",
  contenu: "",
  relu: false,
  ...s,
});

function vue(sections: SectionDocument[], autres: Partial<VueBilan> = {}): VueBilan {
  return {
    id: "b1",
    titre: "Bilan d'évolution",
    type: "EVOLUTION",
    date: "2026-11-27",
    statut: statutDocument(sections),
    parties: { A_ECRIRE: 0, A_RELIRE: 0, AUTOMATIQUE: 0, REMPLI: 0 },
    total: sections.length,
    partage: false,
    partageLe: null,
    modifieLe: new Date("2026-11-27T10:00:00Z"),
    modele: "EVOLUTION",
    dateDebut: "2026-10-01",
    destinataire: null,
    seanceId: null,
    sections,
    ...autres,
  };
}

const seances = partie({
  cle: "seances",
  titre: "Séances",
  type: "AUTO",
  source: "SEANCES",
  aide: null,
  contenu: "4 séances, du 01/10/2026 au 20/11/2026.",
});

let appels: { url: string; methode: string; corps: unknown }[];
let reponse: (url: string, corps: Record<string, unknown> | undefined) => unknown;

beforeEach(() => {
  appels = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const corps = init.body ? JSON.parse(String(init.body)) : undefined;
      appels.push({ url, methode: init.method ?? "GET", corps });
      return new Response(JSON.stringify(reponse(url, corps)), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  vi.stubGlobal("confirm", () => true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<ListeBilans>", () => {
  const donnees: Donnees = {
    documents: [
      {
        ...vue([seances]),
        parties: { A_ECRIRE: 0, A_RELIRE: 0, AUTOMATIQUE: 1, REMPLI: 0 },
      },
      {
        ...vue([partie({ contenu: "x", relu: true })], {
          id: "b2",
          titre: "Bilan initial",
          type: "INITIAL",
          partage: true,
        }),
        parties: { A_ECRIRE: 0, A_RELIRE: 0, AUTOMATIQUE: 0, REMPLI: 1 },
      },
    ],
    pathologies: [{ slug: "langage-ecrit", nom: "Langage écrit" }],
    seances: [{ id: "s1", jour: "2026-11-20" }],
    familleConsentante: 1,
  };

  it("liste les documents avec leur statut et leur partage", () => {
    render(<ListeBilans patientId="p1" initial={donnees} naviguer={() => {}} />);
    const lignes = screen.getAllByRole("row").slice(1);
    expect(within(lignes[0] as HTMLElement).getByText(t(`${B}.statuts.AUTOMATIQUE`))).toBeTruthy();
    expect(within(lignes[0] as HTMLElement).getByText(t(`${B}.liste.nonPartage`))).toBeTruthy();
    expect(within(lignes[1] as HTMLElement).getByText(t(`${B}.statuts.REMPLI`))).toBeTruthy();
    expect(within(lignes[1] as HTMLElement).getByText(t(`${B}.liste.partage`))).toBeTruthy();
  });

  it("crée un bilan d'évolution depuis le modèle, puis ouvre l'éditeur", async () => {
    reponse = () => ({ bilan: vue([seances], { id: "nouveau" }) });
    const naviguer = vi.fn();
    render(<ListeBilans patientId="p1" initial={donnees} naviguer={naviguer} />);
    fireEvent.click(screen.getByRole("button", { name: t(`${B}.creer.bouton`) }));
    await waitFor(() => expect(naviguer).toHaveBeenCalledWith("/patients/p1/bilans/nouveau"));
    expect(appels[0]).toMatchObject({
      url: "/api/patients/p1/bilans",
      methode: "POST",
      corps: { type: "EVOLUTION", pathologie: "langage-ecrit", seanceId: null, destinataire: null },
    });
  });

  it("courrier : champ destinataire ; compte rendu : choix de la séance", async () => {
    reponse = () => ({ bilan: vue([], { id: "c" }) });
    render(<ListeBilans patientId="p1" initial={donnees} naviguer={() => {}} />);
    const type = screen.getByLabelText(t(`${B}.creer.type`));
    fireEvent.change(type, { target: { value: "COMPTE_RENDU_SEANCE" } });
    expect(screen.getByLabelText(t(`${B}.creer.seance`))).toBeTruthy();
    fireEvent.change(type, { target: { value: "COURRIER_MEDECIN" } });
    fireEvent.change(screen.getByLabelText(t(`${B}.creer.destinataire`)), {
      target: { value: "Dr Fictif" },
    });
    fireEvent.click(screen.getByRole("button", { name: t(`${B}.creer.bouton`) }));
    await waitFor(() =>
      expect(appels[0]?.corps).toMatchObject({
        type: "COURRIER_MEDECIN",
        destinataire: "Dr Fictif",
      }),
    );
  });
});

describe("<EditeurBilan>", () => {
  it("partie automatique à relire, partie à écrire ; case « partager » décochée et bloquée", () => {
    render(
      <EditeurBilan patientId="p1" initial={vue([seances, partie({})])} familleConsentante={1} />,
    );
    const auto = screen.getByRole("listitem", { name: "Séances" });
    expect(within(auto).getByText(t(`${B}.statuts.AUTOMATIQUE`))).toBeTruthy();
    expect(within(auto).getByRole("button", { name: t(`${B}.editeur.marquerRelu`) })).toBeTruthy();
    const libre = screen.getByRole("listitem", { name: "Conclusion" });
    expect(within(libre).getByText(t(`${B}.statuts.A_ECRIRE`))).toBeTruthy();
    expect(within(libre).getByPlaceholderText("Exemple : synthèse.")).toBeTruthy();

    const caseP = screen.getByLabelText(t(`${B}.partage.case`)) as HTMLInputElement;
    expect(caseP.checked).toBe(false);
    expect(caseP.disabled).toBe(true);
    expect(screen.getByText(t(`${B}.partage.pasRelu`))).toBeTruthy();
    expect(
      screen.getByRole("link", { name: t(`${B}.editeur.exporterPdf`) }).getAttribute("href"),
    ).toBe("/api/patients/p1/bilans/b1/pdf");
    expect(
      screen.getByRole("link", { name: t(`${B}.editeur.exporterWord`) }).getAttribute("href"),
    ).toBe("/api/patients/p1/bilans/b1/docx");
  });

  it("écrire une partie l'enregistre ; « Marquer comme relu » sur une partie automatique", async () => {
    const ecrit = partie({ contenu: "Conclusion fictive.", relu: true });
    reponse = (url) =>
      url.endsWith("/sections/conclusion")
        ? { bilan: vue([seances, ecrit]) }
        : { bilan: vue([{ ...seances, relu: true }, ecrit]) };
    render(
      <EditeurBilan patientId="p1" initial={vue([seances, partie({})])} familleConsentante={1} />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Conclusion" }), {
      target: { value: "Conclusion fictive." },
    });
    const libre = screen.getByRole("listitem", { name: "Conclusion" });
    fireEvent.click(within(libre).getByRole("button", { name: t(`${B}.editeur.enregistrer`) }));
    await waitFor(() =>
      expect(appels[0]).toMatchObject({
        url: "/api/patients/p1/bilans/b1/sections/conclusion",
        methode: "PATCH",
        corps: { contenu: "Conclusion fictive." },
      }),
    );

    const auto = screen.getByRole("listitem", { name: "Séances" });
    fireEvent.click(within(auto).getByRole("button", { name: t(`${B}.editeur.marquerRelu`) }));
    await waitFor(() => expect(appels[1]?.corps).toEqual({ relu: true }));
    // Tout est relu : statut « Rempli » et la case « partager » devient possible.
    await waitFor(() =>
      expect((screen.getByLabelText(t(`${B}.partage.case`)) as HTMLInputElement).disabled).toBe(
        false,
      ),
    );
  });

  it("partager quand tout est relu ; une modification retire le partage (message)", async () => {
    const relue = [{ ...seances, relu: true }, partie({ contenu: "Écrit.", relu: true })];
    reponse = (url, corps) =>
      url.endsWith("/partage")
        ? {
            bilan: vue(relue, {
              partage: Boolean(corps?.partage),
              partageLe: new Date("2026-11-27T10:00:00Z"),
            }),
          }
        : { bilan: vue(relue), partageRetire: true };
    render(<EditeurBilan patientId="p1" initial={vue(relue)} familleConsentante={0} />);
    expect(screen.getByText(t(`${B}.partage.personne`))).toBeTruthy();

    fireEvent.click(screen.getByLabelText(t(`${B}.partage.case`)));
    await waitFor(() =>
      expect(appels[0]).toMatchObject({ methode: "PUT", corps: { partage: true } }),
    );
    await screen.findByText(/Partagé le/);

    fireEvent.change(screen.getByRole("textbox", { name: "Conclusion" }), {
      target: { value: "Changé." },
    });
    const libre = screen.getByRole("listitem", { name: "Conclusion" });
    fireEvent.click(within(libre).getByRole("button", { name: t(`${B}.editeur.enregistrer`) }));
    await screen.findByText(t(`${B}.partage.retireAuto`));
  });
});
