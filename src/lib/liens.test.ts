import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";

import {
  areteValide,
  aretesResolues,
  diffMentions,
  grouperParKind,
  LINK_KINDS,
  normaliserAretes,
  TABLE_DE_KIND,
  uidArete,
  type AreteVoulue,
} from "./liens";
import { baseNeuve } from "./sync/schema.testutil";
import type { LinkKind, ObjectLink } from "./types";

/** Socle du 2026-09-02 — les liaisons entre objets (migration 020). */

const arete = (
  from_kind: LinkKind,
  from_uid: string,
  to_kind: LinkKind,
  to_uid: string,
  origin: "mention" | "manual" = "mention",
): AreteVoulue => ({ from_kind, from_uid, to_kind, to_uid, origin });

const lien = (a: AreteVoulue, id = 1): ObjectLink => ({
  id,
  uid: uidArete({ kind: a.from_kind, uid: a.from_uid }, { kind: a.to_kind, uid: a.to_uid }),
  ...a,
  created_at: "2026-09-02 10:00:00",
});

// ─────────────────────────────────────────────────────────────────────────────

describe("l'identité d'une arête", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = baseNeuve();
  });
  afterEach(() => db.close());

  it("⭐ TypeScript et le trigger SQL calculent le MÊME uid", () => {
    // C'est le test qui compte. Si les deux dérivations divergeaient, la même
    // mention tapée sur deux appareils produirait deux lignes serveur pour un
    // seul fait, qui se battraient sans jamais converger — le mode d'échec que
    // la migration 015 décrit, et qui ne se voit jamais sur un seul appareil.
    db.prepare(
      "INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid, origin) VALUES (?, ?, ?, ?, 'mention')",
    ).run("note", "uid-note-1", "knowledge", "uid-fiche-9");

    const enBase = db.prepare("SELECT uid FROM object_links").get() as { uid: string };
    expect(enBase.uid).toBe(
      uidArete({ kind: "note", uid: "uid-note-1" }, { kind: "knowledge", uid: "uid-fiche-9" }),
    );
  });

  it("la même arête écrite deux fois est refusée par l'index unique", () => {
    const ecrire = (origin: string) =>
      db
        .prepare(
          "INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid, origin) VALUES ('note', 'n1', 'task', 't1', ?)",
        )
        .run(origin);
    ecrire("mention");
    // ⚠️ `origin` n'entre PAS dans l'unicité : rattacher à la main une note déjà
    // mentionnée ne doit pas créer un doublon que l'interface ne saurait pas
    // expliquer.
    expect(() => ecrire("manual")).toThrow();
  });

  it("chaque famille pointe vers une table qui existe vraiment", () => {
    // Une famille qui pointerait vers une table absente ne casserait rien à
    // l'écriture — elle rendrait seulement les backlinks de cette famille
    // invisibles pour toujours.
    const tables = new Set(
      (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
        (r) => r.name,
      ),
    );
    for (const kind of LINK_KINDS) expect(tables.has(TABLE_DE_KIND[kind])).toBe(true);
  });

  it("les familles connues du SQL et du TypeScript sont les mêmes", () => {
    // La contrainte CHECK de la table et `LINK_KINDS` disent la même chose.
    // Ajouter une famille d'un seul côté produirait, selon le côté, un écran
    // vide ou une écriture refusée.
    for (const kind of LINK_KINDS) {
      expect(() =>
        db
          .prepare("INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid) VALUES (?, 'a', 'note', 'b')")
          .run(kind),
      ).not.toThrow();
    }
    expect(() =>
      db
        .prepare("INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid) VALUES ('inventé', 'a', 'note', 'b')")
        .run(),
    ).toThrow();
  });
});

