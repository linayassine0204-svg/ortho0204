import { describe, expect, it } from "vitest";
import { programmeLea, VENDREDI } from "../../test/fixtures";
import { etatDuJour, fileEnfant } from "./programme";

describe("ce qui reste à faire aujourd'hui", () => {
  it("rien de fait : exercice du jour + exercice à placer (2 fois restantes)", () => {
    const etat = etatDuJour(programmeLea, [], VENDREDI);
    expect(etat.duJour.map((x) => [x.element.elementId, x.faitAujourdhui])).toEqual([
      ["el-rimes", false],
    ]);
    expect(etat.dansLaSemaine[0]).toMatchObject({ faitAujourdhui: false, restantSemaine: 2 });
    expect(fileEnfant(etat).map((e) => e.elementId)).toEqual(["el-rimes", "el-libre"]);
  });

  it("fait aujourd'hui : marqué fait, et retiré de la file du mode enfant", () => {
    const etat = etatDuJour(
      programmeLea,
      [{ elementId: "el-rimes", date: "2026-11-27" }],
      VENDREDI,
    );
    expect(etat.duJour[0]?.faitAujourdhui).toBe(true);
    expect(fileEnfant(etat).map((e) => e.elementId)).toEqual(["el-libre"]);
  });

  it("exercice à placer déjà fait 2 fois cette semaine : terminé pour la semaine", () => {
    const faits = [
      { elementId: "el-libre", date: "2026-11-23" },
      { elementId: "el-libre", date: "2026-11-25" },
      // Semaine précédente : ne compte pas.
      { elementId: "el-libre", date: "2026-11-20" },
    ];
    const etat = etatDuJour(programmeLea, faits, VENDREDI);
    expect(etat.dansLaSemaine[0]?.restantSemaine).toBe(0);
    expect(fileEnfant(etat).map((e) => e.elementId)).toEqual(["el-rimes"]);
  });
});
