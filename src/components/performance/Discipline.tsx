import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, t } from "../../lib/i18n";
import type { PointJour } from "../../lib/performance/analyse";

/**
 * ⭐ LA DISCIPLINE EN COURBE ET EN CARRÉS (2026-10-09) — demande d'Antonin :
 * « en plus du graphe à carrés, une courbe qui montre l'évolution en
 * pourcentage ». Les deux disent des choses différentes, d'où les deux :
 *   • les CARRÉS montrent la régularité — les trous se voient d'un coup d'œil ;
 *   • la COURBE montre la tendance — est-ce que ça monte ou est-ce que ça baisse.
 *
 * La courbe a deux traits : le jour, fin et discret (il monte et descend trop
 * pour qu'on y lise une pente), et la MOYENNE SUR 7 JOURS, en bleu, qui est ce
 * qu'on regarde. Les calculs sont dans `lib/performance/analyse.ts`.
 */

const stylebulle = {
  backgroundColor: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--color-text)",
};

/** « 08/10 » en français, « 10/08 » en anglais — midi, pour rester dans la journée (PIEGES § 4.1). */
function jourCourt(date: string): string {
  const [a, m, j] = date.split("-").map(Number);
  return formatDate(new Date(a, m - 1, j, 12), { day: "2-digit", month: "2-digit" });
}

export function CourbeDiscipline(props: {
  /** Les jours de la période, aujourd'hui compris en dernier point. */
  points: readonly PointJour[];
  /** La moyenne glissante, alignée sur `points`. */
  lisse: readonly (number | null)[];
  /** Une ligne de repère (le seuil d'un jour « tenu »), si elle a un sens. */
  seuil?: number;
  className?: string;
}) {
  // Un id de dégradé PAR MONTAGE : deux courbes à l'écran avec le même id, et
  // la seconde prendrait le dégradé de la première (DESIGN.md, « Dans un SVG »).
  const id = `courbe-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const hauteur = 190;
  const donnees = props.points.map((p, i) => ({ label: jourCourt(p.date), jour: p.pct, lisse: props.lisse[i] }));
  const mesures = donnees.filter((d) => d.jour !== null).length;

  if (mesures < 2) {
    return (
      <p className={`py-8 text-center text-sm text-text-dim ${props.className ?? ""}`}>
        {t("Pas encore assez de jours pour tracer une courbe.")}
      </p>
    );
  }

  return (
    <div className={`panel-chart min-h-[190px] ${props.className ?? ""}`}>
      <ResponsiveContainer width="100%" height="100%" minHeight={hauteur}>
        <ComposedChart data={donnees} margin={{ top: 6, right: 4, bottom: 0, left: -24 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
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
            minTickGap={28}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          {props.seuil != null && (
            <ReferenceLine y={props.seuil} stroke="var(--color-border-strong)" strokeDasharray="3 4" />
          )}
          <Tooltip
            contentStyle={stylebulle}
            formatter={(v, nom) => [v == null ? "—" : `${v}%`, nom === "lisse" ? t("moyenne 7 jours") : t("ce jour-là")]}
          />
          {/* `linear`, pas `monotone` : arrondi, le trait du jour dépassait 100 %
              et descendait sous 0 entre deux points — il inventait des valeurs. */}
          <Line
            type="linear"
            dataKey="jour"
            stroke="var(--color-text-dim)"
            strokeOpacity={0.45}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 3, fill: "var(--color-text-dim)" }}
            connectNulls
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="lisse"
            stroke="var(--color-blue)"
            strokeWidth={2.5}
            fill={`url(#${id})`}
            activeDot={{ r: 4, fill: "var(--color-blue)" }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** La légende des deux traits — et du repère, quand il y en a un. */
export function LegendeCourbe({ seuil }: { seuil?: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-dim">
      <span className="flex items-center gap-1.5">
        <span className="h-0.5 w-4 rounded bg-blue" aria-hidden />
        {t("moyenne 7 jours")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-px w-4 bg-text-dim opacity-60" aria-hidden />
        {t("jour par jour")}
      </span>
      {seuil && (
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-border-strong" aria-hidden />
          {seuil}
        </span>
      )}
    </p>
  );
}

export interface Carre {
  date: string;
  /** `null` : jour neutre ou à venir. */
  pct: number | null;
  futur: boolean;
}

/**
 * Les semaines en colonnes, du lundi au dimanche, la plus récente à droite.
 * `zeroEnRouge` : pour les TÂCHES, un jour à 0 % est un jour manqué (il y
 * avait des tâches dues) ; pour les habitudes, c'est une case vide.
 *
 * ⭐ Calées À DROITE et rognées à gauche (`justify-end` + `overflow-hidden`) :
 * une carte étroite montre moins de semaines, toujours les plus récentes, sans
 * barre de défilement à ramener au bout.
 */
export function GrilleCarres(props: { semaines: readonly (readonly Carre[])[]; zeroEnRouge?: boolean }) {
  return (
    <div>
      <div className="flex justify-end gap-[3px] overflow-hidden">
        {props.semaines.map((semaine, i) => (
          <div key={i} className="flex shrink-0 flex-col gap-[3px]">
            {semaine.map((c) => (
              <div
                key={c.date}
                title={`${jourCourt(c.date)}${c.pct !== null ? ` — ${c.pct}%` : ""}`}
                className="h-3.5 w-3.5 rounded-[3px]"
                style={{ backgroundColor: c.futur ? "transparent" : couleurCarre(c.pct, !!props.zeroEnRouge) }}
              />
            ))}
          </div>
        ))}
      </div>
      {/* shrink-0 sur les deux libellés : `.hud-label` tronque en ellipse, et
          sans lui « moins » et « plus » disparaissaient en fenêtre étroite. */}
      <div className="mt-2 flex items-center gap-1.5">
        <span className="hud-label mr-1 shrink-0">{t("moins")}</span>
        {[10, 50, 80, 100].map((p) => (
          <span key={p} className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: couleurCarre(p, false) }} />
        ))}
        <span className="hud-label ml-1 shrink-0">{t("plus")}</span>
      </div>
    </div>
  );
}

/** Le réussi en grande surface est à l'ENCRE (`--color-success-fill`, DESIGN.md). */
function couleurCarre(pct: number | null, zeroEnRouge: boolean): string {
  if (pct === null) return "var(--color-overlay)";
  if (pct >= 100) return "var(--color-success-fill)";
  if (pct >= 80) return "color-mix(in srgb, var(--color-success-fill) 65%, transparent)";
  if (pct >= 50) return "color-mix(in srgb, var(--color-success-fill) 35%, transparent)";
  if (pct > 0) return "color-mix(in srgb, var(--color-success-fill) 15%, transparent)";
  return zeroEnRouge ? "color-mix(in srgb, var(--color-red) 18%, transparent)" : "var(--color-overlay)";
}
