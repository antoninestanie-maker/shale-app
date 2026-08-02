// ─────────────────────────────────────────────────────────────────────────────
// Frontière entre les deux offres — SOURCE UNIQUE.
//
//   shale        productivité : Aujourd'hui, Tâches, Timer, Objectifs, Notes,
//                Journal, Savoir, Benchmark, Performance, + sync multi-appareils
//   shale_trade  tout Shale + les modules trading listés ci-dessous
//
// ⚠️ Toute la logique de gating (sidebar, garde de navigation, palette ⌘K,
// widgets du dashboard, sections de Réglages) lit CE fichier. Ne jamais tester
// `view === "market"` ailleurs dans le code : ajouter un module trading doit
// se faire ici, et nulle part ailleurs.
//
// Le droit lui-même (« cet utilisateur a-t-il le trading ? ») ne se décide PAS
// ici : voir `lib/entitlements.ts`, et la colonne `has_trading` de la vue
// `my_subscription` qui en est la source de vérité serveur.
// ─────────────────────────────────────────────────────────────────────────────
import type { View } from "../components/Sidebar";

/** Modules (onglets de la sidebar) réservés à l'offre Shale Trade. */
export const TRADING_VIEWS = ["trading", "market", "sizing"] as const;

/**
 * Widgets du dashboard « Aujourd'hui » réservés à Shale Trade.
 * `presession` (test de réaction pré-session) reste ouvert : c'est un test de
 * réflexes, disponible aussi dans le module Benchmark, qui est productivité.
 */
export const TRADING_WIDGETS = ["position"] as const;

/**
 * Panneaux redimensionnables noyés dans une vue productivité mais dont le
 * CONTENU est trading. Ils sont retirés de la grille, pas seulement masqués :
 * un panneau caché resterait dans les chips « + <titre> » sous la grille.
 */
export const TRADING_PANELS = ["perf-trading"] as const;

/** Catégorie de la sidebar qui porte les modules trading. */
export const TRADING_CATEGORY = "trading";

/** Catégorie du registre d'actions (palette ⌘K) réservée à Shale Trade. */
export const TRADING_ACTION_CATEGORY = "trading";

const VIEW_SET = new Set<string>(TRADING_VIEWS);
const WIDGET_SET = new Set<string>(TRADING_WIDGETS);
const PANEL_SET = new Set<string>(TRADING_PANELS);

/** Vrai si ce module est réservé à Shale Trade. */
export const isTradingView = (v: View | string): boolean => VIEW_SET.has(v);

/** Vrai si ce widget du dashboard est réservé à Shale Trade. */
export const isTradingWidget = (id: string): boolean => WIDGET_SET.has(id);

/** Vrai si ce panneau de grille est réservé à Shale Trade. */
export const isTradingPanel = (id: string): boolean => PANEL_SET.has(id);

/**
 * Argumentaire du paywall. Un item = une ligne de la modale d'upgrade.
 * En FRANÇAIS (convention i18n du projet : la clé de traduction EST la phrase
 * française) et traduit à l'affichage — jamais via `t()` ici, ce fichier est
 * évalué à l'import et figerait la langue de démarrage.
 */
export const TRADING_PITCH: { title: string; body: string }[] = [
  {
    title: "Market Brain",
    body: "Un briefing cross-asset généré deux fois par jour : biais, scénario, niveaux clés et zones no-trade, avant Londres et avant New York.",
  },
  {
    title: "Tracker live",
    body: "Les positions ouvertes suivies en direct, avec leur R:R, leurs partielles et leur durée. Un clic pour dénouer, le journal se remplit tout seul.",
  },
  {
    title: "Journal de trades en R",
    body: "Winrate, profit factor, drawdown maximal et performance par setup — raisonnés en R, jamais en euros.",
  },
  {
    title: "Calculateur de position",
    body: "Taille de lot, risque et R:R théorique en une saisie, envoyés directement au tracker.",
  },
  {
    title: "Performance trading",
    body: "La courbe de R cumulé et le comparatif mensuel, à côté de tes courbes de discipline.",
  },
];
