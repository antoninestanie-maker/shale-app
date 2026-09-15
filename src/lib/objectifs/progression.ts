import { sansExemples } from "../onboarding/exemples";
import { estRecurrente } from "../taches";
import type {
  CalendarEvent,
  Completion,
  Goal,
  Habit,
  HabitCheck,
  LinkKind,
  ObjectLink,
  Task,
} from "../types";

/**
 * ⭐ La progression d'un objectif — SEUL endroit où elle se calcule.
 *
 * Chantier « feuille de route », migration 026. `effectiveProgress`
 * (`lib/logic.ts`) délègue ici et reste le point d'entrée des écrans qui ne
 * veulent qu'un nombre ; les écrans qui doivent dire D'OÙ vient ce nombre
 * lisent `mesurer()`.
 *
 * ⭐⭐ ÉCRIRE N'EST PAS AVANCER. L'app mesure ce qui a été FAIT, jamais ce qui
 * a été produit à son sujet :
 *
 *   | élément rattaché     | compte comme                                   |
 *   |----------------------|------------------------------------------------|
 *   | tâche non récurrente | 1 unité, faite ou non                          |
 *   | tâche récurrente     | JAMAIS une unité — n'alimente qu'une cible     |
 *   | événement            | 1 unité, faite une fois PASSÉE                 |
 *   | événement récurrent  | jamais une unité (même raison que la tâche)    |
 *   | habitude             | jamais une unité — n'alimente qu'une cible     |
 *   | note, fiche Savoir   | RIEN — une ressource, affichée, jamais comptée |
 *
 * Une récurrente n'est jamais « finie » : la compter en binaire bloquerait
 * l'objectif pour toujours. Une note comptée ferait avancer un objectif parce
 * qu'on a écrit dessus — la barre déclarative qu'on vient de supprimer.
 *
 * LE CALCUL, DE BAS EN HAUT
 *   • manuel (`manual_progress = 1`) → le % saisi. ⭐ SOUVERAIN, feuille de
 *     route ou pas — décision d'Antonin du 2026-09-14 (migration 026) ;
 *   • cible chiffrée → `min(1, compte / cible)` ;
 *   • sinon → moyenne pondérée de ses PARTS : chaque étape enfant pèse son
 *     `weight`, chaque élément comptable pèse 1. Un sous-objectif qui n'a que
 *     des tâches vaut donc « faites / total » ; un jalon qui n'a que des
 *     sous-objectifs vaut leur moyenne pondérée. Une seule règle, et elle rend
 *     EXACTEMENT l'ancienne `effectiveProgress` quand tous les poids valent 1.
 *
 * ⭐ LES VIDES SORTENT DU DÉNOMINATEUR. Une étape sans élément ni cible n'est
 * ni à 0 % (la moitié d'une feuille de route jamais remplie ferait un chiffre
 * faux) ni à 100 % (pire). Elle est exclue, et comptée dans `vides` pour que
 * l'interface le dise.
 *
 * ⚠️ AUCUNE PROGRESSION N'EST STOCKÉE. Tout se calcule à la lecture.
 */

// ─── Entrées ────────────────────────────────────────────────────────────────

/** Ce dont la mesure a besoin au-delà des objectifs et des tâches. */
export interface ContexteProgression {
  habits?: readonly Habit[];
  habitChecks?: readonly HabitCheck[];
  /** Les arêtes qui touchent des objectifs (notes, fiches, événements…). */
  liens?: readonly ObjectLink[];
  /** Les événements que ces arêtes peuvent citer. */
  evenements?: readonly (CalendarEvent & { uid?: string })[];
  /** Instant local 'YYYY-MM-DD HH:MM[:SS]' : un événement compte une fois passé. */
  maintenant: string;
}

export interface SourcesProgression extends ContexteProgression {
  goals: readonly Goal[];
  tasks: readonly Task[];
  completions: readonly Completion[];
}

// ─── Sorties ────────────────────────────────────────────────────────────────

