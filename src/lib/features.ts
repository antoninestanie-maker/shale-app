// ─────────────────────────────────────────────────────────────────────────────
// Frontière entre les deux offres — SOURCE UNIQUE.
//
//   shale        productivité : Aujourd'hui, Tâches, Timer, Objectifs, Notes,
//                Journal, Savoir, Finance, Performance, + sync multi-appareils
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

/**
 * ⭐ L'INTERRUPTEUR DU TRADING — le trading est MIS DE CÔTÉ depuis le 2026-09-30.
 *
 * Décision d'Antonin, au passage en pré-lancement : l'app commercialisée ne
 * porte pas de modules trading « pour l'instant ». Rien n'est supprimé — ni le
 * code, ni les tables, ni les trades déjà saisis (ils restent en base et se
 * synchronisent comme avant). Passer à `true` rallume tout, à l'identique.
 *
 * Éteint, le trading est ABSENT, pas verrouillé : aucun cadenas, aucun paywall,
 * aucun « Passer à Shale Trade » — on ne vend pas une offre qui n'existe plus.
 * Concrètement, `hasTrading` est faux pour tout le monde (essai et ancien
 * palier `shale_trade` compris), et `presenceModule` rend `absent` pour les
 * trois modules sur toutes les plateformes. Tout ce qui lit `hasTrading` ou
 * `afficheModule()` suit : barre latérale, garde de navigation, palette ⌘K,
 * widgets et panneaux, sections de Réglages, rappel de briefing, planificateur
 * de Market Brain, horloge des sessions de marché.
 *
 * ⚠️ Un nouvel endroit qui montre du trading doit lire `hasTrading` ou
 * `afficheModule()`, pas cette constante — sauf s'il n'a pas accès aux droits
 * (recherche, personnalisation, placeholder), et alors il la lit ici.
 */
export const TRADING_ACTIF = false;

/**
 * ⭐ L'INTERRUPTEUR DE FINANCE — Finance est MISE DE CÔTÉ depuis le 2026-10-01.
 *
 * Décision d'Antonin, en même temps que la barre latérale par intention : les
 * trois groupes du site (Décider quoi faire · Avancer et mesurer · Penser et
 * retenir) remplacent « Productivité », et Finance n'y a pas sa place. Même
 * mécanique que le trading : rien n'est supprimé — ni le code, ni les tables,
 * ni les comptes, factures et relevés déjà saisis. Passer à `true` rallume le
 * module, dans sa catégorie « Tenir les comptes » (`CATEGORIES`, Sidebar.tsx).
 *
 * Éteinte, Finance est ABSENTE, pas verrouillée : `presenceModule("finance")`
 * rend `absent` pour tout le monde, `afficheModule("finance")` est faux, la
 * palette ⌘K ne propose plus ses actions, et le calendrier ne montre plus les
 * échéances de factures.
 */
export const FINANCE_ACTIF = false;

/** Modules (onglets de la sidebar) qui vont et viennent avec `FINANCE_ACTIF`. */
export const FINANCE_VIEWS = ["finance"] as const;
const FINANCE_SET = new Set<string>(FINANCE_VIEWS);

/** Vrai si ce module fait partie de Finance. */
export const isFinanceView = (v: View | string): boolean => FINANCE_SET.has(v);

/** Modules (onglets de la sidebar) réservés à l'offre Shale Trade. */
export const TRADING_VIEWS = ["trading", "market", "sizing"] as const;

/** Widgets du dashboard « Aujourd'hui » réservés à Shale Trade. */
export const TRADING_WIDGETS = ["position"] as const;

/**
 * Panneaux redimensionnables noyés dans une vue productivité mais dont le
 * CONTENU est trading. Ils sont retirés de la grille, pas seulement masqués :
 * un panneau caché resterait dans les chips « + <titre> » sous la grille.
 *
 * `finance-trading` est la section « Trading → € » du module Finance : elle
 * traduit les R du journal en euros. Finance lui-même reste productivité — la
 * trésorerie personnelle n'est pas une fonction de trading, et verrouiller le
 * module entier priverait de runway quelqu'un qui ne trade pas.
 */
export const TRADING_PANELS = ["perf-trading", "finance-trading"] as const;

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

/** Widgets du tableau de bord qui n'existent qu'avec l'IA (Shale Pro). */
const WIDGETS_IA: ReadonlySet<string> = new Set(["brief-ia"]);

/** Vrai si ce widget du dashboard n'existe qu'avec l'IA. */
export const isIaWidget = (id: string): boolean => WIDGETS_IA.has(id);

/**
 * Ce widget doit-il figurer dans la liste de Personnaliser ?
 *
 * Un widget que le compte ne peut pas afficher n'est pas listé du tout. Le
 * widget du brief s'appelle « Brief du jour (IA, Shale Pro) » : le lister à
 * qui n'a pas l'IA affichait un NOM D'OFFRE — sur iPhone, où l'app ne doit
 * rien vendre (`lib/boutique.ts`), c'était un motif de refus d'Apple.
 * Trouvé le 2026-10-06 en relisant l'app iPhone écran par écran.
 */
export function widgetListable(
  id: string,
  droits: { hasTrading: boolean; iaPossible: boolean },
): boolean {
  if (isTradingWidget(id)) return droits.hasTrading;
  if (isIaWidget(id)) return droits.iaPossible;
  return true;
}

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
