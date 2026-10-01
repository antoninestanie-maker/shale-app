// ─────────────────────────────────────────────────────────────────────────────
// Phase E — tâches et objectifs : tout ce que l'app CALCULE avant et après
// l'appel au modèle.
//
//   #7  Découper      → `payloadDecouper`, puis `appliquerDecoupage`
//   #8  Estimer       → `comparablesDe` (le local choisit les candidats),
//                       `fourchette` (le local calcule, jamais le modèle)
//   #11 Décomposer    → `payloadDecomposer`, puis `appliquerEtapes`
//   #12 Tâches        → `payloadTachesObjectif`, puis `appliquerTachesProposees`
//   #13 Péril         → `payloadPeril` (les faits de `calendrier/peril.ts`)
//
// Le modèle ne voit que des FAITS et des identifiants choisis ici ; le serveur
// rejette tout id qu'on ne lui a pas donné. Rien ne s'écrit avant « Valider ».
//
// ⚠️ Pas de sous-tâches natives dans Shale (audit § 4, décision Q7) : « Découper »
// crée des tâches ordinaires, qui héritent de l'objectif et de l'étiquette de
// la tâche d'origine, reliées à elle par `object_links` (`origin = 'manual'`).
// ─────────────────────────────────────────────────────────────────────────────

import { ecartEnJours, type ObjectifEnPeril } from "../calendrier/peril";
import { normaliser } from "../tachesVue";
import { addDays } from "../logic";
import { estAcheve, mesurer, type ContexteProgression } from "../objectifs/progression";
import { peutAjouterEtape } from "../objectifs/structure";
import { createGoal, createLink, createTask, uidDe, type HistoriqueFocus } from "../repo";
import { estRecurrente, planificationDeSaisie } from "../taches";
import type { CalendarEvent, Completion, Goal, Task } from "../types";
import type { ChargeJour, ContratsIa, LangIa, ObjectifPourIa, PayloadDe, PrioriteIa, TacheProposee } from "./contrats";

// ── La charge du calendrier ─────────────────────────────────────────────────

/** Au plus deux mois de charge : au-delà, le détail jour par jour n'aide plus le modèle. */
export const JOURS_CHARGE_MAX = 62;

/**
 * Ce qui est déjà posé chaque jour, de `depuis` inclus : tâches ponctuelles
 * datées et pas faites, plus les événements qui couvrent ce jour. Les routines
 * n'y sont pas — elles reviennent tous les jours et ne disent rien du jour.
 */
export function chargeJours(
  tasks: readonly Task[],
  completions: readonly Completion[],
  evenements: readonly CalendarEvent[],
  depuis: string,
  nb: number,
): ChargeJour[] {
  const n = Math.max(0, Math.min(JOURS_CHARGE_MAX, nb));
  const faites = new Set(completions.filter((c) => c.done).map((c) => c.task_id));
  const out: ChargeJour[] = [];
  for (let i = 0; i < n; i++) {
    const jour = addDays(depuis, i);
    const taches = tasks.filter((t) => !estRecurrente(t) && t.due_date === jour && !faites.has(t.id)).length;
    const evts = evenements.filter((e) => e.date <= jour && (e.end_date ?? e.date) >= jour).length;
    out.push({ jour, elements: taches + evts });
  }
  return out;
}

/** Combien de jours de charge envoyer : jusqu'à l'échéance, ou quatre semaines. */
export function joursDeCharge(jour: string, echeance: string | null): number {
  if (!echeance || echeance < jour) return 28;
  return ecartEnJours(jour, echeance) + 1;
}

// ── #7 Découper ─────────────────────────────────────────────────────────────

export function payloadDecouper(lang: LangIa, jour: string, task: Task, goals: readonly Goal[]): PayloadDe<"decouper"> {
  const objectif = task.goal_id != null ? (goals.find((g) => g.id === task.goal_id)?.title ?? null) : null;
  return {
    lang,
    jour,
    tache: {
      titre: task.label.slice(0, 200),
      priorite: prioriteIa(task.priority),
      // Une échéance passée ne borne rien : les étapes partent d'aujourd'hui.
      echeance: task.due_date && task.due_date >= jour ? task.due_date : null,
      etiquette: task.tag?.slice(0, 60) ?? null,
      objectif: objectif?.slice(0, 200) ?? null,
    },
  };
}

/** Relie `enfant` à `parent` : la tâche d'origine « mène à » ses étapes. */
async function relierTaches(parentId: number, enfantId: number): Promise<void> {
  const [de, vers] = await Promise.all([uidDe("task", parentId), uidDe("task", enfantId)]);
  if (!de || !vers) return;
  await createLink({ from_kind: "task", from_uid: de, to_kind: "task", to_uid: vers, origin: "manual" });
}