/** D'où vient le chiffre — ce que chaque ligne de l'interface doit pouvoir dire. */
export type OrigineMesure =
  /** Le % saisi à la main fait foi. */
  | { type: "manuel" }
  /** « 12/50 backtests ». `compte` peut dépasser `cible` : le % plafonne, pas le compte. */
  | { type: "cible"; compte: number; cible: number; unite: string | null; source: SourceCompte }
  /** « 3/7 tâches · 2 étapes ». */
  | { type: "feuille"; elementsFaits: number; elementsTotal: number; etapesComptees: number }
  /** Rien de mesurable : exclu du dénominateur du parent. */
  | { type: "vide"; raison: RaisonVide };

export type SourceCompte = "manual" | "task" | "habit";

export type RaisonVide =
  /** Ni étape, ni élément comptable, ni cible. */
  | "rien-a-mesurer"
  /** Des étapes, mais toutes vides. */
  | "etapes-vides"
  /** Une cible ≤ 0 : « atteindre zéro » ne se mesure pas. */
  | "cible-nulle"
  /** La tâche ou l'habitude qui comptait a disparu (ou n'est qu'un exemple). */
  | "source-introuvable";

export interface Mesure {
  /** 0–100, arrondi. `null` = vide. */
  pct: number | null;
  /** 0–1, non arrondi : c'est lui qui entre dans la moyenne du parent. */
  fraction: number | null;
  origine: OrigineMesure;
  /** Étapes enfants DIRECTES exclues parce que vides. */
  vides: number;
  /** Notes et fiches rattachées : affichées, jamais comptées. */
  ressources: ElementRattache[];
  /** Récurrentes rattachées comme élément : visibles, non comptées en binaire. */
  nonComptes: ElementRattache[];
}

export interface ElementRattache {
  kind: LinkKind;
  uid: string;
}

// ─── Identité ───────────────────────────────────────────────────────────────

/**
 * L'uid d'une ligne, y compris en démo où les lignes n'en portent pas.
 *
 * ⚠️ DOIT reproduire `uidDemo()` de `lib/demo.ts` (`demo:<kind>:<id>`) : c'est
 * ce que la démo écrit dans ses arêtes. Deux formules différentes, et une
 * cible chiffrée en démo ne retrouverait jamais sa source.
 */
export function uidDeLigne(kind: LinkKind | "habit", ligne: { id: number; uid?: string | null }): string {
  return ligne.uid ?? `demo:${kind}:${ligne.id}`;
}

// ─── Petites règles ─────────────────────────────────────────────────────────

/** Un poids ≤ 0 ou illisible se lit comme 1 (pas de CHECK en base, § 3.4). */
export function poidsDe(g: Pick<Goal, "weight">): number {
  return Number.isFinite(g.weight) && g.weight > 0 ? g.weight : 1;
}

/** Une source inconnue — écrite par une version future — se lit `'manual'`. */
export function sourceDe(g: Pick<Goal, "count_source">): SourceCompte {
  return g.count_source === "task" || g.count_source === "habit" ? g.count_source : "manual";
}

/**
 * Premier jour compté. « Depuis le rattachement, jamais depuis toujours » :
 * sans `count_since`, on retombe sur le jour de création de l'objectif.
 */
export function debutDuCompte(g: Pick<Goal, "count_since" | "created_at">): string {
  return (g.count_since ?? g.created_at ?? "").slice(0, 10);
}

/** Un événement est passé quand sa FIN l'est — un séjour de trois jours n'est pas tenu le premier matin. */
export function evenementPasse(e: Pick<CalendarEvent, "date" | "end_date" | "end_at" | "start_at">, maintenant: string): boolean {
  const jourFin = e.end_date && e.end_date > e.date ? e.end_date : e.date;
  const heureFin = e.end_at ?? e.start_at;
  // Sans heure, l'événement occupe sa journée : il est passé le lendemain.
  const fin = heureFin ? `${jourFin} ${heureFin}` : `${jourFin} 24:00`;
  return fin <= maintenant.slice(0, 16);
}

