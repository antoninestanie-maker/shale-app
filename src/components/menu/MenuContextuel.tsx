/**
 * Le menu contextuel de l'app — UN SEUL chemin de rendu.
 *
 * ⭐ Ce composant rend le menu du CLIC DROIT et le menu « ⋯ ». Pas deux
 * composants qui se ressemblent : le même, appelé deux fois. C'est la règle 18
 * du cahier des charges prise à la racine — deux rendus auraient fini par
 * diverger, et le jour où l'un aurait eu une entrée de plus, rien ne l'aurait dit.
 *
 * Ce qu'il porte, et pourquoi :
 *   • un PORTAIL en `position: fixed` — `PIEGES.md` § 14.1, un menu en
 *     `absolute` dans une carte de grille est rongé par son `overflow: clip` ;
 *   • le retournement et le bornage — `lib/menu/placement.ts` ;
 *   • la fermeture quand l'ancre sort de l'écran — `PIEGES.md` § 16.2 ;
 *   • la division par `zoomFactor()` — le réglage « Densité » est un `zoom` CSS ;
 *   • la convention d'Échap du dépôt : celui du dessus MARQUE la touche
 *     (`preventDefault`), les autres testent `defaultPrevented`. Fermer le menu
 *     ne ferme donc jamais la fiche ni le croquis dessous ;
 *   • le clavier complet, y compris le RETOUR DU FOCUS à l'élément d'origine.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronRight } from "../icons";
import { IconPoints } from "./icones";
import { t } from "../../lib/i18n";
import { zoomFactor } from "../../lib/uiConfig";
import {
  ordonner,
  rangDuFilet,
  activable,
  type EntreeMenu,
  type EntreePossible,
} from "../../lib/menu/entrees";
import { actionDe, rangParLettre, rangSuivant } from "../../lib/menu/clavier";
import { placer, placerSousMenu, type Ancre, type Placement } from "../../lib/menu/placement";
import type { EtatMenu } from "./useMenuContextuel";

interface Props<C> {
  etat: EtatMenu<C>;
  /**
   * Les entrées pour la cible courante, recalculées à chaque rendu.
   *
   * ⚠️ UN TABLEAU VIDE FERME LE MENU. C'est ainsi qu'un menu ouvert sur un
   * objet que la synchronisation vient d'effacer disparaît au lieu de planter :
   * l'appelant construit ses entrées à partir des données fraîches, l'objet n'y
   * est plus, il ne reste rien à montrer.
   */
  entrees: readonly EntreePossible[];
  /** Nom accessible du menu — « Actions sur « Ma note » ». */
  libelle: string;
}

/** Les pixels du panneau doivent être mesurés avant d'être placés : on le cache. */
const INVISIBLE = { top: 0, left: 0, visibility: "hidden" as const };

