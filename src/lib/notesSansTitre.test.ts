import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EN } from "./i18n/en";
import { estSansTitre, libelleDeLigne, notesSansTitre, TITRE_SI_VIDE, estNoteNeuve } from "./notesSansTitre";
import type { Note } from "./types";

/**
 * L'onglet « Sans titre » de la vue Notes (2026-10-12) : une note y figure tant
 * que personne ne lui a donné de titre.
 */

const note = (id: number, p: Partial<Note> = {}): Note =>
  ({ id, title: `note ${id}`, body: "", created_at: "", updated_at: "", is_example: 0, ...p }) as Note;

describe("estSansTitre — le critère", () => {
  it("⭐ la note rapide, telle que l'app la crée en français, est sans titre", () => {
    expect(estSansTitre("Nouvelle note")).toBe(true);
  });

  it("⭐ créée quand l'app était en anglais, elle l'est aussi — quelle que soit la langue d'aujourd'hui", () => {
    // Le titre est traduit À LA CRÉATION puis stocké : c'est « New note » qui
    // est en base, et il y reste quand l'app repasse en français.
    expect(estSansTitre("New note")).toBe(true);
  });

  it("un titre vide, ou fait d'espaces, est sans titre", () => {
    expect(estSansTitre("")).toBe(true);
    expect(estSansTitre("   ")).toBe(true);
    expect(estSansTitre(" \t\n")).toBe(true);
    expect(estSansTitre(null)).toBe(true);
    expect(estSansTitre(undefined)).toBe(true);
  });

  it("⭐ le titre effacé — que l'enregistrement remplace par « Sans titre » — est sans titre", () => {
    expect(TITRE_SI_VIDE).toBe("Sans titre");
    expect(estSansTitre(TITRE_SI_VIDE)).toBe(true);
    expect(estSansTitre("Untitled")).toBe(true);
  });

  it("ni la casse ni les espaces autour ne comptent", () => {
    expect(estSansTitre("  nouvelle note ")).toBe(true);
    expect(estSansTitre("NEW NOTE")).toBe(true);
  });

  it("⭐ un titre donné en sort la note — même court, même proche du titre d'office", () => {
    expect(estSansTitre("Courses")).toBe(false);
    expect(estSansTitre("N")).toBe(false);
    expect(estSansTitre("Nouvelle note sur le budget")).toBe(false);
    expect(estSansTitre("Nouvelles notes")).toBe(false);
    expect(estSansTitre("New notebook")).toBe(false);
    expect(estSansTitre("Sans titre pour l'instant")).toBe(false);
  });

  it("la copie d'une note sans titre n'a pas de titre non plus, dans les deux langues", () => {
    expect(estSansTitre("Nouvelle note (copie)")).toBe(true);
    expect(estSansTitre("New note (copy)")).toBe(true);
    expect(estSansTitre("Nouvelle note (copie) (copie)")).toBe(true);
    // Créée en anglais, dupliquée en français.
    expect(estSansTitre("New note (copie)")).toBe(true);
    // La copie d'une note au titre VIDE : « {titre} (copie) » sans titre.
    expect(estSansTitre(" (copie)")).toBe(true);
    expect(estSansTitre("(copy)")).toBe(true);
  });

  it("la copie d'une note titrée garde son titre", () => {
    expect(estSansTitre("Courses (copie)")).toBe(false);
    // Collé au mot, ce n'est pas la marque de « Dupliquer ».
    expect(estSansTitre("Photo(copie)")).toBe(false);
  });
});

describe("notesSansTitre — la liste de l'onglet", () => {
  it("⭐ le contenu ne compte pas : écrite mais sans titre, elle y est ; titrée et vide, elle n'y est pas", () => {
    const notes = [
      note(1, { title: "Nouvelle note", body: "<p>Appeler le garagiste</p>" }),
      note(2, { title: "Garagiste", body: "" }),
      note(3, { title: "", body: "" }),
    ];
    expect(notesSansTitre(notes).map((n) => n.id)).toEqual([1, 3]);
  });

  it("l'ordre reçu est gardé", () => {
    const notes = [note(3, { title: "" }), note(1, { title: "New note" }), note(2, { title: "Nouvelle note" })];
    expect(notesSansTitre(notes).map((n) => n.id)).toEqual([3, 1, 2]);
  });

  it("⭐ un exemple de l'app suit la même règle : titré il n'y est pas, son titre effacé il y est", () => {
    // Le critère est le titre, pas l'origine. Les exemples semés ont tous un
    // titre : ils n'entrent dans l'onglet que si on le leur retire.
    const notes = [
      note(1, { title: "Idées de posts", is_example: 1 }),
      note(2, { title: TITRE_SI_VIDE, is_example: 1 }),
    ];
    expect(notesSansTitre(notes).map((n) => n.id)).toEqual([2]);
  });

  it("aucune note sans titre : la liste est vide", () => {
    expect(notesSansTitre([note(1), note(2)])).toEqual([]);
    expect(notesSansTitre([])).toEqual([]);
  });
});

