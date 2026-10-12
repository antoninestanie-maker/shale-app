import { estAcheve, mesurer, pourcentDe, type ContexteProgression, type SourcesProgression } from "../objectifs/progression";
import { racineDe } from "../objectifs/structure";
import { addDays } from "../logic";
import { joursEntre } from "./agenda";
import type { Completion, Goal, Task } from "../types";

/**
 * ⭐ Les objectifs qui ne tiendront pas dans les jours qui restent.
 *
 * LA THÈSE. Le module Objectifs sait ce qui est FAIT. Le calendrier sait combien
 * de jours restent. **Personne ne croisait les deux** — un objectif pouvait donc
 * afficher « 40 % » à trois jours de son échéance sans que rien ne le signale.
 *
 * ⚠️ L'HONNÊTETÉ DE LA MESURE EST TOUT L'INTÉRÊT. Le module Objectifs mesure la
 * progression sur ce qui est réellement fait (`effectiveProgress`), pas sur ce
 * qu'on déclare — sauf quand l'utilisateur a explicitement choisi le mode
 * manuel. Une alerte fondée sur du déclaratif ne vaut rien : elle dirait
 * exactement ce que l'utilisateur a bien voulu se dire.
 */

export interface ObjectifEnPeril {
  goal: Goal;
  /** Progression réelle, 0–100. */
  progression: number;
  /** Jours restants avant l'échéance, 0 le jour même, négatif si dépassée. */
  joursRestants: number;
  /**
   * Étapes directes (phases ou non) non ACHEVÉES.
   *
   * ⚠️ S'appelait `jalonsRestants` avant la migration 026, du temps où tout
   * enfant d'un objectif s'appelait « jalon ». Le mot désigne désormais un
   * niveau précis de la feuille de route : le garder ici aurait annoncé
   * « 3 jalons non terminés » pour trois étapes.
   */
  etapesRestantes: number;
  /** Tâches non récurrentes rattachées et non faites. */
  tachesRestantes: number;
  /**
   * L'objectif racine quand l'alerte porte sur une ÉTAPE datée (un jalon peut
   * porter une échéance) : « Passer le challenge » ne dit rien seul.
   */
  racine: Goal | null;
  /** ⚠️ Vrai quand la progression est DÉCLARÉE, pas mesurée. */
  declaratif: boolean;
  raison: "depassee" | "trop-peu-de-jours" | "rythme-insuffisant";
}

/**
 * Sous ce nombre de jours, un objectif encore loin du compte est signalé.
 *
 * Sept jours : c'est l'horizon sur lequel on peut encore réagir. Alerter à
 * trente jours ferait de l'alerte un décor permanent ; alerter à deux jours ne
 * laisserait rien faire de la nouvelle.
 */
export const HORIZON_JOURS = 7;

/**
 * Part de progression au-delà de laquelle on considère qu'un objectif tient sa
 * route, même proche de l'échéance.
 */
export const PROGRESSION_RASSURANTE = 80;

/**
 * ⭐ UN OBJECTIF QUI VIENT DE NAÎTRE N'EST PAS « EN PÉRIL » (2026-10-12).
 *
 * D'OÙ ÇA VIENT. Le 2026-09-16, l'accueil s'était interdit de donner une
 * échéance à l'objectif qu'il plante : « sinon "objectif en péril" une semaine
 * après l'installation, sur la première chose que l'utilisateur ait dite à
 * l'app ». Le 2026-10-12, Antonin demande que l'accueil la propose (« la
 * deadline de l'objectif, c'est très important ») ; et la seconde passe du
 * labo (rang 9) a vu le bandeau rouge sur une étape créée dix minutes plus
 * tôt, échéance à sept jours.
 *
 * CE QUE LA RÈGLE DISAIT DÉJÀ. Une échéance à plus de sept jours n'est jamais
 * signalée (`HORIZON_JOURS`) : un objectif neuf daté à trois mois ne crie pas,
 * ni le premier jour ni la première semaine. Le défaut ne touche que
 * l'objectif — ou l'étape — créé AVEC une échéance à sept jours ou moins : il
 * est à 0 %, donc « rythme insuffisant » dans la seconde.
 *
 * LA RÈGLE, la plus petite : né aujourd'hui ou hier, il n'est pas jugé. On ne
 * mesure pas le rythme de ce qui n'a pas encore eu un jour entier pour avancer.
 * Dès le surlendemain, la règle d'avant s'applique telle quelle.
 *
 * ⚠️ UNE ÉCHÉANCE DÉPASSÉE N'EST JAMAIS TUE : la grâce ne vaut que pour une
 * échéance d'aujourd'hui ou à venir.
 *
 * ⚠️ « Aujourd'hui OU HIER », pas « aujourd'hui » seul : en natif `created_at`
 * est écrit par SQLite en temps UNIVERSEL (`datetime('now')`). Un objectif
 * créé à 0 h 30 à Paris porte la date de la veille ; avec « aujourd'hui » seul,
 * il serait jugé dans la minute. Le jour d'écart couvre le décalage.
 *
 * Sans date de création lisible, rien ne change : l'objectif est jugé.
 */
