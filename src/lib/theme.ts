// Thème d'apparence : sombre / clair / système (suit macOS).
// Persisté dans la table settings (clé "ui.theme") ; appliqué via l'attribut
// data-theme sur <html>, que le CSS (index.css) interprète.
import { getSetting, setSetting } from "./repo";

export type ThemePref = "system" | "light" | "dark";

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === "light" || pref === "dark") root.dataset.theme = pref;
  else delete root.dataset.theme; // système : le media query décide
  repaintBackdrops();
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
