// Thème d'apparence : sombre / clair / système (suit macOS).
// Persisté dans la table settings (clé "ui.theme") ; appliqué via l'attribut
// data-theme sur <html>, que le CSS (index.css) interprète.
import { IS_IOS } from "./platform";
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
  dark: "#07080b",
  light: "#f5f6f8",
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
 * La seule fenêtre dont on repeint le fond. `main.tsx` appelle
 * `peindreLaFenetre` dans TOUTES les fenêtres, et deux ne doivent pas l'être :
 * - `capture` est TRANSPARENTE — un fond peint en ferait un rectangle opaque ;
 * - `timer` reçoit sa couleur à la création (`ouvrirFenetreTimer`).
 * Une liste d'une fenêtre autorisée plutôt que de fenêtres exclues : une
 * cinquième fenêtre, un jour, ne sera pas peinte par accident. La capacité
 * `fenetre-principale.json` ne donne d'ailleurs la permission qu'à `main`.
 */
const FENETRE_PEINTE = "main";

/**
 * Le fond de la FENÊTRE Tauri, sous la webview.
 *
 * `tauri.conf.json` ne peut porter qu'une couleur fixe : elle ne saurait pas
 * suivre l'apparence. C'est donc ici, à l'exécution, que la fenêtre prend le
 * bon fond — sans quoi un thème clair montre le liseré sombre de la config au
 * redimensionnement. (Sur macOS, la webview ne peint pas son propre fond : c'est
 * celui de la NSWindow qui se voit tant que la page n'a pas repeint.)
 *
 * ⚠️ Cet appel a échoué EN SILENCE du 2026-09-12 au 2026-09-30, pour deux
 * raisons empilées (PIEGES § 26.1) :
 * 1. la permission `core:window:allow-set-background-color` manquait — l'ACL
 *    refusait, et le `catch` vide avalait le refus ;
 * 2. et même permise, `getCurrentWindow().setBackgroundColor(c)` de
 *    `@tauri-apps/api` 2.11 envoie `{ color: c }` alors que la commande Rust
 *    attend `value` : l'argument manquant est lu comme `None`, et la fenêtre
 *    retombe sur le fond SYSTÈME (gris clair si macOS est clair, même en thème
 *    sombre). Corrigé en amont dans la 2.12.0, qui envoie `{ label, value }`.
 *    D'où l'`invoke` direct, avec la forme de la 2.12 : il reste juste après
 *    la montée de version, et `setBackgroundColor` pourra revenir alors.
 */
export async function peindreLaFenetre(resolu: ThemeResolu): Promise<void> {
  if (!isTauri || IS_IOS) return; // iOS : commande non prise en charge
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    if (getCurrentWindow().label !== FENETRE_PEINTE) return;
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("plugin:window|set_background_color", { value: FONDS[resolu] });
  } catch (e) {
    // Du confort visuel, jamais un blocage — mais plus jamais en silence : un
    // refus doit se lire dans la console (§ 26.1 de PIEGES).
    console.error("thème : le fond de la fenêtre n'a pas pu être peint", e);
  }
}

/**
 * Réglage « Système » : repeindre le fond quand macOS change d'apparence
 * PENDANT que l'app tourne. La page, elle, suit seule (media query CSS) ; la
 * fenêtre native n'a aucun moyen de le savoir. Sans cet écouteur, elle gardait
 * le fond du démarrage — sombre sous une page devenue claire.
 *
 * Un choix explicite (Clair / Sombre) pose `data-theme` sur `<html>` : l'OS
 * n'a alors plus son mot à dire, et l'écouteur se tait.
 */
export function suivreLApparenceDuSysteme(): void {
  if (typeof window === "undefined" || !window.matchMedia) return;
  window
    .matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", (e) => {
      if (document.documentElement.dataset.theme) return;
      void peindreLaFenetre(e.matches ? "light" : "dark");
    });
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
