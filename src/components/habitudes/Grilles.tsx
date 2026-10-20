import { useMemo } from "react";
import { addDays, weekdayOf } from "../../lib/logic";
import { sansExemples } from "../../lib/onboarding/exemples";
import { formatDate, t } from "../../lib/i18n";
import type { Habit, HabitCheck } from "../../lib/types";

/**
 * Les deux grilles des habitudes — celle de TOUTES les habitudes sur douze
 * semaines, et les derniers jours d'UNE habitude.
 *
 * ⭐ Sorties de `views/JournalView.tsx` le 2026-10-13 : la carte « Habitudes à
 * tenir » d'Aujourd'hui les montre aussi (Antonin : « les habitudes à tenir
 * doivent emporter leurs grilles »), et deux dessins de la même grille
 * finiraient par ne plus compter pareil.
 *
 * ⚠️ AUCUNE DES DEUX NE SE CLIQUE. Les carrés d'une ligne étaient des boutons
 * jusqu'à cette date : on cochait hier en visant aujourd'hui. Le jour se
 * choisit dans la barre du Journal (`BarreJours`), la coche est sa case.
 */

const midi = (date: string) => new Date(`${date}T12:00:00`);

/** Grille type GitHub : une colonne par semaine, intensité = part d'habitudes tenues. */
export function GrilleHabitudes({
  habits,
  habitChecks,
  today,
  semaines = 12,
  className = "",
  legende = false,
}: {
  habits: readonly Habit[];
  habitChecks: readonly HabitCheck[];
  today: string;
  semaines?: number;
  className?: string;
  /**
   * La légende sous la grille (audit du 20/10, constat 38 : la grille de
   * Performance en a une, celle-ci non — et au doigt aucune info-bulle ne dit
   * ce qu'une case veut dire).
   */
  legende?: boolean;
}) {
  const { grille, total } = useMemo(() => {
    // ⭐ Les habitudes d'EXEMPLE ne comptent pas — ni au dénominateur, ni au
    // numérateur. Les laisser au dénominateur ferait baisser l'intensité de
    // toutes les cases de douze semaines dès l'installation : la série d'un
    // utilisateur assidu se serait affichée à 50 %, et rien ne l'aurait dit.
    const comptees = sansExemples(habits);
    const ids = new Set(comptees.map((h) => h.id));
    const n = Math.max(comptees.length, 1);
    const parDate = new Map<string, number>();
    for (const c of habitChecks) {
      if (!ids.has(c.habit_id)) continue;
      parDate.set(c.date, (parDate.get(c.date) ?? 0) + 1);
    }
    const w0 = weekdayOf(today);
    const lundi = addDays(today, w0 === 0 ? -6 : 1 - w0);
    const colonnes: { date: string; tenues: number; ratio: number; futur: boolean }[][] = [];
    for (let w = semaines - 1; w >= 0; w--) {
      const col: { date: string; tenues: number; ratio: number; futur: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(lundi, -7 * w + d);
        const tenues = parDate.get(date) ?? 0;
        col.push({ date, tenues, ratio: Math.min(tenues / n, 1), futur: date > today });
      }
      colonnes.push(col);
    }
    return { grille: colonnes, total: comptees.length };
  }, [habits, habitChecks, today, semaines]);

  const cases = (
    <div className={`flex gap-[3px] ${legende ? "" : className}`} role="img" aria-label={t("Habitudes tenues, jour par jour, sur {n} semaines", { n: semaines })}>
      {grille.map((semaine, wi) => (
        <div key={wi} className="flex flex-col gap-[3px]">
          {semaine.map((c) => (
            <div
              key={c.date}
              data-tip={c.futur ? undefined : formatDate(midi(c.date), { weekday: "long", day: "numeric", month: "long" })}
              data-tip-sub={c.futur ? undefined : `${c.tenues}/${total}`}
              className="h-3.5 w-3.5 rounded-[3px]"
              style={{
                backgroundColor: c.futur ? "transparent" : couleurCase(c.ratio),
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
  if (!legende) return cases;
  return (
    <div className={className}>
      {cases}
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-dim">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: couleurCase(0) }} aria-hidden />
          {t("aucune tenue")}
        </span>
        <span className="flex items-center gap-1">
          <span className="mr-0.5">{t("moins")}</span>
          {[1 / 3, 2 / 3, 1].map((r) => (
            <span key={r} className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: couleurCase(r) }} aria-hidden />
          ))}
          <span className="ml-0.5">{t("plus")}</span>
        </span>
      </p>
    </div>
  );
}

/** La teinte d'une case : la part des habitudes tenues ce jour-là. */
function couleurCase(ratio: number): string {
  return ratio === 0
    ? "var(--color-overlay)"
    : `color-mix(in srgb, var(--color-success-fill) ${Math.round(25 + ratio * 75)}%, transparent)`;
}

/**
 * La légende des carrés d'UNE habitude (`CarresHabitude`) : plein = tenue,
 * gris = pas tenue. Une seule fois au-dessus des lignes, pas sur chacune.
 */
export function LegendeCarres({ className = "" }: { className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-dim ${className}`}>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 shrink-0 rounded-[3px] bg-text-dim" aria-hidden />
        {t("Tenue")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: "var(--color-border)" }} aria-hidden />
        {t("Pas tenue")}
      </span>
    </p>
  );
}

/**
 * Les derniers jours d'une habitude : un carré par jour, plein quand elle a été
 * tenue. À LIRE, pas à cliquer. `jourChoisi` porte un contour : c'est le jour
 * que la case de la ligne coche.
 *
 * `anciens` : combien de carrés, parmi les plus vieux, portent `data-ancien` —
 * l'appelant les masque quand la place manque (requête de conteneur).
 */
export function CarresHabitude({
  jours,
  tenue,
  couleur,
  jourChoisi,
  anciens = 0,
  className = "",
}: {
  jours: readonly string[];
  tenue: (date: string) => boolean;
  couleur: string;
  jourChoisi?: string;
  /** Combien de carrés, en tête, portent `data-ancien` (masquables à l'étroit). */
  anciens?: number;
  className?: string;
}) {
  return (
    <span className={`flex shrink-0 gap-[3px] ${className}`} aria-hidden>
      {jours.map((date, i) => {
        const ok = tenue(date);
        return (
          <span
            key={date}
            data-ancien={i < anciens ? "" : undefined}
            data-tip={formatDate(midi(date), { weekday: "long", day: "numeric", month: "long" })}
            data-tip-sub={ok ? t("Tenue") : t("Pas tenue")}
            className={`h-3.5 w-3.5 rounded-[3px] transition-colors duration-150 ${
              date === jourChoisi ? "outline outline-1 outline-offset-1 outline-text-dim" : ""
            }`}
            style={{ backgroundColor: ok ? couleur : "var(--color-border)" }}
          />
        );
      })}
    </span>
  );
}
