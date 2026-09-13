// La résolution et les garde-fous de la phase E du cadrage.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { AUTRE_COMPTE, COMPTE, JOUR, MAINTENANT, banc } from "./licence.testutil";
import {
  appliquerAuxModules,
  libelleProfil,
  moduleVisible,
  resoudreProfil,
  TOLERANCE_EMISSION_MS,
  type EntreeResolution,
} from "./resoudre";
import { signatureValide, type LigneProfil } from "./signature";

async function resoudre(ligne: LigneProfil | null, cles: Parameters<typeof signatureValide>[1], e: Partial<EntreeResolution> = {}) {
  const signatureOk = ligne ? await signatureValide(ligne, cles) : false;
  return resoudreProfil({
    ligne,
    signatureOk,
    userId: COMPTE,
    tier: "shale_trade",
    maintenant: MAINTENANT,
    ...e,
  });
}

const LIBELLES: Record<string, string> = {
  today: "Aujourd'hui",
  tasks: "Tâches",
  notes: "Notes",
  knowledge: "Savoir",
  trading: "Trading",
  market: "Market-Brain",
};
const MODULES: { id: string; visible: boolean; label?: string }[] = [
  "today",
  "tasks",
  "notes",
  "knowledge",
  "trading",
  "market",
].map((id) => ({ id, visible: true }));

describe("resoudreProfil — la dégradation silencieuse", () => {
  it("profil absent → inactif", async () => {
    const p = await resoudre(null, []);
    expect(p).toMatchObject({ actif: false, motif: "absent" });
    expect(p.masques.size).toBe(0);
  });

  it("profil valide → actif, avec masques, ordre, libellés et marque", async () => {
    const b = await banc();
    const p = await resoudre(await b.signer(), [b.cle]);
    expect(p.actif).toBe(true);
    expect([...p.masques].sort()).toEqual(["market", "trading"]);
    expect(p.ordre).toEqual(["notes", "tasks"]);
    expect(p.nomAffiche).toBe("Atelier Conseil");
  });

  it("expiré → inactif, sans aucune tolérance", async () => {
    const b = await banc();
    const juste = await b.signer({ expires_at: new Date(MAINTENANT).toISOString() });
    expect((await resoudre(juste, [b.cle])).motif).toBe("expire");
    const hier = await b.signer({ expires_at: new Date(MAINTENANT - JOUR).toISOString() });
    expect((await resoudre(hier, [b.cle])).motif).toBe("expire");
  });

  it("émis dans le futur au-delà de la tolérance → inactif ; en deçà → actif", async () => {
    const b = await banc();
    const loin = await b.signer({ issued_at: new Date(MAINTENANT + JOUR).toISOString() });
    expect((await resoudre(loin, [b.cle])).motif).toBe("pas-encore-valide");
    const proche = await b.signer({
      issued_at: new Date(MAINTENANT + TOLERANCE_EMISSION_MS - 1000).toISOString(),
    });
    expect((await resoudre(proche, [b.cle])).actif).toBe(true);
  });

  it("signature invalide → inactif, et le contenu n'est même pas lu", async () => {
    const b = await banc();
    const l = await b.signer();
    const altere = { ...l, payload: "{ ceci n'est pas du JSON" };
    // `signature` et non `illisible` : on n'interprète pas un contenu non signé.
    expect((await resoudre(altere, [b.cle])).motif).toBe("signature");
  });

  it("JSON malformé, même bien signé → inactif", async () => {
    const b = await banc();
    const l = await b.signer({ payload: "{ modules: [" });
    expect((await resoudre(l, [b.cle])).motif).toBe("illisible");
    const date = await b.signer({ expires_at: "demain" });
    expect((await resoudre(date, [b.cle])).motif).toBe("illisible");
  });

  it("profil d'un autre compte → inactif ; sans compte → inactif", async () => {
    const b = await banc();
    const l = await b.signer({ uid: AUTRE_COMPTE });
    expect((await resoudre(l, [b.cle])).motif).toBe("autre-compte");
    expect((await resoudre(await b.signer(), [b.cle], { userId: null })).motif).toBe("autre-compte");
  });

  it("profil émis pour un autre palier → inactif (le palier fait foi)", async () => {
    const b = await banc();
    const l = await b.signer({ tier: "shale_trade" });
    expect((await resoudre(l, [b.cle], { tier: "shale" })).motif).toBe("autre-palier");
  });

  it("le profil ne rend AUCUN droit : rien à écraser dans le palier", async () => {
    const b = await banc();
    const p = await resoudre(
      await b.signer({ payload: JSON.stringify({ modules: { visible: ["trading", "market", "sizing"] }, tier: "shale_trade", hasTrading: true }) }),
      [b.cle],
    );
    expect(p.actif).toBe(true);
    for (const cle of ["tier", "hasTrading", "isTrialing", "billingPeriod"])
      expect(Object.keys(p)).not.toContain(cle);
  });

  it("une liste blanche masque le reste, sauf l'accueil", async () => {
    const b = await banc();
    const p = await resoudre(
      await b.signer({ payload: JSON.stringify({ modules: { visible: ["notes", "tasks"] } }) }),
      [b.cle],
    );
    expect(moduleVisible(p, "notes")).toBe(true);
    expect(moduleVisible(p, "today")).toBe(true);
    expect(moduleVisible(p, "finance")).toBe(false);
    // Ce qui n'est pas un module n'est jamais masqué.
    expect(moduleVisible(p, "settings")).toBe(true);
  });
});

