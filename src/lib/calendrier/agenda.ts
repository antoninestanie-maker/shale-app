import { occurrenceLe, toDateStr, weekdayOf } from "../logic";
import { estDatee, estRecurrente } from "../taches";
import type { CalendarEvent, Completion, Goal, Task } from "../types";

/**
 * Ce qui occupe une journée — logique pure.
 *
 * Le calendrier ne possède aucune donnée en propre : il RASSEMBLE ce que
 * quatre modules savent déjà, et c'est tout son intérêt. Personne ne croisait
 * ces quatre sources avant lui.
 *
 * ⚠️ Aucune horloge implicite, aucune base : le jour s'injecte. C'est ce qui
 * rend « la semaine prochaine » testable sans attendre lundi.
 */

/**
 * Les quatre familles, dans l'ORDRE DE PRIORITÉ décidé par Antonin. L'ordre
 * n'est pas cosmétique : c'est celui dans lequel une journée se lit.
 */
export type EntreeKind = "event" | "task" | "recurrence" | "deadline" | "echeance";

const RANG: Record<EntreeKind, number> = {
  event: 0,
  task: 1,
  recurrence: 2,
  deadline: 3,
  // ⭐ Les échéances de facturation arrivent en DERNIER, et c'est délibéré :
  // une facture ne se « fait » pas, elle arrive à terme. Elle informe la
  // journée, elle ne l'occupe pas.
  echeance: 4,
};

export interface EntreeAgenda {
  kind: EntreeKind;
  /** `id` de la ligne d'origine, dans SA table. Deux familles peuvent partager un id. */
  id: number;
  titre: string;
  /** Le jour où cette entrée est LUE. Pour un multi-jours, il y en a plusieurs. */
  date: string;
  /** Premier jour occupé. Égal à `date` pour tout ce qui tient sur une journée. */
  debutJour: string;
  /** Dernier jour occupé, INCLUS. Égal à `debutJour` hors multi-jours. */
  finJour: string;
  start_at: string | null;
  end_at: string | null;
  allDay: boolean;
  color: string | null;
  /** Durée en minutes, `null` si aucun créneau n'est connu. */
  dureeMin: number | null;
  /**
   * ⭐ Cette entrée est une OCCURRENCE PROJETÉE d'une série, pas une ligne
   * qu'on peut déplacer.
   *
   * ⚠️ Elle existe parce que la règle « un récurrent ne se glisse pas » était
   * écrite en énumérant des `kind`, et l'énumération avait un trou : elle
   * couvrait les tâches récurrentes (`kind: "recurrence"`) mais pas les
   * ÉVÉNEMENTS récurrents, qui sont des `kind: "event"` comme les autres.
   * Glisser une occurrence déplaçait alors la série entière — vu à l'écran,
   * cinq occurrences hebdomadaires devenues trois, deux journées disparues
   * sans un mot. Le drapeau dit la PROPRIÉTÉ plutôt que la famille : c'est
   * elle que la règle vise.
   */
  serie: boolean;
  /** Vrai pour une tâche datée d'hier ou avant, et non faite. */
  enRetard: boolean;
  /** Combien de fois elle a glissé. 0 partout ailleurs. */
  reports: number;
  /** Faite ce jour-là ? `null` quand la question n'a pas de sens (événement). */
  faite: boolean | null;
}

export interface SourcesAgenda {
  events: readonly CalendarEvent[];
  tasks: readonly Task[];
  completions: readonly Completion[];
  goals: readonly Goal[];
  /**
   * ⭐ Les échéances de facturation (migration 023).
   *
   * ⚠️ ON NE PASSE PAS PAR `object_links`, et ce n'est pas un contournement :
   * son `CHECK` énumère sept familles fermées ('note','knowledge','task',
   * 'goal','event','trade','object') et SQLite ne sait pas modifier un CHECK —
   * y ajouter 'invoice' imposerait de RECRÉER la table. Le socle réutilisable
   * du calendrier n'est pas la table d'arêtes, c'est CE FICHIER : les quatre
   * familles existantes n'ont jamais eu d'arête non plus. Une échéance est donc
   * une cinquième source, exactement comme les échéances d'objectifs.
   *
   * Facultatif : les appelants qui n'en ont pas continuent de marcher.
   */
  echeances?: readonly EcheanceFacture[];
}

/**
 * Une échéance à faire remonter dans Aujourd'hui et dans le Calendrier.
 *
 * ⚠️ Volontairement réduite à ce que l'agenda a besoin de savoir : il ne
 * connaît ni `Invoice`, ni le reste dû, ni la notion de statut. Lui passer une
 * facture entière ferait dépendre le calendrier du module Finance.
 */
