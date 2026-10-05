import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { searchActions } from "./actions";
import { presenceModule } from "./boutique";
import { FINANCE_ACTIF, isFinanceView } from "./features";

/**
 * Finance MISE DE CÔTÉ et la barre latérale PAR INTENTION (décision d'Antonin,
 * 2026-10-01) — `FINANCE_ACTIF` dans `lib/features.ts`, `CATEGORIES` dans
 * `Sidebar.tsx`. Comme pour le trading, chaque règle se teste dans les DEUX
 * positions de l'interrupteur : rallumé, Finance doit revenir à l'identique.
 *
 * `Sidebar.tsx` est LU comme du texte (même méthode que `licence/catalogue.test.ts`) :
 * l'importer tirerait React, la base et Tauri dans un test pur.
 */

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("l'interrupteur lui-même", () => {
  it("est éteint : Finance n'est pas dans l'app commercialisée", () => {
    expect(FINANCE_ACTIF).toBe(false);
    expect(isFinanceView("finance")).toBe(true);
    expect(isFinanceView("tasks")).toBe(false);
  });
});

describe("presenceModule — Finance éteinte", () => {
  it("⭐ Finance est ABSENTE partout : ni cadenas, ni paywall, quels que soient le droit et la plateforme", () => {
    for (const commerce of [true, false])
      for (const droit of [true, false])
        for (const tradingActif of [true, false])
          expect(presenceModule("finance", droit, commerce, tradingActif, false)).toBe("absent");
  });

  it("les autres modules de productivité ne bougent pas", () => {
    for (const id of ["today", "tasks", "calendar", "timer", "goals", "performance", "notes", "journal", "knowledge"])
      expect(presenceModule(id, false, true, false, false)).toBe("ouvert");
  });

  it("rallumée, Finance est ouverte à tous, comme avant", () => {
    expect(presenceModule("finance", false, false, false, true)).toBe("ouvert");
    expect(presenceModule("finance", true, true, true, true)).toBe("ouvert");
  });
});

describe("la palette ⌘K — Finance éteinte", () => {
  it("aucune action de Finance n'apparaît, même en la cherchant par son nom", () => {
    for (const requete of ["", "finance", "runway", "trésorerie"])
      expect(searchActions(requete, true).some((a) => isFinanceView(a.module))).toBe(false);
  });
});

describe("la barre latérale par intention", () => {
  const src = lire("src/components/Sidebar.tsx");
  const bloc = /export const CATEGORIES[^=]*= \[([\s\S]*?)\n\];/.exec(src)?.[1] ?? "";
  const cats = [...bloc.matchAll(/id: "([a-z]+)",\s*label: "([^"]+)",\s*members: \[([^\]]*)\]/g)].map((m) => ({
    id: m[1],
    label: m[2],
    members: [...m[3].matchAll(/"([a-z]+)"/g)].map((x) => x[1]),
  }));

  it("⭐ les trois groupes du site, dans le même ordre, puis Tenir les comptes et Trading", () => {
    expect(cats.map((c) => c.id)).toEqual(["decider", "avancer", "penser", "comptes", "trading"]);
    expect(cats.map((c) => c.label).slice(0, 3)).toEqual(["Décider quoi faire", "Avancer et mesurer", "Penser et retenir"]);
  });

  it("chaque groupe porte exactement les modules que le site lui donne", () => {
    const par = Object.fromEntries(cats.map((c) => [c.id, c.members]));
    expect(par.decider).toEqual(["tasks", "calendar"]);
    expect(par.avancer).toEqual(["timer", "goals", "performance"]);
    expect(par.penser).toEqual(["notes", "journal", "knowledge"]);
    expect(par.comptes).toEqual(["finance"]);
  });

  it("« Productivité » n'est plus une catégorie ; chaque module a UNE catégorie", () => {
    expect(cats.some((c) => c.label === "Productivité")).toBe(false);
    const tous = cats.flatMap((c) => c.members);
    expect(new Set(tous).size).toBe(tous.length);
  });
});
