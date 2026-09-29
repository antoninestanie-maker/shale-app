import type { Carte, TypeNoeud } from "./carte";
import { serieHabitude } from "./habitudes";
import { estAcheve, mesurer, uidDeLigne, type SourcesProgression } from "./objectifs/progression";
import { estRecurrente } from "./taches";
import type { Goal, Task } from "./types";

/**
 * ⭐ L'ÉTAT VIVANT d'un nœud typé — calculé à la lecture, JAMAIS stocké.
 *
 * Chantier du 2026-09-29. Un nœud typé est une référence vers un vrai objet
 * (une tâche, une étape, une habitude) : son état est celui de l'objet, relu
 * dans les données à chaque affichage de l'éditeur. Rien de ce fichier n'entre
 * dans le JSON de la carte, ni dans le bloc enregistré dans la note, ni dans
 * l'export — une coche dessinée dans une image figée mentirait dès la première
 * tâche décochée ailleurs (le garde-fou est un test, `carteEtat.test.ts`).
 *
 * ⚠️ PUR : aucune lecture de la base. L'éditeur lui donne les données, lues
 * par `fetchAll` et relues sur `sb:data-changed`.
 */

export interface EtatVivant {
  /** Le type LU DANS LES DONNÉES — une phase redevenue sous-objectif se voit tout de suite. */
  type: Exclude<TypeNoeud, "idee" | "citation">;
  /** Tâche ponctuelle cochée. */
  fait?: boolean;
  /** Tâche récurrente : elle ne se coche pas depuis la carte (règle de la feuille de route). */
  recurrente?: boolean;
  /** La tâche elle-même, pour `basculerTache`. */
  tache?: Task;
  /** Échéance d'une tâche, ou d'une étape. */
  echeance?: string | null;
  /** Échéance passée, et pas fait / pas achevé. */
  enRetard?: boolean;
  /** Jours d'affilée — une habitude. */
  serie?: number;
  /** Le pourcentage d'une étape ou d'un objectif, tel que `progression.ts` le mesure. */
  pct?: number | null;
  acheve?: boolean;
}

export interface SourcesEtat extends SourcesProgression {
  /** 'YYYY-MM-DD', heure locale. */
  today: string;
}

/** Le genre d'un objectif, lu dans l'arborescence réelle. */
export function genreDObjectif(g: Pick<Goal, "parent_goal_id" | "is_milestone">): "objectif" | "phase" | "sous-objectif" {
  return g.parent_goal_id == null ? "objectif" : g.is_milestone ? "phase" : "sous-objectif";
}

/**
 * L'état de chaque nœud typé de la carte, par `id` de nœud.
 *
 * Un nœud dont l'objet n'existe plus (supprimé, en corbeille) n'a pas d'état :
 * il est déjà marqué `mort` par `rafraichirReferences`, et c'est tout ce qu'il
 * y a à en dire.
 */
export function etatsVivants(carte: Carte, s: SourcesEtat): Map<string, EtatVivant> {
  const out = new Map<string, EtatVivant>();
  const faites = new Set(s.completions.filter((c) => c.done).map((c) => c.task_id));
  const taches = new Map(s.tasks.map((t) => [uidDeLigne("task", t), t]));
  const objectifs = new Map(s.goals.map((g) => [uidDeLigne("goal", g), g]));
  const habitudes = new Map((s.habits ?? []).map((h) => [uidDeLigne("habit", h), h]));

  for (const n of carte.noeuds) {
    if (!n.ref) continue;
    if (n.ref.kind === "task") {
      const t = taches.get(n.ref.uid);
      if (!t) continue;
      const recurrente = estRecurrente(t);
      const fait = !recurrente && faites.has(t.id);
      out.set(n.id, {
        type: "tache",
        fait,
        recurrente,
        tache: t,
        echeance: t.due_date,
        enRetard: !!t.due_date && t.due_date < s.today && !fait,
      });
    } else if (n.ref.kind === "habit") {
      const h = habitudes.get(n.ref.uid);
      if (!h) continue;
      out.set(n.id, { type: "habitude", serie: serieHabitude(h.id, s.habitChecks ?? [], s.today) });
    } else if (n.ref.kind === "goal") {
      const g = objectifs.get(n.ref.uid);
      if (!g) continue;
      const m = mesurer(g, s);
      const acheve = estAcheve(m);
      out.set(n.id, {
        type: genreDObjectif(g),
        pct: m.pct,
        acheve,
        echeance: g.deadline,
        enRetard: !!g.deadline && g.deadline.slice(0, 10) < s.today && !acheve,
      });
    }
  }
  return out;
}