describe("ce qui fait une arête valide", () => {
  it("refuse le lien d'un objet vers lui-même", () => {
    // C'est le cas le plus fréquent, pas un cas limite : on cite le titre de la
    // note qu'on est en train d'écrire.
    expect(areteValide({ kind: "note", uid: "n1" }, { kind: "note", uid: "n1" })).toBe(false);
    expect(areteValide({ kind: "note", uid: "n1" }, { kind: "note", uid: "n2" })).toBe(true);
  });

  it("refuse une extrémité sans uid", () => {
    expect(areteValide({ kind: "note", uid: "" }, { kind: "task", uid: "t1" })).toBe(false);
  });

  it("accepte deux familles différentes portant le même uid", () => {
    // Les uid sont uniques PAR TABLE, pas globalement : rien n'interdit qu'une
    // note et une tâche portent le même. Les refuser casserait des liens justes.
    expect(areteValide({ kind: "note", uid: "x" }, { kind: "task", uid: "x" })).toBe(true);
  });
});

describe("normalisation", () => {
  it("deux mentions du même objet ne font qu'une arête", () => {
    const gardees = normaliserAretes([
      arete("note", "n1", "task", "t1"),
      arete("note", "n1", "task", "t1"),
      arete("note", "n1", "goal", "g1"),
    ]);
    expect(gardees).toHaveLength(2);
  });

  it("la PREMIÈRE origine gagne", () => {
    const gardees = normaliserAretes([
      arete("note", "n1", "task", "t1", "mention"),
      arete("note", "n1", "task", "t1", "manual"),
    ]);
    expect(gardees[0].origin).toBe("mention");
  });

  it("écarte les arêtes invalides sans faire échouer les autres", () => {
    const gardees = normaliserAretes([
      arete("note", "n1", "note", "n1"), // vers soi-même
      arete("note", "n1", "task", "t1"),
    ]);
    expect(gardees).toHaveLength(1);
  });
});

describe("mise à jour des mentions d'un texte", () => {
  it("crée ce qui vient d'être tapé", () => {
    const { aCreer } = diffMentions([], [arete("note", "n1", "task", "t1")]);
    expect(aCreer).toHaveLength(1);
  });

  it("retire une mention effacée du texte", () => {
    const existante = lien(arete("note", "n1", "task", "t1"));
    const { aSupprimer } = diffMentions([existante], []);
    expect(aSupprimer).toEqual([existante]);
  });

  it("⚠️ NE retire PAS un rattachement fait à la main", () => {
    // Un rattachement manuel est un geste délibéré : il demande un geste
    // délibéré pour être défait, pas une réécriture du texte.
    const manuel = lien(arete("note", "n1", "object", "o1", "manual"));
    const { aSupprimer } = diffMentions([manuel], []);
    expect(aSupprimer).toEqual([]);
  });

  it("ne recrée pas ce qui existe déjà", () => {
    const existante = lien(arete("note", "n1", "task", "t1"));
    const { aCreer, aSupprimer } = diffMentions([existante], [arete("note", "n1", "task", "t1")]);
    expect(aCreer).toEqual([]);
    expect(aSupprimer).toEqual([]);
  });
});

describe("ce qui est affichable", () => {
  it("une arête dont la cible n'est pas encore arrivée reste invisible, pas perdue", () => {
    // L'ordre d'arrivée des lignes distantes n'est pas garanti : une arête peut
    // être appliquée AVANT l'objet qu'elle cite. Elle est conservée et devient
    // visible d'elle-même au cycle suivant.
    const l = lien(arete("note", "n1", "task", "pas-encore-la"));
    const presents = new Set(["note:n1"]);
    const existe = (k: LinkKind, u: string) => presents.has(`${k}:${u}`);

    expect(aretesResolues([l], existe)).toEqual([]);

    presents.add("task:pas-encore-la");
    expect(aretesResolues([l], existe)).toEqual([l]);
  });

  it("groupe les backlinks par famille, dans un ordre stable", () => {
    const groupes = grouperParKind([
      lien(arete("task", "t1", "note", "n1"), 1),
      lien(arete("note", "n2", "note", "n1"), 2),
      lien(arete("task", "t2", "note", "n1"), 3),
    ]);
    // L'ordre suit LINK_KINDS, pas l'ordre d'insertion : la même fiche doit
    // présenter ses sections dans le même ordre à chaque ouverture.
    expect([...groupes.keys()]).toEqual(["note", "task"]);
    expect(groupes.get("task")).toHaveLength(2);
  });
});
