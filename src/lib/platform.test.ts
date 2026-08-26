import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Étape Windows — libellés de raccourcis par plateforme.
 *
 * `IS_MAC` est figé À L'IMPORT du module (le système ne change pas en cours de
 * session, et les libellés sont lus dans du JSX au premier rendu). Un test qui
 * veut l'autre plateforme doit donc poser le user-agent PUIS réimporter — d'où
 * `vi.resetModules()` et l'import dynamique plutôt qu'un import statique en
 * tête de fichier.
 */
async function chargerAvecUA(userAgent: string, langue = "fr-FR") {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent, languages: [langue], language: langue });
  return await import("./platform");
}

const UA_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const UA_WIN =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("détection de plateforme", () => {
  it("reconnaît macOS et Windows", async () => {
    expect((await chargerAvecUA(UA_MAC)).IS_MAC).toBe(true);
    expect((await chargerAvecUA(UA_WIN)).IS_MAC).toBe(false);
  });

  it("retombe sur macOS pour un user-agent inconnu", async () => {
    // Choix assumé : l'inconnu garde le comportement d'avant ce module plutôt
    // que d'infliger des libellés Windows à une plateforme non supportée.
    expect((await chargerAvecUA("Mozilla/5.0 (X11; Linux x86_64)")).IS_MAC).toBe(true);
  });
});

describe("kbd()", () => {
  it("laisse macOS STRICTEMENT inchangé", async () => {
    // La contrainte non négociable du portage : aucun changement visible côté Mac.
    const { kbd } = await chargerAvecUA(UA_MAC);
    for (const s of ["⌘", "⌘B", "⌘ K", "⌘⇧ N", "⌘⇧N", "⌥ Espace", "⌘V", "⌘Z"]) {
      expect(kbd(s)).toBe(s);
    }
  });

  it("traduit les glyphes en noms de touches sur Windows", async () => {
    const { kbd } = await chargerAvecUA(UA_WIN);
    expect(kbd("⌘")).toBe("Ctrl");
    expect(kbd("⌘B")).toBe("Ctrl+B");
    expect(kbd("⌘ K")).toBe("Ctrl+K"); // l'espace de mise en forme disparaît
    expect(kbd("⌘⇧ N")).toBe("Ctrl+Maj+N");
    expect(kbd("⌘⇧N")).toBe("Ctrl+Maj+N"); // avec ou sans espace : même sortie
    expect(kbd("⌥ Espace")).toBe("Alt+Espace");
  });

  it("dédoublonne les modificateurs qui retombent sur la même touche", async () => {
    // ⌃ et ⌘ donnent tous deux Ctrl : sans dédoublonnage on lirait « Ctrl+Ctrl+A ».
    const { kbd } = await chargerAvecUA(UA_WIN);
    expect(kbd("⌃⌘A")).toBe("Ctrl+A");
  });

  it("suit la langue de l'app pour la touche Maj / Shift", async () => {
    // Un Windows anglophone a « Shift » sérigraphié sur la touche, pas « Maj ».
    // Seul ⇧ est concerné : Ctrl et Alt s'écrivent pareil dans les deux langues.
    expect((await chargerAvecUA(UA_WIN, "en-US")).kbd("⌘⇧N")).toBe("Ctrl+Shift+N");
    expect((await chargerAvecUA(UA_WIN, "fr-FR")).kbd("⌘⇧N")).toBe("Ctrl+Maj+N");
  });

  it("n'invente rien quand il n'y a pas de modificateur", async () => {
    const { kbd } = await chargerAvecUA(UA_WIN);
    expect(kbd("Échap")).toBe("Échap");
  });
});

describe("raccourci de capture rapide", () => {
  it("diffère RÉELLEMENT entre les deux plateformes", async () => {
    // Ce n'est pas une traduction : Alt+Espace est pris par le menu système de
    // Windows, donc le Rust enregistre un autre raccourci (`CAPTURE_SHORTCUT`
    // dans `src-tauri/src/lib.rs`). Les deux constantes doivent rester alignées.
    expect((await chargerAvecUA(UA_MAC)).CAPTURE_SHORTCUT).toBe("⌥ Espace");
    expect((await chargerAvecUA(UA_WIN)).CAPTURE_SHORTCUT).toBe("Ctrl+Alt+Espace");
  });
});
