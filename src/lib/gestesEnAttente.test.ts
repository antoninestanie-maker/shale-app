// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { consommerGeste, demanderGeste, VIE_GESTE } from "./naviguer";
import { estToucheSaisie } from "./toucheSaisie";

/**
 * Constat 22 de l'audit du 2026-10-20 : « New goal » de la palette n'ouvrait
 * aucun formulaire au premier appel (un `setTimeout` de 50 ms avant que la vue
 * `lazy` soit montée). Le geste est désormais déposé et repris au montage.
 */
describe("les gestes en attente", () => {
  it("⭐ un geste demandé avant le montage est repris une fois, une seule", () => {
    demanderGeste("sb:new-goal");
    expect(consommerGeste("sb:new-goal")).toBe(true);
    expect(consommerGeste("sb:new-goal")).toBe(false);
  });
  it("une vue déjà montée le reçoit tout de suite", () => {
    let recu = 0;
    const f = () => recu++;
    window.addEventListener("sb:new-task", f);
    demanderGeste("sb:new-task");
    window.removeEventListener("sb:new-task", f);
    expect(recu).toBe(1);
  });
  it("un geste trop vieux n'est plus repris", () => {
    demanderGeste("sb:new-goal");
    expect(consommerGeste("sb:new-goal", Date.now() + VIE_GESTE + 1)).toBe(false);
  });
});

describe("la touche de saisie « N »", () => {
  const ev = (o: Partial<KeyboardEvent> & { target?: EventTarget | null }) =>
    ({ key: "n", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, repeat: false, defaultPrevented: false, target: document.body, ...o }) as KeyboardEvent;
  it("hors champ, sans modificateur : oui", () => {
    expect(estToucheSaisie(ev({}))).toBe(true);
    expect(estToucheSaisie(ev({ key: "N", shiftKey: true }))).toBe(true);
  });
  it("dans un champ, avec ⌘, ou déjà prise : non", () => {
    const champ = document.createElement("input");
    document.body.appendChild(champ);
    expect(estToucheSaisie(ev({ target: champ }))).toBe(false);
    expect(estToucheSaisie(ev({ metaKey: true }))).toBe(false);
    expect(estToucheSaisie(ev({ defaultPrevented: true }))).toBe(false);
    champ.remove();
  });
});
