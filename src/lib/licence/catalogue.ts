// ─────────────────────────────────────────────────────────────────────────────
// Ce qu'un profil de licence a le DROIT de nommer — liste FERMÉE.
//
// Un profil délivré par le serveur ne contient que des données, et ces données
// ne peuvent désigner que ce qui figure ici. Tout le reste est ignoré à la
// lecture (`payload.ts`), jamais interprété.
//
// ⚠️ Ce fichier RECOPIE deux listes qui vivent ailleurs : les identifiants de
// module (`MODULE_IDS` de `uiConfig.ts`) et leurs libellés (`ITEMS` et
// `CATEGORIES` de `Sidebar.tsx`). La copie est délibérée : importer `Sidebar`
// dans une logique pure tirerait React, la base et Tauri dans les tests. Elle
// est tenue par `catalogue.test.ts`, qui LIT les deux fichiers sources et
// échoue au premier écart — une copie non vérifiée finit toujours par diverger.
// ─────────────────────────────────────────────────────────────────────────────

/** Les treize modules, dans l'ordre par défaut de la barre latérale. */
export const MODULES_PROFIL = [
  "today",
  "tasks",
  "calendar",
  "timer",
  "goals",
  "performance",
  "finance",
  "notes",
  "journal",
  "knowledge",
  "trading",
  "market",
  "sizing",
] as const;

export type ModuleProfil = (typeof MODULES_PROFIL)[number];

const ENSEMBLE_MODULES: ReadonlySet<string> = new Set(MODULES_PROFIL);

export function estModuleProfil(v: unknown): v is ModuleProfil {
  return typeof v === "string" && ENSEMBLE_MODULES.has(v);
}

/**
 * L'accueil ne se masque pas. C'est la règle de Personnaliser (« Aujourd'hui
 * reste toujours accessible »), et c'est aussi la vue de repli de toute la
 * navigation : un profil qui le retirerait laisserait l'app sans écran où
 * retomber quand la vue courante disparaît.
 */
export const MODULE_NON_MASQUABLE: ModuleProfil = "today";

/**
 * Clés i18n qu'un profil peut surcharger : les libellés de modules et de
 * catégories, c'est-à-dire exactement ce qui a déjà un point d'injection à
 * l'écran (la barre latérale et la barre d'onglets). La clé EST la phrase
 * française, comme partout dans l'app (`lib/i18n`).
 *
 * ⚠️ « Trading » est À LA FOIS le module et sa catégorie : c'est la même clé,
 * donc la même surcharge renomme les deux. C'est la conséquence directe de
 * « la clé est la phrase », pas un oubli.
 *
 * Pas de surcharge générale de `t()` en première version (décision du
 * 2026-09-13, `AUDIT-LICENCE-PROFILS.md` § 8) : elle toucherait chaque phrase
 * de l'app, et « une phrase contient le mot » n'est pas « une phrase est la
 * clé ».
 */
export const CLES_LIBELLES_PROFIL = [
  "Aujourd'hui",
  "Tâches",
  "Calendrier",
  "Timer",
  "Objectifs",
  "Performance",
  "Finance",
  "Notes",
  "Journal",
  "Savoir",
  "Trading",
  "Market-Brain",
  "Position",
  "Productivité",
] as const;

const ENSEMBLE_CLES: ReadonlySet<string> = new Set(CLES_LIBELLES_PROFIL);

export function estCleLibelleProfil(cle: string): boolean {
  return ENSEMBLE_CLES.has(cle);
}

/**
 * Réglages qu'un profil peut fixer, chacun avec son validateur.
 *
 * ⚠️ VIDE EN PREMIÈRE VERSION, et c'est voulu. Le cadrage prévoit la rubrique
 * `settings`, mais aucun écran ne consomme encore un réglage imposé : ouvrir la
 * liste avant d'avoir un consommateur ferait accepter des valeurs que rien
 * n'applique. Un réglage entre ici avec son validateur le jour où un écran le
 * lit — jamais avant. D'ici là, toute clé de `settings` est ignorée.
 */
export const REGLAGES_PROFIL: Readonly<Record<string, (v: unknown) => boolean>> = {};

/** Longueur maximale d'un libellé client : au-delà, la barre latérale casse. */
export const LIBELLE_MAX = 40;
