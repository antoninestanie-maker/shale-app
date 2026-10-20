import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import GoalModal from "../components/GoalModal";
import ImporterChecklist from "../components/objectifs/ImporterChecklist";
import FeuilleDeRoute from "../components/objectifs/FeuilleDeRoute";
import CarteObjectif from "../components/objectifs/CarteObjectif";
import EcheanceObjectif from "../components/objectifs/EcheanceObjectif";
import { IconCarte, IconCheck, IconChevronLeft, IconChevronRight, IconPencil, IconPlus, IconTrash } from "../components/icons";
import { CaseACocher, useCochesOptimistes } from "../components/CaseACocher";
import { todayStr } from "../lib/logic";
import { faitDEcheance, mentionEcheance } from "../lib/objectifs/echeance";
import { lireReplis, origineEnClair, type Replis } from "../lib/objectifs/libelles";
import { estAcheve, mesurer, type Mesure, type SourcesProgression } from "../lib/objectifs/progression";
import { prochaineAction, type ProchaineAction } from "../lib/objectifs/prochaineAction";
import { CONTEXTE_VIDE, type ContexteObjectifs } from "../lib/objectifs/contexte";
import { cocherEtape, fetchContexteObjectifs, getSetting, majFeuilleDeRoute, setSetting } from "../lib/repo";
import { bilanDeDepart } from "../lib/corbeille/lots";
import { annonceDepart, jeter } from "../components/corbeille/geste";
import MenuContextuel from "../components/menu/MenuContextuel";
import { useMenuContextuel } from "../components/menu/useMenuContextuel";
import { auFilDeLaLigne } from "../lib/calendrier/champDate";
import { consommerDemande, consommerGeste } from "../lib/naviguer";
import { mouvementReduit } from "../lib/defilement";
import { jouerTransition, type Sens } from "../lib/objectifs/transition";
import { menuContextuelOuvert } from "../lib/menu/tactile";
import type { EntreePossible } from "../lib/menu/entrees";
import { useIaPossible } from "../lib/ia/useIa";
import { demanderIa } from "../lib/ia/demande";
import { peutDecomposer } from "../lib/ia/planifier";
import { objectifsEnPeril } from "../lib/calendrier/peril";
import { IconeIa } from "../components/ia/IconeIa";
import type { AppData, Goal } from "../lib/types";

import { pick, t } from "../lib/i18n";
import PointAction from "../components/PointAction";
import { useActions } from "../lib/pointAction/contexte";
import { racineDe } from "../lib/objectifs/structure";
interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

/**
 * ⭐⭐ 2026-10-08 — LA LISTE, PUIS LA PAGE D'UN OBJECTIF. Demande d'Antonin :
 * « avoir la liste des objectifs, puis pouvoir cliquer sur l'objectif pour avoir
 * une vue sur l'objectif seul, avec ses jalons, tâches, etc. Avec en plus une
 * barre de progression du même style que celle qui descend sur le site quand on
 * scrolle ». Le maître-détail du 2026-09-29 (décrit dessous) est donc REMPLACÉ :
 *   • la vue s'ouvre sur la LISTE, pleine largeur — une ligne par objectif, sa
 *     prochaine action, son fil couché et son pourcentage ;
 *   • un clic ouvre la PAGE de l'objectif, seul à l'écran ; « ← Tous les
 *     objectifs » ou Échap ramènent à la liste, là où on l'avait laissée ;
 *   • « le fil » (`index.css`, `.fil-item` / `.fil-h`) est la barre du site :
 *     pointillés devant, trait plein derrière, un nœud par étape, l'orbe là où
 *     on en est. Couché dans la liste et en tête de page ; debout le long de la
 *     feuille de route (`FeuilleDeRoute`, prop `fil`).
 * Ce qui NE change pas : aucune règle métier (le chiffre vient de `mesurer`),
 * le menu d'un objectif, la carte mentale, la création, `sb:open-goal`.
 * Le bureau et l'iPhone ont désormais le MÊME parcours (liste OU page).
 *
 * ── Ce qui suit décrit la vue du 2026-09-29, gardé pour ses raisons ──
 *
 * ⭐ LA VUE OBJECTIFS EN MAÎTRE-DÉTAIL — phase D du chantier carte-objectifs,
 * direction B choisie à l'arrêt 3 (2026-09-29), « mais épure un peu encore ».
 *
 * À gauche, la liste : un objectif par ligne, son pourcentage, et UNE ligne
 * dessous — sa prochaine action (`prochaineAction.ts`), sinon son échéance.
 * À droite, la fiche de l'objectif choisi : une phrase d'origine unique, puis
 * la feuille de route. Sur iPhone, le motif des Notes : la liste OU la fiche,
 * avec un retour.
 *
 * Ce que l'épure a retiré par rapport à la maquette B : la frise décorative,
 * les colonnes « Tâches / Habitudes » (l'habitude qui compte se lit dans la
 * ligne de son étape), l'encadré « Ensuite » répété dans la fiche (il est dans
 * la liste), la bascule Plan / Carte (un bouton « Carte » ouvre l'éditeur plein
 * écran, qui a besoin de toute la place), les trois boutons au survol (un seul
 * « ⋯ », visible), et les panneaux redimensionnables par catégorie — le
 * réglage `layout.goals` qu'ils écrivaient est orphelin, sans effet.
 *
 * ⚠️ Aucune règle métier ne change ici : le chiffre vient de `mesurer`, la
 * prochaine action n'est qu'une lecture.
 */

/**
 * Clés FRANÇAISES : la table est construite à l'import, donc `t()` y serait
 * figé sur la langue du démarrage. On traduit à l'AFFICHAGE — même idiome que
 * `t(iv.bias)` dans Market-Brain.
 */
const SCOPE_LABEL: Record<Goal["scope"], string> = {
  short: "court terme",
  medium: "moyen terme",
  long: "long terme",
};

const SCOPE_ORDER: Record<Goal["scope"], number> = {
  long: 0,
  medium: 1,
  short: 2,
};

