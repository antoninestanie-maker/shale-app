import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { settingExclu } from "../sync/scope";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const lire = (p: string) => readFileSync(resolve(RACINE, p), "utf-8");

describe("réglage « Animation d'entrée »", () => {
  it("se synchronise, comme le thème", () => {
    // `scope.ts` a une posture INVERSÉE : tout part sauf ce qui décrit la
    // machine. Le choix d'animation décrit l'utilisateur, pas son écran — il
    // doit suivre d'un appareil à l'autre. Ce test tombe si quelqu'un ajoute
    // un jour un motif `ui.` à la liste des exclusions.
    expect(settingExclu("ui.entryAnimation")).toBe(false);
    expect(settingExclu("ui.theme")).toBe(false);
    // Le contre-exemple, pour que le test prouve quelque chose.
    expect(settingExclu("ui.config")).toBe(true);
  });

  it("les trois choix de l'écran sont exactement ceux du type", () => {
    const type = lire("src/lib/entree/reglage.ts");
    const ecran = lire("src/views/SettingsView.tsx");
    const m = /export type AnimationEntree =([^;]+);/.exec(type);
    expect(m).not.toBeNull();
    const valeurs = [...m![1].matchAll(/"(\w+)"/g)].map((x) => x[1]);
    expect(valeurs).toEqual(["complete", "courte", "aucune"]);
    for (const v of valeurs) expect(ecran, `« ${v} » absent des Réglages`).toContain(`id: "${v}"`);
  });

  it("⚠️ le miroir et la clé SQLite sont bien deux choses distinctes", () => {
    // SQLite reste la source de vérité ; le miroir ne sert qu'au premier rendu.
    // Les confondre ferait décider la transition sur une valeur périmée.
    const type = lire("src/lib/entree/reglage.ts");
    expect(type).toContain('CLE_MIROIR_ENTREE = "shale.entree.animation"');
    expect(type).toContain('getSetting("ui.entryAnimation")');
    expect(type).toContain('setSetting("ui.entryAnimation"');
  });
});
