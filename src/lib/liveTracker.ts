// Cœur métier du tracker live trading — logique PURE et testable, sans React
// ni DB (même philosophie que sizing.ts). Tout ce qui touche au résultat en R
// (partielles, dénouement) vit ici : une erreur a un impact direct sur les
// statistiques de trading.
import type { LiveOutcome, LivePartial, LivePosition } from "./types";
import { t } from "./i18n";

/**
 * Ratio risque/récompense théorique (récompense ÷ risque), calculé à la
 * réception de la position. null si le TP manque ou est incohérent avec le
 * sens (TP sous l'entrée pour un long, etc.).
 */
export function theoreticalRR(
  entry: number,
  stopLoss: number,
  takeProfit: number | null | undefined,
  direction: "long" | "short",
): number | null {
  if (
    takeProfit == null ||
    !Number.isFinite(entry) ||
    !Number.isFinite(stopLoss) ||
    !Number.isFinite(takeProfit)
  )
    return null;
  const risk = Math.abs(entry - stopLoss);
  if (risk === 0) return null;
  const reward = direction === "long" ? takeProfit - entry : entry - takeProfit;
  if (reward <= 0) return null;
  return Math.round((reward / risk) * 100) / 100;
}

/** R (signé) atteint à un prix de sortie donné : +1R = distance du stop. */
export function rAtPrice(
  entry: number,
  stopLoss: number,
  direction: "long" | "short",
  exitPrice: number,
): number | null {
  const risk = Math.abs(entry - stopLoss);
  if (risk === 0 || !Number.isFinite(exitPrice)) return null;
  const gain = direction === "long" ? exitPrice - entry : entry - exitPrice;
  return Math.round((gain / risk) * 100) / 100;
}

/** Parse défensif du JSON `partials` stocké en base. */
export function parsePartials(json: string | null | undefined): LivePartial[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Part de la position déjà fermée par les partielles (0–100). */
export function closedPct(partials: LivePartial[]): number {
  return partials.reduce((sum, p) => sum + (Number.isFinite(p.pct) ? p.pct : 0), 0);
}

/** Contribution en R des partielles (pondérée par leur taille). */
export function partialsR(partials: LivePartial[]): number {
  return partials.reduce((sum, p) => sum + (p.pct / 100) * p.r, 0);
}

/**
 * Résultat final en R au dénouement, pondéré par les sorties partielles :
 * chaque partielle contribue pct×R, le restant est valorisé selon l'issue —
 * gagnante = R:R théorique (ou `remainderR` explicite si pas de TP),
 * perdante = −1R (stop plein), break-even = 0.
 * Renvoie null si l'issue est "win" sans R:R connu ni `remainderR`.
 */
export function finalResultR(
  pos: Pick<LivePosition, "rr_theoretical">,
  partials: LivePartial[],
  outcome: LiveOutcome,
  remainderR?: number,
): number | null {
  const remaining = Math.max(0, 1 - closedPct(partials) / 100);
  let rOfRemainder: number;
  if (outcome === "loss") rOfRemainder = -1;
  else if (outcome === "be") rOfRemainder = 0;
  else {
    const target = remainderR ?? pos.rr_theoretical;
    if (target == null || !Number.isFinite(target)) return null;
    rOfRemainder = target;
  }
  const total = partialsR(partials) + remaining * rOfRemainder;
  return Math.round(total * 100) / 100;
}

/** Notes auto pour la ligne du journal créée à la clôture (traçabilité). */
export function buildJournalNotes(
  pos: Pick<
    LivePosition,
    "entry_price" | "stop_loss_price" | "take_profit_price" | "lots" | "opened_at"
  >,
  partials: LivePartial[],
  outcome: LiveOutcome,
): string {
  const bits = [
    t("Tracker — entrée {px}", { px: fmtPx(pos.entry_price) }),
    `SL ${fmtPx(pos.stop_loss_price)}`,
    pos.take_profit_price != null ? `TP ${fmtPx(pos.take_profit_price)}` : null,
    pos.lots != null ? `${fmtPx(pos.lots)} lot` : null,
    `ouverte ${pos.opened_at.slice(11, 16)}`,
  ].filter(Boolean);
  const parts = partials.map((p) => `${p.pct}% @ ${fmtSignedR(p.r)}`);
  const label =
    outcome === "win" ? "gagnante" : outcome === "loss" ? "perdante" : "break-even";
  return [bits.join(" · "), parts.length ? `partielles : ${parts.join(", ")}` : null, label]
    .filter(Boolean)
    .join(" · ");
}

// — Helpers d'affichage —

/** Prix/quantité sans zéros parasites (les valeurs gardent leur précision de saisie). */
export function fmtPx(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}

export function fmtRR(rr: number | null): string {
  return rr == null ? "—" : `1:${rr}`;
}

export function fmtSignedR(r: number): string {
  const v = Math.round(r * 100) / 100;
  return v > 0 ? `+${v}R` : `${v}R`;
}

/** Minutes écoulées depuis un datetime local "YYYY-MM-DD HH:MM:SS". */
export function elapsedMin(openedAt: string, now = new Date()): number {
  const [d, t] = openedAt.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min, s] = (t ?? "00:00:00").split(":").map(Number);
  const start = new Date(y, m - 1, day, h, min, s ?? 0).getTime();
  return Math.max(0, Math.floor((now.getTime() - start) / 60000));
}

export function fmtElapsed(minutes: number): string {
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
  const days = Math.floor(h / 24);
  return `${days} j ${h % 24} h`;
}