export default function MenuContextuel<C>({ etat, entrees, libelle }: Props<C>) {
  const items = useMemo(() => ordonner(entrees), [entrees]);
  const { ouvert, fermer } = etat;

  const panneau = useRef<HTMLDivElement>(null);
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const [rang, setRang] = useState(-1);
  const [sousMenu, setSousMenu] = useState<number | null>(null);
  /**
   * Le rang DANS le sous-menu ouvert. Tenu ici, par le parent, et pas par le
   * sous-menu lui-même : c'est le parent qui reçoit les touches, et un seul
   * gestionnaire de clavier pour les deux panneaux évite qu'ils se disputent
   * la même flèche.
   */
  const [rangSous, setRangSous] = useState(-1);
  /** L'entrée qui attend sa confirmation (`EntreeMenu.confirmation`), par son id. */
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);

  // ── L'objet a disparu pendant que le menu était ouvert ────────────────────
  useEffect(() => {
    if (ouvert && items.length === 0) fermer();
  }, [ouvert, items.length, fermer]);

  // ── Remise à zéro à chaque ouverture ──────────────────────────────────────
  useEffect(() => {
    if (!ouvert) {
      setPlace(null);
      setRang(-1);
      setSousMenu(null);
      setRangSous(-1);
      setAConfirmer(null);
      return;
    }
    // Ouvert au clavier : la première entrée activable prend le focus d'emblée.
    // Ouvert à la souris : rien n'est surligné tant qu'une touche n'a pas servi.
    setRang(etat.auClavier ? rangSuivant(items, -1, "bas") : -1);
    setSousMenu(null);
    // `items` volontairement hors dépendances : il change à chaque rendu du
    // parent, et le remettre ici ramènerait le focus en haut à chaque frappe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert, etat.auClavier]);

  // ── Placement ─────────────────────────────────────────────────────────────
  const placerMaintenant = useCallback(() => {
    const p = panneau.current;
    if (!p || !etat.ancre) return;
    const r = p.getBoundingClientRect();
    // L'ancre d'un BOUTON se re-mesure (elle défile avec sa ligne) ; l'ancre
    // d'un POINT, non — un point du curseur est déjà en coordonnées de fenêtre,
    // et c'est ce que font tous les menus du système.
    const ancre: Ancre = etat.elementAncre
      ? (() => {
          const b = etat.elementAncre.getBoundingClientRect();
          return { top: b.top, bottom: b.bottom, left: b.left, right: b.right };
        })()
      : etat.ancre;

    const resultat: Placement = placer(
      ancre,
      { width: r.width, height: r.height },
      { width: window.innerWidth, height: window.innerHeight },
      zoomFactor(),
      etat.alignement,
    );
    if (resultat === "fermer") return fermer();
    setPlace(resultat);
  }, [etat.ancre, etat.elementAncre, etat.alignement, fermer]);

  useLayoutEffect(() => {
    if (!ouvert) return;
    placerMaintenant();
  }, [ouvert, items.length, sousMenu, placerMaintenant]);

  useEffect(() => {
    if (!ouvert) return;
    // ⚠️ `scroll` en CAPTURE : le défilement d'une liste interne ne remonte pas
    // jusqu'à `window` autrement, et le menu resterait accroché au vide.
    // Un défilement involontaire ne doit rien coûter — d'où « suivre » plutôt
    // que « refermer » (PIEGES § 14.1), mais suivre AVEC BORNE (§ 16.2).
    const suivre = () => placerMaintenant();
    window.addEventListener("scroll", suivre, true);
    window.addEventListener("resize", suivre);
    return () => {
      window.removeEventListener("scroll", suivre, true);
      window.removeEventListener("resize", suivre);
    };
  }, [ouvert, placerMaintenant]);

  // ── Fermeture au clic extérieur ───────────────────────────────────────────
  useEffect(() => {
    if (!ouvert) return;
    // ⚠️⚠️ PAS `panneau.contains(cible)`. Le sous-menu vit dans SON PROPRE
    // portail : il n'est PAS un descendant du panneau dans le DOM (il ne l'est
    // que dans l'arbre React). La première version testait `contains` — et un
    // clic sur « Le titre » passait donc pour un clic EXTÉRIEUR : le menu se
    // fermait au `pointerdown`, avant que le `click` n'arrive, et rien n'était
    // copié. Mesuré le 2026-09-21 : presse-papier vide, menu fermé, aucune
    // erreur. On reconnaît donc les DEUX panneaux par leur marque commune.
    const dehors = (e: PointerEvent) => {
      const cible = e.target as Element | null;
      if (!cible?.closest?.("[data-menu-contextuel]")) fermer();
    };
    window.addEventListener("pointerdown", dehors);
    return () => window.removeEventListener("pointerdown", dehors);
  }, [ouvert, fermer]);

  // ── Le focus suit le rang ─────────────────────────────────────────────────
  const boutonsSous = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (!ouvert) return;
    // Le clavier est DANS le sous-menu : c'est lui qui tient le focus (voir
    // `SousMenu`). Le lui reprendre ici le ramènerait sur l'entrée parente.
    if (sousMenu !== null && rangSous >= 0) return;
    if (rang < 0) panneau.current?.focus();
    else boutons.current[rang]?.focus();
  }, [ouvert, rang, sousMenu, rangSous]);

  const lancer = useCallback(
    (e: EntreeMenu) => {
      if (!activable(e)) return;
      if (e.sousMenu?.length) return;
      // ⚠️ Premier choix d'une entrée à confirmer : on la TRANSFORME et le menu
      // reste ouvert. Le second choix — souris ou Entrée — exécute.
      if (e.confirmation && aConfirmer !== e.id) {
        setAConfirmer(e.id);
        return;
      }
      // On ferme AVANT d'agir : l'action peut ouvrir une fenêtre, naviguer ou
      // rendre la main plus tard, et un menu qui resterait ouvert par-dessus
      // serait à la fois laid et faux.
      fermer();
      // Une action qui échoue ne doit pas laisser l'app dans un état bancal :
      // le menu est déjà fermé, on se contente de le dire à la console.
      void (async () => {
        try {
          await e.executer?.();
        } catch (err) {
          console.error("menu contextuel :", e.id, err);
        }
      })();
    },
    [fermer, aConfirmer],
  );

  // ── Clavier ───────────────────────────────────────────────────────────────
  const surTouche = useCallback(
    (ev: React.KeyboardEvent) => {
      const action = actionDe(ev.key, sousMenu !== null);
      if (!action) return;

      // Échap : on MARQUE la touche, pour que la fiche ou le croquis dessous ne
      // se ferment pas avec le menu (convention du dépôt).
      if (action.quoi === "fermer") {
        ev.preventDefault();
        ev.stopPropagation();
        return fermer();
      }

      ev.preventDefault();
      ev.stopPropagation();

      // ── Le sous-menu est ouvert ET le clavier y est entré : tout va dedans ──
      const enfants = sousMenu !== null ? items[sousMenu]?.sousMenu : undefined;
      if (enfants?.length && rangSous >= 0) {
        switch (action.quoi) {
          case "deplacer":
            return setRangSous(rangSuivant(enfants, rangSous, action.touche));
          case "executer": {
            const e = enfants[rangSous];
            return e ? lancer(e) : undefined;
          }
          case "fermerSousMenu":
            // ← ressort, et RAMÈNE le focus sur l'entrée qui avait ouvert le
            // sous-menu : sans cela, on ressortirait vers nulle part.
            setRangSous(-1);
            return setSousMenu(null);
          case "lettre": {
            const trouve = rangParLettre(enfants, rangSous, action.lettre);
            if (trouve >= 0) setRangSous(trouve);
            return;
          }
          default:
            return;
        }
      }

      const ouvrirSous = (i: number) => {
        const sous = items[i]?.sousMenu;
        if (!sous?.length) return;
        setSousMenu(i);
        // → ENTRE dans le sous-menu : son premier élément prend le focus.
        setRangSous(rangSuivant(sous, -1, "bas"));
      };

      switch (action.quoi) {
        case "deplacer":
          setSousMenu(null);
          setRangSous(-1);
          return setRang(rangSuivant(items, rang, action.touche));
        case "executer": {
          const e = items[rang];
          if (!e) return;
          if (e.sousMenu?.length) return ouvrirSous(rang);
          return lancer(e);
        }
        case "ouvrirSousMenu":
          return ouvrirSous(rang);
        case "fermerSousMenu":
          setRangSous(-1);
          return setSousMenu(null);
        case "lettre": {
          const trouve = rangParLettre(items, rang, action.lettre);
          if (trouve >= 0) setRang(trouve);
          return;
        }
      }
    },
    [items, rang, sousMenu, rangSous, lancer, fermer],
  );

  // ── Le clavier est au menu, même quand le focus n'y est pas ────────────────
  // ⚠️ VU LE 2026-09-24 dans le lecteur du Savoir : un clic droit sur un bloc
  // de la fiche laissait le focus dans l'éditeur (`contenteditable`), et Échap
  // partait au lecteur — qui se fermait AVEC le menu, sans rien enregistrer
  // de plus. On écoute donc en CAPTURE sur `window` tant que le menu est
  // ouvert : une touche qui naît HORS du menu lui est rendue. Les écouteurs de
  // capture posés AVANT (l'éditeur de carte, le croquis) s'effacent d'eux-mêmes
  // devant un menu ouvert (`menuContextuelOuvert`, PIEGES § 19.15).
  useEffect(() => {
    if (!ouvert) return;
    const capter = (ev: KeyboardEvent) => {
      if ((ev.target as Element | null)?.closest?.("[data-menu-contextuel]")) return; // le menu l'a déjà
      if (!actionDe(ev.key, sousMenu !== null)) return;
      panneau.current?.focus();
      // Mêmes méthodes que l'événement React : `surTouche` s'en contente.
      surTouche(ev as unknown as React.KeyboardEvent);
    };
    window.addEventListener("keydown", capter, true);
    return () => window.removeEventListener("keydown", capter, true);
  }, [ouvert, sousMenu, surTouche]);

  if (!ouvert || items.length === 0) return null;

  const filet = rangDuFilet(items);

  return createPortal(
    <div
      ref={panneau}
      role="menu"
      aria-label={libelle}
      data-menu-contextuel=""
      tabIndex={-1}
      onKeyDown={surTouche}
      // ⚠️ `contextmenu` capté et annulé SUR LE MENU : sans cela, un clic droit
      // dans le menu rouvre le menu de la ligne dessous, à un autre endroit.
      onContextMenu={(e) => e.preventDefault()}
      // ⚠️ z-[95] : AU-DESSUS de toute fenêtre (la plus haute est à 80) — un menu
      // ouvert DANS l'éditeur de carte (z-75) ou le lecteur du Savoir (z-70)
      // se peignait dessous à z-60, et on ne le voyait pas (2026-09-24). Sous
      // le sélecteur de date (190) et les bulles (200), qui s'ouvrent par-dessus.
      className="card-solid fixed z-[95] min-w-[15rem] max-w-[22rem] overflow-y-auto rounded-[12px] border border-border p-1 shadow-lg focus:outline-none"
      style={{
        ...(place ?? INVISIBLE),
        maxHeight: "calc((100vh - 1rem) * var(--zoom-inv, 1))",
      }}
    >
      {items.map((e, i) => (
        <div key={e.id}>
          {i === filet && <div className="my-1 h-px bg-border" role="separator" />}
          <Entree
            entree={
              aConfirmer === e.id && e.confirmation ? { ...e, libelle: e.confirmation.libelle } : e
            }
            confirmee={aConfirmer === e.id}
            surligne={i === rang}
            sousMenuOuvert={sousMenu === i}
            ref={(el) => {
              boutons.current[i] = el;
            }}
            onSurvol={() => {
              setRang(i);
              setSousMenu(e.sousMenu?.length ? i : null);
              setRangSous(-1);
            }}
            onActiver={() => (e.sousMenu?.length ? setSousMenu(i) : lancer(e))}
          />
          {aConfirmer === e.id && e.confirmation && (
            <p className="px-2.5 pb-1.5 pt-0.5 text-[11px] leading-snug text-text-dim">{e.confirmation.detail}</p>
          )}
          {sousMenu === i && e.sousMenu?.length && (
            <SousMenu
              entrees={e.sousMenu}
              rang={rangSous}
              refs={boutonsSous}
              ancreEntree={boutons.current[i]}
              ancreParent={panneau.current}
              libelle={e.libelle}
              onSurvol={setRangSous}
              onLancer={lancer}
              onFermer={() => setSousMenu(null)}
            />
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}

// ─── Une entrée ──────────────────────────────────────────────────────────────

const LIGNE =
  "cible-tactile-ligne flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm";

function Entree(props: {
  entree: EntreeMenu;
  /** L'entrée attend sa confirmation : elle se montre ARMÉE, fond rouge plein. */
  confirmee?: boolean;
  surligne: boolean;
  sousMenuOuvert: boolean;
  onSurvol: () => void;
  onActiver: () => void;
  /** React 19 : `ref` est une prop ordinaire, pas un `forwardRef`. */
  ref?: React.Ref<HTMLButtonElement>;
}) {
  const { entree: e, surligne } = props;
  const grise = !!e.desactive;

  const couleur = grise ? "text-text-dim opacity-50" : e.danger ? "text-red" : "text-text";
  const fond = props.confirmee
    ? "bg-red/15 font-semibold"
    : surligne && !grise
      ? e.danger
        ? "bg-red/15"
        : "bg-overlay"
      : "";

  const bouton = (
    <button
      ref={props.ref}
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={grise}
      aria-haspopup={e.sousMenu?.length ? "menu" : undefined}
      aria-expanded={e.sousMenu?.length ? props.sousMenuOuvert : undefined}
      onMouseEnter={props.onSurvol}
      onClick={props.onActiver}
      className={`${LIGNE} ${couleur} ${fond} ${grise ? "cursor-default" : ""}`}
    >
      {/* Icône PLUS un mot : demande littérale d'Antonin. L'icône seule est
          une devinette, le mot seul est une liste sans repère. */}
      <span className="shrink-0 text-[15px] leading-none" aria-hidden>
        {e.icone}
      </span>
      <span className="min-w-0 flex-1 truncate">{e.libelle}</span>
      {/* Masqué au doigt : un iPhone n'a pas de touche F2, et afficher un
          raccourci qu'on ne peut pas taper est du bruit (vu le 2026-09-21). */}
      {e.raccourci && (
        <span className="shrink-0 font-mono text-[11px] text-text-dim [@media(pointer:coarse)]:hidden">
          {e.raccourci}
        </span>
      )}
      {!!e.sousMenu?.length && <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-text-dim" />}
    </button>
  );

  // ⚠️ UN BOUTON `disabled` NE REÇOIT PAS LE SURVOL — donc pas d'info-bulle.
  // La raison du grisage est portée par un `<span>` autour de lui. Et pas de
  // bulle quand il n'y a pas de raison à donner : une bulle qui répète ce
  // qu'on voit est du bruit.
  if (grise && e.desactive?.raison) {
    return (
      <span className="block" data-tip={e.desactive.raison}>
        {bouton}
      </span>
    );
  }
  return bouton;
}

// ─── Un sous-menu ────────────────────────────────────────────────────────────

function SousMenu(props: {
  entrees: readonly EntreeMenu[];
  rang: number;
  refs: React.RefObject<(HTMLButtonElement | null)[]>;
  onSurvol: (rang: number) => void;
  ancreEntree: HTMLButtonElement | null;
  ancreParent: HTMLDivElement | null;
  libelle: string;
  onLancer: (e: EntreeMenu) => void;
  onFermer: () => void;
}) {
  const panneau = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const p = panneau.current;
    const entree = props.ancreEntree?.getBoundingClientRect();
    const parent = props.ancreParent?.getBoundingClientRect();
    if (!p || !entree || !parent) return;
    const r = p.getBoundingClientRect();
    const resultat = placerSousMenu(
      entree,
      parent,
      { width: r.width, height: r.height },
      { width: window.innerWidth, height: window.innerHeight },
      zoomFactor(),
    );
    if (resultat === "fermer") return props.onFermer();
    setPlace(resultat);
    // Ancres seules : re-mesurer à chaque flèche ferait trembler le panneau.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.ancreEntree, props.ancreParent]);

  /**
   * ⚠️⚠️ LE FOCUS SE POSE ICI, ET SEULEMENT UNE FOIS LE PANNEAU VISIBLE.
   *
   * LE DÉFAUT PAYÉ (2026-09-21, mesuré au clavier). Le sous-menu naît en
   * `visibility: hidden`, le temps d'être mesuré — et un élément invisible ne
   * peut PAS recevoir le focus : `focus()` échoue en silence. Le parent, qui
   * posait le focus dans son propre effet, le faisait AVANT que ce panneau ait
   * reçu sa place : → ouvrait le sous-menu, l'état savait qu'on y était (↓
   * menait bien à « Le texte »), mais le focus restait sur « Copier ». Un
   * lecteur d'écran annonçait donc la mauvaise entrée, et rien ne se voyait.
   *
   * D'où `place` dans les dépendances : on attend d'être visible.
   */
  useEffect(() => {
    if (!place || props.rang < 0) return;
    props.refs.current[props.rang]?.focus();
  }, [place, props.rang, props.refs]);

  return createPortal(
    <div
      ref={panneau}
      role="menu"
      aria-label={props.libelle}
      data-menu-contextuel=""
      className="card-solid fixed z-[96] min-w-[12rem] max-w-[20rem] overflow-y-auto rounded-[12px] border border-border p-1 shadow-lg"
      style={{
        ...(place ?? INVISIBLE),
        maxHeight: "calc((100vh - 1rem) * var(--zoom-inv, 1))",
      }}
    >
      {props.entrees.map((e, i) => (
        <Entree
          key={e.id}
          entree={e}
          surligne={i === props.rang}
          sousMenuOuvert={false}
          ref={(el) => {
            props.refs.current[i] = el;
          }}
          onSurvol={() => props.onSurvol(i)}
          onActiver={() => props.onLancer(e)}
        />
      ))}
    </div>,
    document.body,
  );
}

// ─── Le bouton « ⋯ », jumeau visible du clic droit ───────────────────────────

/**
 * ⚠️ RÈGLE 17 : aucune action n'existe uniquement au clic droit ni au survol.
 *
 * Ce bouton est l'autre moitié du contrat. Il s'efface au repos sur un pointeur
 * fin — pour ne pas cribler les listes de trois points — mais il est TOUJOURS
 * visible au doigt (`pointer: coarse`) et TOUJOURS visible au focus clavier.
 * Sans ces deux exceptions, le menu n'existerait que pour qui a une souris et
 * sait qu'il faut cliquer droit.
 */
export function BoutonMenu(props: {
  onOuvrir: (e: React.MouseEvent<HTMLElement>) => void;
  libelle: string;
  ouvert?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onOuvrir}
      aria-haspopup="menu"
      aria-expanded={props.ouvert ?? false}
      aria-label={props.libelle}
      data-tip={t("Actions")}
      className={`cible-tactile flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-dim transition-opacity hover:bg-surface hover:text-text focus-visible:opacity-100 ${
        props.ouvert ? "opacity-100" : "opacity-0 group-hover/ligne:opacity-100"
      } [@media(pointer:coarse)]:opacity-100 ${props.className ?? ""}`}
    >
      <IconPoints className="h-4 w-4" />
    </button>
  );
}
