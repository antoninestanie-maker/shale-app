// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { ecouterEtat, usePontFenetreTimer, type EtatTimerPartage } from "./timerFenetre";
import type { FocusController } from "./useFocus";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** temps-8 (audit du 2026-10-20) : l'app démontée pendant une séance le dit à la barre des menus et à la fenêtre séparée. */
describe("le pont de la fenêtre du minuteur", () => {
  it("se démonte en diffusant « plus de séance »", async () => {
    const recus: EtatTimerPartage[] = [];
    const arreter = ecouterEtat((e) => recus.push(e));
    const focus = {
      session: { id: 1, label: "Backtest", taskId: null, plannedMin: 25, startedAtMs: Date.now(), kind: "focus", breakMin: 5 },
      paused: false,
      remainingSec: 1500,
      pause: () => {},
      resume: () => {},
      stop: async () => {},
    } as unknown as FocusController;
    function Pont() {
      usePontFenetreTimer(focus);
      return null;
    }
    const div = document.createElement("div");
    const racine = createRoot(div);
    await act(async () => racine.render(createElement(Pont)));
    await act(async () => void (await new Promise((r) => setTimeout(r, 30))));
    expect(recus.at(-1)?.session?.label).toBe("Backtest");

    act(() => racine.unmount());
    await act(async () => void (await new Promise((r) => setTimeout(r, 30))));
    expect(recus.at(-1)?.session).toBeNull();
    arreter();
  });
});