describe("application à l'écran", () => {
  it("clé i18n inconnue ou libellé absent : l'appelant garde le sien", async () => {
    const b = await banc();
    const p = await resoudre(
      await b.signer({ payload: JSON.stringify({ labels: { "Nouvelle tâche": "X", "Tâches": "Missions" } }) }),
      [b.cle],
    );
    expect(libelleProfil(p, "Nouvelle tâche", "fr")).toBeNull();
    expect(libelleProfil(p, "Notes", "fr")).toBeNull();
    expect(libelleProfil(p, "Tâches", "fr")).toBe("Missions");
    expect(libelleProfil(p, "Tâches", "en")).toBe("Missions");
  });

  it("un libellé à une seule langue ne s'impose que dans cette langue", async () => {
    const b = await banc();
    const p = await resoudre(
      await b.signer({ payload: JSON.stringify({ labels: { "Tâches": { fr: "Missions" } } }) }),
      [b.cle],
    );
    expect(libelleProfil(p, "Tâches", "fr")).toBe("Missions");
    expect(libelleProfil(p, "Tâches", "en")).toBeNull();
  });

  it("appliquerAuxModules : retire, place l'ordre imposé en tête, renomme", async () => {
    const b = await banc();
    const p = await resoudre(await b.signer(), [b.cle]);
    const r = appliquerAuxModules(
      MODULES.map((m) => (m.id === "knowledge" ? { ...m, label: "Mon savoir" } : m)),
      p,
      "en",
      (id) => LIBELLES[id],
    );
    expect(r.map((m) => m.id)).toEqual(["notes", "tasks", "today", "knowledge"]);
    expect(r.find((m) => m.id === "tasks")!.label).toBe("Missions");
    // Le libellé imposé remplace celui de l'utilisateur, dans la langue affichée.
    expect(r.find((m) => m.id === "knowledge")!.label).toBe("Knowledge base");
    // Un module sans libellé imposé garde exactement son état.
    expect(r.find((m) => m.id === "today")).toEqual({ id: "today", visible: true });
  });

  it("profil inactif : la liste ressort identique", async () => {
    const p = await resoudre(null, []);
    expect(appliquerAuxModules(MODULES, p, "fr", (id) => LIBELLES[id])).toEqual(MODULES);
  });

  it("module masqué alors qu'il est la vue active : la garde retombe sur l'accueil", async () => {
    // Reproduit le filet de `App.tsx` : `if (!moduleVisible(profil, view)) setView("today")`.
    const b = await banc();
    let vue = "trading";
    const avant = await resoudre(null, []);
    if (!moduleVisible(avant, vue)) vue = "today";
    expect(vue).toBe("trading");
    const apres = await resoudre(await b.signer(), [b.cle]);
    if (!moduleVisible(apres, vue)) vue = "today";
    expect(vue).toBe("today");
    // Et l'accueil, lui, ne peut jamais être retiré à son tour.
    expect(moduleVisible(apres, vue)).toBe(true);
  });
});

describe("concordance avec App.tsx — les gardes rejouées ci-dessus existent vraiment", () => {
  const app = readFileSync(resolve(__dirname, "../../App.tsx"), "utf-8");
  it("la navigation refuse un module masqué, et le filet retombe sur l'accueil", () => {
    expect(app).toContain("if (!moduleVisible(profil, v)) return;");
    expect(app).toContain('if (!moduleVisible(profil, view)) setView("today");');
  });
  it("Personnaliser reçoit la configuration BRUTE, la barre la configuration bornée", () => {
    expect(app).toContain("<AdminView config={ui.config}");
    expect(app.match(/config=\{configAffichee\}/g)).toHaveLength(2);
  });
});
