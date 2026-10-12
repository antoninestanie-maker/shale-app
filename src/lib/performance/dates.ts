import { localeTag } from "../i18n";

/**
 * ⭐ DIRE SA PÉRIODE (2026-10-11).
 *
 * Le crible du labo a vu Performance contredire le chiffre du Timer six fois
 * sur six « sans dire sa période » (9 h 35 d'un côté, 9 h 11 de l'autre : sept
 * jours FINIS contre sept jours GLISSANTS). Trois « cette semaine » cohabitent
 * dans l'app ; tant qu'elles ne sont pas réunies, chaque total écrit ses dates.
 * Ce fichier est la seule façon de les écrire dans Performance.
 */

/** Midi : une date 'YYYY-MM-DD' ne doit pas glisser d'un jour avec le fuseau (PIEGES § 4.1). */
function aMidi(jour: string): Date {
  const [a, m, j] = jour.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, j, 12);
}

/**
 * « 5–11 oct. », « 28 sept. – 4 oct. » ; en anglais « Oct 5 – 11 ». L'année
 * n'apparaît que si l'une des deux bornes n'est pas dans celle d'`aujourdHui`.
 * Un seul jour s'écrit seul (« 12 oct. »).
 */
export function plageDeDates(debut: string, fin: string, aujourdHui: string): string {
  const annee = aujourdHui.slice(0, 4);
  const avecAnnee = debut.slice(0, 4) !== annee || fin.slice(0, 4) !== annee;
  const format = new Intl.DateTimeFormat(localeTag(), {
    day: "numeric",
    month: "short",
    ...(avecAnnee ? { year: "numeric" as const } : {}),
  });
  const d = aMidi(debut);
  const f = aMidi(fin);
  if (Number.isNaN(d.getTime()) || Number.isNaN(f.getTime())) return `${debut} – ${fin}`;
  if (debut === fin) return format.format(d);
  // `formatRange` écrit le mois une seule fois quand il est commun. Absent des
  // types de la cible de compilation (ES2021), et d'un très vieux moteur : on
  // retombe alors sur deux dates entières.
  const avecPlage = format as Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string };
  return typeof avecPlage.formatRange === "function"
    ? avecPlage.formatRange(d, f)
    : `${format.format(d)} – ${format.format(f)}`;
}

/** « lundi 12 oct. » / « Monday, Oct 12 » — le nom du jour en cours, en clair. */
export function jourEnClair(jour: string): string {
  const d = aMidi(jour);
  if (Number.isNaN(d.getTime())) return jour;
  return d.toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "short" });
}
