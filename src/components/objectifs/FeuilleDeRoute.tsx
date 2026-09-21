import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatDate, t, tp } from "../../lib/i18n";
import { formaterChamp } from "../../lib/calendrier/champDate";
import { todayStr } from "../../lib/logic";
import {
  createGoal,
  deleteGoal,
  deleteLink,
  majFeuilleDeRoute,
  rattacherTache,
  reordonnerObjectifs,
  updateGoal,
  type GoalInput,
} from "../../lib/repo";
import {
  aideDeGenre,
  deplacer,
  deplieParDefaut,
  effetDuPoids,
  indexDInsertion,
  nomDeGenre,
  origineEnClair,
  pourquoiVide,
  type Replis,
} from "../../lib/objectifs/libelles";
import { compterSource, debutDuCompte, estAcheve, evenementPasse, sourceDe, uidDeLigne, type Mesure, type SourcesProgression } from "../../lib/objectifs/progression";
import {
  etapesTriees,
  peutAjouterEtape,
  peutPromouvoir,
  peutRetrograder,
  type GenreEtape,
} from "../../lib/objectifs/structure";
import { estRecurrente } from "../../lib/taches";
import { zoomFactor } from "../../lib/uiConfig";
import type { AppData, Goal } from "../../lib/types";
import { rattachementsDe, type ContexteObjectifs } from "../../lib/objectifs/contexte";
import { ouvrirObjet } from "../../lib/naviguer";
import { IconCarte, IconCheck, IconChevronDown, IconChevronRight, IconNote, IconPlus, IconX } from "../icons";
import ChampDate from "../ChampDate";
import { BarreAjout } from "./RattacherElement";

/**
 * ⭐ La feuille de route d'un objectif — révélée par un geste, jamais imposée.
 *
 * Les règles de ce fichier ne sont pas des préférences (prompt du chantier,
 * phase C) :
 *   • tant qu'un objectif n'a pas d'étape, rien d'ici n'apparaît à l'écran ;
 *   • une étape se crée EN UNE LIGNE : `Entrée` valide et rouvre la ligne
 *     suivante, `Échap` referme — jamais une fenêtre par étape ;
 *   • les poids sont MASQUÉS dans un repli « avancé », et disent en toutes
 *     lettres ce qu'ils changent ;
 *   • chaque ligne dit d'où vient son pourcentage (`origineEnClair`) ;
 *   • AUCUNE action n'existe uniquement au survol : l'iPhone n'en a pas. Tout
 *     passe par le menu « ⋯ » de la ligne, visible en permanence.
 */

export interface PropsFeuille {
  racine: Goal;
  data: AppData;
  contexte: ContexteObjectifs;
  sources: SourcesProgression;
  mesures: ReadonlyMap<number, Mesure>;
  replis: Replis;
  onReplier: (cle: string, ouvert: boolean) => void;
  /** L'ajout d'étape ouvert d'office (geste « Ajouter une étape » de la ligne racine). */
  ajoutOuvert: boolean;
  onFermerAjout: () => void;
  onModifier: (goal: Goal) => void;
  /** Ouvre la feuille de route en carte mentale (lecture). */
  onCarte: (goal: Goal) => void;
  refresh: () => Promise<void>;
}

export default function FeuilleDeRoute(p: PropsFeuille) {
  const { racine, data, refresh } = p;
  const etapes = etapesTriees(racine.id, data.goals);
  const elementsDirects =
    data.tasks.filter((x) => x.goal_id === racine.id).length +
    rattachementsDe(uidDeLigne("goal", racine), p.contexte).length;

  return (
    <div className="ml-2 border-l border-border pb-1 pl-2 sm:ml-4 sm:pl-3">
      {/* ⭐ Le bloc dit SON NOM. Sans cet en-tête, la zone indentée sous un
          objectif était un empilement d'étapes sans titre : on ne savait pas
          qu'on regardait « la feuille de route », donc on ne savait pas
          davantage ce qu'on pouvait y ajouter. Le compte tient le même rôle
          qu'ailleurs dans l'app (une pastille de nombre par catégorie). */}
      {etapes.length > 0 && (
        <div className="mb-1 flex flex-wrap items-center gap-2 px-1">
          <h3 className="hud-label">{t("Feuille de route")}</h3>
          <span className="pill bg-surface-2 px-2 py-0.5 text-[10px] text-text-dim">
            {tp(etapes.length, "{n} étape", "{n} étapes")}
          </span>
          <button
            type="button"
            onClick={() => p.onCarte(racine)}
            className="cible-tactile-ligne ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-dim hover:bg-surface-2 hover:text-text"
            data-tip={t("Voir en carte mentale")}
            data-tip-sub={t("Toute la feuille de route d’un coup d’œil. Un clic sur un nœud ouvre l’étape ou la tâche.")}
          >
            <IconCarte className="h-3.5 w-3.5" />
            {t("Carte|carte mentale")}
          </button>
        </div>
      )}

      {!!racine.manual_progress && etapes.length > 0 && (
        <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] bg-surface-2 px-3 py-2 text-xs text-text-dim">
          <span className="min-w-0 flex-1 basis-[14rem]">
            {t("Progression saisie à la main : la feuille de route n’est pas lue.")}
          </span>
          <button
            type="button"
            className="cible-tactile pill border border-blue px-2.5 py-1 font-medium text-blue hover:bg-blue/10"
            onClick={async () => {
              await majFeuilleDeRoute(racine.id, { manual_progress: 0 });
              await refresh();
            }}
          >
            {t("Mesurer depuis la feuille de route")}
          </button>
        </div>
      )}

      <ListeEtapes {...p} parent={racine} etapes={etapes} />

      {elementsDirects > 0 && (
        <div className="px-2 py-1">
          <p className="hud-label mb-1">{t("Rattaché directement")}</p>
          <ListeElements goal={racine} data={data} contexte={p.contexte} maintenant={p.sources.maintenant} refresh={refresh} />
        </div>
      )}

      <AjoutEtape
        parent={racine}
        goals={data.goals}
        genres={["jalon", "sous-objectif"]}
        ouvertDOffice={p.ajoutOuvert}
        onFerme={p.onFermerAjout}
        refresh={refresh}
        libelle={etapes.length === 0 ? t("Ajouter une première étape") : t("Ajouter une étape")}
      />
    </div>
  );
}

