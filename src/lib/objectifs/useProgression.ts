import { useEffect, useMemo, useState } from "react";
import { todayStr } from "../logic";
import { fetchContexteObjectifs } from "../repo";
import type { AppData } from "../types";
import { CONTEXTE_VIDE, type ContexteObjectifs } from "./contexte";
import type { SourcesProgression } from "./progression";

/**
 * ⭐ Ce qu'il faut pour MESURER un objectif hors de la vue Objectifs — la carte
 * « Objectifs en cours » et la ligne « En retard » d'Aujourd'hui (2026-10-11).
 *
 * La carte d'Aujourd'hui mesurait sans les ÉVÉNEMENTS rattachés, que la page de
 * l'objectif compte : deux chiffres pour le même objectif. Les arêtes et les
 * événements vivent hors d'`AppData` (`fetchContexteObjectifs`) ; ce crochet les
 * lit comme le fait `GoalsView`, à chaque rafraîchissement, et rend les sources
 * complètes de `mesurer()` / `effectiveProgress()`. Aucun écran ne recompte.
 */
export function useSourcesProgression(data: AppData): SourcesProgression {
  const [contexte, setContexte] = useState<ContexteObjectifs>(CONTEXTE_VIDE);
  useEffect(() => {
    let vivant = true;
    // Une lecture ratée ne doit pas faire tomber l'écran d'accueil : on garde
    // le contexte précédent, la mesure reste celle des tâches et des habitudes.
    fetchContexteObjectifs()
      .then((c) => vivant && setContexte(c))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, [data]);

  return useMemo<SourcesProgression>(
    () => ({
      goals: data.goals,
      tasks: data.tasks,
      completions: data.completions,
      habits: data.habits,
      habitChecks: data.habitChecks,
      liens: contexte.liens,
      evenements: contexte.evenements,
      maintenant: `${todayStr()} ${new Date().toTimeString().slice(0, 5)}`,
    }),
    [data.goals, data.tasks, data.completions, data.habits, data.habitChecks, contexte],
  );
}