describe("libelleDeLigne — ce que la liste montre", () => {
  it("une note titrée montre son titre", () => {
    expect(libelleDeLigne("  Courses ", "du pain", "<p>du pain</p>")).toEqual({ genre: "titre", texte: "Courses" });
  });

  it("⭐ dix « Nouvelle note » d'affilée : chacune montre le début de SON texte", () => {
    const textes = Array.from({ length: 10 }, (_, i) => `idée numéro ${i + 1}`);
    const lignes = textes.map((x) => libelleDeLigne("Nouvelle note", x, `<p>${x}</p>`));
    expect(lignes.every((l) => l.genre === "extrait")).toBe(true);
    expect(new Set(lignes.map((l) => (l.genre === "extrait" ? l.texte : ""))).size).toBe(10);
  });

  it("le texte tient sur une ligne : retours et espaces en trop sont ramenés à un espace", () => {
    expect(libelleDeLigne("", "  Appeler\n\n le   garagiste ", "")).toEqual({
      genre: "extrait",
      texte: "Appeler le garagiste",
    });
  });

  it("un long texte est coupé, sur un caractère entier, avec des points de suspension", () => {
    const l = libelleDeLigne("New note", "é".repeat(200), "");
    expect(l.genre).toBe("extrait");
    if (l.genre !== "extrait") return;
    expect(l.texte.endsWith("…")).toBe(true);
    expect(Array.from(l.texte)).toHaveLength(91);

    const emojis = libelleDeLigne("", "🙂".repeat(200), "");
    expect(emojis.genre === "extrait" && Array.from(emojis.texte).every((c) => c === "🙂" || c === "…")).toBe(true);
  });

  it("sans titre et sans rien dedans : « vide »", () => {
    expect(libelleDeLigne("Nouvelle note", "", "")).toEqual({ genre: "vide" });
    expect(libelleDeLigne("", "   ", "<p><br></p>")).toEqual({ genre: "vide" });
    expect(libelleDeLigne(null, "", null)).toEqual({ genre: "vide" });
  });

  it("⚠️ sans un mot mais pas vide — une image, un dessin, une carte : on ne dit pas « vide »", () => {
    expect(libelleDeLigne("Nouvelle note", "", '<p><img src="data:image/png;base64,AAAA"></p>')).toEqual({
      genre: "sans-mots",
    });
    expect(libelleDeLigne("", "", "<figure><svg></svg></figure>")).toEqual({ genre: "sans-mots" });
  });
});

describe("⚠️ le critère suit ce que l'app écrit réellement", () => {
  const RACINE = process.cwd();
  const fichiers = (dossier: string): string[] =>
    readdirSync(join(RACINE, dossier)).flatMap((nom) => {
      const chemin = `${dossier}/${nom}`;
      if (statSync(join(RACINE, chemin)).isDirectory()) return fichiers(chemin);
      return /\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
    });
  const sources = fichiers("src").map((p) => ({ p, texte: readFileSync(join(RACINE, p), "utf8") }));

  it("chaque note créée VIDE dans le code l'est avec un titre que le critère reconnaît, dans les deux langues", () => {
    // `createNote` avec un titre traduit et un corps vide : une note sans rien que
    // l'utilisateur ait écrit — son titre est d'office. Ajouter un jour une
    // création « Note rapide » sans l'apprendre au critère ferait naître des
    // notes sans titre que l'onglet ne verrait pas.
    const cles = new Set<string>();
    for (const { texte } of sources) {
      for (const m of texte.matchAll(/createNote\(\s*t\("([^"]+)"\)\s*,\s*""\s*\)/g)) cles.add(m[1]);
    }
    // Le motif trouve bien les créations d'aujourd'hui (⌘⇧N, palette, « + »).
    expect([...cles]).toEqual(["Nouvelle note"]);
    for (const cle of cles) {
      expect(estSansTitre(cle), cle).toBe(true);
      expect(EN[cle], `« ${cle} » n'a pas de traduction`).toBeTruthy();
      expect(estSansTitre(EN[cle]), EN[cle]).toBe(true);
    }
  });

  it("les traductions anglaises des titres d'office sont reconnues", () => {
    // ⚠️ Si ce test tombe parce qu'une traduction a changé : AJOUTE la
    // nouvelle à `TITRES_D_OFFICE` et GARDE l'ancienne — des notes la portent.
    expect(estSansTitre(EN["Nouvelle note"])).toBe(true);
    expect(estSansTitre(EN[TITRE_SI_VIDE])).toBe(true);
  });

  it("le suffixe de « Dupliquer » est reconnu dans les deux langues", () => {
    const fr = "{titre} (copie)";
    expect(estSansTitre(fr.replace("{titre}", "Nouvelle note"))).toBe(true);
    expect(estSansTitre(EN[fr].replace("{titre}", EN["Nouvelle note"]))).toBe(true);
    // Et la vue s'en sert toujours sous cette forme.
    const vue = sources.find((s) => s.p === "src/views/NotesView.tsx")!.texte;
    expect(vue).toContain('t("{titre} (copie)"');
  });

  it("l'enregistrement d'un titre effacé écrit TITRE_SI_VIDE, pas une autre chaîne", () => {
    const vue = sources.find((s) => s.p === "src/views/NotesView.tsx")!.texte;
    expect(vue).toContain("p.titre.trim() || TITRE_SI_VIDE");
  });
});

describe("une note neuve reçoit le curseur dans son texte (2026-10-12)", () => {
  it("sans titre et vide : neuve, dans les deux langues", () => {
    expect(estNoteNeuve("Nouvelle note", "")).toBe(true);
    expect(estNoteNeuve("New note", "")).toBe(true);
    expect(estNoteNeuve("  ", "<p><br></p>")).toBe(true);
    expect(estNoteNeuve("Nouvelle note", "<div>&nbsp;</div>")).toBe(true);
  });
  it("dès qu'elle a un titre ou du contenu, ouvrir ne prend plus le clavier", () => {
    expect(estNoteNeuve("Garagiste", "")).toBe(false);
    expect(estNoteNeuve("Nouvelle note", "<p>rappeler lundi</p>")).toBe(false);
    expect(estNoteNeuve("Nouvelle note", '<figure><img src="data:image/webp;base64,AA"></figure>')).toBe(false);
  });
});
