import { describe, expect, it } from "vitest";
import { norm } from "./actions";
import { uidArete } from "./liens";
import {
  basculerRangee,
  CLE_NOTES_RANGEES,
  ecrireRangees,
  etatsDeTri,
  lireRangees,
  notesATrier,
} from "./notesATrier";
import { settingSynchronisable } from "./sync/scope";
import { normaliser } from "./tachesVue";
import type { LinkKind, Note, ObjectLink } from "./types";

/**
 * L'onglet « À trier » de la vue Notes (2026-10-11) : une note y figure tant
 * qu'elle n'est reliée à rien et qu'on ne l'a pas gardée telle quelle.
 */

const note = (id: number, p: Partial<Note> & { uid?: string } = {}): Note =>
  ({
    id,
    uid: `n${id}`,
    title: `note ${id}`,
    body: "",
    created_at: "",
    updated_at: "",
    is_example: 0,
    ...p,
  }) as Note;

let rang = 0;
const arete = (
  de: [LinkKind, string],
  vers: [LinkKind, string],
  origin: ObjectLink["origin"] = "manual",
): ObjectLink => ({
  id: ++rang,
  uid: uidArete({ kind: de[0], uid: de[1] }, { kind: vers[0], uid: vers[1] }),
  from_kind: de[0],
  from_uid: de[1],
  to_kind: vers[0],
  to_uid: vers[1],
  origin,
  created_at: "",
});

const AUCUNE = new Set<string>();
const ids = (notes: Note[]) => notes.map((n) => n.id);

describe("notesATrier — le critère", () => {
  it("⭐ une note reliée à rien est à trier ; vide et sans titre choisi, elle l'est aussi", () => {
    // C'est exactement ce que crée le raccourci : « Nouvelle note », corps vide.
    const notes = [note(1, { title: "Nouvelle note" }), note(2, { body: "<p>une idée</p>" })];
    expect(ids(notesATrier(notes, [], AUCUNE))).toEqual([1, 2]);
  });

  it("une arête SORTANTE la range : elle cite un objectif, un sujet, une tâche", () => {
    const notes = [note(1), note(2), note(3), note(4)];
    const liens = [
      arete(["note", "n1"], ["goal", "g1"], "mention"),
      arete(["note", "n2"], ["object", "s1"], "mention"),
      arete(["note", "n3"], ["task", "t1"], "mention"),
    ];
    expect(ids(notesATrier(notes, liens, AUCUNE))).toEqual([4]);
  });

  it("une arête ENTRANTE la range aussi : rattachée depuis un objectif, citée par une fiche", () => {
    const notes = [note(1), note(2), note(3)];
    const liens = [arete(["goal", "g1"], ["note", "n1"]), arete(["knowledge", "k1"], ["note", "n2"], "mention")];
    expect(ids(notesATrier(notes, liens, AUCUNE))).toEqual([3]);
  });

  it("une arête entre deux notes range les DEUX", () => {
    const notes = [note(1), note(2), note(3)];
    expect(ids(notesATrier(notes, [arete(["note", "n1"], ["note", "n2"], "mention")], AUCUNE))).toEqual([3]);
  });

  it("⚠️ une pièce jointe ne range pas la note", () => {
    const notes = [note(1)];
    expect(ids(notesATrier(notes, [arete(["note", "n1"], ["file", "f1"], "mention")], AUCUNE))).toEqual([1]);
  });

  it("une arête qui ne touche aucune note de la liste ne change rien", () => {
    const notes = [note(1)];
    const liens = [arete(["task", "t1"], ["object", "s1"]), arete(["note", "ailleurs"], ["goal", "g1"])];
    expect(ids(notesATrier(notes, liens, AUCUNE))).toEqual([1]);
  });

  it("l'ordre reçu est gardé", () => {
    const notes = [note(3), note(1), note(2)];
    expect(ids(notesATrier(notes, [], AUCUNE))).toEqual([3, 1, 2]);
  });

  it("en démo les lignes n'ont pas d'uid : la formule « demo:note:<id> » sert des deux côtés", () => {
    const sansUid = (id: number) => ({ ...note(id), uid: undefined }) as Note;
    const liens = [arete(["goal", "demo:goal:1"], ["note", "demo:note:2"])];
    expect(ids(notesATrier([sansUid(1), sansUid(2)], liens, AUCUNE))).toEqual([1]);
    expect(ids(notesATrier([sansUid(1), sansUid(2)], liens, new Set(["demo:note:1"])))).toEqual([]);
  });
});