export interface EcheanceFacture {
  id: number;
  /** 'YYYY-MM-DD'. */
  date: string;
  titre: string;
  /** Déjà calculé par `statuts.ts` — l'agenda ne recalcule rien. */
  enRetard: boolean;
}

// ─── Heures et durées ────────────────────────────────────────────────────────

/** 'HH:MM' → minutes depuis minuit. `null` si la chaîne n'est pas une heure. */
export function minutesDe(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** minutes depuis minuit → 'HH:MM'. */
export function heureDe(minutes: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * ⭐ La durée qu'on prête à un créneau neuf, quand l'utilisateur n'en a pas
 * choisi une.
 *
 * Soixante minutes, et ce n'est pas un chiffre rond pris au hasard : c'est la
 * seule durée qui rende la carte assez haute pour AFFICHER SON HEURE. En
 * dessous de quarante-cinq minutes, `GrilleHoraire` masque l'étiquette faute de
 * place — on posait donc un rendez-vous à 14:37 et rien à l'écran ne le
 * confirmait. Une durée par défaut n'est pas du confort ici, c'est ce qui rend
 * la saisie vérifiable d'un coup d'œil.
 */
export const DUREE_DEFAUT_MIN = 60;

/**
 * L'heure de fin d'un créneau qui commence à `debut` et dure `dureeMin`.
 *
 * ⚠️ `heureDe` PLAFONNE à 23:59 : un rendez-vous de 23:30 ne déborde pas sur le
 * lendemain, il s'arrête à minuit moins une. Un événement qui traverse la nuit
 * relève du multi-jours (`end_date`), pas d'une fin plus petite que son début —
 * qui ferait rendre `null` à `dureeMinutes` et disparaître la durée.
 */
export function finApres(debut: string, dureeMin: number): string {
  const d = minutesDe(debut);
  if (d == null) return debut;
  return heureDe(d + dureeMin);
}

/**
 * Durée d'un créneau, en minutes.
 *
 * ⚠️ Une fin ANTÉRIEURE au début rend `null`, pas une durée négative : c'est
 * une saisie incohérente, et une durée négative se propagerait dans le calcul
 * de charge en le faisant DIMINUER — une journée surchargée passerait alors
 * pour légère.
 */
export function dureeMinutes(start: string | null, end: string | null): number | null {
  const d = minutesDe(start);
  const f = minutesDe(end);
  if (d == null || f == null) return null;
  return f > d ? f - d : null;
}

/**
 * ⭐ Les deux bornes d'un événement, dans l'ordre, quoi qu'il y ait en base.
 *
 * ⚠️ AUCUNE CONTRAINTE `CHECK` NE GARDE `end_date >= date` — délibérément :
 * une contrainte violée à l'arrivée d'une ligne venue d'un autre appareil
 * arrêterait la synchronisation (PIEGES § 3.4). C'est donc ICI qu'une borne
 * incohérente est absorbée : une fin antérieure au début, ou illisible, rend un
 * événement d'UNE journée plutôt qu'une plage à l'envers. `joursEntre` boucle
 * du début vers la fin ; sans ce garde, une borne inversée rendrait une liste
 * vide et l'événement disparaîtrait de l'écran sans un mot.
 */
export function bornesDe(
  e: Pick<CalendarEvent, "date" | "end_date" | "recurrence">,
): { debut: string; fin: string } {
  // ⚠️ Un événement RÉCURRENT est ramené à UNE journée, et ce n'est pas un
  // oubli : sa `date` est celle de la PREMIÈRE occurrence, et une série dont
  // chaque terme durerait trois jours se recouvrirait elle-même dès le
  // quotidien. Le formulaire rend d'ailleurs la combinaison impossible ; ce
  // garde protège des lignes écrites par une autre version de l'app.
  if (estRecurrenteSerie(e.recurrence)) return { debut: e.date, fin: e.date };
  const fin = e.end_date;
  if (!fin || fin <= e.date) return { debut: e.date, fin: e.date };
  return { debut: e.date, fin };
}

/** L'événement occupe-t-il plus d'une journée ? */
export function estMultiJours(
  e: Pick<CalendarEvent, "date" | "end_date" | "recurrence">,
): boolean {
  const { debut, fin } = bornesDe(e);
  return fin > debut;
}

/**
 * ⭐ Ce qui occupe le BANDEAU du haut, par opposition à la grille horaire.
 *
 * La migration 020 posait déjà la distinction en toutes lettres : une journée
 * entière DÉCLARÉE et une heure simplement INCONNUE ne s'affichent pas pareil —
 * « le premier occupe le bandeau du haut, le second attend qu'on lui donne une
 * heure ». L'interface les avait pourtant mélangées dans la même bande.
 *
 * ⚠️ Un multi-jours HORAIRE entre ici aussi, et sort donc de la grille. Le
 * placer à son heure sur chaque journée traversée mentirait deux fois : il n'a
 * pas lieu de 14 h à 16 h le mardi ET le mercredi, et sa durée n'est celle
 * d'aucune de ces journées.
 */
export function dansLeBandeau(e: EntreeAgenda): boolean {
  return e.kind === "event" && (e.allDay || e.finJour > e.debutJour);
}

/** Une barre du bandeau : où elle commence, sur combien de colonnes, à quel étage. */
export interface Bande {
  entree: EntreeAgenda;
  /** Index de la colonne de départ, dans `jours`. */
  colonne: number;
  /** Nombre de colonnes couvertes. */
  span: number;
  /** L'étage, pour que deux séjours qui se chevauchent ne se superposent pas. */
  rang: number;
  /** L'événement a commencé AVANT la fenêtre affichée. */
  debuteAvant: boolean;
  /** Il continue APRÈS elle. */
  finitApres: boolean;
}

/**
 * ⭐ Les barres continues du bandeau, à partir des entrées jour par jour.
 *
 * `entreesDuJour` rend un multi-jours UNE FOIS PAR JOURNÉE traversée : c'est ce
 * qu'il faut pour la vue agenda, mais la vue semaine doit en faire UNE barre.
 * On recolle donc les journées CONSÉCUTIVES.
 *
 * ⚠️ « Consécutives », et pas « même identifiant ». Un événement récurrent
 * marqué journée entière apparaît le lundi et le vendredi : les fusionner
 * dessinerait une barre de cinq jours sur une semaine où l'événement n'a lieu
 * que deux fois. Le trou entre deux occurrences ouvre donc une barre neuve.
 *
 * ⚠️ L'ÉTAGE se calcule ici et pas en CSS : deux séjours qui se chevauchent
 * occupant la même ligne de grille, le second écraserait le premier sans que
 * rien ne le signale. On prend le premier étage libre sur toute la largeur.
 */
export function bandesDu(
  jours: string[],
  parJour: ReadonlyMap<string, EntreeAgenda[]>,
): Bande[] {
  const bandes: Bande[] = [];
  const encours = new Map<string, { bande: Bande; colonne: number }>();

  jours.forEach((jour, i) => {
    for (const e of parJour.get(jour) ?? []) {
      if (!dansLeBandeau(e)) continue;
      const cle = `${e.kind}-${e.id}`;
      const prec = encours.get(cle);
      if (prec && prec.colonne === i - 1) {
        prec.bande.span += 1;
        prec.colonne = i;
        continue;
      }
      const bande: Bande = {
        entree: e,
        colonne: i,
        span: 1,
        rang: 0,
        debuteAvant: e.debutJour < jours[0],
        finitApres: e.finJour > jours[jours.length - 1],
      };
      bandes.push(bande);
      encours.set(cle, { bande, colonne: i });
    }
  });

  const occupe: boolean[][] = [];
  for (const b of bandes) {
    let rang = 0;
    for (;;) {
      occupe[rang] ??= [];
      const libre = Array.from({ length: b.span }, (_, k) => !occupe[rang][b.colonne + k]).every(Boolean);
      if (libre) {
        for (let k = 0; k < b.span; k++) occupe[rang][b.colonne + k] = true;
        break;
      }
      rang++;
    }
    b.rang = rang;
  }
  return bandes;
}

// ─── Construction d'une journée ──────────────────────────────────────────────

function completionsIndex(completions: readonly Completion[]): Map<string, boolean> {
  return new Map(completions.map((c) => [`${c.task_id}:${c.date}`, !!c.done]));
}

/**
 * Tout ce qui occupe `jour`, dans l'ordre de lecture.
 *
 * `aujourdhui` sert uniquement à décider du RETARD : une tâche du 3 n'est pas
 * en retard quand on consulte le 2, elle l'est quand on consulte le 5.
 */
export function entreesDuJour(
  src: SourcesAgenda,
  jour: string,
  aujourdhui: string,
): EntreeAgenda[] {
  const faites = completionsIndex(src.completions);
  const entrees: EntreeAgenda[] = [];

  // 1) Les événements — ceux qui OCCUPENT ce jour (un multi-jours en occupe
  // plusieurs), plus les occurrences des récurrents.
  for (const e of src.events) {
    const { debut, fin } = bornesDe(e);
    const ponctuel = !estRecurrenteSerie(e.recurrence) && debut <= jour && jour <= fin;
    const occurrence = estRecurrenteSerie(e.recurrence) && occurrenceLe(e.recurrence, e.date, jour);
    if (!ponctuel && !occurrence) continue;
    const multi = fin > debut;
    entrees.push({
      kind: "event",
      id: e.id,
      titre: e.title,
      date: jour,
      debutJour: debut,
      finJour: fin,
      start_at: e.all_day ? null : e.start_at,
      end_at: e.all_day ? null : e.end_at,
      allDay: !!e.all_day,
      color: e.color,
      serie: estRecurrenteSerie(e.recurrence),
      // ⚠️ UN MULTI-JOURS N'A PAS DE DURÉE SUR UNE JOURNÉE DONNÉE, et lui en
      // prêter une fausserait la charge exactement comme le ferait une journée
      // entière comptée pour huit heures. Il rejoint donc les non-mesurables de
      // `charge.ts` — comptés à part, jamais additionnés aux minutes posées.
      // ⚠️ Depuis le 2026-09-07 c'est `evenementsSansHeure` et non `sansCreneau`
      // qui l'accueille : les deux sont non mesurables, mais un séjour n'est pas
      // une tâche, et l'écran le disait.
      dureeMin: e.all_day || multi ? null : dureeMinutes(e.start_at, e.end_at),
      enRetard: false,
      reports: 0,
      faite: null,
    });
  }

  // 2) Les tâches DATÉES, à leur créneau quand elles en ont un.
  for (const t of src.tasks) {
    if (!estDatee(t) || t.due_date !== jour) continue;
    entrees.push({
      kind: "task",
      id: t.id,
      titre: t.label,
      date: jour,
      debutJour: jour,
      finJour: jour,
      start_at: t.start_at,
      end_at: t.end_at,
      allDay: false,
      color: null,
      dureeMin: dureeMinutes(t.start_at, t.end_at),
      serie: false,
      enRetard: jour < aujourdhui && !faites.get(`${t.id}:${jour}`),
      reports: t.postponed_count,
      faite: !!faites.get(`${t.id}:${jour}`),
    });
  }

  // 3) Les tâches RÉCURRENTES, projetées à leurs occurrences.
  // ⚠️ Jamais « en retard » : une occurrence manquée est manquée, pas en
  // retard (voir `lib/taches.ts`). Elle ne se reporte pas non plus.
  for (const t of src.tasks) {
    if (!estRecurrente(t) || !occurrenceLe(t.recurrence, t.created_at, jour)) continue;
    entrees.push({
      kind: "recurrence",
      id: t.id,
      titre: t.label,
      date: jour,
      debutJour: jour,
      finJour: jour,
      start_at: t.start_at,
      end_at: t.end_at,
      allDay: false,
      color: null,
      dureeMin: dureeMinutes(t.start_at, t.end_at),
      serie: true,
      enRetard: false,
      reports: 0,
      faite: !!faites.get(`${t.id}:${jour}`),
    });
  }

  // 4) Les échéances d'objectifs — y compris les sous-objectifs, qui sont les
  // jalons. `goals.deadline` existait déjà, et n'était visible QUE dans le
  // module Objectifs : personne ne la croisait avec un calendrier.
  for (const g of src.goals) {
    if (g.deadline !== jour) continue;
    entrees.push({
      kind: "deadline",
      id: g.id,
      titre: g.title,
      date: jour,
      debutJour: jour,
      finJour: jour,
      start_at: null,
      end_at: null,
      allDay: true,
      color: null,
      dureeMin: null,
      serie: false,
      enRetard: false,
      reports: 0,
      faite: null,
    });
  }

  // 5) Les échéances de facturation (migration 023).
  // ⚠️ Elles n'ont NI DURÉE NI CRÉNEAU : une facture n'occupe pas la journée,
  // elle y arrive à terme. Elle rejoint donc les non-mesurables de `charge.ts`
  // au même titre qu'une échéance d'objectif — lui prêter une durée fausserait
  // la charge exactement comme le ferait une journée entière comptée pour huit
  // heures.
  for (const e of src.echeances ?? []) {
    if (e.date !== jour) continue;
    entrees.push({
      kind: "echeance",
      id: e.id,
      titre: e.titre,
      date: jour,
      debutJour: jour,
      finJour: jour,
      start_at: null,
      end_at: null,
      allDay: true,
      color: null,
      dureeMin: null,
      serie: false,
      // ⚠️ Le retard est CALCULÉ par `statuts.ts` et passé tel quel : l'agenda
      // ne sait pas ce qu'est un reste dû, et il n'a pas à l'apprendre.
      enRetard: e.enRetard,
      reports: 0,
      faite: null,
    });
  }

  return trierEntrees(entrees);
}

function estRecurrenteSerie(recurrence: string | null): boolean {
  return !!recurrence && recurrence !== "none";
}

/**
 * L'ordre de lecture d'une journée : d'abord ce qui a une heure, dans l'ordre
 * des heures ; puis ce qui n'occupe que le jour, par famille.
 *
 * Trier d'abord par famille aurait dispersé les heures — on aurait lu « 9 h,
 * 14 h, puis 10 h », ce qui ne se lit pas.
 */
export function trierEntrees(entrees: EntreeAgenda[]): EntreeAgenda[] {
  return [...entrees].sort((a, b) => {
    const ha = minutesDe(a.start_at);
    const hb = minutesDe(b.start_at);
    if (ha != null && hb != null) return ha - hb || RANG[a.kind] - RANG[b.kind];
    if (ha != null) return -1;
    if (hb != null) return 1;
    return RANG[a.kind] - RANG[b.kind] || a.titre.localeCompare(b.titre);
  });
}

/** Les journées d'une plage, bornes comprises, indexées par date. */
export function entreesDeLaPlage(
  src: SourcesAgenda,
  du: string,
  au: string,
  aujourdhui: string,
): Map<string, EntreeAgenda[]> {
  const parJour = new Map<string, EntreeAgenda[]>();
  for (const jour of joursEntre(du, au)) {
    parJour.set(jour, entreesDuJour(src, jour, aujourdhui));
  }
  return parJour;
}

// ─── Calendriers ─────────────────────────────────────────────────────────────

/** Les dates de `du` à `au`, bornes comprises. */
export function joursEntre(du: string, au: string): string[] {
  const jours: string[] = [];
  const fin = new Date(`${au}T12:00:00`);
  const curseur = new Date(`${du}T12:00:00`);
  // Midi, et pas minuit : un pas de 24 h à partir de minuit tombe à 23 h le
  // jour du passage à l'heure d'été, donc sur la VEILLE. Midi met huit heures
  // de marge de chaque côté du décalage.
  while (curseur <= fin) {
    jours.push(toDateStr(curseur));
    curseur.setDate(curseur.getDate() + 1);
  }
  return jours;
}

/**
 * Le lundi de la semaine de `jour`.
 *
 * ⚠️ La semaine commence le LUNDI, alors que `getDay()` compte à partir du
 * dimanche. Confondre les deux décale toute la grille d'un jour, ce qui se voit
 * mais s'explique mal.
 */
export function lundiDe(jour: string): string {
  const wd = weekdayOf(jour); // 0 = dimanche
  const recul = wd === 0 ? 6 : wd - 1;
  const d = new Date(`${jour}T12:00:00`);
  d.setDate(d.getDate() - recul);
  return toDateStr(d);
}

/** Les sept jours de la semaine de `jour`, du lundi au dimanche. */
export function semaineDe(jour: string): string[] {
  const lundi = lundiDe(jour);
  const fin = new Date(`${lundi}T12:00:00`);
  fin.setDate(fin.getDate() + 6);
  return joursEntre(lundi, toDateStr(fin));
}

/**
 * La grille d'un mois : six semaines pleines, du lundi au dimanche.
 *
 * ⚠️ TOUJOURS six semaines, même quand cinq suffiraient. Une grille dont la
 * hauteur change d'un mois à l'autre fait sauter toute la page en naviguant, et
 * le mois de février commençant un lundi en offre l'exemple le plus brutal.
 */
export function grilleDuMois(jour: string): string[] {
  const d = new Date(`${jour}T12:00:00`);
  const premier = toDateStr(new Date(d.getFullYear(), d.getMonth(), 1, 12));
  const debut = lundiDe(premier);
  const fin = new Date(`${debut}T12:00:00`);
  fin.setDate(fin.getDate() + 41); // 6 × 7 − 1
  return joursEntre(debut, toDateStr(fin));
}

/** Le mois de `jour` au format 'YYYY-MM' — pour savoir ce qui déborde de la grille. */
export function moisDe(jour: string): string {
  return jour.slice(0, 7);
}
