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
   * La plaque « Nuit » de la transition d'entrée (choix d'Antonin, 2026-10-06,
   * parmi six pistes) : noire, un filet à peine visible, SANS barres — la
   * transition les dessine elle-même pour les allumer (`.entree-barre`).
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
      {/* Plaque + filet : la marque doit rester lisible sur la surface de
          l'app, dans les deux thèmes. Le rect est rentré d'un demi-pixel pour
          que le trait de 1 tombe net. */}
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="23"
        rx="5"
        fill={relief ? "black" : "var(--color-surface-2)"}
        stroke={relief ? "rgb(255 255 255 / 0.12)" : "var(--color-border)"}
        strokeWidth={relief ? "0.2" : "1"}
      />
      {/* En relief, les barres sont dessinées par la transition (des éléments
          HTML, un calque chacun) : elles s'allument sans redessiner le SVG. */}
      {!relief && BARS.map((b, i) => (
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
          fill={b.accent ? "var(--color-blue)" : "var(--color-text)"}
        />
      ))}
    </svg>
  );
}
