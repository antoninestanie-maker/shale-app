import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import TaskModal from "../components/TaskModal";
import { recurrenceLabel, todayStr } from "../lib/logic";
import {
  addTag,
  basculerTache,
  createTask,
  deleteTag,
  fetchContexteObjectifs,
  getSetting,
  renommerTache,
  setSetting,
} from "../lib/repo";
import { CONTEXTE_VIDE, type ContexteObjectifs } from "../lib/objectifs/contexte";
import { prochainesActions } from "../lib/objectifs/prochaineAction";
import { aRelancer, estRapide, etatDe } from "../lib/taches";
import { auFilDeLaLigne } from "../lib/calendrier/champDate";
import { CaseACocher, useCochesOptimistes } from "../components/CaseACocher";
import type { AppData, Goal, Priority, Tag, Task } from "../lib/types";
import {
  IconBolt,
  IconChevronDown,
  IconSablier,
  IconSearch,
  IconSliders,
  IconTarget,
  IconTrash,
  IconX,
} from "../components/icons";

import { pick, t, tp } from "../lib/i18n";
import PointAction from "../components/PointAction";
import { useActions } from "../lib/pointAction/contexte";
import { cleTache } from "../lib/pointAction/regle";
import ConfirmationEnLigne from "../components/ConfirmationEnLigne";
import BadgeExemple from "../components/onboarding/BadgeExemple";
import { estExemple } from "../lib/onboarding/exemples";
import { consommerDemande, ouvrirParId } from "../lib/naviguer";
import MenuContextuel, { BoutonMenu } from "../components/menu/MenuContextuel";
import { useMenuContextuel } from "../components/menu/useMenuContextuel";
import { entreesTache, gestesCommunsTache, type GestesTache } from "../components/menu/catalogue/tache";
import {
  ORDRE_SECTIONS,
  correspond,
  ranger,
  rangementDe,
  rangerParObjectif,
  type CleSection,
  type LigneVue,
  type Rangement,
} from "../lib/tachesVue";
import { planificationRapide } from "../lib/taches/saisieRapide";
import { useGesteFocus } from "../lib/seance/gesteFocus";
import BoutonDate from "../components/taches/BoutonDate";
import ChampRenommage from "../components/taches/ChampRenommage";
import SaisieRapide from "../components/taches/SaisieRapide";
// Le contour de la case dit la priorité — la règle de toute l'app, écrite une fois.
import { couleurPriorite, phrasePriorite } from "../lib/priorite";
import { CaptureIa } from "../components/ia/CaptureIa";
import { IconeIa } from "../components/ia/IconeIa";
import { useIa } from "../lib/ia/useIa";
import { PastillePriorite } from "../components/Priorite";
import { defilerVers, estEnVue } from "../lib/defilement";
import { afficherToast } from "../lib/toast";

interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

/**
 * ⭐ LA VUE TÂCHES — rangée par MOMENT (refonte du 2026-09-30).
 *
 * Antonin : « améliore le design de l'onglet Tâches, son intuitivité ». Avant :
 * une liste plate triée par priorité, sans une seule date à l'écran, trois
 * familles de filtres qui se recouvraient (statut, tag, « échéance »), et le
 * panneau de gestion des tags collé sous la liste. Maintenant :
 *   • une ligne d'AJOUT RAPIDE en haut (Entrée) — la fenêtre complète reste
 *     derrière « + Nouvelle tâche » ;
 *   • les tâches rangées par moment (`lib/tachesVue.ts`) : En retard,
 *     Aujourd'hui, À venir, Sans date, Routines, Faites (repliées) ;
 *   • UNE ligne de méta sous chaque tâche — l'échéance, le créneau, le rythme,
 *     l'objectif (cliquable), le report. La priorité, qui n'était qu'un point
 *     de 6 px, colore maintenant le contour de la case ;
 *   • les tags comme seul filtre, avec une recherche ; leur gestion derrière
 *     « Gérer », dépliée à la demande.
 *
 * ⚠️ Plus de filtre « échéance » (un jour précis) : les sections disent déjà
 * quand, et le Calendrier montre un jour donné. Plus de grille redimensionnable
 * non plus — une liste se lit en une colonne, comme la vue Objectifs refaite
 * la veille.
 *
 * ⭐ Depuis le 2026-10-11 :
 *   • un second RANGEMENT, « Par objectif » (`rangerParObjectif`) : une section
 *     par objectif racine, « Sans objectif » en dernier, les routines à part.
 *     Le choix est un réglage (`taches.rangement`), retenu et synchronisé ;
 *     « Par moment » reste le défaut. Les filtres et la recherche valent pour
 *     les deux ;
 *   • l'ajout rapide LIT une date dans la phrase et la montre en pastille
 *     (`SaisieRapide`) ; sans date, la tâche naît toujours sans date ici ;
 *   • la date d'une ligne est un bouton qui ouvre le calendrier sur place, et
 *     le « ⋯ » est visible au repos ;
 *   • « Focus 25 min » est dans le menu, comme sur Aujourd'hui.
 */

/** Les couleurs proposées pour un nouveau tag. ⚠️ Accordées aux tokens (DESIGN.md). */
const TAG_COLORS = [
  "var(--color-blue)",
  "var(--color-green)",
  "var(--color-yellow)",
  "var(--color-red)",
  "var(--color-violet)",
  "#fb8b4e",
  "#ef6ba8",
  "#3cc4de",
];

/** Combien de tâches faites on montre avant « Afficher les autres ». */
const FAITES_VISIBLES = 20;
/** Combien de temps une tâche qu'on vient de cocher reste là où on l'a cochée. */
const DELAI_DEPART_MS = 1200;
/** La clé des sections repliées — une commodité de CE poste, jamais synchronisée. */
const CLE_REPLIS = "shale.taches.replis";
/** Le réglage qui retient le rangement (synchronisé : c'est une préférence, pas une géométrie). */
const CLE_RANGEMENT = "taches.rangement";

