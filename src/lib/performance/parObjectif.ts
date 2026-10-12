import { ecartEnJours, objectifsEnPeril, type ObjectifEnPeril } from "../calendrier/peril";
import { addDays, weekdayOf } from "../logic";
import { estAcheve, mesurer, uidDeLigne, type SourcesProgression } from "../objectifs/progression";
import { estExemple } from "../onboarding/exemples";
import type { Completion, FocusSession, Goal, Habit, HabitCheck, Task } from "../types";
import { minutesDeSeance, seancesDeFocus } from "./analyse";

/**
 * ⭐ « PAR OBJECTIF » — UN ESSAI (2026-10-11). L'onglet de Performance qui met
 * les heures PASSÉES sur un objectif en face des heures PROMISES.
 *
 * D'OÙ IL VIENT. La fiche « Semaine » du labo : « J'ai promis cinq heures par
 * semaine à mon projet. Combien j'y ai mis cette semaine, et serai-je prêt à la
 * date ? ». Elle a été prototypée deux fois (un module, un bloc sur la page
 * d'un objectif) ; le jury a rendu deux « à retravailler ». Antonin : « on peut
 * tester à voir ce que ça apporte et si un onglet dans Performance ne suffirait
 * pas ». Ce fichier reprend le CALCUL du prototype « Rythme », relu ; rien de
 * son écran, ni de son magasin en mémoire.
 *
 * ⚠️ C'EST UN ESSAI, ISOLÉ POUR SE RETIRER D'UN BLOC : ce fichier,
 * `promesses.ts`, `components/performance/ParObjectif.tsx`, le sélecteur en
 * tête de `PerformanceView`, et l'écriture de la promesse dans
 * `onboarding/semer.ts`. Rien d'autre n'en dépend.
 *
 * D'OÙ VIENT CHAQUE NOMBRE
 *   • une minute passée = une séance du minuteur de genre `focus`, TERMINÉE,
 *     rangée au jour de son DÉBUT (`seancesDeFocus`) et mesurée par
 *     `minutesDeSeance` : arrondie à la minute, séance par séance — l'arrondi
 *     de la vue Timer. Deux écrans qui additionnent les mêmes séances rendent
 *     le même total ;
 *   • le rattachement : séance → sa tâche → l'objectif de la tâche → l'objectif
 *     RACINE (une tâche posée sur une étape compte pour l'objectif entier).
 *     Sans tâche, tâche sans objectif, tâche ou objectif disparus (corbeille) :
 *     « hors objectif » — montré, JAMAIS réparti ;
 *   • la semaine va du LUNDI au DIMANCHE, aujourd'hui compris.
 *
 * ⚠️ TROIS « CETTE SEMAINE » DANS L'APP, et celle-ci est la troisième : la
 * tuile du Timer compte sept jours GLISSANTS (aujourd'hui compris), la vue
 * d'ensemble de Performance sept jours FINIS. Les totaux ne coïncident avec
 * ceux du Timer que le dimanche. L'écran écrit donc toujours ses dates.
 *
 * CE QU'IL NE FAIT PAS, EXPRÈS
 *   • aucune promesse tracée sur une semaine PASSÉE : la base ne garde que la
 *     promesse d'aujourd'hui, et l'appliquer au passé prêtait aux gens des
 *     échecs qu'ils n'avaient pas eus (relevé par les trois utilisateurs des
 *     prototypes) ;
 *   • aucun zéro avant la création de l'objectif ;
 *   • aucun pronostic. « Serai-je prêt ? » reçoit des FAITS (`faitDEcheance`).
 */

// ─── La semaine ──────────────────────────────────────────────────────────────

export interface Semaine {
  /** Le lundi, 'YYYY-MM-DD'. */
  debut: string;
  /** Le dimanche, 'YYYY-MM-DD'. */
  fin: string;
}

/** La semaine (lundi → dimanche) qui contient ce jour. Le dimanche la CLÔT. */
export function semaineDe(jour: string): Semaine {
  const depuisLundi = (weekdayOf(jour) + 6) % 7; // `getDay()` : 0 = dimanche
  const debut = addDays(jour, -depuisLundi);
  return { debut, fin: addDays(debut, 6) };
}

/** Les `n` dernières semaines, la plus ancienne d'abord, celle de `jour` en dernier. */
export function dernieresSemaines(jour: string, n: number): Semaine[] {
  const courante = semaineDe(jour);
  const out: Semaine[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const debut = addDays(courante.debut, -7 * i);
    out.push({ debut, fin: addDays(debut, 6) });
  }
  return out;
}

// ─── Le rattachement ─────────────────────────────────────────────────────────

