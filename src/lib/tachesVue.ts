import { estPrevueLe } from "./logic";
import { racineDe } from "./objectifs/structure";
import { rangPriorite } from "./priorite";
import { aRelancer, estRecurrente, etatDe } from "./taches";
import type { Completion, Goal, Task } from "./types";

/**
 * ⭐ LA VUE TÂCHES, RANGÉE PAR MOMENT (refonte du 2026-09-30).
 *
 * Antonin : « améliore le design de l'onglet Tâches, son intuitivité ». La
 * liste d'avant était PLATE : toutes les tâches à la suite, triées par
 * priorité, sans aucune date à l'écran — alors que les tâches en portent une
 * depuis la migration 020. Une tâche en retard se lisait comme une tâche du
 * mois prochain. La question que la vue doit régler d'un coup d'œil est
 * « qu'est-ce que je fais maintenant ? » : on range donc par MOMENT.
 *
 * Six sections, dans cet ordre, et une tâche n'est que dans une seule :
 *   • En retard   — datée, non faite, due AVANT aujourd'hui ;
 *   • Aujourd'hui — datée d'aujourd'hui, ou récurrente due aujourd'hui ;
 *   • À venir     — datée, plus tard ;
 *   • Sans date   — ponctuelle, sans échéance ;
 *   • Routines    — récurrente, PAS due aujourd'hui (elle reviendra seule) ;
 *   • Faites      — ponctuelle cochée un jour, ou récurrente cochée AUJOURD'HUI.
 *
 * ⭐ Deux de plus depuis l'état des tâches (migration 031, 2026-10-20) :
 *   • En attente   — après « Sans date » : bloquée par quelqu'un ou quelque
 *                    chose. Le jour de sa relance, elle remonte dans
 *                    « Aujourd'hui » (badge « À relancer ») ;
 *   • Abandonnées  — tout en bas, après « Faites ».
 *
 * ⚠️ Une récurrente manquée n'est jamais « en retard » (`lib/taches.ts`) : elle
 * reste dans les routines. C'est la règle de l'app, pas un choix de la vue.
 *
 * Logique pure : ni base, ni horloge. Le jour s'injecte.
 */

export type CleSection =
  | "retard"
  | "aujourdhui"
  | "avenir"
  | "sansDate"
  | "attente"
  | "routines"
  | "faites"
  | "abandonnees";

/** L'ordre d'affichage. ⚠️ Des CLÉS : les libellés se traduisent dans la vue. */
export const ORDRE_SECTIONS: readonly CleSection[] = [
  "retard",
  "aujourdhui",
  "avenir",
  "sansDate",
  "attente",
  "routines",
  "faites",
  "abandonnees",
];

export interface LigneVue extends Task {
  /** Cochée, au sens de la vue (voir `estFaite`). */
  done: boolean;
  /** Le jour de la coche qui la dit faite — pour ranger les faites, la plus récente d'abord. */
  faiteLe: string | null;
}

/**
 * Faite, au sens de la vue : une RÉCURRENTE l'est si elle est cochée
 * aujourd'hui (demain, elle revient) ; une PONCTUELLE, si elle l'a été un jour
 * quelconque. C'est la règle de l'ancienne vue, gardée telle quelle.
 */
export function estFaite(task: Task, completions: readonly Completion[], aujourdhui: string): { faite: boolean; le: string | null } {
  if (estRecurrente(task)) {
    const c = completions.find((x) => x.task_id === task.id && x.date === aujourdhui && x.done);
    return { faite: !!c, le: c ? aujourdhui : null };
  }
  let le: string | null = null;
  for (const c of completions) {
    if (c.task_id !== task.id || !c.done) continue;
    if (le == null || c.date > le) le = c.date;
  }
  return { faite: le != null, le };
}

