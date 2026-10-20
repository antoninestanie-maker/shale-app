import { describe, expect, it } from "vitest";
import { distanceEdition, motProche, rechercher, type Document } from "./recherche";

/**
 * Constat 36 de l'audit du 2026-10-20 : « linkdin », « linkedn », « plonbier »
 * ne trouvaient rien.
 */
const corpus: Document[] = [
  { kind: "goal", id: 1, uid: "g1", titre: "Refaire mon profil LinkedIn" },
  { kind: "task", id: 2, uid: "t2", titre: "Appeler le plombier" },
  { kind: "note", id: 3, uid: "n3", titre: "Idées de posts" },
  { kind: "task", id: 4, uid: "t4", titre: "Lire" },
];
const titres = (q: string) => rechercher(corpus, q).map((r) => r.titre);

describe("une faute de frappe pardonnée", () => {
  it.each(["linkdin", "linkedn", "linekdin"])("« %s » trouve LinkedIn", (q) => {
    expect(titres(q)).toContain("Refaire mon profil LinkedIn");
  });
  it("« plonbier » trouve le plombier", () => {
    expect(titres("plonbier")).toEqual(["Appeler le plombier"]);
  });
  it("le début d'un mot, avec une faute : « linkdi »", () => {
    expect(titres("linkdi")).toContain("Refaire mon profil LinkedIn");
  });
  it("une correspondance exacte passe devant une approchée", () => {
    const r = rechercher([...corpus, { kind: "task", id: 5, uid: "t5", titre: "Plombier — devis" }], "plombier");
    expect(r[0].titre).toBe("Plombier — devis");
  });
  it("pas de tolérance sous quatre lettres", () => {
    expect(titres("lir")).toEqual(["Lire"]); // début de mot, exact
    expect(titres("lre")).toEqual([]);
  });
  it("trop loin : rien", () => {
    expect(titres("plantier")).toEqual([]);
  });
});

describe("distanceEdition", () => {
  it("compte insertion, suppression, substitution, inversion", () => {
    expect(distanceEdition("linkdin", "linkedin")).toBe(1);
    expect(distanceEdition("plonbier", "plombier")).toBe(1);
    expect(distanceEdition("linekdin", "linkedin")).toBe(1);
    expect(distanceEdition("abc", "abc")).toBe(0);
  });
  it("s'arrête au plafond", () => {
    expect(distanceEdition("aaaaaaaa", "bbbbbbbb", 2)).toBe(3);
  });
  it("motProche refuse les mots courts", () => {
    expect(motProche("lre", "lire")).toBe(false);
  });
});
