import { useEffect, useMemo, useRef, useState } from "react";
import PositionSizeAlerts from "../components/PositionSizeAlerts";
import PositionSizeHistory from "../components/PositionSizeHistory";
import SendToTrackerModal, {
  type TrackerDraft,
} from "../components/SendToTrackerModal";
import Toast, { type ToastState } from "../components/Toast";
import type { View } from "../components/Sidebar";
import { fmtRR, theoreticalRR } from "../lib/liveTracker";
import { DEFAULT_PAIRS, findPair, resolvePairs } from "../lib/pairs";
import {
  deleteSizingCalc,
  fetchSizingHistory,
  fetchSizingSettings,
  fetchTrackerSettings,
  logSizingCalc,
  markSizingUsed,
  openLivePosition,
  saveSizingSettings,
  saveTrackerSettings,
  SIZING_DEFAULTS,
  type SizingSettings,
} from "../lib/repo";
import {
  fmtLots,
  fmtMoney,
  fmtPips,
  fmtUnits,
  type SizingInput,
} from "../lib/sizing";
import { usePositionSizeCalculation } from "../lib/useSizing";
import type { PositionSizeCalc } from "../lib/types";
import { IconCheck, IconSend } from "../components/icons";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";

import { t } from "../lib/i18n";
/** Aide contextuelle des onglets de la vue (info-bulle au survol). */
const tabHints = (): Record<"calc" | "settings", string> => ({
  calc: t("Taille de position, risque en devise et R:R à partir de l’entrée et du stop."),
  settings: t("Capital, risque par défaut, limites prop firm et paires personnalisées."),
});

const inputCls =
  "w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text placeholder:font-body placeholder:text-text-dim focus:border-blue focus:outline-none";
const labelCls = "mb-1.5 text-xs font-medium text-text-dim";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      {children}
    </div>
  );
}