/** Les libellés des sections. ⚠️ Une FONCTION : `t()` à l'affichage, jamais à l'import. */
function libelleSection(s: CleSection): string {
  switch (s) {
    case "retard":
      return t("En retard");
    case "aujourdhui":
      return t("Aujourd'hui");
    case "avenir":
      return t("À venir");
    case "sansDate":
      return t("Sans date");
    case "attente":
      return t("En attente");
    case "routines":
      return t("Routines");
    case "faites":
      return t("Faites");
    case "abandonnees":
      return t("Abandonnées");
  }
}

/** Ce que dit la section, pour qui passe sur son titre. */
function aideSection(s: CleSection): string {
  switch (s) {
    case "retard":
      return t("Datées d'avant aujourd'hui, pas encore faites.");
    case "aujourdhui":
      return t("Datées d'aujourd'hui, et les routines du jour.");
    case "avenir":
      return t("Datées de demain ou plus tard.");
    case "sansDate":
      return t("Ni date ni rythme : à faire quand tu peux.");
    case "routines":
      return t("Les tâches récurrentes qui ne tombent pas aujourd'hui.");
    case "attente":
      return t("Bloquées par quelqu'un ou par quelque chose. Elles reviennent le jour de leur relance.");
    case "faites":
      return t("Les ponctuelles cochées, et les routines cochées aujourd'hui.");
    case "abandonnees":
      return t("Écartées sans être supprimées : elles ne comptent plus nulle part.");
  }
}

/**
 * Les sections repliées, par leur clé : un moment (`retard`, `faites`…) ou,
 * rangé par objectif, `o:<id>`, `sansObjectif`, `routines`.
 */
function lireReplis(): Set<string> {
  try {
    const brut = localStorage.getItem(CLE_REPLIS);
    if (brut) return new Set(JSON.parse(brut) as string[]);
  } catch {
    /* stockage indisponible : les défauts */
  }
  return new Set<string>(["faites", "abandonnees"]);
}

/** Une section à l'écran, quel que soit le rangement. */
interface SectionVue {
  cle: string;
  titre: string;
  aide: string;
  /** « En retard » : le seul titre en rouge. */
  accent?: boolean;
  /** L'objectif de la section, rangé par objectif — son titre l'ouvre. */
  objectif?: Goal | null;
  /** Les tâches faites : vingt, puis « Afficher les autres ». */
  limiter?: boolean;
  lignes: { task: LigneVue; moment: CleSection; etape: Goal | null }[];
}

