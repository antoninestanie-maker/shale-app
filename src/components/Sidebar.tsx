import { useEffect, useRef, useState, type ReactNode } from "react";
import type { UiConfig } from "../lib/uiConfig";
import { getSetting, setSetting } from "../lib/repo";
import { isTradingView } from "../lib/features";
import Clock from "./Clock";
import NotificationBell from "./NotificationBell";
import SessionIndicator from "./SessionIndicator";
import SyncIndicator from "./SyncIndicator";
import { IconLock, IconSliders } from "./icons";

import { t } from "../lib/i18n";
export type View =
  | "today"
  | "tasks"
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
  | "settings";

interface Props {
  view: View;
  onNavigate: (view: View) => void;
  demoMode: boolean;
  isAdmin?: boolean;
  badges?: Partial<Record<View, boolean>>;
  config: UiConfig;
  /** Offre Shale Trade (ou essai en cours). Faux ⇒ modules trading verrouillés. */
  hasTrading?: boolean;
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
  today: "Tableau de bord du jour : tâches, énergie, discipline, performance.",
  tasks: "Créer, taguer et planifier les tâches récurrentes ou ponctuelles.",
  timer: "Minuteur Pomodoro pour tes sessions de concentration.",
  goals: "Objectifs court / moyen / long terme, regroupés par catégorie.",
  performance: "Courbes de progression : régularité, focus, objectifs.",
  finance: "Trésorerie : runway, patrimoine net, burn mensuel.",
  notes: "Notes riches liées entre elles, recherche plein texte.",
  journal: "Entrée quotidienne : humeur, énergie, ressenti de la journée.",
  knowledge: "Base de connaissances : notes, images, croquis et liens par thème.",
  trading: "Journal de trades en R, statistiques et tracker de positions live.",
  market: "Briefing marchés généré 2×/jour : biais, niveaux, zones no-trade.",
  sizing: "Calculateur de taille de position et de risque, envoi au tracker.",
  console: "Console d'administration : utilisateurs, abonnements, métriques.",
  admin: "Réorganiser les onglets et les widgets, densité, identité.",
  settings: "Clés d'API, apparence, charge mentale, réglages du tracker.",
};

/** Libellés par défaut des modules (utilisés par la page Personnaliser). */
export const MODULE_LABELS: Record<string, string> = Object.fromEntries(
  ITEMS.map((it) => [it.id, it.label]),
);

export const BY_ID = new Map(ITEMS.map((it) => [it.id, it]));

/**
 * Catégories de la sidebar. « Aujourd'hui » reste hors catégorie (accueil) ;
 * Personnaliser/Réglages restent épinglés en bas (rôle « Système »).
 * L'ordre/visibilité DANS chaque catégorie suit la page Personnaliser.
 */