/** La section d'une tâche, pour un jour donné. */
export function sectionDe(task: Task, faite: boolean, aujourdhui: string): CleSection {
  if (faite) return "faites";
  const etat = etatDe(task);
  if (etat === "dropped") return "abandonnees";
  if (etat === "waiting") return aRelancer(task, aujourdhui) ? "aujourdhui" : "attente";
  // ⭐ « Aujourd'hui » se lit dans la règle unique (`estPrevueLe`, `lib/logic.ts`) :
  // c'est elle qui fait que le sous-titre de la vue et la carte d'Aujourd'hui
  // comptent les mêmes tâches (2026-10-11).
  if (estPrevueLe(task, aujourdhui)) return "aujourdhui";
  if (estRecurrente(task)) return "routines";
  if (!task.due_date) return "sansDate";
  return task.due_date < aujourdhui ? "retard" : "avenir";
}

/** Minuscule, sans accent : « Réviser » se trouve en tapant « revis ». */
export function normaliser(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Une tâche répond-elle à la recherche ? Son libellé, son tag et le titre de
 * son objectif — les trois choses qu'on voit sur sa ligne. Tous les mots
 * doivent s'y trouver, dans n'importe quel ordre.
 */
export function correspond(task: Pick<Task, "label" | "tag">, objectif: string | null, requete: string): boolean {
  const mots = normaliser(requete).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return true;
  const texte = normaliser([task.label, task.tag ?? "", objectif ?? ""].join(" "));
  return mots.every((m) => texte.includes(m));
}

/** L'ordre à l'intérieur d'une section — ce qu'on fera en premier, en haut. */
function comparer(section: CleSection): (a: LigneVue, b: LigneVue) => number {
  const parPriorite = (a: LigneVue, b: LigneVue) => rangPriorite(a.priority) - rangPriorite(b.priority);
  const parLibelle = (a: LigneVue, b: LigneVue) => a.label.localeCompare(b.label);
  const enCours = (t: LigneVue) => (etatDe(t) === "doing" ? 1 : 0);
  switch (section) {
    case "retard":
    case "avenir":
      // La plus proche d'abord ; le même jour, l'heure, puis la priorité.
      return (a, b) =>
        (a.due_date ?? "").localeCompare(b.due_date ?? "") ||
        (a.start_at ?? "99").localeCompare(b.start_at ?? "99") ||
        parPriorite(a, b) ||
        parLibelle(a, b);
    case "aujourdhui":
      // Ce qui a une HEURE d'abord, dans l'ordre de la journée ; le reste par
      // priorité — et, à priorité égale, ce qui est EN COURS avant le reste.
      return (a, b) =>
        (a.start_at ?? "99").localeCompare(b.start_at ?? "99") ||
        parPriorite(a, b) ||
        enCours(b) - enCours(a) ||
        parLibelle(a, b);
    case "sansDate":
      // La plus récente en haut à priorité égale : c'est celle qu'on vient d'ajouter.
      return (a, b) => parPriorite(a, b) || b.id - a.id;
    case "attente":
      // La relance la plus proche d'abord ; sans relance, après.
      return (a, b) =>
        (a.follow_up_on ?? "9999").localeCompare(b.follow_up_on ?? "9999") || parPriorite(a, b) || parLibelle(a, b);
    case "abandonnees":
      // La dernière abandonnée d'abord.
      return (a, b) => (b.state_since ?? "").localeCompare(a.state_since ?? "") || b.id - a.id;
    case "routines":
      return (a, b) => parPriorite(a, b) || parLibelle(a, b);
    case "faites":
      // La dernière cochée d'abord.
      return (a, b) => (b.faiteLe ?? "").localeCompare(a.faiteLe ?? "") || b.id - a.id;
  }
}

/**
 * Range les tâches par section, chacune triée.
 *
 * `coche` : l'état AFFICHÉ de la case (la coche optimiste — voir
 * `useCochesOptimistes`) ; par défaut, celui de la base.
 * `garder` : les tâches qu'on vient de cocher restent un instant dans la
 * section où l'on a cliqué — une ligne qui s'enfuit sous le curseur au moment
 * du clic, on ne voit même pas qu'on l'a cochée.
 */
export function ranger(
  tasks: readonly Task[],
  completions: readonly Completion[],
  aujourdhui: string,
  options: {
    coche?: (task: Task, faite: boolean) => boolean;
    garder?: ReadonlyMap<number, CleSection>;
  } = {},
): Map<CleSection, LigneVue[]> {
  const out = new Map<CleSection, LigneVue[]>(ORDRE_SECTIONS.map((s) => [s, []]));
  for (const task of tasks) {
    const { faite, le } = estFaite(task, completions, aujourdhui);
    const done = options.coche ? options.coche(task, faite) : faite;
    const section = options.garder?.get(task.id) ?? sectionDe(task, done, aujourdhui);
    out.get(section)!.push({ ...task, done, faiteLe: done ? (le ?? aujourdhui) : null });
  }
  for (const s of ORDRE_SECTIONS) out.get(s)!.sort(comparer(s));
  return out;
}

// ─── Rangée par OBJECTIF (2026-10-11) ────────────────────────────────────────

/**
 * ⭐ LA MÊME VUE, RANGÉE PAR OBJECTIF.
 *
 * Antonin : « trie-la par objectifs si ça peut être utile ». Deux utilisateurs
 * du crible ont cherché « ce qui tombe cette semaine pour un objectif » sans le
 * trouver : la vue par moment mêle les tâches de tous les objectifs.
 *
 *   • une section par objectif RACINE — les tâches de ses étapes comprises,
 *     l'étape nommée sur la ligne (`etape`) ;
 *   • dans une section : les retards en tête, puis par échéance, puis sans date ;
 *     à date égale l'heure, puis la priorité ;
 *   • « Sans objectif » en dernier ;
 *   • les routines et les tâches faites gardent leur section à part — une
 *     routine revient seule, elle n'est pas « ce qui reste à faire » d'un
 *     objectif, et son objectif se lit sur sa ligne.
 *
 * ⚠️ Le rattachement lu est `goal_id`, celui que la ligne affiche déjà. Un
 * objectif absent de `goals` (en corbeille) : la tâche est « Sans objectif ».
 */

/** Le rangement de la vue — retenu dans le réglage `taches.rangement`. */
export type Rangement = "moment" | "objectif";

export const RANGEMENT_PAR_DEFAUT: Rangement = "moment";

/** Ce qu'un réglage lu en base vaut : tout ce qui n'est pas « objectif » est le défaut. */
export function rangementDe(valeur: string | null | undefined): Rangement {
  return valeur === "objectif" ? "objectif" : RANGEMENT_PAR_DEFAUT;
}

export interface LigneObjectif extends LigneVue {
  /** L'étape qui porte la tâche — `null` si elle tient à l'objectif lui-même, ou à aucun. */
  etape: Goal | null;
  /** Son moment (`sectionDe`) : c'est lui qui dit comment écrire sa date. */
  moment: CleSection;
}

export interface GroupeObjectif {
  /** Stable d'un rendu à l'autre : `o:<id>`, `sansObjectif`, `routines`, `faites`, `abandonnees`. */
  cle: string;
  genre: "objectif" | "sansObjectif" | "routines" | "faites" | "abandonnees";
  /** L'objectif racine d'une section `objectif`. */
  racine: Goal | null;
  lignes: LigneObjectif[];
}

/** La clé de la section d'un objectif racine. */
export const cleObjectif = (id: number) => `o:${id}`;

/** Dans une section d'objectif : les retards, puis l'échéance, puis sans date. */
function parEcheance(a: LigneObjectif, b: LigneObjectif): number {
  return (
    // « 9999 » : sans date, après toutes les dates. Les retards sont les dates
    // les plus anciennes, donc en tête sans règle de plus.
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
    (a.start_at ?? "99").localeCompare(b.start_at ?? "99") ||
    rangPriorite(a.priority) - rangPriorite(b.priority) ||
    a.label.localeCompare(b.label)
  );
}

/**
 * Range les tâches par objectif racine. Ne rend que les sections qui ont au
 * moins une ligne.
 *
 * `garder` : comme dans `ranger`, une tâche qu'on vient de cocher reste un
 * instant dans la section (par sa `cle`) où l'on a cliqué.
 */
export function rangerParObjectif(
  tasks: readonly Task[],
  completions: readonly Completion[],
  goals: readonly Goal[],
  aujourdhui: string,
  options: {
    coche?: (task: Task, faite: boolean) => boolean;
    garder?: ReadonlyMap<number, string>;
  } = {},
): GroupeObjectif[] {
  const parId = new Map(goals.map((g) => [g.id, g]));
  const racines = new Map<number, Goal>();
  const groupes = new Map<string, GroupeObjectif>();
  const groupe = (cle: string, genre: GroupeObjectif["genre"], racine: Goal | null) => {
    let g = groupes.get(cle);
    if (!g) groupes.set(cle, (g = { cle, genre, racine, lignes: [] }));
    return g;
  };

  for (const task of tasks) {
    const { faite, le } = estFaite(task, completions, aujourdhui);
    const done = options.coche ? options.coche(task, faite) : faite;
    const direct = task.goal_id != null ? (parId.get(task.goal_id) ?? null) : null;
    const racine = direct ? racineDe(direct, goals) : null;
    if (racine) racines.set(racine.id, racine);
    const ligne: LigneObjectif = {
      ...task,
      done,
      faiteLe: done ? (le ?? aujourdhui) : null,
      etape: direct && racine && direct.id !== racine.id ? direct : null,
      moment: sectionDe(task, done, aujourdhui),
    };

    const naturelle = done
      ? "faites"
      : etatDe(task) === "dropped"
        ? "abandonnees"
        : estRecurrente(task)
        ? "routines"
        : racine
          ? cleObjectif(racine.id)
          : "sansObjectif";
    const cle = options.garder?.get(task.id) ?? naturelle;
    const genre: GroupeObjectif["genre"] =
      cle === "faites" || cle === "routines" || cle === "sansObjectif" || cle === "abandonnees" ? cle : "objectif";
    // Gardée dans la section d'un objectif : c'est forcément le sien.
    groupe(cle, genre, genre === "objectif" ? racine : null).lignes.push(ligne);
  }

  const out: GroupeObjectif[] = [];
  // Les objectifs dans l'ordre de leur feuille de route (position, puis création).
  const ordonnees = [...racines.values()].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
  for (const racine of ordonnees) {
    const g = groupes.get(cleObjectif(racine.id));
    if (g) out.push({ ...g, lignes: g.lignes.sort(parEcheance) });
  }
  const sans = groupes.get("sansObjectif");
  if (sans) out.push({ ...sans, lignes: sans.lignes.sort(parEcheance) });
  const routines = groupes.get("routines");
  if (routines) {
    // Celles du jour d'abord : ce sont les seules qu'on peut tenir maintenant.
    const duJour = (l: LigneObjectif) => (l.moment === "aujourdhui" ? 0 : 1);
    out.push({
      ...routines,
      lignes: routines.lignes.sort(
        (a, b) => duJour(a) - duJour(b) || rangPriorite(a.priority) - rangPriorite(b.priority) || a.label.localeCompare(b.label),
      ),
    });
  }
  const faites = groupes.get("faites");
  if (faites) out.push({ ...faites, lignes: faites.lignes.sort(comparer("faites")) });
  const abandonnees = groupes.get("abandonnees");
  if (abandonnees) out.push({ ...abandonnees, lignes: abandonnees.lignes.sort(comparer("abandonnees")) });
  return out;
}
