import { describe, expect, it } from "vitest";

import {
  contenuExemples,
  estExemple,
  NOMBRE_EXEMPLES,
  sansExemples,
  TABLES_EXEMPLES,
} from "./exemples";
import { extraireMentions, jetonMention } from "../mentions";
import {
  computeStreak,
  dayStat,
  effectiveProgress,
  pctOfList,
  weekStats,
} from "../logic";
import type { Completion, Task, TodayTask } from "../types";
import { objectif } from "../objectifs/objectif.testutil";

/** Chantier L — le contenu de départ, et son exclusion des compteurs. */

const tache = (p: Partial<Task> = {}): Task => ({
  id: 1,
  label: "écrire",
  tag: null,
  priority: "medium",
  recurrence: "none",
  goal_id: null,
  created_at: "2026-09-01 09:00:00",
  due_date: null,
  start_at: null,
  end_at: null,
  postponed_count: 0,
  postponed_from: null,
  is_example: 0,
  ...p,
});

const fait = (task_id: number, date: string, done = 1): Completion => ({
  id: task_id * 100,
  task_id,
  date,
  done,
});



const JOUR = "2026-09-02"; // un mercredi

// ─────────────────────────────────────────────────────────────────────────────

describe("le contenu de départ", () => {
  it("touche quatre tables marquées (plus les objectifs, comptés à part)", () => {
    expect(TABLES_EXEMPLES).toEqual(["tasks", "habits", "notes", "knowledge_entries"]);
    expect(TABLES_EXEMPLES).toHaveLength(NOMBRE_EXEMPLES);
  });

  it("⭐ la refonte du 2026-10-05 : peu d'exemples, tous nommés « Exemple · » ou expliqués", () => {
    const c = contenuExemples();
    expect(c.taches).toHaveLength(2);
    expect(c.notes).toHaveLength(2);
    expect(c.objectif.etapes).toHaveLength(2);
    expect(c.sujets).toHaveLength(3);
    for (const tache of c.taches) expect(tache.label).toMatch(/^(Exemple|Example) · /);
    expect(c.objectif.titre).toMatch(/^(Exemple|Example) · /);
    expect(c.habitude.nom).toMatch(/^(Exemple|Example) · /);
  });

  it("⚠️ aucune tâche d'exemple ne peut être en retard", () => {
    // Récurrente (une occurrence manquée n'est pas en retard) ou datée dans le
    // FUTUR (echeanceDans > 0).
    for (const tache of contenuExemples().taches) {
      if (tache.recurrence === "none") expect(tache.echeanceDans ?? 0).toBeGreaterThan(0);
      else expect(tache.echeanceDans).toBeNull();
    }
  });

  it("une récurrente n'a pas de date, une datée n'est pas récurrente", () => {
    for (const tache of contenuExemples().taches) {
      if (tache.recurrence !== "none") expect(tache.echeanceDans).toBeNull();
    }
  });

  it("⭐ le corps de chaque note se referme AUTOUR d'un jeton de mention", () => {
    const c = contenuExemples();
    for (const note of c.notes) {
      const cible = c.sujets[note.cite[0]].fiches[note.cite[1]];
      expect(cible).toBeDefined();
      const corps = note.avant + jetonMention("knowledge", "uid-de-la-fiche", cible.titre) + note.apres;
      const mentions = extraireMentions(corps);
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({ kind: "knowledge", uid: "uid-de-la-fiche" });
      // `avant` ouvre un paragraphe que `apres` referme : le jeton se glisse dedans.
      expect(note.avant).toContain("<p>");
      expect(note.apres.startsWith("</p>")).toBe(true);
    }
  });

  it("⚠️ le nom de l'habitude ne contient NI heure NI durée", () => {
    const nom = contenuExemples().habitude.nom;
    expect(nom).not.toMatch(/\d{1,2}\s*[:h]\s*\d{0,2}/);
    expect(nom.toLowerCase()).not.toMatch(/heures? de sommeil|dormir|durée/);
  });

  it("⚠️ aucun texte du parcours ne propose de dormir moins ni n'est formulé en perte", () => {
    const c = contenuExemples();
    const tout = [
      ...c.sujets.flatMap((s) => [s.nom, ...s.fiches.flatMap((f) => [f.titre, f.corps])]),
      ...c.notes.flatMap((n) => [n.titre, n.avant, n.apres]),
      ...c.taches.map((t) => t.label),
      c.objectif.titre,
      c.objectif.description,
      ...c.objectif.etapes.flatMap((j) => [j.titre, j.description]),
      c.habitude.nom,
    ]
      .join(" ")
      .toLowerCase();
    for (const interdit of [
      "dormir moins",
      "moins de sommeil",
      "réduire ton sommeil",
      "gagner des heures de sommeil",
      "temps perdu",
      "tu perds",
      "vous perdez",
    ]) {
      expect(tout).not.toContain(interdit);
    }
  });

  it("l'objectif d'exemple n'a pas d'échéance et ses étapes sont mesurées (pas d'alerte « en péril »)", () => {
    // Le contenu n'expose pas de date : semer.ts écrit `deadline: null`.
    const o = contenuExemples().objectif;
    expect(o).not.toHaveProperty("deadline");
    for (const j of o.etapes) expect(j).not.toHaveProperty("deadline");
  });
});