// ─── La mesure ──────────────────────────────────────────────────────────────

/** Mesure un objectif, à n'importe quel niveau de sa feuille de route. */
export function mesurer(goal: Goal, sources: SourcesProgression): Mesure {
  return mesurerAvecGarde(goal, sources, new Set());
}

function mesurerAvecGarde(goal: Goal, s: SourcesProgression, vus: Set<number>): Mesure {
  const { ressources, nonComptes, comptables } = elementsDe(goal, s);
  const base = { vides: 0, ressources, nonComptes };

  if (goal.manual_progress) {
    const pct = borner(goal.progress_pct);
    return { ...base, pct, fraction: pct / 100, origine: { type: "manuel" } };
  }

  if (goal.target_count != null) return { ...base, ...mesurerCible(goal, s) };

  // Garde anti-cycle : `parent_goal_id` n'a pas de contrainte de profondeur, et
  // une ligne distante peut en fabriquer un.
  if (vus.has(goal.id)) return { ...base, pct: null, fraction: null, origine: { type: "vide", raison: "rien-a-mesurer" } };
  vus.add(goal.id);

  let somme = 0;
  let poids = 0;
  let etapesComptees = 0;
  let vides = 0;

  for (const enfant of enfantsDe(goal, s.goals)) {
    const m = mesurerAvecGarde(enfant, s, vus);
    if (m.fraction == null) {
      vides++;
      continue;
    }
    const w = poidsDe(enfant);
    somme += m.fraction * w;
    poids += w;
    etapesComptees++;
  }

  const elementsFaits = comptables.filter((e) => e.fait).length;
  somme += elementsFaits;
  poids += comptables.length;

  vus.delete(goal.id);

  if (poids === 0) {
    const raison: RaisonVide = vides > 0 ? "etapes-vides" : "rien-a-mesurer";
    return { ...base, vides, pct: null, fraction: null, origine: { type: "vide", raison } };
  }

  const fraction = somme / poids;
  return {
    ...base,
    vides,
    pct: Math.round(fraction * 100),
    fraction,
    origine: { type: "feuille", elementsFaits, elementsTotal: comptables.length, etapesComptees },
  };
}

function mesurerCible(goal: Goal, s: SourcesProgression): Pick<Mesure, "pct" | "fraction" | "origine"> {
  const cible = goal.target_count ?? 0;
  if (cible <= 0) return { pct: null, fraction: null, origine: { type: "vide", raison: "cible-nulle" } };

  const source = sourceDe(goal);
  const compte = compterSource(goal, source, s);
  if (compte == null) return { pct: null, fraction: null, origine: { type: "vide", raison: "source-introuvable" } };

  const fraction = Math.min(1, compte / cible);
  return {
    pct: Math.round(fraction * 100),
    fraction,
    origine: { type: "cible", compte, cible, unite: goal.target_unit, source },
  };
}

/**
 * Le compte d'une cible. `null` = la source n'existe pas (ou plus).
 *
 * ⚠️ Pour `task` et `habit`, c'est un compte LU : l'interface l'affiche, elle ne
 * le laisse jamais modifier — sinon deux vérités.
 */
export function compterSource(goal: Goal, source: SourceCompte, s: SourcesProgression): number | null {
  if (source === "manual") return Math.max(0, goal.manual_count || 0);

  const uid = goal.count_ref_uid;
  if (!uid) return null;
  const depuis = debutDuCompte(goal);
  const jusqua = s.maintenant.slice(0, 10);

  if (source === "task") {
    // Un exemple ne compte nulle part, pas plus comme source que comme élément.
    const tache = sansExemples(s.tasks).find((t) => uidDeLigne("task", t) === uid);
    if (!tache) return null;
    const jours = new Set(
      s.completions
        .filter((c) => c.task_id === tache.id && c.done && c.date >= depuis && c.date <= jusqua)
        .map((c) => c.date),
    );
    return jours.size;
  }

  const habitude = sansExemples(s.habits ?? []).find((h) => uidDeLigne("habit", h) === uid);
  if (!habitude) return null;
  const jours = new Set(
    (s.habitChecks ?? [])
      .filter((c) => c.habit_id === habitude.id && c.date >= depuis && c.date <= jusqua)
      .map((c) => c.date),
  );
  return jours.size;
}