/**
 * Crée les étapes validées : même objectif, même étiquette que la tâche
 * d'origine, reliées à elle. La tâche d'origine reste — c'est à l'utilisateur
 * de décider si elle a encore un sens.
 */
export async function appliquerDecoupage(
  parent: Task,
  etapes: ContratsIa["decouper"]["sortie"]["etapes"],
): Promise<number[]> {
  const ids: number[] = [];
  for (const e of etapes) {
    const id = await createTask({
      label: e.titre.trim(),
      tag: parent.tag,
      priority: e.priorite,
      recurrence: "none",
      goal_id: parent.goal_id,
      ...planificationDeSaisie("none", e.date ?? "", "", ""),
    });
    ids.push(id);
    await relierTaches(parent.id, id);
  }
  return ids;
}

// ── #8 Estimer ──────────────────────────────────────────────────────────────

/** Sous ce nombre de comparables, on dit qu'il n'y a pas assez d'historique — sans appeler le modèle. */
export const MIN_COMPARABLES = 3;
export const MAX_COMPARABLES = 30;
/** Un an d'historique Timer. */
export const JOURS_HISTORIQUE = 365;

export interface Comparable {
  id: string;
  titre: string;
  etiquette: string | null;
  /** Temps réel, arrondi à la minute : total pour une ponctuelle, médiane par occurrence pour une routine. */
  minutes: number;
  recurrente: boolean;
}

const MOTS_VIDES = new Set(
  "avec dans pour sans sous vers chez entre avant apres depuis leur leurs notre votre cette celui celle mais plus moins tres faire from with that this your into have will about".split(" "),
);

/** Les mots qui portent le sens d'un libellé : sans accent, quatre lettres au moins, hors mots vides. */
export function motsCles(libelle: string): Set<string> {
  return new Set(
    normaliser(libelle)
      .split(/[^a-z0-9]+/)
      .filter((m) => m.length >= 4 && !MOTS_VIDES.has(m)),
  );
}

