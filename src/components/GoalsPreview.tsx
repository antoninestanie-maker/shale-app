import { effectiveProgress, todayStr } from "../lib/logic";
import { ouvrirParId } from "../lib/naviguer";
import { estAcheve, mesurer, type SourcesProgression } from "../lib/objectifs/progression";
import { mentionEcheance } from "../lib/objectifs/echeance";
import { estRacine } from "../lib/objectifs/retard";
import type { AppData, Goal } from "../lib/types";

import { t, tp } from "../lib/i18n";
/** Clés françaises, traduites à l'affichage — cf. `GoalsView`. */
const SCOPE_LABEL: Record<Goal["scope"], string> = {
  short: "court terme",
  medium: "moyen terme",
  long: "long terme",
};

/**
 * La carte « Objectifs en cours » d'Aujourd'hui.
 *
 * ⭐ Les objectifs RACINES seulement (2026-10-11). Elle listait chaque étape
 * comme un objectif à part : quatre « objectifs en cours » ici, deux dans la vue
 * Objectifs ; créer un objectif à deux étapes ajoutait trois lignes (crible du
 * labo, constat 13 ; audit A06a-09). Une étape se lit sur la page de son
 * objectif — et son avancement est déjà dans celui de l'objectif.
 *
 * ⭐ L'avancement se lit par `effectiveProgress`, avec les sources COMPLÈTES
 * (`useSourcesProgression` : arêtes et événements rattachés compris). La carte
 * mesurait sans les événements, que la page de l'objectif compte : deux
 * chiffres pour le même objectif. Elle ne recompte rien de son côté.
 *
 * Chaque ligne dit le retard de l'objectif s'il y en a un, et l'ouvre.
 *
 * ⭐ Chaque ligne écrit l'ÉCHÉANCE de l'objectif (2026-10-12) — Antonin : « la
 * deadline de l'objectif, c'est très important ». La date vient de
 * `mentionEcheance` (`lib/objectifs/echeance.ts`), la même écriture que la
 * liste des objectifs : l'année paraît dès que ce n'est pas l'année en cours.
 */
export default function GoalsPreview({ data, sources }: { data: AppData; sources: SourcesProgression }) {
  const { goals } = data;
  const today = todayStr();
  const withPct = goals
    .filter((g) => estRacine(g, goals))
    .map((g) => ({
      goal: g,
      pct: effectiveProgress(g, sources.goals, sources.tasks, sources.completions, sources),
      // ⚠️ « En cours » = pas ACHEVÉ, pas « sous 100 % » : un objectif à 100 %
      // dont des étapes sont vides n'est pas fini (feuille de route, 2026-09-15).
      acheve: estAcheve(mesurer(g, sources)),
      echeance: mentionEcheance(g.deadline, today),
    }));

  // Plus de `.slice(0, 4)` : la liste défile dans la carte (`.panel-scroll`) —
  // agrandir le widget montre RÉELLEMENT plus d'objectifs.
  const active = withPct
    .filter(({ acheve }) => !acheve)
    .sort((a, b) =>
      (a.goal.deadline ?? "9999") < (b.goal.deadline ?? "9999") ? -1 : 1,
    );

  if (active.length === 0) {
    return (
      <div className="panel-grow flex flex-col items-center justify-center gap-1 py-4 text-center">
        <p className="text-sm text-text-dim">{t("Aucun objectif en cours.")}</p>
        <p className="text-xs text-text-dim/70">{t("Crée-en un dans l'onglet Objectifs.")}</p>
      </div>
    );
  }

  // ⭐ Survol revu (2026-10-20) — Antonin : « très moyen ». Le fond de survol
  // (`overlay`) avait la teinte de la piste (`surface-2`) : la barre disparaissait,
  // la pastille d'horizon flottait seule à droite, et le cadre (`-mx-2`) débordait
  // sous l'ascenseur. Désormais : la piste est en `overlay-2`, visible sur la carte
  // comme sous le survol ; horizon et échéance tiennent sur UNE ligne discrète ;
  // le cadre reste dans la carte, l'ascenseur a sa marge.
  return (
    <ul className="panel-scroll -mx-2 flex flex-col gap-0.5 pr-1">
      {active.map(({ goal, pct, echeance }) => (
        <li key={goal.id} className="shrink-0">
          {/* Toute la ligne ouvre l'objectif : c'est là qu'on agit sur lui. */}
          <button
            type="button"
            onClick={() => ouvrirParId("goal", goal.id)}
            className="block w-full rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-overlay focus-visible:bg-overlay"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate-souris min-w-0 truncate text-sm text-text" title={goal.title}>
                {goal.title}
              </span>
              <span className="shrink-0 font-display text-sm font-bold tabular-nums text-text">
                {pct}%
              </span>
            </span>
            <span className="pill mt-2 block h-1 overflow-hidden bg-overlay-2">
              <span
                className="pill block h-full bg-[image:var(--gradient-brand)] transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </span>
            {/* Horizon, échéance et retard : des faits, écrits en clair sur une
                seule ligne — pas une alarme rouge. */}
            <span className="mt-1.5 block truncate text-[11px] text-text-dim">
              {t(SCOPE_LABEL[goal.scope])}
              {echeance && (
                <>
                  {" · "}
                  {t("échéance {date}", { date: echeance.date })}
                  {echeance.retard > 0 && (
                    <> · {tp(echeance.retard, "dépassée d'un jour", "dépassée de {n} jours")}</>
                  )}
                </>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
