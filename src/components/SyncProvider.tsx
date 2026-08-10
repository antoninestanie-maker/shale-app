import { createContext, useContext, type ReactNode } from "react";

import { useSync, type ApiSync } from "../lib/sync/useSync";
import { useSession } from "./auth/AuthGate";

/**
 * Monte la synchronisation UNE fois pour toute l'app.
 *
 * Un contexte plutôt qu'un passage de props : l'indicateur vit dans la sidebar
 * et les commandes dans Réglages — une vue chargée en `lazy`. Faire transiter
 * l'objet par `App.tsx` obligerait à le traverser jusqu'à une vue qui n'est
 * même pas montée la plupart du temps.
 *
 * ⚠️ À monter à l'INTÉRIEUR d'`AuthGate` : la synchronisation a besoin de la
 * session, et n'a aucun sens tant que l'utilisateur n'est pas entré.
 */
const ContexteSync = createContext<ApiSync | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  // ⚠️ `jetonFrais` et non `session.access_token` : un jeton Supabase ne vit
  // qu'une heure, et la synchronisation tourne toutes les 90 secondes pendant
  // toute la durée de vie de l'app. Voir `AuthState.jetonFrais`.
  const { session, jetonFrais } = useSession();
  const api = useSync(session, jetonFrais);
  return <ContexteSync.Provider value={api}>{children}</ContexteSync.Provider>;
}

export function useSyncApi(): ApiSync {
  const ctx = useContext(ContexteSync);
  if (!ctx) throw new Error("useSyncApi doit être utilisé dans <SyncProvider>");
  return ctx;
}