/** Les choix de repliement de la vue — géométrie d'écran, hors synchronisation. */
const CLE_REPLIS = "layout.goals.replis";

/** L'événement qu'`App.tsx` réémet quand on demande d'ouvrir un objectif déjà à l'écran. */
const EVT_OUVRIR_OBJECTIF = "sb:open-goal";

/**
 * Ce que la LIGNE d'un objectif écrit de son échéance.
 *
 * ⭐ 2026-10-12 — la date est ÉCRITE, année comprise quand ce n'est pas l'année
 * en cours (`mentionEcheance`, `lib/objectifs/echeance.ts` : la même écriture
 * que sur Aujourd'hui et sur une étape). Avant, une échéance à venir ne
 * donnait que « J−123 » : il fallait compter pour savoir quel jour, et
 * personne ne savait quelle année (labo, seconde passe, rang 8).
 */
function deadlineInfo(deadline: string | null): {
  /** « échéance 12 février 2027 » — vide une fois l'échéance dépassée : le retard la remplace. */
  date: string;
  /** « en retard de 41 j », « aujourd'hui », « J−3 » — vide quand l'échéance est loin. */
  label: string;
  urgent: boolean;
  /** L'échéance est DÉPASSÉE — la ligne de la liste le dit même quand elle montre la prochaine action. */
  depassee: boolean;
} | null {
  const m = mentionEcheance(deadline, todayStr());
  if (!m) return null;
  if (m.retard > 0) return { date: "", label: t("en retard de {n} j", { n: m.retard }), urgent: true, depassee: true };
  const date = t("échéance {date}", { date: m.date });
  if (m.joursRestants === 0) return { date: "", label: t("échéance aujourd'hui"), urgent: true, depassee: false };
  // « J−3 » en français, « D−3 » en anglais : l'initiale suit la langue.
  // Seulement dans la dernière semaine : plus loin, la date suffit.
  const proche = m.joursRestants <= 7;
  return { date, label: proche ? `${pick("J", "D")}−${m.joursRestants}` : "", urgent: proche, depassee: false };
}

/** L'échéance d'une ligne : la date, puis ce qui presse (« J−3 », le retard) — en rouge. */
function echeanceDeLigne(dl: NonNullable<ReturnType<typeof deadlineInfo>>) {
  return (
    <>
      {dl.date && <span className="shrink-0">{dl.date}</span>}
      {dl.date && dl.label && <span className="shrink-0" aria-hidden>·</span>}
      {/* Grammaire (2026-10-20) : le retard est rouge, l'échéance proche est ambre. */}
      {dl.label && (
        <span className={`shrink-0 ${dl.depassee ? "font-medium text-red" : dl.urgent ? "font-medium text-yellow" : ""}`}>{dl.label}</span>
      )}
    </>
  );
}

/** Une frappe dans un champ n'est pas un geste de navigation. */
function dansUnChamp(cible: EventTarget | null): boolean {
  if (!(cible instanceof HTMLElement)) return false;
  return cible.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName);
}

/**
 * ⭐ LE FIL, COUCHÉ — la barre de progression du site, sur une ligne : des
 * pointillés pour ce qui reste, un trait plein pour ce qui est fait, une tête
 * lumineuse là où on en est, l'arrivée au bout. Décoratif (`aria-hidden`) : le
 * pourcentage est toujours écrit à côté. Dessin : `index.css`, `.fil-h`.
 */
function FilCouche({ pct, acheve }: { pct: number | null; acheve: boolean }) {
  const etat = acheve ? "atteint" : (pct ?? 0) > 0 ? "cours" : "vide";
  const part = acheve ? 1 : Math.min(100, Math.max(0, pct ?? 0)) / 100;
  return (
    <span
      className="fil-h block min-w-0 flex-1"
      data-etat={etat}
      style={{ "--fil-e": part.toFixed(4) } as React.CSSProperties}
      aria-hidden
    >
      <span className="fil-h-plein" />
      <span className="fil-h-depart" />
      {etat === "cours" && <span className="fil-h-tete" />}
      <span className="fil-h-fin" />
    </span>
  );
}

