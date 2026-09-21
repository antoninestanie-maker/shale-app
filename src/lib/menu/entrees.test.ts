import { describe, expect, it } from "vitest";
import { activable, ordonner, rangDuFilet, type EntreeMenu } from "./entrees";

const e = (id: string, extra: Partial<EntreeMenu> = {}): EntreeMenu => ({
  id,
  libelle: id,
  icone: null,
  executer: () => {},
  ...extra,
});

describe("la mise en forme du catalogue", () => {
  it("écarte les trous laissés par les conditions", () => {
    const r = ordonner([e("a"), null, false, undefined, e("b")]);
    expect(r.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("⭐ descend les actions destructrices EN DERNIER", () => {
    // La règle est imposée ici, pas demandée aux dix-sept surfaces du
    // catalogue : par la discipline, elle serait fausse une fois sur dix-sept.
    const r = ordonner([e("supprimer", { danger: true }), e("renommer"), e("dupliquer")]);
    expect(r.map((x) => x.id)).toEqual(["renommer", "dupliquer", "supprimer"]);
  });

  it("garde l'ordre d'écriture à l'intérieur de chaque famille", () => {
    const r = ordonner([
      e("renommer"),
      e("purger", { danger: true }),
      e("dupliquer"),
      e("supprimer", { danger: true }),
    ]);
    expect(r.map((x) => x.id)).toEqual(["renommer", "dupliquer", "purger", "supprimer"]);
  });
});

describe("le filet qui sépare la suppression", () => {
  it("se pose juste avant la première entrée destructrice", () => {
    const r = ordonner([e("a"), e("b"), e("z", { danger: true })]);
    expect(rangDuFilet(r)).toBe(2);
  });

  it("⭐ ne se pose PAS en tête quand le menu ne contient QUE des suppressions", () => {
    // Un filet en première position est une barre qui ne sépare rien.
    const r = ordonner([e("z", { danger: true })]);
    expect(rangDuFilet(r)).toBe(-1);
  });

  it("ne se pose pas quand rien n'est destructeur", () => {
    expect(rangDuFilet(ordonner([e("a"), e("b")]))).toBe(-1);
  });
});

describe("ce qui est activable", () => {
  it("une entrée grisée ne l'est pas, même avec une action", () => {
    expect(activable(e("a", { desactive: { raison: "facture émise" } }))).toBe(false);
  });

  it("une entrée sans action ni sous-menu ne l'est pas", () => {
    expect(activable({ id: "a", libelle: "a", icone: null })).toBe(false);
  });

  it("une entrée à sous-menu l'est, même sans action propre", () => {
    expect(activable({ id: "a", libelle: "a", icone: null, sousMenu: [e("b")] })).toBe(true);
  });

  it("un sous-menu VIDE ne rend pas l'entrée activable", () => {
    expect(activable({ id: "a", libelle: "a", icone: null, sousMenu: [] })).toBe(false);
  });
});
