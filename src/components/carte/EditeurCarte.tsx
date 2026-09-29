import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  agencer,
  ajouterEnfant,
  ajouterFrere,
  annuler,
  appliquer,
  basculerPli,
  deplacer,
  enfantsDe,
  glisserNoeud,
  historiqueDe,
  coteEtProfondeur,
  noeudDe,
  poserCote,
  poserReference,
  positionsManuelles,
  racineDe,
  rendreSvg,
  renommer,
  reorganiser,
  retablir,
  ecrireCarte,
  sousArbre,
  supprimerNoeud,
  typeDeNoeud,
  voisin,
  type Carte,
  type Direction,
  type KindCarte,
  type RefNoeud,
  type TypeDonnable,
} from "../../lib/carte";
import { fusionnerCarteObjectif } from "../../lib/objectifs/carte";
import { etatsVivants, type EtatVivant } from "../../lib/carteEtat";
import { addDays, todayStr } from "../../lib/logic";
import { allerVers } from "../../lib/naviguer";
import type { ContexteObjectifs } from "../../lib/objectifs/contexte";
import type { AppData } from "../../lib/types";
import EtatsVivants from "./EtatsVivants";
import PanneauType from "./PanneauType";
import { pngDeCarte, svgExportable } from "../../lib/carteDom";
import { requeteEnCours } from "../../lib/mentions";
import { basculerTache, fetchAll, fetchContexteObjectifs, rechercherPartout } from "../../lib/repo";
import { enregistrerFichier } from "../../lib/fichiers";
import { zoomFactor } from "../../lib/uiConfig";
import type { Trouvaille } from "../../lib/recherche";
import type { LinkKind } from "../../lib/types";
import MentionPicker from "../liens/MentionPicker";
import DepuisCarte from "../objectifs/DepuisCarte";
import {
  IconArobase,
  IconCheck,
  IconCheckCircle,
  IconCote,
  IconExpand,
  IconExternal,
  IconFlame,
  IconFolder,
  IconLink,
  IconNoeudEnfant,
  IconNoeudFrere,
  IconPencil,
  IconPlier,
  IconReset,
  IconSave,
  IconSliders,
  IconTarget,
  IconTrash,
  IconX,
  IconZoomMoins,
  IconZoomPlus,
} from "../icons";
import { t, tp } from "../../lib/i18n";
import MenuContextuel from "../menu/MenuContextuel";
import { IconPoints } from "../menu/icones";
import { useMenuContextuel } from "../menu/useMenuContextuel";
import { menuContextuelOuvert } from "../../lib/menu/tactile";
import type { EntreePossible } from "../../lib/menu/entrees";
import { kbd } from "../../lib/platform";

/**
 * L'éditeur de carte mentale — plein écran, au-dessus de la note.
 *
 * ⚠️ PLEIN ÉCRAN, ET CE N'EST PAS DU CONFORT. Une carte se construit en
 * regardant l'ensemble ; un éditeur logé dans une colonne de note obligerait à
 * défiler pour voir ce qu'on vient d'ajouter. Le lecteur immersif du Savoir et
 * `SketchPad` ont tranché pareil, et pour la même raison.
 *
 * ⚠️ TOUT LE MODÈLE VIT DANS `lib/carte.ts`, en fonctions pures et testées. Ce
 * composant ne fait que trois choses : montrer, écouter, et transmettre. C'est
 * délibéré — le § 7.1 de `PIEGES.md` rappelle qu'aucun test de ce dépôt ne
 * prouve une interface, donc tout ce qui peut sortir d'ici doit en sortir.
 */

/** Ce qu'un nœud de la carte d'un objectif peut recevoir comme enfant. */
export type EnfantObjectif = "phase" | "sous-objectif" | "tache" | "habitude";

/**
 * ⭐ LA CARTE D'UN OBJECTIF, ÉDITABLE (2026-09-29) — une seconde vue du même
 * plan que la feuille de route, modifiable des deux côtés.
 *
 * Chaque geste ÉCRIT UN OBJET, par le chemin normal de l'app, puis la carte est
 * re-dérivée des données (`carteDObjectif`). Rien n'est gardé dans un JSON de
 * carte : il n'y en a pas, la feuille de route reste l'unique auteur des nœuds.
 * Seules les POSITIONS posées à la main vivent ailleurs — dans un réglage, par
 * `onEnregistrer` (décision B).
 */
export interface GestesObjectif {
  /** Ce que ce nœud peut accueillir — vide pour une tâche, une habitude, une note. */
  enfantsPossibles: (ref: RefNoeud) => EnfantObjectif[];
  creer: (parent: RefNoeud, type: Exclude<EnfantObjectif, "habitude">, titre: string) => Promise<void>;
  renommer: (ref: RefNoeud, titre: string) => Promise<void>;
  /** Supprime l'OBJET (deux temps, puis « Supprimés récemment ») — ou DÉTACHE une note rattachée. */
  supprimer: (ref: RefNoeud, parent: RefNoeud | null, titre: string) => Promise<void>;
}

/** Les familles qui SONT un morceau de l'objectif — les autres y sont seulement rattachées. */
const KINDS_OBJETS: readonly string[] = ["goal", "task", "habit"];

interface Props {
  titre: string;
  carte: Carte;
  /** L'objet qui PORTE la carte : on ne se propose pas à soi-même dans le `@`. */
  source?: { kind: LinkKind; uid: string };
  /**
   * Appelé à chaque enregistrement automatique ET à la fermeture.
   * ⚠️ L'appelant écrit dans le corps de la note : il doit être idempotent.
   * Absent en LECTURE : il n'y a alors rien à enregistrer.
   */
  onEnregistrer?: (carte: Carte) => void;
  /**
   * ⭐ LECTURE SEULE — la carte se regarde, elle ne s'écrit pas ici.
   *
   * C'est le mode de la feuille de route d'un objectif
   * (`components/objectifs/CarteObjectif.tsx`) : la carte y est DÉRIVÉE des
   * objectifs et des tâches, donc son seul auteur légitime est la feuille de
   * route. Laisser les gestes d'édition actifs aurait produit exactement le
   * pire écran possible — on tape, ça se dessine, et rien n'est gardé.
   *
   * Ce que la lecture garde : le zoom, le panoramique, « tout voir », les
   * flèches, le repli (une vue, pas une donnée), l'export, et le clic qui OUVRE
   * l'objet du nœud. Ce qu'elle retire : créer, renommer, citer, supprimer,
   * déplacer, changer de côté, annuler.
   */
  lecture?: boolean;
  onFermer: () => void;
  /** Clic sur un nœud-référence. Sans elle, le nœud n'ouvre rien. */
  onOuvrirRef?: (kind: LinkKind, uid: string) => void;
  /** Présent = carte d'un OBJECTIF, éditable (voir `GestesObjectif`). */
  objectif?: GestesObjectif;
}

/**
 * Ouvrir la cible d'un nœud REFERME la carte.
 *
 * ⚠️ Vu à l'écran le 2026-09-07 : sans cela, la demande de navigation partait
 * bien, la vue changeait DERRIÈRE — et l'utilisateur restait devant la carte
 * plein écran, persuadé que le clic n'avait rien fait. Une navigation qu'on ne
 * voit pas est une navigation qui n'a pas eu lieu.
 */

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
/** Au-delà, un geste au doigt est un défilement, pas un glissement (§ 7.4 ter). */
const APPUI_LONG_MS = 400;
/** Sous ce déplacement, on considère qu'on a cliqué, pas glissé. */
const SEUIL_GLISSE = 5;
/** Un cran de zoom au bouton — la molette, elle, est continue. */
const PAS_ZOOM = 1.25;
/**
 * Largeur minimale du champ de saisie, en pixels de la feuille logique.
 *
 * ⚠️ Le champ est PLUS LARGE que la boîte du nœud tant qu'on n'a pas validé :
 * l'agencement, lui, ne connaît que le texte enregistré. Deux endroits doivent
 * s'accorder là-dessus — le champ qui se pose, et l'effet qui le garde à
 * l'écran — d'où cette constante plutôt que deux `160` qui se perdraient.
 */
const LARGEUR_CHAMP_MIN = 160;

const OUTIL =
  "pill flex h-8 items-center gap-1.5 px-3 text-xs font-medium text-text-dim transition-colors hover:bg-overlay hover:text-text disabled:opacity-30";

/**
 * Un bouton de la barre d'outils : une icône, un mot, et une bulle qui explique.
 *
 * ⚠️ L'INFO-BULLE EST PORTÉE PAR LE `<span>`, jamais par le bouton. Un bouton
 * `disabled` ne reçoit aucun événement de survol (piège consigné dans
 * `CLAUDE.md`, section « Hover Hints ») : la bulle disparaîtrait exactement
 * quand elle sert le plus, c'est-à-dire pour dire POURQUOI c'est grisé.
 *
 * ⚠️ LE MOT DISPARAÎT SOUS 640 px, PAS SUR L'ÉCRAN D'ANTONIN. Sur un viewport
 * de 390 pt, sept boutons légendés se replient sur quatre lignes et la barre
 * mange 40 % de la fenêtre : il ne reste presque plus de carte à regarder. Le
 * `aria-label` est donc posé TOUJOURS, pas seulement en mode icône seule —
 * sinon le bouton devient muet pour un lecteur d'écran exactement là où il
 * devient muet pour l'œil.
 */
function Outil({
  libelle,
  aide,
  raccourci,
  onClick,
  disabled,
  iconeSeule,
  danger,
  children,
}: {
  libelle: string;
  aide: string;
  raccourci?: string;
  /** Reçoit l'événement : le « ⋯ » en a besoin pour ancrer son menu sous lui. */
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  /** Le bouton est ARMÉ : un second clic détruit. Rouge plein, et il garde son mot. */
  danger?: boolean;
  /** Le zoom seulement : deux loupes se lisent sans légende, et la place manque. */
  iconeSeule?: boolean;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex" data-tip={libelle} data-tip-sub={aide} data-tip-kbd={raccourci}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={libelle}
        className={
          danger
            ? `${OUTIL} bg-red px-3 text-white hover:bg-red hover:text-white`
            : iconeSeule
              ? `${OUTIL} px-2`
              : `${OUTIL} max-sm:px-2`
        }
      >
        {children}
        {/* ⚠️ Armé, le mot RESTE même sur téléphone : c'est le seul bouton de la
            barre dont le second appui détruit, et une icône rouge seule ne dit
            pas qu'on est en train de confirmer quelque chose. */}
        {(danger || !iconeSeule) && <span className={danger ? "" : "hidden sm:inline"}>{libelle}</span>}
      </button>
    </span>
  );
}

