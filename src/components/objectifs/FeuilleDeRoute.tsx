import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatDate, t, tp } from "../../lib/i18n";
import { formaterChamp } from "../../lib/calendrier/champDate";
import { todayStr } from "../../lib/logic";
import {
  basculerTache,
  createGoal,
  deleteLink,
  majFeuilleDeRoute,
  rattacherTache,
  reordonnerObjectifs,
  renommerObjectif,
  daterObjectif,
  type GoalInput,
} from "../../lib/repo";
import {
  aideDeGenre,
  deplacer,
  deplieParDefaut,
  indexDInsertion,
  nomDeGenre,
  origineEnClair,
  pourquoiVide,
  type Replis,
} from "../../lib/objectifs/libelles";
import { compterSource, debutDuCompte, elementsDe, estAcheve, evenementPasse, sourceDe, uidDeLigne, type Mesure, type SourcesProgression } from "../../lib/objectifs/progression";
import {
  etapesTriees,
  peutAjouterEtape,
  peutPromouvoir,
  peutRetrograder,
  type GenreEtape,
} from "../../lib/objectifs/structure";
import { filDObjectif, type Fil } from "../../lib/objectifs/fil";
import { estRecurrente } from "../../lib/taches";
import { zoomFactor } from "../../lib/uiConfig";
import type { AppData, Goal, Task } from "../../lib/types";
import { rattachementsDe, type ContexteObjectifs } from "../../lib/objectifs/contexte";
import { ouvrirObjet } from "../../lib/naviguer";
import { IconCheck, IconChevronDown, IconChevronRight, IconFlame, IconFolder, IconNote, IconPlus, IconTarget, IconX } from "../icons";
import ChampDate from "../ChampDate";
import { CaseACocher, useCochesOptimistes } from "../CaseACocher";
import { placer as placerMenu } from "../../lib/menu/placement";
import { bilanDeDepart } from "../../lib/corbeille/lots";
import { annonceDepart, jeter } from "../corbeille/geste";
import { pointeurGrossier } from "../../lib/menu/tactile";
import { BarreAjout } from "./RattacherElement";
import { couleurPriorite, phrasePriorite, rangPriorite } from "../../lib/priorite";
import { ChoixPriorite, PastillePriorite } from "../Priorite";
import type { Priority } from "../../lib/types";
import MenuContextuel from "../menu/MenuContextuel";
import { useMenuContextuel } from "../menu/useMenuContextuel";
import { entreesTache, gestesCommunsTache, type GestesTache } from "../menu/catalogue/tache";
import { ouvrirParId } from "../../lib/naviguer";
import { useIaPossible } from "../../lib/ia/useIa";
import { demanderIa } from "../../lib/ia/demande";
import { peutDecomposer } from "../../lib/ia/planifier";
import { IconeIa } from "../ia/IconeIa";

/**
 * ⭐ La feuille de route d'un objectif — révélée par un geste, jamais imposée.
 *
 * Les règles de ce fichier ne sont pas des préférences (prompt du chantier,
 * phase C) :
 *   • tant qu'un objectif n'a pas d'étape, rien d'ici n'apparaît à l'écran ;
 *   • une étape se crée EN UNE LIGNE : `Entrée` valide et rouvre la ligne
 *     suivante, `Échap` referme — jamais une fenêtre par étape ;
 *   • chaque ligne dit d'où vient son pourcentage (`origineEnClair`) — sauf
 *     une étape VIDE, qui se tait : la barre montre « — » ;
 *   • ⭐ 2026-09-30 — L'ÉCRAN NE S'EXPLIQUE PLUS EN TOUTES LETTRES. Antonin :
 *     « c'est trop de texte […] ça doit être expliqué dans l'onboarding et pas
 *     marqué dans l'app tout le temps. À la limite, si on laisse le curseur
 *     trois secondes sur quelque chose, ça peut l'expliquer ». Les phrases
 *     d'aide (« Rien à mesurer pour l'instant… », « vide, non comptée »,
 *     « récurrente, non comptée », l'aide sous le champ de saisie) sont
 *     passées dans des bulles `data-tip-attente="longue"` (deux secondes de
 *     survol, `Tooltip.tsx`) ; le repli « Avancé / Poids » est retiré, et la
 *     PRIORITÉ le remplace (`lib/priorite.ts`) ;
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
  refresh: () => Promise<void>;
  /**
   * ⭐ LE FIL (2026-10-08) : la page d'un objectif dessine, à gauche de la
   * feuille de route, la barre de progression du site — un nœud par étape de
   * premier niveau, un tronçon par étape. Tout le dessin est en CSS
   * (`index.css`, `.fil-item`) ; ici on ne pose que l'état et la part faite.
   */
  fil?: boolean;
}

