/**
 * Écrire une durée — une seule façon pour tout Performance (2026-10-11).
 *
 * ⚠️ Ce fichier ne fait PAS partie de l'essai « Par objectif » : la vue
 * d'ensemble s'en sert aussi. Il reste si l'essai est retiré.
 */

/**
 * « 45 min », « 2 h », « 2 h 10 » — le format EXACT de la vue Timer (`fmtMin`)
 * et de la vue d'ensemble, pour qu'un même total se lise à l'identique partout.
 */
export function enHeures(minutes: number): string {
  const min = Math.max(0, Math.round(minutes));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** La même durée pour une PHRASE : espaces insécables, sinon « 1 h 15 » se coupe en fin de ligne à 390 px. */
export function enHeuresInsecable(minutes: number): string {
  return enHeures(minutes).replace(/ /g, " ");
}
