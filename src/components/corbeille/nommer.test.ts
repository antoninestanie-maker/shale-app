/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { extraitDuCorps } from "../../lib/notesSansTitre";

/**
 * savoir-10 + constat 12 de l'audit du 2026-10-20 : la corbeille et le bandeau
 * de suppression appelaient « Nouvelle note » toute note sans titre. Trois
 * notes rapides jetées y étaient trois lignes identiques.
 */
const toasts: { msg: string }[] = [];
vi.mock("../../lib/toast", () => ({ afficherToast: (x: { msg: string }) => toasts.push(x) }));

type Repo = typeof import("../../lib/repo");
type Geste = typeof import("./geste");
let repo: Repo;
let geste: Geste;
beforeEach(async () => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  vi.resetModules();
  toasts.length = 0;
  repo = await import("../../lib/repo");
  geste = await import("./geste");
  (await import("../../lib/i18n")).setLangPref("fr");
});

describe("extraitDuCorps", () => {
  it("le texte, sans balises, entités décodées, blocs graphiques sautés", () => {
    expect(extraitDuCorps("<p>Appeler&nbsp;Louis &amp; Léa</p><figure><svg><text>nœud</text></svg></figure><p>demain</p>")).toBe(
      "Appeler Louis & Léa demain",
    );
  });
  it("un corps coupé au milieu d'une image ne montre pas sa base64", () => {
    expect(extraitDuCorps('<p>Photo</p><img src="data:image/png;base64,iVBORw0KGgo')).toBe("Photo");
  });
  it("rien de lisible : chaîne vide", () => {
    expect(extraitDuCorps("<p><br></p>")).toBe("");
  });
});

describe("le nom d'une note sans titre", () => {
  it("titreAffiche : le début du texte, pas « Nouvelle note »", () => {
    expect(geste.titreAffiche({ kind: "note", titre: "Nouvelle note", apercu: "<p>Rappeler Garnier</p>" })).toBe("Rappeler Garnier");
    expect(geste.titreAffiche({ kind: "note", titre: "New note", apercu: "" })).toBe("Sans titre");
    expect(geste.titreAffiche({ kind: "note", titre: "Plan", apercu: "<p>x</p>" })).toBe("Plan");
  });

  it("⭐ le bandeau et « Supprimés récemment » distinguent deux notes rapides", async () => {
    const a = await repo.createNote("Nouvelle note", "<p>Rappeler Garnier</p>");
    const b = await repo.createNote("Nouvelle note", "<p>Acheter du café</p>");
    await geste.jeterAvecSesCartes("note", a, "Nouvelle note", "<p>Rappeler Garnier</p>", () => undefined);
    expect(toasts[toasts.length - 1]?.msg).toContain("Rappeler Garnier");
    await geste.jeterAvecSesCartes("note", b, "Nouvelle note", null, () => undefined);
    const lignes = (await repo.lireCorbeille()).filter((e) => e.kind === "note" && (e.id === a || e.id === b));
    expect(lignes.map((e) => geste.titreAffiche(e)).sort()).toEqual(["Acheter du café", "Rappeler Garnier"]);
  });
});
