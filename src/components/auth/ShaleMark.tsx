import type { CSSProperties } from "react";

// Monogramme Shale — marque « Strates ».
//
// Quatre couches empilées de largeurs inégales (100 · 68 · 100 · 46 %), la
// troisième en accent : la coupe géologique du shale et la liste du jour dans
// la même forme. Géométrie IDENTIQUE au site vitrine
// (`shale-site/vitrine/src/components/Logo.astro`) et à l'espace compte
// (les deux ont fusionné le 2026-08-11) : grille 24×24, plaque rx 5.3,
// barres de 3 d'épaisseur, gouttière de 2, marge de 4.
// ⚠️ Les couches courtes s'alignent à GAUCHE — ne jamais les recentrer.
//
// Couleurs : tokens du thème, jamais d'hex (règle du design system). La marque
// prend donc l'accent de sa surface — bleu dans l'app, cyan sur le site et sur
// l'icône du bundle.
const BARS = [
  { y: 3, w: 16, accent: false },
  { y: 8, w: 10.88, accent: false },
  { y: 13, w: 16, accent: true },
  { y: 18, w: 7.36, accent: false },
];

export default function ShaleMark({
  size = 40,
  parallaxe,
  relief = false,
}: {
  /**
   * La marque en VOLUME, pour la transition d'entrée seulement (2026-10-06,
   * Antonin : « ça fait trop dessin ») : plaque en dégradé avec un filet de
   * lumière en haut, barres franches, barre d'accent au dégradé de marque.
   * Partout ailleurs la marque reste plate — c'est une marque, pas une icône.
   */
  relief?: boolean;
  /** Nombre de pixels, ou une longueur CSS (« 100% » pour la copie animée). */
  size?: number | string;
  /**
   * Facteurs d'échelle par strate, dans l'ordre de `BARS`.
   *
   * Sert UNIQUEMENT à la transition d'entrée : chaque couche prend son propre
   * facteur pour que les strates se décollent (`src/index.css`, § « L'entrée
   * dans Shale »). Absent partout ailleurs, donc la marque reste une marque.
   */
  parallaxe?: readonly number[];
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ display: "block" }}
    >
      {relief && (
        <defs>
          <linearGradient id="entree-plaque" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="color-mix(in srgb, var(--color-surface-2) 90%, white)" />
            <stop offset="1" stopColor="var(--color-surface)" />
          </linearGradient>
          <linearGradient id="entree-filet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0.34" />
            <stop offset="0.45" stopColor="white" stopOpacity="0.07" />
            <stop offset="1" stopColor="white" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="entree-accent" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--gradient-brand-from)" />
            <stop offset="1" stopColor="var(--gradient-brand-to)" />
          </linearGradient>
        </defs>
      )}
      {/* Plaque + filet : la marque doit rester lisible sur la surface de
          l'app, dans les deux thèmes. Le rect est rentré d'un demi-pixel pour
          que le trait de 1 tombe net. */}
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="23"
        rx="5"
        fill={relief ? "url(#entree-plaque)" : "var(--color-surface-2)"}
        stroke={relief ? "url(#entree-filet)" : "var(--color-border)"}
        strokeWidth={relief ? "0.45" : "1"}
      />
      {BARS.map((b, i) => (
        <rect
          key={b.y}
          className={parallaxe ? "entree-strate" : undefined}
          style={
            parallaxe ? ({ "--strate": parallaxe[i] ?? 1 } as CSSProperties) : undefined
          }
          x="4"
          y={b.y}
          width={b.w}
          height="3"
          rx="1.5"
          fill={
            b.accent
              ? relief
                ? "url(#entree-accent)"
                : "var(--color-blue)"
              : relief
                ? "var(--color-success)"
                : "var(--color-text)"
          }
        />
      ))}
    </svg>
  );
}
