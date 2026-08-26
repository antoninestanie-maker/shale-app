// ─────────────────────────────────────────────────────────────────────────────
// Navigation TÉLÉPHONE : barre d'onglets + feuille « Plus ».
//
// Remplace `Sidebar.tsx` quand `useIsPhone()` est vrai — jamais en plus d'elle.
// Le bureau n'est pas touché d'une ligne.
//
// ─── POURQUOI QUATRE ONGLETS, ET CEUX-LÀ ────────────────────────────────────
// Douze modules + Réglages + Personnaliser = 14 destinations. Aucune barre
// d'onglets iOS n'en porte plus de cinq.
//
// Les quatre retenus sont IDENTIQUES dans les deux offres (Shale et Shale
// Trade). C'est la contrainte qui commande : `features.ts` réserve `trading`,
// `market` et `sizing` à Shale Trade, or un onglet PERMANENT qui ouvre un mur
// de paiement est le pire endroit possible pour vendre — et sur l'App Store,
// un paywall en barre d'onglets attire l'œil de l'examinateur (règle 3.1.1).
//
// Ce sont aussi les quatre modules où l'on ÉCRIT. Un téléphone sert à capturer,
// pas à analyser : c'est la même raison qui met Performance et Market Brain en
// consultation seule (`MOBILE.md` § 5.3).
//
// ⚠️ Les modules trading restent VISIBLES dans « Plus », verrouillés, avec leur
// cadenas — exactement comme dans la barre latérale. Les masquer supprimerait
// le levier de conversion vers Shale Trade.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";

import { isTradingView } from "../lib/features";
import { t } from "../lib/i18n";
import type { UiConfig } from "../lib/uiConfig";
import { BY_ID, CATEGORIES, CATEGORY_OF, type View } from "./Sidebar";

/** Les quatre onglets fixes. Le cinquième, « Plus », ouvre la liste complète. */
const ONGLETS: View[] = ["today", "tasks", "notes", "journal"];

interface Props {
  view: View;
  onNavigate: (v: View) => void;
  isAdmin: boolean;
  badges: { market?: boolean; trading?: boolean };
  config: UiConfig;
  hasTrading?: boolean;
  onLocked: (v: View) => void;
}

const iconePlus = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const cadenas = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-3.5">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export default function MobileNav({
  view,
  onNavigate,
  isAdmin,
  badges,
  config,
  hasTrading = true,
  onLocked,
}: Props) {
  const [plusOuvert, setPlusOuvert] = useState(false);
  const isLocked = (id: View) => !hasTrading && isTradingView(id);

  // La feuille se referme dès qu'on a navigué : sans ça, revenir en arrière la
  // laisserait ouverte par-dessus la vue qu'on vient de demander.
  useEffect(() => {
    setPlusOuvert(false);
  }, [view]);

  // Échap ferme la feuille (clavier externe, et iPad plus tard).
  useEffect(() => {
    if (!plusOuvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlusOuvert(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [plusOuvert]);

  const aller = (id: View) => {
    if (isLocked(id)) {
      onLocked(id);
      return;
    }
    onNavigate(id);
  };

  /** Libellé personnalisé par l'utilisateur, sinon libellé canonique traduit. */
  const libelle = (id: View) => {
    const perso = config.modules.find((m) => m.id === id)?.label;
    return perso ? perso : t(BY_ID.get(id)?.label ?? id);
  };

  const badgeDe = (id: View) =>
    (id === "market" && badges.market) || (id === "trading" && badges.trading);

  // — La barre d'onglets —
  const onglet = (id: View | "plus") => {
    const actif =
      id === "plus" ? plusOuvert : view === id && !plusOuvert;
    const item = id === "plus" ? null : BY_ID.get(id as View);
    return (
      <button
        key={id}
        type="button"
        onClick={() => (id === "plus" ? setPlusOuvert((v) => !v) : aller(id as View))}
        aria-current={actif ? "page" : undefined}
        className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition-colors ${
          actif ? "text-blue" : "text-text-dim"
        }`}
      >
        <span className="relative grid size-6 place-items-center [&>svg]:size-6">
          {id === "plus" ? iconePlus : item?.icon}
          {id === "plus" && !plusOuvert && (badges.market || badges.trading) && (
            <span className="bg-green absolute -right-0.5 -top-0.5 size-1.5 rounded-full" />
          )}
        </span>
        <span className="w-full truncate text-[11px] font-semibold leading-none">
          {id === "plus" ? t("Plus") : libelle(id as View)}
        </span>
      </button>
    );
  };

  // — La feuille « Plus » : tous les modules, groupés par catégorie —
  const visibles = config.modules.filter((m) => m.visible && BY_ID.has(m.id));
  const horsCategorie = visibles.filter((m) => !CATEGORY_OF[m.id]);

  const ligne = (id: View) => {
    const verrou = isLocked(id);
    return (
      <button
        key={id}
        type="button"
        onClick={() => aller(id)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
          view === id ? "bg-overlay-2 text-blue" : "hover:bg-overlay"
        } ${verrou ? "text-text-dim" : ""}`}
      >
        <span className="grid size-6 shrink-0 place-items-center [&>svg]:size-[22px]">
          {BY_ID.get(id)?.icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{libelle(id)}</span>
        {badgeDe(id) && <span className="bg-green size-2 shrink-0 rounded-full" />}
        {verrou && <span className="shrink-0">{cadenas}</span>}
      </button>
    );
  };

  return (
    <>
      {plusOuvert && (
        <div className="fixed inset-0 z-40 flex flex-col">
          {/* Voile : un appui hors de la feuille la referme. */}
          <button
            type="button"
            aria-label={t("Fermer")}
            className="flex-1 bg-black/50"
            onClick={() => setPlusOuvert(false)}
          />
          <div
            className="card-solid animate-fade-up max-h-[78vh] overflow-y-auto rounded-t-3xl border-t border-border px-3 pt-2"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
          >
            {/* Poignée : le signe visuel qu'on peut refermer. */}
            <div className="mx-auto mb-3 mt-1 h-1 w-9 rounded-full bg-border-strong" />

            {horsCategorie.map((m) => ligne(m.id))}

            {CATEGORIES.map((cat) => {
              const membres = visibles.filter((m) => CATEGORY_OF[m.id] === cat.id);
              if (!membres.length) return null;
              return (
                <section key={cat.id} className="mt-4">
                  {/* Les catégories de la barre latérale deviennent les
                      intertitres de cette liste : le vocabulaire de Shale est
                      conservé là où il porte du sens, et absent de la barre
                      d'onglets où il coûterait un niveau de navigation. */}
                  <h2 className="hud-label px-3 pb-1">{t(cat.label)}</h2>
                  {membres.map((m) => ligne(m.id))}
                </section>
              );
            })}

            <section className="mt-4 border-t border-border pt-2">
              {isAdmin && ligne("admin")}
              {ligne("settings")}
            </section>
          </div>
        </div>
      )}

      <nav
        className="glass fixed inset-x-0 bottom-0 z-50 flex items-stretch gap-0.5 border-t border-border px-1 pt-1"
        // Zone sûre : sur un iPhone sans bouton d'accueil, la barre système
        // mange ~34 pt en bas. Sans cette marge, le dernier onglet passe
        // dessous et devient très difficile à viser.
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.25rem)" }}
      >
        {ONGLETS.map(onglet)}
        {onglet("plus")}
      </nav>
    </>
  );
}
