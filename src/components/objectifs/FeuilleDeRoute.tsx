import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { pick, t, tp } from "../../lib/i18n";
import { formaterChamp } from "../../lib/calendrier/champDate";
import { dateDEcheance } from "../../lib/objectifs/echeance";
import { todayStr } from "../../lib/logic";
import {
  basculerTache,
  cocherEtape,
  deleteLink,
  majFeuilleDeRoute,
  rattacherTache,
  reordonnerObjectifs,
  renommerObjectif,
  daterObjectif,
} from "../../lib/repo";
import {
  aideDeNature,
  deplacer,
  deplieParDefaut,
  indexDInsertion,
  nomDeNature,
  origineEnClair,
  pourquoiSansMesure,
  type Replis,
} from "../../lib/objectifs/libelles";
import { compterSource, debutDuCompte, elementsDe, estAcheve, evenementPasse, sourceDe, uidDeLigne, type Mesure, type SourcesProgression } from "../../lib/objectifs/progression";
import { contientDesEtapes, etapesTriees, natureDe, peutAjouterEtape } from "../../lib/objectifs/structure";
import { ajouterEtape } from "../../lib/objectifs/ajouter";
import { aAnnoncer, planConversion } from "../../lib/objectifs/conversion";
import { convertirEnTache } from "./gesteConversion";
import { filDObjectif, type Fil } from "../../lib/objectifs/fil";
import { estRecurrente } from "../../lib/taches";
import { zoomFactor } from "../../lib/uiConfig";
import type { AppData, Goal, Task } from "../../lib/types";
import { rattachementsDe, type ContexteObjectifs } from "../../lib/objectifs/contexte";
import { ouvrirObjet } from "../../lib/naviguer";
import { IconCheck, IconChevronDown, IconChevronRight, IconEtape, IconFlame, IconFolder, IconNote, IconX } from "../icons";
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
import MenuContextuel, { BoutonMenu } from "../menu/MenuContextuel";
import { useMenuContextuel } from "../menu/useMenuContextuel";
import { entreesTache, gestesCommunsTache, type GestesTache } from "../menu/catalogue/tache";
import { ouvrirParId } from "../../lib/naviguer";
import { useIaPossible } from "../../lib/ia/useIa";
import { useGesteFocus } from "../../lib/seance/gesteFocus";
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
 *   • chaque ligne dit d'où vient son pourcentage (`origineEnClair`) : combien
 *     d'étapes et de tâches, et combien de FAITES ;
 *   • ⭐ 2026-10-11 — UNE ÉTAPE VIDE SE COCHE (`LigneEtape`). Antonin : « Pour
 *     les étapes vides, donne la possibilité de cocher une étape pour que ce
 *     soit compté. » Elle porte la case de l'app (`CaseACocher`) devant son
 *     titre, et sa barre dit 0 % ou 100 % — plus jamais « — ». Dès qu'elle
 *     reçoit une tâche, une sous-étape ou une cible, la case s'en va : ce
 *     qu'elle contient la mesure. La règle est dans `progression.ts` ;
 *   • ⭐ 2026-10-11 — UNE TÂCHE S'AJOUTE À L'OBJECTIF LUI-MÊME (audit A06a-12) :
 *     « ＋ Tâche » et « Rattacher » vivent à côté d'« ＋ Étape », avec ou sans
 *     étapes. Un objectif simple se réduit à trois tâches ;
 *   • ⭐ 2026-10-12 — UNE CHOSE À FAIRE EST UNE TÂCHE, PAS UNE ÉTAPE VIDE.
 *     Antonin : « cocher une étape sans tâche n'a pas tellement de sens. Dans
 *     ce cas, l'étape est une tâche. » Donc : « Tâche » est le PREMIER bouton
 *     de chaque rangée d'ajout ; « Étape » vient ensuite, et sa bulle dit ce
 *     qu'elle est (ce qui regroupe des tâches) ; une étape vide porte, sur sa
 *     ligne, « En faire une tâche » (`gesteConversion.tsx`). Sa case reste
 *     (la règle de calcul ne change pas), mais ce n'est plus elle qu'on montre ;
 *   • ⭐ 2026-10-12 — « ÉTAPE », ET « PHASE » QUAND ELLE EN CONTIENT D'AUTRES.
 *     Le genre ne se choisit plus (« Phase | Sous-objectif ») : on ajoute une
 *     étape, et c'est le CONTENU qui nomme la ligne, dessine son cadre et son
 *     icône (`natureDe`, `lib/objectifs/structure.ts`). Ajouter une étape sous
 *     une étape en fait une phase. « Sous-objectif » n'est plus écrit nulle part ;
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
  /** Le champ ouvert d'office : geste « Ajouter une tâche » ou « Ajouter une étape » du menu de l'objectif. */
  ajoutOuvert: "tache" | "etape" | null;
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
          {/* « Directement » ne dit quelque chose qu'à côté d'étapes : un
              objectif fait de trois tâches n'a pas besoin du mot. */}
          {etapes.length > 0 && <p className="hud-label mb-1 pt-1">{t("Rattaché directement")}</p>}
          <ListeElements goal={racine} data={data} contexte={p.contexte} maintenant={p.sources.maintenant} refresh={refresh} />
        </div>
      )}

      {/* « Ajouter » est une place encore vide SUR le chemin : son nœud est en
          tirets, et le fil ne le traverse en plein qu'une fois l'objectif
          atteint.
          ⭐ 2026-10-11 (audit A06a-12) — CE QUI S'AJOUTE À L'OBJECTIF LUI-MÊME
          tient sur UNE rangée : une étape, une tâche, un rattachement. Avant,
          « ＋ Tâche » et « Rattacher » n'existaient que dans une étape dépliée :
          un objectif sans étape ne pouvait recevoir une tâche que depuis sa
          fenêtre de création, la vue Tâches ou la carte mentale. */}
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
        <BarreAjout
          goal={racine}
          data={data}
          contexte={p.contexte}
          refresh={refresh}
          surObjectif
          ouvertDOffice={p.ajoutOuvert}
          onFermeDOffice={p.onFermerAjout}
          etape={{
            tip: aideDeNature("etape"),
            champ: (fermer) => <ChampEtape parent={racine} goals={data.goals} refresh={refresh} onFermer={fermer} />,
          }}
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
            <div className="pointer-events-none absolute inset-x-2 -top-px h-0.5 rounded bg-accent" aria-hidden />
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
        <div className="pointer-events-none mx-2 h-0.5 rounded bg-accent" aria-hidden />
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
  // ⭐ CE QUE LA LIGNE EST, D'APRÈS CE QU'ELLE CONTIENT (2026-10-12) : une
  // phase si elle porte des étapes, une étape sinon. Le mot, le cadre, l'icône
  // et le dépliage en découlent ; `is_milestone` n'est plus lu.
  const nature = natureDe(etape, data.goals);
  const estPhase = nature === "phase";
  const enfants = etapesTriees(etape.id, data.goals);
  const cle = `g${etape.id}`;
  const ouvert =
    replis[cle] ??
    deplieParDefaut(
      etape,
      freres,
      (id) => {
        const x = mesures.get(id);
        return !!x && estAcheve(x);
      },
      (id) => contientDesEtapes({ id }, data.goals),
    );
  const [renommer, setRenommer] = useState(false);
  const compteePar = sourceNommee(etape, data);
  const origine = m ? origineEnClair(m) : "";

  /**
   * ⭐ L'ÉTAPE VIDE SE COCHE (2026-10-11). `mesurer` dit si elle est une unité
   * (ni sous-étape, ni élément comptable, ni cible, pas suivie à la main) ; la
   * vue ne le redécide pas. La bascule est optimiste, comme pour une tâche : la
   * case, la barre et le titre suivent le clic, la base suit.
   * Un geste = une fonction : la case et l'entrée du menu « ⋯ » appellent `cocher`.
   */
  const { etat, basculer } = useCochesOptimistes();
  const unite = m?.origine.type === "unite" ? m.origine : null;
  const cochee = !!unite && etat(cle, unite.faite);
  const cocher = unite
    ? () =>
        void basculer(cle, unite.faite, async (faite) => {
          await cocherEtape(etape.id, faite);
          await refresh();
        })
    : null;
  const pct = unite ? (cochee ? 100 : 0) : (m?.pct ?? null);
  const termine = unite ? cochee : !!m && estAcheve(m);

  /**
   * ⭐ « EN FAIRE UNE TÂCHE » (2026-10-12) — une étape vide est une chose à
   * faire : elle devient une vraie tâche, rattachée au parent. `planConversion`
   * (pur) pose la même question que la case — « est-ce une unité ? » — et dit
   * ce qui ne suivrait pas : la DESCRIPTION (une tâche n'en a pas) et les
   * CITATIONS de l'étape dans le texte d'une note. Dans ces cas, et dans ces
   * cas seulement, on le dit AVANT.
   * Un geste = une fonction : le bouton de la ligne et l'entrée du menu « ⋯ »
   * appellent `demanderConversion`.
   */
  const plan = unite ? planConversion(etape.id, p.sources) : null;
  const pret = plan && !("refus" in plan) ? plan : null;
  const convertible = !!pret;
  const laisse = !!pret && aAnnoncer(pret);
  const [aConfirmer, setAConfirmer] = useState(false);
  const [conversion, setConversion] = useState(false);
  const convertir = async () => {
    if (conversion) return;
    setConversion(true);
    setAConfirmer(false);
    try {
      await convertirEnTache(etape, refresh);
    } finally {
      setConversion(false);
    }
  };
  const demanderConversion = convertible ? () => (laisse ? setAConfirmer(true) : void convertir()) : null;

  return (
    <div
      data-frere-de={etape.parent_goal_id ?? ""}
      data-etape={etape.id}
      /* ⭐ UN LISERÉ PAR TYPE (2026-10-01, variante D choisie par Antonin sur
         quatre maquettes : « pour bien voir la distinction entre chaque item
         sans se perdre »). Phase : cadre marqué ; étape : cadre en
         pointillé ; tâche : sa propre pastille (`ListeElements`). La légende
         en tête de la feuille de route dit lequel est lequel. */
      className={`mb-2 px-1.5 py-1 ${
        estPhase
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

          {/* ⭐ L'ICÔNE DIT LA NATURE — le vocabulaire de la carte (DESIGN.md,
              « Les types de nœud ») : dossier pour la phase, losange pour
              l'étape. Jusqu'au 2026-10-12 l'étape portait la cible de
              l'objectif, en plus pâle (labo, constat 22). */}
          {/* ⭐ LA COULEUR DIT LA PRIORITÉ (2026-09-30) — la règle du contour de
              la case d'une tâche : rouge élevée, jaune moyenne, neutre faible.
              La FORME dit toujours le niveau. Aucun élément de plus sur la ligne. */}
          <span
            role="img"
            aria-label={`${nomDeNature(nature)} · ${phrasePriorite(etape.priority)}`}
            data-tip={`${nomDeNature(nature)} · ${phrasePriorite(etape.priority)}`}
            data-tip-sub={aideDeNature(nature)}
            data-tip-attente="longue"
            className="flex h-7 w-4 shrink-0 items-center justify-center text-text-dim"
            style={{ color: couleurPriorite(etape.priority) }}
          >
            {estPhase ? <IconFolder className="h-3.5 w-3.5" /> : <IconEtape className="h-3.5 w-3.5" />}
          </span>

          {/* La case d'une étape vide : la même que celle d'une tâche, à la
              même place (devant le nom). Elle disparaît dès que l'étape a de
              quoi se mesurer.
              ⚠️ 2026-10-12 : elle RESTE (vide = 0, cochée = 100 %), mais ce
              n'est plus la façon normale de faire. Sa bulle renvoie au geste
              qu'on montre : « En faire une tâche », à droite de la ligne. */}
          {cocher && (
            <span className="mx-1 flex shrink-0 items-center">
              <CaseACocher
                taille="sm"
                cochee={cochee}
                libelle={etape.title}
                tip={cochee ? t("Marquer à faire") : t("Marquer faite")}
                tipSub={t("Une chose à faire est une tâche : « En faire une tâche » la range dans Tâches et le Calendrier.")}
                onBascule={cocher}
              />
            </span>
          )}

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
                // 44 pt de haut au doigt (le titre mesurait 20 px), repris en
                // marge négative : la ligne de l'étape ne s'écarte pas pour autant.
                className={`cible-tactile-ligne truncate truncate-souris text-left text-sm [@media(pointer:coarse)]:-my-2.5 ${termine ? "text-text-dim" : "text-text"}`}
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
                  {termine && !ouvert && estPhase ? `${t("Terminé")} · ` : ""}
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
          {/* ⭐ SUR LA LIGNE, pas seulement dans le « ⋯ » : c'est le geste qu'on
              veut voir devant une étape vide. Le carré est l'icône de la tâche. */}
          {demanderConversion && (
            <button
              type="button"
              onClick={demanderConversion}
              disabled={conversion}
              className="cible-tactile-ligne flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-accent hover:bg-surface disabled:opacity-40"
              data-tip={t("Une étape sans rien dedans est une chose à faire")}
              data-tip-sub={t("Elle devient une tâche de « {parent} » : dans Tâches, le Calendrier, Aujourd’hui et le minuteur.", {
                parent: data.goals.find((g) => g.id === etape.parent_goal_id)?.title ?? "",
              })}
              data-tip-attente="longue"
            >
              <span className="h-3 w-3 shrink-0 rounded-[3px] border-[1.5px] border-current" aria-hidden />
              {t("En faire une tâche")}
            </button>
          )}
          <BarreMesure pct={pct} acheve={termine} pourquoi={m ? pourquoiSansMesure(m) : null} />

          <MenuEtape
            etape={etape}
            coche={cocher ? { faite: cochee, basculer: cocher } : null}
            convertir={demanderConversion}
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

      {/* ⭐ CE QUI NE SUIT PAS SE DIT AVANT (2026-10-12). Une tâche n'a pas de
          description : celle de l'étape reste avec elle, dans Supprimés
          récemment. Une note qui CITE l'étape dans son texte garde sa
          citation telle quelle. Le reste — titre, échéance, priorité, coche,
          ce qui lui était rattaché — suit, et « Annuler » rend tout. */}
      {aConfirmer && (
        <div
          role="group"
          aria-label={t("En faire une tâche")}
          className="mx-1 mb-1 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[8px] bg-surface-2 px-2.5 py-2 text-xs text-text-dim"
          onKeyDown={(e) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            setAConfirmer(false);
          }}
        >
          <span className="min-w-0 flex-1 basis-[14rem]">
            {pret?.description && t("Sa description ne suit pas : une tâche n’en a pas. Elle reste avec l’étape, dans Supprimés récemment.")}
            {pret?.description && !!pret.citations && " "}
            {!!pret?.citations &&
              tp(
                pret.citations,
                "Citée {n} fois dans tes notes ou tes fiches : cette citation ne suivra pas la tâche.",
                "Citée {n} fois dans tes notes ou tes fiches : ces citations ne suivront pas la tâche.",
              )}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAConfirmer(false)}
              className="pill cible-tactile-ligne px-3 py-1.5 font-medium text-text-dim hover:text-text"
            >
              {t("Annuler")}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => void convertir()}
              className="pill cible-tactile-ligne fill-primary px-3 py-1.5 font-semibold"
            >
              {t("En faire une tâche")}
            </button>
          </span>
        </div>
      )}

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
          {/* « Ajouter un sous-objectif », seul sur sa ligne jusqu'au
              2026-10-12, a rejoint la rangée d'ajout de l'étape (`PanneauMesure`
              → `BarreAjout`) : « Tâche · Étape · Rattacher », la tâche d'abord. */}
          <EcheanceEtape etape={etape} acheve={termine} maintenant={p.sources.maintenant} refresh={refresh} />
          <PanneauMesure goal={etape} {...p} />
        </div>
      )}
    </div>
  );
}

/**
 * `pourquoi` : ce qui est cassé, quand l'étape n'a pas de mesure (cible à zéro,
 * source supprimée). Il attend dans la bulle du « — », au survol prolongé.
 * ⚠️ Depuis le 2026-10-11, une étape VIDE n'affiche plus « — » : elle se coche,
 * et sa barre dit 0 % ou 100 %.
 */
function BarreMesure({ pct, acheve, pourquoi }: { pct: number | null; acheve: boolean; pourquoi: string | null }) {
  return (
    <div
      className="flex w-28 shrink-0 items-center gap-2"
      data-tip={pct == null && pourquoi ? t("Ne se mesure pas") : undefined}
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
  /** L'étape est vide : elle se coche. `null` quand elle se mesure autrement. */
  coche: { faite: boolean; basculer: () => void } | null;
  /** L'étape est vide : elle peut devenir une tâche. Le MÊME geste que le bouton de la ligne. */
  convertir: (() => void) | null;
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
   * rectangle de la dernière entrée du menu à 1 025 px dans une fenêtre de
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
          {/* Le même geste que le bouton de la ligne (règle 18) — et en tête :
              c'est ce qu'on fait d'une étape vide. La coche vient après. */}
          {props.convertir && (
            <button type="button" role="menuitem" className={entree} onClick={agir(props.convertir)}>
              {t("En faire une tâche")}
            </button>
          )}
          {/* Le même geste que la case de la ligne (règle 18). */}
          {props.coche && (
            <button type="button" role="menuitem" className={entree} onClick={agir(props.coche.basculer)}>
              {props.coche.faite ? t("Marquer à faire") : t("Marquer faite")}
            </button>
          )}
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
          {/* « En faire une phase » et « Redevenir un sous-objectif » sont
              partis le 2026-10-12 : une étape EST une phase dès qu'elle en
              contient d'autres, il n'y a plus rien à déclarer. */}
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
              {/* Disait que ses étapes remontaient d'un niveau : faux depuis la
                  corbeille (migration 027), elles partent avec elle.
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

/**
 * Le champ d'une étape neuve : son nom, sa priorité. Il vit dans la rangée
 * d'ajout (`BarreAjout`), à côté de « ＋ Tâche » et « Rattacher ».
 *
 * ⚠️ PLUS DE GENRE À CHOISIR (2026-10-12). Deux boutons « Phase |
 * Sous-objectif » précédaient le champ : on ajoute UNE ÉTAPE, et c'est ce
 * qu'elle contiendra qui la nommera. Posée sous une étape, elle en fait une
 * phase (`lib/objectifs/ajout.ts`).
 */
function ChampEtape(props: {
  parent: Goal;
  goals: Goal[];
  refresh: () => Promise<void>;
  onFermer: () => void;
}) {
  const { parent, goals, refresh } = props;
  const [priorite, setPriorite] = useState<Priority>("medium");
  const [cle, setCle] = useState(0);
  const fermer = props.onFermer;

  if (!peutAjouterEtape(parent, goals)) return null;

  return (
    <div className="px-1 py-1">
      <div className="flex flex-wrap items-center gap-2">
      <ChampLigne
        key={cle}
        placeholder={t("Nom de l’étape — Entrée pour valider et continuer")}
        onValider={async (titre) => {
          if (!titre) return fermer();
          await ajouterEtape(parent, titre, goals, { priorite });
          // La ligne suivante s'ouvre, vide : cinq étapes se tapent d'affilée.
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
          // ⚠️ UNE validation à la fois (audit du 2026-10-20, objectifs-13). Le
          // drapeau ne gardait que la perte du focus : deux Entrée rapprochées
          // (ou une touche qui rebondit) appelaient deux fois `onValider`
          // pendant que la première écriture tournait — l'étape naissait en
          // double. Le champ est remonté (`key`) ou retiré une fois validé.
          if (fini.current || e.repeat) return;
          fini.current = true;
          // Une écriture qui échoue rend la main : le champ reste, Entrée
          // peut réessayer.
          Promise.resolve(props.onValider(valeur.trim())).catch((err) => {
            fini.current = false;
            console.error(err);
          });
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
      className="min-w-0 flex-1 basis-[14rem] rounded-[8px] border border-accent bg-surface-2 px-2.5 py-1.5 text-sm text-text placeholder:text-text-dim focus:outline-none"
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
 * date. Avec la corbeille, une étape dont le parent est jeté se lit
 * sans parent en mémoire : la fiche complète aurait coupé ce lien pour de bon.
 */
function EcheanceEtape(props: { etape: Goal; acheve: boolean; maintenant: string; refresh: () => Promise<void> }) {
  const { etape } = props;
  const jour = props.maintenant.slice(0, 10);
  // ⚠️ Une étape TERMINÉE n'est pas en retard, elle est faite — la règle de la
  // ligne de tâche voisine et de `carteEtat` (audit du 2026-10-20, objectifs-12 :
  // « En retard » en rouge sous une étape à 100 %).
  const enRetard = !props.acheve && !!etape.deadline && etape.deadline < jour;
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
        className="cible-tactile-ligne flex shrink-0 items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-left text-sm text-text transition-colors hover:border-border-strong focus:border-accent focus:outline-none"
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
          className="font-medium text-accent hover:underline"
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
              className={`cible-tactile px-2.5 py-1 font-medium ${mode === x ? "bg-accent/15 text-accent" : "text-text-dim hover:text-text"}`}
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
        <>
          <ReglageCible goal={goal} data={data} sources={sources} refresh={refresh} />
          {/* ⭐ LES TÂCHES RESTENT À L'ÉCRAN (audit du 2026-10-20, constat
              d'usage 29). « Atteindre un nombre » REMPLAÇAIT la liste : les
              tâches de l'étape existaient toujours (dans Tâches, rattachées),
              mais on ne les voyait plus d'ici, et on ne pouvait plus en
              ajouter. Elles comptent quand la cible est « comptée par ses
              tâches ». Pas de bouton « Étape » : une étape chiffrée ne lit pas
              ses sous-étapes. */}
          <div className="mt-2">
            <ListeElements
              goal={goal}
              data={data}
              contexte={props.contexte}
              maintenant={sources.maintenant}
              refresh={refresh}
              avecRattachement
              sansEtape
            />
          </div>
        </>
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
  /** Pas de bouton « Étape » dans la rangée d'ajout (une étape chiffrée ne lit pas ses sous-étapes). */
  sansEtape?: boolean;
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
  const gesteFocus = useGesteFocus();
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
    // « Focus 25 min » manquait au menu d'une tâche d'objectif (2026-10-12).
    focus: gesteFocus,
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
              className={`group/ligne ${PASTILLE_ELEMENT}`}
              onContextMenu={(e) => menu.ouvrirAuPoint(e, tache)}
              // Maj+F10 / touche Menu : macOS n'en fait pas un clic droit, on
              // l'écoute nous-mêmes (PIEGES § 19.2).
              onKeyDown={(e) => void menu.ouvrirAuClavier(e, tache)}
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
              {/* ⭐ LE « ⋯ » DE LA TÂCHE (audit du 2026-10-20, objectifs-6 ;
                  règle 17). Le clic droit était le SEUL accès au menu : au
                  doigt il ne fait rien (`ouvrirAuPoint` s'efface devant un
                  pointeur grossier), et Maj+F10 n'arrivait pas. Depuis la page
                  d'un objectif, une tâche ne se modifiait, ne se datait, ne
                  changeait d'état ni ne se supprimait. Visible au repos, comme
                  sur toutes les lignes de tâche (`visible`). */}
              <BoutonMenu
                visible
                onOuvrir={(e) => menu.ouvrirSousLeBouton(e, tache)}
                ouvert={menu.ouvert && menu.cible?.id === tache.id}
                libelle={t("Actions sur « {titre} »", { titre: tache.label })}
              />
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
      {/* ⭐ La rangée d'ajout d'une étape : « Tâche » d'abord (2026-10-12). Au
          niveau 1, « Étape » aussi : une étape posée sous celle-ci en fait une
          phase. Au niveau 2, on est au fond : il ne reste que des tâches. */}
      {props.avecRattachement && (
        <BarreAjout
          goal={goal}
          data={data}
          contexte={contexte}
          refresh={refresh}
          etape={
            !props.sansEtape && peutAjouterEtape(goal, data.goals)
              ? {
                  tip: t("Une étape sous celle-ci, pour regrouper des tâches"),
                  champ: (fermer) => <ChampEtape parent={goal} goals={data.goals} refresh={refresh} onFermer={fermer} />,
                }
              : undefined
          }
        />
      )}
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
  /** Les tâches ponctuelles de l'étape — celles qui comptent « par ses tâches ». */
  const aDesTaches = data.tasks.some((x) => x.goal_id === goal.id && !estRecurrente(x));
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
              if (!Number.isFinite(v) || v === goal.target_count) return;
              // ⭐ Le PREMIER nombre d'une étape qui a déjà des tâches : elles
              // le comptent (2026-10-20, constat 29). On passait l'étape en
              // « à la main », et cocher ses tâches ne faisait plus rien.
              const parSesTaches = goal.target_count == null && source === "manual" && aDesTaches;
              void ecrire(parSesTaches ? { target_count: v, count_source: "elements" } : { target_count: v });
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
            <option value="elements">{t("par ses tâches")}</option>
            <option value="task" disabled={recurrentes.length === 0}>{t("par une tâche récurrente")}</option>
            <option value="habit" disabled={habitudes.length === 0}>{t("par une habitude")}</option>
          </select>
        </label>
      </div>

      {/* « Saisis le nombre à atteindre… » était écrit ici : il est dans la
          bulle du champ « Cible » depuis le 2026-09-30. */}
      {goal.target_count == null ? null : source === "elements" ? (
        // ⭐ Un compte LU : chaque tâche cochée ci-dessous l'avance d'un.
        <span>
          {/* Pas `tp()` : en français, zéro s'accorde au singulier (« 0 tâche faite »). */}
          {(compte ?? 0) === 1 || ((compte ?? 0) === 0 && pick(true, false))
            ? t("{n} tâche faite sur {cible}", { n: compte ?? 0, cible: goal.target_count })
            : t("{n} tâches faites sur {cible}", { n: compte ?? 0, cible: goal.target_count })}
        </span>
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
 * icônes que les lignes (dossier, losange, case), une seule fois, en tête.
 * Un NOM pour chaque icône, pas une explication : celles-là restent dans les
 * bulles longues.
 *
 * 2026-10-12 : « Phase · Sous-objectif · Tâche » est devenu « Phase · Étape ·
 * Tâche », et l'étape a son icône (le losange, plus la cible de l'objectif).
 */
function Legende() {
  const item = "inline-flex items-center gap-1";
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-dim" aria-label={t("Légende")}>
      <span className={item} data-tip={aideDeNature("phase")} data-tip-attente="longue">
        <IconFolder className="h-3.5 w-3.5" aria-hidden /> {nomDeNature("phase")}
      </span>
      <span className={item} data-tip={aideDeNature("etape")} data-tip-attente="longue">
        <IconEtape className="h-3.5 w-3.5" aria-hidden /> {nomDeNature("etape")}
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

/**
 * Une date au fil d'une ligne de la feuille de route : l'échéance d'une étape,
 * la date d'un événement rattaché, le début d'un compte.
 *
 * ⭐ 2026-10-12 — L'ANNÉE paraît dès que ce n'est pas l'année en cours : la
 * pastille d'une étape écrivait « 12 février » pour février 2027 (labo, seconde
 * passe, rang 8). Une seule écriture pour toute l'app : `dateDEcheance`
 * (`lib/objectifs/echeance.ts`), qui passe par `formaterDansPhrase`.
 */
function formaterJour(jour: string): string {
  const aujourdHui = todayStr();
  return dateDEcheance(jour || aujourdHui, aujourdHui);
}
