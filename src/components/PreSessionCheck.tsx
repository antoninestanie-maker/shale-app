import { useEffect, useMemo, useState } from "react";
import { reactionCheck, SLOW_THRESHOLD } from "../lib/benchmark";
import type { AppData } from "../lib/types";
import { ReactionTest } from "./BenchmarkTests";
import { IconAlert, IconCheckCircle, IconTarget } from "./icons";

import { t } from "../lib/i18n";
interface Props {
  data: AppData;
  refresh: () => Promise<void>;
  /** "dashboard" : n'affiche que si alerte/à tester. "trading" : carte complète toujours visible. */
  place: "dashboard" | "trading";
}

/**
 * "Alcootest du trader" : contrôle de réactivité avant de trader.
 * Si le temps de réaction du jour est ≥ 20 % plus lent que la moyenne
 * habituelle, on affiche une alerte.
 */
export default function PreSessionCheck({ data, refresh, place }: Props) {
  const [open, setOpen] = useState(false);
  const check = useMemo(
    () => reactionCheck(data.benchmarks),
    [data.benchmarks],
  );

  // Ouverture à la demande (palette ⌘K / voix). Un seul écouteur suffit :
  // sur le dashboard, présent sur toutes les vues via TodayView au montage.
  useEffect(() => {
    if (place !== "dashboard") return;
    const onOpen = () => setOpen(true);
    window.addEventListener("sb:presession", onOpen);
    return () => window.removeEventListener("sb:presession", onOpen);
  }, [place]);

  const test = open ? (
    <ReactionTest
      preSession
      onClose={() => setOpen(false)}
      onSaved={async () => {
        await refresh();
      }}
    />
  ) : null;

  // — Cas 1 : réflexes bas (l'alerte demandée) —
  if (check.slow) {
    return (
      <>
        <div className="card border border-red/40 bg-red/10 p-4">
          <div className="rgrid-head flex flex-wrap items-start gap-3">
            {/* basis-[13rem] : c'est la BASE FLEX (et non min-width) qui décide
                du retour à la ligne. Sous ~13rem disponibles, le bouton passe
                à la ligne suivante au lieu de comprimer ce bloc — sans quoi
                `min-w-0` le laissait tomber à ~25px et le texte s'affichait
                une lettre par ligne en fenêtre étroite. `min-w-0` reste utile
                une fois le bloc seul sur sa ligne (il peut alors rétrécir). */}
            <div className="flex min-w-0 flex-1 basis-[13rem] items-start gap-3">
              <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-red" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-bold text-red">
                  {t("Tes réflexes et ton attention sont bas aujourd'hui.")}
                </p>
                <p className="mt-1 text-xs text-text-dim">
                  Réaction {check.today} ms contre {check.baseline} ms en
                  moyenne
                  {check.slowPct !== null && (
                    <span className="font-semibold text-red">
                      {" "}
                      (+{check.slowPct} %)
                    </span>
                  )}
                  . Prudence : réduis ta taille de position ou passe ton tour.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              data-tip={t("Refaire le test")}
              data-tip-sub={t("Un nouveau test de réaction met à jour l’alerte.")}
              className="pill shrink-0 border border-border px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2"
            >
              {t("Refaire le test")}
            </button>
          </div>
        </div>
        {test}
      </>
    );
  }

  // — Cas 2 : pas encore testé aujourd'hui → invitation —
  if (!check.testedToday) {
    if (place === "dashboard") {
      return (
        <>
          <div className="card border border-blue/25 bg-blue/5 p-4">
            <div className="rgrid-head flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-1 basis-[13rem] items-center gap-3">
                <IconTarget className="h-5 w-5 shrink-0 text-blue" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">
                    {t("Test de réaction pré-session")}
                  </p>
                  <p className="mt-0.5 text-xs text-text-dim">
                    {check.hasBaseline
                      ? t("Vérifie tes réflexes avant d'ouvrir une position.")
                      : t("Fais quelques tests pour établir ta moyenne de référence.")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(true)}
                data-tip={t("Lancer le test pré-session")}
                data-tip-sub={t("Quelques secondes de test de réaction : compare tes réflexes du jour à ta moyenne.")}
                className="pill shrink-0 bg-blue px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                Lancer
              </button>
            </div>
          </div>
          {test}
        </>
      );
    }
  }

  // — Cas 3 : testé et OK (carte Trading uniquement) —
  if (place === "trading") {
    const ok = check.testedToday && !check.slow;
    return (
      <>
        <div
          className={`card mt-4 border p-4 ${
            ok ? "border-green/30 bg-green/5" : "border-border"
          }`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-1 basis-[13rem] items-center gap-3">
              {ok ? (
                <IconCheckCircle className="h-5 w-5 shrink-0 text-green" />
              ) : (
                <IconTarget className="h-5 w-5 shrink-0 text-blue" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">
                  {t("Alcootest du trader")}
                </p>
                <p className="mt-0.5 text-xs text-text-dim">
                  {ok
                    ? `Réflexes OK — ${check.today} ms aujourd'hui${
                        check.baseline ? ` (moyenne ${check.baseline} ms)` : ""
                      }.`
                    : check.hasBaseline
                      ? t("Contrôle tes réflexes (alerte si +{pct} % vs ta moyenne).", { pct: SLOW_THRESHOLD })
                      : t("Établis ta moyenne de référence en lançant quelques tests.")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              data-tip={t("Test de réaction")}
              data-tip-sub={t("Quelques secondes de test : compare tes réflexes du jour à ta moyenne.")}
              className="pill shrink-0 bg-blue px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              {ok ? "Refaire" : t("Lancer le test")}
            </button>
          </div>
        </div>
        {test}
      </>
    );
  }

  return test;
}