// ─── Liste d'étapes sœurs, réordonnable ─────────────────────────────────────

interface PropsListe extends PropsFeuille {
  parent: Goal;
  etapes: Goal[];
}

function ListeEtapes(p: PropsListe) {
  const { parent, etapes, refresh } = p;
  const [glisse, setGlisse] = useState<{ id: number; dy: number; vers: number } | null>(null);

  /**
   * ⚠️ LES ÉCOUTEURS SONT POSÉS DANS LE `pointerdown`, JAMAIS DANS UN EFFET.
   * Un geste rapide se termine avant qu'un effet n'ait tourné — constaté à
   * l'écran dans le calendrier (`GrilleHoraire`). `PointerEvent` et non le
   * `draggable` HTML5, qui ne se déclenche pas au doigt sur iOS.
   */
  const saisir = (e: React.PointerEvent, id: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const depart = e.clientY;
    const de = etapes.findIndex((x) => x.id === id);
    let actif = false;
    let vers = de;

    const bouger = (ev: PointerEvent) => {
      const dy = ev.clientY - depart;
      if (!actif && Math.abs(dy) < 4) return;
      actif = true;
      // Hit-test sur les positions RÉELLES du DOM, relues à chaque mouvement.
      const autres = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-frere-de="${parent.id}"]`),
      ).filter((el) => el.dataset.etape !== String(id));
      const milieux = autres.map((el) => {
        const r = el.getBoundingClientRect();
        return r.top + Math.min(r.height, 44) / 2;
      });
      vers = indexDInsertion(milieux, ev.clientY);
      setGlisse({ id, dy, vers });
    };
    const lacher = async () => {
      window.removeEventListener("pointermove", bouger);
      window.removeEventListener("pointerup", lacher);
      window.removeEventListener("pointercancel", lacher);
      setGlisse(null);
      if (!actif || vers === de) return;
      await reordonnerObjectifs(deplacer(etapes, de, vers).map((x) => x.id));
      await refresh();
    };
    window.addEventListener("pointermove", bouger);
    window.addEventListener("pointerup", lacher);
    window.addEventListener("pointercancel", lacher);
  };

  const monter = async (i: number, sens: -1 | 1) => {
    const j = i + sens;
    if (j < 0 || j >= etapes.length) return;
    await reordonnerObjectifs(deplacer(etapes, i, j).map((x) => x.id));
    await refresh();
  };

  return (
    <div>
      {etapes.map((etape, i) => (
        <div key={etape.id} className="relative">
          {glisse && glisse.id !== etape.id && glisse.vers === indexParmiAutres(etapes, glisse.id, etape.id) && (
            <div className="pointer-events-none absolute inset-x-2 -top-px h-0.5 rounded bg-blue" aria-hidden />
          )}
          <LigneEtape
            {...p}
            etape={etape}
            freres={etapes}
            index={i}
            enGlissement={glisse?.id === etape.id ? glisse.dy : null}
            onSaisir={(e) => saisir(e, etape.id)}
            onDeplacer={(sens) => monter(i, sens)}
          />
        </div>
      ))}
      {glisse && glisse.vers >= etapes.length - 1 && (
        <div className="pointer-events-none mx-2 h-0.5 rounded bg-blue" aria-hidden />
      )}
    </div>
  );
}

/** L'index qu'aurait `cible` dans la liste privée de `glissee` — pour placer le repère d'insertion. */
function indexParmiAutres(etapes: readonly Goal[], glissee: number, cible: number): number {
  return etapes.filter((x) => x.id !== glissee).findIndex((x) => x.id === cible);
}

// ─── Une étape ──────────────────────────────────────────────────────────────

interface PropsLigne extends PropsFeuille {
  etape: Goal;
  freres: Goal[];
  index: number;
  enGlissement: number | null;
  onSaisir: (e: React.PointerEvent) => void;
  onDeplacer: (sens: -1 | 1) => void;
}

function LigneEtape(p: PropsLigne) {
  const { etape, freres, data, mesures, replis, onReplier, refresh } = p;
  const m = mesures.get(etape.id);
  const estJalon = !!etape.is_milestone;
  const enfants = etapesTriees(etape.id, data.goals);
  const cle = `g${etape.id}`;
  const ouvert =
    replis[cle] ?? deplieParDefaut(etape, freres, (id) => {
      const x = mesures.get(id);
      return !!x && estAcheve(x);
    });
  const [renommer, setRenommer] = useState(false);
  const pct = m?.pct ?? null;
  const termine = !!m && estAcheve(m);

  return (
    <div
      data-frere-de={etape.parent_goal_id ?? ""}
      data-etape={etape.id}
      className={`rounded-[10px] ${p.enGlissement != null ? "relative z-10 bg-surface-2 shadow-lg" : ""}`}
      style={p.enGlissement != null ? { transform: `translateY(${p.enGlissement}px)` } : undefined}
    >
      {/* ⭐ Deux blocs, et le repli se fait ENTRE eux, jamais dedans : poignée,
          chevron et titre restent ensemble ; la barre et le menu passent dessous
          quand la place manque. Vu sur iPhone émulé le 2026-09-15 : avec un seul
          `flex-wrap`, la poignée et le chevron restaient seuls sur une ligne,
          le titre tombait en dessous (PIEGES § base flex, 2026-07-26). */}
      <div className="group flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[10px] px-1 py-1.5 hover:bg-surface-2">
        <div className="flex min-w-0 flex-1 basis-[13rem] items-center gap-x-1">
          <button
            type="button"
            onPointerDown={p.onSaisir}
            className="cible-tactile flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-text-dim [touch-action:none] active:cursor-grabbing"
            aria-label={t("Déplacer « {titre} »", { titre: etape.title })}
            data-tip={t("Glisser pour réordonner")}
          >
            <svg viewBox="0 0 10 16" className="h-3.5 w-2.5" fill="currentColor" aria-hidden>
              {[3, 8, 13].map((y) => (
                <g key={y}>
                  <circle cx="2.5" cy={y} r="1.3" />
                  <circle cx="7.5" cy={y} r="1.3" />
                </g>
              ))}
            </svg>
          </button>

          <button
            type="button"
            onClick={() => onReplier(cle, !ouvert)}
            className="cible-tactile flex h-7 w-6 shrink-0 items-center justify-center rounded-md text-text-dim hover:text-text"
            aria-expanded={ouvert}
            aria-label={ouvert ? t("Replier « {titre} »", { titre: etape.title }) : t("Déplier « {titre} »", { titre: etape.title })}
          >
            {ouvert ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
          </button>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
            {renommer ? (
              <ChampLigne
                valeurInitiale={etape.title}
                placeholder={t("Titre de l’étape")}
                onValider={async (titre) => {
                  setRenommer(false);
                  if (titre && titre !== etape.title) {
                    await updateGoal(etape.id, { ...ficheDe(etape), title: titre });
                    await refresh();
                  }
                }}
                onAnnuler={() => setRenommer(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => onReplier(cle, !ouvert)}
                onDoubleClick={() => setRenommer(true)}
                className={`truncate truncate-souris text-left text-sm ${termine ? "text-text-dim" : "text-text"}`}
                title={etape.title}
              >
                {etape.title}
              </button>
            )}
            {estJalon && (
              <span
                className="pill shrink-0 bg-violet/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-violet"
                data-tip={t("Phase")}
                data-tip-sub={aideDeGenre("jalon")}
              >
                {nomDeGenre("jalon")}
              </span>
            )}
            {etape.deadline && (
              <span className="pill shrink-0 bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-dim">
                {formaterJour(etape.deadline)}
              </span>
            )}
            {m && (
              <span className={`w-full truncate text-[11px] ${m.pct == null ? "italic text-text-dim" : "text-text-dim"}`}>
                {termine && !ouvert && estJalon ? `${t("Terminé")} · ` : ""}
                {origineEnClair(m, estJalon)}
              </span>
            )}
        </div>

        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <BarreMesure pct={pct} acheve={termine} />

          <MenuEtape
            etape={etape}
            goals={data.goals}
            index={p.index}
            nbFreres={freres.length}
            onRenommer={() => setRenommer(true)}
            onModifier={() => p.onModifier(etape)}
            onDeplacer={p.onDeplacer}
            refresh={refresh}
          />
        </div>
      </div>

      {ouvert && (
        <div
          className="ml-5 pb-2 sm:ml-12"
          /* ⚠️ Toucher à une étape ouverte D'OFFICE fige son ouverture. Sans ça,
             rattacher l'élément qui la termine la replie sous les doigts, champ
             de saisie compris — vu à l'écran le 2026-09-15 : on tapait dans un
             champ qui venait de disparaître. Le repliement automatique ne vaut
             qu'à l'ouverture de la vue, jamais au milieu d'un geste. */
          onFocusCapture={() => {
            if (replis[cle] === undefined) onReplier(cle, true);
          }}
        >
          {m && m.pct == null && (
            <p className="px-1 pb-1 text-xs text-text-dim">{pourquoiVide(m, estJalon)}</p>
          )}
          {enfants.length > 0 && <ListeEtapes {...p} parent={etape} etapes={enfants} />}
          {peutAjouterEtape(etape, "sous-objectif", data.goals) && (
            <AjoutEtape
              parent={etape}
              goals={data.goals}
              genres={["sous-objectif"]}
              refresh={refresh}
              libelle={t("Ajouter un sous-objectif")}
            />
          )}
          <EcheanceEtape etape={etape} maintenant={p.sources.maintenant} refresh={refresh} />
          <PanneauMesure goal={etape} parent={data.goals.find((g) => g.id === etape.parent_goal_id) ?? null} {...p} />
        </div>
      )}
    </div>
  );
}

function BarreMesure({ pct, acheve }: { pct: number | null; acheve: boolean }) {
  return (
    <div className="flex w-28 shrink-0 items-center gap-2">
      <div className="pill h-1.5 flex-1 overflow-hidden bg-surface-2">
        {pct != null && (
          <div
            className={`pill h-full transition-[width] duration-500 ${acheve ? "bg-green" : "bg-blue"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        )}
      </div>
      <span className="w-9 text-right font-display text-xs font-bold text-text">
        {pct == null ? "—" : `${pct}%`}
      </span>
    </div>
  );
}

