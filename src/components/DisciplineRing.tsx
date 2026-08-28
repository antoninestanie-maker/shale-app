import { IconFlame } from "./icons";
import { tp } from "../lib/i18n";

interface Props {
  pct: number | null;
  streak: number;
  done: number;
  total: number;
}

const R = 84;
const CIRC = 2 * Math.PI * R;

/** Graduations de l'anneau extérieur (60 ticks, 1 sur 5 accentué). */
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const angle = (i * 6 * Math.PI) / 180;
  const major = i % 5 === 0;
  const r1 = major ? 97 : 99.5;
  const r2 = 103;
  return {
    x1: 110 + r1 * Math.cos(angle),
    y1: 110 + r1 * Math.sin(angle),
    x2: 110 + r2 * Math.cos(angle),
    y2: 110 + r2 * Math.sin(angle),
    major,
  };
});

/**
 * Anneau de discipline — entièrement RESPONSIVE.
 *
 * Avant : `h-56 w-56` en dur (224px) → débordait dès que le widget passait
 * sous ~264px de large. Désormais le conteneur est fluide (`w-full`, borné à
 * 240px, ratio carré) et **les chiffres vivent dans le SVG** : ils se mettent
 * donc à l'échelle exactement comme l'anneau, à n'importe quelle taille de
 * widget, sans media query ni container query.
 */
export default function DisciplineRing({ pct, streak, done, total }: Props) {
  const p = (pct ?? 0) / 100;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[240px] min-w-0">
      <svg viewBox="0 0 220 220" className="h-full w-full">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-blue)" />
            <stop offset="100%" stopColor="var(--color-green)" />
          </linearGradient>
        </defs>

        {/* graduations extérieures */}
        <g>
          {TICKS.map((t, i) => (
            <line
              key={i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={
                t.major
                  ? "color-mix(in srgb, var(--color-text) 35%, transparent)"
                  : "color-mix(in srgb, var(--color-text) 12%, transparent)"
              }
              strokeWidth={t.major ? 1.5 : 1}
            />
          ))}
        </g>

        {/* anneau pointillé rotatif (décor) */}
        <g
          className="animate-spin-slow"
          style={{ transformOrigin: "center", transformBox: "fill-box" }}
        >
          <circle
            cx="110"
            cy="110"
            r="92"
            fill="none"
            stroke="color-mix(in srgb, var(--color-blue) 28%, transparent)"
            strokeWidth="1"
            strokeDasharray="2 14"
          />
        </g>
        <g
          className="animate-spin-slower"
          style={{ transformOrigin: "center", transformBox: "fill-box" }}
        >
          <circle
            cx="110"
            cy="110"
            r="70"
            fill="none"
            stroke="color-mix(in srgb, var(--color-green) 18%, transparent)"
            strokeWidth="1"
            strokeDasharray="1 10"
          />
        </g>

        {/* piste + arc de progression */}
        <g className="-rotate-90" style={{ transformOrigin: "center", transformBox: "fill-box" }}>
          <circle
            cx="110"
            cy="110"
            r={R}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="13"
          />
          <circle
            cx="110"
            cy="110"
            r={R}
            fill="none"
            stroke="url(#ringGrad)"
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - p)}
            style={{
              transition: "stroke-dashoffset 0.6s var(--ease-out-quint)",
            }}
          />
        </g>

        {/* Chiffres dans le SVG → mise à l'échelle parfaite avec l'anneau */}
        <text
          x="110"
          y="104"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-text)"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          {pct === null ? "—" : `${pct}%`}
        </text>
        <text
          x="110"
          y="130"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-text-dim)"
          style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
        >
          {tp(total, "{done}/{n} tâche", "{done}/{n} tâches", { done })}
        </text>
      </svg>

      {/* Chip de streak : positionnée en % → suit l'échelle du conteneur */}
      <div className="pointer-events-none absolute inset-x-0 top-[64%] flex justify-center">
        <span className="pill inline-flex max-w-full items-center gap-1 border border-green/30 bg-green/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-green">
          <IconFlame className="h-3 w-3 shrink-0" /> {streak} j
        </span>
      </div>
    </div>
  );
}
