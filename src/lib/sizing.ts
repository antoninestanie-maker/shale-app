// Cœur métier du calculateur de taille de position — logique PURE et testable,
// sans dépendance React ni DB. La priorité est l'exactitude : une erreur ici a
// un impact financier réel. Toute conversion pip/lot passe par la config de la
// paire (pairs.ts) et les seuils utilisateur — rien n'est hardcodé côté UI.
import type { PairConfig } from "./pairs";

import { localeTag, t } from "./i18n";
export interface SizingInput {
  capital: number;
  riskPercent: number;
  pair: PairConfig | null;
  entryPrice: number;
  stopLossPrice: number;
  spreadPips: number;
  includeSpread: boolean;
  direction: "long" | "short";
}

export interface SizingThresholds {
  maxRiskPercent: number; // seuil d'alerte risque (défaut 2)
  maxLots: number | null; // limite de lots (règle prop firm), optionnel
  minLot: number; // plus petit lot tradable (défaut 0.01 = micro)
}

export interface SizingResult {
  ok: boolean; // calcul valide (sinon `error` est renseigné)
  error: string | null; // message bloquant
  warnings: string[]; // alertes non bloquantes
  highRisk: boolean; // risque au-dessus du seuil
  exceedsMaxLots: boolean; // dépasse la limite de lots
  belowMinLot: boolean; // sous le minimum tradable
  riskUSD: number; // montant risqué cible
  slDistancePips: number; // distance SL brute (sans spread)
  effectiveDistancePips: number; // distance SL utilisée (avec spread si actif)
  spreadApplied: number; // spread réellement ajouté (0 si désactivé)
  lots: number; // taille arrondie au minimum tradable
  lotsRaw: number; // taille non arrondie
  miniLots: number;
  microLots: number;
  units: number; // unités brutes (lots × contractSize)
  actualRiskUSD: number; // risque réel après arrondi du lot
  pipValuePerLot: number; // valeur de pip utilisée (traçabilité)
}

const EMPTY = {
  highRisk: false,
  exceedsMaxLots: false,
  belowMinLot: false,
  riskUSD: 0,
  slDistancePips: 0,
  effectiveDistancePips: 0,
  spreadApplied: 0,
  lots: 0,
  lotsRaw: 0,
  miniLots: 0,
  microLots: 0,
  units: 0,
  actualRiskUSD: 0,
  pipValuePerLot: 0,
};

function invalid(error: string, warnings: string[] = []): SizingResult {
  return { ok: false, error, warnings, ...EMPTY };
}

