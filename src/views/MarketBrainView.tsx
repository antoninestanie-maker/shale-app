import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  IconBan,
  IconBolt,
  IconDash,
  IconTrendDown,
  IconTrendUp,
} from "../components/icons";
import type { MarketBrainState } from "../lib/market/useMarketBrain";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";
import SessionIndicator from "../components/SessionIndicator";
import { useMarketClock } from "../lib/market/clock";
import { localeTag, t, tp } from "../lib/i18n";
import type {
  BriefingOutput,
  Conviction,
  InstrumentView,
  OutBias,
} from "../lib/market/types";

/** Le BTC (crypto 24/7) échappe au mode week-end. */
const isCrypto = (symbol: string) => symbol.toUpperCase().includes("BTC");

/**
 * Grise/désactive son contenu quand `off` est vrai (marché fermé), avec une
 * transition douce — pas de flash au basculement automatique.
 */
function WeekendDim({ off, children }: { off: boolean; children: ReactNode }) {
  return (
    <div
      aria-disabled={off}
      className={`transition-[opacity,filter] duration-500 ${
        off ? "pointer-events-none opacity-40 grayscale" : ""
      }`}
    >
      {children}
    </div>
  );
}

const OUT_BIAS: Record<
  OutBias,
  { Icon: ComponentType<SVGProps<SVGSVGElement>>; cls: string; chip: string }
> = {
  haussier: { Icon: IconTrendUp, cls: "text-green", chip: "border-green/25 bg-green/10 text-green" },
  baissier: { Icon: IconTrendDown, cls: "text-red", chip: "border-red/25 bg-red/10 text-red" },
  neutre: { Icon: IconDash, cls: "text-text-dim", chip: "border-border bg-surface-2 text-text-dim" },
};

function fmt(n: number | null, digits = 4): string {
  return n == null ? "—" : n.toLocaleString(localeTag(), { maximumFractionDigits: digits });
}