// ─── Le menu « ⋯ » : TOUTES les commandes, sans survol ──────────────────────

function MenuEtape(props: {
  etape: Goal;
  goals: Goal[];
  index: number;
  nbFreres: number;
  onRenommer: () => void;
  onModifier: () => void;
  onDeplacer: (sens: -1 | 1) => void;
  refresh: () => Promise<void>;
}) {
  const { etape, goals, refresh } = props;
  const [ouvert, setOuvert] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const panneau = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);

  /**
   * ⚠️ LE MENU VIT DANS UN PORTAIL, positionné sur la fenêtre.
   *
   * Posé dans la ligne, il débordait sous la carte de la DERNIÈRE étape, que le
   * panneau de grille rogne (`overflow: clip`) : vu à l'écran le 2026-09-15, le
   * rectangle de « Redevenir un sous-objectif » à 1 025 px dans une fenêtre de
   * 1 000, hors d'atteinte même en défilant — le clic tombait dans le vide. On le
   * mesure AVANT la peinture, on le retourne vers le haut s'il ne tient pas en
   * dessous, et on divise par le zoom de densité comme le fait `Tooltip`.
   */
  const placer = () => {
    const bouton = racine.current?.getBoundingClientRect();
    const menu = panneau.current?.getBoundingClientRect();
    if (!bouton || !menu) return;
    const z = zoomFactor();
    const marge = 8;
    const enDessous = bouton.bottom + 4 + menu.height <= window.innerHeight - marge;
    const top = enDessous ? bouton.bottom + 4 : Math.max(marge, bouton.top - 4 - menu.height);
    const left = Math.min(Math.max(marge, bouton.right - menu.width), window.innerWidth - menu.width - marge);
    setPlace({ top: top / z, left: left / z });
  };
  useLayoutEffect(() => {
    if (!ouvert) return setPlace(null);
    placer();
  }, [ouvert, confirmer]);

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: PointerEvent) => {
      const cible = e.target as Node;
      if (!racine.current?.contains(cible) && !panneau.current?.contains(cible)) setOuvert(false);
    };
    // Défiler déplace le bouton : le menu le SUIT au lieu de se refermer sous
    // les doigts (un défilement involontaire ne doit rien coûter).
    const defile = () => placer();
    window.addEventListener("scroll", defile, true);
    window.addEventListener("resize", defile);
    const touche = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key !== "Escape") return;
      e.preventDefault();
      setOuvert(false);
    };
    window.addEventListener("pointerdown", clic);
    window.addEventListener("keydown", touche);
    return () => {
      window.removeEventListener("pointerdown", clic);
      window.removeEventListener("keydown", touche);
      window.removeEventListener("scroll", defile, true);
      window.removeEventListener("resize", defile);
    };
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) setConfirmer(false);
  }, [ouvert]);

  const agir = (f: () => unknown) => async () => {
    setOuvert(false);
    await f();
  };

  const entree = "cible-tactile-ligne block w-full rounded-md px-3 py-1.5 text-left text-sm text-text hover:bg-overlay disabled:opacity-40";

  return (
    <div ref={racine} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        className="cible-tactile flex h-7 w-7 items-center justify-center rounded-md text-text-dim hover:bg-surface hover:text-text"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label={t("Actions sur « {titre} »", { titre: etape.title })}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {ouvert && createPortal(
        <div
          ref={panneau}
          role="menu"
          className="card-solid fixed z-50 w-56 rounded-[12px] border border-border p-1 shadow-lg"
          style={place ? { top: place.top, left: place.left } : { top: 0, left: 0, visibility: "hidden" }}
        >
          <button type="button" role="menuitem" className={entree} onClick={agir(props.onRenommer)}>
            {t("Renommer")}
          </button>
          <button type="button" role="menuitem" className={entree} onClick={agir(props.onModifier)}>
            {t("Échéance et description…")}
          </button>
          <button type="button" role="menuitem" className={entree} disabled={props.index === 0} onClick={agir(() => props.onDeplacer(-1))}>
            {t("Monter")}
          </button>
          <button
            type="button"
            role="menuitem"
            className={entree}
            disabled={props.index >= props.nbFreres - 1}
            onClick={agir(() => props.onDeplacer(1))}
          >
            {t("Descendre")}
          </button>
          {peutPromouvoir(etape, goals) && (
            <button
              type="button"
              role="menuitem"
              className={entree}
              onClick={agir(async () => {
                await majFeuilleDeRoute(etape.id, { is_milestone: 1 });
                await refresh();
              })}
            >
              {t("En faire une phase")}
            </button>
          )}
          {peutRetrograder(etape, goals) && (
            <button
              type="button"
              role="menuitem"
              className={entree}
              onClick={agir(async () => {
                await majFeuilleDeRoute(etape.id, { is_milestone: 0 });
                await refresh();
              })}
            >
              {t("Redevenir un sous-objectif")}
            </button>
          )}
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            className={`${entree} ${confirmer ? "bg-red/15 font-semibold text-red" : "text-red"}`}
            onClick={async () => {
              if (!confirmer) return setConfirmer(true);
              setOuvert(false);
              await deleteGoal(etape);
              await refresh();
            }}
          >
            {confirmer ? t("Confirmer la suppression") : t("Supprimer l’étape")}
          </button>
          {confirmer && (
            <p className="px-3 pb-1 pt-0.5 text-[11px] text-text-dim">
              {t("Ses sous-objectifs remontent d’un niveau, ses tâches sont déliées.")}
            </p>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Ajouter une étape : UNE ligne ──────────────────────────────────────────

function AjoutEtape(props: {
  parent: Goal;
  goals: Goal[];
  genres: GenreEtape[];
  libelle: string;
  ouvertDOffice?: boolean;
  onFerme?: () => void;
  refresh: () => Promise<void>;
}) {
  const { parent, goals, genres, refresh } = props;
  const [ouvert, setOuvert] = useState(!!props.ouvertDOffice);
  const [genre, setGenre] = useState<GenreEtape>(genres[0]);
  const [cle, setCle] = useState(0);

  useEffect(() => {
    if (props.ouvertDOffice) setOuvert(true);
  }, [props.ouvertDOffice]);

  const fermer = () => {
    setOuvert(false);
    props.onFerme?.();
  };

  const genresPossibles = genres.filter((g) => peutAjouterEtape(parent, g, goals));
  if (genresPossibles.length === 0) return null;
  const genreActif = genresPossibles.includes(genre) ? genre : genresPossibles[0];

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="cible-tactile-ligne flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-text-dim hover:bg-surface-2 hover:text-text"
      >
        <IconPlus className="h-3.5 w-3.5" />
        {props.libelle}
      </button>
    );
  }

  return (
    <div className="px-1 py-1">
      <div className="flex flex-wrap items-center gap-2">
      {genresPossibles.length > 1 && (
        <div className="flex shrink-0 overflow-hidden rounded-[8px] border border-border text-[11px]" role="radiogroup" aria-label={t("Genre de l’étape")}>
          {genresPossibles.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={genreActif === g}
              // La souris ne doit pas voler le focus au champ : on tape, on
              // bascule le genre, on continue de taper.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setGenre(g)}
              className={`cible-tactile px-2 py-1 font-medium ${genreActif === g ? "bg-blue/15 text-blue" : "text-text-dim hover:text-text"}`}
            >
              {nomDeGenre(g)}
            </button>
          ))}
        </div>
      )}
      <ChampLigne
        key={cle}
        placeholder={
          genreActif === "jalon"
            ? t("Nom de la phase — Entrée pour valider et continuer")
            : t("Nom du sous-objectif — Entrée pour valider et continuer")
        }
        onValider={async (titre) => {
          if (!titre) return fermer();
          const soeurs = goals.filter((g) => g.parent_goal_id === parent.id);
          await createGoal({
            ...ficheDe(parent),
            title: titre,
            description: null,
            parent_goal_id: parent.id,
            deadline: null,
            progress_pct: 0,
            manual_progress: 0,
            is_milestone: genreActif === "jalon" ? 1 : 0,
            position: soeurs.reduce((mx, s) => Math.max(mx, (s.position ?? 0) + 1), soeurs.length),
          });
          // La ligne suivante s'ouvre, vide : cinq phases se tapent d'affilée.
          setCle((c) => c + 1);
          await refresh();
        }}
        onAnnuler={fermer}
      />
      </div>
      {/* ⭐ Le mot seul ne suffit pas. « Phase » et « Sous-objectif » côte à
          côte posent une question à qui ouvre l'écran pour la première fois ;
          une phrase sous le champ y répond, et disparaît avec lui. */}
      <p className="mt-1 text-[11px] text-text-dim">{aideDeGenre(genreActif)}</p>
    </div>
  );
}

/**
 * Un champ d'une ligne. `Entrée` valide, `Échap` annule, perdre le focus
 * valide — on ne perd jamais une frappe en cliquant ailleurs.
 */
function ChampLigne(props: {
  valeurInitiale?: string;
  placeholder: string;
  onValider: (valeur: string) => void | Promise<void>;
  onAnnuler: () => void;
}) {
  const [valeur, setValeur] = useState(props.valeurInitiale ?? "");
  const fini = useRef(false);
  return (
    <input
      autoFocus
      value={valeur}
      onChange={(e) => setValeur(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          fini.current = true;
          void props.onValider(valeur.trim());
        } else if (e.key === "Escape") {
          e.preventDefault();
          fini.current = true;
          props.onAnnuler();
        }
      }}
      onBlur={() => {
        if (fini.current) return;
        const v = valeur.trim();
        if (v && v !== props.valeurInitiale) void props.onValider(v);
        else props.onAnnuler();
      }}
      placeholder={props.placeholder}
      className="min-w-0 flex-1 basis-[14rem] rounded-[8px] border border-blue bg-surface-2 px-2.5 py-1.5 text-sm text-text placeholder:text-text-dim focus:outline-none"
    />
  );
}

