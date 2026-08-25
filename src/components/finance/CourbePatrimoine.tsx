// La courbe du patrimoine net, sur douze mois, plus la projection.
//
// Deux séries et pas une : le TOTAL et le LIQUIDE. Les confondre est l'erreur
// que ce module existe pour éviter — un patrimoine qui monte pendant que les
// liquidités fondent est exactement la situation qu'on veut voir arriver.
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formaterCents } from "../../lib/finance/montants";
import { HORIZONS, projection } from "../../lib/finance/projection";
import type { Burn } from "../../lib/finance/burn";
import type { PointPatrimoine } from "../../lib/finance/patrimoine";
import { Montant } from "./champs";
import { formatDate, localeTag, t } from "../../lib/i18n";

const tooltipStyle = {
  backgroundColor: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--color-text)",
};

const moisCourt = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(localeTag(), { month: "short" });

export default function CourbePatrimoine({
  serie,
  nbReleves,
  patrimoineCents,
  burn,
  aujourdhui,
  devise,
}: {
  serie: PointPatrimoine[];
  /**
   * Nombre de relevés saisis — PAS le nombre de points de la série.
   *
   * La série compte toujours treize points (un par mois), même sur une base
   * vide : s'y fier ferait dessiner une courbe plate à zéro et laisserait
   * croire à un patrimoine nul, au lieu d'admettre qu'on ne sait rien.
   */
  nbReleves: number;
  patrimoineCents: number;
  burn: Burn;
  aujourdhui: string;
  devise: string;
}) {
  const points = serie.map((p) => ({
    label: moisCourt(p.date),
    total: p.totalCents / 100,
    liquide: p.liquideCents / 100,
  }));

  const horizons = projection(aujourdhui, patrimoineCents, burn, Math.max(...HORIZONS));

  return (
    <section className="card p-5">
      <div className="rgrid-head flex items-center justify-between">
        <h2 className="hud-label">{t("patrimoine — 12 derniers mois")}</h2>
        <div className="flex items-center gap-3 text-xs text-text-dim">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue" />
            {t("total")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green" />
            {t("liquide")}
          </span>
        </div>
      </div>

      {nbReleves < 2 ? (
        <p className="py-6 text-center text-sm text-text-dim">
          {nbReleves === 0
            ? t("Relève le solde d'un compte : la courbe part de là.")
            : t("La courbe se dessine à partir du deuxième relevé — reviens le mois prochain.")}
        </p>
      ) : (
        <div className="panel-chart mt-3 min-h-[170px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={170}>
            <ComposedChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="finTotalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-blue)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-blue)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-overlay)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={56}
                tickFormatter={(v: number) =>
                  new Intl.NumberFormat(localeTag(), {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(v)
                }
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, nom) => [
                  formaterCents(Math.round(Number(v ?? 0) * 100), devise, localeTag(), {
                    sansDecimales: true,
                  }),
                  nom === "total" ? t("total") : t("liquide"),
                ]}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--color-blue)"
                strokeWidth={2.5}
                fill="url(#finTotalFill)"
                activeDot={{ r: 4, fill: "var(--color-blue)" }}
              />
              <Area
                type="monotone"
                dataKey="liquide"
                stroke="var(--color-green)"
                strokeWidth={2}
                fill="transparent"
                activeDot={{ r: 4, fill: "var(--color-green)" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Projection : une droite, pas une prédiction. Elle rend visible la
          conséquence d'un burn qu'on connaît déjà. */}
      {burn.actifs > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="hud-label">{t("au rythme actuel")}</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {HORIZONS.map((h) => (
              <div key={h}>
                <p className="text-[11px] text-text-dim">
                  {t("dans {n} mois", { n: h })} · {formatDate(horizons[h].date)}
                </p>
                <p className="mt-0.5 text-sm">
                  <Montant
                    cents={horizons[h].valeurCents}
                    devise={devise}
                    sansDecimales
                    colore={horizons[h].valeurCents < 0}
                  />
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
