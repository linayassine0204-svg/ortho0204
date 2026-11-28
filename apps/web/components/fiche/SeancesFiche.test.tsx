import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "@app/shared";
import type { SeancePassee } from "@/lib/serveur/seances";
import { SeancesFiche } from "./SeancesFiche";

// Zone « Séances » de la Fiche : séances passées, lecture, export PDF et « Réutiliser ».
// Données fictives, API simulée.

const S = "web.fiche.seances";

const seances: SeancePassee[] = [
  {
    id: "s2",
    date: new Date("2026-11-20T09:00:00Z"),
    objectifs: "Objectifs fictifs.",
    notes: "Notes fictives récentes.",
    pointsAReprendre: "Point fictif.",
    materielEnPlus: "Sablier",
    exercices: [{ titre: "Rimes", niveau: 2, consigne: "Rimes — 2", dureeMinutes: 10 }],
    materiel: [{ nom: "Cartes images", exercices: ["Rimes"] }],
  },
  {
    id: "s1",
    date: new Date("2026-11-06T09:00:00Z"),
    objectifs: null,
    notes: null,
    pointsAReprendre: null,
    materielEnPlus: null,
    exercices: [],
    materiel: [],
  },
];

let appels: { url: string; methode: string }[];
beforeEach(() => {
  appels = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      appels.push({ url, methode: init.method ?? "GET" });
      return new Response(JSON.stringify({ seanceId: "prep" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<SeancesFiche>", () => {
  it("liste les séances passées (date, exercices, notes), la plus récente d'abord", () => {
    render(<SeancesFiche patientId="p1" seances={seances} naviguer={() => {}} />);
    const items = within(screen.getByRole("list", { name: t(`${S}.titre`) })).getAllByRole(
      "listitem",
    );
    const titres = items
      .map((li) => li.querySelector("summary strong")?.textContent)
      .filter(Boolean);
    expect(titres).toEqual(["Séance du 20/11/2026", "Séance du 06/11/2026"]);
    expect(within(items[0] as HTMLElement).getAllByText("Rimes (niv. 2)").length).toBeGreaterThan(
      0,
    );
    expect(
      within(items[0] as HTMLElement).getAllByText("Notes fictives récentes.").length,
    ).toBeGreaterThan(0);
  });

  it("une séance s'ouvre en lecture : notes, matériel et export PDF", () => {
    render(<SeancesFiche patientId="p1" seances={seances} naviguer={() => {}} />);
    const resume = screen.getByText("Séance du 20/11/2026");
    fireEvent.click(resume);
    const details = resume.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(within(details).getByText("Point fictif.")).toBeTruthy();
    expect(within(details).getByText("Cartes images")).toBeTruthy();
    expect(within(details).getByText("Sablier")).toBeTruthy();
    expect(
      within(details)
        .getByRole("link", { name: t(`${S}.pdf`) })
        .getAttribute("href"),
    ).toBe("/api/patients/p1/seances/s2/pdf");
  });

  it("« Réutiliser cette séance » pré-remplit la préparation puis ouvre Préparation", async () => {
    const naviguer = vi.fn();
    render(<SeancesFiche patientId="p1" seances={seances} naviguer={naviguer} />);
    fireEvent.click(
      screen.getByRole("button", { name: `${t(`${S}.reutiliser`)} : Séance du 20/11/2026` }),
    );
    await waitFor(() => expect(naviguer).toHaveBeenCalledWith("/patients/p1/preparation"));
    expect(appels).toEqual([{ url: "/api/patients/p1/seances/s2/reutiliser", methode: "POST" }]);
  });

  it("aucune séance : message", () => {
    render(<SeancesFiche patientId="p1" seances={[]} naviguer={() => {}} />);
    expect(screen.getByText(t(`${S}.aucune`))).toBeTruthy();
  });
});