/**
 * ⭐ L'ÉCHÉANCE D'UNE ÉTAPE SE POSE SUR PLACE.
 *
 * Elle n'existait que dans la fenêtre « Échéance et description… » du menu
 * « ⋯ » : trois gestes et un changement de contexte pour une date, sur l'objet
 * même dont la date fait le sens (une feuille de route sans dates est une liste
 * de souhaits, et c'est elle que `calendrier/peril.ts` lit pour signaler un
 * objectif en péril). La fenêtre reste, pour la description.
 *
 * ⚠️ On écrit par `updateGoal` et la fiche complète (`ficheDe`), jamais par
 * `majFeuilleDeRoute` : `deadline` appartient à la fiche, et la liste fermée de
 * l'autre ne la connaît pas.
 */
function EcheanceEtape(props: { etape: Goal; maintenant: string; refresh: () => Promise<void> }) {
  const { etape } = props;
  const jour = props.maintenant.slice(0, 10);
  const enRetard = !!etape.deadline && etape.deadline < jour;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 px-1 text-xs text-text-dim">
      <span className="shrink-0">{t("Échéance")}</span>
      <ChampDate
        valeur={etape.deadline ?? ""}
        onChange={async (v) => {
          if ((v || null) === (etape.deadline ?? null)) return;
          await updateGoal(etape.id, { ...ficheDe(etape), deadline: v || null });
          await props.refresh();
        }}
        aria={t("Échéance de « {titre} »", { titre: etape.title })}
        placeholder={t("Sans échéance")}
        className="cible-tactile-ligne flex shrink-0 items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-left text-sm text-text transition-colors hover:border-border-strong focus:border-blue focus:outline-none"
      />
      {enRetard && <span className="shrink-0 font-medium text-red">{t("En retard")}</span>}
    </div>
  );
}