/** Arrondi au pas du lot minimum (ex. 0.01) — évite les tailles non exécutables. */
function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function computeSizing(
  input: SizingInput,
  thresholds: SizingThresholds,
): SizingResult {
  const {
    capital,
    riskPercent,
    pair,
    entryPrice,
    stopLossPrice,
    spreadPips,
    includeSpread,
    direction,
  } = input;
  const warnings: string[] = [];

  // — Configuration de la paire —
  if (!pair) return invalid(t("Sélectionne une paire."));
  if (pair.requiresConversion) {
    warnings.push(
      t("{pair} n'est pas cotée en USD : vérifie la valeur du pip manuellement (conversion de devise requise).", { pair: pair.symbol }),
    );
  }
  if (!Number.isFinite(pair.pipSize) || pair.pipSize <= 0)
    return invalid(t("Taille de pip invalide pour {pair}.", { pair: pair.symbol }), warnings);
  if (
    !Number.isFinite(pair.pipValuePerStandardLot) ||
    pair.pipValuePerStandardLot <= 0
  )
    return invalid(
      t("Renseigne la valeur du pip pour {pair} dans les réglages.", { pair: pair.symbol }),
      warnings,
    );

  // — Inputs numériques —
  if (!Number.isFinite(capital) || capital <= 0)
    return invalid(t("Capital invalide — saisis un montant positif."), warnings);
  if (!Number.isFinite(riskPercent) || riskPercent <= 0)
    return invalid(t("Risque invalide — saisis un pourcentage positif."), warnings);
  if (riskPercent > 100)
    return invalid(t("Risque supérieur à 100 % — impossible."), warnings);
  if (!Number.isFinite(entryPrice) || entryPrice <= 0)
    return invalid(t("Prix d'entrée invalide."), warnings);
  if (!Number.isFinite(stopLossPrice) || stopLossPrice <= 0)
    return invalid(t("Prix du stop-loss invalide."), warnings);

  // — Distance du stop (empêche toute division par zéro) —
  const rawDistance = Math.abs(entryPrice - stopLossPrice);
  if (rawDistance === 0)
    return invalid(
      t("Stop-loss invalide : identique au prix d'entrée."),
      warnings,
    );

  const slDistancePips = rawDistance / pair.pipSize;
  const spreadApplied =
    includeSpread && Number.isFinite(spreadPips) && spreadPips > 0
      ? spreadPips
      : 0;
  const effectiveDistancePips = slDistancePips + spreadApplied;

  // — Taille de position —
  const riskUSD = capital * (riskPercent / 100);
  const lotsRaw =
    riskUSD / (effectiveDistancePips * pair.pipValuePerStandardLot);
  const lots = roundToStep(lotsRaw, thresholds.minLot);
  const actualRiskUSD =
    lots * effectiveDistancePips * pair.pipValuePerStandardLot;

  // — Alertes —
  const highRisk = riskPercent > thresholds.maxRiskPercent;
  if (highRisk)
    warnings.push(
      `Risque élevé (${fmtPercent(riskPercent)}) — au-dessus de ton seuil de ${fmtPercent(
        thresholds.maxRiskPercent,
      )}. Reconsidère la taille ou le stop-loss.`,
    );

  const exceedsMaxLots =
    thresholds.maxLots != null && lots > thresholds.maxLots;
  if (exceedsMaxLots)
    warnings.push(
      `Taille (${fmtLots(lots)} lots) au-dessus de ta limite de ${fmtLots(
        thresholds.maxLots as number,
      )} lots.`,
    );

  const belowMinLot = lots < thresholds.minLot;
  if (belowMinLot)
    warnings.push(
      t("Taille calculée ({lots} lots) sous le minimum tradable ({min}). Augmente le risque ou resserre le stop-loss.", { lots: lotsRaw.toFixed(4), min: thresholds.minLot }),
    );

  // Cohérence sens / stop (non bloquant : la distance est absolue).
  if (direction === "long" && stopLossPrice >= entryPrice)
    warnings.push(
      t("Pour un long, le stop-loss devrait être sous le prix d'entrée."),
    );
  if (direction === "short" && stopLossPrice <= entryPrice)
    warnings.push(
      t("Pour un short, le stop-loss devrait être au-dessus du prix d'entrée."),
    );

  return {
    ok: true,
    error: null,
    warnings,
    highRisk,
    exceedsMaxLots,
    belowMinLot,
    riskUSD,
    slDistancePips,
    effectiveDistancePips,
    spreadApplied,
    lots,
    lotsRaw,
    miniLots: lots * 10,
    microLots: lots * 100,
    units: lots * pair.contractSize,
    actualRiskUSD,
    pipValuePerLot: pair.pipValuePerStandardLot,
  };
}

// — Helpers d'affichage (partagés UI ↔ logique, pas de formatage hardcodé) —

export function fmtLots(lots: number): string {
  return lots.toFixed(2);
}

export function fmtPercent(pct: number): string {
  const v = Math.round(pct * 100) / 100;
  return `${v}%`;
}

export function fmtMoney(value: number, currency = "USD"): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  const rounded = Math.round(value * 100) / 100;
  const body = rounded.toLocaleString(localeTag(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${body}` : `${body} ${currency}`;
}

export function fmtUnits(units: number): string {
  return Math.round(units).toLocaleString(localeTag());
}

export function fmtPips(pips: number): string {
  return (Math.round(pips * 10) / 10).toString();
}
