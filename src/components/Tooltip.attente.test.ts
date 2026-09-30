// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TooltipLayer from "./Tooltip";

/**
 * ⭐ L'EXPLICATION N'APPARAÎT QU'AU SURVOL PROLONGÉ (2026-09-30).
 *
 * Antonin : « ça ne doit pas être tout le temps là. À la limite, si on laisse
 * le curseur trois secondes sur quelque chose, ça peut l'expliquer ».
 * `data-tip-attente="longue"` : deux secondes, et jamais « à chaud ».
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let conteneur: HTMLElement;
let racine: Root;

beforeEach(() => {
  vi.useFakeTimers();
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
  act(() =>
    racine.render(
      createElement(
        "div",
        null,
        createElement(TooltipLayer),
        createElement("button", { id: "nom", "data-tip": "Un nom" }, "a"),
        createElement("button", { id: "aide", "data-tip": "Une explication", "data-tip-attente": "longue" }, "b"),
      ),
    ),
  );
});

afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
  vi.useRealTimers();
});

const survoler = (id: string) =>
  act(() => {
    document.getElementById(id)!.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
  });
const attendre = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const visible = (texte: string) => (document.body.textContent ?? "").includes(texte);

describe("data-tip-attente", () => {
  it("une bulle ordinaire vient après le délai habituel", () => {
    survoler("nom");
    attendre(450);
    expect(visible("Un nom")).toBe(true);
  });

  it("⭐ une explication attend deux secondes de survol", () => {
    survoler("aide");
    attendre(1500);
    expect(visible("Une explication")).toBe(false);
    attendre(600);
    expect(visible("Une explication")).toBe(true);
  });

  it("⚠️ « à chaud » ne l'accélère pas : balayer une liste ne fait pas défiler ses explications", () => {
    survoler("nom");
    attendre(450);
    // On quitte la bulle vers le vide : la couche est désormais « chaude ».
    act(() => void conteneur.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })));
    attendre(150);
    survoler("aide");
    attendre(300);
    expect(visible("Une explication")).toBe(false);
  });
});