export default function GoalsView({ data, refresh }: Props) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  /** L'objectif dont le menu vient d'ouvrir un champ d'ajout — et lequel : une tâche, ou une étape. */
  const [ajoutPour, setAjoutPour] = useState<{ id: number; quoi: "tache" | "etape" } | null>(null);
  /** L'objectif regardé en carte mentale — un seul à la fois, plein écran. */
  const [enCarte, setEnCarte] = useState<Goal | null>(null);
  /**
   * L'objectif dont la PAGE est ouverte. `null` : la liste — sur le bureau
   * comme sur iPhone depuis le 2026-10-08 (avant, le bureau présélectionnait le
   * premier objectif dans un panneau à droite).
   */
  const [choisiId, setChoisiId] = useState<number | null>(null);
  /** Où en était la liste quand on l'a quittée : on y revient au même endroit. */
  // `clavier` : la page a été fermée au clavier (Échap, Entrée sur « retour »).
  // Seul ce cas rend le focus à la ligne : au clic, l'anneau de focus
  // s'allumerait autour d'une ligne qu'on n'a pas visée (signalé le 2026-10-20).
  const retour = useRef<{ defilement: number; objectif: number | null; clavier: boolean }>({ defilement: 0, objectif: null, clavier: false });
  const listeRef = useRef<HTMLDivElement | null>(null);

  /**
   * ⭐ LA CARTE S'OUVRE EN SA PAGE (2026-10-20) — `lib/objectifs/transition.ts`.
   * Le temps du film, la liste ET la page sont montées : la page dans un voile
   * posé par-dessus (`absolute inset-0`), la liste dessous, qui s'écarte (à
   * l'ouverture) ou revient (au retour). Le film fini, l'une des deux part.
   * ⚠️ Le voile est TOUJOURS l'enveloppe de la page, film ou pas : seule sa
   * classe change. Sortir la page de son enveloppe à la fin du film la
   * remonterait (champ d'ajout fermé, défilement perdu, entrée rejouée).
   */
  const [film, setFilm] = useState<{ sens: Sens; id: number } | null>(null);
  /** La page arrivée par la carte n'a pas, en plus, son fondu d'entrée. */
  const [parLaCarte, setParLaCarte] = useState<number | null>(null);
  const racineRef = useRef<HTMLDivElement | null>(null);
  const voileRef = useRef<HTMLDivElement | null>(null);
  const fondRef = useRef<HTMLDivElement | null>(null);
  const enteteRef = useRef<HTMLElement | null>(null);

  const ouvrir = (id: number) => {
    if (film) return;
    // ⚠️ DÉJÀ OUVERTE : rien à rejouer (audit du 2026-10-20, objectifs-8).
    // « ⋯ › Ajouter une tâche » d'une page ouverte passait par ici : on
    // relisait le défilement d'une liste DÉMONTÉE (0), et le film d'ouverture
    // repartait de la carte — la page se rétractait, la liste revenait en haut,
    // et le retour ne savait plus où rendre le focus.
    if (choisiId === id) return;
    retour.current = { defilement: listeRef.current?.scrollTop ?? 0, objectif: id, clavier: false };
    if (!mouvementReduit()) {
      setParLaCarte(id);
      setFilm({ sens: "ouvre", id });
    }
    setChoisiId(id);
  };
  /** Revenir à la liste — le bouton, Échap : la page rentre dans sa carte. */
  const fermer = (clavier = false) => {
    if (film || choisiId == null) return;
    retour.current.clavier = clavier;
    if (!mouvementReduit()) setFilm({ sens: "ferme", id: choisiId });
    setChoisiId(null);
  };
  const fermerRef = useRef(fermer);
  fermerRef.current = fermer;

  useLayoutEffect(() => {
    if (!film) return;
    const racine = racineRef.current;
    const voile = voileRef.current;
    const fond = fondRef.current;
    const liste = listeRef.current;
    const carte = liste?.querySelector<HTMLElement>(`[data-objectif="${film.id}"]`);
    // Pas de carte (objectif effacé entre-temps, liste absente) : pas de film.
    if (!racine || !voile || !fond || !liste || !carte) {
      setFilm(null);
      return;
    }
    const voisins = [
      ...Array.from(liste.querySelectorAll<HTMLElement>("[data-objectif], h2")).filter((el) => el !== carte),
      ...(enteteRef.current ? [enteteRef.current] : []),
    ];
    const anims = jouerTransition({ sens: film.sens, racine, voile, fond, carte, voisins });
    let vivant = true;
    Promise.all(anims.map((a) => a.finished))
      .then(() => {
        if (!vivant) return;
        if (film.sens === "ferme") setParLaCarte(null);
        setFilm(null);
      })
      .catch(() => {});
    // ⚠️ Annuler au démontage seulement en apparence : ce nettoyage tourne dans
    // le MÊME rendu que la fin du film (`film` repasse à `null`), où la liste
    // ou le voile disparaissent ; ce qui reste revient à son état de repos,
    // qui est celui de la dernière image. Aucun saut à l'écran.
    return () => {
      vivant = false;
      for (const a of anims) a.cancel();
      for (const el of voile.querySelectorAll<HTMLElement>("[data-partage]")) el.style.transformOrigin = "";
    };
  }, [film]);

  /**
   * ⭐ Le repliement a une MÉMOIRE : seuls les choix explicites sont rangés,
   * sous `layout.goals.replis`. Le préfixe `layout.` est exclu de la
   * synchronisation (`sync/scope.ts`) : c'est de la géométrie d'écran, et les
   * clés sont des `id` LOCAUX, qui désigneraient autre chose sur un autre
   * appareil.
   */
  const [replis, setReplis] = useState<Replis>({});
  useEffect(() => {
    getSetting(CLE_REPLIS).then((v) => setReplis(lireReplis(v)));
  }, []);
  const onReplier = useCallback((cle: string, ouvert: boolean) => {
    setReplis((r) => {
      if (r[cle] === ouvert) return r;
      const suivant = { ...r, [cle]: ouvert };
      void setSetting(CLE_REPLIS, JSON.stringify(suivant));
      return suivant;
    });
  }, []);

  const { goals, tasks, completions } = data;
  const [important, setImportant] = useState(false);

  /**
   * Un objectif créé devient l'objectif montré.
   *
   * ⚠️ PAR SON `id`, RENDU PAR `GoalModal` (audit du 2026-10-20, objectifs-10 ;
   * A06a-18). La version d'avant retenait les objectifs d'avant et prenait « le
   * premier objectif RACINE inconnu » qui apparaissait ensuite. Créé sous un
   * parent, l'objectif n'était pas une racine : la mémoire restait armée, et la
   * prochaine racine venue d'ailleurs (import, restauration, synchro) prenait la
   * page et ouvrait son champ « Tâche ». Une étape créée ouvre désormais la page
   * de son objectif, dépliée jusqu'à elle (la demande d'ouverture le fait).
   */
  const [demande, setDemande] = useState<number | null>(null);
  const aMontrer = useRef<number | null>(null);
  const nouvelObjectif = useCallback(() => {
    aMontrer.current = null;
    setCreating(true);
  }, []);
  useEffect(() => {
    const id = aMontrer.current;
    if (id == null) return;
    const neuf = goals.find((g) => g.id === id);
    if (!neuf) return;
    aMontrer.current = null;
    if (neuf.parent_goal_id != null) {
      setDemande(neuf.id);
      return;
    }
    setChoisiId(neuf.id);
    // ⭐ 2026-10-12 — LA TÂCHE REÇOIT LE FOCUS PAR DÉFAUT. Un objectif créé nu
    // (ni tâche ni étape saisies dans la fenêtre) ouvre sa page sur le champ
    // « Tâche » : la première chose qu'on lui donne est une chose à faire.
    const nu = !goals.some((g) => g.parent_goal_id === neuf.id) && !tasks.some((x) => x.goal_id === neuf.id);
    if (nu) setAjoutPour({ id: neuf.id, quoi: "tache" });
  }, [goals, tasks]);

  // action palette "Nouvel objectif" → ouvre le formulaire
  // ⭐ Le geste peut avoir été DÉPOSÉ avant le montage de la vue (2026-10-20,
  // constat 22 : au premier appel de la session, page Objectifs sans formulaire).
  useEffect(() => {
    const surDemande = () => {
      consommerGeste("sb:new-goal");
      nouvelObjectif();
    };
    window.addEventListener("sb:new-goal", surDemande);
    if (consommerGeste("sb:new-goal")) nouvelObjectif();
    return () => window.removeEventListener("sb:new-goal", surDemande);
  }, [nouvelObjectif]);

  /**
   * ⭐ « Voir l'objectif » depuis ailleurs (une mention, « En faire un objectif »
   * d'une carte) montre SA fiche — la liste montrait tout, la fiche n'en montre
   * qu'un : sans ceci on arriverait devant le premier objectif venu.
   *
   * ⚠️ Au MONTAGE aussi : la vue est chargée en `lazy`, l'événement est parti
   * avant elle (`lib/naviguer.ts`). Et la demande ATTEND l'objectif : celui
   * qu'une carte vient de créer n'est pas encore dans `data` quand elle arrive.
   */
  useEffect(() => {
    const surDemande = (e: Event) => {
      const id = (e as CustomEvent<number>).detail;
      if (!id) return;
      setDemande(id);
      // ⚠️ La vue était déjà là : la demande déposée par `App.tsx` est servie,
      // on la RETIRE — sinon elle rouvrait cet objectif au montage suivant
      // (revenir de Tâches ramenait sur la page de la checklist importée
      // plutôt que sur la liste ; audit du 2026-10-20, objectifs-10). Le motif
      // de `NotesView`.
      consommerDemande("goal");
    };
    window.addEventListener(EVT_OUVRIR_OBJECTIF, surDemande);
    const enAttente = consommerDemande("goal");
    if (enAttente) setDemande(enAttente);
    return () => window.removeEventListener(EVT_OUVRIR_OBJECTIF, surDemande);
  }, []);
  useEffect(() => {
    if (demande == null) return;
    const cible = goals.find((g) => g.id === demande);
    if (!cible) return;
    // La chaîne jusqu'à la racine ; ses étapes intermédiaires se déplient pour
    // que la cible soit VUE, pas seulement présente.
    const chaine: Goal[] = [cible];
    const vus = new Set([cible.id]);
    for (let g = cible; g.parent_goal_id != null; ) {
      const parent = goals.find((x) => x.id === g.parent_goal_id);
      if (!parent || vus.has(parent.id)) break;
      vus.add(parent.id);
      chaine.push(parent);
      g = parent;
    }
    setChoisiId(chaine[chaine.length - 1].id);
    for (const g of chaine.slice(1, -1)) onReplier(`g${g.id}`, true);
    setDemande(null);
  }, [demande, goals, onReplier]);

  /**
   * Les arêtes, événements et titres cités par les objectifs — HORS d'`AppData`,
   * donc relus à chaque rafraîchissement : rattacher une note ne change aucune
   * table d'`AppData`, mais `refresh()` rend un nouvel objet `data`, et c'est ce
   * qui relance cette lecture (PIEGES § 10.3).
   */
  const [contexte, setContexte] = useState<ContexteObjectifs>(CONTEXTE_VIDE);
  useEffect(() => {
    let vivant = true;
    fetchContexteObjectifs().then((c) => vivant && setContexte(c));
    return () => {
      vivant = false;
    };
  }, [data]);

  // ⭐ UNE mesure par objectif, calculée une fois par rendu, par la règle
  // unique (`lib/objectifs/progression.ts`). Aucune ligne ne recalcule dans son coin.
  const sources = useMemo<SourcesProgression>(
    () => ({
      goals,
      tasks,
      completions,
      habits: data.habits,
      habitChecks: data.habitChecks,
      liens: contexte.liens,
      evenements: contexte.evenements,
      maintenant: `${todayStr()} ${new Date().toTimeString().slice(0, 5)}`,
    }),
    [goals, tasks, completions, data.habits, data.habitChecks, contexte],
  );
  const mesures = useMemo(() => {
    const m = new Map<number, Mesure>();
    for (const g of goals) m.set(g.id, mesurer(g, sources));
    return m;
  }, [goals, sources]);

  const roots = goals
    .filter((g) => g.parent_goal_id === null)
    .sort(
      (a, b) =>
        SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] ||
        (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"),
    );

  /** La prochaine action de chaque objectif racine — une lecture, jamais écrite. */
  // ⭐ Le point d'action (2026-10-20) : LU dans le contexte. Une étape en péril
  // allume le point de son objectif RACINE — c'est la ligne de la liste.
  const { liste: actions } = useActions();
  const racinesAAgir = useMemo(() => {
    const ids = new Set<number>();
    for (const a of actions) {
      if (a.kind !== "goal") continue;
      const g = data.goals.find((x) => x.id === a.id);
      if (g) ids.add(racineDe(g, data.goals).id);
    }
    return ids;
  }, [actions, data.goals]);

  const suites = useMemo(() => {
    const m = new Map<number, ProchaineAction | null>();
    const acheve = (id: number) => {
      const x = mesures.get(id);
      return !!x && estAcheve(x);
    };
    for (const g of goals) if (g.parent_goal_id === null) m.set(g.id, prochaineAction(g, sources, acheve));
    return m;
  }, [goals, sources, mesures]);

  // Regroupe les objectifs racines par catégorie (« Sans catégorie » en dernier).
  const NONE = "__none__";
  const groups = new Map<string, Goal[]>();
  for (const g of roots) {
    const key = g.category?.trim() || NONE;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(g);
  }
  const orderedCategories = Array.from(groups.keys()).sort((a, b) => {
    if (a === NONE) return 1;
    if (b === NONE) return -1;
    return a.localeCompare(b);
  });
  // Des intertitres seulement s'ils disent quelque chose : un seul groupe
  // « Sans catégorie » n'en a pas besoin.
  const avecIntertitres = orderedCategories.some((c) => c !== NONE);

  // Un objectif supprimé (ici ou par la synchronisation) referme sa page : on
  // retombe sur la liste, jamais sur le premier objectif venu.
  const choisi = roots.find((g) => g.id === choisiId) ?? null;
  /** La page montrée — celle qu'on quitte, le temps qu'elle rentre dans sa carte. */
  const enPage = choisi ?? (film?.sens === "ferme" ? (roots.find((g) => g.id === film.id) ?? null) : null);

  /**
   * ⭐ Échap ramène à la liste — la convention du Savoir (2026-08-26) : remonter
   * d'un niveau. Trois gardes : pas depuis un champ de saisie, pas quand une
   * fenêtre ou un menu est ouvert, et pas si un autre écouteur a déjà pris la
   * touche. ⚠️ Ce dernier point se lit APRÈS la distribution de l'événement
   * (`setTimeout`) : les menus posent leur écouteur sur `window` APRÈS le
   * nôtre, donc passent après nous — lu tout de suite, `defaultPrevented`
   * serait toujours faux et Échap fermerait le menu ET la page.
   */
  const occupe = creating || !!editing || !!enCarte || important;
  const occupeRef = useRef(occupe);
  occupeRef.current = occupe;
  const pageOuverte = choisi != null;
  useEffect(() => {
    if (!pageOuverte) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || dansUnChamp(e.target)) return;
      if (occupeRef.current || menuContextuelOuvert() || document.querySelector('[role="dialog"], [role="menu"]')) return;
      window.setTimeout(() => {
        if (!e.defaultPrevented) fermerRef.current(true);
      }, 0);
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [pageOuverte]);

  /**
   * ⭐ Corbeille (migration 027) : un objectif part AVEC ses étapes — et,
   * depuis le 2026-09-30, avec ses TÂCHES (demande
   * d'Antonin ; `corbeille/lots.ts`). La confirmation ne reste que pour le cas
   * lourd — il emporte des étapes ou des tâches — et elle dit combien. Sinon,
   * la corbeille et son « Annuler » suffisent.
   */
  const supprimerObjectif = (goal: Goal) => jeter("goal", goal.id, goal.title, refresh);

  /**
   * ⭐ UN OBJECTIF SANS RIEN SE COCHE « ATTEINT » (2026-10-11) — la même règle
   * que pour une étape vide (`progression.ts`) : il restait à « — » pour
   * toujours. Bascule optimiste, comme une tâche. Un geste = une fonction : la
   * case de la page et l'entrée du menu appellent `cocherObjectif`.
   */
  const coches = useCochesOptimistes();
  const cocherObjectif = (goal: Goal, faitEnBase: boolean) =>
    void coches.basculer(`g${goal.id}`, faitEnBase, async (fait) => {
      await cocherEtape(goal.id, fait);
      await refresh();
    });
  /** L'objectif est-il une unité à cocher, et où en est sa case À L'ÉCRAN ? */
  const uniteDe = (goal: Goal): { enBase: boolean; cochee: boolean } | null => {
    const o = mesures.get(goal.id)?.origine;
    return o?.type === "unite" ? { enBase: o.faite, cochee: coches.etat(`g${goal.id}`, o.faite) } : null;
  };

  /**
   * ⭐ LA TÂCHE D'ABORD (2026-10-12) : « Ajouter une tâche » précède « Ajouter
   * une étape » dans le menu, comme dans la rangée de la page. Les deux ouvrent
   * la page de l'objectif sur le champ voulu.
   */
  const ajouterA = (goal: Goal, quoi: "tache" | "etape") => {
    ouvrir(goal.id);
    setAjoutPour({ id: goal.id, quoi });
  };

  // ─── Le menu d'un objectif ────────────────────────────────────────────────
  // Clic droit sur une ligne de la liste, ou le « ⋯ » de la fiche — le MÊME
  // menu (règle 18). Les étapes ont le leur dans la feuille de route (`MenuEtape`).
  const menu = useMenuContextuel<Goal>();
  const ia = useIaPossible();
  // ⭐ Les objectifs en péril — la MÊME détection que le Calendrier, relue ici.
  // Depuis le 2026-10-12 la page d'un objectif écrit ce verdict sous son
  // échéance (`EcheanceObjectif`) : elle est donc calculée pour tout le monde,
  // plus seulement pour offrir « Pourquoi, et que faire ? » (#13) aux abonnés.
  const perils = useMemo(
    () =>
      // Les sources COMPLÈTES de la page (arêtes, événements, l'heure) : le
      // péril mesurait sans les événements rattachés (objectifs-1, 2026-10-20).
      objectifsEnPeril(goals, data.tasks, completions, todayStr(), sources),
    [goals, data.tasks, completions, sources],
  );
  const enPeril = useMemo(() => new Set(perils.map((p) => p.goal.id)), [perils]);
  const entreesObjectif = (goal: Goal): EntreePossible[] => {
    const bilan = bilanDeDepart(goals, data.tasks, goal.id);
    const unite = uniteDe(goal);
    return [
      unite && {
        id: "cocher",
        libelle: unite.cochee ? t("Marquer non atteint") : t("Marquer atteint"),
        icone: <IconCheck />,
        executer: () => cocherObjectif(goal, unite.enBase),
      },
      { id: "ajouter-tache", libelle: t("Ajouter une tâche"), icone: <IconPlus />, executer: () => ajouterA(goal, "tache") },
      { id: "ajouter-etape", libelle: t("Ajouter une étape"), icone: <IconPlus />, executer: () => ajouterA(goal, "etape") },
      ia && peutDecomposer(goal, goals) && {
        id: "ia-decomposer",
        libelle: t("Décomposer avec l'IA…"),
        icone: <IconeIa className="h-[1em] w-[1em]" />,
        executer: () => demanderIa({ action: "decomposer", goalId: goal.id }),
      },
      ia && {
        id: "ia-taches",
        libelle: t("Proposer des tâches avec l'IA…"),
        icone: <IconeIa className="h-[1em] w-[1em]" />,
        executer: () => demanderIa({ action: "taches", goalId: goal.id }),
      },
      ia && enPeril.has(goal.id) && {
        id: "ia-peril",
        libelle: t("Pourquoi, et que faire ?"),
        icone: <IconeIa className="h-[1em] w-[1em]" />,
        executer: () => demanderIa({ action: "peril", goalId: goal.id }),
      },
      { id: "modifier", libelle: t("Modifier…"), icone: <IconPencil />, executer: () => setEditing(goal) },
      {
        id: "supprimer",
        libelle: t("Supprimer"),
        icone: <IconTrash />,
        danger: true,
        confirmation:
          bilan.etapes + bilan.taches > 0
            ? { libelle: t("Confirmer la suppression"), detail: annonceDepart("objectif", bilan) }
            : undefined,
        executer: () => supprimerObjectif(goal),
      },
    ];
  };

  // ─── Une ligne de la liste ────────────────────────────────────────────────

  const ligneListe = (goal: Goal) => {
    const m = mesures.get(goal.id)!;
    const acheve = estAcheve(m);
    const suite = suites.get(goal.id) ?? null;
    const dl = deadlineInfo(goal.deadline);
    return (
      <li
        key={goal.id}
        onContextMenu={(e) => menu.ouvrirAuPoint(e, goal)}
        onKeyDown={(e) => void menu.ouvrirAuClavier(e, goal)}
      >
        {/* Une `.card` par objectif, cliquable en entier. Deux blocs qui se
            partagent la ligne (3 : 2) et passent l'un sous l'autre quand la
            place manque — la BASE flex décide du repli (PIEGES, 2026-07-26). */}
        <button
          type="button"
          data-objectif={goal.id}
          onClick={() => ouvrir(goal.id)}
          className="card flex w-full flex-wrap items-center gap-x-8 gap-y-2.5 px-4 py-3.5 text-left lg:px-5"
        >
          <span className="min-w-0 flex-[3_1_14rem]">
            <span
              data-partage="titre"
              className={`block truncate text-[15px] font-semibold ${acheve ? "text-text-dim line-through" : "text-text"}`}
            >
              {goal.title}
            </span>
          {/* UNE ligne, jamais deux : la prochaine action si elle existe (le
              carré est l'icône de la tâche, DESIGN.md « Les types de nœud »),
              sinon l'échéance de l'objectif.
              ⭐ Le RETARD de l'objectif s'écrit toujours, en tête (2026-10-11) :
              la prochaine action le cachait, et le Calendrier renvoyait à « un
              objectif en péril, dans le module Objectifs » que la liste ne
              désignait pas (crible du labo, constat 13). */}
          {acheve ? (
            <span className="mt-0.5 block text-xs text-success">{t("Atteint")}</span>
          ) : suite ? (
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-text-dim">
              {/* ⭐ L'échéance en tête, toujours (2026-10-12) : la date écrite,
                  ou le retard. La prochaine action ne la cache plus. */}
              {dl && (
                <>
                  {echeanceDeLigne(dl)}
                  <span className="shrink-0" aria-hidden>·</span>
                </>
              )}
              {/* L'espace avant les deux-points est française : l'anglais n'en met pas. */}
              <span className="sr-only">{t("Prochaine action")}{pick(" :", ":")}</span>
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] border border-current" aria-hidden />
              <span className="min-w-0 truncate">{suite.tache.label}</span>
              {suite.tache.due_date && (
                <>
                  <span className="shrink-0" aria-hidden>·</span>
                  <span className={`shrink-0 ${suite.enRetard ? "font-medium text-red" : ""}`}>
                    {auFilDeLaLigne(suite.tache.due_date, sources.maintenant.slice(0, 10))}
                  </span>
                </>
              )}
            </span>
          ) : dl ? (
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-text-dim">{echeanceDeLigne(dl)}</span>
          ) : null}
          </span>
          <span className="flex min-w-0 flex-[2_1_14rem] items-center gap-3">
            <FilCouche pct={m.pct} acheve={acheve} />
            <span data-partage="pct" className="w-11 shrink-0 text-right font-display text-base font-bold text-text">
              {m.pct == null ? "—" : `${m.pct}%`}
            </span>
            {/* Le point d'action, à droite (une étape en péril allume sa racine). */}
            {racinesAAgir.has(goal.id) && <PointAction libelle={t("Action requise")} />}
            <IconChevronRight className="h-4 w-4 shrink-0 text-text-dim" aria-hidden />
          </span>
        </button>
      </li>
    );
  };

  // ─── La page d'un objectif ────────────────────────────────────────────────

  const page = (goal: Goal) => {
    const m = mesures.get(goal.id)!;
    const aDesEtapes = goals.some((g) => g.parent_goal_id === goal.id);
    // ⭐ 2026-10-11 — un objectif MESURÉ qui n'a encore rien à mesurer est une
    // unité : 0 %, et une case « Atteint ». (Il écrivait « Pas encore de
    // feuille de route » à la place du chiffre, et restait à « — » ailleurs.)
    // La case, le fil et le chiffre suivent le clic ; la base suit.
    const unite = uniteDe(goal);
    const acheve = unite ? unite.cochee : estAcheve(m);
    const pct = unite ? (unite.cochee ? 100 : 0) : m.pct;
    const menuOuvert = menu.ouvert && menu.cible?.id === goal.id;

    return (
      // `key` : changer d'objectif repart d'une page neuve — sinon un champ
      // « ajouter une étape » ouvert sur l'un resterait ouvert sur l'autre.
      <div
        key={goal.id}
        className={`${parLaCarte === goal.id ? "" : "objectif-entree "}relative flex min-h-0 flex-1 flex-col`}
      >
        {/* ⚠️ Le retour et les actions vivent HORS de la zone qui défile : posés
            dans la page, ils partaient avec le contenu dès qu'on descendait
            dans la feuille de route — vu à l'écran à 390 pt le 2026-09-29. */}
        <div className="flex shrink-0 items-center gap-1 pb-3">
          <button
            type="button"
            // `detail` vaut 0 quand le bouton est activé au clavier.
            onClick={(e) => fermer(e.detail === 0)}
            className="cible-tactile-ligne -ml-2 flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm text-text-dim transition-colors hover:bg-surface-2 hover:text-text"
            data-tip={t("Revenir à la liste")}
            data-tip-kbd={t("Échap")}
            data-tip-side="bottom"
          >
            <IconChevronLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("Tous les objectifs")}</span>
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setEnCarte(goal)}
            className="cible-tactile-ligne flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-dim hover:bg-surface-2 hover:text-text"
            data-tip={t("Voir en carte mentale")}
            data-tip-sub={t("La même feuille de route, en carte mentale. Ce que tu y changes change ici aussi.")}
            data-tip-side="bottom"
          >
            <IconCarte className="h-3.5 w-3.5" />
            {t("Carte|carte mentale")}
          </button>
          <button
            type="button"
            onClick={(e) => menu.ouvrirSousLeBouton(e, goal)}
            aria-haspopup="menu"
            aria-expanded={menuOuvert}
            aria-label={t("Actions sur « {titre} »", { titre: goal.title })}
            data-tip={t("Actions")}
            data-tip-side="bottom"
            className="cible-tactile flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-dim hover:bg-surface-2 hover:text-text"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        </div>

        <section className="min-h-0 flex-1 overflow-y-auto pb-10" aria-label={goal.title}>
          {/* L'échéance a quitté cette ligne (2026-10-12) : elle s'y écrivait sans
              année, en petites capitales, et ne s'y changeait pas. Elle a sa
              propre ligne sous le titre (`EcheanceObjectif`). */}
          <p className="hud-label">
            {t(SCOPE_LABEL[goal.scope])}
            {goal.category?.trim() && <> · {goal.category.trim()}</>}
          </p>
          <h1 data-partage="titre" className="mt-1.5 font-display text-3xl font-extrabold text-text [overflow-wrap:anywhere]">
            {goal.title}
          </h1>
          {goal.description && <p className="mt-2 max-w-[68ch] text-sm text-text-dim">{goal.description}</p>}

          {/* ⭐ L'ÉCHÉANCE, EN TÊTE ET SUR PLACE (2026-10-12) — Antonin : « la
              deadline de l'objectif, c'est très important ». Elle se pose, se
              change et se retire ici, et dit ce qu'on sait du temps qui reste. */}
          <EcheanceObjectif
            goal={goal}
            fait={faitDEcheance(goal, perils, acheve, sources.maintenant.slice(0, 10))}
            refresh={refresh}
          />

          {/* ⭐ Le fil couché remplace la barre pleine : la même grammaire
              que le fil debout, juste dessous, le long des étapes. */}
          <div className="mt-5 flex items-center gap-4">
            <FilCouche pct={pct} acheve={acheve} />
            {/* « — » : un réglage cassé seulement (cible à zéro, source supprimée). */}
            <span data-partage="pct" className="shrink-0 font-display text-4xl font-extrabold text-text">
              {pct == null ? "—" : `${pct}%`}
            </span>
          </div>
          {unite ? (
            // Rien dedans : l'objectif se coche lui-même. « Suivre à la main »
            // reste, pour qui veut régler un pourcentage plutôt que cocher.
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-2">
                <CaseACocher
                  cochee={unite.cochee}
                  libelle={t("Atteint")}
                  tip={unite.cochee ? t("Marquer non atteint") : t("Marquer atteint")}
                  tipSub={t("Un objectif sans étape ni tâche se coche à la main. Donne-lui une tâche, et ce sont ses tâches qui comptent.")}
                  onBascule={() => cocherObjectif(goal, unite.enBase)}
                />
                {/* Le mot est une seconde cible du même geste ; la case porte
                    déjà le nom et l'état pour le lecteur d'écran. */}
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden
                  onClick={() => cocherObjectif(goal, unite.enBase)}
                  className={`cible-tactile-ligne ${unite.cochee ? "font-medium text-text" : "text-text-dim hover:text-text"}`}
                >
                  {t("Atteint")}
                </button>
              </span>
              {!unite.cochee && (
                <button
                  type="button"
                  onClick={async () => {
                    await majFeuilleDeRoute(goal.id, { manual_progress: 1 });
                    await refresh();
                  }}
                  className="cible-tactile-ligne text-xs font-medium text-accent hover:underline"
                  data-tip={t("Pour un objectif qui ne se découpe pas : tu règles toi-même son avancement.")}
                >
                  {t("Suivre à la main")}
                </button>
              )}
            </div>
          ) : (
            /* ⭐ UNE phrase d'origine. L'audit (D1, point 2) : « 45 % saisi à
               la main » sur la ligne, et juste dessous « la feuille de route
               n'est pas lue » dans un bandeau — deux vérités pour un chiffre.
               Le bandeau a quitté la feuille de route ; la phrase dit les deux. */
            <p className="mt-1 text-xs text-text-dim">
              {goal.manual_progress && aDesEtapes ? (
                <>
                  {t("Saisi à la main : la feuille de route ne compte pas.")}{" "}
                  <button
                    type="button"
                    onClick={async () => {
                      await majFeuilleDeRoute(goal.id, { manual_progress: 0 });
                      await refresh();
                    }}
                    className="cible-tactile-ligne font-medium text-accent hover:underline"
                  >
                    {t("La faire compter")}
                  </button>
                </>
              ) : (
                origineEnClair(m)
              )}
            </p>
          )}

          <FeuilleDeRoute
            racine={goal}
            data={data}
            contexte={contexte}
            sources={sources}
            mesures={mesures}
            replis={replis}
            onReplier={onReplier}
            ajoutOuvert={ajoutPour?.id === goal.id ? ajoutPour.quoi : null}
            onFermerAjout={() => setAjoutPour((a) => (a?.id === goal.id ? null : a))}
            onModifier={setEditing}
            refresh={refresh}
            fil
          />
        </section>
      </div>
    );
  };

  return (
    // Colonne unique `max-w-4xl`, comme la vue Tâches : une liste et une page
    // se lisent en une colonne, et la liste ne change pas de largeur en
    // devenant page.
    // `relative` : le voile de la page s'y pose, le temps du film.
    <div ref={racineRef} className="relative mx-auto flex h-full max-w-4xl flex-col p-4 lg:p-8">
      {/* La page prend l'écran : l'en-tête du module laisse la place au retour,
          comme la barre de navigation d'iOS — sur le bureau aussi désormais. */}
      {(!choisi || film) && (
        <header ref={enteteRef} className="view-head shrink-0">
          <h1 className="text-3xl text-text">{t("Objectifs")}</h1>
          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setImportant(true)}
            data-tip={t("Importer une checklist")}
            data-tip-sub={t("Demande-la à une IA, colle sa réponse : elle devient un objectif.")}
            className="pill border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-text"
          >
            {t("Importer")}
          </button>
          <button
            type="button"
            onClick={nouvelObjectif}
            data-tip={t("Nouvel objectif")}
            data-tip-sub={t("Un titre suffit. La feuille de route viendra quand tu en auras besoin.")}
            className="pill fill-primary px-4 py-2 text-sm font-semibold"
          >
            {t("+ Nouvel objectif")}
          </button>
          </div>
        </header>
      )}

      {choisi && !film ? null : roots.length === 0 ? (
        <section className="card mt-6 p-3">
          <p className="py-10 text-center text-sm text-text-dim">
            {t(
              "Aucun objectif. Commence par le long terme, puis découpe-le en étapes quand tu en as besoin. Range-les par catégorie (Formation, Santé…).",
            )}
          </p>
        </section>
      ) : (
        // ⚠️ `pt-0.5` : une carte se soulève de 2 px au survol, et une zone qui
        // défile rogne ce qui dépasse en haut (PIEGES § 21.10).
        <div
          ref={(el) => {
            // Au retour d'une page : la liste là où on l'avait laissée, et le
            // focus sur la ligne qu'on venait d'ouvrir (le clavier repart de là).
            // ⚠️ Une ref écrite en ligne est rappelée à CHAQUE rendu (`null`,
            // puis l'élément) : on ne retient donc jamais `null`, sinon chaque
            // rendu passerait pour un retour et renverrait la liste en haut.
            if (!el || listeRef.current === el) return;
            listeRef.current = el;
            el.scrollTop = retour.current.defilement;
            const ligne =
              retour.current.objectif != null
                ? el.querySelector<HTMLElement>(`[data-objectif="${retour.current.objectif}"]`)
                : null;
            if (retour.current.clavier) ligne?.focus({ preventScroll: true });
            retour.current = { defilement: 0, objectif: null, clavier: false };
          }}
          className="mt-6 min-h-0 flex-1 overflow-y-auto pb-6 pt-0.5"
        >
          <nav aria-label={t("Mes objectifs")}>
            {orderedCategories.map((cat) => (
              <div key={cat} className="mb-5">
                {avecIntertitres && (
                  <h2 className="hud-label px-1 pb-2">{cat === NONE ? t("Sans catégorie") : cat}</h2>
                )}
                <ul className="flex flex-col gap-2">{groups.get(cat)!.map(ligneListe)}</ul>
              </div>
            ))}
          </nav>
        </div>
      )}

      {/* La page, dans son voile : par-dessus la liste le temps du film, puis
          à sa place. Au retour, `choisi` vaut déjà `null` : le voile garde la
          page qu'on quitte jusqu'à ce qu'elle soit rentrée dans sa carte. */}
      {enPage && (
        // ⭐ 2026-10-20, Antonin : « même la carte ouverte, [le gris] doit
        // rester ». La page vit DANS la carte agrandie : le voile occupe toute
        // la colonne, sur le matériau de la carte (`--card-bg`, son filet, son
        // rayon), pendant le film comme après. La découpe du film finit
        // exactement sur ce rectangle : rien ne saute à la dernière image.
        // `sans-barres` : le temps du film, la barre de défilement de la page
        // n'apparaît pas (au retour, elle flottait sur la carte qui rétrécit).
        <div
          ref={voileRef}
          className={`absolute inset-0 z-10 flex flex-col p-4 lg:p-8${film ? " sans-barres" : ""}`}
          style={film?.sens === "ferme" ? { pointerEvents: "none" } : undefined}
        >
          <div
            ref={fondRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 border border-border"
            style={{ background: "var(--card-bg)", borderRadius: "var(--radius-card)" }}
          />
          <div className="relative flex min-h-0 flex-1 flex-col">{page(enPage)}</div>
        </div>
      )}

      {enCarte && (
        <CarteObjectif
          /* ⚠️ On relit l'objectif dans `data` plutôt que de garder la copie
             capturée au clic : rattacher une tâche depuis la carte refermerait
             sur un objet périmé, et le dessin ne bougerait pas. */
          racine={goals.find((g) => g.id === enCarte.id) ?? enCarte}
          data={data}
          contexte={contexte}
          onFermer={() => setEnCarte(null)}
        />
      )}

      {important && <ImporterChecklist onFermer={() => setImportant(false)} />}

      {(creating || editing) && (
        <GoalModal
          goal={editing}
          goals={goals}
          onClose={() => {
            aMontrer.current = null;
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async (creeId) => {
            // Posé AVANT le rafraîchissement : l'effet qui ouvre la page attend
            // l'objectif dans les données neuves.
            if (creating && creeId != null) aMontrer.current = creeId;
            await refresh();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {/* Un seul menu pour toute la vue, recalculé depuis les objectifs frais :
          un objectif effacé par la synchronisation le ferme au lieu d'y agir. */}
      <MenuContextuel
        etat={menu}
        libelle={t("Actions sur « {titre} »", { titre: menu.cible?.title ?? "" })}
        entrees={(() => {
          const frais = menu.cible && goals.find((g) => g.id === menu.cible!.id);
          return frais ? entreesObjectif(frais) : [];
        })()}
      />
    </div>
  );
}
