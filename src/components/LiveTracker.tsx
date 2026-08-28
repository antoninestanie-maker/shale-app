// Tracker live trading : les positions envoyées depuis le calculateur
// ("Trader") attendent ici leur dénouement. Une seule action finale :
// Gagnante / Perdante (BE optionnel). Le "+" enregistre une sortie partielle
// avant le dénouement ; le résultat final en R est pondéré en conséquence.
// À la clôture, la position est archivée dans le journal (trades) et toutes
// les statistiques (winrate, profit factor, drawdown…) se mettent à jour.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildJournalNotes,
  closedPct,
  elapsedMin,
  finalResultR,
  fmtElapsed,
  fmtPx,
  fmtRR,
  fmtSignedR,
  parsePartials,
  rAtPrice,
} from "../lib/liveTracker";
import { todayStr } from "../lib/logic";
import {
  closeLivePosition,
  deleteLivePosition,
  fetchLivePositions,
  fetchTrackerSettings,
  localNow,
  setLivePartials,
  setLiveTakeProfit,
} from "../lib/repo";
import { logTrade } from "../lib/trades";
import type {
  AppData,
  LiveOutcome,
  LivePartial,
  LivePosition,
} from "../lib/types";
import { IconPlus, IconX } from "./icons";
import type { ToastState } from "./Toast";

import { t } from "../lib/i18n";
interface Props {
  data: AppData;
  refresh: () => Promise<void>;
  /** Toast affiché par la vue parente (confirmation d'archivage). */
  onToast: (t: ToastState) => void;
}

/** Formulaire replié sous une position : partielle, TP, ou prix de sortie (win sans TP). */
type Expanded =
  | { id: number; kind: "partial" }
  | { id: number; kind: "tp" }
  | { id: number; kind: "win" };

const fieldCls =
  "w-28 rounded-[10px] border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-text placeholder:font-body placeholder:text-text-dim focus:border-blue focus:outline-none";