/** Conviction en points : ●○○ / ●●○ / ●●● */
function ConvictionDots({ level, tone }: { level: Conviction; tone: string }) {
  const n = level === "forte" ? 3 : level === "moyenne" ? 2 : 1;
  return (
    <span
      className="flex items-center gap-1"
      data-tip={t("Conviction {level}", { level: t(level) })}
      data-tip-sub={t("Degré de confiance de l’analyse sur ce scénario.")}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i < n ? tone : "bg-overlay-2"}`}
        />
      ))}
    </span>
  );
}

function dotTone(bias: OutBias): string {
  return bias === "haussier" ? "bg-green" : bias === "baissier" ? "bg-red" : "bg-text-dim";
}

/** Rangée "en un coup d'œil" : le biais des 5 instruments, lisible en 2 s. */
function GlanceRow({ output, closed }: { output: BriefingOutput; closed: boolean }) {
  const go = (symbol: string) =>
    document
      .getElementById(`instr-${symbol}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  return (
    <div className="auto-tiles mt-4 gap-2">
      {output.instruments.map((iv) => {
        const b = OUT_BIAS[iv.bias];
        const off = closed && !isCrypto(iv.symbol);
        return (
          <button
            key={iv.symbol}
            type="button"
            onClick={() => go(iv.symbol)}
            disabled={off}
            data-tip={iv.symbol}
            data-tip-sub={
              off
                ? t("Marché fermé le week-end.")
                : t("Biais {bias} · aller à la carte de l’instrument", { bias: t(iv.bias) })
            }
            className={`card flex min-w-0 items-center justify-between gap-2 border px-3.5 py-3 text-left transition-[transform,opacity,filter] duration-500 hover:scale-[1.02] ${b.chip} ${
              off ? "pointer-events-none opacity-40 grayscale" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-text">{iv.symbol}</p>
              <p className={`mt-0.5 flex items-center gap-1 text-xs font-semibold ${b.cls}`}>
                <b.Icon className="h-3.5 w-3.5" /> {t(iv.bias)}
              </p>
            </div>
            <ConvictionDots level={iv.conviction} tone={dotTone(iv.bias)} />
          </button>
        );
      })}
    </div>
  );
}

function BriefingInstrument({ iv }: { iv: InstrumentView }) {
  const b = OUT_BIAS[iv.bias];
  const kl = iv.key_levels;
  return (
    <div id={`instr-${iv.symbol}`} className="card p-5">
      <div className="rgrid-head flex items-center justify-between">
        <h4 className="font-display text-[17px] font-bold text-text">{iv.symbol}</h4>
        <div className="flex items-center gap-3">
          <ConvictionDots level={iv.conviction} tone={dotTone(iv.bias)} />
          <span
            className={`pill inline-flex items-center gap-1 border px-2.5 py-1 text-[11px] font-semibold ${b.chip}`}
          >
            <b.Icon className="h-3 w-3" /> {t(iv.bias)}
          </span>
        </div>
      </div>
      <p className="mt-2.5 text-sm leading-relaxed text-text-dim">{iv.scenario}</p>
      {(kl.watch.length > 0 || kl.invalidation != null) && (
        <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
          {kl.watch.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-text-dim">{t("Niveaux à surveiller")}</span>
              <span className="font-mono text-text">
                {kl.watch.map((n) => fmt(n)).join("  ·  ")}
              </span>
            </div>
          )}
          {kl.invalidation != null && (
            <div className="flex items-center justify-between">
              <span className="text-text-dim">Invalidation</span>
              <span className="font-mono text-red">{fmt(kl.invalidation)}</span>
            </div>
          )}
        </div>
      )}
      {iv.no_trade.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {iv.no_trade.map((w) => (
            <span
              key={w}
              className="pill inline-flex items-center gap-1.5 border border-red/25 bg-red/10 px-2.5 py-1 text-[11px] text-red"
            >
              <IconBan className="h-3 w-3 shrink-0" /> {w}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BriefingPanel({
  output,
  gridId,
  closed,
}: {
  output: BriefingOutput;
  gridId: string;
  closed: boolean;
}) {
  return (
    <ResizableGrid gridId={gridId} className="mt-6">
      {/* Hero : le régime du jour, en grand et en clair */}
      <ResizablePanel id="hero" title={t("Thème du jour")} defaultW={12}>
        <div className="card p-6">
          <p className="hud-label">{t("thème du jour")}</p>
          <p className="mt-2 font-display text-2xl font-bold leading-snug tracking-tight text-text">
            {output.daily_theme}
          </p>
          <p className="mt-2 text-sm text-text-dim">{output.regime}</p>
        </div>
      </ResizablePanel>

      <ResizablePanel id="glance" title={t("En un coup d'œil")} defaultW={12}>
        <GlanceRow output={output} closed={closed} />
      </ResizablePanel>

      {output.landmines.length > 0 && (
        <ResizablePanel id="landmines" title="No-trade" defaultW={12}>
          <WeekendDim off={closed}>
            <div className="card flex flex-wrap items-center gap-2 px-5 py-4">
              <span className="hud-label mr-2">no-trade</span>
              {output.landmines.map((l, i) => (
                <span
                  key={i}
                  className="pill border border-red/25 bg-red/10 px-3 py-1 text-xs text-red"
                >
                  <span className="font-mono font-semibold">{l.time}</span> · {l.currency} ·{" "}
                  {l.event}
                </span>
              ))}
            </div>
          </WeekendDim>
        </ResizablePanel>
      )}

      {output.instruments.map((iv) => (
        <ResizablePanel key={iv.symbol} id={`instr-${iv.symbol}`} title={iv.symbol} defaultW={6}>
          <WeekendDim off={closed && !isCrypto(iv.symbol)}>
            <BriefingInstrument iv={iv} />
          </WeekendDim>
        </ResizablePanel>
      ))}

      <ResizablePanel id="summary" title={t("Synthèse")} defaultW={12}>
        <div className="card border-l-2 border-l-blue p-5">
          <p className="hud-label mb-1.5">{t("synthèse")}</p>
          <p className="text-sm leading-relaxed text-text">{output.summary}</p>
        </div>
      </ResizablePanel>
    </ResizableGrid>
  );
}

// ---------------- Vue principale ----------------

export default function MarketBrainView({ market }: { market: MarketBrainState }) {
  const { briefing, loading, error, dismissed, hasKey, isDemo, session, triggerHour } = market;
  const clock = useMarketClock();
  const closed = !clock.forexOpen;

  const sessionLabel = session === "pre_london" ? t("pré-Londres") : t("pré-NY");
  const payload = briefing?.payload ?? null;

  return (
    <div className="mx-auto max-w-5xl p-8">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="hud-label flex items-center gap-2">
            <span>
              {t("Session {session}", { session: sessionLabel })}
              {briefing &&
                ` · ${t("généré à {time}", {
                  time: new Date(briefing.generated_at).toLocaleTimeString(localeTag(), {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })}`}
            </span>
            <SessionIndicator compact />
          </p>
          <h1 className="mt-2 text-[32px] text-text">{t("Market-Brain")}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Les boutons désactivés ne reçoivent pas d'événements de survol :
              l'info-bulle est portée par un conteneur, ce qui permet justement
              d'EXPLIQUER pourquoi l'action est indisponible (week-end). */}
          <span
            className="inline-flex"
            data-tip={t("Flash marché")}
            data-tip-sub={
              closed
                ? t("Indisponible : marché fermé — une lecture intra-séance n'a pas d'objet le week-end.")
                : t("Lecture ponctuelle de la séance en cours, à la demande. N'écrase pas le briefing du jour et n'est pas enregistrée.")
            }
          >
            <button
              type="button"
              onClick={market.runFlash}
              disabled={market.flashLoading || closed}
              className="pill inline-flex items-center gap-1.5 border border-border bg-surface-2 px-4 py-1.5 text-xs font-medium text-text transition-colors hover:bg-overlay-2 disabled:opacity-50"
            >
              <IconBolt className="h-3.5 w-3.5" />
              {market.flashLoading ? "flash…" : "Flash"}
            </button>
          </span>
          <span
            className="inline-flex"
            data-tip={t("Régénérer le briefing")}
            data-tip-sub={
              closed
                ? t("Indisponible : marché fermé — le briefing reprendra à la réouverture.")
                : t("Relance l'analyse complète avec les données du moment et remplace le briefing de la session.")
            }
          >
            <button
              type="button"
              onClick={market.regenerate}
              disabled={loading || closed}
              className="pill bg-blue px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? t("génération…") : t("Régénérer")}
            </button>
          </span>
          {briefing && !dismissed && !isDemo && (
            <button
              type="button"
              onClick={market.dismiss}
              data-tip={t("Fermer le briefing")}
              data-tip-sub={t("Retire le badge de la sidebar : le briefing reste consultable ici.")}
              className="pill border border-border bg-surface-2 px-3.5 py-1.5 text-xs text-text-dim hover:text-text"
            >
              {t("Fermer")}
            </button>
          )}
        </div>
      </div>

      {/* Mode week-end : marché fermé (transition douce, sans flash) */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 ${
          closed ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
        aria-hidden={!closed}
      >
        <div className="overflow-hidden">
          <div className="card flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4">
            <span className="h-2 w-2 shrink-0 rounded-full bg-text-dim/50" />
            <p className="text-sm font-medium text-text">
              {t("Marché fermé — {reprise}.", {
                reprise: clock.reopenLabel ?? t("reprise lundi à l'ouverture"),
              })}
            </p>
            <p className="text-xs text-text-dim">
              {t("Forex et indices en pause le week-end · le")}{" "}
              <span className="font-semibold text-text">{t("BTC reste ouvert 24/7")}</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Bandeaux d'état */}
      {isDemo && (
        <div className="mt-4 rounded-xl border border-yellow/25 bg-yellow/10 px-4 py-2.5 text-xs text-yellow">
          {t(
            "Briefing de démonstration (hors app native). L'analyse réelle tourne dans l'app reconstruite.",
          )}
        </div>
      )}
      {payload && payload._demo && !isDemo && (
        <div className="mt-4 rounded-xl border border-yellow/25 bg-yellow/10 px-4 py-2.5 text-xs text-yellow">
          {t(
            "Données réelles indisponibles (tous les fetchers ont échoué) : affichage de données de démonstration. Vérifie la connexion puis régénère.",
          )}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-red/25 bg-red/10 px-4 py-2.5 text-xs text-red">
          {error}
        </div>
      )}
      {payload && payload._errors.length > 0 && (
        <details className="mt-4 rounded-xl border border-red/25 bg-red/10 px-4 py-2.5 text-xs text-red">
          <summary className="cursor-pointer font-medium">
            {tp(payload._errors.length, "{n} source en échec", "{n} sources en échec")}
          </summary>
          <ul className="mt-1 list-disc pl-4">
            {payload._errors.map((e, i) => (
              <li key={i} className="font-mono">
                {e}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Flash (intra-séance, non persisté) */}
      {market.flash && (
        <div className="mt-6 rounded-2xl border border-yellow/25 bg-yellow/[0.04] p-4">
          <div className="flex items-center justify-between">
            <p className="hud-label flex items-center gap-1.5 text-yellow">
              <IconBolt className="h-3.5 w-3.5" />
              flash ·{" "}
              {new Date(market.flash.generated_at).toLocaleTimeString(localeTag(), {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <button
              type="button"
              onClick={market.clearFlash}
              data-tip={t("Fermer le flash")}
              data-tip-sub={t("La lecture intra-séance n’est pas enregistrée : elle disparaît définitivement.")}
              className="pill border border-border bg-surface-2 px-3 py-1 text-xs text-text-dim hover:text-text"
            >
              {t("Fermer le flash")}
            </button>
          </div>
          <BriefingPanel output={market.flash.output} gridId="market-flash" closed={closed} />
        </div>
      )}

      {/* Briefing du jour */}
      {loading && !briefing ? (
        <p className="mt-8 text-sm text-text-dim">{t("Génération du briefing…")}</p>
      ) : briefing ? (
        <BriefingPanel output={briefing.output} gridId="market" closed={closed} />
      ) : (
        <div className="card mt-6 p-6">
          {!hasKey && !isDemo ? (
            <p className="text-sm text-text">
              {t("Ajoute une clé Gemini ou Groq dans")}{" "}
              <span className="text-blue">{t("Réglages → market-brain")}</span>{" "}
              {t("pour générer le briefing automatiquement à {h}h.", { h: triggerHour })}
            </p>
          ) : (
            <>
              <p className="text-sm text-text">
                {t(
                  "Le briefing {session} sera généré automatiquement à {h}h (ou au premier lancement après cette heure).",
                  { session: sessionLabel, h: triggerHour },
                )}
              </p>
              <button
                type="button"
                onClick={market.regenerate}
                data-tip={t("Générer le briefing maintenant")}
                data-tip-sub={t("Sans attendre l’heure de déclenchement automatique.")}
                className="pill mt-4 bg-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {t("Générer maintenant")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
