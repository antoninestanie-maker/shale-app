import { addDays, weekdayOf } from "./logic";

/**
 * L'historique du jeu de démonstration (`demo.ts`) : les habitudes tenues et
 * les routines faites, jour par jour, depuis huit semaines.
 *
 * ⚠️ Écrit À LA MAIN, exprès. Des règles le fabriquaient (« un jour sur deux »,
 * « lundi, mercredi, vendredi ») et le Journal affichait un damier — retour
 * d'Antonin du 2026-10-13 : « on dirait un drapeau à damier, ça ne fait pas du
 * tout réel ». Une règle, quelle qu'elle soit, finit par se voir.
 *
 * Trois choses que ces tables doivent garder (second retour, même jour) :
 *   • les tâches et les habitudes racontent la MÊME période — les routines
 *     n'avaient que douze jours d'historique face à soixante jours d'habitudes ;
 *   • il y a des jours BLANCS, où rien n'a été tenu ni fait (`JOURS_BLANCS`) :
 *     personne ne tient ses habitudes soixante jours sans en sauter un ;
 *   • un mauvais jour l'est pour tout — le lundi de la semaine passée, une
 *     seule routine faite et une seule habitude tenue.
 *
 * Une ligne par semaine, de la plus ancienne (il y a huit semaines) à la
 * semaine EN COURS ; sept caractères, du lundi au dimanche ; « 1 » = fait.
 *
 * ⚠️ Calé sur les SEMAINES, pas sur « il y a N jours » : un samedi creux reste
 * un samedi quel que soit le jour où l'on ouvre la démo. Compté en jours depuis
 * aujourd'hui, tout glisserait d'un cran par jour (PIEGES § 44.2). La semaine en
 * cours n'est lue que jusqu'à hier.
 *
 * Une habitude ou une routine commence à son premier « 1 » : elles ne sont pas
 * toutes nées le même jour, et la grille du Journal se remplit en avançant.
 */

/** Semaines écrites, celle en cours comprise. */
export const SEMAINES_DEMO = 9;

/** Les habitudes, par identifiant (ceux de `habits`, dans `demo.ts`). */
const HABITUDES: Record<number, readonly string[]> = {
  // Méditation : presque tous les jours.
  1: ["1111011", "1111100", "1111110", "1110111", "1101111", "1111011", "0111111", "1101101", "1111101"],
  // Sport : des débuts timides, deux bonnes semaines, presque jamais le week-end.
  2: ["0001000", "0111000", "0001000", "1101100", "0100011", "1110000", "1111100", "0110000", "0100100"],
  // Lecture : par à-coups, plutôt mieux depuis un mois.
  3: ["1101101", "0000100", "1010001", "0011011", "1100100", "1110001", "1101101", "0011011", "0110110"],
  // Planifier ma journée : en semaine.
  4: ["1110100", "1111100", "1101100", "1111101", "1101100", "1111000", "1111100", "0111110", "1111100"],
  // Travail profond : commencé la deuxième semaine, un jour sur deux à peu près.
  5: ["0000000", "0110100", "1011000", "0110100", "1100100", "0111000", "1011100", "0111010", "1101100"],
  // Relancer un contact : depuis un mois.
  6: ["0000000", "0000000", "0000000", "0010100", "1101100", "0111000", "1011100", "0101100", "1011000"],
  // Noter mes dépenses : le soir, week-end compris.
  7: ["0000000", "0000000", "0011011", "1101110", "1101101", "1111011", "1011110", "0111101", "1101101"],
  // Coucher avant 23 h : la dernière arrivée, et le vendredi et le samedi n'y arrivent pas.
  8: ["0000000", "0000000", "0000000", "0000000", "0001001", "1110001", "1101001", "0111000", "1011001"],
};

/**
 * Les routines (tâches récurrentes), par identifiant. Un « 1 » un jour où la
 * routine n'est pas due ne compte pas : `demo.ts` ne lit que les jours dus.
 *
 * Les douze derniers jours d'un MARDI sont ceux que la démo a toujours montrés :
 * tout fait, sauf le lundi de la semaine passée où seule la prospection l'a été
 * — d'où la série en cours de sept jours sur Aujourd'hui.
 */
const ROUTINES: Record<number, readonly string[]> = {
  // Prospection 1 h — tous les jours.
  1: ["1111000", "1101100", "1110110", "1011101", "1101110", "1111001", "1011111", "1111111", "1111111"],
  // Production client (matin) — en semaine.
  2: ["1111100", "1101100", "1111000", "1111100", "1101100", "1111000", "1111100", "0111100", "1111100"],
  // Publier un post LinkedIn — lundi, mercredi, vendredi ; depuis sept semaines.
  3: ["0000000", "1000100", "1010000", "0010100", "1000000", "1010000", "0010100", "0010100", "1010100"],
  // Réviser un module de la certification — en semaine ; depuis cinq semaines.
  4: ["0000000", "0000000", "0000000", "1011000", "1101000", "0111000", "1011100", "0111100", "1111100"],
};

/**
 * Les jours où rien n'a été tenu ni fait : [semaine, jour], lundi = 0. Un
 * week-end entier, un mercredi, un vendredi. Les tables ci-dessus portent déjà
 * des « 0 » à ces places ; cette liste les NOMME, et le test vérifie l'accord.
 */
export const JOURS_BLANCS: readonly (readonly [number, number])[] = [[1, 5], [1, 6], [4, 2], [5, 4]];

/** Le lundi de la semaine en cours (`semainesAvant` = 0) ou d'une semaine passée. */
export function lundiDemo(today: string, semainesAvant = 0): string {
  return addDays(today, -((weekdayOf(today) + 6) % 7) - 7 * semainesAvant);
}

/** Le premier jour de l'historique : le lundi d'il y a huit semaines. */
export function debutHistoriqueDemo(today: string): string {
  return lundiDemo(today, SEMAINES_DEMO - 1);
}

/** Le jour où une routine commence : celui de son premier « 1 ». La démo en fait sa date de création. */
export function debutRoutineDemo(id: number, today: string): string {
  return addDays(debutHistoriqueDemo(today), Math.max(ROUTINES[id].join("").indexOf("1"), 0));
}

export interface JourDeDemo {
  date: string;
  /** Les habitudes tenues ce jour-là. */
  habitudes: number[];
  /** Les routines faites ce jour-là. */
  routines: number[];
}

/** Du premier jour de l'historique à HIER, dans l'ordre. Aujourd'hui n'en fait pas partie. */
export function historiqueDemo(today: string): JourDeDemo[] {
  const debut = debutHistoriqueDemo(today);
  const lus = (table: Record<number, readonly string[]>, k: number) =>
    Object.keys(table).map(Number).filter((id) => table[id].join("")[k] === "1");
  const jours: JourDeDemo[] = [];
  for (let k = 0; addDays(debut, k) < today; k++) {
    jours.push({ date: addDays(debut, k), habitudes: lus(HABITUDES, k), routines: lus(ROUTINES, k) });
  }
  return jours;
}