// ─── Comment une étape se mesure ────────────────────────────────────────────

function PanneauMesure(props: PropsFeuille & { goal: Goal; parent: Goal | null }) {
  const { goal, parent, data, sources, refresh } = props;
  const aCible = goal.target_count != null;
  const [mode, setMode] = useState<"elements" | "nombre">(aCible ? "nombre" : "elements");
  useEffect(() => setMode(aCible ? "nombre" : "elements"), [aCible]);

  if (goal.manual_progress) {
    return (
      <p className="px-1 py-1 text-xs text-text-dim">
        {t("Cette étape est suivie à la main.")}{" "}
        <button
          type="button"
          className="font-medium text-blue hover:underline"
          onClick={async () => {
            await majFeuilleDeRoute(goal.id, { manual_progress: 0 });
            await refresh();
          }}
        >
          {t("La mesurer")}
        </button>
      </p>
    );
  }

  return (
    <div className="mt-1 rounded-[10px] bg-surface-2/60 px-2 py-2">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-[8px] border border-border text-[11px]" role="radiogroup" aria-label={t("Comment cette étape avance")}>
          {(["elements", "nombre"] as const).map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={mode === x}
              onClick={async () => {
                setMode(x);
                // Revenir aux éléments RETIRE la cible : sinon elle continuerait
                // de compter, invisible. Choisir « nombre » n'écrit rien tant
                // qu'aucun nombre n'est saisi.
                if (x === "elements" && aCible) {
                  await majFeuilleDeRoute(goal.id, { target_count: null });
                  await refresh();
                }
              }}
              className={`cible-tactile px-2.5 py-1 font-medium ${mode === x ? "bg-blue/15 text-blue" : "text-text-dim hover:text-text"}`}
            >
              {x === "elements" ? t("Compter des éléments") : t("Atteindre un nombre")}
            </button>
          ))}
        </div>
      </div>

      {mode === "elements" ? (
        <ListeElements goal={goal} data={data} contexte={props.contexte} maintenant={sources.maintenant} refresh={refresh} avecRattachement />
      ) : (
        <ReglageCible goal={goal} data={data} sources={sources} refresh={refresh} />
      )}

      {goal.parent_goal_id != null && (
        <details className="mt-2 text-xs text-text-dim">
          <summary className="cible-tactile-ligne cursor-pointer select-none">{t("Avancé")}</summary>
          <label className="mt-1.5 flex flex-wrap items-center gap-2">
            <span>{t("Poids")}</span>
            <input
              type="number"
              min={1}
              step={1}
              defaultValue={goal.weight > 0 ? goal.weight : 1}
              onBlur={async (e) => {
                const v = Math.max(1, Math.round(Number(e.currentTarget.value) || 1));
                e.currentTarget.value = String(v);
                if (v !== goal.weight) {
                  await majFeuilleDeRoute(goal.id, { weight: v });
                  await refresh();
                }
              }}
              className="w-16 rounded-[8px] border border-border bg-surface px-2 py-1 text-text"
            />
          </label>
          <p className="mt-1">{effetDuPoids(goal.weight, parent)}</p>
        </details>
      )}
    </div>
  );
}

