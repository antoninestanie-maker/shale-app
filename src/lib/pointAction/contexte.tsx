import { createContext, useContext, useMemo, type ReactNode } from "react";
import { todayStr } from "../logic";
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
  return useMemo(() => {
    if (!data) return VIDE;
    const liste = actionsRequises(
      {
        tasks: data.tasks,
        completions: data.completions,
        goals: data.goals,
        habits: data.habits,
        habitChecks: data.habitChecks,
      },
      jour,
    );
    const cles = new Set(liste.map((a) => a.cle));
    return { liste, parModule: compterParModule(liste), requise: (c: string) => cles.has(c) };
  }, [data, jour]);
}

export function FournisseurActions({ valeur, children }: { valeur: EtatActions; children: ReactNode }) {
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useActions(): EtatActions {
  return useContext(Contexte);
}
