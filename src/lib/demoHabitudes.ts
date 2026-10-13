import { addDays, weekdayOf } from "./logic";

/**
 * L'historique des trois habitudes du jeu de démonstration (`demo.ts`).
 *
 * ⚠️ Écrit À LA MAIN, exprès. Jusqu'au 2026-10-13 trois règles le fabriquaient
 * (« tout sauf un jour sur sept », « lundi, mercredi, vendredi », « un jour sur
 * deux ») et la grille de douze semaines du Journal ressemblait à un damier —
 * retour d'Antonin : « on dirait un drapeau à damier, ça ne fait pas du tout
 * réel ». Une règle, quelle qu'elle soit, finit par se voir ; un tirage au
 * hasard, lui, ne donne ni bonnes semaines ni week-ends creux. D'où des séries
 * figées, trouvées par tirage puis validées à l'image pour un tournage.
 *
 * Dix semaines par habitude, de la plus ancienne à la semaine EN COURS ; sept
 * caractères par semaine, du lundi au dimanche ; « 1 » = tenue.
 *
 * ⚠️ Les séries sont calées sur les SEMAINES, pas sur « il y a N jours » : un
 * samedi creux reste un samedi quel que soit le jour où l'on ouvre la démo, et
 * Performance dit « le samedi » toute la semaine. Comptées en jours depuis
 * aujourd'hui, elles glisseraient d'un cran par jour et le jour faible
 * deviendrait le mercredi. Un mardi, les soixante jours lus sont au caractère
 * près ceux qui ont été filmés (le test les tient).
 *
 * Les trois premiers jours de la première semaine ne sont jamais lus (soixante
 * jours ne remontent pas plus loin que son jeudi) ; la dernière semaine n'est
 * lue que jusqu'à hier.
 */
const SEMAINES: Record<number, readonly string[]> = {
  // Méditation : presque tous les jours, un raté de temps en temps.
  1: ["0000010", "1111011", "1111111", "1111110", "1110111", "1111111", "1111011", "0111111", "1101101", "1111101"],
  // Sport : des débuts timides, deux bonnes semaines, jamais le week-end ou presque.
  2: ["0000000", "0001000", "0111000", "0001000", "1101100", "0100011", "1110000", "1111100", "0110000", "0100100"],
  // Lecture : par à-coups, plutôt mieux depuis un mois.
  3: ["0000001", "1101101", "0000100", "1010001", "0011011", "1100100", "1110101", "1101101", "0011011", "0110101"],
};

/** Jours d'historique, d'hier en remontant. */
export const JOURS_HABITUDES_DEMO = 60;

/** Les coches des `JOURS_HABITUDES_DEMO` jours passés, du plus ancien à hier. Aujourd'hui n'en fait pas partie. */
export function historiqueHabitudesDemo(today: string): { habit_id: number; date: string }[] {
  const rang = (weekdayOf(today) + 6) % 7; // lundi = 0
  const aujourdhui = 7 * 9 + rang; // la place d'aujourd'hui dans une série mise bout à bout
  const coches: { habit_id: number; date: string }[] = [];
  for (let i = JOURS_HABITUDES_DEMO; i >= 1; i--) {
    const date = addDays(today, -i);
    for (const [id, semaines] of Object.entries(SEMAINES)) {
      if (semaines.join("")[aujourdhui - i] === "1") coches.push({ habit_id: Number(id), date });
    }
  }
  return coches;
}
