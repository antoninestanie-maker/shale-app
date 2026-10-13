import { IS_IOS, kbd } from "../lib/platform";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { zoomFactor, type UiConfig } from "../lib/uiConfig";
import {
  CLE_BARRE,
  CLE_CATEGORIES,
  LARGEUR_DEFAUT,
  LARGEUR_MAX,
  LARGEUR_MIN,
  LARGEUR_RAIL,
  PART_MAX,
  SEUIL_ETROIT,
  auGlisser,
  auLacher,
  basculer,
  bornerLargeur,
  largeurRendue,
  estReduite,
  lireCategories,
  lirePref,
  memesCategories,
  regimeDe,
  type PrefBarre,
  type Regime,
} from "../lib/barre";
import { defilerVers, mouvementReduit } from "../lib/defilement";
import { getSetting, setSetting } from "../lib/repo";
import { COMMERCE_AUTORISE, presenceModule } from "../lib/boutique";
import { libelleProfil, type ProfilEffectif } from "../lib/licence/resoudre";
import Clock from "./Clock";
import NotificationBell from "./NotificationBell";
import SessionIndicator from "./SessionIndicator";
import SyncIndicator from "./SyncIndicator";
import { IconBarre, IconLock, IconSliders, IconTrash } from "./icons";

import { getLang, t } from "../lib/i18n";
export type View =
  | "today"
  | "tasks"
  | "calendar"
  | "timer"
  | "goals"
  | "performance"
  | "finance"
  | "notes"
  | "journal"
  | "knowledge"
  | "trading"
  | "market"
  | "sizing"
  | "console"
  | "admin"
  | "settings"
  // Vue « Supprimés récemment » (corbeille, migration 027). Une VUE, pas un
  // module : elle vit dans `ITEMS_PIED`, et le compte de treize modules reste
  // intact (décision de l'arrêt 1 du chantier « menus contextuels »).
  | "corbeille";

interface Props {
  view: View;
  onNavigate: (view: View) => void;
  demoMode: boolean;
  isAdmin?: boolean;
  badges?: Partial<Record<View, boolean>>;
  config: UiConfig;
  /**
   * Profil de licence résolu. `config` arrive DÉJÀ borné par lui (modules,
   * ordre, libellés, marque — cf. `configAffichee` dans `App.tsx`) ; il ne sert
   * ici qu'aux deux libellés que `config` ne porte pas : les catégories, et le
   * nom canonique de la bulle.
   */
  profil?: ProfilEffectif;
  /** Offre Shale Trade (ou essai en cours). Faux ⇒ modules trading verrouillés. */
  hasTrading?: boolean;
  /**
   * Afficher la pastille des sessions de marché (Sydney, Tokyo, Londres, New
   * York) au pied de la barre. C'est du contenu Market Brain : `App.tsx` passe
   * `afficheModule("market")`. Faux depuis que le trading est mis de côté
   * (2026-09-30) — avant, elle s'affichait pour tout le monde, offre Trade ou non.
   */
  sessionsMarche?: boolean;
  /** Clic sur un module verrouillé — ouvre le paywall. */
  onLocked?: (view: View) => void;
}

// ⚠️ EXPORTÉ : `MobileNav.tsx` consomme exactement cette liste. C'est
// délibéré — un second tableau de modules pour le mobile serait la porte
// par laquelle la divergence entre plateformes reviendrait.
export const ITEMS: { id: View; label: string; icon: ReactNode }[] = [
  {
    id: "today",
    label: "Aujourd'hui",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    ),
  },
  {
    id: "tasks",
    label: "Tâches",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="m8.5 12 2.5 2.5 5-5" />
      </svg>
    ),
  },
  {
    id: "calendar",
    label: "Calendrier",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    id: "timer",
    label: "Timer",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5M9 2h6" />
      </svg>
    ),
  },
  {
    id: "goals",
    label: "Objectifs",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </svg>
    ),
  },
  {
    id: "performance",
    label: "Performance",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
  {
    id: "finance",
    label: "Finance",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9V7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5V9" />
        <rect x="3" y="9" width="18" height="10" rx="2.5" />
        <circle cx="16" cy="14" r="1.2" />
      </svg>
    ),
  },
  {
    id: "notes",
    label: "Notes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-5Z" />
        <path d="M9 13h6M9 17h4" />
      </svg>
    ),
  },
  {
    id: "journal",
    label: "Journal",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5v15Z" />
        <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
      </svg>
    ),
  },
  {
    id: "knowledge",
    label: "Savoir",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
        <path d="M19 18v3H6.5A2.5 2.5 0 0 1 4 18.5" />
        <path d="M9 7.5h6M9 11h4" />
      </svg>
    ),
  },
  {
    id: "trading",
    label: "Trading",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6v12M8 8H5v6h3M16 4v16M16 7h-3v8h3" />
      </svg>
    ),
  },
  {
    id: "market",
    label: "Market-Brain",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="m7 14 3-4 3 3 4-6" />
        <circle cx="7" cy="14" r="1" />
        <circle cx="20" cy="7" r="1" />
      </svg>
    ),
  },
  {
    id: "sizing",
    label: "Position",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 7h8M8 11h8M8 15h4" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Réglages",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

/**
 * Aide contextuelle des modules (info-bulle au survol de l'onglet).
 * Le libellé de la bulle reste le nom CANONIQUE du module : l'utilisateur peut
 * renommer l'onglet dans « Personnaliser », la bulle rappelle alors à quoi il
 * correspond, et la 2ᵉ ligne dit ce qu'on y fait.
 */
const DESCRIPTIONS: Record<View, string> = {
  today: "Tableau de bord du jour : tâches, discipline, habitudes, performance.",
  tasks: "Créer, taguer et planifier les tâches récurrentes ou ponctuelles.",
  calendar:
    "Mois, semaine, jour : événements, tâches datées et échéances, au même endroit.",
  timer: "Minuteur Pomodoro pour tes sessions de concentration.",
  goals: "Objectifs court / moyen / long terme, regroupés par catégorie.",
  performance: "Courbes de progression : régularité, focus, objectifs.",
  finance: "Trésorerie : runway, patrimoine net, burn mensuel.",
  notes: "Notes riches liées entre elles, recherche plein texte.",
  journal: "Ce qui s'est passé dans la journée, et les habitudes à tenir.",
  knowledge: "Base de connaissances : notes, images, croquis et liens par thème.",
  trading: "Journal de trades en R, statistiques et tracker de positions live.",
  market: "Briefing marchés généré 2×/jour : biais, niveaux, zones no-trade.",
  sizing: "Calculateur de taille de position et de risque, envoi au tracker.",
  console: "Console d'administration : utilisateurs, abonnements, métriques.",
  admin: "Réorganiser les onglets et les widgets, densité, identité.",
  settings: "Compte, langue, apparence, notifications, sauvegarde.",
  corbeille: "Ce que tu as supprimé ces 30 derniers jours, prêt à revenir.",
};

/** Libellés par défaut des modules (utilisés par la page Personnaliser). */
export const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  ITEMS.map((it) => [it.id, it.label]),
);