function ListeElements(props: {
  goal: Goal;
  data: AppData;
  contexte: ContexteObjectifs;
  maintenant: string;
  refresh: () => Promise<void>;
  avecRattachement?: boolean;
}) {
  const { goal, data, contexte, refresh } = props;
  const faites = useMemo(() => new Set(data.completions.filter((c) => c.done).map((c) => c.task_id)), [data.completions]);
  const taches = data.tasks.filter((x) => x.goal_id === goal.id);
  const rattaches = rattachementsDe(uidDeLigne("goal", goal), contexte);
  const vide = taches.length === 0 && rattaches.length === 0;

  const bouton = "cible-tactile flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-dim hover:bg-surface-2 hover:text-text";

  return (
    <div>
      {vide && props.avecRattachement && (
        <p className="px-1 pb-1 text-xs text-text-dim">{t("Rien de rattaché pour l’instant.")}</p>
      )}
      <ul>
        {taches.map((tache) => {
          const recurrente = estRecurrente(tache);
          const faite = !recurrente && faites.has(tache.id);
          return (
            /* ⚠️ `flex-wrap` ET une base flex sur le titre. Sous
               `pointer: coarse`, `.truncate-souris` REND LE RETOUR À LA LIGNE
               (au doigt il n'y a pas de survol, donc un titre coupé l'est sans
               recours) : le titre a alors besoin de toute la largeur, sinon il
               se casse lettre par lettre à côté de sa date. Vu à l'écran sur
               iPhone 390 pt le 2026-09-18 : « Backtesti / ng 1h ».
               Une base flex, jamais `min-w-0` seul : ce dernier ne déclenche
               pas le repli, il comprime (règle du 2026-07-26). */
            <li key={`t${tache.id}`} className="flex flex-wrap items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-surface">
              <Coche faite={faite} />
              <span className={`min-w-0 flex-1 basis-[9rem] truncate truncate-souris ${faite ? "text-text-dim line-through" : "text-text"}`} title={tache.label}>
                {tache.label}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-2">
              {recurrente ? (
                <span
                  className="shrink-0 text-[10px] text-text-dim"
                  data-tip={t("Une tâche récurrente n’est jamais « finie »")}
                  data-tip-sub={t("Elle ne compte pas comme une unité. Pour la compter, fixe un nombre à atteindre et choisis-la comme source.")}
                >
                  {t("récurrente, non comptée")}
                </span>
              ) : (
                tache.due_date && (
                  /* ⭐ L'échéance s'AFFICHE. Sans elle, on posait une date au
                     composeur sans jamais la relire — et une date qu'on ne
                     relit pas ne sert à personne.

                     ⚠️ « En retard » ne se dit que si la tâche n'est PAS faite :
                     une tâche cochée hier n'est pas en retard, elle est faite.
                     Et la comparaison porte sur le JOUR local (`maintenant` est
                     du local, PIEGES § 4.1), jamais sur un horodatage. */
                  <span
                    className={`shrink-0 text-[10px] tabular-nums ${
                      !faite && tache.due_date < props.maintenant.slice(0, 10) ? "text-red" : "text-text-dim"
                    }`}
                    data-tip={!faite && tache.due_date < props.maintenant.slice(0, 10) ? t("En retard") : undefined}
                  >
                    {formaterChamp(tache.due_date, props.maintenant.slice(0, 10))}
                  </span>
                )
              )}
              <button
                type="button"
                className={bouton}
                aria-label={t("Détacher « {titre} »", { titre: tache.label })}
                onClick={async () => {
                  await rattacherTache(tache.id, null);
                  await refresh();
                }}
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
              </span>
            </li>
          );
        })}
        {rattaches.map((r) => {
          const evenement = r.kind === "event" ? contexte.evenements.find((e) => e.uid === r.uid) : undefined;
          const recurrent = !!evenement?.recurrence && evenement.recurrence !== "none";
          const passe = !!evenement && !recurrent && evenementPasse(evenement, props.maintenant);
          return (
            /* Même repli que la ligne de tâche, et pour la même raison : son
               libellé de droite (« note, ne compte pas ») est plus long encore. */
            <li key={`${r.kind}:${r.uid}`} className="flex flex-wrap items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-surface">
              {r.kind === "event" ? (
                <Coche faite={passe} />
              ) : (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center text-text-dim" aria-hidden>
                  <IconNote className="h-3.5 w-3.5" />
                </span>
              )}
              {/* Une ressource s'OUVRE : c'est tout ce qu'elle apporte à l'objectif. */}
              <button
                type="button"
                onClick={() => void ouvrirObjet(r.kind, r.uid)}
                className={`min-w-0 flex-1 basis-[9rem] truncate truncate-souris text-left hover:underline ${passe ? "text-text-dim line-through" : "text-text"}`}
                title={r.titre}
              >
                {r.titre || t("Sans titre")}
              </button>
              <span className="ml-auto flex shrink-0 items-center gap-2">
              <span
                className="shrink-0 text-[10px] text-text-dim"
                data-tip={r.kind === "event" ? undefined : t("Écrire n’est pas avancer")}
                data-tip-sub={
                  r.kind === "event" ? undefined : t("Une note ou une fiche éclaire l’objectif, elle ne le fait pas progresser.")
                }
              >
                {r.kind === "event"
                  ? recurrent
                    ? t("récurrent, non compté")
                    : evenement
                      ? formaterJour(evenement.date)
                      : ""
                  : r.kind === "note"
                    ? t("note, ne compte pas")
                    : t("fiche, ne compte pas")}
              </span>
              <button
                type="button"
                className={bouton}
                aria-label={t("Détacher « {titre} »", { titre: r.titre })}
                onClick={async () => {
                  await deleteLink(r.lien.id);
                  await refresh();
                }}
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
              </span>
            </li>
          );
        })}
      </ul>
      {props.avecRattachement && <BarreAjout goal={goal} data={data} contexte={contexte} refresh={refresh} />}
    </div>
  );
}

