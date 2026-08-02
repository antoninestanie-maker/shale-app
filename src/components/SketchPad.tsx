// Croquis — surface de dessin des fiches « Savoir ».
//
// Choix structurants :
// - le tracé est stocké en VECTORIEL (liste de traits) dans la colonne `data`
//   de la fiche : un croquis reste donc modifiable plus tard, pas seulement
//   consultable. Le PNG rendu sert uniquement à l'affichage (carte + lecteur) ;
// - la feuille a un fond « papier » opaque, identique en thème clair et sombre :
//   une image exportée ne peut pas devenir illisible si l'app change de thème.
//   La gomme peint donc simplement avec la couleur du papier — exact, et sans
//   `destination-out` qui trouerait le fond ;
// - les coordonnées sont normalisées sur une feuille logique fixe
//   (1440 × 900) : le rendu est net quelle que soit la taille d'affichage.
import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconReset, IconX } from "./icons";

import { t } from "../lib/i18n";
const SHEET_W = 1440;
const SHEET_H = 900;
const PAPER = "#f7f8fa";

/** Encres concrètes : elles sont cuites dans le PNG, donc indépendantes du thème. */
const INKS = [
  { name: "Encre", value: "#1b2030" },
  { name: "Bleu", value: "#2f6fe0" },
  { name: "Vert", value: "#1f7a5a" },
  { name: "Rouge", value: "#d2384a" },
  { name: "Ambre", value: "#c8871a" },
];

const widths = () => [
  { name: "Fin", value: 3 },
  { name: "Moyen", value: 6 },
  { name: t("Épais"), value: 12 },
];

export interface Stroke {
  color: string;
  width: number;
  points: [number, number][];
}

export interface SketchData {
  strokes: Stroke[];
}

