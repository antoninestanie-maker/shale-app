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

import { getLang, t } from "./i18n";

function detectMac(): boolean {
  if (typeof navigator === "undefined") return true; // rendu hors navigateur (tests) : on garde le défaut historique
  const ua = navigator.userAgent;
  // On teste Windows en premier : c'est le cas discriminant. Toute autre chose
  // (macOS, et un éventuel Linux non supporté) retombe sur les glyphes Mac,
  // qui étaient le comportement d'avant ce module.
  return !/Windows|Win64|Win32/i.test(ua);
}

/**
 * Vrai sur macOS **et sur iOS**, et c'est délibéré.
 *
 * Cette constante ne répond qu'à une question : « quels GLYPHES de raccourci
 * afficher ? » Un iPhone ou un iPad muni d'un clavier externe a bien une touche
 * ⌘ — la réponse Apple est donc la bonne pour lui aussi. Pour distinguer le
 * téléphone, c'est `IS_IOS` ou `useIsPhone()` qu'il faut, jamais `!IS_MAC`.
 */
export const IS_MAC = detectMac();

/**
 * Vrai sur iOS / iPadOS.
 *
 * Sert aux messages qui NOMMENT le système à l'utilisateur — « autorise Shale
 * dans Réglages macOS » n'a aucun sens sur un iPhone, et envoie chercher un
 * écran qui n'existe pas. Détecté au user-agent, pour la même raison que
 * `detectMac` : la réponse doit être synchrone au premier rendu.
 *
 * ⚠️ `MacIntel` + écran tactile : depuis iPadOS 13, un iPad en mode « bureau »
 * se présente comme un Mac. Le test des points de contact le rattrape.
 */
export const IS_IOS =
  typeof navigator !== "undefined" &&
  (/iPhone|iPod|iPad/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/**
 * Raccourci global de la quick capture, tel qu'il est réellement enregistré
 * côté Rust (`CAPTURE_SHORTCUT` dans `src-tauri/src/lib.rs`).
 *
 * ⚠️ Ce n'est PAS une simple traduction de « ⌥Espace » : Alt+Espace est réservé
 * par Windows (menu système de la fenêtre), donc le raccourci lui-même diffère.
 * Les deux constantes doivent être changées ENSEMBLE.
 */
export const CAPTURE_SHORTCUT = IS_MAC ? "⌥ Espace" : "Ctrl+Alt+Espace";

/**
 * Le même raccourci, mais À AFFICHER : la plateforme ET la langue.
 *
 * ⚠️ Une FONCTION, pas une constante — `t()` évalué à l'import figerait la
 * langue de démarrage (piège n°1 de la section i18n de `CLAUDE.md`). C'est
 * aussi pourquoi `CAPTURE_SHORTCUT` reste au-dessus : il décrit ce que le Rust
 * enregistre, ce qui ne dépend d'aucune langue.
 */
export function captureShortcutLabel(): string {
  return IS_MAC ? `⌥ ${t("Espace")}` : `Ctrl+Alt+${t("Espace")}`;
}

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
// Le seuil lui-même est détaillé juste au-dessus de `REQUETE_TELEPHONE`.
//
// ⚠️ Largeurs MESURÉES dans la webview, pas lues dans une fiche technique :
// l'iPhone 17 rend `window.innerWidth = 402`, pas 393 comme l'annonçait la
// première rédaction de ce commentaire (relevé du 2026-08-27 sur le
// simulateur). L'écart ne change rien ici — 402 comme 393 passent sous 600 —
// mais il change tout pour qui écrirait un point de rupture serré à 400.
// iPad mini en portrait = 744 pt, donc garde sa barre latérale.
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ Le seuil porte sur le PLUS PETIT CÔTÉ, pas sur la largeur.
//
// Avec `(max-width: 600px)` seul, un iPhone COUCHÉ mesure 874 pt de large : la
// condition tombait, `useIsPhone()` passait à faux, et la barre latérale DE
// BUREAU remplaçait la barre d'onglets sur un téléphone. Pire, toutes les
// réserves de zone sûre d'`App.tsx` sont conditionnées à `isPhone` — elles
// disparaissaient donc en même temps, et la Dynamic Island (qui passe sur le
// CÔTÉ en paysage) se posait par-dessus la colonne de navigation. Les douze
// modules devenaient inatteignables. Constaté à l'écran le 2026-08-28.
//
// Un téléphone reste un téléphone dans les deux sens : c'est son petit côté qui
// le dit. 600 px = le point de rupture `sm` de `DESIGN.md`, réutilisé et non
// réinventé. iPhone 17 : 402 pt de petit côté dans les deux orientations.
// iPhone 17 Pro Max : 440. iPad mini : 744 en portrait, 744 en paysage aussi
// (c'est son petit côté) — il garde donc sa barre latérale, comme voulu.
const REQUETE_TELEPHONE =
  "((max-width: 600px) or (max-height: 600px)) and (pointer: coarse)";

/**
 * La même question, HORS de React.
 *
 * ⚠️ Sert à choisir un état INITIAL (le mode par défaut du calendrier) : un
 * crochet ne peut pas répondre avant le premier rendu, et corriger l'état juste
 * après ferait clignoter la vue semaine une fraction de seconde sur téléphone.
 * Partout ailleurs, `useIsPhone()` — c'est lui qui suit la rotation.
 */
export function estTelephone(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REQUETE_TELEPHONE).matches;
}

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