describe("le marqueur", () => {
  it("reconnaît un exemple, et rien d'autre", () => {
    expect(estExemple({ is_example: 1 })).toBe(true);
    expect(estExemple({ is_example: 0 })).toBe(false);
    expect(estExemple({})).toBe(false);
    expect(estExemple(null)).toBe(false);
    expect(estExemple(undefined)).toBe(false);
  });

  it("le filtre garde l'ordre et ne recopie que ce qu'il faut", () => {
    const lignes = [
      { id: 1, is_example: 0 },
      { id: 2, is_example: 1 },
      { id: 3, is_example: 0 },
    ];
    expect(sansExemples(lignes).map((l) => l.id)).toEqual([1, 3]);
    expect(sansExemples(lignes)).not.toBe(lignes); // jamais en place
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("⭐ les exemples n'alimentent AUCUN compteur", () => {
  it("une tâche d'exemple ne fait pas tomber le pourcentage du jour", () => {
    const vraie = tache({ id: 1, recurrence: "daily" });
    const exemple = tache({ id: 2, recurrence: "daily", is_example: 1 });

    // La vraie est faite, l'exemple ne l'est pas. Sans filtre : 1 sur 2 = 50 %.
    const stat = dayStat([vraie, exemple], [fait(1, JOUR)], JOUR);
    expect(stat.total).toBe(1);
    expect(stat.done).toBe(1);
    expect(stat.pct).toBe(100);
  });

  it("⚠️ ni la série : elle se calcule à partir de `dayStat`", () => {
    const vraie = tache({ id: 1, recurrence: "daily" });
    const exemple = tache({ id: 2, recurrence: "daily", is_example: 1 });
    const faites = [fait(1, JOUR), fait(1, "2026-09-01")];

    // Les deux tâches sont créées le 2026-09-01 : la série court donc sur deux
    // jours au plus, et c'est ce qu'on attend. Le point du test est le CONTRASTE
    // avec l'exemple compté — chaque jour tomberait alors à 50 %, sous le seuil
    // de 80 %, et la série vaudrait 1 (le seul `todayPct` fourni) au lieu de 2.
    expect(computeStreak([vraie, exemple], faites, JOUR, 100)).toBe(2);
    // La contre-épreuve, pour que le test ne passe pas par accident : la même
    // tâche NON marquée fait bien retomber la série.
    const sansMarqueur = tache({ id: 2, recurrence: "daily" });
    expect(computeStreak([vraie, sansMarqueur], faites, JOUR, 100)).toBe(1);
  });

  it("la liste du jour EST filtrée au moment de devenir un pourcentage", () => {
    // `todayTasks()` rend la liste AFFICHÉE, exemples compris — c'est voulu.
    // C'est `pctOfList` qui filtre, sinon l'anneau de discipline afficherait
    // 0 % le premier jour, avec pour seule cause la tâche que l'app a créée.
    const liste: TodayTask[] = [
      { ...tache({ id: 1 }), done: true },
      { ...tache({ id: 2, is_example: 1 }), done: false },
    ];
    expect(pctOfList(liste)).toBe(100);
  });

  it("une liste ne contenant QUE des exemples rend `null`, pas 0", () => {
    // `null` = « aucune tâche due », donc jour NEUTRE : il ne compte ni ne
    // casse la série. Rendre 0 aurait cassé la série de l'utilisateur.
    const liste: TodayTask[] = [{ ...tache({ id: 2, is_example: 1 }), done: false }];
    expect(pctOfList(liste)).toBeNull();
  });

  it("la semaine entière est propre, jour courant compris", () => {
    const vraie = tache({ id: 1, recurrence: "daily" });
    const exemple = tache({ id: 2, recurrence: "daily", is_example: 1 });
    const liste: TodayTask[] = [
      { ...vraie, done: true },
      { ...exemple, done: false },
    ];
    const semaine = weekStats([vraie, exemple], [fait(1, JOUR)], JOUR, liste);
    expect(semaine).toHaveLength(7);
    expect(semaine[6].pct).toBe(100); // aujourd'hui, via `pctOfList`
    expect(semaine[6].total).toBe(2); // ⚠️ le TOTAL affiché reste celui de la liste
  });

  it("⚠️ ni la progression d'un objectif", () => {
    const but = objectif({ id: 7 });
    const vraie = tache({ id: 1, goal_id: 7 });
    const exemple = tache({ id: 2, goal_id: 7, is_example: 1 });

    // Sans filtre : (100 + 0) / 2 = 50 %. L'objectif de l'utilisateur
    // plafonnerait à moitié sans que rien ne l'explique.
    expect(effectiveProgress(but, [but], [vraie, exemple], [fait(1, JOUR)])).toBe(100);
  });
});
