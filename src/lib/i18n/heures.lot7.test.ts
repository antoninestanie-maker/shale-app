// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * Constat d'usage 41 (audit du 2026-10-20) : l'app anglaise mêlait « 2:00 PM »
 * (Aujourd'hui, Calendrier) et « 14:00 » (horloge de la barre latérale, ligne
 * de Tâches, historique du Timer), et le menu d'une tâche s'ouvrait sur « End ».
 */
describe("l'app anglaise parle anglais", () => {
  afterAll(async () => (await import(".")).setLangPref("fr"));

  it("« Terminer » une TÂCHE se dit « Mark done », pas « End » (l'arrêt d'un minuteur)", async () => {
    const i18n = await import(".");
    i18n.setLangPref("en");
    expect(i18n.t("Terminer|tâche")).toBe("Mark done");
    expect(i18n.t("Terminer")).toBe("End");
    i18n.setLangPref("fr");
    expect(i18n.t("Terminer|tâche")).toBe("Terminer");
  });

  it("l'horloge de la barre latérale suit la langue : « 2:05:09 PM », « 14:05:09 »", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 20, 14, 5, 9));
    const i18n = await import(".");
    const Clock = (await import("../../components/Clock")).default;
    const rendre = async () => {
      const div = document.createElement("div");
      const r = createRoot(div);
      await act(async () => r.render(createElement(Clock)));
      const texte = div.querySelector("p")!.textContent!.replace(/\s/g, " ");
      act(() => r.unmount());
      return texte;
    };
    i18n.setLangPref("en");
    expect(await rendre()).toBe("2:05:09 PM");
    i18n.setLangPref("fr");
    expect(await rendre()).toBe("14:05:09");
    vi.useRealTimers();
  });
});
