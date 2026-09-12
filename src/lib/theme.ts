// Thème d'apparence : sombre / clair / système (suit macOS).
// Persisté dans la table settings (clé "ui.theme") ; appliqué via l'attribut
// data-theme sur <html>, que le CSS (index.css) interprète.
import { getSetting, isTauri, setSetting } from "./repo";

export type ThemePref = "system" | "light" | "dark";

/** Le thème effectivement peint, une fois « système » résolu. */
export type ThemeResolu = "dark" | "light";

/**
 * Miroir du thème pour le PREMIER PAINT, lu par le script en ligne d'
 * `index.html` avant tout rendu.
 *
 * SQLite reste la source de vérité. Ce miroir n'existe que parce que SQLite est
 * lue APRÈS le montage de React — et, sur l'écran de connexion, pas lue du tout
 * (`ChassisFactice` : rien ne touche la base avant l'authentification). Sans lui,
 * quelqu'un qui a choisi « Clair » traverse tout le mur de connexion en sombre.
 *
 * ⚠️ Il ne contient JAMAIS de valeur pour le réglage « Système ». Mémoriser
 * « la dernière fois, le système était sombre » rejouerait une réponse périmée
 * si macOS a changé d'apparence entre-temps — soit exactement le clignotement
 * qu'on cherche à retirer. Sans miroir, `prefers-color-scheme` décide, et lui
 * est lu en direct.
 */
export const CLE_MIROIR = "shale.theme.resolved";

/**
 * Les deux fonds du design system, en clair.
 *
 * ⚠️ DUPLIQUÉS depuis `--color-bg` de `src/index.css`, et dupliqués une seconde
 * fois dans le script en ligne d'`index.html`. Cette duplication est inévitable :
 * le script du premier paint tourne avant la feuille de style, et
 * `setBackgroundColor` de Tauri attend une couleur, pas une variable CSS.
 * `src/lib/theme.premier-paint.test.ts` échoue si l'une des trois copies dérive.
 */
export const FONDS: Record<ThemeResolu, string> = {
  dark: "#07090d",
  light: "#f4f5f7",
};

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === "light" || pref === "dark") root.dataset.theme = pref;
  else delete root.dataset.theme; // système : le media query décide
  memoriserPourLePremierPaint(pref);
  void peindreLaFenetre(resoudre(pref));
  repaintBackdrops();
}

/** « système » → ce que l'OS dit, maintenant. Les choix explicites passent tels quels. */
function resoudre(pref: ThemePref): ThemeResolu {
  if (pref === "light" || pref === "dark") return pref;
  return prefereClair() ? "light" : "dark";
}

function prefereClair(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

function memoriserPourLePremierPaint(pref: ThemePref): void {
  try {
    if (pref === "system") localStorage.removeItem(CLE_MIROIR);
    else localStorage.setItem(CLE_MIROIR, pref);
  } catch {
    // Navigation privée, stockage refusé, quota plein : le premier paint
    // retombera sur `prefers-color-scheme`. Dégradé, jamais cassé.
  }
}

/**
 * Le thème à peindre AVANT que SQLite ait parlé — même logique que le script en
 * ligne d'`index.html`, disponible au reste du code.
 */
export function themeAuDemarrage(): ThemeResolu {
  let choix: string | null = null;
  try {
    choix = localStorage.getItem(CLE_MIROIR);
  } catch {
    choix = null;
  }
  if (choix === "dark" || choix === "light") return choix;
  return prefereClair() ? "light" : "dark";
}

/**
 * Le fond de la FENÊTRE Tauri, sous la webview.
 *
 * `tauri.conf.json` ne peut porter qu'une couleur fixe : elle ne saurait pas
 * suivre l'apparence. C'est donc ici, à l'exécution, que la fenêtre prend le
 * bon fond — sans quoi un thème clair montre le liseré sombre de la config au
 * redimensionnement et à l'ouverture.
 */
export async function peindreLaFenetre(resolu: ThemeResolu): Promise<void> {
  if (!isTauri) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setBackgroundColor(FONDS[resolu]);
  } catch {
    // Fenêtre « capture » (transparente), version de Tauri sans la commande,
    // plateforme qui l'ignore : c'est du confort visuel, jamais un blocage.
  }
}

/**
 * Chromium n'invalide pas toujours les couches `backdrop-filter` quand la
 * couleur qu'elles échantillonnent change via une variable CSS : la sidebar
 * et les barres d'outils en verre restaient peintes dans l'ANCIEN thème
 * jusqu'au prochain repaint (scroll, redimensionnement…). On force donc une
 * invalidation ponctuelle, le temps d'une frame.
 */
function repaintBackdrops(): void {
  if (typeof document === "undefined") return;
  const targets = document.querySelectorAll<HTMLElement>("aside, .glass");
  for (const el of targets) el.style.backdropFilter = "none";
  requestAnimationFrame(() => {
    for (const el of targets) el.style.backdropFilter = "";
  });
}

export async function loadTheme(): Promise<ThemePref> {
  const v = await getSetting("ui.theme").catch(() => null);
  const pref: ThemePref = v === "light" || v === "dark" ? v : "system";
  applyTheme(pref);
  return pref;
}

export async function saveTheme(pref: ThemePref): Promise<void> {
  applyTheme(pref);
  await setSetting("ui.theme", pref).catch(() => {});
}