/** Relit le JSON d'un croquis existant en tolérant un contenu inattendu. */
export function parseSketch(raw: string | null): SketchData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SketchData;
    return Array.isArray(parsed?.strokes) ? parsed : null;
  } catch {
    return null;
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  const pts = s.points;
  if (pts.length === 0) return;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (pts.length === 1) {
    // un simple point : un rond plein de la largeur du trait
    ctx.arc(pts[0][0], pts[0][1], s.width / 2, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    return;
  }
  ctx.moveTo(pts[0][0], pts[0][1]);
  // lissage : on relie les MILIEUX des segments par des quadratiques,
  // ce qui gomme les angles du tracé brut sans décaler la ligne.
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
}

interface Props {
  title: string;
  initial: SketchData | null;
  onCancel: () => void;
  /** `png` = rendu affichable, `data` = JSON des traits (ré-éditable). */
  onSave: (png: string, data: string) => void;
}

export default function SketchPad({ title, initial, onCancel, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>(initial?.strokes ?? []);
  const currentRef = useRef<Stroke | null>(null);
  const [ink, setInk] = useState(INKS[0].value);
  const [width, setWidth] = useState(widths()[1].value);
  const [erasing, setErasing] = useState(false);
  const [count, setCount] = useState(strokesRef.current.length);

  /** Redessine tout : fond papier puis traits, dans l'ordre. */
  const repaint = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, SHEET_W, SHEET_H);
    for (const s of strokesRef.current) drawStroke(ctx, s);
    if (currentRef.current) drawStroke(ctx, currentRef.current);
  }, []);

  useEffect(() => {
    repaint();
  }, [repaint]);

  const toSheet = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * SHEET_W,
      ((e.clientY - rect.top) / rect.height) * SHEET_H,
    ];
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    currentRef.current = {
      // la gomme peint avec la couleur du papier : le fond reste intact
      color: erasing ? PAPER : ink,
      width: erasing ? width * 3 : width,
      points: [toSheet(e)],
    };
    repaint();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cur = currentRef.current;
    if (!cur) return;
    const pt = toSheet(e);
    const last = cur.points[cur.points.length - 1];
    // filtre anti-bruit : on ignore les micro-déplacements (tracé plus fluide)
    if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 1.2) return;
    cur.points.push(pt);
    repaint();
  };

  const endStroke = () => {
    const cur = currentRef.current;
    currentRef.current = null;
    if (!cur) return;
    strokesRef.current = [...strokesRef.current, cur];
    setCount(strokesRef.current.length);
    repaint();
  };

  const undo = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setCount(strokesRef.current.length);
    repaint();
  }, [repaint]);

  const clear = useCallback(() => {
    strokesRef.current = [];
    setCount(0);
    repaint();
  }, [repaint]);

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(
      canvas.toDataURL("image/png"),
      JSON.stringify({ strokes: strokesRef.current } satisfies SketchData),
    );
  };

  // Raccourcis : ⌘Z annule, Échap ferme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, undo]);

  const toolBtn = (active: boolean) =>
    `pill flex h-8 items-center gap-1.5 px-3 text-xs font-medium transition-colors ${
      active
        ? "bg-overlay-2 text-text"
        : "text-text-dim hover:bg-overlay hover:text-text"
    }`;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="card card-solid animate-fade-up flex max-h-full w-full max-w-4xl flex-col p-5">
        <div className="flex items-center gap-3">
          <h3 className="min-w-0 flex-1 truncate font-display text-lg font-bold text-text">
            {title}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            data-tip={t("Fermer sans enregistrer")}
            aria-label={t("Fermer")}
            className="rounded-md p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* Barre d'outils : encres, épaisseurs, gomme, annuler, effacer */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-[var(--radius-field)] border border-border bg-surface-2 p-1.5">
          <span className="flex items-center gap-1 pr-1">
            {INKS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  setInk(c.value);
                  setErasing(false);
                }}
                data-tip={c.name}
                aria-label={`Encre ${c.name}`}
                className={`h-6 w-6 rounded-full border transition-transform ${
                  ink === c.value && !erasing
                    ? "scale-110 border-transparent ring-2 ring-blue"
                    : "border-border hover:scale-110"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </span>

          <span className="mx-1 h-5 w-px bg-border" />

          {widths().map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => setWidth(w.value)}
              data-tip={`Trait ${w.name.toLowerCase()}`}
              className={toolBtn(width === w.value)}
            >
              <span
                className="rounded-full bg-current"
                style={{ height: w.value / 1.6, width: w.value / 1.6 }}
              />
              {w.name}
            </button>
          ))}

          <span className="mx-1 h-5 w-px bg-border" />

          <button
            type="button"
            onClick={() => setErasing((v) => !v)}
            data-tip="Gomme"
            data-tip-sub={t("Repeint la zone en couleur du papier.")}
            className={toolBtn(erasing)}
          >
            Gomme
          </button>
          <button
            type="button"
            onClick={undo}
            disabled={count === 0}
            data-tip={t("Annuler le dernier trait")}
            data-tip-kbd="⌘Z"
            className={`${toolBtn(false)} disabled:opacity-30`}
          >
            <IconReset className="h-3.5 w-3.5" /> {t("Annuler")}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={count === 0}
            data-tip={t("Effacer toute la feuille")}
            className={`${toolBtn(false)} disabled:opacity-30`}
          >
            {t("Tout effacer")}
          </button>

          <button
            type="button"
            onClick={save}
            data-tip={t("Enregistrer le croquis")}
            data-tip-sub={t("Le tracé reste modifiable : tu pourras le rouvrir et le compléter.")}
            className="pill ml-auto inline-flex h-8 items-center gap-1.5 bg-blue px-4 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            <IconCheck className="h-3.5 w-3.5" /> {t("Enregistrer")}
          </button>
        </div>

        {/* Feuille */}
        <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[var(--radius-field)] border border-border">
          <canvas
            ref={canvasRef}
            width={SHEET_W}
            height={SHEET_H}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            className="block w-full cursor-crosshair touch-none"
            style={{ aspectRatio: `${SHEET_W} / ${SHEET_H}` }}
          />
        </div>
      </div>
    </div>
  );
}
