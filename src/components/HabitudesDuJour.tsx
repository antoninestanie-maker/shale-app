import { CaseACocher, useCochesOptimistes } from "./CaseACocher";
import BadgeExemple from "./onboarding/BadgeExemple";
import { IconFlame } from "./icons";
import { serieHabitude } from "../lib/habitudes";
import { todayStr } from "../lib/logic";
import { estExemple } from "../lib/onboarding/exemples";
import { setHabitCheck } from "../lib/repo";
import type { AppData } from "../lib/types";

import { t } from "../lib/i18n";

/**
 * Les habitudes à tenir AUJOURD'HUI — le raccourci du tableau de bord vers le
 * Journal, où elles vivent (2026-10-07, à la place du graphique « 7 derniers
 * jours »).
 *
 * ⚠️ Même clé de coche optimiste (`h<id>:<date>`) et même écriture que la
 * ligne du Journal : une habitude cochée ici l'est là-bas, et la série vient
 * de `lib/habitudes.ts` pour que les deux écrans donnent le même chiffre.
 */
export default function HabitudesDuJour({
  data,
  refresh,
  ouvrirJournal,
}: {
  data: AppData;
  refresh: () => Promise<void>;
  ouvrirJournal?: () => void;
}) {
  const today = todayStr();
  const { etat, basculer } = useCochesOptimistes();

  if (data.habits.length === 0) {
    return (
      <div className="panel-grow flex flex-col items-center justify-center gap-1 py-4 text-center">
        <p className="text-sm text-text-dim">{t("Aucune habitude pour l'instant.")}</p>
        {ouvrirJournal ? (
          <button
            type="button"
            onClick={ouvrirJournal}
            className="text-xs text-blue hover:underline focus-visible:outline-2 focus-visible:outline-blue"
          >
            {t("Crée la première dans le Journal")}
          </button>
        ) : (
          <p className="text-xs text-text-dim/70">{t("Crée la première dans le Journal")}</p>
        )}
      </div>
    );
  }

  const faitesAujourdhui = new Set(
    data.habitChecks.filter((c) => c.date === today).map((c) => c.habit_id),
  );

  return (
    <ul className="panel-scroll flex flex-col gap-3 pr-0.5">
      {data.habits.map((habit) => {
        const cochee = etat(`h${habit.id}:${today}`, faitesAujourdhui.has(habit.id));
        return (
          <li key={habit.id} className="group flex shrink-0 items-center gap-3">
            <CaseACocher
              cochee={cochee}
              couleur={habit.color}
              onBascule={() =>
                void basculer(`h${habit.id}:${today}`, cochee, async (coche) => {
                  await setHabitCheck(habit.id, today, coche);
                  await refresh();
                })
              }
              libelle={t("{nom} aujourd'hui", { nom: habit.name })}
              tip={habit.name}
              tipSub={t("Cocher pour aujourd’hui.")}
            />
            <span
              className={`min-w-0 flex-1 truncate text-sm transition-colors duration-150 ${
                cochee ? "text-text-dim" : "text-text"
              }`}
              title={habit.name}
            >
              {habit.name}
            </span>
            {/* Pour un exemple, le badge REMPLACE la série — comme au Journal. */}
            {estExemple(habit) ? (
              <BadgeExemple />
            ) : (
              <span className="pill inline-flex shrink-0 items-center gap-1 bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-dim">
                <IconFlame className="h-2.5 w-2.5" /> {serieHabitude(habit.id, data.habitChecks, today)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
