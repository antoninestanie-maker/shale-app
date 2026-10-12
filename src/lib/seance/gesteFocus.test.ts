import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { creerGesteFocus } from "./gesteFocus";
import type { ActiveFocus } from "../useFocus";

const toast = vi.hoisted(() => ({ afficherToast: vi.fn() }));
vi.mock("../toast", () => toast);

const tache = { id: 7, label: "Écrire le plan" };
const seance = (p: Partial<ActiveFocus>): ActiveFocus => ({
  id: 1,
  label: "Écrire le plan",
  taskId: 7,
  plannedMin: 25,
  startedAtMs: 0,
  kind: "focus",
  ...p,
});

function minuteur(session: ActiveFocus | null, paused = false) {
  return { session, paused, start: vi.fn(async () => {}), resume: vi.fn() };
}

beforeEach(() => toast.afficherToast.mockClear());

describe("⭐ le geste « Focus » d'une tâche — une fonction pour toute l'app (règle 18)", () => {
  it("au repos : lance 25 minutes sur la tâche, SANS demander le plein écran", async () => {
    const m = minuteur(null);
    const regle = await creerGesteFocus(m).agir(tache, false);
    expect(regle).toEqual({ quoi: "lancer" });
    expect(m.start).toHaveBeenCalledTimes(1);
    const options = m.start.mock.calls[0][0 as never] as Record<string, unknown>;
    expect(options).toEqual({ minutes: 25, taskId: 7, label: "Écrire le plan" });
    expect(options).not.toHaveProperty("openOverlay");
  });

  it("pendant une pause : lance quand même (c'est `start` qui clôt la pause)", async () => {
    const m = minuteur(seance({ kind: "break", taskId: null, label: "Pause" }));
    expect(await creerGesteFocus(m).agir(tache, false)).toEqual({ quoi: "lancer-sur-pause" });
    expect(m.start).toHaveBeenCalledTimes(1);
  });

  it("la séance de cette tâche est en pause : reprend, ne relance pas", async () => {
    const m = minuteur(seance({}), true);
    expect(await creerGesteFocus(m).agir(tache, false)).toEqual({ quoi: "reprendre" });
    expect(m.resume).toHaveBeenCalledTimes(1);
    expect(m.start).not.toHaveBeenCalled();
  });

  it("une séance tourne ailleurs, ou la tâche est faite : ne touche à rien", async () => {
    const ailleurs = minuteur(seance({ taskId: 3, label: "Relire" }));
    expect(await creerGesteFocus(ailleurs).agir(tache, false)).toMatchObject({ quoi: "rien", pourquoi: "ailleurs" });
    const faite = minuteur(null);
    expect(await creerGesteFocus(faite).agir(tache, true)).toMatchObject({ quoi: "rien", pourquoi: "faite" });
    for (const m of [ailleurs, faite]) {
      expect(m.start).not.toHaveBeenCalled();
      expect(m.resume).not.toHaveBeenCalled();
    }
  });

  it("une séance libre (la palette) porte l'intitulé tapé, ou « Focus »", async () => {
    const m = minuteur(null);
    await creerGesteFocus(m).agir(null, false, "  Lecture  ");
    await creerGesteFocus(m).agir(null, false, "");
    expect(m.start.mock.calls.map((c) => c[0 as never])).toEqual([
      { minutes: 25, taskId: null, label: "Lecture" },
      { minutes: 25, taskId: null, label: "Focus" },
    ]);
  });

  it("un démarrage qui échoue le DIT, et rend null", async () => {
    const m = minuteur(null);
    m.start.mockRejectedValueOnce(new Error("base verrouillée"));
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await creerGesteFocus(m).agir(tache, false)).toBeNull();
    expect(toast.afficherToast).toHaveBeenCalledTimes(1);
    erreur.mockRestore();
  });
});

// ─── Tests de SOURCE : ce qu'aucun test de comportement ne peut tenir ─────────

const SRC = resolve(__dirname, "../..");
const lire = (chemin: string) => readFileSync(resolve(SRC, chemin), "utf-8");
const sansCommentaires = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

describe("partout où un menu de tâche existe, l'entrée Focus est là", () => {
  it("tout fichier qui construit un menu de tâche lui passe le geste du minuteur", () => {
    const sans = fichiers(SRC)
      .filter((f) => !f.endsWith("catalogue/tache.tsx"))
      .filter((f) => /\bentreesTache\(/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .filter((f) => !/useGesteFocus\(\)/.test(readFileSync(f, "utf-8")))
      .map((f) => f.slice(SRC.length + 1));
    expect(sans).toEqual([]);
  });

  it("aucune vue ne lance plus le minuteur à la main avec un taskId : elles passent par le geste", () => {
    // Le défaut d'origine : `focus && !focus.session ? (task) => focus.start(…) : undefined`,
    // recopié dans chaque vue, chacune avec ses oublis.
    const coupables = fichiers(SRC)
      .filter((f) => !f.endsWith("lib/seance/gesteFocus.ts") && !f.endsWith("lib/useFocus.ts"))
      .filter((f) => /focus\.start\(\{[^}]*taskId:\s*task\.id/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(SRC.length + 1));
    expect(coupables).toEqual([]);
  });
});

describe("le plein écran ne s'ouvre que par un geste qui porte ce nom", () => {
  it("la pastille n'ouvre pas le plein écran au clic : elle ouvre la page Timer", () => {
    const pastille = sansCommentaires(lire("components/timer/PastilleSeance.tsx"));
    expect(pastille).toMatch(/onClick=\{gestes\.ouvrirTimer\}/);
    expect(pastille).toMatch(/ouvrirTimer:\s*\(\)\s*=>\s*allerVers\("timer"\)/);
    // Le seul `setOverlayOpen(true)` de la pastille est le geste « plein écran » du menu.
    expect(pastille.match(/setOverlayOpen\(true\)/g)).toHaveLength(1);
    expect(pastille).toMatch(/pleinEcran:\s*\(\)\s*=>\s*setOverlayOpen\(true\)/);
  });

  it("aucun appelant ne demande le plein écran en lançant une séance", () => {
    const demandeurs = fichiers(SRC)
      .filter((f) => /openOverlay:\s*true/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => f.slice(SRC.length + 1));
    expect(demandeurs).toEqual([]);
  });

  it("chaque bouton qui l'ouvre porte le nom « Plein écran »", () => {
    for (const chemin of ["components/TimerCard.tsx", "components/TimerPanel.tsx", "views/TimerView.tsx"]) {
      const code = sansCommentaires(lire(chemin));
      const boutons = code.split("<button").filter((b) => /setOverlayOpen\(true\)/.test(b.split("</button>")[0]));
      expect(boutons.length, chemin).toBeGreaterThan(0);
      for (const b of boutons) expect(b.split("</button>")[0], chemin).toContain('t("Plein écran")');
    }
  });
});
