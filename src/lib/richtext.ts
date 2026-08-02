// Texte riche — helpers partagés par l'éditeur de Notes (`RichNoteEditor`) et
// l'éditeur de blocs du Savoir (`NoteComposer`).
//
// Deux responsabilités :
//   1. faire suivre le THÈME aux couleurs déjà enregistrées dans les notes
//      (historique : `execCommand` produisait des `<font color>` figés) ;
//   2. extraire du HTML ce dont l'app a besoin ailleurs — texte brut pour la
//      recherche, première image pour la vignette de carte.

/**
 * Palette concrète (sombre + clair) → variable de thème. Permet aux couleurs
 * déjà enregistrées de suivre le thème clair/sombre, même après coup.
 * Clés normalisées : minuscules, sans espaces.
 */
const COLOR_TO_VAR: Record<string, string> = {
  "#0a84ff": "var(--color-blue)", "rgb(10,132,255)": "var(--color-blue)",
  "#0071e3": "var(--color-blue)", "rgb(0,113,227)": "var(--color-blue)",
  "#30d158": "var(--color-green)", "rgb(48,209,88)": "var(--color-green)",
  "#1e9e50": "var(--color-green)", "rgb(30,158,80)": "var(--color-green)",
  "#ff453a": "var(--color-red)", "rgb(255,69,58)": "var(--color-red)",
  "#d93025": "var(--color-red)", "rgb(217,48,37)": "var(--color-red)",
  "#ffd60a": "var(--color-yellow)", "rgb(255,214,10)": "var(--color-yellow)",
  "#b45309": "var(--color-yellow)", "rgb(180,83,9)": "var(--color-yellow)",
  "#a78bfa": "var(--color-violet)", "rgb(167,139,250)": "var(--color-violet)",
  "#7c3aed": "var(--color-violet)", "rgb(124,58,237)": "var(--color-violet)",
  "#f2f2f4": "var(--color-text)", "rgb(242,242,244)": "var(--color-text)",
  "#1d1d1f": "var(--color-text)", "rgb(29,29,31)": "var(--color-text)",
  /* Palette V4 "Graphite & Signal" (sombre + clair) */
  "#2e7ff2": "var(--color-blue)", "rgb(46,127,242)": "var(--color-blue)",
  "#1a6ce8": "var(--color-blue)", "rgb(26,108,232)": "var(--color-blue)",
  "#33d17a": "var(--color-green)", "rgb(51,209,122)": "var(--color-green)",
  "#178745": "var(--color-green)", "rgb(23,135,69)": "var(--color-green)",
  "#ff5d55": "var(--color-red)", "rgb(255,93,85)": "var(--color-red)",
  "#d63a2f": "var(--color-red)", "rgb(214,58,47)": "var(--color-red)",
  "#f2b13d": "var(--color-yellow)", "rgb(242,177,61)": "var(--color-yellow)",
  "#a16207": "var(--color-yellow)", "rgb(161,98,7)": "var(--color-yellow)",
  "#a08cff": "var(--color-violet)", "rgb(160,140,255)": "var(--color-violet)",
  "#6a4ee0": "var(--color-violet)", "rgb(106,78,224)": "var(--color-violet)",
  "#e9edf3": "var(--color-text)", "rgb(233,237,243)": "var(--color-text)",
  "#171a20": "var(--color-text)", "rgb(23,26,32)": "var(--color-text)",
};

/** Couleurs "défaut"/cassées (dont l'ancien bug de texte transparent) → texte lisible. */
const DEFAULT_COLORS = new Set([
  "transparent", "black", "#000", "#000000",
  "rgb(0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,1)",
]);

const colorKey = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, "");

/** Mappe une couleur concrète vers une variable de thème ; null = laisser tel quel. */
function mapColor(raw: string): string | null {
  const k = colorKey(raw);
  if (!k || k.startsWith("var(")) return null; // déjà themé
  if (COLOR_TO_VAR[k]) return COLOR_TO_VAR[k];
  if (DEFAULT_COLORS.has(k)) return "var(--color-text)";
  return null; // couleur personnalisée inconnue : on n'y touche pas
}

/**
 * Réécrit le HTML d'une note pour que ses couleurs suivent le thème :
 * - `<font color="…">` (ancien execCommand) → `<span style="color: var(…)">`
 * - couleurs inline figées (hex/rgb de la palette) → variables de thème
 */
export function normalizeNoteColors(html: string): string {
  if (!/<font|color\s*[:=]/i.test(html)) return html;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;

  tpl.content.querySelectorAll("font").forEach((f) => {
    const span = document.createElement("span");
    while (f.firstChild) span.appendChild(f.firstChild);
    const attr = f.getAttribute("color");
    if (attr) span.style.color = mapColor(attr) ?? attr;
    if (f.style.backgroundColor) {
      span.style.backgroundColor =
        mapColor(f.style.backgroundColor) ?? f.style.backgroundColor;
    }
    f.replaceWith(span);
  });

  tpl.content.querySelectorAll<HTMLElement>("*").forEach((el) => {
    if (el.style.color) {
      const m = mapColor(el.style.color);
      if (m) el.style.color = m;
    }
    if (el.style.backgroundColor) {
      const m = mapColor(el.style.backgroundColor);
      if (m) el.style.backgroundColor = m;
    }
  });

  return tpl.innerHTML;
}

/** Échappe le texte brut (notes historiques en markdown/texte) pour l'injecter en HTML. */
export function toEditorHtml(body: string): string {
  const looksHtml = /<[a-z][\s\S]*>/i.test(body);
  if (looksHtml) return normalizeNoteColors(body);
  const esc = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc.replace(/\n/g, "<br>");
}

/**
 * HTML → texte brut (recherche, extraits).
 * Les fins de bloc deviennent des espaces, sans quoi « <h2>Titre</h2><p>Texte »
 * donnerait « TitreTexte ». Les images (data URL) ne laissent aucune trace.
 */
export function plainText(html: string): string {
  if (!html) return "";
  const el = document.createElement("div");
  el.innerHTML = html.replace(
    /<\/(p|div|li|ul|ol|h[1-6]|blockquote|tr|section|figure)>|<br\s*\/?>/gi,
    "$& ",
  );
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Source de la première image du corps — sert de couverture à la carte. */
export function firstImageSrc(html: string): string | null {
  if (!html || !html.includes("<img")) return null;
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.querySelector("img")?.getAttribute("src") ?? null;
}

/** Ce que contient une note, pour l'afficher d'un coup d'œil sur sa carte. */
export interface RichCounts {
  images: number;
  sketches: number;
  links: number;
}

export function countRich(html: string): RichCounts {
  if (!html) return { images: 0, sketches: 0, links: 0 };
  const el = document.createElement("div");
  el.innerHTML = html;
  const sketches = el.querySelectorAll("img[data-sketch]").length;
  return {
    images: el.querySelectorAll("img").length - sketches,
    sketches,
    links: el.querySelectorAll("a[href]").length,
  };
}
