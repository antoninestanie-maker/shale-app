// Hook Market-Brain : scheduler (8h/14h + rattrapage au lancement), chargement
// du briefing stocké, badge « nouveau », régénération et fermeture (dismiss).
// Monté au niveau App pour piloter le badge de la sidebar indépendamment de
// l'onglet actif.
import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "../repo";
import {
  generateBriefing,
  generateFlash,
  isPastTrigger,
  loadStoredBriefing,
  TRIGGER_HOUR,
  type Briefing,
} from "./agent";
import { hasAnyKey } from "./llm";
import { dismissBriefing, getBriefing, purgeOldBriefings } from "./memory";
import { currentSession } from "./payload";

const CHECK_MS = 5 * 60 * 1000; // re-vérifie le déclenchement toutes les 5 min

export interface MarketBrainState {
  briefing: Briefing | null;
  loading: boolean;
  error: string | null;
  dismissed: boolean;
  hasKey: boolean;
  isDemo: boolean;
  /** Badge sidebar : un briefing frais non fermé est disponible. */
  badge: boolean;
  session: "pre_london" | "pre_ny";
  triggerHour: number;
  regenerate: () => Promise<void>;
  dismiss: () => Promise<void>;
  /** Briefing flash (intra-séance, non persisté) — null si aucun en cours. */
  flash: Briefing | null;
  flashLoading: boolean;
  runFlash: () => Promise<void>;
  clearFlash: () => void;
}

export function useMarketBrain(): MarketBrainState {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [flash, setFlash] = useState<Briefing | null>(null);
  const [flashLoading, setFlashLoading] = useState(false);
  const purged = useRef(false);
  // Miroir de `briefing` pour le scheduler : `refresh` est mémoïsé sans dépendre
  // de l'état, sinon la closure garderait `briefing = null` et régénérerait
  // la démo à chaque tick de l'intervalle.
  const briefingRef = useRef<Briefing | null>(null);
  briefingRef.current = briefing;

  const session = currentSession();
  const isDemo = !isTauri;

  const generate = useCallback(async (s: "pre_london" | "pre_ny") => {
    setLoading(true);
    setError(null);
    try {
      const b = await generateBriefing(s);
      setBriefing(b);
      setDismissed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const s = currentSession();

    if (isDemo) {
      // Preview navigateur : démo, pas de persistance.
      if (!briefingRef.current) await generate(s);
      return;
    }

    if (!purged.current) {
      purged.current = true;
      await purgeOldBriefings().catch(() => {});
    }

    const key = await hasAnyKey();
    setHasKey(key);

    const row = await getBriefing(s);
    if (row) {
      setDismissed(row.dismissed === 1);
      const b = await loadStoredBriefing(s);
      if (b) setBriefing(b);
      return;
    }

    // Pas de briefing stocké : générer si l'heure de déclenchement est passée
    // et qu'une clé est configurée (sinon on laisse l'onglet proposer l'action).
    setBriefing(null);
    setDismissed(false);
    if (key && isPastTrigger(s)) await generate(s);
  }, [isDemo, generate]);

  useEffect(() => {
    // catch : un échec DB/réseau dans l'intervalle ne doit pas casser le scheduler.
    const tick = () => refresh().catch((e) => console.error("market refresh:", e));
    tick();
    const id = window.setInterval(tick, CHECK_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const regenerate = useCallback(async () => {
    await generate(currentSession());
  }, [generate]);

  const dismiss = useCallback(async () => {
    setDismissed(true);
    await dismissBriefing(currentSession()).catch(() => {});
  }, []);

  const runFlash = useCallback(async () => {
    setFlashLoading(true);
    setError(null);
    try {
      setFlash(await generateFlash(currentSession()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFlashLoading(false);
    }
  }, []);

  const clearFlash = useCallback(() => setFlash(null), []);

  const badge = !!briefing && !dismissed && !isDemo;

  return {
    briefing,
    loading,
    error,
    dismissed,
    hasKey,
    isDemo,
    badge,
    session,
    triggerHour: TRIGGER_HOUR[session],
    regenerate,
    dismiss,
    flash,
    flashLoading,
    runFlash,
    clearFlash,
  };
}
