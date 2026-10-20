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
  const contexte = useContexteObjectifs(data);

  return useMemo<SourcesProgression>(
    () => ({
      goals: data.goals,
      tasks: data.tasks,
      completions: data.completions,
      habits: data.habits,
      habitChecks: data.habitChecks,
      liens: contexte.liens,
      evenements: contexte.evenements,
      maintenant: maintenantLocal(),
    }),
    [data.goals, data.tasks, data.completions, data.habits, data.habitChecks, contexte],
  );
}

/**
 * Les arêtes et les événements rattachés, relus à chaque rafraîchissement des
 * données — ce que `mesurer()` doit recevoir pour compter un objectif comme sa
 * page le compte.
 *
 * ⚠️ Sans eux, un objectif qui ne tient qu'à des événements rattachés se mesure
 * comme une case vide à 0 % : « objectif dépassé » dans le point d'action, la
 * barre latérale et le centre de notifications, alors que sa page le dit
 * atteint (objectifs-1 = rythme-4, audit du 2026-10-20). `data` peut être nul
 * (avant le premier chargement) : le contexte reste alors vide.
 */
export function useContexteObjectifs(data: AppData | null): ContexteObjectifs {
  const [contexte, setContexte] = useState<ContexteObjectifs>(CONTEXTE_VIDE);
  useEffect(() => {
    if (!data) return;
    let vivant = true;
    // Une lecture ratée ne doit pas faire tomber l'écran : on garde le contexte
    // précédent, la mesure reste celle des tâches et des habitudes.
    fetchContexteObjectifs()
      .then((c) => vivant && setContexte(c))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, [data]);
  return contexte;
}

/** L'instant local que lit `mesurer()` : un événement compte une fois PASSÉ. */
export function maintenantLocal(): string {
  return `${todayStr()} ${new Date().toTimeString().slice(0, 5)}`;
}