/** Pour chaque objectif (racine ou étape), l'id de son objectif RACINE. */
export function racinesParObjectif(goals: readonly Goal[]): Map<number, number> {
  const parId = new Map(goals.map((g) => [g.id, g]));
  const out = new Map<number, number>();
  for (const g of goals) {
    const vus = new Set<number>([g.id]);
    let courant = g;
    while (courant.parent_goal_id != null) {
      const parent = parId.get(courant.parent_goal_id);
      if (!parent || vus.has(parent.id)) break; // parent absent ou boucle : on s'arrête là
      vus.add(parent.id);
      courant = parent;
    }
    out.set(g.id, courant.id);
  }
  return out;
}

export interface Repartition {
  /** Minutes par objectif RACINE. Un objectif sans séance n'a pas d'entrée. */
  parObjectif: Map<number, number>;
  /** Séances sans tâche, ou dont la tâche n'a pas d'objectif. */
  horsObjectif: number;
  /** Toutes les séances de la période. Toujours `somme(parObjectif) + horsObjectif`. */
  total: number;
}

/** Le temps du minuteur sur une période, rangé par objectif racine. */
export function repartir(
  sessions: readonly FocusSession[],
  tasks: readonly Task[],
  goals: readonly Goal[],
  debut: string,
  fin: string,
): Repartition {
  const racines = racinesParObjectif(goals);
  const taches = new Map(tasks.map((x) => [x.id, x]));
  const parObjectif = new Map<number, number>();
  let horsObjectif = 0;
  let total = 0;
  for (const s of seancesDeFocus(sessions, debut, fin)) {
    const minutes = minutesDeSeance(s);
    total += minutes;
    const tache = s.task_id != null ? taches.get(s.task_id) : undefined;
    const racine = tache?.goal_id != null ? racines.get(tache.goal_id) : undefined;
    if (racine == null) horsObjectif += minutes;
    else parObjectif.set(racine, (parObjectif.get(racine) ?? 0) + minutes);
  }
  return { parObjectif, horsObjectif, total };
}

// ─── La promesse ─────────────────────────────────────────────────────────────

/** Ce qu'il reste à passer cette semaine pour tenir la promesse, en minutes (jamais négatif). */
export function resteDu(minutesPassees: number, heuresPromises: number): number {
  return Math.max(0, Math.round(heuresPromises * 60) - minutesPassees);
}

/**
 * L'objectif est-il né PENDANT cette semaine, après son lundi ? Sa première
 * semaine est alors incomplète : lui réclamer toute la promesse « d'ici
 * dimanche » (cinq heures à quelqu'un qui vient de créer son objectif un
 * dimanche soir) serait faux. Né le lundi, la semaine est entière.
 *
 * ⚠️ LIMITE CONNUE : la règle lit la date de création de l'OBJECTIF, pas celle
 * de la promesse (elle n'est pas datée). Une promesse posée un vendredi sur un
 * vieil objectif affiche bien « reste 5 h d'ici dimanche ».
 */
export function semaineEntamee(creeLe: string | null | undefined, semaine: Semaine): boolean {
  const jour = (creeLe ?? "").slice(0, 10);
  return jour > semaine.debut && jour <= semaine.fin;
}

// ─── L'échéance : des faits ──────────────────────────────────────────────────

/**
 * « Serai-je prêt à la date ? » — la question que personne n'a obtenue dans les
 * six essais des prototypes. L'app ne sait PAS y répondre : il faudrait une
 * estimation du travail restant, qu'elle n'a pas. Elle rend donc des FAITS :
 *
 *   • la règle des objectifs en péril (`calendrier/peril.ts`) signale cet
 *     objectif → on reprend SON verdict, tel que le Calendrier l'écrit. Rien
 *     n'est recalculé ici : `perils` est le résultat d'`objectifsEnPeril()` ;
 *   • sinon, échéance à venir → les semaines PLEINES qui restent (sept jours
 *     chacune, à partir d'aujourd'hui) et, s'il y a une promesse, les heures
 *     qu'elle y met : `semaines × heures`. Un produit que chacun peut refaire
 *     de tête — pas un rythme extrapolé, pas un « à ce train, fini le… » ;
 *   • pas d'échéance, ou objectif achevé → `null`, et l'écran n'affiche rien.
 */
export type FaitEcheance =
  | { genre: "peril"; peril: ObjectifEnPeril }
  | {
      genre: "a-venir";
      echeance: string;
      joursRestants: number;
      /** Semaines pleines d'ici l'échéance (`⌊jours / 7⌋`). */
      semaines: number;
      /** `semaines × promesse`, ou `null` sans promesse. */
      heures: number | null;
    }
  | null;