export const CATEGORIES: { id: string; label: string; members: View[] }[] = [
  {
    id: "prod",
    label: "Productivité",
    members: [
      "tasks",
      "timer",
      "goals",
      "performance",
      "finance",
      "notes",
      "journal",
      "knowledge",
    ],
  },
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

export default function Sidebar({
  view,
  onNavigate,
  demoMode,
  isAdmin,
  badges,
  config,
  hasTrading = true,
  onLocked,
}: Props) {
  /** Verrouillé = module trading sur une offre qui ne l'inclut pas. */
  const isLocked = (id: View) => !hasTrading && isTradingView(id);
  // — État replié/déplié des catégories (persisté) —
  // Défaut au premier lancement : seule la catégorie de la vue active est ouverte
  // (à défaut, la première).
  const [collapsed, setCollapsed] = useState<Record<string, boolean> | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    getSetting(COLLAPSE_KEY)
      .then((raw) => {
        if (!alive || loadedRef.current) return;
        loadedRef.current = true;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              setCollapsed(parsed as Record<string, boolean>);
              return;
            }
          } catch {
            /* ignore */
          }
        }
        const active = CATEGORY_OF[view] ?? CATEGORIES[0].id;
        setCollapsed(Object.fromEntries(CATEGORIES.map((c) => [c.id, c.id !== active])));
      })
      .catch(() => {
        if (alive && !loadedRef.current) {
          loadedRef.current = true;
          setCollapsed({});
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
      setSetting(COLLAPSE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [view]);

  const toggleCategory = (catId: string, headerEl?: HTMLElement | null) => {
    setCollapsed((prev) => {
      const wasCollapsed = (prev ?? {})[catId] ?? false;
      const next = { ...(prev ?? {}), [catId]: !wasCollapsed };
      setSetting(COLLAPSE_KEY, JSON.stringify(next)).catch(() => {});
      if (wasCollapsed && headerEl) {
        // À l'ouverture : amène la catégorie dépliée dans la zone visible.
        setTimeout(() => {
          headerEl.nextElementSibling?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 260); // après l'animation de dépliage
      }
      return next;
    });
  };

  const navButton = (
    id: View,
    label: string,
    icon: ReactNode,
  ) => {
    const locked = isLocked(id);
    const active = view === id && !locked;
    const canonical = t(BY_ID.get(id)?.label ?? label);
    return (
      <button
        key={id}
        type="button"
        // Verrouillé : le bouton reste CLIQUABLE (jamais `disabled`) — il ouvre
        // le paywall. Un bouton désactivé ne reçoit pas non plus les événements
        // de survol, donc perdrait l'info-bulle qui explique le cadenas.
        onClick={() => (locked ? onLocked?.(id) : onNavigate(id))}
        aria-current={active ? "page" : undefined}
        data-tip={canonical}
        data-tip-sub={locked ? t("Inclus dans Shale Trade") : t(DESCRIPTIONS[id])}
        data-tip-side="right"
        className={`group/nav relative flex items-center gap-3 rounded-[var(--radius-field)] px-3 py-2 text-[13px] font-medium transition-colors duration-150 ${
          locked
            ? "text-text-dim/55 hover:bg-overlay hover:text-text-dim"
            : active
              ? "bg-overlay-2 text-text"
              : "text-text-dim hover:bg-overlay hover:text-text"
        }`}
      >
        {/* Repère d'onglet actif : petit bâton d'accent à gauche (macOS/Linear) */}
        <span
          aria-hidden
          className={`pill absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 bg-blue transition-all duration-200 ${
            active ? "opacity-100" : "scale-y-0 opacity-0"
          }`}
        />
        <span
          className={`h-[17px] w-[17px] transition-colors ${
            locked ? "text-text-dim/45" : active ? "text-blue" : "text-text-dim/80"
          }`}
        >
          {icon}
        </span>
        {/* Les libellés sont renommables (page Personnaliser) : on tronque
            plutôt que de laisser un nom long déborder de la sidebar. */}
        <span className="hidden min-w-0 truncate lg:inline" title={label}>
          {label}
        </span>
        {locked ? (
          <IconLock className="ml-auto h-3.5 w-3.5 shrink-0 text-text-dim/45" />
        ) : (
          badges?.[id] && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-green" />
        )}
      </button>
    );
  };

  return (
    // `glass` : matériau unique (verre teinté + saturation), theme-aware.
    // ── Repli en icônes sous 1024 px ────────────────────────────────────────
    // La barre mesurait 232 px de 720 à 2560 px, sans jamais céder un pixel :
    // 32 % de la fenêtre en Split View, 26 % à la taille minimale. Sous 1024 px
    // elle tombe à 64 px et ne garde que les icônes.
    //
    // Pourquoi le repli en ICÔNES et pas un tiroir superposé : les treize items
    // restent accessibles en UN clic. Un tiroir en coûterait deux, sur une app
    // dont on change d'onglet en permanence. Le tiroir n'aurait de sens que
    // sous ~600 px, largeur que la fenêtre ne peut pas atteindre (`minWidth`).
    //
    // Chaque libellé porte déjà `title={label}` : replié, le survol le rend.
    // C'est ce qui rend ce repli possible sans rien ajouter.
    <aside className="glass relative z-10 flex w-16 shrink-0 flex-col border-r border-border lg:w-[232px]">
      {/* Zone de drag fenêtre (barre de titre overlay).
          `="deep"` (et non l'attribut nu) : avec l'attribut nu, Tauri ne
          déclenche le drag que sur un clic DIRECT sur l'élément porteur
          (`el === composedPath[0]` dans son `drag.js`) — le titre et le
          sous-titre, qui sont des enfants, n'étaient donc déjà pas des
          poignées, et le bloc ajouté ici pour la cloche aurait encore réduit
          la zone utile. En mode `deep` tout le sous-arbre devient poignée,
          SAUF les éléments cliquables : un `<button>` sans attribut coupe
          court à la remontée. La cloche reste donc cliquable. */}
      {/* Replié, le bloc de marque passe en colonne : le mot-symbole n'a plus la
          place de s'écrire, seule la cloche reste utile. La zone de drag, elle,
          doit survivre — c'est la seule poignée de la fenêtre. */}
      <div
        data-tauri-drag-region="deep"
        className="flex flex-col items-center gap-2 px-2 pb-5 pt-10 lg:flex-row lg:items-start lg:gap-2 lg:px-5"
      >
        <div className="hidden min-w-0 flex-1 lg:block">
          <span className="font-display text-[17px] font-bold tracking-tight text-text">
            {config.brandTitle}
          </span>
          {config.brandSubtitle && <p className="hud-label mt-1">{config.brandSubtitle}</p>}
        </div>
        <NotificationBell onNavigate={onNavigate} />
      </div>

      <nav className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2 lg:px-3">
        {(() => {
          const visible = config.modules.filter((m) => m.visible && BY_ID.has(m.id));
          const uncategorized = visible.filter((m) => !CATEGORY_OF[m.id]);
          return (
            <>
              {uncategorized.map((m) => {
                const item = BY_ID.get(m.id)!;
                return navButton(m.id, m.label?.trim() || t(item.label), item.icon);
              })}
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
                  <div key={cat.id} className="mt-2 first:mt-0">
                    <button
                      type="button"
                      onClick={(e) => toggleCategory(cat.id, e.currentTarget)}
                      aria-expanded={isOpen}
                      data-tip={t(cat.label)}
                      data-tip-sub={
                        allLocked
                          ? t("Inclus dans Shale Trade")
                          : isOpen
                            ? t("Replier la catégorie")
                            : t("Déplier la catégorie")
                      }
                      data-tip-side="right"
                      className="group flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-left hover:bg-overlay lg:justify-start lg:px-3"
                    >
                      {/* Replié, le nom de catégorie n'a plus la place ; il reste
                          dans `data-tip`, donc au survol. */}
                      <span
                        className={`hud-label hidden flex-1 transition-colors group-hover:text-text lg:block ${
                          allLocked ? "opacity-55" : ""
                        }`}
                      >
                        {t(cat.label)}
                      </span>
                      {allLocked && <IconLock className="h-3 w-3 text-text-dim/45" />}
                      {hasBadge && <span className="h-1.5 w-1.5 rounded-full bg-green" />}
                      <svg
                        viewBox="0 0 12 12"
                        className="h-2.5 w-2.5 text-text-dim transition-transform duration-200"
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
                    <div
                      style={{
                        display: "grid",
                        gridTemplateRows: isOpen ? "1fr" : "0fr",
                        transition: "grid-template-rows 240ms cubic-bezier(0.32, 0.72, 0, 1)",
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
            </>
          );
        })()}
      </nav>

      <div className="mt-auto border-t border-border pt-3">
        <nav className="flex flex-col gap-0.5 px-3">
          {isAdmin &&
            navButton(
              "console",
              t("Admin"),
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
              </svg>,
            )}
          {navButton("admin", t("Personnaliser"), <IconSliders className="h-full w-full" />)}
          {navButton("settings", t("Réglages"), BY_ID.get("settings")!.icon)}
        </nav>
      </div>

      {/* ⚠️ Le pied de barre porte des composants qui écrivent du TEXTE — horloge,
          session de marché, état de synchronisation. Dans une colonne de 64 px,
          l'horloge se cassait caractère par caractère (« 16 : 5 6 : 40 M… »).
          Ils reviennent avec les libellés, à partir de `lg`. Ce qu'on perd est
          consultable d'un clic dans Réglages, et l'heure est celle du système —
          elle est déjà dans la barre de menus de macOS. */}
      <div className="flex flex-col gap-3 px-2 pb-5 pt-4 lg:px-5">
        <div className="hidden lg:contents">
          <Clock />
          <SessionIndicator />
        </div>
        <SyncIndicator onOuvrirReglages={() => onNavigate("settings")} />
        {demoMode && (
          <span className="pill hidden w-fit border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-text-dim lg:inline-block">
            {t("mode démo")}
          </span>
        )}
        {/* Replié, seule la pastille verte reste : elle dit la même chose que le
            texte à côté, et c'est elle qu'on regarde. */}
        <div className="flex items-center justify-center gap-2 lg:justify-start">
          <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-green" />
          <span className="hud-label hidden lg:inline">{t("systèmes actifs")}</span>
        </div>
      </div>
    </aside>
  );
}
