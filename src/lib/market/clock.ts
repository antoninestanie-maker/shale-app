/**
 * Horloge des marchés : week-end forex + sessions de trading actives.
 *
 * Conventions (robustes DST, calculées via Intl dans le fuseau de CHAQUE place) :
 * - Forex fermé du vendredi 17:00 New York au dimanche 17:00 New York.
 * - Sessions : Sydney 07–16 h (Australia/Sydney), Tokyo 09–18 h (Asia/Tokyo),
 *   Londres 08–17 h (Europe/London), New York 08–17 h (America/New_York).
 * - La crypto (BTC) reste ouverte 24/7 : le mode week-end ne la concerne pas.
 *
 * Tout est calculé à partir de l'instant absolu → l'affichage suit
 * automatiquement le fuseau local de l'appareil.
 *
 * Test / simulation : `window.__sbSetFakeNow("2026-07-11T08:00:00Z")` fige
 * l'horloge (null pour revenir au réel) — un événement `sb:market-clock` force
 * le recalcul immédiat des hooks montés.
 */
import { useEffect, useState } from "react";
import { localeTag, t } from "../i18n";

export interface TradingSession {
  id: "sydney" | "tokyo" | "london" | "newyork";
  label: string;
  timeZone: string;
  /** heures locales de la place [ouverture, fermeture) */
  open: number;
  close: number;
}

export const SESSIONS: TradingSession[] = [
  { id: "sydney", label: "Sydney", timeZone: "Australia/Sydney", open: 7, close: 16 },
  { id: "tokyo", label: "Tokyo", timeZone: "Asia/Tokyo", open: 9, close: 18 },
  { id: "london", label: "Londres", timeZone: "Europe/London", open: 8, close: 17 },
  { id: "newyork", label: "New York", timeZone: "America/New_York", open: 8, close: 17 },
];

export interface MarketClock {
  /** marché forex/indices ouvert ? (BTC : toujours) */
  forexOpen: boolean;
  /** sessions actives à cet instant (vide si marché fermé ou rollover) */
  activeSessions: TradingSession[];
  /** prochaine réouverture (si fermé), formatée pour l'heure locale de l'appareil */
  reopenLabel: string | null;
  /** instant du calcul */
  now: Date;
}

// --- Horloge simulable (tests) ---
let fakeNow: number | null = null;
export function setFakeNow(iso: string | null): void {
  fakeNow = iso ? new Date(iso).getTime() : null;
  window.dispatchEvent(new CustomEvent("sb:market-clock"));
}
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__sbSetFakeNow = setFakeNow;
}
const nowDate = () => new Date(fakeNow ?? Date.now());

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Jour de semaine (0=dim) + minutes écoulées depuis minuit, dans un fuseau donné. */
function tzParts(date: Date, timeZone: string): { dow: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const dow = DOW.indexOf(get("weekday"));
  const hour = parseInt(get("hour"), 10) % 24; // "24" à minuit chez certains moteurs
  const minutes = hour * 60 + parseInt(get("minute"), 10);
  return { dow, minutes };
}

/** Forex ouvert ? Fermé de vendredi 17:00 NY à dimanche 17:00 NY. */
export function isForexOpen(date: Date = nowDate()): boolean {
  const { dow, minutes } = tzParts(date, "America/New_York");
  if (dow === 6) return false; // samedi
  if (dow === 5 && minutes >= 17 * 60) return false; // vendredi soir
  if (dow === 0 && minutes < 17 * 60) return false; // dimanche avant 17 h
  return true;
}

/** Prochaine réouverture (précision minute, DST-proof par recherche). */
export function nextForexOpen(date: Date = nowDate()): Date | null {
  if (isForexOpen(date)) return null;
  let t = date.getTime();
  const HOUR = 3_600_000;
  // avance heure par heure (< 72 itérations), puis affine à la minute
  while (!isForexOpen(new Date(t))) t += HOUR;
  let lo = t - HOUR;
  while (!isForexOpen(new Date(lo))) lo += 60_000;
  return new Date(lo);
}

/** Sessions actives à cet instant (heure locale de chaque place). */
export function activeSessions(date: Date = nowDate()): TradingSession[] {
  if (!isForexOpen(date)) return [];
  return SESSIONS.filter((s) => {
    const { minutes } = tzParts(date, s.timeZone);
    return minutes >= s.open * 60 && minutes < s.close * 60;
  });
}

/** « reprise lundi 00:00 » — jour + heure exprimés dans le fuseau de l'appareil. */
function formatReopen(d: Date): string {
  const day = new Intl.DateTimeFormat(localeTag(), { weekday: "long" }).format(d);
  const time = new Intl.DateTimeFormat(localeTag(), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return t("reprise {day} à {time}", { day, time });
}

export function computeMarketClock(date: Date = nowDate()): MarketClock {
  const open = isForexOpen(date);
  const reopen = open ? null : nextForexOpen(date);
  return {
    forexOpen: open,
    activeSessions: activeSessions(date),
    reopenLabel: reopen ? formatReopen(reopen) : null,
    now: date,
  };
}

/**
 * Hook : horloge de marché rafraîchie en continu (30 s + retour d'onglet +
 * événement `sb:market-clock`). État initial calculé de façon synchrone →
 * aucun flash à l'affichage.
 */
export function useMarketClock(): MarketClock {
  const [clock, setClock] = useState<MarketClock>(() => computeMarketClock());

  useEffect(() => {
    const tick = () => setClock(computeMarketClock());
    const id = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("sb:market-clock", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("sb:market-clock", tick);
    };
  }, []);

  return clock;
}