// ─── Le fil ─────────────────────────────────────────────────────────────────

/** Le centre du nœud, depuis le haut de son item — par genre d'item (px). */
const FIL_Y = { etape: 25, directs: 12, ajout: 14, fin: 22 } as const;

/** Ce que le rail du premier niveau doit savoir, calculé une fois par la feuille. */
interface Rail {
  /** Le nœud qui suit la DERNIÈRE étape (éléments directs, sinon « ajouter »). */
  suiteFinale: number;
  /** Les tronçons et l'item qui porte l'orbe (`lib/objectifs/fil.ts`). */
  fil: Fil;
}

/** Les variables CSS d'un item du fil. `e` : part du tronçon parcourue, 0 → 1. */
function varsFil(e: number, rang: number, y: number, suite: number): React.CSSProperties {
  return {
    "--fil-e": Math.min(1, Math.max(0, e)).toFixed(4),
    "--fil-rang": rang,
    "--fil-y": `${y}px`,
    "--fil-suite": `${suite}px`,
  } as React.CSSProperties;
}

/**
 * ⚠️ Depuis la vue en maître-détail (phase D, 2026-09-29), la feuille de route
 * vit dans la FICHE de l'objectif (`GoalsView`) : le bouton « Carte » et la
 * phrase « saisi à la main… » sont montés dans l'en-tête de la fiche. Le bandeau
 * d'ici disait « la feuille de route n'est pas lue » juste sous un chiffre qui
 * disait « saisi à la main » : deux vérités pour un seul objectif (audit D1).
 */
