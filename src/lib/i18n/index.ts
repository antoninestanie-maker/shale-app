// ─────────────────────────────────────────────────────────────────────────────
// Internationalisation FR / EN.
//
// Choix d'architecture : la CLÉ de traduction est la phrase française.
//   t("Nouvelle tâche")            → "New task"
//   t("{n} jours restants", { n }) → "{n} days left"
// Avantage sur des clés abstraites (`tasks.new`) : le code reste lisible en
// français, une chaîne non traduite retombe naturellement sur le français
// (jamais de "tasks.new" affiché à l'écran), et le diff de mise en i18n est
// mécanique. Le dictionnaire anglais vit dans `en.ts`.
//
// Persistance : localStorage (`shale.lang`) — lisible SYNCHRONEMENT au premier
// rendu, donc avant l'ouverture de la base et avant le login (le thème, lui,
// peut se permettre la table settings car il s'applique par attribut CSS).
// La valeur est aussi recopiée dans la table settings (`ui.lang`) pour que le
// moteur de notifications Rust puisse la lire.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { EN } from "./en";

export type Lang = "fr" | "en";
/** Préférence utilisateur : "system" suit la langue de macOS. */
export type LangPref = Lang | "system";

const KEY = "shale.lang";
export const LANG_EVENT = "shale:lang";

const SUPPORTED: readonly Lang[] = ["fr", "en"];

/** Langue de l'OS (via la webview), repli anglais si exotique. */
export function systemLang(): Lang {
  const candidates =
    typeof navigator === "undefined"
      ? []
      : [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  for (const tag of candidates) {
    const base = String(tag).toLowerCase().split("-")[0] as Lang;
    if (SUPPORTED.includes(base)) return base;
  }
  return "en";
}

function readPref(): LangPref {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "fr" || raw === "en" || raw === "system") return raw;
  } catch {
    /* stockage indisponible */
  }
  return "system";
}

let pref: LangPref = readPref();
let current: Lang = pref === "system" ? systemLang() : pref;

/** Langue effective (jamais "system"). */
export function getLang(): Lang {
  return current;
}

/** Préférence brute, telle que choisie dans Réglages. */
export function getLangPref(): LangPref {
  return pref;
}

/**
 * Change la langue. Le rendu se met à jour immédiatement : `LangRoot`
 * (main.tsx) remonte l'arbre React sur changement de `key`, ce qui garantit
 * que même les valeurs mémorisées (useMemo, état initial) sont recalculées.
 */
export function setLangPref(next: LangPref): void {
  pref = next;
  current = next === "system" ? systemLang() : next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* stockage indisponible */
  }
  document.documentElement.lang = current;
  window.dispatchEvent(new CustomEvent(LANG_EVENT));
}

/** Applique l'attribut lang au chargement (accessibilité + césure). */
export function applyLangAttribute(): void {
  document.documentElement.lang = current;
}

// ── Traduction ──────────────────────────────────────────────────────────────

const missing = new Set<string>();

/**
 * Valeurs anglaises du dictionnaire.
 *
 * Sert à rendre `t()` IDEMPOTENT : certaines chaînes traversent deux couches
 * (un libellé de module traduit à la construction, puis re-traduit à
 * l'affichage). Sans ce garde-fou, la deuxième passe crierait « traduction
 * manquante » sur un texte déjà anglais et noierait les vrais oublis.
 */
const ALREADY_EN = new Set(Object.values(EN));

/**
 * Traduit une phrase française. `vars` remplace les jetons `{nom}`.
 * Une chaîne absente du dictionnaire est renvoyée telle quelle (français).
 *
 * **Contexte** : un mot trop générique pour servir de clé (« navigation »,
 * « notes »… qui sont aussi des identifiants techniques) s'écrit
 * `t("notes|palette")` — tout ce qui suit la barre est un discriminant, retiré
 * du repli français.
 */
export function t(fr: string, vars?: Record<string, string | number>): string {
  const bar = fr.indexOf("|");
  let out = bar >= 0 ? fr.slice(0, bar) : fr;
  if (current !== "fr") {
    const hit = EN[fr];
    if (hit != null) out = hit;
    else if (ALREADY_EN.has(out)) {
      /* déjà traduit en amont : on laisse tel quel, sans avertir */
    } else if (import.meta.env.DEV && !missing.has(fr)) {
      missing.add(fr);
      console.warn(`[i18n] traduction anglaise manquante : ${JSON.stringify(fr)}`);
    }
  }
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{${k}}`).join(String(v));
    }
  }
  return out;
}

/**
 * Pluriel simple (français et anglais ont la même règle 1 / autre).
 * `tp(n, "{n} tâche", "{n} tâches")`
 */
export function tp(
  n: number,
  one: string,
  other: string,
  vars?: Record<string, string | number>,
): string {
  return t(Math.abs(n) === 1 ? one : other, { n, ...vars });
}

/**
 * Deux variantes selon la langue, quand une traduction mot à mot n'a pas de
 * sens (formats de date maison, symboles, ordre des mots).
 */
export function pick<T>(fr: T, en: T): T {
  return current === "fr" ? fr : en;
}

// ── Formats ─────────────────────────────────────────────────────────────────

/** Balise de locale pour Intl / toLocale*. */
export function localeTag(): string {
  return current === "fr" ? "fr-FR" : "en-US";
}

export function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(localeTag(), opts);
}

export function formatTime(d: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString(localeTag(), opts);
}

export function formatNumber(n: number, opts?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(localeTag(), opts);
}

/** Devise par défaut selon la langue (€ en FR, $ en EN). */
export function defaultCurrencySymbol(): string {
  return pick("€", "$");
}

/**
 * Abonne un module au changement de langue.
 *
 * Sert aux TABLES DE CONSTANTES construites au chargement (`ITEMS`, `ACTIONS`,
 * `WIDGET_LABELS`…) : leurs libellés sont figés à l'import, donc il faut les
 * reconstruire. Comme les exports ES sont des **liaisons vivantes**, réaffecter
 * un `export let` suffit — les modules importateurs voient la nouvelle valeur
 * sans rien changer chez eux.
 *
 *   function buildItems() { return [{ label: t("Aujourd'hui") }]; }
 *   export let ITEMS = buildItems();
 *   onLangChange(() => { ITEMS = buildItems(); });
 */
export function onLangChange(fn: () => void): void {
  window.addEventListener(LANG_EVENT, fn);
}

// ── Hooks React ─────────────────────────────────────────────────────────────

/** Langue effective, réactive. */
export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>(current);
  useEffect(() => {
    const refresh = () => setLang(getLang());
    window.addEventListener(LANG_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LANG_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return lang;
}

/** Préférence brute, réactive (pour le sélecteur des Réglages). */
export function useLangPref(): LangPref {
  const [p, setP] = useState<LangPref>(pref);
  useEffect(() => {
    const refresh = () => setP(getLangPref());
    window.addEventListener(LANG_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LANG_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return p;
}
