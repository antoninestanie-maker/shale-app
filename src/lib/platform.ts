// ─────────────────────────────────────────────────────────────────────────────
// Plateforme hôte, et traduction des raccourcis AFFICHÉS.
//
// Le COMPORTEMENT clavier était déjà portable avant ce module : partout dans
// l'app, les gestionnaires testent `(e.metaKey || e.ctrlKey)`, donc ⌘K sur Mac
// et Ctrl+K sur Windows marchaient déjà tous les deux. Ce qui ne l'était pas,
// c'est l'ÉTIQUETTE : les glyphes ⌘ ⌥ ⇧ étaient écrits en dur dans les
// info-bulles, la palette et les réglages. Un utilisateur Windows lisait donc
// « ⌘K » — un symbole absent de son clavier, pour un raccourci qui, lui,
// fonctionnait. D'où ce module : une seule fonction, appelée au point
// d'affichage, qui laisse le Mac strictement inchangé.
//
// Détection par user-agent plutôt que par `@tauri-apps/plugin-os` : la réponse
// est nécessaire de façon SYNCHRONE au premier rendu (les libellés sont dans le
// JSX), alors que le plugin est asynchrone et demanderait une capability de
// plus. La webview est WKWebView sur macOS et WebView2 sur Windows ; les deux
// annoncent leur système sans ambiguïté.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";

import { getLang } from "./i18n";

function detectMac(): boolean {
  if (typeof navigator === "undefined") return true; // rendu hors navigateur (tests) : on garde le défaut historique
  const ua = navigator.userAgent;
  // On teste Windows en premier : c'est le cas discriminant. Toute autre chose
  // (macOS, et un éventuel Linux non supporté) retombe sur les glyphes Mac,
  // qui étaient le comportement d'avant ce module.
  return !/Windows|Win64|Win32/i.test(ua);
}

/** Vrai sur macOS. Figé au chargement : le système ne change pas en cours de session. */
export const IS_MAC = detectMac();

/**
 * Raccourci global de la quick capture, tel qu'il est réellement enregistré
 * côté Rust (`CAPTURE_SHORTCUT` dans `src-tauri/src/lib.rs`).
 *
 * ⚠️ Ce n'est PAS une simple traduction de « ⌥Espace » : Alt+Espace est réservé
 * par Windows (menu système de la fenêtre), donc le raccourci lui-même diffère.
 * Les deux constantes doivent être changées ENSEMBLE.
 */
export const CAPTURE_SHORTCUT = IS_MAC ? "⌥ Espace" : "Ctrl+Alt+Espace";

/** Glyphe macOS → libellé Windows. `⌃` et `⌘` tombent tous deux sur Ctrl. */
const NOMS_WINDOWS: Record<string, string> = {
  "⌘": "Ctrl",
  "⌃": "Ctrl",
  "⌥": "Alt",
  "⇧": "Maj", // remplacé par "Shift" en anglais, cf. plus bas
};

/**
 * Traduit un raccourci écrit à la mode macOS vers la plateforme courante.
 *
 *   kbd("⌘B")    → "⌘B" sur Mac, "Ctrl+B" sur Windows
 *   kbd("⌘⇧N")   → "⌘⇧N" sur Mac, "Ctrl+Maj+N" sur Windows
 *
 * La forme macOS reste la source dans le code : c'est la plus compacte, et elle
 * garantit qu'un oubli d'appel se voit tout de suite sur Windows plutôt que de
 * dégrader silencieusement le Mac.
 */
export function kbd(macShortcut: string): string {
  if (IS_MAC) return macShortcut;

  const mods: string[] = [];
  let reste = "";
  for (const ch of macShortcut) {
    const nom = NOMS_WINDOWS[ch];
    if (nom) {
      // `Maj` n'existe que sur les claviers francophones ; sur un Windows
      // anglais la touche est sérigraphiée « Shift ».
      const affiche = nom === "Maj" && getLang() === "en" ? "Shift" : nom;
      // Un même modificateur peut apparaître deux fois (⌃⌘ → Ctrl+Ctrl) : on dédoublonne.
      if (!mods.includes(affiche)) mods.push(affiche);
    } else {
      reste += ch;
    }
  }

  reste = reste.trim();
  return [...mods, reste].filter(Boolean).join("+");
}

// ─────────────────────────────────────────────────────────────────────────────
// Téléphone — la bascule de NAVIGATION (barre latérale → barre d'onglets).
//
// ⚠️ La condition est un ET, pas le OU des cibles tactiles de `DESIGN.md`
// (`max-width: 900px, (pointer: coarse)`). Les deux règles ne répondent pas à
// la même question :
//   - « faut-il des cibles de 44 px ? » → OUI dès qu'un doigt est POSSIBLE,
//     donc un OU, y compris sur une fenêtre de bureau réduite ;
//   - « faut-il remplacer la barre latérale ? » → NON sur un bureau étroit,
//     où elle se replie déjà en icônes (chantier responsive du 2026-08-26), et
//     NON sur un iPad, assez large pour la porter.
// Un OU ici ferait donc disparaître la barre latérale d'un Mac en Split View —
// une régression du bureau introduite par le portage mobile.
//
// 600 px = le point de rupture `sm` de `DESIGN.md`. Pas une valeur inventée :
// la doctrine impose de réutiliser les quatre points nommés. iPhone 17 = 393 pt,
// 17 Pro Max = 440 pt ; iPad mini en portrait = 744 pt, donc garde sa barre.
// ─────────────────────────────────────────────────────────────────────────────
const REQUETE_TELEPHONE = "(max-width: 600px) and (pointer: coarse)";

/** Vrai si l'appareil doit recevoir la navigation par onglets. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(REQUETE_TELEPHONE).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(REQUETE_TELEPHONE);
    const onChange = () => setPhone(mq.matches);
    // La rotation d'un iPhone change la largeur : la valeur doit suivre, sinon
    // l'app garderait la mise en page de l'orientation de départ.
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return phone;
}