export const BY_ID = new Map(ITEMS.map((it) => [it.id, it]));

/**
 * Le PIED de la barre — Admin, Personnaliser, Réglages.
 *
 * ⚠️ Cette table existe parce que son absence a produit un bogue visible :
 * ces trois entrées portaient leur libellé et leur icône AU POINT D'APPEL de
 * `navButton`, donc nulle part où un autre composant puisse les lire.
 * `MobileNav`, qui interroge `BY_ID`, n'y trouvait rien et affichait
 * l'identifiant technique BRUT — « admin » au lieu de « Personnaliser », sans
 * icône. Vu à l'écran sur iPhone le 2026-08-27.
 *
 * ⚠️ Elles ne sont pas dans `ITEMS` et ne doivent pas y entrer : `ITEMS` est
 * la liste des MODULES, celle qui fait autorité sur leur NOMBRE — treize depuis
 * l'arrivée du Calendrier le 2026-09-02. Y ajouter trois entrées ferait
 * mentir ce compte partout à la fois.
 *
 * `adminSeul` reproduit la règle de la barre latérale : la Console est
 * réservée aux administrateurs, Personnaliser et Réglages sont pour tout le
 * monde. Le téléphone en avait fait l'inverse — Personnaliser gaté sur
 * `isAdmin`, Console absente.
 */
export const ITEMS_PIED: {
  id: View;
  label: string;
  icon: ReactNode;
  adminSeul?: boolean;
}[] = [
  {
    id: "console",
    label: "Admin",
    adminSeul: true,
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  { id: "admin", label: "Personnaliser", icon: <IconSliders className="h-full w-full" /> },
  { id: "settings", label: "Réglages", icon: BY_ID.get("settings")!.icon },
  // ⭐ Quatrième entrée du pied, sous Réglages : c'est là que macOS range sa
  // propre corbeille, en bas du Dock. Pas dans `ITEMS`, qui fait autorité sur
  // le NOMBRE de modules — voir l'en-tête de cette table.
  { id: "corbeille", label: "Supprimés récemment", icon: <IconTrash className="h-full w-full" /> },
];

/**
 * Catégories de la sidebar. « Aujourd'hui » reste hors catégorie (accueil) ;
 * Personnaliser/Réglages restent épinglés en bas (rôle « Système »).
 * L'ordre/visibilité DANS chaque catégorie suit la page Personnaliser.
 *
 * ⭐ Depuis le 2026-10-01, la barre est GROUPÉE PAR INTENTION, comme le site
 * (`vitrine/src/views/refonte/Modules.astro`) : « Productivité » (neuf modules
 * en vrac) est remplacée par les trois groupes du site, dans le même ordre.
 * Antonin : « j'aime bien le groupé par intention, et ce serait bien que ce
 * soit vrai dans l'app aussi ». Les libellés sont surchargeables par un profil
 * de licence (`licence/catalogue.ts`, `CLES_LIBELLES_PROFIL`).
 *
 * « Tenir les comptes » ne porte que Finance, mise de côté (`FINANCE_ACTIF`) :
 * sans membre visible, la catégorie ne se dessine pas ; rallumer Finance la
 * fait réapparaître à sa place, après « Penser et retenir ».
 */
export const CATEGORIES: { id: string; label: string; members: View[] }[] = [
  { id: "decider", label: "Décider quoi faire", members: ["tasks", "calendar"] },
  { id: "avancer", label: "Avancer et mesurer", members: ["timer", "goals", "performance"] },
  { id: "penser", label: "Penser et retenir", members: ["notes", "journal", "knowledge"] },
  { id: "comptes", label: "Tenir les comptes", members: ["finance"] },
  {
    id: "trading",
    label: "Trading",
    members: ["trading", "market", "sizing"],
  },
];

export const CATEGORY_OF: Partial<Record<View, string>> = Object.fromEntries(
  CATEGORIES.flatMap((c) => c.members.map((m) => [m, c.id])),
);

const COLLAPSE_KEY = "sidebar.collapsed";

/** La palette ⌘K demande à réduire ou étendre la barre par cet événement. */
export const EVT_BARRE = "sb:barre-basculer";

/**
 * Le bord de la barre vient d'être lâché : ce qui s'était mis en veille pendant
 * le glissement (`<html data-barre-glisse>`) se remesure UNE fois.
 * ⚠️ `ResizableGrid` recopie ce nom plutôt que de l'importer : la grille n'a pas
 * à dépendre de la barre. `barre.source.test.ts` tient les deux d'accord.
 */
export const EVT_BARRE_LACHEE = "sb:barre-lachee";

/** Le temps laissé aux libellés pour s'effacer avant que la barre ne se réduise
    (= `--dur-fast`). */
const FONDU_MS = 120;

/** Sous cette hauteur (pixels locaux), le pied de la barre se déleste. */
const HAUTEUR_BASSE = 720;

/** Le stockage local peut lever (quota, navigation privée) : jamais bloquant. */
function lireLocal(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}
function ecrireLocal(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* sans conséquence : le choix vaudra pour cette session */
  }
}