export default function EditeurCarte({ titre, carte, source, onEnregistrer, lecture, onFermer, onOuvrirRef, objectif }: Props) {
  const ouvrirCible = (kind: KindCarte, uid: string) => {
    // Une habitude n'a pas de fiche à elle : elle vit dans le Journal.
    if (kind === "habit") allerVers("journal");
    else onOuvrirRef?.(kind, uid);
    onFermer();
  };
  const [histoire, setHistoire] = useState(() => historiqueDe(carte));
  const courante = histoire.present;
  const [selection, setSelection] = useState<string>(courante.noeuds[0]?.id ?? "r");
  /**
   * ⭐ LA SUPPRESSION SE FAIT EN DEUX TEMPS — demande d'Antonin, 2026-09-22.
   *
   * Le premier ⌫ (ou le premier clic sur « Supprimer ») n'efface rien : il
   * ARME, et tout ce qui va disparaître passe en rouge pointillé sur la carte.
   * Le second confirme. C'est le sous-arbre entier que le geste emporte, et
   * c'est exactement ce qu'on ne voyait pas : une branche repliée cache dix
   * nœuds derrière un seul chiffre.
   *
   * ⚠️ ⌘Z rattrapait déjà la bévue — mais seulement pour qui sait que ⌘Z
   * existe, et seulement tant qu'on s'aperçoit de la perte. Une branche
   * repliée qu'on efface par erreur ne se remarque pas dans la seconde.
   */
  const [arme, setArme] = useState<string | null>(null);
  const [edition, setEdition] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [vue, setVue] = useState({ x: 0, y: 0, z: 1 });
  /** Le glisser qui RATTACHE (⌥ + glisser) : où tomberait le nœud. */
  const [glisse, setGlisse] = useState<{ id: string; cible: string | null } | null>(null);
  /**
   * ⭐ LE GLISSER QUI DÉPLACE — l'écart en cours, en unités LOGIQUES.
   *
   * Tant que le doigt ou la souris n'est pas relâché, rien n'entre dans
   * l'historique : la carte AFFICHÉE est la carte courante plus cet écart
   * (`affichee`). Un seul geste enregistré au relâcher, donc un seul ⌘Z pour
   * le défaire — et pas soixante états intermédiaires.
   */
  const [apercu, setApercu] = useState<{ id: string; dx: number; dy: number } | null>(null);
  /**
   * « Rattacher à un autre nœud… » (menu du nœud) : l'id du nœud qui attend son
   * nouveau parent. Le prochain nœud touché le reçoit ; Échap renonce. C'est le
   * chemin du rattachement AU DOIGT, où ⌥ n'existe pas.
   */
  const [rattache, setRattache] = useState<string | null>(null);
  /**
   * « Réorganiser » armé : la carte au moment où l'on a armé. Il ne vaut que
   * tant qu'elle n'a pas changé — même invariant que la suppression en deux
   * temps : un état armé ne survit jamais à ce qui l'a motivé.
   */
  const [armeReorg, setArmeReorg] = useState<Carte | null>(null);
  /** Le panneau « Type » ouvert : quel type, pour quel nœud. */
  const [typage, setTypage] = useState<{ type: TypeDonnable; id: string } | null>(null);
  /**
   * Carte d'objectif : le nœud neuf en cours de saisie, et ce qu'il deviendra.
   * Il n'existe pas encore dans les données — il vit dans la carte locale le
   * temps qu'on tape son nom, puis l'objet est créé et la carte re-dérivée.
   */
  const [enfantEnAttente, setEnfantEnAttente] = useState<{ id: string; parentId: string; type: EnfantObjectif } | null>(null);
  const attenteRef = useRef(enfantEnAttente);
  attenteRef.current = enfantEnAttente;

  /**
   * ⭐ LA CARTE D'OBJECTIF SE RE-DÉRIVE À CHAQUE ÉCRITURE, et l'éditeur suit.
   * Renommer dans la feuille de route, cocher ailleurs, créer une tâche d'ici :
   * les données changent, `CarteObjectif` redessine, et on garde de l'écran ce
   * qui n'est pas de la donnée — replis, positions, nœud en saisie.
   */
  useEffect(() => {
    if (!objectif) return;
    setHistoire((h) => {
      const present = fusionnerCarteObjectif(carte, h.present, attenteRef.current?.id ?? null);
      return ecrireCarte(present) === ecrireCarte(h.present) ? h : { passe: [], present, futur: [] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carte]);

  /**
   * ⭐ LES DONNÉES VIVANTES — l'état des nœuds typés (coche, échéance, série,
   * pourcentage) et les objectifs où ranger un nœud qu'on type.
   *
   * L'éditeur les lit LUI-MÊME : ses deux hôtes historiques n'ont pas les mêmes
   * (Notes reçoit `data`, le Savoir non). `fetchAll` à l'ouverture, puis relu à
   * chaque `sb:data-changed` — le signal que toute écriture hors-vue émet, y
   * compris celles de la carte (PIEGES § 18.2).
   */
  const [donnees, setDonnees] = useState<{ data: AppData; contexte: ContexteObjectifs } | null>(null);
  useEffect(() => {
    let vivant = true;
    const lire = async () => {
      const [data, contexte] = await Promise.all([fetchAll(addDays(todayStr(), -400)), fetchContexteObjectifs()]);
      if (vivant) setDonnees({ data, contexte });
    };
    void lire();
    const surChangement = () => void lire();
    window.addEventListener("sb:data-changed", surChangement);
    return () => {
      vivant = false;
      window.removeEventListener("sb:data-changed", surChangement);
    };
  }, []);
  const [message, setMessage] = useState<string | null>(null);
  /** Le panneau « En faire un objectif » — jamais en lecture (rien à convertir deux fois). */
  const [versObjectif, setVersObjectif] = useState(false);

  const scene = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLInputElement>(null);
  /**
   * ⭐ LE PREMIER TEMPS DE « RÉORGANISER » MONTRE LE RÉSULTAT — même principe
   * que la suppression en deux temps : une confirmation qui ne montre rien
   * n'ajoute qu'un clic. Armé, on VOIT la carte rangée ; Échap la rend telle
   * qu'elle était, le second appui l'enregistre. Rien n'est écrit entre les deux.
   */
  const affichee = useMemo(() => {
    if (armeReorg === courante && !edition) return reorganiser(courante);
    return apercu ? glisserNoeud(courante, apercu.id, apercu.dx, apercu.dy) : courante;
  }, [courante, apercu, armeReorg, edition]);
  const agencement = useMemo(() => agencer(affichee), [affichee]);

  const etats = useMemo(() => {
    if (!donnees) return new Map<string, EtatVivant>();
    const { data, contexte } = donnees;
    const today = todayStr();
    return etatsVivants(affichee, {
      goals: data.goals,
      tasks: data.tasks,
      completions: data.completions,
      habits: data.habits,
      habitChecks: data.habitChecks,
      liens: contexte.liens,
      evenements: contexte.evenements,
      maintenant: `${today} ${new Date().toTimeString().slice(0, 5)}`,
      today,
    });
  }, [affichee, donnees]);

  /**
   * Peut-on réécrire le texte de ce nœud ? Une idée, oui. Une référence, non —
   * son texte est le titre de sa cible… SAUF dans la carte d'un objectif, où
   * renommer le nœud RENOMME l'objet (étape, tâche, habitude). Une note
   * rattachée, elle, se renomme toujours là-bas.
   */
  const renommable = (n: { ref?: RefNoeud; mort?: boolean }) =>
    !n.ref || (!!objectif && KINDS_OBJETS.includes(n.ref.kind) && !n.mort);
  /** Carte d'objectif : une note, une fiche, un événement RATTACHÉS — pas un morceau de l'objectif. */
  const estRattache = (n: { ref?: RefNoeud } | undefined) => !!objectif && !!n?.ref && !KINDS_OBJETS.includes(n.ref.kind);

  /** Cocher depuis la carte : le MÊME chemin que partout (`basculerTache`). */
  const cocher = async (e: EtatVivant, fait: boolean) => {
    if (!e.tache) return;
    await basculerTache(e.tache, todayStr(), fait);
    window.dispatchEvent(new Event("sb:data-changed"));
  };

  const svg = useMemo(
    () => rendreSvg(affichee, { mode: "theme", selection: edition ? null : selection, peril: arme }),
    [affichee, selection, edition, arme],
  );

  /**
   * ⭐ RIEN NE SAUTE À L'ÉCRAN QUAND LE RECADRAGE BOUGE.
   *
   * `agencer` ramène tout le dessin dans le premier quadrant : dès qu'un nœud
   * déborde plus à gauche ou plus haut qu'avant — une branche neuve, un nœud
   * qu'on traîne —, TOUT le SVG glisse d'autant. Sans compensation, la carte
   * entière bondissait sous le curseur, y compris les nœuds posés à la main
   * qu'on venait de promettre immobiles. On décale donc le panoramique du même
   * écart (en pixels d'écran : × zoom), avant la peinture.
   */
  const originePrecedente = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const o = agencement.origine;
    const p = originePrecedente.current;
    originePrecedente.current = o;
    if (!p || (p.x === o.x && p.y === o.y)) return;
    setVue((v) => ({ ...v, x: v.x - (o.x - p.x) * v.z, y: v.y - (o.y - p.y) * v.z }));
  }, [agencement]);

  /**
   * ⭐ L'ARME SE REND DÈS QUE L'ATTENTION SE DÉPLACE.
   *
   * Changer de nœud ou ouvrir un champ dit que l'utilisateur est passé à autre
   * chose. Laisser l'arme en place serait pire que l'absence de confirmation :
   * un ⌫ tapé plus tard effacerait sans prévenir un nœud visé depuis pour une
   * tout autre raison. ⚠️ Un état armé ne doit JAMAIS survivre à ce qui l'a
   * motivé.
   *
   * ⚠️ FORMULÉ COMME UN INVARIANT, PAS COMME UNE LISTE DE GESTES : l'arme ne
   * vaut que sur le nœud SÉLECTIONNÉ, hors édition, et tant qu'il existe. Écrit
   * en énumérant les gestes qui doivent désarmer, cet effet effaçait aussi
   * l'arme qu'on venait de poser — `setArme` et `setSelection` partant dans le
   * même lot, l'effet voyait la sélection « changer » et rendait l'arme dans la
   * foulée. Le bouton rouge n'apparaissait jamais.
   */
  useEffect(() => {
    if (arme && (edition || arme !== selection || !noeudDe(courante, arme))) setArme(null);
  }, [arme, selection, edition, courante]);
  useEffect(() => {
    if (armeReorg && (edition || armeReorg !== courante)) setArmeReorg(null);
  }, [armeReorg, edition, courante]);
  // Un nœud en attente de rattachement qui disparaît (⌘Z, suppression) : on renonce.
  useEffect(() => {
    if (rattache && !noeudDe(courante, rattache)) setRattache(null);
  }, [rattache, courante]);

  /** Toute modification passe par ici : un seul point d'entrée pour l'historique. */
  const modifier = useCallback((f: (c: Carte) => Carte) => {
    setHistoire((h) => appliquer(h, f(h.present)));
  }, []);

  // ─── Enregistrement automatique débouncé, et flush garanti ─────────────────
  //
  // ⚠️ 600 ms, comme le lecteur immersif du Savoir. Et un flush au DÉMONTAGE,
  // parce que Notes n'en avait pas et que ce qui était tapé dans la dernière
  // seconde était perdu sans un mot (chantier H, 2026-09-06).
  const aEnregistrer = useRef<Carte | null>(null);
  const enregistrerRef = useRef(onEnregistrer);
  enregistrerRef.current = onEnregistrer;
  const premierRendu = useRef(true);

  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    // ⚠️ En lecture, la file reste VIDE : c'est elle que le flush de démontage
    // relit, donc rien ne peut partir — pas même le repli d'une branche.
    if (lecture || !enregistrerRef.current) return;
    aEnregistrer.current = courante;
    const minuteur = window.setTimeout(() => {
      const p = aEnregistrer.current;
      aEnregistrer.current = null;
      if (p) enregistrerRef.current?.(p);
    }, 600);
    return () => window.clearTimeout(minuteur);
  }, [courante]);

  // ⚠️ Effet SANS dépendance : il ne part qu'au vrai démontage, et il écrit ce
  // qui attendait encore. Sans lui, fermer la carte moins de 600 ms après la
  // dernière frappe perdrait cette frappe.
  useEffect(
    () => () => {
      const p = aEnregistrer.current;
      aEnregistrer.current = null;
      if (p) enregistrerRef.current?.(p);
    },
    [],
  );

  // ─── La couche modale ──────────────────────────────────────────────────────
  //
  // Repris de `SketchPad` : le voile s'occupe du visible, `inert` s'occupe du
  // clavier. Sans lui, tabuler depuis la carte finit par atteindre les boutons
  // du lecteur de note caché derrière.
  useEffect(() => {
    const app = document.getElementById("root");
    app?.setAttribute("inert", "");
    return () => app?.removeAttribute("inert");
  }, []);

  // ─── Le sélecteur `@` ──────────────────────────────────────────────────────
  //
  // ⭐ AUTONOME, ET C'EST CE QUI LE FAIT MARCHER DES DEUX CÔTÉS. Les mentions du
  // corps de texte ne sont branchées que dans Notes ; le Savoir n'en a pas.
  // Mais `MentionPicker` est purement présentationnel et `requeteEnCours()`
  // travaille sur une CHAÎNE — dans un champ, `value.slice(0, selectionStart)`
  // suffit, et `mentionsDom.ts` n'est même pas nécessaire. La carte porte donc
  // son propre sélecteur, identique dans les deux éditeurs.
  const [mention, setMention] = useState<{
    requete: string;
    resultats: Trouvaille[];
    position: { x: number; y: number };
  } | null>(null);
  const [choix, setChoix] = useState(0);
  /** Compteur de course : deux frappes rapides lancent deux recherches. */
  const requeteId = useRef(0);

  const fermerMention = useCallback(() => {
    setMention(null);
    setChoix(0);
    requeteId.current++;
  }, []);

  const verifierMention = useCallback(
    async (valeur: string, curseur: number) => {
      const requete = requeteEnCours(valeur.slice(0, curseur));
      if (requete === null) {
        fermerMention();
        return;
      }
      const rect = champ.current?.getBoundingClientRect();
      if (!rect) return;
      const id = ++requeteId.current;
      const resultats = await rechercherPartout(requete, { limite: 8, exclure: source });
      if (id !== requeteId.current) return; // une frappe plus récente a pris la main
      // ⚠️ Coordonnées ÉCRAN divisées par la densité : le sélecteur est porté sur
      // `document.body`, et le `zoom` CSS de l'app multiplie tout le document.
      const z = zoomFactor();
      setMention({ requete, resultats, position: { x: rect.left / z, y: rect.bottom / z } });
      setChoix(0);
    },
    [fermerMention, source],
  );

  const choisirMention = useCallback(
    (r: Trouvaille) => {
      if (!edition) return;
      modifier((c) => poserReference(c, edition, { kind: r.kind, uid: r.uid }, r.titre));
      fermerMention();
      setEdition(null);
      setSelection(edition);
    },
    [edition, fermerMention, modifier],
  );

  // ─── L'édition d'un nœud ───────────────────────────────────────────────────

  /**
   * ⚠️ LE TEXTE EST UN ARGUMENT, JAMAIS RELU DANS LA CARTE — et c'est un défaut
   * vu à l'écran le 2026-09-07, pas une précaution théorique.
   *
   * La première version cherchait le nœud (`noeudDe(courante, id)`) et
   * abandonnait s'il était absent. Or on ouvre l'édition juste APRÈS avoir créé
   * le nœud : la `courante` capturée par la fermeture est celle d'AVANT, le
   * nouveau nœud n'y est pas, et l'édition ne s'ouvrait donc jamais. Symptôme à
   * l'écran : Tab créait bien un nœud, mais tout ce qu'on tapait ensuite partait
   * dans le vide — sans erreur, sans curseur, sans rien.
   *
   * C'est la même famille que le § 6.5 de `PIEGES.md` : une fonction ne doit
   * jamais dépendre d'un état qu'elle n'a pas reçu.
   */
  /** Faut-il sélectionner tout le texte à l'ouverture ? Lu par l'effet de focus. */
  const selectionnerALOuverture = useRef(false);
  /**
   * Faut-il ouvrir le sélecteur `@` dès que le champ existe ?
   *
   * ⚠️ C'est le bouton « Citer un objet » de la barre d'outils qui le pose. Il
   * ne peut PAS lancer la recherche lui-même : `verifierMention` a besoin du
   * rectangle du champ pour placer le sélecteur, et le champ n'est monté qu'au
   * rendu suivant. Même leçon que le focus, juste en dessous.
   */
  const chercherALOuverture = useRef(false);

  /**
   * ⚠️ Un COMPTEUR d'ouvertures, en plus de l'identifiant édité.
   *
   * Rouvrir le nœud DÉJÀ en édition (le bouton « Renommer », le bouton
   * « Citer un objet », F2) ne change pas `edition` : l'effet de focus ne
   * repartirait pas, et le geste ne ferait visiblement rien. Le compteur, lui,
   * bouge à chaque fois.
   */
  const [ouverture, setOuverture] = useState(0);

  const ouvrirEdition = useCallback(
    (id: string, texte: string, selectionner: boolean) => {
      selectionnerALOuverture.current = selectionner;
      setEdition(id);
      setBrouillon(texte);
      setOuverture((n) => n + 1);
      fermerMention();
    },
    [fermerMention],
  );

  /**
   * ⚠️ LE FOCUS PASSE PAR UN EFFET, PAS PAR UN `setTimeout`, et c'est un défaut
   * vu à l'écran le 2026-09-07 : le champ s'ouvrait bien, mais `document.
   * activeElement` restait `BODY` et tout ce qu'on tapait tombait à côté.
   *
   * Un `setTimeout(0)` posé juste après un `setState` ne garantit RIEN : il
   * n'existe aucune promesse que React ait commité le rendu quand la minuterie
   * se déclenche, donc `champ.current` peut encore être nul. Un effet, lui,
   * s'exécute par construction APRÈS le commit. C'est la même leçon que le
   * § 6.2 bis, prise par l'autre bout : là il fallait NE PAS attendre l'effet,
   * ici il faut l'attendre.
   *
   * ⚠️ On ne SÉLECTIONNE le texte que quand on rouvre un nœud existant (F2,
   * double-clic). Quand l'édition s'ouvre parce que l'utilisateur a commencé à
   * TAPER, sélectionner ferait remplacer par la frappe suivante ce qu'il vient
   * d'écrire : taper « Plan » ne laisserait que « n ».
   */
  useEffect(() => {
    if (!edition) return;
    const el = champ.current;
    if (!el) return;
    el.focus();
    if (selectionnerALOuverture.current) el.select();
    else el.setSelectionRange(el.value.length, el.value.length);
    if (chercherALOuverture.current) {
      chercherALOuverture.current = false;
      void verifierMention(el.value, el.value.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edition, ouverture]);

  const validerEdition = useCallback(
    (id: string, texte: string): Carte => {
      const n = noeudDe(courante, id);
      // Un nœud-référence garde son identité : on ne réécrit que le texte libre.
      // (Carte d'objectif : on réécrit aussi une étape, une tâche, une habitude —
      // c'est `fermerEdition` qui renomme l'objet derrière. Un nom vide n'en est pas un.)
      if (!n || n.texte === texte) return courante;
      if (n.ref && !(objectif && renommable(n) && texte.trim())) return courante;
      return renommer(courante, id, texte);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courante, objectif],
  );

  const fermerEdition = useCallback(
    (garder: boolean) => {
      if (!edition) return;
      // ⭐ Carte d'objectif : le nœud NEUF qu'on vient de nommer devient un objet.
      const attente = attenteRef.current;
      if (objectif && attente && edition === attente.id) {
        const nom = brouillon.trim();
        setEdition(null);
        fermerMention();
        if (!garder || !nom) {
          retirerAttente(attente);
          return;
        }
        setHistoire((h) => appliquer(h, renommer(h.present, attente.id, nom)));
        // Une habitude a besoin de sa cible en jours : le panneau la demande,
        // et dit où l'étape qui la comptera va naître.
        if (attente.type === "habitude") {
          setTypage({ type: "habitude", id: attente.id });
          return;
        }
        const parentRef = noeudDe(courante, attente.parentId)?.ref;
        if (!parentRef) {
          retirerAttente(attente);
          return;
        }
        void objectif.creer(parentRef, attente.type, nom).finally(() => retirerAttente(attente));
        return;
      }
      if (garder) {
        const suivante = validerEdition(edition, brouillon);
        if (suivante !== courante) {
          setHistoire((h) => appliquer(h, suivante));
          // Renommer le nœud RENOMME l'objet — la feuille de route le montre aussitôt.
          const n = noeudDe(courante, edition);
          if (objectif && n?.ref) void objectif.renommer(n.ref, brouillon.trim());
        }
      }
      setEdition(null);
      fermerMention();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brouillon, courante, edition, fermerMention, objectif, validerEdition],
  );

  /** Le nœud neuf a fini sa vie locale : créé (la carte re-dérivée le montre), ou abandonné. */
  const retirerAttente = (attente: { id: string; parentId: string }) => {
    setEnfantEnAttente(null);
    setHistoire((h) => ({ ...h, present: supprimerNoeud(h.present, attente.id) }));
    setSelection(attente.parentId);
  };

  // ─── Les raccourcis ────────────────────────────────────────────────────────
  //
  // ⚠️ EN CAPTURE, comme `SketchPad`. La carte s'ouvre AU-DESSUS du lecteur de
  // note, qui écoute lui aussi Échap sur `window` et s'y est abonné en premier :
  // en phase de bouillonnement, Échap fermerait la carte ET le lecteur d'un seul
  // coup. La capture passe avant, `preventDefault` marque la touche, et le
  // lecteur (qui teste `defaultPrevented`) laisse passer son tour.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      // Un menu contextuel est ouvert (clic droit sur un nœud) : la touche est
      // à LUI. Sans ce test, Échap fermait le menu ET la carte (PIEGES § 19.15).
      if (menuContextuelOuvert()) return;
      // Un panneau est ouvert par-dessus la carte (« Type », « En faire un
      // objectif ») : les touches sont à LUI. Sans ce garde, Échap fermait la
      // carte entière au lieu du seul panneau — l'ordre des écouteurs en
      // capture dépend de qui s'est réabonné en dernier.
      if (typage || versObjectif) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.stopPropagation();
        // Carte d'objectif : ce qu'on y fait est ÉCRIT dans les objets, et ⌘Z
        // n'en défait rien. Une suppression se rattrape par la corbeille.
        if (objectif) return;
        setHistoire((h) => (e.shiftKey ? retablir(h) : annuler(h)));
        setEdition(null);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        // ⚠️ Désarmer passe AVANT tout le reste. Échap veut dire « laisse
        // tomber ce que je viens de commencer » : fermer la carte entière parce
        // qu'on renonce à une suppression serait la mauvaise réponse à la
        // bonne touche.
        if (armeReorg) setArmeReorg(null);
        else if (arme) setArme(null);
        else if (rattache) setRattache(null);
        else if (mention) fermerMention();
        else if (edition) fermerEdition(true);
        else onFermer();
        return;
      }
      // Tout le reste n'a de sens que hors édition : le champ a ses propres règles.
      //
      // ⚠️ On teste AUSSI l'élément actif, et pas seulement l'état React.
      // `setEdition` ne réabonne cet écouteur qu'au rendu suivant : une frappe
      // qui arrive entre les deux verrait encore `edition === null` et serait
      // traitée comme un raccourci de carte alors qu'elle est destinée au champ.
      // C'est étroit, mais une frappe perdue dans un éditeur de texte se
      // remarque tout de suite.
      const actif = document.activeElement;
      if (edition) {
        // Le champ a la main : c'est lui qui décide, on ne double pas ses règles.
        if (actif === champ.current) return;
        // ⭐ SINON, LE CHAMP N'EST PAS ENCORE MONTÉ, ET LA FRAPPE SERAIT PERDUE.
        // `setEdition` ne fait apparaître le champ qu'au rendu suivant. Entre
        // les deux, tout ce qu'on tape tombe dans le vide : vu à l'écran le
        // 2026-09-07, « Plan de trading » ne laissait rien du tout dans le
        // nœud. On récupère donc la frappe à la main plutôt que de l'avaler.
        if (!meta && !e.altKey && e.key.length === 1) {
          e.preventDefault();
          setBrouillon((b) => b + e.key);
        }
        return;
      }
      if (actif?.tagName === "INPUT") return;

      const n = noeudDe(courante, selection);
      if (!n) return;

      /**
       * « Rattacher à un autre nœud… » attend sa cible : les flèches déplacent
       * la sélection, Entrée choisit, et RIEN d'autre ne part — un Tab tapé par
       * réflexe créerait un nœud au milieu d'un geste qui n'est pas fini.
       */
      if (rattache) {
        if (e.key === "Enter") {
          e.preventDefault();
          rattacherA(selection);
          return;
        }
        if (!e.key.startsWith("Arrow")) {
          if (e.key.length === 1 || e.key === "Tab" || e.key === "Backspace" || e.key === "Delete" || e.key === "F2") {
            e.preventDefault();
          }
          return;
        }
      }

      /**
       * ⚠️ LA LECTURE SE FILTRE ICI, EN UN SEUL ENDROIT — pas en dispersant un
       * `if (lecture)` dans chacun des dix gestes plus bas. Une règle écrite
       * par ÉNUMÉRATION finit par avoir un trou de la taille exacte de ce
       * qu'elle prétend tenir (PIEGES § 7.2 ter) : ici, le trou serait un geste
       * qui modifie une carte que personne n'enregistrera.
       *
       * On garde les flèches et l'espace (déplacer le regard, replier une
       * branche — de la vue, pas de la donnée) et on rend Entrée utile : elle
       * OUVRE l'objet du nœud, puisque tout nœud en lecture en désigne un.
       */
      if (lecture) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (n.ref && !n.mort) ouvrirCible(n.ref.kind, n.ref.uid);
          return;
        }
        const vue = e.key === " " || e.key.startsWith("Arrow");
        if (!vue || e.altKey) {
          if (vue || e.key === "Tab" || e.key === "Backspace" || e.key === "Delete" || e.key === "F2") {
            e.preventDefault();
          }
          return;
        }
      }

      // ⭐ ENTRÉE N'AJOUTE PLUS DE FRÈRE — décision d'Antonin, 2026-09-07.
      // Hors édition il n'y a rien à valider : Entrée ouvre donc le nœud, ce
      // qui est l'autre moitié du même geste (on entre, on tape, on valide par
      // Entrée). ⌘Entrée, lui, crée le voisin.
      if (e.key === "Enter") {
        e.preventDefault();
        if (meta && objectif) {
          ouvrirCreation("frere");
        } else if (meta) {
          const { carte: suivante, neuf } = ajouterFrere(courante, selection);
          setHistoire((h) => appliquer(h, suivante));
          setSelection(neuf);
          ouvrirEdition(neuf, "", false);
        } else if (renommable(n)) {
          ouvrirEdition(selection, n.texte, true);
        }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        // Carte d'objectif : ajouter un enfant EXIGE un type — une carte dérivée
        // n'a nulle part où ranger une idée sans objet.
        if (objectif) {
          ouvrirCreation("enfant");
          return;
        }
        const { carte: suivante, neuf } = ajouterEnfant(courante, selection);
        setHistoire((h) => appliquer(h, suivante));
        setSelection(neuf);
        ouvrirEdition(neuf, "", false);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        supprimer(); // ⚠️ deux temps : le premier ⌫ arme, le second confirme
        return;
      }
      // ⌥ + flèche envoie la BRANCHE de ce côté, au lieu d'y déplacer la
      // sélection. Un geste délibéré : depuis que le côté est posé, réordonner
      // ne fait plus traverser la carte à une branche (voir `poserCote`).
      // ⌥T : le TYPE du nœud. `e.code` et pas `e.key` : sur Mac, ⌥T tape « † ».
      if (e.altKey && e.code === "KeyT") {
        e.preventDefault();
        if (objectif) return; // tout y est déjà typé
        const el = scene.current?.querySelector<HTMLElement>(`[data-noeud="${CSS.escape(selection)}"]`);
        if (el) menuType.ouvrirSurElement(el, selection);
        return;
      }
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        if (rattache || objectif) return;
        modifier((c) => poserCote(c, selection, e.key === "ArrowRight" ? 1 : -1));
        return;
      }
      const fleches: Record<string, Direction> = {
        ArrowUp: "haut",
        ArrowDown: "bas",
        ArrowLeft: "gauche",
        ArrowRight: "droite",
      };
      if (fleches[e.key]) {
        e.preventDefault();
        const cible = voisin(courante, selection, fleches[e.key]);
        if (cible) setSelection(cible);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        modifier((c) => basculerPli(c, selection));
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        if (renommable(n)) ouvrirEdition(selection, n.texte, true);
        return;
      }
      // Une frappe imprimable ouvre l'édition et REMPLACE le texte : c'est ce
      // qu'on attend d'une carte mentale, où l'on renomme plus qu'on ne corrige.
      if (!meta && !e.altKey && e.key.length === 1 && (!objectif || renommable(n))) {
        e.preventDefault();
        ouvrirEdition(selection, e.key, false);
      }
    };
    window.addEventListener("keydown", surTouche, true);
    return () => window.removeEventListener("keydown", surTouche, true);
    // ⚠️ `arme` EST UNE DÉPENDANCE, et ce n'est pas du zèle : `supprimer` lit
    // cet état pour savoir si le ⌫ arme ou confirme. Sans lui, l'écouteur
    // garderait la fermeture du rendu précédent — donc `arme` à `null` pour
    // toujours, et le second ⌫ ne confirmerait jamais. C'est le § 9.1 de
    // `PIEGES.md`, repris à l'identique.
  }, [arme, armeReorg, courante, edition, fermerEdition, fermerMention, mention, modifier, objectif, onFermer, ouvrirEdition, rattache, selection, typage, versObjectif]);

  // ─── Panoramique, zoom, et « tout voir » ───────────────────────────────────

  /**
   * `plancher` sert au CADRAGE INITIAL sur un écran de téléphone, et à lui seul.
   *
   * ⭐ Mesuré sur iPhone 390 × 844 le 2026-09-20 : une feuille de route de huit
   * nœuds tient dans une scène de 324 px à **25 %** — tout est à l'écran, et
   * plus rien n'est lisible. Or le doigt n'a pas de solution de repli : le
   * pincement ne zoome pas (la scène porte `touch-action: none`, indispensable
   * au glissement), il ne reste que les deux loupes.
   *
   * Le bouton « Tout voir », lui, garde son plancher habituel : il PROMET de
   * tout montrer, et un bouton qui ne tient pas son nom est pire qu'un bouton
   * qui montre petit.
   */
  const toutVoir = useCallback((plancher = ZOOM_MIN) => {
    const boite = scene.current?.getBoundingClientRect();
    if (!boite) return;
    const z = Math.min(
      ZOOM_MAX,
      Math.max(plancher, Math.min(boite.width / agencement.largeur, boite.height / agencement.hauteur, 1)),
    );
    setVue({
      x: (boite.width - agencement.largeur * z) / 2,
      y: (boite.height - agencement.hauteur * z) / 2,
      z,
    });
  }, [agencement.hauteur, agencement.largeur]);

  // Au montage seulement : recadrer à chaque modification ferait sauter la carte
  // sous le curseur à chaque nœud ajouté.
  useEffect(() => {
    // `pointer: coarse` et non une largeur : c'est l'absence de pincement qui
    // justifie le plancher, pas la taille de l'écran (règle du 2026-09-02).
    const tactile =
      typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    toutVoir(tactile ? 0.5 : ZOOM_MIN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * ⭐ AMENER LE NŒUD CHOISI SOUS LES YEUX, ET LUI SEUL.
   *
   * Sans cela, la carte ne se cadrait qu'au montage : un nœud ajouté hors du
   * champ visible ouvrait son champ de saisie QUELQUE PART, et on tapait dans
   * un rectangle qu'on ne voyait pas. Le cas n'est pas théorique — une branche
   * neuve naît du côté le moins chargé, donc parfois à l'opposé de celle qu'on
   * regardait (voir `nouvelleBranche` dans `lib/carte.ts`).
   *
   * ⚠️ ON DÉPLACE, ON NE RECADRE PAS. Rappeler `toutVoir()` rendrait le zoom au
   * système à chaque frappe et ferait sauter toute la carte ; ici la vue glisse
   * du strict nécessaire, et ne bouge pas du tout quand le nœud est déjà
   * visible — l'effet rend alors le MÊME objet d'état, ce qui évite le rendu.
   *
   * ⚠️ Un nœud plus large que la fenêtre alignerait son bord gauche, puis son
   * bord droit, indéfiniment. D'où le premier cas : ce qui ne tient pas se cale
   * par le coin haut-gauche, une fois, et on n'y revient plus.
   */
  useEffect(() => {
    // Pendant un glisser, c'est la MAIN qui décide où va le nœud : recadrer la
    // vue sous elle ferait fuir la carte à chaque pixel.
    if (apercu) return;
    const b = agencement.boites.get(edition ?? selection);
    const cadre = scene.current?.getBoundingClientRect();
    if (!b || !cadre) return;
    const M = 44;
    setVue((v) => {
      const glissement = (debut: number, taille: number, fenetre: number) => {
        const a = debut;
        const b2 = debut + taille;
        if (taille > fenetre - M * 2) return M - a;
        if (a < M) return M - a;
        if (b2 > fenetre - M) return fenetre - M - b2;
        return 0;
      };
      // En édition, c'est le CHAMP qu'il faut voir, et il déborde la boîte.
      const w = edition ? Math.max(b.w, LARGEUR_CHAMP_MIN) : b.w;
      const dx = glissement(v.x + b.x * v.z, w * v.z, cadre.width);
      const dy = glissement(v.y + b.y * v.z, b.h * v.z, cadre.height);
      return dx === 0 && dy === 0 ? v : { ...v, x: v.x + dx, y: v.y + dy };
    });
  }, [agencement, apercu, edition, selection, ouverture]);

  /**
   * Le zoom à la souris seule — pour qui n'a ni molette ni trackpad sous la
   * main, et pour qui ne sait pas que ⌘molette existe.
   *
   * ⚠️ Il se recale sur le CENTRE de la scène, exactement comme la molette se
   * recale sous le pointeur : sans ce calcul, chaque clic ferait fuir la carte
   * vers le coin haut-gauche, et deux crans suffiraient à la perdre de vue.
   */
  const zoomer = useCallback((facteur: number) => {
    const boite = scene.current?.getBoundingClientRect();
    if (!boite) return;
    const px = boite.width / 2;
    const py = boite.height / 2;
    setVue((v) => {
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.z * facteur));
      const k = z / v.z;
      return { x: px - (px - v.x) * k, y: py - (py - v.y) * k, z };
    });
  }, []);

  const surMolette = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const boite = scene.current?.getBoundingClientRect();
      if (!boite) return;
      const px = e.clientX - boite.left;
      const py = e.clientY - boite.top;
      setVue((v) => {
        const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.z * (1 - e.deltaY / 500)));
        const k = z / v.z;
        // le point sous le curseur ne bouge pas : c'est ce qu'on appelle
        // « zoomer au pointeur », et sans ce recalage la carte fuit sur le côté
        return { x: px - (px - v.x) * k, y: py - (py - v.y) * k, z };
      });
      return;
    }
    setVue((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
  };

  /**
   * ⚠️ LES ÉCOUTEURS SONT POSÉS DANS LE `pointerdown` LUI-MÊME, jamais dans un
   * `useEffect`. Un effet ne s'exécute qu'APRÈS le rendu : un geste dont
   * l'appui, le déplacement et le relâchement tiennent dans la même tâche du
   * navigateur se termine avant que le moindre écouteur n'existe, et il ne se
   * passe rien. Ce piège a été payé une fois, sur le calendrier, en septembre
   * (`PIEGES.md` § 6.2 bis).
   */
  const surAppui = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const cible = (e.target as HTMLElement).closest?.("[data-noeud]") as HTMLElement | null;
    const id = cible?.dataset.noeud ?? null;

    // « Rattacher à un autre nœud… » attendait sa cible : c'est CET appui.
    // Toucher le fond de la scène renonce, comme Échap.
    if (rattache) {
      if (id) rattacherA(id);
      else setRattache(null);
      return;
    }

    const depart = { x: e.clientX, y: e.clientY };
    const vueDepart = { ...vue };
    const tactile = e.pointerType === "touch";
    /**
     * ⭐ DEUX GLISSERS, ET C'EST LA DÉCISION DU 2026-09-29.
     *   • `deplace` — le geste simple : le nœud change de place à l'écran, et
     *     RIEN d'autre (ni parent, ni rang). C'est ce que « déplacer » veut
     *     dire pour quelqu'un qui n'a jamais ouvert une carte mentale.
     *   • `rattache` — ⌥ + glisser : l'ancien geste, qui change le parent. Il
     *     reste, parce qu'on ne retire pas une capacité sans la rendre
     *     ailleurs (PIEGES § 9.13) ; au doigt, il passe par le menu du nœud.
     */
    let mode: "attente" | "panoramique" | "deplace" | "rattache" = "attente";
    let survole: string | null = null;
    let minuteurAppui = 0;
    let ecart = { dx: 0, dy: 0 };
    /**
     * Pixels d'ÉCRAN → unités LOGIQUES de la scène. Deux facteurs : le zoom de
     * la carte (`vue.z`), et celui de la Densité (le `zoom` CSS de l'app), qu'on
     * mesure plutôt que de le supposer — le rapport entre la taille rendue de la
     * scène et sa taille CSS les contient tous les deux.
     */
    const el = scene.current;
    const densite = el && el.offsetWidth > 0 ? el.getBoundingClientRect().width / el.offsetWidth : 1;
    const echelle = (densite || 1) * vueDepart.z;

    if (id) {
      setSelection(id);
      if (edition && edition !== id) fermerEdition(true);
    }

    const armerGlisse = (rattacher: boolean) => {
      // En lecture, rien ne se déplace : le glissement reste un panoramique,
      // comme sur le fond de la scène.
      if (lecture) {
        mode = "panoramique";
        return;
      }
      // La racine est l'origine du repère : elle ne se déplace pas. La glisser
      // fait glisser la vue, ce qui revient au même pour l'œil.
      if (!id || id === racineDe(courante).id) {
        mode = "panoramique";
        return;
      }
      // Carte d'objectif : l'ordre et la place des étapes ne changent QUE dans
      // la feuille de route. ⌥ + glisser y déplace, comme le glisser simple.
      const vraiRattachement = rattacher && !objectif;
      mode = vraiRattachement ? "rattache" : "deplace";
      if (vraiRattachement) setGlisse({ id, cible: null });
      else setApercu({ id, dx: 0, dy: 0 });
    };

    if (id && tactile) {
      // ⚠️ Au doigt, glisser et défiler sont le MÊME geste : on exige un appui
      // long avant d'armer, et on annule si le doigt bouge avant l'échéance —
      // c'est un défilement, on rend la main (`PIEGES.md` § 7.4 ter). ⌥
      // n'existe pas au doigt : l'appui long arme toujours le DÉPLACEMENT.
      minuteurAppui = window.setTimeout(() => armerGlisse(false), APPUI_LONG_MS);
    }

    const bouge = (ev: PointerEvent) => {
      const dx = ev.clientX - depart.x;
      const dy = ev.clientY - depart.y;
      if (mode === "attente") {
        if (Math.hypot(dx, dy) < SEUIL_GLISSE) return;
        if (tactile) {
          // le doigt a bougé avant l'appui long : c'est un panoramique
          window.clearTimeout(minuteurAppui);
          mode = "panoramique";
        } else if (id) armerGlisse(e.altKey || ev.altKey);
        else mode = "panoramique";
      }
      if (mode === "panoramique") {
        setVue({ ...vueDepart, x: vueDepart.x + dx, y: vueDepart.y + dy });
        return;
      }
      if (mode === "deplace") {
        ecart = { dx: dx / echelle, dy: dy / echelle };
        setApercu({ id: id!, ...ecart });
        return;
      }
      // En glissement : où tomberait le nœud ? `elementFromPoint` dit sur quoi
      // on tire vraiment — le § 6.2 bis rappelle qu'il faut le VÉRIFIER plutôt
      // que de conclure qu'un geste est cassé.
      const sous = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
      const dessus = sous?.closest?.("[data-noeud]") as HTMLElement | null;
      const nouveau = dessus?.dataset.noeud ?? null;
      if (nouveau !== survole) {
        survole = nouveau;
        setGlisse({ id: id!, cible: nouveau });
      }
    };

    const fini = (ev: PointerEvent) => {
      window.clearTimeout(minuteurAppui);
      window.removeEventListener("pointermove", bouge);
      window.removeEventListener("pointerup", fini);
      window.removeEventListener("pointercancel", fini);
      setGlisse(null);
      setApercu(null);
      if (mode === "deplace" && id) {
        // ⚠️ `ecart` est une variable du geste, jamais relue dans l'état React :
        // le dernier `setApercu` n'est peut-être pas encore commité (§ 6.2 bis).
        // Un `pointercancel` (le système reprend le doigt) n'enregistre rien.
        const { dx, dy } = ecart;
        if (ev.type === "pointerup") modifier((c) => glisserNoeud(c, id, dx, dy));
        return;
      }
      if (mode === "rattache" && id && survole && survole !== id) {
        modifier((c) => deplacer(c, id, survole!, null));
        return;
      }
      if (mode !== "attente") return;
      // Un simple clic : ouvrir la cible d'un nœud-référence, sinon éditer.
      const bouge2 = Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y);
      if (!id || bouge2 >= SEUIL_GLISSE) return;
      const n = noeudDe(courante, id);
      // ⭐ En lecture, un SIMPLE clic ouvre : il n'y a rien d'autre à faire d'un
      // nœud, et exiger ⌘ reviendrait à cacher la seule action de l'écran.
      // En édition, ⌘ reste nécessaire — un clic nu y sélectionne pour éditer.
      if (n?.ref && !n.mort && (lecture || ev.metaKey || ev.ctrlKey)) {
        ouvrirCible(n.ref.kind, n.ref.uid);
      }
    };

    window.addEventListener("pointermove", bouge);
    window.addEventListener("pointerup", fini);
    window.addEventListener("pointercancel", fini);
  };

  // ─── Les gestes de la barre d'outils ───────────────────────────────────────
  //
  // ⭐ ILS PASSENT PAR LES MÊMES FONCTIONS QUE LE CLAVIER, sans exception. Une
  // barre d'outils qui emprunterait un autre chemin finirait par diverger des
  // raccourcis, et l'un des deux deviendrait faux sans que rien ne le dise.
  //
  // ⚠️ Un clic sur un de ces boutons fait d'abord perdre le focus au champ
  // d'édition, donc `fermerEdition(true)` s'exécute AVANT le `onClick` : ce que
  // l'utilisateur venait de taper est déjà enregistré quand on arrive ici. Le
  // `edition ? validerEdition(...)` reste là comme filet, au cas où un jour un
  // chemin n'y passerait pas.

  const creer = (comment: "enfant" | "frere") => {
    if (objectif) {
      ouvrirCreation(comment);
      return;
    }
    const base = edition ? validerEdition(edition, brouillon) : courante;
    const r = comment === "enfant" ? ajouterEnfant(base, selection) : ajouterFrere(base, selection);
    setHistoire((h) => appliquer(h, r.carte));
    setSelection(r.neuf);
    setEdition(null);
    ouvrirEdition(r.neuf, "", false);
  };

  const modifierTexte = () => {
    const n = noeudDe(courante, selection);
    if (!n || !renommable(n)) return;
    ouvrirEdition(selection, n.texte, true);
  };

  /** Transforme le nœud en citation : on ouvre le champ SUR un « @ » déjà tapé. */
  const citer = () => {
    if (!noeudDe(courante, selection)) return;
    chercherALOuverture.current = true;
    ouvrirEdition(selection, "@", false);
  };

  /**
   * ⭐ LES DEUX TEMPS, EN UN SEUL ENDROIT — le clavier et le bouton passent
   * tous les deux par ici, sinon les deux chemins divergeraient et l'un des
   * deux finirait par supprimer d'un coup.
   */
  const supprimer = () => {
    const n = noeudDe(courante, selection);
    if (!n || n.parent === null) return; // la racine ne se supprime pas
    if (arme !== selection) {
      setArmeReorg(null);
      setArme(selection);
      return;
    }
    effacerNoeud(selection);
  };

  /**
   * Le SECOND temps, seul — ce que fait le bouton armé, et ce que fait le menu
   * contextuel une fois sa propre confirmation passée. Écrit une fois pour que
   * les deux chemins ne divergent pas (règle 18). ⌘Z le défait : il passe par
   * `modifier`, donc par l'historique de la carte.
   */
  const effacerNoeud = (id: string) => {
    const n = noeudDe(courante, id);
    if (!n || n.parent === null) return;
    setArme(null);
    setEdition(null);
    // ⭐ Carte d'objectif : le nœud EST l'objet — il part par le chemin normal
    // (« Supprimés récemment », restaurable 30 jours), ou, pour une note
    // rattachée, il se DÉTACHE (décision E : on ne supprime jamais la note).
    // La carte re-dérivée le retirera d'elle-même.
    if (objectif && n.ref) {
      const parent = n.parent ? noeudDe(courante, n.parent) : undefined;
      void objectif.supprimer(n.ref, parent?.ref ?? null, n.texte);
      setSelection(n.parent);
      return;
    }
    modifier((c) => supprimerNoeud(c, id));
    setSelection(n.parent);
  };

  /** Un message court dans l'en-tête, qui s'efface seul. */
  const dire = (texte: string) => {
    setMessage(texte);
    window.setTimeout(() => setMessage(null), 3000);
  };

  /**
   * ⭐ LE RATTACHEMENT SANS ⌥ — ce que fait « Rattacher à un autre nœud… ».
   *
   * Le même `deplacer` que ⌥ + glisser (règle 18) : deux chemins, une seule
   * écriture. C'est le chemin du doigt, où ⌥ n'existe pas, et celui de qui ne
   * connaît pas le raccourci.
   */
  const rattacherA = (cible: string) => {
    const id = rattache;
    if (!id) return;
    if (cible === id) return; // on a retouché le nœud lui-même : on attend encore
    if (sousArbre(courante, id).includes(cible)) {
      dire(t("Un nœud ne peut pas se ranger sous sa propre branche."));
      return;
    }
    modifier((c) => deplacer(c, id, cible, null));
    setRattache(null);
    setSelection(id);
  };

  /**
   * « Réorganiser », en DEUX TEMPS — même patron que la suppression : le
   * premier appui arme et dit combien de nœuds reprendraient leur place, le
   * second confirme. ⌘Z le défait (il passe par `modifier`).
   */
  const nManuels = positionsManuelles(courante);
  const reorgArme = armeReorg === courante && !edition;
  const reorganiserCarte = () => {
    if (nManuels === 0) return;
    if (!reorgArme) {
      setArme(null);
      setArmeReorg(courante);
      return;
    }
    setArmeReorg(null);
    modifier(reorganiser);
  };

  // ─── L'export ──────────────────────────────────────────────────────────────

  const nomFichier = (ext: string) =>
    `${(titre || t("Carte mentale")).replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || "carte"}.${ext}`;

  const exporter = async (format: "png" | "svg") => {
    try {
      const contenu =
        format === "png" ? await pngDeCarte(courante) : svgExportable(courante);
      const ok = await enregistrerFichier(nomFichier(format), contenu, format);
      if (ok) setMessage(t("Carte exportée"));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
    window.setTimeout(() => setMessage(null), 3000);
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  const boiteEnEdition = edition ? agencement.boites.get(edition) : null;
  const noeudSel = noeudDe(courante, selection);
  const estRacine = !noeudSel || noeudSel.parent === null;
  const aDesEnfants = !!noeudSel && enfantsDe(courante, selection).length > 0;
  /** Une BRANCHE : un enfant direct de la racine. Elle seule porte un côté. */
  const estBranche = !!noeudSel && noeudSel.parent === racineDe(courante).id;
  const coteSel = coteEtProfondeur(courante, selection).cote;
  /**
   * Combien de nœuds PENDENT sous celui qu'on vise — ce que le geste emporte
   * en plus de lui. ⚠️ `sousArbre` compte le nœud lui-même : on le retire.
   */
  const aEmporter = Math.max(0, sousArbre(courante, selection).length - 1);
  const estArme = arme === selection && !estRacine;

  /**
   * ⭐ LE CLIC DROIT SUR UN NŒUD (2026-09-24, vérification complète demandée
   * par Antonin). Jusque-là, tout passait par la barre d'outils et le clavier :
   * un clic droit sur un nœud ne proposait RIEN. Chaque entrée appelle la
   * fonction du bouton de la barre qui lui correspond (règle 18) — le menu
   * sélectionne d'abord le nœud visé, comme le ferait un clic.
   */
  const menuNoeud = useMenuContextuel<string>();
  const menuType = useMenuContextuel<string>();
  /** Carte d'objectif : « quel type ? » avant tout nœud neuf. La cible est le PARENT. */
  const menuCreation = useMenuContextuel<string>();

  /**
   * ⭐ AJOUTER, DANS LA CARTE D'UN OBJECTIF, EXIGE UN TYPE — Étape (phase ou
   * sous-objectif), Tâche ou Habitude. Pas d'idée : une carte dérivée n'a
   * nulle part où ranger un texte libre. Le menu s'ouvre sur le nœud choisi ;
   * les genres impossibles à cet endroit sont grisés, avec la raison.
   */
  const ouvrirCreation = (comment: "enfant" | "frere") => {
    const n = noeudDe(courante, selection);
    if (!n) return;
    const parentId = comment === "enfant" ? n.id : n.parent;
    if (!parentId) return;
    const el = scene.current?.querySelector<HTMLElement>(`[data-noeud="${CSS.escape(n.id)}"]`);
    if (el) menuCreation.ouvrirSurElement(el, parentId);
  };
  const commencerEnfant = (parentId: string, type: EnfantObjectif) => {
    const { carte: suivante, neuf } = ajouterEnfant(courante, parentId);
    setHistoire((h) => appliquer(h, suivante));
    setEnfantEnAttente({ id: neuf, parentId, type });
    setSelection(neuf);
    ouvrirEdition(neuf, "", false);
  };
  const entreesCreation = (parentId: string): EntreePossible[] => {
    if (!objectif) return [];
    const p = noeudDe(courante, parentId);
    const possibles = p?.ref ? objectif.enfantsPossibles(p.ref) : [];
    const raison = possibles.length
      ? { raison: t("Pas à cet endroit : la feuille de route n'a que trois niveaux.") }
      : { raison: t("Une tâche, une habitude ou une note ne porte rien dessous.") };
    const entree = (type: EnfantObjectif, libelle: string, icone: ReactNode) => ({
      id: type,
      libelle,
      icone,
      desactive: possibles.includes(type) ? undefined : raison,
      executer: () => commencerEnfant(parentId, type),
    });
    return [
      entree("phase", t("Phase"), <IconFolder />),
      entree("sous-objectif", t("Sous-objectif"), <IconTarget />),
      entree("tache", t("Tâche"), <IconCheckCircle />),
      entree("habitude", t("Habitude"), <IconFlame />),
    ];
  };

  /**
   * ⭐ LES TYPES D'UN NŒUD — Idée, Étape, Tâche, Habitude (2026-09-29).
   *
   * Un nœud typé EST son objet : on ne le convertit pas d'un type à l'autre
   * (transformer une tâche en étape est une transformation de données, hors
   * du chantier). Il se DÉTYPE — redevient une idée, l'objet reste en vie — et
   * se retype ensuite. Les entrées grisées disent pourquoi.
   */
  const entreesType = (id: string): EntreePossible[] => {
    const n = noeudDe(courante, id);
    if (!n || lecture) return [];
    const actuel = typeDeNoeud(n);
    const libre = actuel === "idee";
    const raison = libre
      ? undefined
      : actuel === "citation"
        ? { raison: t("Ce nœud cite déjà un objet : repasse-le en Idée d'abord.") }
        : { raison: t("Un nœud typé EST son objet : repasse-le en Idée pour lui donner un autre type.") };
    const ouvrir = (type: TypeDonnable) => () => setTypage({ type, id });
    return [
      {
        id: "idee",
        libelle: libre ? t("Idée") : t("Idée — retirer le type"),
        icone: <IconPencil />,
        desactive: libre ? { raison: t("C'est déjà une idée : du texte libre.") } : undefined,
        executer: () => modifier((c) => poserReference(c, id, null, n.texte)),
      },
      { id: "etape", libelle: t("Étape…"), icone: <IconFolder />, desactive: raison, executer: ouvrir("etape") },
      { id: "tache", libelle: t("Tâche…"), icone: <IconCheckCircle />, desactive: raison, executer: ouvrir("tache") },
      { id: "habitude", libelle: t("Habitude…"), icone: <IconFlame />, desactive: raison, executer: ouvrir("habitude") },
    ];
  };

  const entreesNoeud = (id: string): EntreePossible[] => {
    const n = noeudDe(courante, id);
    if (!n || id !== selection) return [];
    const racine = n.parent === null;
    const branche = n.parent === racineDe(courante).id;
    const enfants = enfantsDe(courante, id).length > 0;
    const dessous = Math.max(0, sousArbre(courante, id).length - 1);
    if (lecture) return [];
    return [
      { id: "enfant", libelle: t("Sous-nœud"), icone: <IconNoeudEnfant />, raccourci: "Tab", executer: () => creer("enfant") },
      {
        id: "frere",
        libelle: t("Nœud voisin"),
        icone: <IconNoeudFrere />,
        desactive: racine ? { raison: t("Le nœud central n'a pas de voisin : tout part de lui.") } : undefined,
        executer: () => creer("frere"),
      },
      {
        id: "renommer",
        libelle: t("Renommer"),
        icone: <IconPencil />,
        raccourci: "F2",
        desactive: !renommable(n) ? { raison: t("Un nœud lié porte le titre de sa cible : il se renomme là-bas.") } : undefined,
        executer: modifierTexte,
      },
      !objectif && { id: "citer", libelle: t("Citer un objet"), icone: <IconArobase />, executer: citer },
      !objectif && {
        id: "type",
        libelle: t("Type"),
        icone: <IconTarget />,
        raccourci: kbd("⌥T"),
        sousMenu: entreesType(id).filter((x): x is Exclude<EntreePossible, null | false | undefined> => !!x),
      },
      enfants && {
        id: "plier",
        libelle: n.plie ? t("Déplier") : t("Replier"),
        icone: <IconPlier />,
        executer: () => modifier((c) => basculerPli(c, id)),
      },
      branche && !objectif && {
        id: "cote",
        libelle: t("Changer de côté"),
        icone: <IconCote />,
        executer: () => modifier((c) => poserCote(c, id, coteSel === 1 ? -1 : 1)),
      },
      !objectif && {
        id: "rattacher",
        libelle: t("Rattacher à un autre nœud…"),
        icone: <IconLink />,
        raccourci: kbd(t("⌥ glisser")),
        desactive: racine ? { raison: t("Le nœud central ne se rattache à rien : tout part de lui.") } : undefined,
        executer: () => {
          setArme(null);
          setArmeReorg(null);
          setRattache(id);
        },
      },
      {
        id: "supprimer",
        libelle: estRattache(n) ? t("Détacher") : t("Supprimer"),
        icone: <IconTrash />,
        danger: true,
        desactive: racine ? { raison: t("Le nœud central ne se supprime pas : c'est la carte elle-même.") } : undefined,
        // Un nœud qui porte une sous-branche demande confirmation, comme le
        // bouton armé de la barre ; une feuille part d'un coup (⌘Z la rend).
        confirmation:
          dessous > 0
            ? {
                libelle: t("Supprimer"),
                detail: tp(dessous, "Ce nœud et celui qui pend dessous disparaissent.", "Ce nœud et les {n} qui pendent dessous disparaissent."),
              }
            : undefined,
        executer: () => effacerNoeud(id),
      },
    ];
  };
  const outil = OUTIL;

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-black/60 p-4 backdrop-blur-sm sm:p-6">
      <div className="card card-solid animate-fade-up flex min-h-0 w-full flex-1 flex-col p-4">
        {/* En-tête */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* ⚠️ `basis-40` : sur un écran de 375 pt, la barre passe à la ligne, et
              sans plancher de largeur le titre se faisait rogner jusqu'à une
              seule lettre (« M. »). Avec lui, il prend sa propre ligne au lieu
              de disparaître. Vu sur viewport téléphone le 2026-09-07. */}
          <h3 className="min-w-0 flex-1 basis-40 truncate font-display text-lg font-bold text-text">
            {titre || t("Carte mentale")}
          </h3>
          {message && <span className="text-xs text-success">{message}</span>}
          {lecture && (
            /* ⭐ Dit ce que l'écran EST, avant qu'on cherche pourquoi on ne peut
               pas y écrire. Un écran silencieux sur sa propre nature se lit
               comme un écran cassé. */
            <span
              className="pill shrink-0 border border-border px-2 py-0.5 text-[11px] text-text-dim"
              data-tip={t("La carte se lit")}
              data-tip-sub={t("Elle est dessinée depuis la feuille de route : c'est là qu'on la modifie.")}
            >
              {t("lecture")}
            </span>
          )}
          {objectif && (
            /* ⭐ Dit ce que l'écran EST : chaque nœud est un vrai objet, et ce
               qu'on y change change la feuille de route. */
            <span
              className="pill shrink-0 border border-border px-2 py-0.5 text-[11px] text-text-dim"
              data-tip={t("Une seconde vue de la feuille de route")}
              data-tip-sub={t("Chaque nœud est un vrai objet : le renommer, le cocher ou le supprimer ici le fait aussi dans la feuille de route. Le glisser ne change que sa place à l'écran.")}
            >
              {t("feuille de route")}
            </span>
          )}
          {!lecture && !objectif && (
          <>
          <button
            type="button"
            onClick={() => setHistoire(annuler)}
            disabled={histoire.passe.length === 0}
            data-tip={t("Annuler")}
            data-tip-kbd={kbd("⌘Z")}
            className={outil}
          >
            <IconReset className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setHistoire(retablir)}
            disabled={histoire.futur.length === 0}
            data-tip={t("Rétablir")}
            data-tip-kbd={kbd("⌘⇧Z")}
            className={`${outil} [&>svg]:-scale-x-100`}
          >
            <IconReset className="h-3.5 w-3.5" />
          </button>
          </>
          )}
          <span className="mx-0.5 h-5 w-px bg-border" />
          {!lecture && !objectif && (
            /* ⭐ LE PONT VERS LES OBJECTIFS EST ICI, dans l'éditeur, et pas dans
               chacune des deux vues qui l'hébergent (Notes et Savoir) : posé
               chez les hôtes, il aurait fallu l'écrire deux fois, et la
               deuxième copie aurait fini par diverger. Le panneau, lui, est
               autonome (`components/objectifs/DepuisCarte.tsx`). */
            <button
              type="button"
              onClick={() => setVersObjectif(true)}
              data-tip={t("En faire un objectif")}
              data-tip-sub={t("Le centre devient l'objectif, les branches sa feuille de route. La carte, elle, ne bouge pas.")}
              className={outil}
            >
              <IconTarget className="h-3.5 w-3.5" /> {t("Objectif")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void exporter("png")}
            data-tip={t("Exporter en PNG")}
            data-tip-sub={t("Une image qui se colle partout.")}
            className={outil}
          >
            <IconSave className="h-3.5 w-3.5" /> PNG
          </button>
          <button
            type="button"
            onClick={() => void exporter("svg")}
            data-tip={t("Exporter en SVG")}
            data-tip-sub={t("Net à n'importe quel agrandissement.")}
            className={outil}
          >
            <IconSave className="h-3.5 w-3.5" /> SVG
          </button>
          <button
            type="button"
            onClick={onFermer}
            data-tip={lecture ? t("Fermer") : t("Terminé")}
            data-tip-sub={lecture ? undefined : t("La carte est déjà enregistrée.")}
            aria-label={lecture ? t("Fermer") : t("Terminé")}
            className="pill ml-1 inline-flex h-8 items-center gap-1.5 fill-primary px-4 text-xs font-semibold"
          >
            <IconCheck className="h-3.5 w-3.5" /> {lecture ? t("Fermer") : t("Terminé")}
          </button>
          {/* ⚠️ Pas de croix en LECTURE : le bouton bleu dit déjà « Fermer », et
              deux fois le même mot dans la même barre ne se lit plus comme un
              choix mais comme une hésitation. En édition les deux cohabitent
              depuis le 2026-09-07 — « Terminé » y valide, la croix quitte. */}
          {!lecture && (
            <button
              type="button"
              onClick={onFermer}
              aria-label={t("Fermer")}
              className="rounded-md p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text"
            >
              <IconX className="h-4 w-4" />
            </button>
          )}
        </div>

        {/*
          La barre d'outils — la carte se construit ENTIÈREMENT à la souris.

          ⭐ Chaque bouton porte une icône ET un mot : c'est la demande
          d'Antonin (2026-09-07), « pour quelqu'un qui ne s'en est jamais
          servi ». Une icône seule se devine ; une icône plus un mot se lit.
          L'info-bulle ajoute la phrase complète et le raccourci — c'est ainsi
          qu'on apprend le clavier en se servant de la souris, plutôt qu'en
          lisant un pied de page.

          ⚠️ Trois groupes séparés par des filets : CRÉER, le nœud choisi, la
          vue. Sans cette séparation, dix boutons alignés se lisent comme une
          liste indifférenciée où l'on cherche à chaque fois.
        */}
        <div className="mt-3 flex shrink-0 flex-wrap items-center gap-1 rounded-[var(--radius-field)] border border-border bg-surface-2 px-1.5 py-1">
          {!lecture && (
          <>
          <Outil
            libelle={t("Sous-nœud")}
            aide={t("Une idée qui découle de celle sélectionnée.")}
            raccourci="Tab"
            onClick={() => creer("enfant")}
          >
            <IconNoeudEnfant className="h-3.5 w-3.5" />
          </Outil>
          <Outil
            libelle={t("Nœud voisin")}
            aide={
              estRacine
                ? t("Le nœud central n'a pas de voisin : tout part de lui.")
                : estBranche
                  ? t("Une branche de plus. Elle naît du côté le moins chargé, pour équilibrer la carte.")
                  : t("Une idée au même niveau, juste en dessous.")
            }
            raccourci={kbd("⌘↵")}
            disabled={estRacine}
            onClick={() => creer("frere")}
          >
            <IconNoeudFrere className="h-3.5 w-3.5" />
          </Outil>

          <span className="mx-1 h-5 w-px bg-border" />

          <Outil
            libelle={t("Renommer")}
            aide={
              noeudSel && !renommable(noeudSel)
                ? t("Un nœud lié porte le titre de sa cible : il se renomme là-bas.")
                : objectif && noeudSel?.ref
                  ? t("Renomme l'objet lui-même : la feuille de route suit.")
                  : t("Réécrire le texte du nœud sélectionné.")
            }
            raccourci={t("Entrée")}
            disabled={!noeudSel || !renommable(noeudSel)}
            onClick={modifierTexte}
          >
            <IconPencil className="h-3.5 w-3.5" />
          </Outil>
          {!objectif && (
          <Outil
            libelle={t("Citer un objet")}
            aide={t("Remplace le nœud par un lien vers une note, une tâche, une fiche…")}
            raccourci="@"
            disabled={!noeudSel}
            onClick={citer}
          >
            <IconArobase className="h-3.5 w-3.5" />
          </Outil>
          )}
          <Outil
            libelle={noeudSel?.plie ? t("Déplier") : t("Replier")}
            aide={
              aDesEnfants
                ? t("Cacher ou remontrer ce qui pend sous ce nœud.")
                : t("Ce nœud n'a rien en dessous à cacher.")
            }
            raccourci={t("Espace")}
            disabled={!aDesEnfants}
            onClick={() => modifier((c) => basculerPli(c, selection))}
          >
            <IconPlier className="h-3.5 w-3.5" />
          </Outil>
          {!objectif && (
          <Outil
            libelle={t("Changer de côté")}
            aide={
              estBranche
                ? t("Faire passer cette branche, et tout ce qui pend dessous, de l'autre côté du centre.")
                : t("Seule une branche partant du centre a un côté à changer.")
            }
            raccourci={t("⌥ flèches")}
            disabled={!estBranche}
            onClick={() => modifier((c) => poserCote(c, selection, coteSel === 1 ? -1 : 1))}
          >
            <IconCote className={`h-3.5 w-3.5 ${coteSel === -1 ? "-scale-x-100" : ""}`} />
          </Outil>
          )}
          <Outil
            libelle={estArme ? t("Confirmer") : estRattache(noeudSel) ? t("Détacher") : t("Supprimer")}
            aide={
              estRacine
                ? t("Le nœud central ne se supprime pas : c'est la carte elle-même.")
                : estArme
                  ? aEmporter > 0
                    ? t("Tout ce qui est en rouge disparaît : ce nœud et les {n} qui pendent dessous. Échap annule.", {
                        n: aEmporter,
                      })
                    : t("Ce nœud disparaît. Échap annule.")
                  : estRattache(noeudSel)
                    ? t("Retire le lien avec l'objectif : la note, elle, reste. Un premier appui montre ce qui partirait.")
                    : objectif
                      ? t("Met l'objet dans « Supprimés récemment » (30 jours), avec ce qui pend dessous. Un premier appui montre ce qui partirait.")
                      : t("Retire ce nœud et tout ce qui pend dessous. Un premier appui montre ce qui partirait.")
            }
            raccourci="⌫"
            disabled={estRacine}
            danger={estArme}
            onClick={supprimer}
          >
            <IconTrash className="h-3.5 w-3.5" />
          </Outil>
          {/* ⭐ RÈGLE 17 : le menu du nœud n'existait qu'au clic droit — donc pas
              du tout au doigt, où l'appui long appartient au glisser
              (`useMenuContextuel`, `ouvrirAuPoint`). Ce bouton l'ouvre pour le
              nœud sélectionné. Il vit dans la BARRE et pas sur chaque boîte :
              un « ⋯ » dessiné dans le SVG finirait dans le corps de la note. */}
          <Outil
            libelle={t("Actions")}
            aide={t("Tout ce qu'on peut faire du nœud sélectionné — le même menu que le clic droit.")}
            disabled={!noeudSel}
            onClick={(e) => menuNoeud.ouvrirSousLeBouton(e, selection)}
          >
            <IconPoints className="h-3.5 w-3.5" />
          </Outil>
          </>
          )}

          {lecture && (
            <>
              <Outil
                libelle={noeudSel?.plie ? t("Déplier") : t("Replier")}
                aide={
                  aDesEnfants
                    ? t("Cacher ou remontrer ce qui pend sous ce nœud.")
                    : t("Ce nœud n'a rien en dessous à cacher.")
                }
                raccourci={t("Espace")}
                disabled={!aDesEnfants}
                onClick={() => modifier((c) => basculerPli(c, selection))}
              >
                <IconPlier className="h-3.5 w-3.5" />
              </Outil>
              <Outil
                libelle={t("Ouvrir")}
                aide={
                  noeudSel?.mort
                    ? t("La cible de ce nœud n'existe plus.")
                    : t("Ouvrir l'étape ou la tâche que ce nœud désigne.")
                }
                raccourci={t("Entrée")}
                disabled={!noeudSel?.ref || !!noeudSel?.mort}
                onClick={() => noeudSel?.ref && ouvrirCible(noeudSel.ref.kind, noeudSel.ref.uid)}
              >
                <IconExternal className="h-3.5 w-3.5" />
              </Outil>
            </>
          )}

          <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" />

          <div className="ml-auto flex items-center gap-1">
            <Outil
              libelle={t("Zoom arrière")}
              aide={t("Voir de plus loin.")}
              iconeSeule
              disabled={vue.z <= ZOOM_MIN + 0.001}
              onClick={() => zoomer(1 / PAS_ZOOM)}
            >
              <IconZoomMoins className="h-3.5 w-3.5" />
            </Outil>
            <span className="w-11 text-center text-[11px] tabular-nums text-text-dim">
              {Math.round(vue.z * 100)} %
            </span>
            <Outil
              libelle={t("Zoom avant")}
              aide={t("Voir de plus près.")}
              iconeSeule
              disabled={vue.z >= ZOOM_MAX - 0.001}
              onClick={() => zoomer(PAS_ZOOM)}
            >
              <IconZoomPlus className="h-3.5 w-3.5" />
            </Outil>
            {/* ⚠️ `() => toutVoir()` et PAS `onClick={toutVoir}` : le bouton passe
                l'événement de clic, qui devenait le `plancher` du cadrage
                (paramètre ajouté le 2026-09-20) — le zoom tombait à NaN. */}
            <Outil libelle={t("Tout voir")} aide={t("Recadrer la carte entière dans la fenêtre.")} onClick={() => toutVoir()}>
              <IconExpand className="h-3.5 w-3.5" />
            </Outil>
            {!lecture && (
              <Outil
                libelle={reorgArme ? t("Confirmer") : t("Réorganiser")}
                aide={
                  nManuels === 0
                    ? t("Aucun nœud n'a été déplacé à la main : la carte est déjà rangée automatiquement.")
                    : reorgArme
                      ? tp(nManuels, "Le nœud déplacé à la main reprend sa place automatique. Échap annule.", "Les {n} nœuds déplacés à la main reprennent leur place automatique. Échap annule.")
                      : t("Remettre toute la carte en rangement automatique. Un premier appui dit combien de nœuds bougeraient.")
                }
                disabled={nManuels === 0}
                danger={reorgArme}
                onClick={reorganiserCarte}
              >
                <IconSliders className="h-3.5 w-3.5" />
              </Outil>
            )}
          </div>
        </div>

        {/* La scène */}
        <div
          ref={scene}
          onPointerDown={surAppui}
          onContextMenu={(e) => {
            const cible = (e.target as HTMLElement).closest?.("[data-noeud]") as HTMLElement | null;
            const id = cible?.dataset.noeud;
            if (!id || lecture || rattache) return;
            if (edition && edition !== id) fermerEdition(true);
            setSelection(id);
            menuNoeud.ouvrirAuPoint(e, id);
          }}
          onWheel={surMolette}
          onDoubleClick={(e) => {
            if (lecture) return;
            const cible = (e.target as HTMLElement).closest?.("[data-noeud]") as HTMLElement | null;
            const id = cible?.dataset.noeud;
            const n = id ? noeudDe(courante, id) : undefined;
            if (id && n && (!objectif || renommable(n))) ouvrirEdition(id, n.texte, true);
          }}
          className="carte-scene relative mt-2 min-h-0 flex-1 overflow-hidden rounded-[var(--radius-field)] border border-border bg-surface-2 touch-none"
        >
          <div
            style={{
              position: "absolute",
              transform: `translate(${vue.x}px, ${vue.y}px) scale(${vue.z})`,
              transformOrigin: "0 0",
              width: agencement.largeur,
              height: agencement.hauteur,
            }}
          >
            <div
              // Le SVG est une CHAÎNE produite par une fonction pure : c'est ce
              // qui rend le rendu testable, et ce qui garantit que l'export est
              // exactement ce qu'on voit.
              dangerouslySetInnerHTML={{ __html: svg }}
            />

            {/* L'état vivant des nœuds typés : PAR-DESSUS le SVG, jamais dedans. */}
            <EtatsVivants agencement={agencement} etats={etats} onCocher={cocher} />

            {/* Le champ d'édition, posé EXACTEMENT sur la boîte du nœud. Il vit
                dans le même conteneur transformé, donc il suit le zoom sans
                calcul supplémentaire. */}
            {edition && boiteEnEdition && (
              <input
                ref={champ}
                value={brouillon}
                onChange={(e) => {
                  setBrouillon(e.target.value);
                  void verifierMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
                }}
                onBlur={() => fermerEdition(true)}
                onKeyDown={(e) => {
                  // ⚠️ Le sélecteur passe AVANT tout le reste : sa flèche du bas
                  // n'est pas celle de la carte.
                  if (mention) {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const n = mention.resultats.length;
                      if (n) setChoix((s) => (e.key === "ArrowDown" ? (s + 1) % n : (s - 1 + n) % n));
                      return;
                    }
                    // Tab autant qu'Entrée : dans une liste de suggestions, les
                    // deux veulent dire « celle-ci » (comme `RichNoteEditor`).
                    if ((e.key === "Enter" || e.key === "Tab") && mention.resultats[choix]) {
                      e.preventDefault();
                      choisirMention(mention.resultats[choix]);
                      return;
                    }
                  }
                  // ⭐ ENTRÉE VALIDE, ET RIEN D'AUTRE (2026-09-07). Elle
                  // enregistre le texte et referme le champ, en laissant la
                  // sélection sur le nœud qu'on vient d'écrire. Créer un voisin
                  // dans la foulée est devenu ⌘Entrée — un geste distinct pour
                  // un effet distinct.
                  // Carte d'objectif : Entrée, Tab et ⌘Entrée VALIDENT, rien de plus.
                  // Enchaîner sur un nœud neuf demanderait de choisir son type : on
                  // le fait par Tab, une fois la saisie close.
                  if (objectif && (e.key === "Enter" || e.key === "Tab")) {
                    e.preventDefault();
                    fermerEdition(true);
                    return;
                  }
                  if (objectif && (e.key === "Backspace" || e.key === "Delete") && brouillon === "" && attenteRef.current?.id === edition) {
                    e.preventDefault();
                    fermerEdition(false);
                    return;
                  }
                  if (e.key === "Enter" && !(e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    const id = edition;
                    fermerEdition(true);
                    setSelection(id);
                    return;
                  }
                  if (e.key === "Tab" || e.key === "Enter") {
                    e.preventDefault();
                    const id = edition;
                    const base = validerEdition(id, brouillon);
                    const r = e.key === "Tab" ? ajouterEnfant(base, id) : ajouterFrere(base, id);
                    setHistoire((h) => appliquer(h, r.carte));
                    setSelection(r.neuf);
                    setEdition(null);
                    ouvrirEdition(r.neuf, "", false);
                    return;
                  }
                  if ((e.key === "Backspace" || e.key === "Delete") && brouillon === "") {
                    const n = noeudDe(courante, edition);
                    if (n?.parent) {
                      e.preventDefault();
                      const parent = n.parent;
                      const id = edition;
                      setEdition(null);
                      // ⭐ ICI, ET SEULEMENT ICI, LE ⌫ RESTE INSTANTANÉ — mais
                      // uniquement sur un nœud VIDE ET SANS DESCENDANCE. C'est
                      // le geste qui annule le Tab qu'on vient de taper : il ne
                      // détruit rien qui ait jamais existé, et l'armer
                      // obligerait à confirmer l'effacement d'une case blanche.
                      // Dès qu'il y a quelque chose dessous, on repasse par les
                      // deux temps : la case est vide, sa branche ne l'est pas.
                      if (enfantsDe(courante, id).length > 0) {
                        setSelection(id);
                        setArme(id);
                        return;
                      }
                      modifier((c) => supprimerNoeud(c, id));
                      setSelection(parent);
                    }
                  }
                }}
                className="absolute rounded-[9px] border-2 border-blue bg-surface px-3 text-[14px] text-text focus:outline-none"
                style={{
                  left: boiteEnEdition.x,
                  top: boiteEnEdition.y,
                  width: Math.max(boiteEnEdition.w, LARGEUR_CHAMP_MIN),
                  height: boiteEnEdition.h,
                }}
              />
            )}
          </div>

          {/* Ce qu'un glissement va faire, dit à l'écran plutôt que deviné. */}
          {apercu && (
            <div className="glass pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border px-3 py-1.5 text-[11px] text-text">
              {t("Déplacé à l'écran — la structure ne change pas")}
              <span className="text-text-dim [@media(pointer:coarse)]:hidden">
                {" · "}
                {t("⌥ + glisser pour le rattacher ailleurs")}
              </span>
            </div>
          )}
          {rattache && (
            <div className="glass pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-blue px-3 py-1.5 text-[11px] text-text">
              {t("Choisis le nœud qui accueillera « {titre} »", {
                titre: noeudDe(courante, rattache)?.texte || t("sans titre"),
              })}
            </div>
          )}
          {glisse && (
            <div className="glass pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border px-3 py-1.5 text-[11px] text-text">
              {glisse.cible && glisse.cible !== glisse.id
                ? t("Déposer sous « {cible} »", {
                    cible: noeudDe(courante, glisse.cible)?.texte || t("sans titre"),
                  })
                : t("Relâche sur un nœud pour l'y rattacher")}
            </div>
          )}
        </div>

        {/* Le pied d'aide : les raccourcis ne servent que si on les connaît. */}
        <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-dim">
          {reorgArme ? (
            <>
              <span className="font-semibold text-red">
                {tp(
                  nManuels,
                  "Aperçu : le nœud déplacé à la main reprend sa place automatique.",
                  "Aperçu : les {n} nœuds déplacés à la main reprennent leur place automatique.",
                )}
              </span>
              <span>
                <b className="text-text">{t("Réorganiser")}</b> {t("confirmer")}
              </span>
              <span>
                <b className="text-text">{t("Échap")}</b> {t("annuler|renoncer")}
              </span>
            </>
          ) : rattache ? (
            <>
              <span className="font-semibold text-text">
                <span className="[@media(pointer:coarse)]:hidden">{t("Clique le nœud qui doit l'accueillir.")}</span>
                <span className="hidden [@media(pointer:coarse)]:inline">{t("Touche le nœud qui doit l'accueillir.")}</span>
              </span>
              <span className="[@media(pointer:coarse)]:hidden">
                <b className="text-text">{t("Flèches")}</b> {t("choisir")} · <b className="text-text">{t("Entrée")}</b> {t("valider")}
              </span>
              <span>
                <b className="text-text">{t("Échap")}</b> {t("annuler|renoncer")}
              </span>
            </>
          ) : estArme ? (
            /*
              ⭐ ARMÉ, LE PIED DIT CE QUI VA PARTIR — et remplace la légende des
              raccourcis, qui n'a plus aucune importance à cet instant précis.
              Le rouge est déjà sur la carte ; ici on met le CHIFFRE, parce
              qu'une branche repliée ne montre pas ce qu'elle cache, et le
              moyen d'en sortir, parce qu'une confirmation sans porte de
              sortie visible n'est pas une confirmation.
            */
            <>
              <span className="font-semibold text-red">
                {aEmporter > 0
                  ? t("Ce nœud et les {n} qui pendent dessous vont disparaître.", { n: aEmporter })
                  : t("Ce nœud va disparaître.")}
              </span>
              <span>
                <b className="text-text">⌫</b> {t("confirmer")}
              </span>
              <span>
                <b className="text-text">{t("Échap")}</b> {t("annuler|renoncer")}
              </span>
            </>
          ) : lecture ? (
            /* ⚠️ DEUX PIEDS, choisis par le POINTEUR et non par la largeur.
               « Clic » et « molette » ne veulent rien dire au doigt, et le
               pincement ne zoome pas ici (la scène porte `touch-action: none`,
               sans quoi le glissement serait un défilement) : les deux loupes
               sont la seule façon de zoomer, autant le dire. Le choix se fait
               en CSS — un `matchMedia` en JS ne suivrait pas une rotation sans
               écouteur, et ce pied n'est que du texte. */
            <>
              <span className="[@media(pointer:coarse)]:hidden">
                <b className="text-text">{t("Clic")}</b> {t("ouvrir")}
              </span>
              <span className="hidden [@media(pointer:coarse)]:inline">
                <b className="text-text">{t("Appui")}</b> {t("ouvrir")}
              </span>
              <span className="[@media(pointer:coarse)]:hidden">
                <b className="text-text">{t("Flèches")}</b> {t("se déplacer")}
              </span>
              <span className="hidden [@media(pointer:coarse)]:inline">
                <b className="text-text">{t("Glisser")}</b> {t("se déplacer")}
              </span>
              <span className="[@media(pointer:coarse)]:hidden">
                <b className="text-text">{t("Espace")}</b> {t("replier")}
              </span>
              <span className="text-text-dim/70 [@media(pointer:coarse)]:hidden">
                {t("molette : déplacer · ⌘molette : zoomer")}
              </span>
              <span className="hidden text-text-dim/70 [@media(pointer:coarse)]:inline">
                {t("les loupes zooment")}
              </span>
            </>
          ) : (
          <>
          {/* ⚠️ DEUX PIEDS, comme celui de la lecture : au doigt, ni Tab, ni
              flèches, ni molette. Sans cette variante, la carte d'un objectif —
              qui avait le pied tactile de la lecture jusqu'au 2026-09-29 — aurait
              parlé de touches à qui n'en a pas. */}
          <span className="hidden [@media(pointer:coarse)]:inline">
            <b className="text-text">{t("Appui long")}</b> {t("déplacer un nœud")}
          </span>
          <span className="hidden [@media(pointer:coarse)]:inline">
            <b className="text-text">{t("Glisser")}</b> {t("se déplacer")}
          </span>
          <span className="hidden [@media(pointer:coarse)]:inline">
            <b className="text-text">⋯</b> {t("les actions du nœud")}
          </span>
          <span className="hidden text-text-dim/70 [@media(pointer:coarse)]:inline">{t("les loupes zooment")}</span>
          <span className="contents [@media(pointer:coarse)]:hidden">
          <span>
            <b className="text-text">{t("Entrée")}</b> {t("valider")}
          </span>
          <span>
            <b className="text-text">Tab</b> {t("sous-nœud")}
          </span>
          <span>
            <b className="text-text">{kbd("⌘↵")}</b> {t("voisin")}
          </span>
          <span>
            <b className="text-text">{t("Flèches")}</b> {t("se déplacer")}
          </span>
          <span>
            <b className="text-text">{t("Espace")}</b> {t("replier")}
          </span>
          {!objectif && (
            <>
              <span>
                <b className="text-text">@</b> {t("citer un objet")}
              </span>
              <span>
                <b className="text-text">{kbd("⌘Z")}</b> {t("annuler")}
              </span>
            </>
          )}
          <span>
            <b className="text-text">{t("Glisser")}</b> {t("déplacer un nœud")}
          </span>
          {!objectif && (
            <span className="[@media(pointer:coarse)]:hidden">
              <b className="text-text">{kbd("⌥")}</b> {t("+ glisser : le rattacher ailleurs")}
            </span>
          )}
          <span className="text-text-dim/70">{t("molette : déplacer · ⌘molette : zoomer")}</span>
          </span>
          </>
          )}
          {noeudSel?.ref && !noeudSel.mort && (
            <button
              type="button"
              onClick={() => ouvrirCible(noeudSel.ref!.kind, noeudSel.ref!.uid)}
              className="pill ml-auto inline-flex h-6 items-center gap-1 border border-border px-2 text-[11px] text-text-dim hover:text-text"
            >
              <IconExternal className="h-3 w-3" /> {t("Ouvrir « {titre} »", { titre: noeudSel.texte })}
            </button>
          )}
          {noeudSel?.mort && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-text-dim">
              <IconTrash className="h-3 w-3" /> {t("La cible de ce nœud n'existe plus.")}
            </span>
          )}
        </div>
      </div>

      {/*
        ⚠️ LE SÉLECTEUR EST RENDU ICI, DANS LE CALQUE DE LA CARTE, ET SURTOUT
        PAS PORTÉ SUR `document.body` — vu à l'écran le 2026-09-07 : porté sur
        `body`, il devenait un FRÈRE de ce voile, et comme il est en `z-50`
        quand le voile est en `z-[75]`, il se peignait DESSOUS. Il existait, il
        contenait les bons résultats, et on ne le voyait pas.

        Ici, il hérite du `z-[75]` de ce conteneur et passe donc au-dessus.

        ⚠️ Et il doit rester en dehors de `.carte-scene` : la scène porte un
        `transform`, ce qui ferait d'elle le bloc conteneur d'un descendant
        `position: fixed` — le sélecteur se placerait alors par rapport à la
        carte zoomée au lieu de la fenêtre. Ce voile-ci, lui, couvre exactement
        la fenêtre, donc les deux repères coïncident.
      */}
      {versObjectif && !lecture && donnees && (
        <DepuisCarte
          carte={courante}
          existants={donnees.data}
          onFermer={() => setVersObjectif(false)}
          onQuitterCarte={onFermer}
        />
      )}

      <MenuContextuel
        etat={menuNoeud}
        libelle={t("Actions sur le nœud")}
        entrees={menuNoeud.cible ? entreesNoeud(menuNoeud.cible) : []}
      />
      <MenuContextuel
        etat={menuType}
        libelle={t("Type du nœud")}
        entrees={menuType.cible ? entreesType(menuType.cible) : []}
      />
      <MenuContextuel
        etat={menuCreation}
        libelle={t("Ajouter sous ce nœud")}
        entrees={menuCreation.cible ? entreesCreation(menuCreation.cible) : []}
      />

      {typage && !lecture && donnees && (
        <PanneauType
          type={typage.type}
          carte={courante}
          noeudId={typage.id}
          goals={donnees.data.goals}
          ajout={!!objectif}
          onFermer={() => {
            // Carte d'objectif : l'habitude en attente renonce, son nœud part.
            const attente = attenteRef.current;
            if (objectif && attente?.id === typage.id) retirerAttente(attente);
            setTypage(null);
          }}
          onCree={(ref, titreObjet, genre) => {
            const id = typage.id;
            const attente = attenteRef.current;
            setTypage(null);
            // Carte d'objectif : l'objet existe, la carte re-dérivée le montre —
            // le nœud provisoire n'a plus de raison d'être.
            if (objectif && attente?.id === id) {
              retirerAttente(attente);
              return;
            }
            modifier((c) => poserReference(c, id, ref, titreObjet, genre));
            setSelection(id);
          }}
        />
      )}

      {mention && (
        <MentionPicker
          resultats={mention.resultats}
          selection={choix}
          position={mention.position}
          onChoisir={choisirMention}
        />
      )}
    </div>
  );
}
