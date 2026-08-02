// Monogramme Shale — marque « Strates ».
//
// Quatre couches empilées de largeurs inégales (100 · 68 · 100 · 46 %), la
// troisième en accent : la coupe géologique du shale et la liste du jour dans
// la même forme. Géométrie IDENTIQUE au site vitrine
// (`shale-site/vitrine/src/components/Logo.astro`) et à l'espace compte
// (`shale-site/compte/site/assets/auth.js::paintMarks`) : grille 24×24, plaque rx 5.3,
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

export default function ShaleMark({ size = 40 }: { size?: number }) {
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
        fill="var(--color-surface-2)"
        stroke="var(--color-border)"
        strokeWidth="1"
      />
      {BARS.map((b) => (
        <rect
          key={b.y}
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