function Coche({ faite }: { faite: boolean }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${faite ? "border-green bg-green/20 text-green" : "border-border"}`}
      aria-label={faite ? t("faite") : t("à faire")}
    >
      {faite && <IconCheck className="h-3 w-3" />}
    </span>
  );
}

function ReglageCible(props: { goal: Goal; data: AppData; sources: SourcesProgression; refresh: () => Promise<void> }) {
  const { goal, data, sources, refresh } = props;
  const source = sourceDe(goal);
  const ecrire = async (patch: Parameters<typeof majFeuilleDeRoute>[1]) => {
    await majFeuilleDeRoute(goal.id, patch);
    await refresh();
  };
  const recurrentes = data.tasks.filter((x) => estRecurrente(x) && !x.is_example);
  const habitudes = data.habits.filter((h) => !h.is_example);
  const compte = goal.target_count != null ? compterSource(goal, source, sources) : null;
  const champ = "rounded-[8px] border border-border bg-surface px-2 py-1 text-sm text-text";

  return (
    <div className="flex flex-col gap-2 text-xs text-text-dim">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span>{t("Cible")}</span>
          <input
            type="number"
            min={1}
            step={1}
            autoFocus={goal.target_count == null}
            defaultValue={goal.target_count ?? ""}
            placeholder="50"
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            onBlur={(e) => {
              const brut = e.currentTarget.value.trim();
              if (!brut) return;
              // ENTIER, jamais REAL (règle du dépôt) : la décimale se règle par l'unité.
              const v = Math.max(1, Math.round(Number(brut)));
              if (Number.isFinite(v) && v !== goal.target_count) void ecrire({ target_count: v });
            }}
            className={`w-20 ${champ}`}
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span>{t("Unité")}</span>
          <input
            defaultValue={goal.target_unit ?? ""}
            placeholder={t("backtests, €, pages…")}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim() || null;
              if (v !== goal.target_unit) void ecrire({ target_unit: v });
            }}
            className={`w-32 ${champ}`}
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span>{t("Compté")}</span>
          <select
            value={source}
            onChange={(e) => void ecrire({ count_source: e.target.value, count_ref_uid: null })}
            className={champ}
          >
            <option value="manual">{t("à la main")}</option>
            <option value="task" disabled={recurrentes.length === 0}>{t("par une tâche récurrente")}</option>
            <option value="habit" disabled={habitudes.length === 0}>{t("par une habitude")}</option>
          </select>
        </label>
      </div>

      {goal.target_count == null ? (
        <p>{t("Saisis le nombre à atteindre : l’étape commence à compter dès qu’il existe.")}</p>
      ) : source === "manual" ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cible-tactile flex h-7 w-7 items-center justify-center rounded-md border border-border text-text hover:bg-surface"
            aria-label={t("Retirer un")}
            onClick={() => void ecrire({ manual_count: Math.max(0, goal.manual_count - 1) })}
          >
            −
          </button>
          <span className="min-w-[4rem] text-center font-display text-sm font-bold text-text">
            {goal.manual_count}
            <span className="font-body text-xs font-normal text-text-dim"> / {goal.target_count}</span>
          </span>
          <button
            type="button"
            className="cible-tactile flex h-7 w-7 items-center justify-center rounded-md border border-border text-text hover:bg-surface"
            aria-label={t("Ajouter un")}
            onClick={() => void ecrire({ manual_count: goal.manual_count + 1 })}
          >
            +
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={goal.count_ref_uid ?? ""}
            onChange={(e) => void ecrire({ count_ref_uid: e.target.value || null })}
            className={`min-w-0 max-w-full ${champ}`}
            aria-label={source === "task" ? t("La tâche qui compte") : t("L’habitude qui compte")}
          >
            <option value="">{source === "task" ? t("Choisir une tâche…") : t("Choisir une habitude…")}</option>
            {source === "task"
              ? recurrentes.map((x) => (
                  <option key={x.id} value={uidDeLigne("task", x)}>{x.label}</option>
                ))
              : habitudes.map((h) => (
                  <option key={h.id} value={uidDeLigne("habit", h)}>{h.name}</option>
                ))}
          </select>
          {/* ⭐ Un compte LU, jamais un champ : sinon deux vérités. */}
          {compte != null && (
            <span>
              {tp(compte, "{n} compté depuis le {date}", "{n} comptés depuis le {date}", {
                date: formaterJour(debutDuCompte(goal)),
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Utilitaires ────────────────────────────────────────────────────────────

/** Les champs de la fiche, pour `updateGoal` — qui n'écrit que ceux-là. */
export function ficheDe(g: Goal): GoalInput {
  return {
    title: g.title,
    description: g.description,
    scope: g.scope,
    category: g.category,
    parent_goal_id: g.parent_goal_id,
    deadline: g.deadline,
    progress_pct: g.progress_pct,
    manual_progress: g.manual_progress,
  };
}

/** `Intl` dans la langue de l'app ; midi, pour rester dans la bonne journée (PIEGES § 4.1). */
function formaterJour(jour: string): string {
  const [a, m, j] = (jour || todayStr()).split("-").map(Number);
  return formatDate(new Date(a, m - 1, j, 12), { day: "numeric", month: "long" });
}