// ─── Arborescence et éléments ───────────────────────────────────────────────

/** Les étapes directes, dans l'ordre d'affichage : position, échéance, id. */
export function enfantsDe(goal: Pick<Goal, "id">, goals: readonly Goal[]): Goal[] {
  return sansExemples(goals.filter((g) => g.parent_goal_id === goal.id)).sort(
    (a, b) =>
      (a.position ?? 0) - (b.position ?? 0) ||
      (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") ||
      a.id - b.id,
  );
}

interface Comptable extends ElementRattache {
  fait: boolean;
}

/**
 * Tout ce qui est rattaché à UN objectif, dédoublonné par (famille, uid) : un
 * élément lié deux fois — par `tasks.goal_id` ET par une arête — compte une fois.
 */
export function elementsDe(
  goal: Goal,
  s: SourcesProgression,
): { comptables: Comptable[]; ressources: ElementRattache[]; nonComptes: ElementRattache[] } {
  const comptables: Comptable[] = [];
  const ressources: ElementRattache[] = [];
  const nonComptes: ElementRattache[] = [];
  const vus = new Set<string>();
  const cle = (kind: LinkKind, uid: string) => `${kind}:${uid}`;
  const faites = new Set(s.completions.filter((c) => c.done).map((c) => c.task_id));
  const taches = sansExemples(s.tasks);

  const ajouterTache = (t: Task) => {
    const uid = uidDeLigne("task", t);
    if (vus.has(cle("task", uid))) return;
    vus.add(cle("task", uid));
    if (estRecurrente(t)) nonComptes.push({ kind: "task", uid });
    else comptables.push({ kind: "task", uid, fait: faites.has(t.id) });
  };

  // 1) Le chemin historique, et le seul que l'app écrive pour une tâche.
  for (const t of taches) if (t.goal_id === goal.id) ajouterTache(t);

  // 2) Les arêtes, dans les deux sens.
  const uidObjectif = uidDeLigne("goal", goal);
  for (const l of s.liens ?? []) {
    let autre: ElementRattache | null = null;
    if (l.from_kind === "goal" && l.from_uid === uidObjectif) autre = { kind: l.to_kind, uid: l.to_uid };
    else if (l.to_kind === "goal" && l.to_uid === uidObjectif) autre = { kind: l.from_kind, uid: l.from_uid };
    if (!autre || vus.has(cle(autre.kind, autre.uid))) continue;

    if (autre.kind === "task") {
      const t = taches.find((x) => uidDeLigne("task", x) === autre!.uid);
      if (t) ajouterTache(t);
      continue;
    }
    if (autre.kind === "event") {
      const e = (s.evenements ?? []).find((x) => uidDeLigne("event", x) === autre!.uid);
      if (!e) continue; // cible absente : pas de fantôme (§ migration 020)
      vus.add(cle(autre.kind, autre.uid));
      if (e.recurrence && e.recurrence !== "none") nonComptes.push(autre);
      else comptables.push({ ...autre, fait: evenementPasse(e, s.maintenant) });
      continue;
    }
    if (autre.kind === "note" || autre.kind === "knowledge") {
      vus.add(cle(autre.kind, autre.uid));
      ressources.push(autre);
    }
    // 'goal', 'trade', 'object' : hors périmètre (décision n° 3 du chantier).
  }

  return { comptables, ressources, nonComptes };
}

function borner(pct: number | null | undefined): number {
  const n = Number(pct);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}