function mediane(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Les comparables d'une tâche : celles qui ont un historique Timer UTILISABLE
 * et qui lui ressemblent (même étiquette, même objectif, mots en commun).
 *
 *   • une PONCTUELLE compte si elle est finie (sinon sa durée est partielle) :
 *     son temps total, tous jours confondus ;
 *   • une ROUTINE compte par OCCURRENCE : la médiane de ses jours travaillés.
 *
 * Classées par ressemblance, puis par taille d'historique ; au plus trente.
 */
export function comparablesDe(cible: Task, tasks: readonly Task[], historique: HistoriqueFocus): Comparable[] {
  const faites = new Set(historique.faites);
  const parTache = new Map<number, number[]>();
  for (const l of historique.sessions) {
    if (l.minutes <= 0) continue;
    const jours = parTache.get(l.task_id) ?? [];
    jours.push(l.minutes);
    parTache.set(l.task_id, jours);
  }
  const mots = motsCles(cible.label);
  const notes: Array<{ c: Comparable; score: number; poids: number }> = [];
  for (const t of tasks) {
    if (t.id === cible.id) continue;
    const jours = parTache.get(t.id);
    if (!jours?.length) continue;
    const recurrente = estRecurrente(t);
    if (!recurrente && !faites.has(t.id)) continue;
    let score = 0;
    if (cible.tag && t.tag && normaliser(t.tag) === normaliser(cible.tag)) score += 2;
    if (cible.goal_id != null && t.goal_id === cible.goal_id) score += 1;
    for (const m of motsCles(t.label)) if (mots.has(m)) score += 1;
    if (score === 0) continue;
    const brut = recurrente ? mediane(jours) : jours.reduce((a, b) => a + b, 0);
    const minutes = Math.round(brut);
    if (minutes < 1) continue;
    notes.push({
      c: { id: String(t.id), titre: t.label.slice(0, 200), etiquette: t.tag?.slice(0, 60) ?? null, minutes, recurrente },
      score,
      poids: jours.length,
    });
  }
  return notes
    .sort((a, b) => b.score - a.score || b.poids - a.poids || Number(a.c.id) - Number(b.c.id))
    .slice(0, MAX_COMPARABLES)
    .map((n) => n.c);
}

export function payloadEstimer(lang: LangIa, cible: Task, comparables: readonly Comparable[]): PayloadDe<"estimer"> {
  return {
    lang,
    tache: { titre: cible.label.slice(0, 200), etiquette: cible.tag?.slice(0, 60) ?? null },
    comparables: comparables.map((c) => ({ ...c })),
  };
}

export interface Fourchette {
  basse: number;
  haute: number;
  mediane: number;
  n: number;
}

/**
 * ⭐ LA FOURCHETTE EST CALCULÉE ICI, jamais par le modèle. Sur les comparables
 * RETENUS : de un à trois, du plus court au plus long ; à partir de quatre,
 * l'écart interquartile (le quart le plus court et le plus long écartés).
 * Bornes arrondies à 5 minutes, vers l'extérieur.
 */
export function fourchette(minutes: readonly number[]): Fourchette | null {
  const s = minutes.filter((m) => Number.isFinite(m) && m > 0).sort((a, b) => a - b);
  if (s.length === 0) return null;
  const rang = (q: number) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
  const [bas, haut] = s.length >= 4 ? [rang(0.25), rang(0.75)] : [s[0], s[s.length - 1]];
  const basse = Math.max(5, Math.floor(bas / 5) * 5);
  const haute = Math.max(basse, Math.ceil(haut / 5) * 5);
  return { basse, haute, mediane: Math.round(mediane(s)), n: s.length };
}

/** Les comparables que le modèle a retenus, dans l'ordre de la liste envoyée (ids inconnus ignorés). */
export function retenusParmi(comparables: readonly Comparable[], retenus: readonly string[]): Comparable[] {
  const ids = new Set(retenus);
  return comparables.filter((c) => ids.has(c.id));
}

// ── Objectifs (#11, #12, #13) ───────────────────────────────────────────────

export function objectifPourIa(goal: Goal): ObjectifPourIa {
  return {
    titre: goal.title.slice(0, 200),
    description: goal.description?.slice(0, 2000) ?? null,
    echeance: goal.deadline,
    horizon: goal.scope,
  };
}

/** Peut-on DÉCOMPOSER cet objectif, c'est-à-dire lui ajouter des sous-objectifs ? */
export function peutDecomposer(goal: Goal, goals: readonly Goal[]): boolean {
  return peutAjouterEtape(goal, "sous-objectif", goals);
}

/** Tous les descendants d'un objectif, dans l'ordre de l'arbre (garde anti-cycle). */
export function descendants(goal: Goal, goals: readonly Goal[]): Goal[] {
  const out: Goal[] = [];
  const vus = new Set<number>([goal.id]);
  const descendre = (id: number) => {
    const enfants = goals
      .filter((g) => g.parent_goal_id === id && !vus.has(g.id))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
    for (const e of enfants) {
      vus.add(e.id);
      out.push(e);
      descendre(e.id);
    }
  };
  descendre(goal.id);
  return out;
}

export function payloadDecomposer(
  lang: LangIa,
  jour: string,
  goal: Goal,
  goals: readonly Goal[],
  charge: ChargeJour[],
): PayloadDe<"decomposer_objectif"> {
  const existantes = goals
    .filter((g) => g.parent_goal_id === goal.id)
    .slice(0, 30)
    .map((g) => ({ titre: g.title.slice(0, 200) }));
  return { lang, jour, objectif: objectifPourIa(goal), existantes, charge };
}

/**
 * Crée les sous-objectifs validés, APRÈS les étapes existantes. Même règle que
 * la création à la main (`objectifs/creation.ts`) : sous-objectifs mesurés,
 * horizon et catégorie hérités. L'échéance proposée est gardée — l'utilisateur
 * l'a vue et pouvait la retirer.
 */
export async function appliquerEtapes(
  goal: Goal,
  goals: readonly Goal[],
  etapes: ContratsIa["decomposer_objectif"]["sortie"]["etapes"],
): Promise<void> {
  const freres = goals.filter((g) => g.parent_goal_id === goal.id);
  let position = freres.reduce((m, g) => Math.max(m, (g.position ?? 0) + 1), 0);
  for (const e of etapes) {
    await createGoal({
      title: e.titre.trim(),
      description: null,
      scope: goal.scope,
      category: goal.category,
      parent_goal_id: goal.id,
      deadline: e.echeance,
      progress_pct: 0,
      manual_progress: 0,
      is_milestone: 0,
      position: position++,
      priority: e.priorite,
    });
  }
}

export function payloadTachesObjectif(
  lang: LangIa,
  jour: string,
  goal: Goal,
  goals: readonly Goal[],
  tasks: readonly Task[],
  completions: readonly Completion[],
  charge: ChargeJour[],
): PayloadDe<"etapes_objectif"> {
  const arbre = descendants(goal, goals);
  const ids = new Set([goal.id, ...arbre.map((g) => g.id)]);
  const faites = new Set(completions.filter((c) => c.done).map((c) => c.task_id));
  const taches = tasks
    .filter((t) => t.goal_id != null && ids.has(t.goal_id) && !estRecurrente(t))
    .slice(0, 50)
    .map((t) => ({ titre: t.label.slice(0, 200), date: t.due_date, faite: faites.has(t.id) }));
  return {
    lang,
    jour,
    objectif: objectifPourIa(goal),
    etapes: arbre.slice(0, 30).map((g) => ({ id: String(g.id), titre: g.title.slice(0, 200), echeance: g.deadline })),
    taches,
    charge,
  };
}

/**
 * Crée les tâches validées. `etape` désigne une étape FOURNIE (le serveur l'a
 * vérifié) ; une étape disparue entre-temps (corbeille, synchronisation)
 * retombe sur l'objectif lui-même plutôt que de perdre la tâche.
 */
export async function appliquerTachesProposees(
  goal: Goal,
  goals: readonly Goal[],
  taches: readonly TacheProposee[],
): Promise<void> {
  const vivantes = new Set(descendants(goal, goals).map((g) => String(g.id)));
  for (const x of taches) {
    const cible = x.etape !== null && vivantes.has(x.etape) ? Number(x.etape) : goal.id;
    await createTask({
      label: x.titre.trim(),
      tag: null,
      priority: x.priorite,
      recurrence: "none",
      goal_id: cible,
      ...planificationDeSaisie("none", x.date ?? "", "", ""),
    });
  }
}

/** Le rythme réel des quatorze derniers jours, sur l'objectif et toutes ses étapes. */
export function rythme14j(
  goal: Goal,
  goals: readonly Goal[],
  tasks: readonly Task[],
  completions: readonly Completion[],
  jour: string,
): { tachesFaites14j: number; joursActifs14j: number } {
  const ids = new Set([goal.id, ...descendants(goal, goals).map((g) => g.id)]);
  const siennes = new Set(tasks.filter((t) => t.goal_id != null && ids.has(t.goal_id)).map((t) => t.id));
  const depuis = addDays(jour, -13);
  const dans = completions.filter((c) => c.done && siennes.has(c.task_id) && c.date >= depuis && c.date <= jour);
  return { tachesFaites14j: dans.length, joursActifs14j: new Set(dans.map((c) => c.date)).size };
}

export function payloadPeril(
  lang: LangIa,
  jour: string,
  p: ObjectifEnPeril,
  goals: readonly Goal[],
  tasks: readonly Task[],
  completions: readonly Completion[],
  charge: ChargeJour[],
  /** Habitudes et coches, comme pour la détection : une cible chiffrée peut en dépendre. */
  contexte: Partial<ContexteProgression> = {},
): PayloadDe<"objectif_peril"> {
  const faites = new Set(completions.filter((c) => c.done).map((c) => c.task_id));
  // Les étapes directes NON ACHEVÉES, mesurées par la règle unique — celles que
  // le péril a comptées.
  const sources = { goals, tasks, completions, ...contexte, maintenant: contexte.maintenant ?? `${jour} 00:00` };
  const etapes = goals.filter((g) => g.parent_goal_id === p.goal.id && !g.is_example && !estAcheve(mesurer(g, sources)));
  const restantes = tasks.filter((t) => t.goal_id === p.goal.id && !estRecurrente(t) && !faites.has(t.id));
  return {
    lang,
    jour,
    objectif: {
      titre: p.goal.title.slice(0, 200),
      echeance: p.goal.deadline!,
      joursRestants: p.joursRestants,
      progression: Math.max(0, Math.min(100, Math.round(p.progression))),
      declaratif: p.declaratif,
      raison: p.raison,
      racine: p.racine?.title.slice(0, 200) ?? null,
    },
    etapesRestantes: etapes.slice(0, 20).map((g) => ({ id: String(g.id), titre: g.title.slice(0, 200), echeance: g.deadline })),
    tachesRestantes: restantes.slice(0, 30).map((t) => ({ titre: t.label.slice(0, 200), date: t.due_date })),
    rythme: rythme14j(p.goal, goals, tasks, completions, jour),
    charge,
  };
}

/** Le dernier jour où une tâche de rattrapage peut tomber (copie de `limitePeril`, côté serveur). */
export function limitePeril(jour: string, echeance: string): string {
  return echeance >= jour ? echeance : addDays(jour, 30);
}

function prioriteIa(p: string): PrioriteIa {
  return p === "low" || p === "high" ? p : "medium";
}
