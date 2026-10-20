// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { reindexationDe } from "./knowledge";
import type { KnowledgeEntry } from "./types";

/** Audit du 2026-10-20, savoir-3 : la ré-indexation n'écrit QUE ce qui change. */

const fiche = (p: Partial<KnowledgeEntry>): KnowledgeEntry =>
  ({
    id: 1,
    topic_id: null,
    kind: "note",
    title: "Fiche",
    body: "",
    text: "",
    media: null,
    data: null,
    url: null,
    thumb: null,
    tags: "",
    pinned: 0,
    created_at: "x",
    updated_at: "x",
    ...p,
  }) as KnowledgeEntry;

describe("reindexationDe", () => {
  it("⭐ une fiche faite seulement d'images, déjà indexée, n'est PAS réécrite — à chaque visite elle l'était", () => {
    const body = '<figure><img src="data:image/png;base64,AAAA" alt="capture"></figure><p><br></p>';
    expect(reindexationDe(fiche({ body, text: "", thumb: "data:image/jpeg;base64,BBBB" }))).toBeNull();
  });

  it("une fiche vide qu'on a cliquée non plus", () => {
    expect(reindexationDe(fiche({ body: "<p><br></p>", text: "" }))).toBeNull();
  });

  it("une fiche d'avant la migration 014, sans texte brut, est indexée", () => {
    const r = reindexationDe(fiche({ body: "<p>Bonjour</p>", text: "" }));
    expect(r?.patch).toEqual({ kind: "note", body: "<p>Bonjour</p>", text: "Bonjour" });
  });

  it("une fiche d'avant l'unification (image) devient une note, son média dans le corps", () => {
    const r = reindexationDe(fiche({ kind: "image", media: "data:image/png;base64,AAAA", body: "" }));
    expect(r?.patch.kind).toBe("note");
    expect(r?.patch.body).toContain("<img");
    expect(r?.couverture).toBe("data:image/png;base64,AAAA");
  });

  it("une image sans vignette la reçoit une fois — puis plus rien", () => {
    const body = '<figure><img src="data:image/png;base64,AAAA"></figure>';
    expect(reindexationDe(fiche({ body, thumb: null }))?.couverture).toBe("data:image/png;base64,AAAA");
    expect(reindexationDe(fiche({ body, thumb: "data:image/jpeg;base64,BBBB" }))).toBeNull();
  });
});