export default function SizingView({
  navigate,
}: {
  navigate?: (v: View) => void;
}) {
  const [tab, setTab] = useState<"calc" | "settings">("calc");
  const [settings, setSettings] = useState<SizingSettings>(SIZING_DEFAULTS);
  const [history, setHistory] = useState<PositionSizeCalc[]>([]);

  // Inputs du calculateur (strings pour l'édition libre, parsés à la volée)
  const [symbol, setSymbol] = useState("EUR/USD");
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [capital, setCapital] = useState("");
  const [risk, setRisk] = useState("");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [spread, setSpread] = useState("");
  const [includeSpread, setIncludeSpread] = useState(true);
  const logTimer = useRef<number | undefined>(undefined);

  // Workflow "Trader" → tracker live
  const [sendDraft, setSendDraft] = useState<TrackerDraft | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const loadHistory = () => fetchSizingHistory(50).then(setHistory);

  useEffect(() => {
    fetchSizingSettings().then((s) => {
      setSettings(s);
      setCapital(String(s.capital));
      setRisk(String(s.risk));
    });
    loadHistory();
  }, []);

  const pairs = useMemo(
    () => resolvePairs(settings.pipOverrides, settings.customPairs),
    [settings.pipOverrides, settings.customPairs],
  );
  const pair = findPair(pairs, symbol);
  const parse = (s: string) => parseFloat(s.replace(",", "."));

  const input: SizingInput = {
    capital: parse(capital),
    riskPercent: parse(risk),
    pair,
    entryPrice: parse(entry),
    stopLossPrice: parse(stop),
    spreadPips: parse(spread),
    includeSpread,
    direction,
  };

  const result = usePositionSizeCalculation(input, {
    maxRiskPercent: settings.maxRisk,
    maxLots: settings.maxLots,
    minLot: 0.01,
  });

  // TP optionnel → R:R théorique live (null si absent ou incohérent)
  const tpNum = useMemo(() => {
    const n = parse(takeProfit);
    return Number.isFinite(n) && n > 0 ? n : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takeProfit]);
  const rr =
    result.ok && tpNum != null
      ? theoreticalRR(parse(entry), parse(stop), tpNum, direction)
      : null;

  // Log auto débouncé des calculs valides
  useEffect(() => {
    if (!result.ok) return;
    window.clearTimeout(logTimer.current);
    logTimer.current = window.setTimeout(async () => {
      await logSizingCalc({
        capital: parse(capital),
        risk_percent: parse(risk),
        pair: symbol,
        entry_price: parse(entry),
        stop_loss_price: parse(stop),
        take_profit_price: tpNum,
        spread_pips: includeSpread ? parse(spread) || 0 : null,
        include_spread: includeSpread,
        direction,
        sl_distance_pips: result.slDistancePips,
        position_size_lots: result.lots,
        risk_amount_usd: result.actualRiskUSD,
        pip_value_per_lot: result.pipValuePerLot,
        notes: null,
      });
      loadHistory();
    }, 1500);
    return () => window.clearTimeout(logTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    result.ok,
    result.lots,
    symbol,
    entry,
    stop,
    takeProfit,
    risk,
    capital,
    spread,
    includeSpread,
    direction,
  ]);

  const reuse = (c: PositionSizeCalc) => {
    setTab("calc");
    setSymbol(c.pair);
    setDirection(c.direction);
    setCapital(String(c.capital));
    setRisk(String(c.risk_percent));
    setEntry(String(c.entry_price));
    setStop(String(c.stop_loss_price));
    setTakeProfit(
      c.take_profit_price != null ? String(c.take_profit_price) : "",
    );
    setSpread(c.spread_pips != null ? String(c.spread_pips) : "");
    setIncludeSpread(c.include_spread === 1);
  };

  const toggleUsed = async (c: PositionSizeCalc) => {
    await markSizingUsed(c.id, c.used_for_trade !== 1);
    await loadHistory();
  };

  const removeCalc = async (id: number) => {
    await deleteSizingCalc(id);
    await loadHistory();
  };

  // — Workflow "Trader" : envoi automatique de la position vers le tracker —
  // Fast-track actif → envoi immédiat en arrière-plan (toast discret) ;
  // sinon mini-popup de confirmation (TP encore éditable).

  const doSend = async (draft: TrackerDraft, rememberFastTrack = false) => {
    const tracker = await fetchTrackerSettings();
    await openLivePosition({ ...draft, notes: null });
    if (rememberFastTrack && !tracker.fastTrack)
      await saveTrackerSettings({ ...tracker, fastTrack: true });
    if (draft.sizing_calc_id != null) {
      await markSizingUsed(draft.sizing_calc_id, true);
      await loadHistory();
    }
    setSendDraft(null);
    if (tracker.autoOpen && navigate) {
      navigate("trading");
      return;
    }
    setToast({
      msg: t("{pair} {direction} envoyée au tracker", { pair: draft.pair, direction: draft.direction }),
      actionLabel: navigate ? t("Voir le tracker") : undefined,
      onAction: navigate ? () => navigate("trading") : undefined,
    });
  };

  const sendToTracker = async (draft: TrackerDraft) => {
    const tracker = await fetchTrackerSettings();
    if (tracker.fastTrack) await doSend(draft);
    else setSendDraft(draft);
  };

  const tradeFromCalc = () => {
    if (!result.ok) return;
    sendToTracker({
      pair: symbol,
      direction,
      entry_price: parse(entry),
      stop_loss_price: parse(stop),
      take_profit_price: tpNum,
      lots: result.lots,
      risk_percent: parse(risk),
      risk_amount: result.actualRiskUSD,
      sizing_calc_id: null,
    });
  };

  const tradeFromHistory = (c: PositionSizeCalc) => {
    sendToTracker({
      pair: c.pair,
      direction: c.direction,
      entry_price: c.entry_price,
      stop_loss_price: c.stop_loss_price,
      take_profit_price: c.take_profit_price,
      lots: c.position_size_lots,
      risk_percent: c.risk_percent,
      risk_amount: c.risk_amount_usd,
      sizing_calc_id: c.id,
    });
  };

  const usd = settings.currency;
  const risky = result.ok && (result.highRisk || result.exceedsMaxLots);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="view-head">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl text-text">{t("Position")}</h1>
          <div className="flex gap-1">
            {(
              [
                ["calc", "Calculateur"],
                ["settings", t("Réglages")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                data-tip={label}
                data-tip-sub={tabHints()[id]}
                className={`pill border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                  tab === id
                    ? "border-blue/50 bg-blue/15 text-blue"
                    : "border-border text-text-dim hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {tab === "calc" ? (
        <>
          <ResizableGrid gridId="sizing" className="mt-6">
            {/* — Inputs — */}
            <ResizablePanel id="sizing-params" defaultW={6}>
            <section className="card p-6">
              <h2 className="hud-label">{t("paramètres du trade")}</h2>
              <div className="mt-4 flex flex-col gap-4">
                <div className="auto-tiles gap-3">
                  <Field label={`Capital (${usd})`}>
                    <input
                      value={capital}
                      onChange={(e) => setCapital(e.target.value)}
                      inputMode="decimal"
                      placeholder="5000"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Risque (%)">
                    <input
                      value={risk}
                      onChange={(e) => setRisk(e.target.value)}
                      inputMode="decimal"
                      placeholder="1"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div className="auto-tiles gap-3">
                  <Field label="Paire">
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      className={inputCls}
                    >
                      {pairs.map((p) => (
                        <option key={p.symbol} value={p.symbol}>
                          {p.symbol}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sens">
                    <div className="flex gap-1.5">
                      {(["long", "short"] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDirection(d)}
                          data-tip={d === "long" ? "Position longue (achat)" : "Position courte (vente)"}
                          data-tip-sub={t("Détermine de quel côté du prix d’entrée se place le stop.")}
                          className={`pill flex-1 border px-3 py-2 text-xs font-semibold uppercase transition-colors ${
                            direction === d
                              ? d === "long"
                                ? "border-green/50 bg-green/15 text-green"
                                : "border-red/50 bg-red/15 text-red"
                              : "border-border text-text-dim hover:text-text"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                <div className="auto-tiles gap-3">
                  <Field label={t("Prix d'entrée")}>
                    <input
                      value={entry}
                      onChange={(e) => setEntry(e.target.value)}
                      inputMode="decimal"
                      placeholder="1.0850"
                      className={inputCls}
                    />
                  </Field>
                  <Field label={t("Prix du stop-loss")}>
                    <input
                      value={stop}
                      onChange={(e) => setStop(e.target.value)}
                      inputMode="decimal"
                      placeholder="1.0820"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div className="auto-tiles gap-3">
                  <Field label="Take Profit (optionnel)">
                    <input
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      inputMode="decimal"
                      placeholder="1.0910"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Spread (pips, optionnel)">
                    <input
                      value={spread}
                      onChange={(e) => setSpread(e.target.value)}
                      inputMode="decimal"
                      placeholder="1.2"
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setIncludeSpread((v) => !v)}
                    className={`pill border px-3 py-2 text-xs font-medium transition-colors ${
                      includeSpread
                        ? "border-blue/40 bg-blue/10 text-blue"
                        : "border-border text-text-dim hover:text-text"
                    }`}
                    data-tip={t("Ajoute le spread à la distance du stop pour un risque conservateur")}
                  >
                    {includeSpread ? "Spread inclus" : t("Spread ignoré")}
                  </button>
                </div>
              </div>
            </section>

            </ResizablePanel>

            {/* — Résultats — */}
            <ResizablePanel id="sizing-result" defaultW={6}>
            <section
              className={`card p-6 transition-colors ${
                risky ? "border-red/40" : ""
              }`}
            >
              <h2 className="hud-label">{t("taille recommandée")}</h2>

              <div className="mt-3 flex items-baseline gap-3">
                <span
                  className={`font-display text-5xl font-extrabold leading-none ${
                    result.ok
                      ? risky
                        ? "text-red"
                        : "text-text"
                      : "text-text-dim"
                  }`}
                >
                  {result.ok ? fmtLots(result.lots) : "—"}
                </span>
                <span className="text-lg text-text-dim">lots</span>
              </div>

              {result.ok ? (
                <>
                  <p className="mt-2 font-mono text-xs text-text-dim">
                    = {result.miniLots.toFixed(1)} mini lots ·{" "}
                    {Math.round(result.microLots)} micro lots ·{" "}
                    {fmtUnits(result.units)} unités
                  </p>

                  <div className="auto-tiles mt-4 gap-3">
                    <div className="pill bg-surface-2 px-3 py-2.5">
                      <p className="hud-label">{t("risqué réel")}</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-text">
                        {fmtMoney(result.actualRiskUSD, usd)}
                      </p>
                      <p className="font-mono text-[10px] text-text-dim">
                        cible {fmtMoney(result.riskUSD, usd)}
                      </p>
                    </div>
                    <div className="pill bg-surface-2 px-3 py-2.5">
                      <p className="hud-label">distance SL</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-text">
                        {fmtPips(result.effectiveDistancePips)} pips
                      </p>
                      {result.spreadApplied > 0 && (
                        <p className="font-mono text-[10px] text-text-dim">
                          {fmtPips(result.slDistancePips)} + spread{" "}
                          {fmtPips(result.spreadApplied)}
                        </p>
                      )}
                    </div>
                    {tpNum != null && (
                      <>
                        <div className="pill bg-surface-2 px-3 py-2.5">
                          <p className="hud-label">{t("r:r théorique")}</p>
                          <p
                            className={`mt-0.5 font-mono text-sm font-semibold ${
                              rr != null ? "text-blue" : "text-yellow"
                            }`}
                          >
                            {rr != null ? fmtRR(rr) : t("TP incohérent")}
                          </p>
                        </div>
                        {rr != null && (
                          <div className="pill bg-surface-2 px-3 py-2.5">
                            <p className="hud-label">gain potentiel</p>
                            <p className="mt-0.5 font-mono text-sm font-semibold text-green">
                              +{fmtMoney(result.actualRiskUSD * rr, usd)}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-text-dim">
                  {t("Renseigne les champs pour obtenir la taille de position.")}
                </p>
              )}

              <div className="mt-4">
                <PositionSizeAlerts result={result} />
              </div>

              <button
                type="button"
                onClick={tradeFromCalc}
                disabled={!result.ok}
                data-tip={t("Trader cette position")}
                data-tip-sub={t("Envoie la position au tracker live : l’heure d’entrée exacte est capturée, il ne restera qu’à la clôturer en gagnante ou perdante.")}
                className="pill mt-4 inline-flex w-full items-center justify-center gap-2 bg-blue px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <IconSend className="h-4 w-4" /> {t("Trader cette position")}
              </button>
            </section>
            </ResizablePanel>

          {/* — Historique — */}
          <ResizablePanel id="sizing-history" defaultW={12}>
          <section className="card p-5">
            <h2 className="hud-label">{t("historique des calculs")}</h2>
            <div className="mt-3">
              <PositionSizeHistory
                calcs={history}
                onToggleUsed={toggleUsed}
                onDelete={removeCalc}
                onReuse={reuse}
                onTrade={tradeFromHistory}
              />
            </div>
          </section>
          </ResizablePanel>
          </ResizableGrid>
        </>
      ) : (
        <SettingsPanel
          settings={settings}
          onSaved={(s) => setSettings(s)}
        />
      )}

      {sendDraft && (
        <SendToTrackerModal
          draft={sendDraft}
          currency={usd}
          onClose={() => setSendDraft(null)}
          onSend={doSend}
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

// — Réglages avancés (capital/risque par défaut, seuils, paires custom) —

function SettingsPanel({
  settings,
  onSaved,
}: {
  settings: SizingSettings;
  onSaved: (s: SizingSettings) => void;
}) {
  const [draft, setDraft] = useState<SizingSettings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  const set = <K extends keyof SizingSettings>(
    key: K,
    value: SizingSettings[K],
  ) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    await saveSizingSettings(draft);
    onSaved(draft);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const setPipOverride = (symbolKey: string, raw: string) => {
    const next = { ...draft.pipOverrides };
    const n = parseFloat(raw.replace(",", "."));
    if (raw.trim() === "" || !Number.isFinite(n)) delete next[symbolKey];
    else next[symbolKey] = n;
    set("pipOverrides", next);
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <section className="card p-5">
        <h2 className="hud-label">{t("valeurs par défaut")}</h2>
        <div className="auto-tiles mt-4 gap-3">
          <Field label={t("Capital par défaut")}>
            <input
              value={String(draft.capital)}
              onChange={(e) =>
                set("capital", parseFloat(e.target.value.replace(",", ".")) || 0)
              }
              inputMode="decimal"
              className={inputCls}
            />
          </Field>
          <Field label={t("Risque par défaut (%)")}>
            <input
              value={String(draft.risk)}
              onChange={(e) =>
                set("risk", parseFloat(e.target.value.replace(",", ".")) || 0)
              }
              inputMode="decimal"
              className={inputCls}
            />
          </Field>
          <Field label={t("Devise du compte")}>
            <input
              value={draft.currency}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
              className={`${inputCls} uppercase`}
            />
          </Field>
          <Field label="Seuil d'alerte risque (%)">
            <input
              value={String(draft.maxRisk)}
              onChange={(e) =>
                set("maxRisk", parseFloat(e.target.value.replace(",", ".")) || 0)
              }
              inputMode="decimal"
              className={inputCls}
            />
          </Field>
          <Field label={t("Limite de lots (prop firm, optionnel)")}>
            <input
              value={draft.maxLots == null ? "" : String(draft.maxLots)}
              onChange={(e) => {
                const raw = e.target.value.replace(",", ".");
                const n = parseFloat(raw);
                set("maxLots", raw.trim() === "" || !Number.isFinite(n) ? null : n);
              }}
              inputMode="decimal"
              placeholder="aucune"
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="hud-label">{t("valeur du pip par paire")}</h2>
        <p className="mt-2 text-xs text-text-dim">
          Ajuste la valeur d'un pip par lot standard pour coller à la convention
          exacte de ton broker / prop firm (ex. XAU/USD : 1 $ ou 10 $ selon la
          définition du pip). Laisse vide pour garder la valeur par défaut.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {DEFAULT_PAIRS.map((p) => (
            <div key={p.symbol} className="flex items-center gap-3">
              <span className="w-24 shrink-0 font-mono text-sm font-semibold text-text">
                {p.symbol}
              </span>
              <span className="w-32 shrink-0 font-mono text-[11px] text-text-dim">
                défaut {p.pipValuePerStandardLot} {draft.currency}/lot
              </span>
              <input
                value={
                  draft.pipOverrides[p.symbol] != null
                    ? String(draft.pipOverrides[p.symbol])
                    : ""
                }
                onChange={(e) => setPipOverride(p.symbol, e.target.value)}
                inputMode="decimal"
                placeholder={`override (${p.pipValuePerStandardLot})`}
                className={`${inputCls} max-w-[200px]`}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          data-tip={t("Enregistrer les réglages")}
          data-tip-sub={t("Capital, risque par défaut, seuils d’alerte et paires personnalisées.")}
          className="pill bg-blue px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {t("Enregistrer les réglages")}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-green"><IconCheck className="h-3 w-3" /> {t("réglages enregistrés")}</span>
        )}
      </div>
    </div>
  );
}
