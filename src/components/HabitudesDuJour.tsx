import { CaseACocher, useCochesOptimistes } from "./CaseACocher";
import BadgeExemple from "./onboarding/BadgeExemple";
import { IconFlame } from "./icons";
import { CarresHabitude, GrilleHabitudes } from "./habitudes/Grilles";
import { JOURS_HISTORIQUE, derniersJours, serieHabitude } from "../lib/habitudes";
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
 *
 * ⭐ ELLES EMPORTENT LEURS GRILLES (2026-10-13, Antonin : « les habitudes à
 * tenir doivent emporter leurs grilles, donc un widget plus gros »). La grille
 * des douze semaines et les derniers jours de chaque habitude sont celles du
 * Journal (`habitudes/Grilles.tsx`), à lire. La carte se range selon SA
 * largeur, pas celle de la fenêtre (requêtes de conteneur) :
 *   · étroite (4 colonnes) : la grille, puis les lignes — sept jours chacune ;
 *   · dès 28 rem : quatorze jours et la série ;
 *   · dès 34 rem (8 colonnes) : la grille à gauche, les lignes à droite ;
 *   · dès 50 rem (pleine largeur) : quatorze jours de nouveau.
 * Étroite, toute la carte défile d'un bloc ; large, seules les lignes défilent.
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
            className="cible-tactile-ligne text-xs text-blue hover:underline focus-visible:outline-2 focus-visible:outline-blue"
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

  const jours = derniersJours(today);
  const parHabitude = new Map<number, Set<string>>();
  for (const c of data.habitChecks) {
    let dates = parHabitude.get(c.habit_id);
    if (!dates) parHabitude.set(c.habit_id, (dates = new Set()));
    dates.add(c.date);
  }

  return (
    <div className="@container panel-grow panel-col">
      <div className="panel-scroll panel-col gap-4 pr-0.5 @[34rem]:flex-row @[34rem]:gap-6 @[34rem]:overflow-visible @[34rem]:pr-0">
        <GrilleHabitudes habits={data.habits} habitChecks={data.habitChecks} today={today} className="shrink-0" />
        <ul className="flex min-w-0 flex-col gap-3 @[34rem]:min-h-0 @[34rem]:flex-1 @[34rem]:overflow-y-auto @[34rem]:overscroll-contain @[34rem]:pr-0.5">
          {data.habits.map((habit) => {
            const cochee = etat(`h${habit.id}:${today}`, faitesAujourdhui.has(habit.id));
            const dates = parHabitude.get(habit.id);
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
                  <span className="pill hidden shrink-0 items-center gap-1 bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-dim @[28rem]:inline-flex">
                    <IconFlame className="h-2.5 w-2.5" /> {serieHabitude(habit.id, data.habitChecks, today)}
                  </span>
                )}
                {/* Aujourd'hui suit la case AU CLIC, comme elle. */}
                <CarresHabitude
                  jours={jours}
                  tenue={(date) => (date === today ? cochee : !!dates?.has(date))}
                  couleur={habit.color}
                  anciens={JOURS_HISTORIQUE - 7}
                  className="[&>[data-ancien]]:hidden @[28rem]:[&>[data-ancien]]:block @[34rem]:[&>[data-ancien]]:hidden @[50rem]:[&>[data-ancien]]:block"
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
