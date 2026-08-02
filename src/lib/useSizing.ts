// Hook ergonomique autour de computeSizing (logique pure de sizing.ts).
// Le calcul est recalculé en temps réel à chaque changement d'input — pas de
// bouton « Calculer », friction minimale avant chaque trade.
import { useMemo } from "react";
import {
  computeSizing,
  type SizingInput,
  type SizingResult,
  type SizingThresholds,
} from "./sizing";

export function usePositionSizeCalculation(
  input: SizingInput,
  thresholds: SizingThresholds,
): SizingResult {
  return useMemo(
    () => computeSizing(input, thresholds),
    [
      input.capital,
      input.riskPercent,
      input.pair,
      input.entryPrice,
      input.stopLossPrice,
      input.spreadPips,
      input.includeSpread,
      input.direction,
      thresholds.maxRiskPercent,
      thresholds.maxLots,
      thresholds.minLot,
    ],
  );
}