export default function Sidebar({
  view,
  onNavigate,
  demoMode,
  isAdmin,
  badges,
  config,
  profil,
  hasTrading = true,
  sessionsMarche = false,
  onLocked,
}: Props) {
  /** Libellé d'une clé i18n : celui du profil de licence s'il en impose un. */
  const libelle = (cle: string) => (profil && libelleProfil(profil, cle, getLang())) || t(cle);
  /**
   * Verrouillé = module trading sur une offre qui ne l'inclut pas — cadenas et
   * paywall, sur macOS. Sur iOS (iPad : c'est cette barre-ci qu'il reçoit), le
   * même module est ABSENT : un cadenas y serait une incitation à acheter
   * (`lib/boutique.ts`, règle 3.1.3(f)).
   */
  const isLocked = (id: View) => presenceModule(id, hasTrading) === "verrouille";
  const existe = (id: View) => presenceModule(id, hasTrading) !== "absent";

  // ── Réduite (icônes) ou étendue (libellés) ───────────────────────────────
  // La règle est dans `lib/barre.ts` : un choix par régime de largeur, lu en
  // `localStorage` au premier rendu. Ici, seulement la mesure et le mouvement.
  const asideRef = useRef<HTMLElement>(null);
  const [pref, setPref] = useState<PrefBarre>(() => lirePref(lireLocal(CLE_BARRE)));
  const [regime, setRegime] = useState<Regime>(() =>
    // Avant le montage il n'y a pas de racine à mesurer : la fenêtre, densité
    // déduite. L'observateur ci-dessous prend le relais dès le premier rendu.
    regimeDe(typeof window === "undefined" ? SEUIL_ETROIT : window.innerWidth / zoomFactor()),
  );
  const reduite = estReduite(pref, regime);
  /** Fenêtre BASSE (pixels locaux, comme le régime). Le pied de la barre pèse
      ~330 px — cinq lignes, l'horloge, la synchro : dans une fenêtre de 640 px à
      110 %, il ne restait que 70 px à la liste des modules (vu à l'écran le
      2026-10-11). On rend alors l'horloge et « systèmes actifs », qui ne
      disent rien que macOS ne dise déjà. */
  const [basse, setBasse] = useState(
    () => typeof window !== "undefined" && window.innerHeight / zoomFactor() < HAUTEUR_BASSE,
  );
  /** Largeur locale de la fenêtre, arrondie à 16 px : elle ne sert qu'au
      plafond de la barre (45 %), et un état exact au pixel redessinerait la
      barre à chaque image d'un redimensionnement de fenêtre. */
  const [fenetreL, setFenetreL] = useState(() =>
    typeof window === "undefined" ? 1440 : Math.floor(window.innerWidth / zoomFactor() / 16) * 16,
  );
  /** Largeur étendue RENDUE : le choix, ramené sous le plafond du moment. */
  const largeur = bornerLargeur(pref.largeur, fenetreL);
  /** Le bord est en train d'être tiré. */
  const [glisse, setGlisse] = useState(false);
  /**
   * La largeur EN COURS de glissement, hors de l'état React (2026-10-12).
   * Pendant qu'on tire, la largeur est écrite directement dans `--barre-w` sur
   * la barre, une fois par image : repasser par l'état redessinerait toute la
   * barre soixante fois par seconde. Un rendu qui tomberait au milieu du geste
   * (la cloche, un badge) relit cette valeur au lieu de remettre l'ancienne.
   */
  const vive = useRef<number | null>(null);
  /** Ce que la barre mesure à cet instant : le rail, la largeur choisie, ou
      celle qu'on est en train de lui donner. */
  const largeurAffichee = vive.current ?? (reduite ? LARGEUR_RAIL : largeur);
  /** Le mouvement en cours, posé par le BOUTON seulement — jamais par un
      redimensionnement de fenêtre ni par le montage (rien ne doit glisser tout
      seul). Le CSS (`.barre[data-mouvement]`) en fait le fondu et le volet. */
  const [mouvement, setMouvement] = useState<"ouvrir" | "fermer" | null>(null);
  const minuterie = useRef<number | undefined>(undefined);
  const courant = useRef({ pref, regime, reduite });
  courant.current = { pref, regime, reduite };

  useEffect(() => {
    // ⚠️ La largeur LOCALE de la racine, pas `innerWidth` : sous une densité de
    // 120 %, une fenêtre de 1100 px n'offre que 917 px. Et un observateur, pas
    // `resize` : changer la densité dans Personnaliser ne redimensionne pas la
    // fenêtre, mais change bien cette largeur-là.
    const racine = asideRef.current?.parentElement;
    if (!racine || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entrees) => {
      const boite = entrees[0]?.contentRect;
      if (!boite?.width) return;
      setRegime(regimeDe(boite.width));
      setBasse(boite.height < HAUTEUR_BASSE);
      setFenetreL(Math.floor(boite.width / 16) * 16);
    });
    ro.observe(racine);
    return () => ro.disconnect();
  }, []);

  const basculerBarre = useCallback(() => {
    const { pref: avant, regime: ici, reduite: etaitReduite } = courant.current;
    const suivant = basculer(avant, ici);
    ecrireLocal(CLE_BARRE, JSON.stringify(suivant));
    window.clearTimeout(minuterie.current);
    // Le mouvement est retiré par un minuteur, pas par `animationend` : une
    // animation coupée (mouvement réduit, onglet caché) n'émet rien (PIEGES § 11.4).
    const ranger = () => {
      minuterie.current = window.setTimeout(() => setMouvement(null), 450);
    };
    if (mouvementReduit()) {
      setMouvement(null);
      setPref(suivant);
    } else if (etaitReduite) {
      // Étendre : la largeur change d'un coup, le volet et les libellés suivent.
      setMouvement("ouvrir");
      setPref(suivant);
      ranger();
    } else {
      // Réduire : les libellés s'effacent D'ABORD, la largeur change ensuite —
      // sinon ils disparaîtraient net, coupés par le bord qui se referme.
      setMouvement("fermer");
      minuterie.current = window.setTimeout(() => {
        setPref(suivant);
        ranger();
      }, FONDU_MS);
    }
  }, []);

  // ── Tirer le bord ────────────────────────────────────────────────────────
  // ⭐ La largeur se règle en glissant le bord droit, EN CONTINU jusqu'au rail
  // d'icônes : les libellés se coupent en s'estompant (`.barre-coupe`), et seul
  // un aimant de quelques pixels sépare la plus petite largeur du rail. La
  // règle est dans `lib/barre.ts` (`auGlisser`, `auLacher`).
  //
  // ⚠️ FLUIDITÉ (2026-10-12, « pas très fluide à la souris »). Mesuré processeur
  // ralenti ×4 : 47 ms par image en médiane, 178 ms au pire dixième. Deux
  // causes, deux parades :
  //   • la barre repassait par l'état React à chaque image → la largeur est
  //     écrite dans `--barre-w` directement sur l'élément ; l'état n'est posé
  //     qu'au lâcher. Toute la mise en page de la barre dépend de cette seule
  //     variable (aucun rendu conditionnel pendant le geste).
  //   • la grille d'Aujourd'hui remesurait ses onze panneaux à chaque pixel →
  //     `<html data-barre-glisse>` la met en veille le temps du geste
  //     (`ResizableGrid`), et `EVT_BARRE_LACHEE` la réveille une fois. Entre
  //     les deux, ses colonnes suivent quand même : c'est du CSS.
  const debutGlisser = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const aside = asideRef.current;
    const racine = aside?.parentElement;
    if (!aside || !racine) return;
    e.preventDefault();
    window.clearTimeout(minuterie.current);
    setMouvement(null);
    // Pixels ÉCRAN → LOCAUX (PIEGES § 35.3) : `clientX` et les rectangles sont
    // à l'écran, la largeur s'écrit en local.
    const z = zoomFactor();
    const boite = aside.getBoundingClientRect();
    const fenetre = racine.clientWidth;
    const { pref: prefDepart, regime: ici } = courant.current;
    // La largeur étendue d'avant le geste : c'est elle que « Étendre » rendra
    // si le bord finit au rail.
    const largeurAvant = prefDepart.largeur;
    // L'écart entre le curseur et le bord au moment de la prise : sans lui, le
    // bord sauterait sous le curseur au premier mouvement.
    const prise = e.clientX - boite.right;
    const depart = e.clientX;
    let dernierX = depart;
    let image = 0;
    let bouge = false;
    let derniere = prefDepart;
    const appliquer = () => {
      image = 0;
      const x = (dernierX - prise - boite.left) / z;
      derniere = auGlisser(derniere, ici, x, fenetre);
      const l = largeurRendue(derniere, ici, fenetre);
      if (vive.current === l) return;
      vive.current = l;
      aside.style.setProperty("--barre-w", `${l}px`);
      aside.style.setProperty("--barre-n", String(l));
    };
    const surMouvement = (ev: PointerEvent) => {
      // Trois pixels de jeu : un clic sur le bord n'est pas un glissement.
      if (!bouge && Math.abs(ev.clientX - depart) < 3) return;
      if (!bouge) {
        bouge = true;
        vive.current = largeurRendue(prefDepart, ici, fenetre);
        setGlisse(true);
        document.documentElement.setAttribute("data-barre-glisse", "");
        document.body.style.userSelect = "none";
        document.body.style.cursor = "col-resize";
      }
      dernierX = ev.clientX;
      if (!image) image = requestAnimationFrame(appliquer);
    };
    const fin = () => {
      window.removeEventListener("pointermove", surMouvement);
      window.removeEventListener("pointerup", fin);
      window.removeEventListener("pointercancel", fin);
      if (image) cancelAnimationFrame(image);
      if (!bouge) return;
      appliquer();
      const finale = auLacher(derniere, ici, largeurAvant);
      vive.current = null;
      setPref(finale);
      setGlisse(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      // Écrit UNE fois, au lâcher : pas à chaque pixel.
      ecrireLocal(CLE_BARRE, JSON.stringify(finale));
      // La grille se réveille après le rendu qui pose l'état final.
      document.documentElement.removeAttribute("data-barre-glisse");
      requestAnimationFrame(() => window.dispatchEvent(new Event(EVT_BARRE_LACHEE)));
    };
    window.addEventListener("pointermove", surMouvement);
    window.addEventListener("pointerup", fin);
    window.addEventListener("pointercancel", fin);
  }, []);

  /** Le bord au clavier (← →), et le retour à la largeur d'origine (Entrée, double-clic). */
  const poserLargeur = useCallback((x: number) => {
    const { pref: avant, regime: ici } = courant.current;
    const racine = asideRef.current?.parentElement;
    const suivante = auGlisser(avant, ici, x, racine?.clientWidth);
    if (suivante === avant) return;
    window.clearTimeout(minuterie.current);
    setMouvement(null);
    setPref(suivante);
    ecrireLocal(CLE_BARRE, JSON.stringify(suivante));
  }, []);

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      // ⌥⌘S — le raccourci de Finder et de Notes. `e.code` et non `e.key` : sur
      // Mac, ⌥S tape « Ò ».
      if (e.code !== "KeyS" || !e.altKey || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.repeat) return;
      // Windows : AltGr se lit Ctrl+Alt. Ne pas voler une frappe.
      if (e.getModifierState?.("AltGraph")) return;
      // Un éditeur plein écran (carte, croquis) rend l'app inerte : la barre
      // n'est pas à lui.
      if (document.getElementById("root")?.hasAttribute("inert")) return;
      e.preventDefault();
      basculerBarre();
    };
    window.addEventListener("keydown", surTouche);
    window.addEventListener(EVT_BARRE, basculerBarre);
    return () => {
      window.removeEventListener("keydown", surTouche);
      window.removeEventListener(EVT_BARRE, basculerBarre);
      window.clearTimeout(minuterie.current);
    };
  }, [basculerBarre]);

  // — État replié/déplié des catégories (persisté) —
  // Défaut au premier lancement : seule la catégorie de la vue active est ouverte
  // (à défaut, la première).
  // ⚠️ L'état initial vient d'un MIROIR local (2026-10-11). Avant, il valait
  // `null` le temps de lire la base : toutes les catégories s'ouvraient, puis se
  // refermaient en 240 ms — à chaque remontage, donc à chaque changement de
  // langue. La base (`sidebar.collapsed`) reste la source ; le miroir ne sert
  // qu'au premier rendu.
  const [collapsed, setCollapsed] = useState<Record<string, boolean> | null>(() =>
    lireCategories(lireLocal(CLE_CATEGORIES)),
  );
  const loadedRef = useRef(false);
  const retenir = (etat: Record<string, boolean>) => {
    const brut = JSON.stringify(etat);
    ecrireLocal(CLE_CATEGORIES, brut);
    setSetting(COLLAPSE_KEY, brut).catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    getSetting(COLLAPSE_KEY)
      .then((raw) => {
        if (!alive || loadedRef.current) return;
        loadedRef.current = true;
        if (raw) {
          const lu = lireCategories(raw);
          if (lu) {
            ecrireLocal(CLE_CATEGORIES, raw);
            setCollapsed((prev) => (memesCategories(prev, lu) ? prev : lu));
            return;
          }
        }
        setCollapsed((prev) => {
          if (prev) return prev;
          const active = CATEGORY_OF[view] ?? CATEGORIES[0].id;
          return Object.fromEntries(CATEGORIES.map((c) => [c.id, c.id !== active]));
        });
      })
      .catch(() => {
        if (alive && !loadedRef.current) {
          loadedRef.current = true;
          setCollapsed((prev) => prev ?? {});
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La catégorie de la vue active s'ouvre toujours (sans fermer les autres).
  useEffect(() => {
    const cat = CATEGORY_OF[view];
    if (!cat) return;
    setCollapsed((prev) => {
      if (!prev || !prev[cat]) return prev;
      const next = { ...prev, [cat]: false };
      retenir(next);
      return next;
    });
  }, [view]);

  // ── La liste qui défile ──────────────────────────────────────────────────
  // Deux sentinelles disent s'il reste du contenu caché en haut ou en bas : un
  // filet apparaît sous « Aujourd'hui », un fondu au pied de la liste. Pas
  // d'écouteur de défilement — l'observateur ne se réveille qu'aux changements.
  const listeRef = useRef<HTMLDivElement>(null);
  const hautRef = useRef<HTMLDivElement>(null);
  const basRef = useRef<HTMLDivElement>(null);
  const [cache, setCache] = useState({ haut: false, bas: false });

  useEffect(() => {
    const liste = listeRef.current;
    if (!liste || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entrees) =>
        setCache((avant) => {
          let apres = avant;
          for (const e of entrees) {
            const cote = e.target === hautRef.current ? "haut" : "bas";
            if (apres[cote] === e.isIntersecting) apres = { ...apres, [cote]: !e.isIntersecting };
          }
          return apres;
        }),
      { root: liste },
    );
    if (hautRef.current) io.observe(hautRef.current);
    if (basRef.current) io.observe(basRef.current);
    return () => io.disconnect();
  }, []);

  const toggleCategory = (catId: string, bouton: HTMLElement) => {
    const bloc = bouton.closest<HTMLElement>("[data-cat]");
    const liste = listeRef.current;
    const etaitRepliee = (collapsed ?? {})[catId] ?? false;
    const next = { ...(collapsed ?? {}), [catId]: !etaitRepliee };
    // ⚠️ Replier une catégorie dont le titre est COLLÉ en haut : sans ce
    // recalage, la liste garde son défilement, le titre remonte hors champ avec
    // son contenu, et l'on se retrouve au milieu de la catégorie suivante sans
    // avoir vu la sienne se fermer.
    if (!etaitRepliee && bloc && liste && bloc.offsetTop < liste.scrollTop) liste.scrollTop = bloc.offsetTop;
    setCollapsed(next);
    retenir(next);
    if (etaitRepliee && bloc) {
      // À l'ouverture : amène la catégorie dépliée dans la zone visible.
      window.setTimeout(() => defilerVers(bloc.querySelector("[data-cat-corps]")), 260); // après le dépliage
    }
  };

  const navButton = (
    id: View,
    label: string,
    icon: ReactNode,
  ) => {
    // ⚠️ `aria-label` sur le BOUTON, et pas seulement `title` sur le libellé :
    // réduite, la barre ne rend plus le libellé, donc le bouton ne contient
    // plus qu'une icône. Mesuré le 2026-08-28 à 720 px — `innerText` vide,
    // `aria-label` nul : les quatorze items de navigation n'avaient alors
    // AUCUN nom accessible.
    const locked = isLocked(id);
    const active = view === id && !locked;
    const canonical = BY_ID.get(id) ? libelle(BY_ID.get(id)!.label) : t(label);
    return (
      <button
        key={id}
        type="button"
        // Verrouillé : le bouton reste CLIQUABLE (jamais `disabled`) — il ouvre
        // le paywall. Un bouton désactivé ne reçoit pas non plus les événements
        // de survol, donc perdrait l'info-bulle qui explique le cadenas.
        onClick={() => (locked ? onLocked?.(id) : onNavigate(id))}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        data-tip={canonical}
        data-tip-sub={locked ? t("Inclus dans Shale Trade") : t(DESCRIPTIONS[id])}
        data-tip-side="right"
        // ⚠️ UNE SEULE mise en page, du rail à 400 px (2026-10-12). Le bouton
        // s'étire sur la largeur de la barre ; au rail il fait 41 px
        // (12 + icône 17 + 12) parce que le libellé, lui, est tombé à zéro.
        // L'icône ne bouge jamais, et l'info-bulle se place à droite du bouton
        // (`Tooltip.tsx`), donc à côté du rail.
        className={`group/nav relative flex shrink-0 items-center gap-3 rounded-[var(--radius-field)] px-3 py-2 text-[13px] font-medium transition-colors duration-150 ${
          locked
            ? "text-text-dim/55 hover:bg-overlay hover:text-text-dim"
            : active
              ? // V7 : fond bleu 18 % + liseré intérieur 55 %. Pas de halo.
                "bg-[color-mix(in_srgb,var(--color-blue)_18%,transparent)] text-text shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-blue)_55%,transparent)]"
              : "text-text-dim hover:bg-overlay hover:text-text"
        }`}
      >
        {/* Repère d'onglet actif : petit bâton d'accent à gauche (macOS/Linear) */}
        <span
          aria-hidden
          className={`pill absolute inset-y-0 left-0 my-auto h-4 w-[3px] bg-blue transition-all duration-200 ${
            active ? "opacity-100" : "scale-y-0 opacity-0"
          }`}
        />
        <span
          className={`h-[17px] w-[17px] shrink-0 transition-colors ${
            locked ? "text-text-dim/45" : active ? "text-blue" : "text-text-dim/80"
          }`}
        >
          {icon}
        </span>
        {/* Le libellé prend la place qui reste et se COUPE EN S'ESTOMPANT quand
            elle manque (`.barre-coupe`) — un nom long de Personnaliser, ou une
            barre qu'on a rétrécie. Toujours dans le DOM, à largeur nulle au rail. */}
        <span className="barre-texte barre-coupe min-w-0 flex-1 text-left" title={label}>
          {label}
        </span>
        {/* Réduit, cadenas et pastille se posent sur le coin de l'icône : en
            bout de ligne ils sortiraient du bouton. */}
        {locked ? (
          <IconLock
            className={
              reduite
                ? "absolute right-1 top-1 h-2.5 w-2.5 text-text-dim/45"
                : "ml-auto h-3.5 w-3.5 shrink-0 text-text-dim/45"
            }
          />
        ) : (
          badges?.[id] && (
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full bg-blue ${reduite ? "absolute right-1.5 top-1.5" : "ml-auto"}`}
            />
          )
        )}
      </button>
    );
  };

  /** `--barre-l` : la largeur ÉTENDUE (volet, images clés). `--barre-w` : la
      largeur du moment, dont toute la mise en page de la barre découle ;
      `--barre-n`, la même sans unité, pour les opacités calculées. */
  const voileCss = { "--barre-l": `${largeur}px` } as CSSProperties;
  const largeurCss = {
    ...voileCss,
    "--barre-w": `${largeurAffichee}px`,
    "--barre-n": largeurAffichee,
  } as CSSProperties;
  /** Jusqu'où le bord peut aller à cet instant (pour `aria-valuemax`). */
  const plafond = Math.max(LARGEUR_MIN, Math.min(LARGEUR_MAX, Math.floor(fenetreL * PART_MAX)));
  const visible = config.modules.filter((m) => m.visible && BY_ID.has(m.id) && existe(m.id));
  const uncategorized = visible.filter((m) => !CATEGORY_OF[m.id]);

  return (
    // ── Le matériau (2026-10-11) ────────────────────────────────────────────
    // La barre est OPAQUE (`.barre` → `--barre-bg`), plus en verre. Rien ne
    // défile derrière elle — elle est posée à côté du contenu, pas dessus —
    // donc le flou ne floutait rien, et un titre de catégorie collant a besoin
    // d'un fond plein pour que la liste passe dessous sans se lire à travers.
    //
    // ── Réduite en icônes ───────────────────────────────────────────────────
    // 232 px étendue par défaut — réglable EN CONTINU en tirant le bord, du rail
    // à 400 — et 66 px au rail (`--barre-l`, `--barre-rail`). Par défaut
    // la fenêtre décide (étroite → réduite) ; le bouton du pied et ⌥⌘S
    // retournent ce choix, retenu par régime (`lib/barre.ts`).
    //
    // Pourquoi le repli en ICÔNES et pas un tiroir superposé : les modules
    // restent accessibles en UN clic. Un tiroir en coûterait deux, sur une app
    // dont on change d'onglet en permanence.
    //
    // ⚠️ La largeur change D'UN COUP — jamais de `transition: width` : la zone
    // principale se redessinerait à chaque image, et la grille d'Aujourd'hui
    // remesure ses onze panneaux à chaque changement de largeur. Ce qui glisse,
    // ce sont des `translate` (le volet) et des opacités (les libellés).
    //
    // ⚠️ Au rail, le nom d'un module est rendu par `data-tip` (couche Tooltip)
    // et par l'`aria-label` du bouton : le libellé est à largeur nulle.
    <>
      <aside
        ref={asideRef}
        data-reduite={reduite ? "" : undefined}
        data-mouvement={mouvement ?? undefined}
        data-glisse={glisse ? "" : undefined}
        className="barre relative z-20 flex w-[var(--barre-w)] shrink-0 flex-col border-r border-border"
        style={{
          ...largeurCss,
          // iPad (2026-10-07) : le pied de la barre ne doit pas passer sous la
          // barre d'accueil d'iPadOS. Le haut est déjà dégagé par le `pt-10` du
          // bloc de marque, plus haut que l'heure système.
          ...(IS_IOS ? { paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)" } : null),
        }}
      >
        <div className="barre-corps flex min-h-0 flex-1 flex-col">
          {/* Zone de drag fenêtre (barre de titre overlay).
              `="deep"` (et non l'attribut nu) : avec l'attribut nu, Tauri ne
              déclenche le drag que sur un clic DIRECT sur l'élément porteur
              (`el === composedPath[0]` dans son `drag.js`) — le titre et le
              sous-titre, qui sont des enfants, n'étaient donc déjà pas des
              poignées. En mode `deep` tout le sous-arbre devient poignée,
              SAUF les éléments cliquables : un `<button>` sans attribut coupe
              court à la remontée. La cloche reste donc cliquable. */}
          {/* Le titre cède sa place à mesure que la barre rétrécit, en
              s'estompant ; au rail il ne reste que la cloche, centrée sur la
              colonne d'icônes (`--barre-marge` passe de 20 à 16 px). Pas de
              `gap` : c'est le fondu du titre qui l'écarte de la cloche, et au
              rail il n'y a pas un pixel à perdre. La zone de drag, elle, doit
              survivre — c'est la seule poignée de la fenêtre. */}
          <div
            data-tauri-drag-region="deep"
            className="flex shrink-0 items-start px-[var(--barre-marge)] pb-5 pt-10"
          >
            <div className="barre-texte barre-coupe min-w-0 flex-1">
              {/* Le titre se règle dans Personnaliser (ou vient d'un profil de
                  licence) : un nom long se coupe, il ne pousse pas la liste. */}
              <span
                className="block font-display text-[17px] font-bold tracking-tight text-text"
                title={config.brandTitle}
              >
                {config.brandTitle}
              </span>
              {config.brandSubtitle && <p className="hud-label mt-1">{config.brandSubtitle}</p>}
            </div>
            <NotificationBell onNavigate={onNavigate} />
          </div>

          <nav id="barre-modules" className="flex min-h-0 flex-1 flex-col">
            {/* ⭐ « Aujourd'hui » (et tout module hors catégorie) NE DÉFILE PAS :
                c'est l'accueil, le bouton auquel on revient. Avant, il partait
                avec la liste dès qu'elle défilait — c'est-à-dire dans la fenêtre
                par défaut, toutes catégories ouvertes. */}
            {uncategorized.length > 0 && (
              <div className="flex shrink-0 flex-col gap-0.5 px-3 pb-2">
                {uncategorized.map((m) => {
                  const item = BY_ID.get(m.id)!;
                  return navButton(m.id, m.label?.trim() || t(item.label), item.icon);
                })}
              </div>
            )}

            <div
              className={`relative flex min-h-0 flex-1 flex-col border-t transition-colors duration-200 ${
                cache.haut ? "border-border" : "border-transparent"
              }`}
            >
              <div
                ref={listeRef}
                // `relative` : c'est le repère des `offsetTop` lus par
                // `toggleCategory`. Pas de barre de défilement dessinée — dans
                // un rail de 64 px elle décalait les icônes de 10 px ; le fondu
                // du bas dit qu'il reste de la liste.
                className="no-scrollbar relative flex min-h-0 flex-1 scroll-pt-9 flex-col gap-0.5 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-3"
              >
                {CATEGORIES.map((cat) => {
                  const members = visible.filter((m) => CATEGORY_OF[m.id] === cat.id);
                  if (members.length === 0) return null;
                  const isOpen = !(collapsed?.[cat.id] ?? false);
                  // Catégorie entièrement verrouillée : pas de badge (il annoncerait
                  // une activité sur un module auquel l'utilisateur n'a pas accès).
                  const allLocked = members.every((m) => isLocked(m.id));
                  const hasBadge =
                    !isOpen && !allLocked && members.some((m) => !isLocked(m.id) && badges?.[m.id]);
                  return (
                    <div key={cat.id} data-cat={cat.id} className="mt-2 first:mt-0">
                      {/* ⭐ Le titre de la catégorie RESTE EN HAUT tant qu'on
                          défile dans ses modules, puis cède la place au suivant.
                          Fond plein et `z-10` : les boutons sont `relative`, sans
                          cela ils passeraient par-dessus. Réduit, le titre n'est
                          plus qu'un chevron : collé, il masquerait une icône
                          pour rien. */}
                      <div className={`barre-titre pt-1 ${reduite ? "" : "sticky top-0 z-10"}`}>
                        <button
                          type="button"
                          onClick={(e) => toggleCategory(cat.id, e.currentTarget)}
                          aria-expanded={isOpen}
                          // Même trou que les onglets : réduit, le bouton ne
                          // contient plus qu'un chevron.
                          aria-label={libelle(cat.label)}
                          data-tip={libelle(cat.label)}
                          data-tip-sub={
                            allLocked
                              ? t("Inclus dans Shale Trade")
                              : isOpen
                                ? t("Replier la catégorie")
                                : t("Déplier la catégorie")
                          }
                          data-tip-side="right"
                          className="group flex w-full items-center gap-1.5 rounded-[var(--radius-field)] px-3 py-1.5 text-left hover:bg-overlay"
                        >
                          {/* Le nom se coupe en s'estompant ; au rail il n'en reste
                              rien, il est dans `data-tip`, donc au survol. */}
                          <span
                            className={`barre-texte barre-coupe hud-label flex-1 transition-colors group-hover:text-text ${
                              allLocked ? "opacity-55" : ""
                            }`}
                          >
                            {libelle(cat.label)}
                          </span>
                          {allLocked && <IconLock className="h-3 w-3 text-text-dim/45" />}
                          {hasBadge && <span className="h-1.5 w-1.5 rounded-full bg-blue" />}
                          <svg
                            viewBox="0 0 12 12"
                            className="h-2.5 w-2.5 shrink-0 text-text-dim transition-transform duration-200"
                            style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M3 4.5 6 7.5 9 4.5" />
                          </svg>
                        </button>
                      </div>
                      <div
                        data-cat-corps
                        style={{
                          display: "grid",
                          gridTemplateRows: isOpen ? "1fr" : "0fr",
                          transition: "grid-template-rows 240ms var(--ease-spring)",
                        }}
                      >
                        <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                          {members.map((m) => {
                            const item = BY_ID.get(m.id)!;
                            return navButton(m.id, m.label?.trim() || t(item.label), item.icon);
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {/* Les deux sentinelles. Celle du haut est hors flux (elle ne doit
                    pas devenir le `:first-child` de la liste) ; celle du bas ferme
                    le contenu. */}
                <div ref={hautRef} aria-hidden className="pointer-events-none absolute left-0 top-0 h-px w-px" />
                <div ref={basRef} aria-hidden className="-mt-0.5 h-px shrink-0" />
              </div>
              <div aria-hidden className={`barre-fondu ${cache.bas ? "opacity-100" : "opacity-0"}`} />
            </div>
          </nav>

          <div className="shrink-0 border-t border-border pt-3">
            <nav className="flex flex-col gap-0.5 px-3">
              {ITEMS_PIED.filter((it) => (isAdmin || !it.adminSeul) && (COMMERCE_AUTORISE || it.id !== "console")).map((it) =>
                navButton(it.id, t(it.label), it.icon),
              )}
              {/* Réduire / étendre. Une LIGNE du pied, visible en permanence et
                  au doigt — pas une poignée au survol du bord (règle 17 : une
                  action qui n'existe qu'au survol n'existe pas). */}
              <button
                type="button"
                onClick={basculerBarre}
                aria-expanded={!reduite}
                aria-controls="barre-modules"
                aria-label={reduite ? t("Étendre la barre latérale") : t("Réduire la barre latérale")}
                data-tip={reduite ? t("Étendre la barre") : t("Réduire la barre")}
                data-tip-sub={reduite ? t("Affiche le nom des modules.") : t("Ne garde que les icônes.")}
                data-tip-kbd={kbd("⌥⌘S")}
                data-tip-side="right"
                className="cible-tactile-ligne relative flex shrink-0 items-center gap-3 rounded-[var(--radius-field)] px-3 py-2 text-[13px] font-medium text-text-dim transition-colors duration-150 hover:bg-overlay hover:text-text"
              >
                <span className="h-[17px] w-[17px] shrink-0 text-text-dim/80">
                  <IconBarre className="h-full w-full" />
                </span>
                <span className="barre-texte barre-coupe min-w-0 flex-1 text-left">{t("Réduire")}</span>
              </button>
            </nav>
          </div>

          {/* ⚠️ Le pied de barre porte des composants qui écrivent du TEXTE — horloge,
              session de marché, état de synchronisation. Dans une colonne de 64 px,
              l'horloge se cassait caractère par caractère (« 16 : 5 6 : 40 M… »).
              Ils reviennent avec les libellés. Ce qu'on perd est consultable d'un
              clic dans Réglages, et l'heure est celle du système — elle est déjà
              dans la barre de menus de macOS. */}
          {/* ⭐ Plus aucun rendu conditionnel par état (2026-10-12) : tout ce pied
              suit `--barre-w`. Les blocs de texte (`.barre-repli`) s'estompent
              puis se replient en hauteur à mesure que la barre rétrécit ; au
              rail il ne reste que la pastille de synchronisation, centrée. */}
          <div className="flex shrink-0 flex-col px-[var(--barre-marge)] pb-5 pt-4">
            {!basse && (
              <div className="barre-repli">
                <div className="barre-texte barre-coupe flex flex-col gap-3 pb-3">
                  <Clock />
                  {sessionsMarche && <SessionIndicator />}
                </div>
              </div>
            )}
            <SyncIndicator onOuvrirReglages={() => onNavigate("settings")} />
            {demoMode && (
              <div className="barre-repli">
                <div className="pt-3">
                  <span className="barre-texte pill inline-block w-fit whitespace-nowrap border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-text-dim">
                    {t("mode démo")}
                  </span>
                </div>
              </div>
            )}
            {!basse && (
              <div className="barre-repli">
                <div className="flex items-center gap-2 pt-3">
                  <span className="animate-pulse-dot h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  <span className="barre-texte barre-coupe hud-label flex-1">{t("systèmes actifs")}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* ⭐ Le bord qui se tire. Une bande de 9 px à cheval sur le filet droit
            (20 px au doigt), invisible au repos : un trait bleu au survol, au
            focus et pendant le glissement. `separator` focalisable : ← → au
            clavier, Entrée ou double-clic pour revenir à la largeur d'origine. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("Largeur de la barre latérale")}
          aria-valuenow={Math.round(largeurAffichee)}
          aria-valuemin={LARGEUR_RAIL}
          aria-valuemax={plafond}
          tabIndex={0}
          data-tip={t("Régler la largeur")}
          data-tip-sub={t("Glisser le bord · double-clic : largeur d’origine.")}
          data-tip-side="right"
          className="barre-poignee"
          onPointerDown={debutGlisser}
          onDoubleClick={() => poserLargeur(LARGEUR_DEFAUT)}
          onKeyDown={(e) => {
            const ici = largeurAffichee;
            if (e.key === "ArrowRight") poserLargeur(reduite ? LARGEUR_MIN : ici + 16);
            // Sous la largeur minimale, c'est le rail.
            else if (e.key === "ArrowLeft") poserLargeur(ici - 16 < LARGEUR_MIN ? 0 : ici - 16);
            else if (e.key === "Enter") poserLargeur(LARGEUR_DEFAUT);
            else return;
            e.preventDefault();
          }}
        />
      </aside>
      {/* Le volet qui se referme : pendant la réduction, il glisse du bord étendu
          vers le rail et recouvre un instant le contenu déjà recalé. Invisible et
          inerte le reste du temps (`index.css`, `.barre-voile`). */}
      <div className="barre-voile" style={voileCss} aria-hidden />
    </>
  );
}
