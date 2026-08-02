// Thème du jour : dérive un régime cohérent du macro_context et l'aligne sur les
// instruments (doc §3). Ex. DXY↑ + US10Y↑ ⇒ « Dollar fort » ⇒ biais baissier
// aligné EUR/USD, GBP/USD, Or. Ce bloc est injecté dans le payload avant le LLM.
import type { DailyTheme, MacroContext } from "./types";

import { t } from "../i18n";
export function computeDailyTheme(macro: MacroContext): DailyTheme | null {
  const dxy = macro.dxy.trend;
  const us10y = macro.us10y.trend;
  const vix = macro.vix.trend;
  const es = macro.es_futures.trend;

  // Signal Dollar : DXY + confirmation taux.
  let bias_usd: DailyTheme["bias_usd"] = "neutre";
  if (dxy === "up" && us10y !== "down") bias_usd = "fort";
  else if (dxy === "down" && us10y !== "up") bias_usd = "faible";

  if (bias_usd === "neutre") {
    // Pas de thème Dollar net → régime dicté par le risque (VIX + futures S&P,
    // qui cotent ~24h là où le VIX ne bouge qu'aux heures US).
    if (vix === "up" || es === "down") {
      return {
        label: t("Aversion au risque"),
        bias_usd: "neutre",
        aligned: [
          { instrument: "NAS100", bias: "baissier" },
          { instrument: "BTC/USD", bias: "baissier" },
          { instrument: "XAU/USD", bias: "haussier" },
        ],
        rationale:
          t("Risk-off (VIX en hausse / futures S&P sous pression) : fuite vers les refuges (USD/Or), pression sur NAS100 et BTC."),
      };
    }
    if (vix === "down" && es === "up") {
      return {
        label: t("Appétit pour le risque"),
        bias_usd: "neutre",
        aligned: [
          { instrument: "NAS100", bias: "haussier" },
          { instrument: "BTC/USD", bias: "haussier" },
        ],
        rationale:
          t("Risk-on (futures S&P en hausse, VIX qui se détend) : soutien pour NAS100 et BTC."),
      };
    }
    return null;
  }

  const usdUp = bias_usd === "fort";
  const aligned: DailyTheme["aligned"] = [
    { instrument: "EUR/USD", bias: usdUp ? "baissier" : "haussier" },
    { instrument: "GBP/USD", bias: usdUp ? "baissier" : "haussier" },
    { instrument: "XAU/USD", bias: usdUp ? "baissier" : "haussier" },
  ];
  // La tech réagit surtout aux taux : n'ajouter NAS100 que si les taux confirment.
  if (us10y === "up") aligned.push({ instrument: "NAS100", bias: "baissier" });
  else if (us10y === "down") aligned.push({ instrument: "NAS100", bias: "haussier" });

  return {
    label: usdUp ? "Dollar fort" : "Dollar faible",
    bias_usd,
    aligned,
    rationale: usdUp
      ? t("DXY en hausse (taux US soutenus) : pression baissière alignée sur EUR/USD, GBP/USD et Or.")
      : t("DXY en baisse (taux US mous) : soutien haussier aligné sur EUR/USD, GBP/USD et Or."),
  };
}
