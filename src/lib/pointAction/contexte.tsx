import { createContext, useContext, useMemo, type ReactNode } from "react";
import { todayStr } from "../logic";
import { maintenantLocal, useContexteObjectifs } from "../objectifs/useProgression";
import type { ContexteObjectifs } from "../objectifs/contexte";
import type { AppData } from "../types";
import { actionsRequises, compterParModule, type ActionRequise, type ModuleAction } from "./regle";

/**
 * Le point d'action, partagé (2026-10-20). Calculé UNE fois dans `App.tsx`
 * à partir des données de l'app ; la barre latérale, la barre d'onglets, le
 * centre de notifications et chaque ligne concernée LISENT ce contexte.
 * Aucun d'eux n'appelle `actionsRequises` : la règle n'a qu'un seul calcul.
 */
export interface EtatActions {
  liste: readonly ActionRequise[];
  parModule: Partial<Record<ModuleAction, number>>;
  /** Cet élément attend-il une action ? (`cleTache(id)` / `cleObjectif(id)`) */
  requise: (cle: string) => boolean;
}

const VIDE: EtatActions = { liste: [], parModule: {}, requise: () => false };
const Contexte = createContext<EtatActions>(VIDE);

export function useCalculActions(data: AppData | null): EtatActions {
  const jour = todayStr();
  // ⭐ Les arêtes et les événements rattachés : sans eux, un objectif compté par
  // ses événements devenait une case vide à 0 %, « dépassé » ici et atteint sur
  // sa page (objectifs-1 = rythme-4, 2026-10-20).
  const contexte = useContexteObjectifs(data);
  return useMemo(
    () => (data ? calculerActions(data, contexte, jour, maintenantLocal()) : VIDE),
    [data, jour, contexte],
  );
}

/** Le calcul, sans React : ce que lisent tous les écrans (testé). */
export function calculerActions(
  data: Pick<AppData, "tasks" | "completions" | "goals" | "habits" | "habitChecks">,
  contexte: Pick<ContexteObjectifs, "liens" | "evenements">,
  jour: string,
  maintenant: string,
): EtatActions {
  const liste = actionsRequises(
    {
      tasks: data.tasks,
      completions: data.completions,
      goals: data.goals,
      habits: data.habits,
      habitChecks: data.habitChecks,
      liens: contexte.liens,
      evenements: contexte.evenements,
      maintenant,
    },
    jour,
  );
  const cles = new Set(liste.map((a) => a.cle));
  return { liste, parModule: compterParModule(liste), requise: (c: string) => cles.has(c) };
}

export function FournisseurActions({ valeur, children }: { valeur: EtatActions; children: ReactNode }) {
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useActions(): EtatActions {
  return useContext(Contexte);
}