describe("notesATrier — les liens [[titre]]", () => {
  it("⭐ un lien [[titre]] qui aboutit range celle qui cite ET celle qui est citée", () => {
    const notes = [
      note(1, { title: "Méthode de devis", body: "Voir aussi [[Tarifs 2026]]." }),
      note(2, { title: "Tarifs 2026" }),
      note(3, { title: "Idées de posts" }),
    ];
    expect(ids(notesATrier(notes, [], AUCUNE))).toEqual([3]);
  });

  it("sans se soucier de la casse ni des accents — comme la vue les résout", () => {
    const notes = [note(1, { body: "[[ methode DE devis ]]" }), note(2, { title: "Méthode de devis" })];
    expect(ids(notesATrier(notes, [], AUCUNE))).toEqual([]);
  });

  it("⚠️ un lien vers une note qui n'existe pas ne range rien", () => {
    const notes = [note(1, { body: "[[Une note à écrire]]" }), note(2)];
    expect(ids(notesATrier(notes, [], AUCUNE))).toEqual([1, 2]);
  });

  it("⚠️ se citer soi-même ne relie à rien", () => {
    const notes = [note(1, { title: "Journal", body: "[[Journal]]" })];
    expect(ids(notesATrier(notes, [], AUCUNE))).toEqual([1]);
  });

  it("deux notes du même titre : citer ce titre les range toutes les deux", () => {
    const notes = [note(1, { body: "[[Brouillon]]" }), note(2, { title: "Brouillon" }), note(3, { title: "Brouillon" })];
    expect(ids(notesATrier(notes, [], AUCUNE))).toEqual([]);
  });

  it("la normalisation est celle dont la vue se sert pour ses liens", () => {
    for (const s of ["Méthode de DEVIS", "Ça, où ?", "  Été  ", "ÉLÈVE"]) expect(normaliser(s)).toBe(norm(s));
  });
});

describe("notesATrier — garder telle quelle", () => {
  it("⭐ une note gardée quitte l'onglet sans être reliée", () => {
    const notes = [note(1), note(2)];
    expect(ids(notesATrier(notes, [], new Set(["n1"])))).toEqual([2]);
  });

  it("le geste se défait : retirée de la liste, elle revient", () => {
    const gardees = basculerRangee(AUCUNE, "n1", true);
    expect(ids(notesATrier([note(1)], [], gardees))).toEqual([]);
    expect(ids(notesATrier([note(1)], [], basculerRangee(gardees, "n1", false)))).toEqual([1]);
  });

  it("basculerRangee ne modifie pas la liste reçue", () => {
    const avant = new Set(["n1"]);
    basculerRangee(avant, "n2", true);
    basculerRangee(avant, "n1", false);
    expect([...avant]).toEqual(["n1"]);
  });
});

describe("etatsDeTri — pourquoi une note est là, ou n'y est pas", () => {
  it("chaque note a un état, et un seul", () => {
    const notes = [note(1), note(2), note(3), note(4, { is_example: 1 })];
    const etats = etatsDeTri(notes, [arete(["goal", "g1"], ["note", "n2"])], new Set(["n3"]));
    expect([...etats]).toEqual([
      [1, "a-trier"],
      [2, "reliee"],
      [3, "gardee"],
      [4, "exemple"],
    ]);
  });

  it("⚠️ un exemple de l'app ne se trie pas, relié ou non : personne ne l'a noté à la volée", () => {
    const notes = [note(1, { is_example: 1 }), note(2, { is_example: 1 })];
    const etats = etatsDeTri(notes, [arete(["note", "n2"], ["goal", "g1"])], AUCUNE);
    expect([...etats.values()]).toEqual(["exemple", "exemple"]);
    expect(notesATrier(notes, [], AUCUNE)).toEqual([]);
  });

  it("une note gardée PUIS reliée est « reliée » : la délier ne la ramène pas à trier", () => {
    const gardees = new Set(["n1"]);
    const liee = etatsDeTri([note(1)], [arete(["goal", "g1"], ["note", "n1"])], gardees);
    expect(liee.get(1)).toBe("reliee");
    expect(etatsDeTri([note(1)], [], gardees).get(1)).toBe("gardee");
  });
});

describe("le réglage « notes.rangees »", () => {
  it("s'écrit et se relit", () => {
    const liste = new Set(["b", "a"]);
    expect([...lireRangees(ecrireRangees(liste))].sort()).toEqual(["a", "b"]);
  });

  it("s'écrit trié : deux appareils d'accord écrivent la même valeur", () => {
    expect(ecrireRangees(new Set(["b", "a"]))).toBe(ecrireRangees(new Set(["a", "b"])));
  });

  it("⚠️ absent, vide ou illisible, il se lit « aucune » — jamais une erreur", () => {
    for (const brut of [null, undefined, "", "pas du json", "{}", '"n1"', "42", "null"]) {
      expect(lireRangees(brut).size).toBe(0);
    }
  });

  it("ne garde que des uid : le reste est écarté", () => {
    expect([...lireRangees('["n1", 3, null, "", "n2"]')]).toEqual(["n1", "n2"]);
  });

  it("⚠️ suit l'utilisateur d'un appareil à l'autre : la clé est synchronisée", () => {
    expect(settingSynchronisable(CLE_NOTES_RANGEES)).toBe(true);
  });
});
