import { addDays } from "./logic";
import type { HabitCheck } from "./types";

/**
 * Les habitudes — ce que le Journal (où elles vivent) et les cartes mentales
 * (où un nœud peut en devenir une, 2026-09-29) doivent calculer PAREIL.
 *
 * ⚠️ Sorti de `views/JournalView.tsx` le 2026-09-29, à l'identique : la carte
 * affiche la série d'une habitude, et deux calculs de série finiraient par
 * donner deux chiffres pour la même habitude.
 */

/**
 * ⚠️ DES COULEURS DE DONNÉES : elles sont ENREGISTRÉES dans `habits.color`.
 * Ne jamais en retirer ni en renommer une (PIEGES § 21.9) — seulement ajouter.
 *
 * 2026-10-20 (Antonin : « change la banque de couleurs avec plus de choix,
 * notamment le nouveau rouge ») : de six à douze, rangées par teinte. Les six
 * d'avant y sont toutes, à la même valeur ; le cramoisi est celui de la plaque
 * du logo (`PLAQUE_HAUT`, `ShaleMark.tsx`). `nom` est la phrase française,
 * traduite à l'affichage.
 */
export const PALETTE_HABITUDES: readonly { valeur: string; nom: string }[] = [
  { valeur: "#dc2626", nom: "Cramoisi" },
  { valeur: "#fb923c", nom: "Orange" },
  { valeur: "var(--color-yellow)", nom: "Ambre" },
  { valeur: "#a3e635", nom: "Citron vert" },
  { valeur: "var(--color-green)", nom: "Vert" },
  { valeur: "#14b8a6", nom: "Sarcelle" },
  { valeur: "#38bdf8", nom: "Ciel" },
  { valeur: "var(--color-blue)", nom: "Bleu" },
  { valeur: "#818cf8", nom: "Indigo" },
  { valeur: "#a78bfa", nom: "Violet" },
  { valeur: "#f472b6", nom: "Rose" },
  { valeur: "#94a3b8", nom: "Ardoise" },
];

export const HABIT_COLORS = PALETTE_HABITUDES.map((c) => c.valeur);

/** Celle qu'une habitude reçoit quand on ne choisit pas (la première d'avant). */
export const COULEUR_HABITUDE_PAR_DEFAUT = "var(--color-green)";

/** Le nom d'une couleur de la palette, `null` pour une couleur venue d'ailleurs. */
export function nomDeCouleur(valeur: string): string | null {
  return PALETTE_HABITUDES.find((c) => c.valeur === valeur)?.nom ?? null;
}

/**
 * ⭐ Les derniers jours qu'une LIGNE d'habitude montre, du plus ancien à
 * aujourd'hui : quatorze carrés de 14 px, à LIRE.
 *
 * ⚠️ Jusqu'au 2026-10-13 ces jours se COCHAIENT, et le téléphone n'en montrait
 * que sept, en cases de 44 pt (`joursDeLigne(today, telephone)`, crible du labo
 * du 2026-10-12, constat 8). Antonin, le 13 : « il y a la possibilité de cocher
 * directement un autre jour, ce n'est pas bon ». La coche est désormais celle
 * du jour choisi dans la barre du Journal, et rien d'autre ; les carrés ne se
 * touchent plus, donc quatorze tiennent partout (sous le nom, au téléphone).
 */
export const JOURS_HISTORIQUE = 14;

export function derniersJours(today: string, n: number = JOURS_HISTORIQUE): string[] {
  const jours: string[] = [];
  for (let i = n - 1; i >= 0; i--) jours.push(addDays(today, -i));
  return jours;
}

/**
 * Jours d'affilée où l'habitude a été tenue, jusqu'à aujourd'hui.
 *
 * Aujourd'hui pas encore coché ne casse pas la série : la journée n'est pas
 * finie. On compte alors à partir d'hier.
 */
export function serieHabitude(habitId: number, checks: readonly HabitCheck[], today: string): number {
  const set = new Set(checks.filter((c) => c.habit_id === habitId).map((c) => c.date));
  let d = today;
  if (!set.has(d)) d = addDays(d, -1);
  let serie = 0;
  while (set.has(d)) {
    serie++;
    d = addDays(d, -1);
  }
  return serie;
}