export function vientDeNaitre(creeLe: string | null | undefined, aujourdhui: string): boolean {
  const jour = (creeLe ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(jour) && jour >= addDays(aujourdhui, -1);
}

export function objectifsEnPeril(
  goals: readonly Goal[],
  tasks: readonly Task[],
  completions: readonly Completion[],
  aujourdhui: string,
  /** Habitudes et coches : une cible chiffrée peut en dépendre (migration 026). */
  contexte: Partial<ContexteProgression> = {},
): ObjectifEnPeril[] {
  const enPeril: ObjectifEnPeril[] = [];

  // ⭐ UNE mesure par la règle unique (`lib/objectifs/progression.ts`) : le péril
  // ne recalcule pas un pourcentage dans son coin.
  const sources: SourcesProgression = {
    goals,
    tasks,
    completions,
    ...contexte,
    maintenant: contexte.maintenant ?? `${aujourdhui} 00:00`,
  };

  for (const g of goals) {
    if (!g.deadline) continue;

    const m = mesurer(g, sources);
    // Achevé = à 100 % : depuis le 2026-10-11 une étape vide compte (0, ou 100
    // une fois cochée), donc quatre étapes finies et deux vides font 67 %, plus
    // 100 %. L'objectif qu'il fallait signaler l'est par son chiffre.
    if (estAcheve(m)) continue;
    // Le même nombre qu'`effectiveProgress` (un réglage cassé vaut 0).
    const progression = pourcentDe(m);

    const joursRestants = ecartEnJours(aujourdhui, g.deadline);
    if (joursRestants > HORIZON_JOURS) continue;
    // ⭐ Né aujourd'hui ou hier : pas encore jugé — sauf échéance DÉPASSÉE.
    if (joursRestants >= 0 && vientDeNaitre(g.created_at, aujourdhui)) continue;

    const enfants = goals.filter((x) => x.parent_goal_id === g.id && !x.is_example);
    const etapesRestantes = enfants.filter((x) => !estAcheve(mesurer(x, sources))).length;
    const rattachees = tasks.filter(
      (t) => t.goal_id === g.id && (!t.recurrence || t.recurrence === "none"),
    );
    const faites = new Set(completions.filter((c) => c.done).map((c) => c.task_id));
    const tachesRestantes = rattachees.filter((t) => !faites.has(t.id)).length;

    const restant = etapesRestantes + tachesRestantes;

    let raison: ObjectifEnPeril["raison"] | null = null;
    if (joursRestants < 0) raison = "depassee";
    // Plus de jalons que de jours : même à un par jour, le compte ne tombe pas.
    else if (restant > Math.max(0, joursRestants)) raison = "trop-peu-de-jours";
    // (Jusqu'au 2026-10-11, un pourcentage pouvait être gonflé par des étapes
    // vides sorties du dénominateur, et il fallait les recompter ici. Elles
    // pèsent désormais dans le chiffre : il suffit.)
    else if (progression < PROGRESSION_RASSURANTE) raison = "rythme-insuffisant";

    if (!raison) continue;

    enPeril.push({
      goal: g,
      progression,
      joursRestants,
      etapesRestantes,
      tachesRestantes,
      racine: g.parent_goal_id != null ? racineDe(g, goals) : null,
      // ⚠️ À DIRE À L'ÉCRAN. Une alerte calculée sur une progression saisie à la
      // main ne mesure rien : elle répète ce que l'utilisateur a déclaré.
      declaratif: !!g.manual_progress,
      raison,
    });
  }

  // Le plus urgent d'abord : l'échéance dépassée, puis la plus proche.
  return enPeril.sort((a, b) => a.joursRestants - b.joursRestants || a.progression - b.progression);
}

/** Nombre de jours de `de` à `a`. Négatif si `a` est déjà passé. */
export function ecartEnJours(de: string, a: string): number {
  if (a === de) return 0;
  const [debut, fin, signe] = a > de ? [de, a, 1] : [a, de, -1];
  return signe * (joursEntre(debut, fin).length - 1);
}