export default function TasksView({ data, refresh }: Props) {
  /** Le minuteur de l'app — pour « Focus 25 min » dans le menu d'une tâche. */
  const gesteFocus = useGesteFocus();
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  /** La tâche dont le libellé est en cours de renommage, EN PLACE. */
  const [renommeId, setRenommeId] = useState<number | null>(null);
  const [replis, setReplis] = useState<Set<string>>(lireReplis);
  const [toutesFaites, setToutesFaites] = useState(false);
  const [gererTags, setGererTags] = useState(false);
  /** La tâche qu'on vient d'ajouter : surlignée un instant, pour qu'on la voie arriver. */
  const [nouvelle, setNouvelle] = useState<number | null>(null);
  /** Celle dont l'arrivée reste à ANNONCER — une fois, pas à chaque rendu. */
  const aAnnoncer = useRef<number | null>(null);
  /** Les tâches qu'on vient de cocher ou de rouvrir restent un instant à leur place (clé de section). */
  const [garder, setGarder] = useState<ReadonlyMap<number, string>>(new Map());
  /** ⭐ Par moment (défaut) ou par objectif — un réglage, retenu et synchronisé. */
  const [rangement, setRangement] = useState<Rangement>("moment");
  useEffect(() => {
    getSetting(CLE_RANGEMENT)
      .then((v) => setRangement(rangementDe(v)))
      .catch(() => undefined);
  }, []);
  const choisirRangement = (r: Rangement) => {
    if (r === rangement) return;
    // Une tâche « gardée » l'était dans une section de l'autre rangement.
    setGarder(new Map());
    setRangement(r);
    void setSetting(CLE_RANGEMENT, r);
  };
  const [prioriteNouvelle, setPrioriteNouvelle] = useState<Priority>("medium");
  const menu = useMenuContextuel<LigneVue>();

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const today = todayStr();

  /**
   * ⭐ Le badge « Prochaine action » (2026-10-20) : la règle de la liste des
   * objectifs (`prochaineAction`), avec les mêmes sources — les arêtes et les
   * événements compris, sans quoi la vue Tâches et la vue Objectifs pourraient
   * désigner deux tâches différentes.
   */
  const [contexte, setContexte] = useState<ContexteObjectifs>(CONTEXTE_VIDE);
  useEffect(() => {
    let vivant = true;
    fetchContexteObjectifs()
      .then((c) => vivant && setContexte(c))
      .catch(() => undefined);
    return () => {
      vivant = false;
    };
  }, [data]);
  const suites = useMemo(
    () =>
      prochainesActions({
        goals: data.goals,
        tasks: data.tasks,
        completions: data.completions,
        habits: data.habits,
        habitChecks: data.habitChecks,
        liens: contexte.liens,
        evenements: contexte.evenements,
        maintenant: `${today} ${new Date().toTimeString().slice(0, 5)}`,
      }),
    [data.goals, data.tasks, data.completions, data.habits, data.habitChecks, contexte, today],
  );

  /**
   * Ouvrir la tâche qu'on demande d'ailleurs — une mention `@`, ou « Modifier… »
   * dans le menu d'une tâche du widget d'Aujourd'hui (`lib/naviguer.ts`).
   *
   * ⚠️ Les tâches sont lues par une RÉFÉRENCE : l'écouteur est posé une fois, et
   * une fermeture sur `data.tasks` garderait la liste du premier affichage —
   * une tâche créée depuis ne s'ouvrirait jamais (PIEGES § 6.5, transposé aux
   * fermetures).
   */
  const tachesRef = useRef(data.tasks);
  tachesRef.current = data.tasks;
  useEffect(() => {
    const ouvrir = (id: number) => {
      const tache = tachesRef.current.find((x) => x.id === id);
      if (tache) setEditing(tache);
    };
    const onOpen = (e: Event) => ouvrir((e as CustomEvent<number>).detail);
    window.addEventListener("sb:open-task", onOpen);
    const enAttente = consommerDemande("task");
    if (enAttente) ouvrir(enAttente);
    return () => window.removeEventListener("sb:open-task", onOpen);
  }, []);

  // L'IA de Shale Pro : la capture (#5, #6), ouverte par ⌘K ou le bouton.
  const ia = useIa();
  const [capture, setCapture] = useState(false);
  useEffect(() => {
    const onCapture = () => setCapture(true);
    window.addEventListener("sb:capture-ia", onCapture);
    return () => window.removeEventListener("sb:capture-ia", onCapture);
  }, []);

  // action palette "Nouvelle tâche" → ouvre le formulaire
  useEffect(() => {
    const onNew = () => setCreating(true);
    window.addEventListener("sb:new-task", onNew);
    return () => window.removeEventListener("sb:new-task", onNew);
  }, []);

  const { etat, basculer } = useCochesOptimistes();

  const objectifDe = (goalId: number | null) =>
    goalId == null ? null : (data.goals.find((g) => g.id === goalId) ?? null);
  const tagColor = (name: string | null) => data.tags.find((x) => x.name === name)?.color ?? "var(--color-blue)";

  // ─── Le rangement ────────────────────────────────────────────────────────

  const filtrees = useMemo(
    () =>
      data.tasks.filter(
        (x) =>
          (!tagFilter || x.tag === tagFilter) &&
          correspond(x, data.goals.find((g) => g.id === x.goal_id)?.title ?? null, recherche),
      ),
    [data.tasks, data.goals, tagFilter, recherche],
  );

  const parObjectif = rangement === "objectif";
  const sections = useMemo(
    () =>
      ranger(filtrees, data.completions, today, {
        coche: (task, faite) => etat(`t${task.id}:${today}`, faite),
        // `garder` porte des clés du rangement EN COURS : ici, des moments.
        garder: parObjectif ? undefined : (garder as ReadonlyMap<number, CleSection>),
      }),
    [filtrees, data.completions, today, etat, garder, parObjectif],
  );

  /**
   * ⭐ Ce que l'écran montre, section par section — dans l'un ou l'autre
   * rangement. Les deux sortent de `lib/tachesVue.ts` ; ici on ne fait que les
   * nommer.
   */
  const vues = useMemo<SectionVue[]>(() => {
    if (!parObjectif) {
      return ORDRE_SECTIONS.map((s) => ({
        cle: s,
        titre: libelleSection(s),
        aide: aideSection(s),
        accent: s === "retard",
        limiter: s === "faites" || s === "abandonnees",
        lignes: sections.get(s)!.map((task) => ({ task, moment: s, etape: null })),
      })).filter((v) => v.lignes.length > 0);
    }
    return rangerParObjectif(filtrees, data.completions, data.goals, today, {
      coche: (task, faite) => etat(`t${task.id}:${today}`, faite),
      garder,
    }).map((g) => ({
      cle: g.cle,
      titre:
        g.genre === "objectif"
          ? (g.racine?.title ?? "")
          : g.genre === "sansObjectif"
            ? t("Sans objectif")
            : libelleSection(g.genre),
      aide:
        g.genre === "objectif"
          ? t("Ses tâches à faire, celles de ses étapes comprises — les retards d'abord.")
          : g.genre === "sansObjectif"
            ? t("Les tâches à faire qui ne sont rattachées à aucun objectif.")
            : g.genre === "routines"
              ? t("Les tâches récurrentes — celles du jour d'abord.")
              : aideSection(g.genre),
      objectif: g.racine,
      limiter: g.genre === "faites" || g.genre === "abandonnees",
      lignes: g.lignes.map((l) => ({ task: l, moment: l.moment, etape: l.etape })),
    }));
    // `t()` suit la langue : elle change sans rechargement, et `data` avec elle.
  }, [parObjectif, sections, filtrees, data.completions, data.goals, today, etat, garder]);

  /** Toutes les lignes affichées, à plat — pour le menu, qui relit la ligne FRAÎCHE. */
  const lignes = useMemo(() => vues.flatMap((v) => v.lignes.map((l) => l.task)), [vues]);

  const ouvertes = (s: CleSection) => sections.get(s)!.filter((x) => !x.done).length;
  const nAujourdhui = ouvertes("aujourdhui");
  const nRetard = ouvertes("retard");
  const resume = [
    nAujourdhui > 0 && tp(nAujourdhui, "{n} tâche aujourd'hui", "{n} tâches aujourd'hui"),
    nRetard > 0 && tp(nRetard, "{n} en retard", "{n} en retard"),
  ].filter((x): x is string => !!x);

  // ─── Les gestes ──────────────────────────────────────────────────────────

  /**
   * Cocher. La tâche reste un instant dans la section du clic, barrée, puis
   * rejoint « Faites » (ou en revient) : une ligne qui s'enfuit sous le curseur
   * au moment du clic, on ne voit même pas qu'on l'a cochée.
   *
   * ⚠️ Décocher une PONCTUELLE efface toutes ses coches (`basculerTache`) : elle
   * s'affiche faite dès qu'un jour quelconque la dit faite.
   */
  const handleToggle = (task: LigneVue) => {
    const ici = vues.find((v) => v.lignes.some((x) => x.task.id === task.id))?.cle;
    if (ici) {
      setGarder((m) => new Map(m).set(task.id, ici));
      window.setTimeout(
        () =>
          setGarder((m) => {
            const n = new Map(m);
            n.delete(task.id);
            return n;
          }),
        DELAI_DEPART_MS,
      );
    }
    return basculer(`t${task.id}:${today}`, task.done, async (fait) => {
      await basculerTache(task, today, fait);
      await refresh();
    });
  };

  /**
   * ⭐ Les gestes du menu contextuel — et du bouton « ⋯ », qui en est le jumeau.
   * Chacun est la fonction du geste qui existait déjà (règle 18) : la case,
   * le clic sur la tâche, et pour le reste les gestes communs aux vues qui
   * montrent une tâche (`catalogue/tache.tsx`).
   */
  const gestes: GestesTache = {
    ...gestesCommunsTache(refresh),
    basculer: (task) => void handleToggle(task as LigneVue),
    renommer: (task) => setRenommeId(task.id),
    modifier: (task) => setEditing(task),
    // ⭐ Le même geste que le ▶ d'Aujourd'hui (règle 18). Toujours là : c'est
    // `regleFocus` qui dit s'il lance, reprend, ou est grisé avec sa raison.
    focus: gesteFocus,
  };

  const validerRenommage = async (task: Task, libelle: string) => {
    setRenommeId(null);
    if (libelle.trim() && libelle.trim() !== task.label) {
      await renommerTache(task.id, libelle);
      await refresh();
    }
  };

  /**
   * ⭐ L'AJOUT RAPIDE : une phrase, Entrée. La tâche prend le tag qu'on regarde,
   * et la date que la ligne a lue dans la phrase ou qu'on a choisie au
   * calendrier (`SaisieRapide`) ; sans date, elle naît SANS DATE (décision du
   * 2026-09-30). Le reste (rythme, objectif) se règle ensuite.
   */
  const ajouter = async (label: string, jour: string | null, heure: string | null) => {
    const id = await createTask({
      label,
      tag: tagFilter,
      priority: prioriteNouvelle,
      recurrence: "none",
      goal_id: null,
      // Jamais d'écriture directe de `due_date` (`lib/taches.ts`) ; une heure lue
      // dans la phrase donne un créneau d'une heure.
      ...planificationRapide(jour, heure),
    });
    // Chaque tâche repart « moyenne » : une priorité restée collée d'un ajout à
    // l'autre en ferait passer cinq en élevée sans qu'on l'ait voulu.
    setPrioriteNouvelle("medium");
    // Elle doit se VOIR arriver : la recherche s'efface, et la section où elle
    // tombe se déplie — quelle qu'elle soit, dans l'un ou l'autre rangement.
    setRecherche("");
    await refresh();
    aAnnoncer.current = id;
    setNouvelle(id);
  };

  /**
   * « Voir » : aller à la tâche, parce qu'on l'a DEMANDÉ, et la surligner.
   * ⚠️ Au MILIEU de l'écran, pas « au plus près » : au téléphone, le plus près
   * est le bord bas, SOUS la barre d'onglets — la ligne y arrivait à moitié
   * cachée (vu à 390 px le 2026-10-12).
   */
  const voirTache = (id: number) => {
    defilerVers(document.querySelector(`[data-tache="${id}"]`), { block: "center" });
    setNouvelle(id);
  };

  /**
   * ⭐ APRÈS L'AJOUT : ON SAIT OÙ LA TÂCHE EST ALLÉE, ET L'ÉCRAN NE SAUTE PAS
   * (2026-10-12 ; labo, seconde passe, rang 7 — Antonin : « Corrige aussi le
   * souci d'une tâche sans date »).
   *
   * Avant, l'écran DÉFILAIT jusqu'à la tâche : au téléphone, taper une tâche
   * sans date faisait partir la vue tout en bas, vers « Sans date », et le champ
   * où l'on écrivait sortait de l'écran. Maintenant :
   *   • la section où elle tombe se déplie (sans réécrire le choix retenu sur ce
   *     poste), et sa ligne est surlignée un instant ;
   *   • si la ligne est SOUS LES YEUX, c'est tout — on la voit arriver ;
   *   • sinon un message dit où elle est (« Ajoutée dans « Sans date » »), avec
   *     « Voir » pour y aller. Le défilement est un geste, plus une conséquence.
   */
  useEffect(() => {
    if (nouvelle == null) return;
    const vue = vues.find((v) => v.lignes.some((x) => x.task.id === nouvelle));
    if (vue && replis.has(vue.cle)) {
      setReplis((r) => new Set([...r].filter((x) => x !== vue.cle)));
      return; // repliée, sa ligne n'existe pas encore à l'écran : au rendu suivant
    }
    if (aAnnoncer.current !== nouvelle) return; // déjà annoncée (ou « Voir »)
    const ligne = document.querySelector(`[data-tache="${nouvelle}"]`);
    if (!vue || !ligne) return; // pas encore rendue : au rendu suivant
    aAnnoncer.current = null;
    if (estEnVue(ligne)) return;
    const id = nouvelle;
    afficherToast({
      msg: t("Ajoutée dans « {section} »", { section: vue.titre }),
      actionLabel: t("Voir"),
      onAction: () => voirTache(id),
    });
  }, [nouvelle, vues, replis]);

  useEffect(() => {
    if (nouvelle == null) return;
    const minuterie = window.setTimeout(() => setNouvelle(null), 1600);
    return () => window.clearTimeout(minuterie);
  }, [nouvelle]);

  const replier = (s: string) =>
    setReplis((r) => {
      const n = new Set(r);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      try {
        localStorage.setItem(CLE_REPLIS, JSON.stringify([...n]));
      } catch {
        /* stockage indisponible : le repli vaut pour la séance */
      }
      return n;
    });

  // ─── Les tags ────────────────────────────────────────────────────────────

  const handleAddTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    await addTag(name, newTagColor);
    setNewTagName("");
    await refresh();
  };

  /**
   * Supprimer un tag le RETIRE de toutes ses tâches, sans retour : rien ne
   * garde la trace de qui le portait. Utilisé, il demande donc confirmation, et
   * dit combien de tâches le perdent (2026-09-24). Inutilisé, il part d'un clic.
   */
  const [tagASupprimer, setTagASupprimer] = useState<Tag | null>(null);
  /** Le clic droit sur un tag : filtrer, ou supprimer (avec la même question que la croix). */
  const menuTag = useMenuContextuel<Tag>();
  const tachesDuTag = (tag: Tag) => data.tasks.filter((x) => x.tag === tag.name).length;
  const effacerTag = async (tag: Tag) => {
    setTagASupprimer(null);
    await deleteTag(tag);
    if (tagFilter === tag.name) setTagFilter(null);
    await refresh();
  };
  const handleDeleteTag = async (tag: Tag) => {
    if (tachesDuTag(tag) > 0) {
      // La question vit dans le panneau de gestion : on l'ouvre pour la poser.
      setGererTags(true);
      setTagASupprimer(tag);
      return;
    }
    await effacerTag(tag);
  };

  // ─── Une ligne ───────────────────────────────────────────────────────────

  /**
   * Les morceaux de la ligne de méta. `classe` habille le morceau ET son
   * séparateur : un morceau masqué sur bureau (le tag) ne doit pas laisser son
   * « · » traîner en fin de ligne — vu à l'écran le 2026-09-30.
   */
  const { requise } = useActions();
  const meta = (
    task: LigneVue,
    section: CleSection,
    /** L'étape à nommer — seulement dans la section d'un objectif (`undefined` ailleurs). */
    etape: Goal | null | undefined,
  ): { noeud: ReactNode; classe?: string }[] => {
    const out: { noeud: ReactNode; classe?: string }[] = [];
    const push = (noeud: ReactNode, classe?: string) => out.push({ noeud, classe });
    // ⭐ La date est un BOUTON : il ouvre le calendrier sur place (`BoutonDate`).
    // Rangée par moment, « Aujourd'hui » ne répète pas sa date ; rangée par
    // objectif, la section ne dit plus quand — la ligne le dit donc toujours.
    // ⭐ Le point d'action (2026-10-20) : collé au mot qui dit pourquoi — « reportée
    // 2 fois » s'il est là, sinon la date (« hier »). Jamais seul derrière un « · ».
    const aAgir = !task.done && requise(cleTache(task.id));
    const point = <PointAction className="ml-1.5" libelle={t("Action requise")} />;
    const pointSurLeReport = aAgir && task.postponed_count > 0;
    if (task.due_date && (section === "retard" || section === "avenir" || (parObjectif && section === "aujourdhui"))) {
      push(
        <span key="date" className="inline-flex items-center">
        <BoutonDate
          key="date"
          task={task}
          aujourdHui={today}
          dater={gestes.dater}
          className={section === "retard" ? "font-medium text-red" : undefined}
        />
        {aAgir && !pointSurLeReport && point}
        </span>,
      );
    }
    if (task.start_at && task.due_date) {
      push(
        <span key="heure" className="tabular-nums">
          {task.end_at ? `${task.start_at}–${task.end_at}` : task.start_at}
        </span>,
      );
    }
    const rythme = recurrenceLabel(task.recurrence);
    if (rythme) {
      push(
        <span key="rythme">
          <span aria-hidden>↻ </span>
          {/* En français, le rythme se lit en minuscule au fil de la ligne. */}
          {pick(rythme.toLocaleLowerCase("fr"), rythme)}
        </span>,
      );
    }
    // Rangée par objectif, le titre de la section EST l'objectif : la ligne ne
    // nomme que l'étape qui porte la tâche, s'il y en a une.
    const objectif = etape !== undefined ? etape : objectifDe(task.goal_id);
    if (objectif) {
      push(
        <button
          key="objectif"
          type="button"
          onClick={() => ouvrirParId("goal", objectif.id)}
          data-tip={t("Ouvrir l'objectif")}
          data-tip-sub={objectif.title}
          className="cible-tactile-ligne inline-flex min-w-0 max-w-full items-center gap-1 rounded transition-colors hover:text-text"
        >
          <IconTarget className="h-3 w-3 shrink-0" />
          <span className="truncate">{objectif.title}</span>
        </button>,
      );
    }
    // ⭐ L'ÉTAT et les badges DÉDUITS (2026-10-20). L'état se lit en premier :
    // c'est lui qui dit pourquoi la tâche est là.
    const etatTache = etatDe(task);
    if (!task.done && etatTache === "doing") {
      push(
        <span key="etat" className="inline-flex items-center gap-1 font-medium text-accent">
          <IconBolt className="h-3 w-3 shrink-0" />
          {t("En cours")}
        </span>,
      );
    }
    if (!task.done && etatTache === "waiting") {
      const relancer = aRelancer(task, today);
      push(
        <span
          key="etat"
          className={`inline-flex min-w-0 items-center gap-1 ${relancer ? "font-medium text-yellow" : ""}`}
          data-tip={task.waiting_for ? t("En attente de") : undefined}
          data-tip-sub={task.waiting_for ?? undefined}
        >
          <IconSablier className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {relancer
              ? t("À relancer")
              : task.waiting_for
                ? t("attend : {quoi}", { quoi: task.waiting_for })
                : t("En attente")}
          </span>
        </span>,
      );
      if (task.follow_up_on && !relancer) {
        push(
          <span key="relance">
            {t("relance {quand}", { quand: auFilDeLaLigne(task.follow_up_on, today) })}
          </span>,
        );
      }
    }
    if (!task.done && suites.has(task.id)) {
      push(
        <span
          key="suite"
          className="font-medium text-text"
          data-tip={t("La prochaine action de l'objectif")}
          data-tip-sub={suites.get(task.id)!.title}
        >
          {t("Prochaine action")}
        </span>,
      );
    }
    if (!task.done && estRapide(task)) {
      push(<span key="rapide">{t("Rapide")}</span>);
    }
    if (task.postponed_count > 0 && !task.done && etatTache !== "dropped") {
      push(
        <span key="report" className="inline-flex items-center text-yellow">
          {tp(task.postponed_count, "reportée une fois", "reportée {n} fois")}
          {pointSurLeReport && point}
        </span>,
      );
    }
    if (task.tag) {
      // Au doigt, le tag passe dans la méta : la pastille de droite mangerait le libellé.
      push(
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tagColor(task.tag) }} aria-hidden />
          {task.tag}
        </span>,
        "sm:hidden",
      );
    }
    return out;
  };

  const ligne = (task: LigneVue, section: CleSection, etape: Goal | null | undefined) => {
    const infos = meta(task, section, etape);
    return (
      /* ⚠️ Clic droit et touches de LIGNE sur le <li> : ils marchent que le
         focus soit sur la case, sur le libellé ou sur « ⋯ ». F2 renomme
         (c'est ce qu'annonce le menu), Maj+F10 / touche Menu ouvre le menu —
         macOS ne le fait pas tout seul (PIEGES § 19.2). */
      <li
        key={task.id}
        data-tache={task.id}
        className={`group/ligne flex items-start gap-3 rounded-[10px] px-3 py-2 transition-colors duration-500 hover:bg-surface-2 ${
          nouvelle === task.id ? "bg-accent/10" : ""
        }`}
        onContextMenu={(e) => menu.ouvrirAuPoint(e, task)}
        onKeyDown={(e) => {
          if (renommeId === task.id) return; // le champ gère ses touches
          if (menu.ouvrirAuClavier(e, task)) return;
          if (e.key !== "F2" || e.defaultPrevented) return;
          e.preventDefault();
          setRenommeId(task.id);
        }}
      >
        <span className="pt-px">
          <CaseACocher
            cochee={task.done}
            onBascule={() => void handleToggle(task)}
            libelle={task.label}
            anneau={couleurPriorite(task.priority)}
            tip={task.done ? t("Marquer à faire") : t("Marquer faite")}
            tipSub={phrasePriorite(task.priority)}
          />
        </span>

        <div className="min-w-0 flex-1">
          {renommeId === task.id ? (
            /* ⭐ RENOMMER EN PLACE, jamais dans une fenêtre (`ChampRenommage`). */
            <ChampRenommage
              valeur={task.label}
              onValider={(libelle) => void validerRenommage(task, libelle)}
              onAnnuler={() => setRenommeId(null)}
            />
          ) : (
            /* ⭐ Toucher la tâche l'OUVRE — sa date, son rythme, son objectif
               se règlent là. Avant, le libellé ne répondait à rien : il
               fallait trouver le crayon, qui n'apparaissait qu'au survol. */
            // ⚠️ Deux étages : le BOUTON porte la zone de toucher (44 pt au
            // doigt, reprise en marge négative pour ne pas écarter la ligne),
            // l'enfant porte le texte coupé à deux lignes. Un seul élément ne
            // peut pas faire les deux : `clamp-2` avec une hauteur minimale
            // laisserait le titre collé en haut de sa zone.
            <button
              type="button"
              onClick={() => setEditing(task)}
              title={task.label}
              className="cible-tactile-ligne flex w-full items-center text-left [@media(pointer:coarse)]:-my-2.5"
            >
              <span
                className={`truncate-souris clamp-2 block w-full text-sm leading-snug ${
                  task.done ? "text-text-dim line-through" : "text-text"
                }`}
              >
                {task.label}
              </span>
            </button>
          )}
          {(infos.length > 0 || estExemple(task)) && (
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-text-dim sm:gap-x-1.5">
              {/* Les « · » au bureau seulement : au doigt, la ligne se replie, et
                  un point en tête de ligne ne sépare plus rien (vu à 390 pt). */}
              {infos.map((x, i) => (
                <span key={i} className={`inline-flex min-w-0 max-w-full items-center gap-1.5 ${x.classe ?? ""}`}>
                  {i > 0 && (
                    <span aria-hidden className="hidden sm:inline">
                      ·
                    </span>
                  )}
                  {x.noeud}
                </span>
              ))}
              {estExemple(task) && <BadgeExemple />}
            </div>
          )}
        </div>

        {task.tag && (
          <span
            className="pill mt-0.5 hidden max-w-[28%] shrink-0 truncate px-2 py-0.5 text-[11px] font-medium sm:inline-block"
            style={{
              // color-mix : marche aussi quand la couleur est un token
              // `var(--color-x)` (l'ancien `+ "22"` produisait une valeur
              // invalide → fond transparent).
              backgroundColor: `color-mix(in srgb, ${tagColor(task.tag)} 16%, transparent)`,
              color: tagColor(task.tag),
            }}
            title={task.tag}
          >
            {task.tag}
          </span>
        )}

        <BoutonMenu
          visible
          onOuvrir={(e) => menu.ouvrirSousLeBouton(e, task)}
          ouvert={menu.ouvert && menu.cible?.id === task.id}
          libelle={t("Actions sur « {titre} »", { titre: task.label })}
        />
      </li>
    );
  };

  // ─── Une section ─────────────────────────────────────────────────────────

  const section = (v: SectionVue) => {
    const rangees = v.lignes;
    if (rangees.length === 0) return null;
    const s = v.cle;
    const replie = replis.has(s);
    const visibles = v.limiter && !toutesFaites ? rangees.slice(0, FAITES_VISIBLES) : rangees;
    const idTitre = `taches-${s}`;
    return (
      <section key={s} aria-labelledby={idTitre}>
        <h2 id={idTitre} className="flex items-center">
          <button
            type="button"
            onClick={() => replier(s)}
            aria-expanded={!replie}
            data-tip={v.titre}
            data-tip-sub={v.aide}
            className="cible-tactile-ligne flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 pb-1 pt-3 text-left"
          >
            {v.objectif && <IconTarget className="h-3.5 w-3.5 shrink-0 text-text-dim" />}
            <span className={`hud-label min-w-0 truncate ${v.accent ? "text-red" : ""}`}>{v.titre}</span>
            <span className="text-xs tabular-nums text-text-dim">{rangees.length}</span>
            <IconChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-text-dim transition-transform duration-200 ${replie ? "-rotate-90" : ""}`}
            />
          </button>
          {v.objectif && (
            <button
              type="button"
              onClick={() => ouvrirParId("goal", v.objectif!.id)}
              className="cible-tactile-ligne mr-2 mt-2 shrink-0 rounded-md px-2 text-xs font-medium text-text-dim transition-colors hover:text-text"
            >
              {t("Ouvrir l'objectif")}
            </button>
          )}
        </h2>
        {!replie && (
          <ul className="flex flex-col">
            {visibles.map((x) => ligne(x.task, x.moment, v.objectif ? x.etape : undefined))}
            {visibles.length < rangees.length && (
              <li className="px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => setToutesFaites(true)}
                  className="cible-tactile-ligne text-xs font-medium text-text-dim hover:text-text"
                >
                  {tp(rangees.length - visibles.length, "Afficher la dernière", "Afficher les {n} autres")}
                </button>
              </li>
            )}
          </ul>
        )}
      </section>
    );
  };

  const filtresActifs = !!tagFilter || !!recherche.trim();

  const chip = (active: boolean) =>
    `pill cible-tactile-ligne shrink-0 border px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "border-text/30 bg-surface-2 text-text" : "border-border text-text-dim hover:text-text"
    }`;

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-8">
      <header className="view-head">
        <div className="min-w-0">
          <h1 className="text-3xl text-text">{t("Tâches")}</h1>
          <p className="mt-1 text-sm text-text-dim">
            {resume.length > 0 ? resume.join(" · ") : t("Rien de prévu aujourd'hui.")}
          </p>
        </div>
        {/* Les deux boutons ensemble, à droite : un enfant de plus dans l'en-tête
            (`justify-between`) le poserait au milieu. */}
        <div className="flex shrink-0 items-center gap-2">
        {ia.visible && ia.aLeDroit && (
          <button
            type="button"
            onClick={() => setCapture(true)}
            data-tip={t("Capturer avec l'IA")}
            data-tip-sub={t("Un e-mail, un PDF, une photo de reçu ou du vrac : l'IA propose des tâches, rendez-vous et achats à valider.")}
            className="pill flex shrink-0 items-center gap-2 border border-border bg-surface-2 px-4 py-2 text-sm text-text hover:border-accent/50"
          >
            <IconeIa className="h-4 w-4" />
            {t("Capturer")}
          </button>
        )}
        <button
          type="button"
          onClick={() => setCreating(true)}
          data-tip={t("Nouvelle tâche")}
          data-tip-sub={t("Libellé, tag, priorité, récurrence et objectif lié.")}
          aria-label={t("Nouvelle tâche")}
          className="pill fill-primary shrink-0 px-4 py-2 text-sm font-semibold telephone:grid telephone:size-11 telephone:place-items-center telephone:p-0 telephone:text-xl telephone:leading-none"
        >
          {/* ⭐ 2026-10-19, audit « alléger » : au téléphone, un « + » rond à
              droite du titre, à la place d'un bouton large qui prenait une
              rangée à lui seul au-dessus de l'ajout rapide. */}
          <span className="telephone:hidden">{t("+ Nouvelle tâche")}</span>
          <span className="hidden telephone:inline" aria-hidden>+</span>
        </button>
        </div>
      </header>

      {/* ⭐ L'ajout rapide : une phrase, Entrée. La date qu'elle contient est lue
          et montrée en pastille avant validation (`SaisieRapide`). */}
      <SaisieRapide
        className="mt-6"
        plus
        placeholder={t("Ajouter une tâche…")}
        aria={t("Ajouter une tâche")}
        onAjouter={ajouter}
      >
        {tagFilter && (
          <span
            className="pill shrink-0 px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: `color-mix(in srgb, ${tagColor(tagFilter)} 16%, transparent)`, color: tagColor(tagFilter) }}
            data-tip={t("Elle prendra ce tag")}
            data-tip-sub={t("C'est le tag que tu regardes. Retire le filtre pour ajouter sans tag.")}
          >
            {tagFilter}
          </span>
        )}
        <PastillePriorite valeur={prioriteNouvelle} onChange={setPrioriteNouvelle} />
      </SaisieRapide>

      {/* Les filtres : les tags, et une recherche. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Les tags prennent toute la première ligne : avec le rangement à côté,
            « Gérer » était rogné par le défilement (vu à 1440 px, 2026-10-12). */}
        <div className="-mx-1 flex min-w-0 basis-full items-center gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
          <button type="button" onClick={() => setTagFilter(null)} className={chip(tagFilter === null)}>
            {t("Toutes")}
          </button>
          {data.tags.map((tag) => {
            const actif = tagFilter === tag.name;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => setTagFilter(actif ? null : tag.name)}
                onContextMenu={(e) => menuTag.ouvrirAuPoint(e, tag)}
                data-tip={tag.name}
                data-tip-sub={actif ? t("Retirer ce filtre.") : t("N’afficher que les tâches de ce tag.")}
                className="pill cible-tactile-ligne inline-flex shrink-0 items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors"
                style={
                  actif
                    ? {
                        borderColor: tag.color,
                        backgroundColor: `color-mix(in srgb, ${tag.color} 16%, transparent)`,
                        color: tag.color,
                      }
                    : { borderColor: "var(--color-border)", color: "var(--color-text-dim)" }
                }
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} aria-hidden />
                {tag.name}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setGererTags((v) => !v)}
            aria-expanded={gererTags}
            data-tip={t("Gérer les tags")}
            data-tip-sub={t("Créer un tag, choisir sa couleur, en supprimer un.")}
            className={`${chip(gererTags)} inline-flex items-center gap-1.5`}
          >
            <IconSliders className="h-3.5 w-3.5" />
            {t("Gérer")}
          </button>
        </div>

        {/* ⭐ Le rangement : par moment (défaut) ou par objectif — retenu. */}
        <div className="flex w-full shrink-0 items-center gap-1.5 sm:w-auto telephone:w-auto" role="radiogroup" aria-label={t("Rangement des tâches")}>
          {(["moment", "objectif"] as const).map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={rangement === r}
              onClick={() => choisirRangement(r)}
              data-tip={r === "moment" ? t("Ranger par moment") : t("Ranger par objectif")}
              data-tip-sub={
                r === "moment"
                  ? t("En retard, aujourd'hui, à venir, sans date.")
                  : t("Une section par objectif, ses étapes comprises ; « Sans objectif » en dernier.")
              }
              className={chip(rangement === r)}
            >
              {r === "moment" ? t("Par moment") : t("Par objectif")}
            </button>
          ))}
        </div>

        {/* Au téléphone, la recherche partage la rangée du rangement (une
            rangée de commandes de moins avant la première tâche). */}
        <label className="flex w-full items-center gap-2 rounded-[10px] border border-border bg-surface-2 px-2.5 py-1.5 transition-colors focus-within:border-accent sm:ml-auto sm:w-56 telephone:w-auto telephone:min-w-0 telephone:flex-1">
          <IconSearch className="h-3.5 w-3.5 shrink-0 text-text-dim" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && recherche) {
                e.preventDefault();
                e.stopPropagation();
                setRecherche("");
              }
            }}
            placeholder={t("Rechercher")}
            aria-label={t("Rechercher une tâche")}
            className="min-w-0 flex-1 bg-transparent text-xs text-text placeholder:text-text-dim focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {recherche && (
            <button
              type="button"
              onClick={() => setRecherche("")}
              aria-label={t("Effacer la recherche")}
              className="cible-tactile shrink-0 text-text-dim hover:text-text"
            >
              <IconX className="h-3 w-3" />
            </button>
          )}
        </label>
      </div>

      {/* La gestion des tags — dépliée à la demande, plus collée sous la liste. */}
      {gererTags && (
        <section className="card mt-3 p-4" aria-label={t("Gérer les tags")}>
          <div className="flex flex-wrap items-center gap-2">
            {data.tags.length === 0 && <span className="text-xs text-text-dim">{t("Aucun tag pour l'instant.")}</span>}
            {data.tags.map((tag) => (
              <span
                key={tag.id}
                onContextMenu={(e) => menuTag.ouvrirAuPoint(e, tag)}
                className="pill flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: `color-mix(in srgb, ${tag.color} 16%, transparent)`, color: tag.color }}
              >
                {tag.name}
                <button
                  type="button"
                  onClick={() => handleDeleteTag(tag)}
                  className="cible-tactile opacity-60 hover:opacity-100"
                  aria-label={t("Supprimer le tag {name}", { name: tag.name })}
                  data-tip={t("Supprimer le tag « {name} »", { name: tag.name })}
                  data-tip-sub={t("Les tâches concernées sont conservées, simplement sans tag.")}
                >
                  <IconX className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          {tagASupprimer && (
            <ConfirmationEnLigne
              className="mt-3"
              question={tp(
                tachesDuTag(tagASupprimer),
                "Supprimer le tag « {name} » ? 1 tâche le perd — elle reste, sans tag. C'est définitif.",
                "Supprimer le tag « {name} » ? {n} tâches le perdent — elles restent, sans tag. C'est définitif.",
                { name: tagASupprimer.name },
              )}
              libelle={t("Supprimer")}
              onRenoncer={() => setTagASupprimer(null)}
              onConfirmer={() => effacerTag(tagASupprimer)}
            />
          )}

          <form
            className="mt-3 flex min-w-0 flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleAddTag();
            }}
          >
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder={t("Nouveau tag…")}
              aria-label={t("Nom du nouveau tag")}
              className="w-40 min-w-0 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-accent focus:outline-none"
            />
            <span className="flex flex-wrap gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTagColor(c)}
                  className={`cible-tactile h-5 w-5 rounded-full transition-transform ${newTagColor === c ? "scale-110 ring-2 ring-accent" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={t("Couleur {name}", { name: c })}
                  aria-pressed={newTagColor === c}
                  data-tip={t("Couleur du tag")}
                />
              ))}
            </span>
            <button
              type="submit"
              disabled={!newTagName.trim()}
              className="pill border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text disabled:opacity-40"
            >
              {t("Ajouter")}
            </button>
          </form>
        </section>
      )}

      {/* La liste, rangée par moment ou par objectif. */}
      <div className="card mt-4 p-2">
        {data.tasks.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-sm text-text">{t("Aucune tâche pour l'instant.")}</p>
            <p className="mt-1 text-xs text-text-dim">{t("Écris-en une juste au-dessus, puis Entrée.")}</p>
          </div>
        ) : lignes.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <p className="text-sm text-text-dim">{t("Aucune tâche ne correspond.")}</p>
            {filtresActifs && (
              <button
                type="button"
                onClick={() => {
                  setTagFilter(null);
                  setRecherche("");
                }}
                className="cible-tactile-ligne mt-2 text-xs font-medium text-accent hover:underline"
              >
                {t("Effacer les filtres")}
              </button>
            )}
          </div>
        ) : (
          vues.map(section)
        )}
      </div>

      {(creating || editing) && (
        <TaskModal
          task={editing}
          tags={data.tags}
          goals={data.goals}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            await refresh();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <MenuContextuel
        etat={menuTag}
        libelle={t("Actions sur le tag « {name} »", { name: menuTag.cible?.name ?? "" })}
        entrees={(() => {
          const tag = menuTag.cible && data.tags.find((x) => x.id === menuTag.cible!.id);
          if (!tag) return [];
          return [
            {
              id: "filtrer",
              libelle: tagFilter === tag.name ? t("Ne plus filtrer") : t("Filtrer les tâches"),
              icone: <IconSearch />,
              executer: () => setTagFilter(tagFilter === tag.name ? null : tag.name),
            },
            {
              id: "supprimer",
              // « … » seulement quand une question suivra : un tag inutilisé part d'un coup.
              libelle: tachesDuTag(tag) > 0 ? t("Supprimer…") : t("Supprimer"),
              icone: <IconTrash />,
              danger: true,
              executer: () => handleDeleteTag(tag),
            },
          ];
        })()}
      />

      {/* ⭐ UN SEUL menu pour toute la liste. Les entrées sont recalculées depuis
          les lignes FRAÎCHES : si la synchronisation retire la tâche pendant que
          le menu est ouvert, le tableau devient vide et le menu se ferme seul. */}
      <MenuContextuel
        etat={menu}
        libelle={t("Actions sur « {titre} »", { titre: menu.cible?.label ?? "" })}
        entrees={(() => {
          const fraiche = menu.cible && lignes.find((r) => r.id === menu.cible!.id);
          return fraiche ? entreesTache(fraiche, gestes, { faite: fraiche.done, objectifs: data.goals, ia: ia.visible && ia.aLeDroit }) : [];
        })()}
      />
      {capture && <CaptureIa data={data} refresh={refresh} onFermer={() => setCapture(false)} />}
    </div>
  );
}