export function faitDEcheance(
  goal: Pick<Goal, "id" | "deadline">,
  perils: readonly ObjectifEnPeril[],
  acheve: boolean,
  promesse: number | null,
  aujourdhui: string,
): FaitEcheance {
  if (!goal.deadline || acheve) return null;
  const peril = perils.find((x) => x.goal.id === goal.id);
  if (peril) return { genre: "peril", peril };
  const joursRestants = ecartEnJours(aujourdhui, goal.deadline);
  if (joursRestants < 0) return null; // dépassée et non signalée : la règle n'a rien dit, nous non plus
  const semaines = Math.floor(joursRestants / 7);
  return {
    genre: "a-venir",
    echeance: goal.deadline,
    joursRestants,
    semaines,
    heures: promesse != null && promesse > 0 ? Math.round(semaines * promesse * 4) / 4 : null,
  };
}

// ─── Le tableau de l'onglet ──────────────────────────────────────────────────

/** Les semaines PRÉCÉDENTES montrées, au plus. La semaine en cours s'y ajoute. */
export const SEMAINES_PASSEES = 8;

export interface SemaineMesuree extends Semaine {
  minutes: number;
}

export interface LigneObjectif {
  goal: Goal;
  /** La clé de sa promesse dans le réglage (`uidDeLigne`). */
  uid: string;
  /** Minutes de la semaine en cours, aujourd'hui compris. */
  minutes: number;
  /** Heures promises par semaine, ou `null` : la ligne ne montre alors que le temps passé. */
  promesse: number | null;
  /** Minutes qu'il reste d'ici dimanche. `null` sans promesse, ou la semaine où l'objectif est né. */
  reste: number | null;
  /** La promesse de la semaine est atteinte. */
  tenue: boolean;
  /** L'objectif est né cette semaine, après lundi : pas de « reste ». */
  premiereSemaine: boolean;
  /**
   * Les semaines précédentes, la plus ancienne d'abord. ⚠️ Seulement celles où
   * l'objectif EXISTAIT : pas de zéro inventé avant sa création.
   */
  passees: SemaineMesuree[];
  /** La moyenne des semaines précédentes, en minutes ; `null` s'il n'y en a aucune. */
  moyennePassee: number | null;
  echeance: FaitEcheance;
}

export interface TableauParObjectif {
  semaine: Semaine;
  lignes: LigneObjectif[];
  /** « Hors objectif » : la semaine en cours, et les précédentes depuis la première séance du compte. */
  horsObjectif: { minutes: number; passees: SemaineMesuree[] };
  /** Tout le minuteur de la semaine. Toujours `somme(lignes) + hors objectif`. */
  total: number;
  /** La plus grande semaine du tableau, toutes lignes confondues : l'échelle commune des barres. */
  maxSemaine: number;
  /** Aucune séance cette semaine : l'écran dit d'où viennent les heures. */
  semaineSansMinuteur: boolean;
}

/** L'ordre de la liste des Objectifs : le long terme d'abord, puis l'échéance. */
const ORDRE_PORTEE: Record<Goal["scope"], number> = { long: 0, medium: 1, short: 2 };

