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
  // ⚠️ SEPT BARRES DE HAUTEUR ZÉRO, C'EST UN CADRE BLANC — quelle qu'en soit la
  // cause. La piste de fond existe (`background` ci-dessous) mais vaut
  // `--color-overlay`, soit 4,5 % d'encre : sur une carte blanche elle ne se
  // voit pas. Constaté sur iPhone le 2026-08-28.
  //
  // ⚠️ Et il y a DEUX causes, qui ne disent pas la même chose. Ma première
  // rédaction n'a traité que la première, et le cadre est resté blanc à
  // l'écran — c'est la seconde qui est le cas courant :
  //   • aucune tâche due     (`pct === null` partout) → il n'y a rien à tracer ;
  //   • des tâches dues, aucune cochée (`pct === 0`)  → c'est une INFORMATION,
  //     et sept barres invisibles est la pire façon de la donner.
  const aucuneDonnee = stats.length === 0 || stats.every((s) => s.pct === null);
  const toutAZero = !aucuneDonnee && stats.every((s) => !s.pct);
  if (aucuneDonnee || toutAZero) {
    return (
      <div className="panel-grow flex items-center justify-center px-4 text-center">
        <p className="text-sm text-text-dim">
          {aucuneDonnee
            ? t("Aucune tâche due ces 7 jours — le graphique se remplira tout seul.")
            : t("Aucune tâche cochée ces 7 jours.")}
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
