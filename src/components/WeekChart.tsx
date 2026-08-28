import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { DAY_SHORT, weekdayOf } from "../lib/logic";
import { t } from "../lib/i18n";
import type { DayStat } from "../lib/types";

export default function WeekChart({ stats }: { stats: DayStat[] }) {
  // ⚠️ `pct === null` veut dire « aucune tâche due ce jour-là », pas « 0 % ».
  // Quand les sept jours sont nuls il n'y a rien à tracer : le graphique rendait
  // alors sept barres de hauteur zéro, c'est-à-dire un grand cadre vide avec des
  // noms de jours dessous. Constaté sur iPhone le 2026-08-28. Une série de VRAIS
  // zéros, elle, reste un graphique — c'est une information, pas une absence.
  const vide = stats.length === 0 || stats.every((s) => s.pct === null);
  if (vide) {
    return (
      <div className="panel-grow flex items-center justify-center px-4 text-center">
        <p className="text-sm text-text-dim">
          {t("Aucune tâche due ces 7 jours — le graphique se remplira tout seul.")}
        </p>
      </div>
    );
  }

  const data = stats.map((s, i) => ({
    label: DAY_SHORT[weekdayOf(s.date)],
    pct: s.pct ?? 0,
    isToday: i === stats.length - 1,
  }));

  // height="100%" : le graphique GRANDIT réellement avec le widget. La hauteur
  // est garantie définie par `.panel-chart` (height:0 + min-height) côté parent.
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={120}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide domain={[0, 100]} />
        <Bar dataKey="pct" radius={[5, 5, 5, 5]} maxBarSize={26} background={{ fill: "var(--color-overlay)", radius: 5 }}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.isToday ? "var(--color-blue)" : "var(--color-green)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