export function tableauParObjectif(p: {
  goals: readonly Goal[];
  tasks: readonly Task[];
  completions: readonly Completion[];
  habits?: readonly Habit[];
  habitChecks?: readonly HabitCheck[];
  focusSessions: readonly FocusSession[];
  /** `uid d'objectif → heures par semaine` (`lirePromesses`). */
  promesses: ReadonlyMap<string, number>;
  today: string;
}): TableauParObjectif {
  const { goals, tasks, focusSessions, today } = p;
  const semaines = dernieresSemaines(today, SEMAINES_PASSEES + 1);
  const courante = semaines[semaines.length - 1];

  // UNE répartition par semaine, lue par toutes les lignes : la somme des
  // lignes et du hors objectif vaut le total par construction.
  const parSemaine = semaines.map((s) => repartir(focusSessions, tasks, goals, s.debut, s.fin));
  const ici = parSemaine[parSemaine.length - 1];

  // Le péril, appelé comme le Calendrier l'appelle (mêmes sources, même règle).
  const contexte = { habits: p.habits, habitChecks: p.habitChecks };
  const perils = objectifsEnPeril(goals, tasks, p.completions, today, contexte);
  const sources: SourcesProgression = { goals, tasks, completions: p.completions, ...contexte, maintenant: `${today} 00:00` };

  // « Racine » au sens de `repartir` : l'objectif qui est sa propre racine. Une
  // étape dont le parent a disparu en est une — son temps a donc sa ligne, au
  // lieu de s'évaporer du total.
  const racines = racinesParObjectif(goals);
  const lignes: LigneObjectif[] = [];
  for (const goal of goals) {
    if (racines.get(goal.id) !== goal.id) continue;
    const minutes = ici.parObjectif.get(goal.id) ?? 0;
    const creeLe = (goal.created_at ?? "").slice(0, 10);
    const passees: SemaineMesuree[] = [];
    semaines.slice(0, -1).forEach((s, i) => {
      if (s.fin < creeLe) return; // l'objectif n'existait pas : aucune barre, pas un zéro
      passees.push({ ...s, minutes: parSemaine[i].parObjectif.get(goal.id) ?? 0 });
    });
    // Un exemple de départ que personne n'a touché n'est pas un projet : il
    // n'a sa ligne que si du temps y a réellement été passé (le total doit
    // rester la somme des lignes).
    if (estExemple(goal) && minutes === 0 && passees.every((s) => s.minutes === 0)) continue;

    const uid = uidDeLigne("goal", goal);
    const promesse = p.promesses.get(uid) ?? null;
    const premiereSemaine = semaineEntamee(goal.created_at, courante);
    const reste = promesse == null || premiereSemaine ? null : resteDu(minutes, promesse);
    lignes.push({
      goal,
      uid,
      minutes,
      promesse,
      reste,
      tenue: promesse != null && resteDu(minutes, promesse) === 0,
      premiereSemaine,
      passees,
      moyennePassee: passees.length ? Math.round(passees.reduce((a, s) => a + s.minutes, 0) / passees.length) : null,
      echeance: faitDEcheance(goal, perils, estAcheve(mesurer(goal, sources)), promesse, today),
    });
  }
  lignes.sort(
    (a, b) =>
      ORDRE_PORTEE[a.goal.scope] - ORDRE_PORTEE[b.goal.scope] ||
      (a.goal.deadline ?? "9999").localeCompare(b.goal.deadline ?? "9999") ||
      a.goal.id - b.goal.id,
  );

  // « Hors objectif » n'a pas de date de création : ses semaines commencent à
  // la première séance du compte — avant, un zéro serait inventé là aussi.
  let premiere = "";
  for (const s of focusSessions) {
    if (s.kind !== "focus" || !s.ended_at) continue;
    const jour = s.started_at.slice(0, 10);
    if (!premiere || jour < premiere) premiere = jour;
  }
  const horsPassees: SemaineMesuree[] = [];
  semaines.slice(0, -1).forEach((s, i) => {
    if (!premiere || s.fin < premiere) return;
    horsPassees.push({ ...s, minutes: parSemaine[i].horsObjectif });
  });

  const horsMinutes = ici.horsObjectif;

  const maxSemaine = Math.max(
    0,
    horsMinutes,
    ...horsPassees.map((s) => s.minutes),
    ...lignes.flatMap((l) => [l.minutes, ...l.passees.map((s) => s.minutes)]),
  );

  return {
    semaine: courante,
    lignes,
    horsObjectif: { minutes: horsMinutes, passees: horsPassees },
    total: ici.total,
    maxSemaine,
    semaineSansMinuteur: ici.total === 0,
  };
}

// ─── Les heures : écrire, lire ───────────────────────────────────────────────

/** Au-delà, ce n'est plus une promesse à un projet « à côté ». */
export const HEURES_MAX = 80;

/**
 * Une saisie d'heures par semaine : « 5 », « 2,5 », « 2.5 », « 2h30 », « 2 h 30 ».
 *   • vide ou zéro  → `0` : la promesse est retirée ;
 *   • illisible     → `null` : on ne touche à rien ;
 *   • sinon des heures, au quart d'heure, bornées à `HEURES_MAX`.
 */
export function lireHeures(saisie: string): number | null {
  const brut = saisie.trim().toLowerCase().replace(/\s+/g, "");
  if (brut === "") return 0;
  let heures: number;
  const hm = brut.match(/^(\d{1,2})h(\d{1,2})?$/);
  if (hm) {
    const minutes = hm[2] ? Number(hm[2]) : 0;
    if (minutes >= 60) return null;
    heures = Number(hm[1]) + minutes / 60;
  } else if (/^\d+([.,]\d+)?$/.test(brut)) {
    heures = Number(brut.replace(",", "."));
  } else {
    return null;
  }
  if (!Number.isFinite(heures)) return null;
  return Math.min(HEURES_MAX, Math.round(heures * 4) / 4);
}

/** Ce qui se met dans le champ pour modifier une promesse : « 5 », « 2,5 » ou « 2.5 ». */
export function heuresPourChamp(heures: number | null, virgule = ","): string {
  return heures == null || heures <= 0 ? "" : String(heures).replace(".", virgule);
}
