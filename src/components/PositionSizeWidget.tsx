import { useEffect, useMemo, useRef, useState } from "react";
import { findPair, resolvePairs } from "../lib/pairs";
import {
  fetchSizingSettings,
  logSizingCalc,
  SIZING_DEFAULTS,
  type SizingSettings,
} from "../lib/repo";
import { fmtLots, fmtMoney } from "../lib/sizing";
import { usePositionSizeCalculation } from "../lib/useSizing";

import { t } from "../lib/i18n";
const inputCls =
  "w-full rounded-[10px] border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-sm text-text placeholder:font-body placeholder:text-text-dim focus:border-blue focus:outline-none";

/**
 * Widget Dashboard : calcul de sizing ultra-rapide (paire, risque, entrée, SL).
 * Le capital et les seuils viennent des réglages — rien de hardcodé.
 */
export default function PositionSizeWidget() {
  const [settings, setSettings] = useState<SizingSettings>(SIZING_DEFAULTS);
  const [symbol, setSymbol] = useState("EUR/USD");
  const [risk, setRisk] = useState("1");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const logTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    fetchSizingSettings().then((s) => {
      setSettings(s);
      setRisk(String(s.risk));
    });
  }, []);

  const pairs = useMemo(
    () => resolvePairs(settings.pipOverrides, settings.customPairs),
    [settings.pipOverrides, settings.customPairs],
  );
  const pair = findPair(pairs, symbol);

  const parse = (s: string) => parseFloat(s.replace(",", "."));

  const result = usePositionSizeCalculation(
    {
      capital: settings.capital,
      riskPercent: parse(risk),
      pair,
      entryPrice: parse(entry),
      stopLossPrice: parse(stop),
      spreadPips: 0,
      includeSpread: false,
      direction: "long",
    },
    {
      maxRiskPercent: settings.maxRisk,
      maxLots: settings.maxLots,
      minLot: 0.01,
    },
  );

  // Log auto débouncé (les calculs valides sont historisés sans action manuelle).
  useEffect(() => {
    if (!result.ok) return;
    window.clearTimeout(logTimer.current);
    logTimer.current = window.setTimeout(() => {
      logSizingCalc({
        capital: settings.capital,
        risk_percent: parse(risk),
        pair: symbol,
        entry_price: parse(entry),
        stop_loss_price: parse(stop),
        take_profit_price: null,
        spread_pips: null,
        include_spread: false,
        direction: "long",
        sl_distance_pips: result.slDistancePips,
        position_size_lots: result.lots,
        risk_amount_usd: result.actualRiskUSD,
        pip_value_per_lot: result.pipValuePerLot,
        notes: "widget",
      });
    }, 1500);
    return () => window.clearTimeout(logTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.ok, result.lots, symbol, entry, stop, risk]);

  return (
    <section className="card p-5">
      <h2 className="hud-label">{t("taille de position")}</h2>

      <div className="auto-tiles mt-3 gap-2">
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          // pas de [color-scheme:dark] figé : le `color-scheme` de :root suit
          // déjà le thème (le menu natif serait blanc sur blanc en clair).
          className={inputCls}
          aria-label={t("Paire")}
        >
          {pairs.map((p) => (
            <option key={p.symbol} value={p.symbol}>
              {p.symbol}
            </option>
          ))}
        </select>
        <div className="relative">
          <input
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            inputMode="decimal"
            placeholder={t("risque")}
            aria-label={t("Risque %")}
            className={`${inputCls} pr-6`}
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-text-dim">
            %
          </span>
        </div>
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          inputMode="decimal"
          placeholder={t("entrée")}
          aria-label={t("Prix d'entrée")}
          className={inputCls}
        />
        <input
          value={stop}
          onChange={(e) => setStop(e.target.value)}
          inputMode="decimal"
          placeholder="stop-loss"
          aria-label={t("Prix du stop-loss")}
          className={inputCls}
        />
      </div>

      {/* Ressort : quand le widget est agrandi, le résultat se cale en bas de
          carte au lieu de laisser un vide — la structure suit vraiment. */}
      <div className="panel-grow" aria-hidden />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="hud-label">lots</p>
          {result.ok ? (
            <p
              className={`font-display text-3xl font-extrabold leading-none ${
                result.highRisk || result.exceedsMaxLots
                  ? "text-red"
                  : "text-text"
              }`}
            >
              {fmtLots(result.lots)}
            </p>
          ) : (
            <p className="font-display text-3xl font-extrabold leading-none text-text-dim">
              —
            </p>
          )}
        </div>
        <div className="min-w-0 text-right">
          {result.ok ? (
            <>
              <p className="font-mono text-xs text-text-dim">
                {t("{montant} risqués", { montant: fmtMoney(result.actualRiskUSD, settings.currency) })}
              </p>
              <p className="font-mono text-[10px] text-text-dim">
                {t("capital {montant}", { montant: fmtMoney(settings.capital, settings.currency) })}
              </p>
            </>
          ) : (
            <p className="max-w-[150px] text-right text-[11px] text-text-dim">
              {entry || stop ? result.error : t("entre entrée + stop")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