export default function LiveTracker({ data, refresh, onToast }: Props) {
  const [positions, setPositions] = useState<LivePosition[]>([]);
  const [expanded, setExpanded] = useState<Expanded | null>(null);
  const [allowBe, setAllowBe] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [, setTick] = useState(0); // re-rendu périodique des durées "il y a…"

  const load = useCallback(() => {
    fetchLivePositions().then(setPositions);
  }, []);

  useEffect(() => {
    load();
    const loadConfig = () =>
      fetchTrackerSettings().then((s) => setAllowBe(s.allowBe));
    loadConfig();
    window.addEventListener("sb:live-positions", load);
    window.addEventListener("sb:tracker-config", loadConfig);
    return () => {
      window.removeEventListener("sb:live-positions", load);
      window.removeEventListener("sb:tracker-config", loadConfig);
    };
  }, [load]);

  useEffect(() => {
    if (positions.length === 0) return;
    const t = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, [positions.length]);

  // Risque total engagé (somme des % risqués des positions ouvertes)
  const engagedPct = useMemo(
    () =>
      Math.round(
        positions.reduce((s, p) => s + (p.risk_percent ?? 0), 0) * 100,
      ) / 100,
    [positions],
  );

  /** Archive la position : ligne de journal + statut + stats à jour. */
  const archive = async (
    pos: LivePosition,
    outcome: LiveOutcome,
    resultR: number,
  ) => {
    const partials = parsePartials(pos.partials);
    const tradeId = await logTrade(
      {
        date: todayStr(),
        instrument: pos.pair,
        direction: pos.direction,
        setup: null,
        result_r: resultR,
        screenshot_path: null,
        notes: buildJournalNotes(pos, partials, outcome),
        mode: "live",
      },
      data,
    );
    await closeLivePosition(pos.id, outcome, resultR, tradeId);
    setExpanded(null);
    await refresh();
    onToast({
      msg: t("{pair} archivée : {r}", { pair: pos.pair, r: fmtSignedR(resultR) }),
      tone: resultR > 0 ? "win" : resultR < 0 ? "loss" : "default",
    });
  };

  /** Dénouement en un clic. Gagnante sans TP → demande le prix de sortie. */
  const close = async (pos: LivePosition, outcome: LiveOutcome) => {
    const r = finalResultR(pos, parsePartials(pos.partials), outcome);
    if (r == null) {
      setExpanded({ id: pos.id, kind: "win" });
      return;
    }
    await archive(pos, outcome, r);
  };

  const remove = async (id: number) => {
    if (deletingId !== id) {
      setDeletingId(id);
      window.setTimeout(() => setDeletingId(null), 3000);
      return;
    }
    setDeletingId(null);
    await deleteLivePosition(id);
  };

  return (
    <section className="card flex flex-col p-5">
      <div className="rgrid-head flex items-center justify-between gap-3">
        <h2 className="hud-label min-w-0 truncate">
          {t("tracker live — en attente de dénouement")}
        </h2>
        {positions.length > 0 && (
          <p className="shrink-0 font-mono text-[11px] text-text-dim">
            {positions.length} position{positions.length > 1 ? "s" : ""}
            {engagedPct > 0 && (
              <>
                {" "}
                · <span className="text-yellow">{engagedPct}% engagés</span>
              </>
            )}
          </p>
        )}
      </div>

      {positions.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-dim">
          Aucune position en attente. Depuis{" "}
          <span className="font-semibold text-text">{t("Position")}</span>, clique sur{" "}
          <span className="font-semibold text-blue">Trader</span> : la position
          arrive ici avec son heure d'entrée, son R:R et sa taille.
        </p>
      ) : (
        <ul className="panel-scroll mt-3 flex flex-col gap-2">
          {positions.map((pos) => {
            const partials = parsePartials(pos.partials);
            const done = closedPct(partials);
            const isExp = expanded?.id === pos.id ? expanded : null;
            return (
              <li
                key={pos.id}
                className="rounded-[12px] border border-border bg-surface-2/60 px-3.5 py-3"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {/* Heure d'entrée capturée + durée */}
                  <div className="w-20 shrink-0">
                    <p className="font-mono text-sm font-semibold text-text">
                      {pos.opened_at.slice(11, 16)}
                    </p>
                    <p className="font-mono text-[10px] text-text-dim">
                      {fmtElapsed(elapsedMin(pos.opened_at))}
                    </p>
                  </div>

                  {/* Instrument + sens */}
                  <div className="flex w-28 shrink-0 flex-col gap-1">
                    <span className="font-mono text-sm font-bold text-text">
                      {pos.pair}
                    </span>
                    <span
                      className={`pill w-fit border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        pos.direction === "long"
                          ? "border-green/40 text-green"
                          : "border-red/40 text-red"
                      }`}
                    >
                      {pos.direction}
                    </span>
                  </div>

                  {/* Niveaux — se replient sur deux lignes plutôt que de
                      pousser la rangée hors du cadre sur un widget étroit. */}
                  <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1.5 font-mono text-xs">
                    <div>
                      <p className="hud-label">{t("entrée")}</p>
                      <p className="mt-0.5 text-text">{fmtPx(pos.entry_price)}</p>
                    </div>
                    <div>
                      <p className="hud-label">sl</p>
                      <p className="mt-0.5 text-red">
                        {fmtPx(pos.stop_loss_price)}
                      </p>
                    </div>
                    <div>
                      <p className="hud-label">tp</p>
                      {pos.take_profit_price != null ? (
                        <p className="mt-0.5 text-green">
                          {fmtPx(pos.take_profit_price)}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded(
                              isExp?.kind === "tp"
                                ? null
                                : { id: pos.id, kind: "tp" },
                            )
                          }
                          className="mt-0.5 text-text-dim underline decoration-dotted hover:text-blue"
                        >
                          {t("définir")}
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="hud-label">taille</p>
                      <p className="mt-0.5 text-text">
                        {pos.lots != null ? `${pos.lots} lot` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* R:R théorique (calculé automatiquement à la réception) */}
                  <span className="pill shrink-0 border border-blue/40 bg-blue/10 px-2.5 py-1 font-mono text-xs font-semibold text-blue">
                    R:R {fmtRR(pos.rr_theoretical)}
                  </span>

                  {/* Partielles déjà prises + ajout */}
                  <div className="flex min-w-0 flex-1 basis-32 flex-wrap items-center gap-1.5">
                    {partials.map((p, i) => (
                      <span
                        key={i}
                        title={t("fermé à {px}", { px: fmtPx(p.price) })}
                        className="pill border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-text-dim"
                      >
                        {p.pct}% @ {fmtSignedR(p.r)}
                      </span>
                    ))}
                    {done < 100 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded(
                            isExp?.kind === "partial"
                              ? null
                              : { id: pos.id, kind: "partial" },
                          )
                        }
                        data-tip="Sortie partielle"
                        data-tip-sub={t("Sécuriser une part de la position (ex. 50 %) à un prix donné — le R final en tient compte.")}
                        className={`pill inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                          isExp?.kind === "partial"
                            ? "border-blue/50 bg-blue/15 text-blue"
                            : "border-border text-text-dim hover:border-blue/40 hover:text-blue"
                        }`}
                      >
                        <IconPlus className="h-3 w-3" /> partielle
                      </button>
                    )}
                  </div>

                  {/* Dénouement : une seule action finale */}
                  <div className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => close(pos, "win")}
                      data-tip="Position gagnante"
                      data-tip-sub={t("Clôt au TP (ou au prix de sortie demandé), logue le trade et archive la position.")}
                      className="pill bg-green px-3.5 py-1.5 text-xs font-bold uppercase text-on-green transition-opacity hover:opacity-90"
                    >
                      Gagnante
                    </button>
                    <button
                      type="button"
                      onClick={() => close(pos, "loss")}
                      data-tip="Position perdante"
                      data-tip-sub={t("Clôt au stop : −1R sur la part restante, trade enregistré au journal.")}
                      className="pill bg-red px-3.5 py-1.5 text-xs font-bold uppercase text-white transition-opacity hover:opacity-90"
                    >
                      Perdante
                    </button>
                    {allowBe && (
                      <button
                        type="button"
                        onClick={() => close(pos, "be")}
                        data-tip="Break-even"
                        data-tip-sub={t("Sortie à l’entrée : 0R sur la part restante (les partielles restent comptées).")}
                        className="pill border border-border px-2.5 py-1.5 text-[11px] font-semibold uppercase text-text-dim transition-colors hover:text-text"
                      >
                        BE
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(pos.id)}
                      data-tip={
                        deletingId === pos.id ? t("Confirmer le retrait") : t("Retirer du tracker")
                      }
                      data-tip-sub={t("Pour une position envoyée par erreur : rien n’est écrit dans le journal.")}
                      className={`rounded-md p-1.5 transition-colors ${
                        deletingId === pos.id
                          ? "bg-red/20 text-red"
                          : "text-text-dim hover:text-red"
                      }`}
                      aria-label="Retirer"
                    >
                      {deletingId === pos.id ? (
                        <span className="px-0.5 text-[11px] font-semibold">
                          {t("sûr ?")}
                        </span>
                      ) : (
                        <IconX className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {isExp && (
                  <InlineForm
                    pos={pos}
                    kind={isExp.kind}
                    alreadyClosedPct={done}
                    onCancel={() => setExpanded(null)}
                    onPartial={async (partial) => {
                      await setLivePartials(pos.id, [...partials, partial]);
                      setExpanded(null);
                    }}
                    onTp={async (tp) => {
                      await setLiveTakeProfit(pos.id, tp);
                      setExpanded(null);
                    }}
                    onWin={async (remainderR) => {
                      const r = finalResultR(pos, partials, "win", remainderR);
                      if (r != null) await archive(pos, "win", r);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Mini-formulaire replié : partielle / définir TP / prix de sortie gagnante. */
function InlineForm({
  pos,
  kind,
  alreadyClosedPct,
  onCancel,
  onPartial,
  onTp,
  onWin,
}: {
  pos: LivePosition;
  kind: "partial" | "tp" | "win";
  alreadyClosedPct: number;
  onCancel: () => void;
  onPartial: (p: LivePartial) => Promise<void>;
  onTp: (tp: number | null) => Promise<void>;
  onWin: (remainderR: number) => Promise<void>;
}) {
  const maxPct = Math.max(0, 100 - alreadyClosedPct);
  const [pct, setPct] = useState(String(Math.min(50, maxPct)));
  const [price, setPrice] = useState("");
  const parse = (s: string) => parseFloat(s.replace(",", "."));

  const priceNum = parse(price);
  const r =
    Number.isFinite(priceNum) && priceNum > 0
      ? rAtPrice(pos.entry_price, pos.stop_loss_price, pos.direction, priceNum)
      : null;
  const pctNum = parse(pct);
  const pctOk = Number.isFinite(pctNum) && pctNum > 0 && pctNum <= maxPct;

  const submit = async () => {
    if (kind === "partial") {
      if (!pctOk || r == null) return;
      await onPartial({
        at: localNow(),
        pct: Math.round(pctNum * 100) / 100,
        price: priceNum,
        r,
      });
    } else if (kind === "tp") {
      if (!Number.isFinite(priceNum) || priceNum <= 0) return;
      await onTp(priceNum);
    } else {
      if (r == null) return;
      await onWin(r);
    }
  };

  const canSubmit =
    kind === "partial" ? pctOk && r != null : kind === "tp" ? priceNum > 0 : r != null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2.5 border-t border-border pt-3">
      <p className="text-xs font-medium text-text-dim">
        {kind === "partial"
          ? "Fermeture partielle :"
          : kind === "tp"
            ? "Take Profit :"
            : t("Prix de sortie (pas de TP défini) :")}
      </p>
      {kind === "partial" && (
        <label className="flex items-center gap-1.5 font-mono text-xs text-text-dim">
          <input
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            inputMode="decimal"
            className={`${fieldCls} w-16`}
          />
          % <span className="text-[10px]">(reste {maxPct}%)</span>
        </label>
      )}
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        inputMode="decimal"
        placeholder={kind === "tp" ? "niveau TP" : t("prix de sortie")}
        autoFocus
        className={fieldCls}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          // Marque la touche : sinon elle remonte et ferme aussi le panneau.
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      {kind !== "tp" && r != null && (
        <span
          className={`pill border px-2 py-0.5 font-mono text-[11px] font-semibold ${
            r > 0
              ? "border-green/40 text-green"
              : r < 0
                ? "border-red/40 text-red"
                : "border-border text-text-dim"
          }`}
        >
          = {fmtSignedR(r)}
        </span>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="pill bg-blue px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {kind === "partial"
          ? t("Ajouter")
          : kind === "tp"
            ? t("Enregistrer")
            : t("Clôturer gagnante")}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="pill px-2.5 py-1.5 text-xs text-text-dim hover:text-text"
      >
        {t("Annuler")}
      </button>
    </div>
  );
}
