import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Le halo de l'orbe débordait de son item et la zone qui défile le coupait
// (2026-10-16). La règle : la position du fil se DÉDUIT du halo, elle ne
// s'écrit pas à côté. Ce test lit le CSS et tombe si l'un redevient un nombre
// sans l'autre.
const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");
const bloc = (sel: string) => {
  const i = css.indexOf(`${sel} {`);
  expect(i, sel).toBeGreaterThan(-1);
  return css.slice(i, css.indexOf("}", i));
};

describe("le fil ne déborde jamais de sa boîte", () => {
  it("debout : le fil est à au moins un halo du bord, et le halo lit la même variable", () => {
    expect(bloc(".fil-item")).toMatch(/--fil-x:\s*calc\(var\(--fil-halo\)/);
    expect(bloc(".fil-orbe::before")).toMatch(/inset:\s*calc\(-1 \* var\(--fil-halo\)\)/);
    const y = Number(/--fil-y:\s*(\d+)px/.exec(bloc(".fil-item"))?.[1]);
    const halo = Number(/--fil-halo:\s*(\d+)px/.exec(bloc(".fil-item"))?.[1]);
    expect(y).toBeGreaterThanOrEqual(halo);
  });
  it("couché : la tête et le trait partent à un halo du bord, la boîte fait deux halos de haut", () => {
    expect(bloc(".fil-h")).toMatch(/height:\s*calc\(2 \* var\(--fil-halo\)\)/);
    expect(bloc(".fil-h-tete")).toMatch(/left:\s*calc\(var\(--fil-halo\)/);
    expect(bloc(".fil-h-tete")).toMatch(/0 0 0 5px/);
    const halo = Number(/--fil-halo:\s*(\d+)px/.exec(bloc(".fil-h"))?.[1]);
    expect(halo).toBeGreaterThanOrEqual(4 + 5); // rayon de la tête + anneau
  });
});