export default function FeuilleDeRoute(p: PropsFeuille) {
  const { racine, data, refresh } = p;
  const etapes = etapesTriees(racine.id, data.goals);
  const elementsDirects =
    data.tasks.filter((x) => x.goal_id === racine.id).length +
    rattachementsDe(uidDeLigne("goal", racine), p.contexte).length;

  // ─── Le fil : un item par étape, puis les éléments directs, « ajouter », l'arrivée.
  // Rien à relier tant que l'objectif n'a ni étape ni élément : pas de fil.
  const fil = !!p.fil && (etapes.length > 0 || elementsDirects > 0);
  const mRacine = p.mesures.get(racine.id);
  const atteint = !!mRacine && estAcheve(mRacine);
  // Les éléments rattachés à l'objectif lui-même ont LEUR tronçon : ce qui est
  // fait sur ce qui compte (la règle de `mesurer`, pas un second calcul).
  const directs = useMemo(() => {
    const { comptables } = elementsDe(racine, p.sources);
    const faits = comptables.filter((c) => c.fait).length;
    return { total: comptables.length, faits };
  }, [racine, p.sources]);
  const rail: Rail | undefined = fil
    ? {
        suiteFinale: elementsDirects > 0 ? FIL_Y.directs : FIL_Y.ajout,
        fil: filDObjectif({
          etapes,
          mesures: p.mesures,
          directs: { presents: elementsDirects > 0, ...directs },
          atteint,
        }),
      }
    : undefined;
  const troncon = (cle: string) => rail?.fil.troncons.find((x) => x.cle === cle);

  return (
    <div className="mt-6">
      {/* ⭐ Le bloc dit SON NOM : sans lui, on ne savait pas qu'on regardait
          « la feuille de route », donc pas davantage ce qu'on pouvait y ajouter. */}
      {etapes.length > 0 && (
        <div className={`mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 ${fil ? "pl-[34px]" : ""}`}>
          <h3 className="hud-label">{t("Feuille de route")}</h3>
          <Legende />
        </div>
      )}

      <ListeEtapes {...p} parent={racine} etapes={etapes} rail={rail} />

      {elementsDirects > 0 && (
        <div
          className={fil ? "fil-item pb-2" : "px-2 py-1"}
          data-etat={troncon("directs")?.etat}
          style={fil ? varsFil(troncon("directs")?.part ?? 0, etapes.length, FIL_Y.directs, FIL_Y.ajout) : undefined}
        >
          {fil && (
            <>
              <span className="fil-noeud" aria-hidden />
              <span className="fil-plein" aria-hidden />
              {rail?.fil.courant === "directs" && <span className="fil-orbe" aria-hidden />}
            </>
          )}
          <p className="hud-label mb-1 pt-1">{t("Rattaché directement")}</p>
          <ListeElements goal={racine} data={data} contexte={p.contexte} maintenant={p.sources.maintenant} refresh={refresh} />
        </div>
      )}

      {/* « Ajouter une étape » est une place encore vide SUR le chemin : son
          nœud est en tirets, et le fil ne le traverse en plein qu'une fois
          l'objectif atteint. */}
      <div
        className={fil ? "fil-item fil-ajout pb-1" : undefined}
        data-etat={troncon("ajout")?.etat}
        style={fil ? varsFil(troncon("ajout")?.part ?? 0, etapes.length + 1, FIL_Y.ajout, FIL_Y.fin) : undefined}
      >
        {fil && (
          <>
            <span className="fil-noeud" aria-hidden />
            <span className="fil-plein" aria-hidden />
          </>
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

      {fil && (
        <div
          className="fil-item fil-fin"
          data-etat={troncon("fin")?.etat}
          style={varsFil(0, etapes.length + 2, FIL_Y.fin, 0)}
        >
          <span className="fil-noeud" aria-hidden />
          <p className="flex min-h-11 flex-wrap items-center gap-x-2 px-1 text-sm">
            <span className="hud-label shrink-0">{atteint ? t("Atteint") : t("Arrivée")}</span>
            <span className={`min-w-0 truncate font-medium ${atteint ? "text-text" : "text-text-dim"}`}>{racine.title}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Liste d'étapes sœurs, réordonnable ─────────────────────────────────────

interface PropsListe extends PropsFeuille {
  parent: Goal;
  etapes: Goal[];
  /** Le fil — seulement pour la liste du PREMIER niveau (celle de la racine). */
  rail?: Rail;
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

  // ⚠️ `rail` descend avec `{...p}` jusqu'aux listes imbriquées : seul le
  // premier niveau dessine le fil, sinon chaque phase aurait le sien.
  const rail = parent.id === p.racine.id ? p.rail : undefined;

  return (
    <div>
      {etapes.map((etape, i) => {
        const troncon = rail?.fil.troncons.find((x) => x.cle === `g${etape.id}`);
        return (
        <div
          key={etape.id}
          className={rail ? "fil-item relative" : "relative"}
          data-etat={troncon?.etat}
          style={rail ? varsFil(troncon?.part ?? 0, i, FIL_Y.etape, i === etapes.length - 1 ? rail.suiteFinale : FIL_Y.etape) : undefined}
        >
          {rail && (
            <>
              <span className="fil-noeud" aria-hidden />
              <span className="fil-plein" aria-hidden />
              {rail.fil.courant === `g${etape.id}` && <span className="fil-orbe" aria-hidden />}
            </>
          )}
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
        );
      })}
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
  const compteePar = sourceNommee(etape, data);
  const origine = m ? origineEnClair(m) : "";

  return (
    <div
      data-frere-de={etape.parent_goal_id ?? ""}
      data-etape={etape.id}
      /* ⭐ UN LISERÉ PAR TYPE (2026-10-01, variante D choisie par Antonin sur
         quatre maquettes : « pour bien voir la distinction entre chaque item
         sans se perdre »). Phase : cadre marqué ; sous-objectif : cadre en
         pointillé ; tâche : sa propre pastille (`ListeElements`). La légende
         en tête de la feuille de route dit lequel est lequel. */
      className={`mb-2 px-1.5 py-1 ${
        estJalon
          ? "rounded-[14px] border-[1.5px] border-border-strong bg-surface"
          : "rounded-[10px] border border-dashed border-border-strong"
      } ${p.enGlissement != null ? "relative z-10 bg-surface-2 shadow-lg" : ""}`}
      style={p.enGlissement != null ? { transform: `translateY(${p.enGlissement}px)` } : undefined}
    >
      {/* ⭐ Deux blocs, et le repli se fait ENTRE eux, jamais dedans : poignée,
          chevron et titre restent ensemble ; la barre et le menu passent dessous
          quand la place manque. Vu sur iPhone émulé le 2026-09-15 : avec un seul
          `flex-wrap`, la poignée et le chevron restaient seuls sur une ligne,
          le titre tombait en dessous (PIEGES § base flex, 2026-07-26). */}
      <div
        className="group flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[10px] px-1 py-1.5 hover:bg-surface-2"
        // ⭐ Le clic droit ouvre le « ⋯ » DE CETTE ÉTAPE (`MenuEtape`) — le même
        // menu, pas un second à tenir d'accord avec lui (règle 18). Au doigt, il
        // ne fait rien : l'appui long n'est pas un clic droit (`lib/menu/tactile`).
        onContextMenu={(e) => {
          if (pointeurGrossier()) return;
          const bouton = e.currentTarget.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]');
          if (!bouton) return;
          e.preventDefault();
          e.stopPropagation();
          bouton.click();
        }}
      >
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

          {/* ⭐ L'ICÔNE DIT LE NIVEAU — le vocabulaire de la carte (DESIGN.md,
              « Les types de nœud ») : dossier pour la phase, cible atténuée pour
              le sous-objectif. Elle remplace la pastille « PHASE », qui était
              la seule différence visible entre les deux (audit D1, point 1). */}
          {/* ⭐ LA COULEUR DIT LA PRIORITÉ (2026-09-30) — la règle du contour de
              la case d'une tâche : rouge élevée, jaune moyenne, neutre faible.
              La FORME dit toujours le niveau. Aucun élément de plus sur la ligne. */}
          <span
            role="img"
            aria-label={`${nomDeGenre(estJalon ? "jalon" : "sous-objectif")} · ${phrasePriorite(etape.priority)}`}
            data-tip={`${nomDeGenre(estJalon ? "jalon" : "sous-objectif")} · ${phrasePriorite(etape.priority)}`}
            data-tip-sub={aideDeGenre(estJalon ? "jalon" : "sous-objectif")}
            data-tip-attente="longue"
            className="flex h-7 w-4 shrink-0 items-center justify-center text-text-dim"
            style={{ color: couleurPriorite(etape.priority) }}
          >
            {estJalon ? <IconFolder className="h-3.5 w-3.5" /> : <IconTarget className="h-3.5 w-3.5" />}
          </span>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
            {renommer ? (
              <ChampLigne
                valeurInitiale={etape.title}
                placeholder={t("Titre de l’étape")}
                onValider={async (titre) => {
                  setRenommer(false);
                  if (titre && titre !== etape.title) {
                    // UNE colonne, jamais la fiche entière (règle 16 du chantier).
                    await renommerObjectif(etape.id, titre);
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
            {etape.deadline && (
              <span className="pill shrink-0 bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-dim">
                {formaterJour(etape.deadline)}
              </span>
            )}
            {m && (origine || compteePar) && (
              <span className="flex w-full min-w-0 items-center gap-1 text-[11px] text-text-dim">
                {/* `max-w-full` + `truncate` : l'origine garde sa place, et se
                    coupe elle-même si elle dépasse la ligne (390 pt). */}
                <span className="max-w-full shrink-0 truncate">
                  {termine && !ouvert && estJalon ? `${t("Terminé")} · ` : ""}
                  {origine}
                </span>
                {/* ⭐ CE QUI COMPTE, nommé (audit D1, point 3) : une étape
                    comptée par une habitude ne la montrait nulle part — il
                    fallait ouvrir l'étape, puis « Atteindre un nombre », puis
                    le menu déroulant. La flamme et le carré sont les icônes de
                    l'habitude et de la tâche sur la carte (DESIGN.md). */}
                {compteePar && (
                  <span className="flex min-w-0 items-center gap-1" data-tip={compteePar.aide}>
                    {origine && <span className="shrink-0">·</span>}
                    {compteePar.habitude ? <IconFlame className="h-3 w-3 shrink-0" /> : <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-current" aria-hidden />}
                    <span className="truncate">{compteePar.nom}</span>
                  </span>
                )}
              </span>
            )}
        </div>

        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <BarreMesure pct={pct} acheve={termine} pourquoi={m ? pourquoiVide(m, estJalon) : null} />

          <MenuEtape
            etape={etape}
            goals={data.goals}
            tasks={data.tasks}
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
          className="ml-3 pb-1.5 sm:ml-9"
          /* ⚠️ Toucher à une étape ouverte D'OFFICE fige son ouverture. Sans ça,
             rattacher l'élément qui la termine la replie sous les doigts, champ
             de saisie compris — vu à l'écran le 2026-09-15 : on tapait dans un
             champ qui venait de disparaître. Le repliement automatique ne vaut
             qu'à l'ouverture de la vue, jamais au milieu d'un geste. */
          onFocusCapture={() => {
            if (replis[cle] === undefined) onReplier(cle, true);
          }}
        >
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
          <PanneauMesure goal={etape} {...p} />
        </div>
      )}
    </div>
  );
}

/**
 * `pourquoi` : ce qui ferait compter une étape vide. Il était écrit en
 * paragraphe sous l'étape dépliée ; depuis le 2026-09-30, il attend dans la
 * bulle du « — », au survol prolongé.
 */
function BarreMesure({ pct, acheve, pourquoi }: { pct: number | null; acheve: boolean; pourquoi: string | null }) {
  return (
    <div
      className="flex w-28 shrink-0 items-center gap-2"
      data-tip={pct == null && pourquoi ? t("Pas encore mesurée") : undefined}
      data-tip-sub={pct == null && pourquoi ? pourquoi : undefined}
      data-tip-attente="longue"
    >
      <div className="pill h-1.5 flex-1 overflow-hidden bg-surface-2">
        {pct != null && (
          <div
            className={`pill h-full transition-[width] duration-500 ${acheve ? "bg-success" : "bg-[image:var(--gradient-brand)]"}`}
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
  /** Pour annoncer les tâches qui partiraient avec elle (2026-09-30). */
  tasks: readonly Task[];
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
  /** Ce qui partirait AVEC elle — sous-étapes et tâches, la règle même de la corbeille. */
  const bilan = bilanDeDepart(goals, props.tasks, etape.id);
  const ia = useIaPossible();
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
  // ⚠️ Le calcul est celui du menu contextuel (`lib/menu/placement.ts`), et
  // plus une copie locale : la version d'ici SUIVAIT le défilement sans borne
  // et recalait de force le menu au bord quand le bouton sortait de l'écran —
  // « visible, ouvert, et invisible » (PIEGES § 16.2). Corrigé le 2026-09-22,
  // au titre de « corriger large » : le défaut n'avait pas encore mordu ici.
  const placer = () => {
    const bouton = racine.current?.getBoundingClientRect();
    const menu = panneau.current?.getBoundingClientRect();
    if (!bouton || !menu) return;
    const p = placerMenu(
      bouton,
      { width: menu.width, height: menu.height },
      { width: window.innerWidth, height: window.innerHeight },
      zoomFactor(),
      "fin",
    );
    if (p === "fermer") return setOuvert(false);
    setPlace(p);
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
          className="card-solid fixed z-50 w-64 rounded-[12px] border border-border p-1 shadow-lg"
          style={place ? { top: place.top, left: place.left } : { top: 0, left: 0, visibility: "hidden" }}
        >
          {/* ⭐ LA PRIORITÉ AU CLIC DROIT (2026-09-30) : le clic droit d'une
              étape ouvre CE menu. Le menu reste ouvert : on voit le choix pris. */}
          <div className="px-2 pb-1.5 pt-1">
            <p className="mb-1 px-1 text-[11px] text-text-dim">{t("Priorité")}</p>
            <ChoixPriorite
              compact
              role="menuitemradio"
              valeur={etape.priority}
              onChange={async (priorite) => {
                if (priorite === etape.priority) return;
                await majFeuilleDeRoute(etape.id, { priority: priorite });
                await refresh();
              }}
            />
          </div>
          <div className="my-1 h-px bg-border" />
          <button type="button" role="menuitem" className={entree} onClick={agir(props.onRenommer)}>
            {t("Renommer")}
          </button>
          {/* Disait « Échéance et description… » : la fenêtre porte aussi la
              priorité depuis le 2026-09-30. */}
          <button type="button" role="menuitem" className={entree} onClick={agir(props.onModifier)}>
            {t("Modifier…")}
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
          {ia && (
            <>
              <div className="my-1 h-px bg-border" />
              {peutDecomposer(etape, goals) && (
                <button
                  type="button"
                  role="menuitem"
                  className={`${entree} flex items-center gap-2`}
                  onClick={agir(() => demanderIa({ action: "decomposer", goalId: etape.id }))}
                >
                  <IconeIa className="h-3.5 w-3.5 shrink-0" />
                  {t("Décomposer avec l'IA…")}
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className={`${entree} flex items-center gap-2`}
                onClick={agir(() => demanderIa({ action: "taches", goalId: etape.id }))}
              >
                <IconeIa className="h-3.5 w-3.5 shrink-0" />
                {t("Proposer des tâches avec l'IA…")}
              </button>
            </>
          )}
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            role="menuitem"
            className={`${entree} ${confirmer ? "bg-red/15 font-semibold text-red" : "text-red"}`}
            onClick={async () => {
              // Une étape sans sous-étape NI tâche part d'un clic : la corbeille
              // et son « Annuler » suffisent. La confirmation reste pour le cas
              // lourd, et dit combien.
              if (!confirmer && bilan.etapes + bilan.taches > 0) return setConfirmer(true);
              setOuvert(false);
              await jeter("goal", etape.id, etape.title, refresh);
            }}
          >
            {confirmer ? t("Confirmer la suppression") : t("Supprimer l’étape")}
          </button>
          {confirmer && (
            <p className="px-3 pb-1 pt-0.5 text-[11px] text-text-dim">
              {/* Disait « ses sous-objectifs remontent d'un niveau » : faux
                  depuis la corbeille (migration 027), ils partent avec elle.
                  Puis « Ses tâches restent » : faux depuis le 2026-09-30. */}
              {annonceDepart("etape", bilan)}
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
  const [priorite, setPriorite] = useState<Priority>("medium");
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
              // ⭐ L'aide, qui était une phrase sous le champ, attend ici (2026-09-30).
              data-tip={nomDeGenre(g)}
              data-tip-sub={aideDeGenre(g)}
              data-tip-attente="longue"
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
            priority: priorite,
          });
          // La ligne suivante s'ouvre, vide : cinq phases se tapent d'affilée.
          // Et « moyenne » : une priorité collée d'une ligne à l'autre en
          // ferait passer cinq en élevée sans qu'on l'ait voulu.
          setCle((c) => c + 1);
          setPriorite("medium");
          await refresh();
        }}
        onAnnuler={fermer}
      />
      {/* ⭐ LA PRIORITÉ DÈS LA CRÉATION (2026-09-30). Elle ne prend pas le focus :
          le champ, qui valide en le perdant, reste celui qui reçoit la frappe. */}
      <PastillePriorite valeur={priorite} onChange={setPriorite} />
      </div>
      {/* L'aide « Une phase regroupe… », écrite ici sous le champ jusqu'au
          2026-09-30, est dans la bulle des boutons « Phase / Sous-objectif ». */}
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
 * ⚠️ On écrit par `daterObjectif`, qui ne touche QUE `deadline` (2026-09-23).
 * La version d'avant passait par `updateGoal` et la fiche complète (`ficheDe`),
 * faute d'une écriture partielle qui connaisse l'échéance (la liste fermée de
 * `majFeuilleDeRoute` ne l'a pas) — donc réécrivait huit colonnes pour une
 * date. Avec la corbeille, un sous-objectif dont le parent est jeté se lit
 * sans parent en mémoire : la fiche complète aurait coupé ce lien pour de bon.
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
          await daterObjectif(etape.id, v || null);
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

function PanneauMesure(props: PropsFeuille & { goal: Goal }) {
  const { goal, data, sources, refresh } = props;
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
    <div className="mt-1 px-1 py-1">
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
              data-tip={x === "elements" ? t("Compter des éléments") : t("Atteindre un nombre")}
              data-tip-sub={
                x === "elements"
                  ? t("L’étape avance à chaque tâche cochée parmi celles qui lui sont rattachées.")
                  : t("L’étape avance vers un nombre que tu fixes : 50 séances, 10 pages… compté à la main, par une tâche récurrente ou par une habitude.")
              }
              data-tip-attente="longue"
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

      {/* Le repli « Avancé / Poids » est retiré le 2026-09-30 : « pas un mode
          avancé avec un poids, on ne sait pas forcément ce que ça veut dire »
          (Antonin). La priorité le remplace (menu « ⋯ », clic droit, Modifier…).
          La colonne `weight` reste en base, à 1 partout. */}
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
  const { etat, basculer } = useCochesOptimistes();
  // ⭐ L'élevée en haut (2026-09-30) ; à priorité égale, l'ordre d'avant (tri stable).
  const taches = data.tasks
    .filter((x) => x.goal_id === goal.id)
    .sort((a, b) => rangPriorite(a.priority) - rangPriorite(b.priority));
  const rattaches = rattachementsDe(uidDeLigne("goal", goal), contexte);

  /**
   * ⭐ LE CLIC DROIT D'UNE TÂCHE, ICI AUSSI (2026-09-30) — le MÊME menu que
   * dans Tâches, Aujourd'hui et le Calendrier (règle 18) : c'est lui qui porte
   * « Priorité ▸ ». Renommer en place n'existe pas sur cette ligne : l'entrée
   * est omise ; « Modifier… » ouvre la tâche dans Tâches, comme le widget
   * d'Aujourd'hui.
   */
  const menu = useMenuContextuel<Task>();
  const ia = useIaPossible();
  const cocher = (tache: Task, faite: boolean) =>
    void basculer(`t${tache.id}`, faite, async (fait) => {
      await basculerTache(tache, todayStr(), fait);
      await refresh();
    });
  const gestes: GestesTache = {
    ...gestesCommunsTache(refresh),
    basculer: (tache) => cocher(tache, etat(`t${tache.id}`, faites.has(tache.id))),
    renommer: () => undefined,
    modifier: (tache) => ouvrirParId("task", tache.id),
  };

  const bouton = "cible-tactile flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-dim hover:bg-surface-2 hover:text-text";

  return (
    <div>
      {/* « Rien de rattaché pour l'instant. » était écrit ici : retiré le
          2026-09-30, les boutons « Tâche » et « Rattacher » juste dessous le
          disent déjà. */}
      <ul>
        {taches.map((tache) => {
          const recurrente = estRecurrente(tache);
          // Une ponctuelle se coche ICI aussi (2026-09-22) : c'est la feuille
          // de route qui dit ce qu'il reste à faire, y aller la cocher dans
          // Tâches était un détour. Une récurrente reste en lecture : elle ne
          // compte jamais comme une unité, la cocher ici ne ferait rien bouger.
          const faite = !recurrente && etat(`t${tache.id}`, faites.has(tache.id));
          return (
            /* ⚠️ `flex-wrap` ET une base flex sur le titre. Sous
               `pointer: coarse`, `.truncate-souris` REND LE RETOUR À LA LIGNE
               (au doigt il n'y a pas de survol, donc un titre coupé l'est sans
               recours) : le titre a alors besoin de toute la largeur, sinon il
               se casse lettre par lettre à côté de sa date. Vu à l'écran sur
               iPhone 390 pt le 2026-09-18 : « Backtesti / ng 1h ».
               Une base flex, jamais `min-w-0` seul : ce dernier ne déclenche
               pas le repli, il comprime (règle du 2026-07-26). */
            <li
              key={`t${tache.id}`}
              className={PASTILLE_ELEMENT}
              onContextMenu={(e) => menu.ouvrirAuPoint(e, tache)}
            >
              {recurrente ? (
                <Coche faite={false} />
              ) : (
                <CaseACocher
                  taille="sm"
                  cochee={faite}
                  libelle={tache.label}
                  anneau={couleurPriorite(tache.priority)}
                  tip={faite ? t("Marquer à faire") : t("Marquer faite")}
                  tipSub={phrasePriorite(tache.priority)}
                  onBascule={() => cocher(tache, faite)}
                />
              )}
              <span className={`min-w-0 flex-1 basis-[9rem] truncate truncate-souris ${faite ? "text-text-dim line-through" : "text-text"}`} title={tache.label}>
                {tache.label}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-2">
              {recurrente ? (
                /* Disait « récurrente, non comptée » en toutes lettres : le ↻
                    suffit, le pourquoi attend dans la bulle (2026-09-30). */
                <span
                  className="shrink-0 text-xs text-text-dim"
                  role="img"
                  aria-label={t("Une tâche récurrente n’est jamais « finie »")}
                  data-tip={t("Une tâche récurrente n’est jamais « finie »")}
                  data-tip-sub={t("Elle ne compte pas comme une unité. Pour la compter, fixe un nombre à atteindre et choisis-la comme source.")}
                  data-tip-attente="longue"
                >
                  ↻
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
            <li key={`${r.kind}:${r.uid}`} className={PASTILLE_ELEMENT}>
              {r.kind === "event" ? (
                <Coche faite={passe} />
              ) : (
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center text-text-dim"
                  data-tip={t("Écrire n’est pas avancer")}
                  data-tip-sub={t("Une note ou une fiche éclaire l’objectif, elle ne le fait pas progresser.")}
                  data-tip-attente="longue"
                >
                  <IconNote className="h-3.5 w-3.5" aria-hidden />
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
              {/* « note, ne compte pas », « fiche, ne compte pas », « récurrent,
                  non compté » : retirés le 2026-09-30. L'icône de note porte le
                  pourquoi dans sa bulle ; un événement garde sa date. */}
              {r.kind === "event" && (
                <span
                  className="shrink-0 text-[10px] text-text-dim"
                  data-tip={recurrent ? t("Un événement qui revient ne compte pas") : undefined}
                  data-tip-attente="longue"
                >
                  {recurrent ? "↻" : evenement ? formaterJour(evenement.date) : ""}
                </span>
              )}
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
      <MenuContextuel
        etat={menu}
        libelle={t("Actions sur « {titre} »", { titre: menu.cible?.label ?? "" })}
        entrees={(() => {
          const fraiche = menu.cible && data.tasks.find((x) => x.id === menu.cible!.id);
          if (!fraiche) return [];
          const faite = !estRecurrente(fraiche) && etat(`t${fraiche.id}`, faites.has(fraiche.id));
          return entreesTache(fraiche, gestes, { faite, objectifs: data.goals, renommable: false, ia });
        })()}
      />
    </div>
  );
}

function Coche({ faite }: { faite: boolean }) {
  return (
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${faite ? "border-success bg-success/20 text-success" : "border-border"}`}
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
            data-tip={t("Le nombre à atteindre")}
            data-tip-sub={t("L’étape commence à compter dès qu’il existe.")}
            data-tip-attente="longue"
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
            placeholder={t("séances, €, pages…")}
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

      {/* « Saisis le nombre à atteindre… » était écrit ici : il est dans la
          bulle du champ « Cible » depuis le 2026-09-30. */}
      {goal.target_count == null ? null : source === "manual" ? (
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

// ─── Le liseré des éléments, et sa légende ───────────────────────────────────

/**
 * La pastille d'une tâche (ou d'une note, d'un événement rattachés) : son
 * propre liseré fin, sur un fond à peine teinté — ce qui la distingue d'une
 * étape au premier coup d'œil (variante D, 2026-10-01).
 */
const PASTILLE_ELEMENT =
  "my-1 flex flex-wrap items-center gap-2 rounded-[8px] border border-border bg-overlay px-2 py-1 text-sm transition-colors hover:border-border-strong";

/**
 * ⭐ LA LÉGENDE — demandée par Antonin avec la variante D : « il faut que
 * quelque part soit noté que le rond est […] le fichier une étape ». Les mêmes
 * icônes que les lignes (dossier, cible, case), une seule fois, en tête.
 * Un NOM pour chaque icône, pas une explication : celles-là restent dans les
 * bulles longues.
 */
function Legende() {
  const item = "inline-flex items-center gap-1";
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-dim" aria-label={t("Légende")}>
      <span className={item}>
        <IconFolder className="h-3.5 w-3.5" aria-hidden /> {nomDeGenre("jalon")}
      </span>
      <span className={item}>
        <IconTarget className="h-3.5 w-3.5" aria-hidden /> {nomDeGenre("sous-objectif")}
      </span>
      <span className={item}>
        <span className="h-3 w-3 rounded-[3px] border-[1.5px] border-current" aria-hidden /> {t("Tâche")}
      </span>
    </p>
  );
}

// ─── Utilitaires ────────────────────────────────────────────────────────────

/**
 * L'habitude ou la tâche récurrente qui compte une étape, relue par son uid —
 * jamais devinée. `null` si l'étape ne compte pas par une source nommée : suivie
 * à la main, sans cible, ou source supprimée (l'origine dit alors « source
 * introuvable »).
 */
function sourceNommee(etape: Goal, data: AppData): { nom: string; habitude: boolean; aide: string } | null {
  if (etape.manual_progress || etape.target_count == null || !etape.count_ref_uid) return null;
  const source = sourceDe(etape);
  if (source === "habit") {
    const h = data.habits.find((x) => uidDeLigne("habit", x) === etape.count_ref_uid);
    return h ? { nom: h.name, habitude: true, aide: t("L’habitude qui compte") } : null;
  }
  if (source === "task") {
    const x = data.tasks.find((y) => uidDeLigne("task", y) === etape.count_ref_uid);
    return x ? { nom: x.label, habitude: false, aide: t("La tâche qui compte") } : null;
  }
  return null;
}

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
