import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GoalModal from "../components/GoalModal";
import FeuilleDeRoute from "../components/objectifs/FeuilleDeRoute";
import CarteObjectif from "../components/objectifs/CarteObjectif";
import { IconCarte, IconPencil, IconPlus, IconTrash } from "../components/icons";
import { todayStr } from "../lib/logic";
import { lireReplis, origineEnClair, type Replis } from "../lib/objectifs/libelles";
import { estAcheve, mesurer, type Mesure, type SourcesProgression } from "../lib/objectifs/progression";
import { prochaineAction, type ProchaineAction } from "../lib/objectifs/prochaineAction";
import { CONTEXTE_VIDE, type ContexteObjectifs } from "../lib/objectifs/contexte";
import { fetchContexteObjectifs, getSetting, majFeuilleDeRoute, setSetting } from "../lib/repo";
import { bilanDeDepart } from "../lib/corbeille/lots";
import { annonceDepart, jeter } from "../components/corbeille/geste";
import MenuContextuel from "../components/menu/MenuContextuel";
import { useMenuContextuel } from "../components/menu/useMenuContextuel";
import { formaterChamp, libelleRelatif } from "../lib/calendrier/champDate";
import { consommerDemande } from "../lib/naviguer";
import { useIsPhone } from "../lib/platform";
import type { EntreePossible } from "../lib/menu/entrees";
import { useIaPossible } from "../lib/ia/useIa";
import { demanderIa } from "../lib/ia/demande";
import { peutDecomposer } from "../lib/ia/planifier";
import { objectifsEnPeril } from "../lib/calendrier/peril";
import { IconeIa } from "../components/ia/IconeIa";
import type { AppData, Goal } from "../lib/types";

import { formatDate, pick, t } from "../lib/i18n";
interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

/**
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

function deadlineInfo(deadline: string | null): {
  label: string;
  urgent: boolean;
} | null {
  if (!deadline) return null;
  const today = todayStr();
  const days = Math.round(
    (new Date(deadline).getTime() - new Date(today).getTime()) / 86_400_000,
  );
  if (days < 0) return { label: t("en retard de {n} j", { n: -days }), urgent: true };
  if (days === 0) return { label: t("aujourd'hui"), urgent: true };
  // « J−3 » en français, « D−3 » en anglais : l'initiale suit la langue.
  return { label: `${pick("J", "D")}−${days}`, urgent: days <= 7 };
}

/** `Intl` dans la langue de l'app ; midi, pour rester dans la bonne journée (PIEGES § 4.1). */
function jourLong(jour: string): string {
  const [a, m, j] = jour.split("-").map(Number);
  return formatDate(new Date(a, m - 1, j, 12), { day: "numeric", month: "long" });
}

/** « hier », « demain », sinon « mar. 22 sept. » — la date d'un champ, en minuscule au fil d'une ligne. */
function auFilDeLaLigne(jour: string, aujourdHui: string): string {
  const relatif = libelleRelatif(jour, aujourdHui);
  return relatif ? relatif.toLocaleLowerCase() : formaterChamp(jour, aujourdHui);
}

export default function GoalsView({ data, refresh }: Props) {
  const isPhone = useIsPhone();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  /** L'objectif dont la ligne « ajouter une étape » vient d'être ouverte par le menu. */
  const [ajoutPour, setAjoutPour] = useState<number | null>(null);
  /** L'objectif regardé en carte mentale — un seul à la fois, plein écran. */
  const [enCarte, setEnCarte] = useState<Goal | null>(null);
  /**
   * L'objectif montré dans la fiche. `null` : le premier de la liste sur le
   * bureau, la LISTE sur iPhone — présélectionner y cacherait l'écran d'accueil
   * du module derrière son détail (même règle que les Notes).
   */
  const [choisiId, setChoisiId] = useState<number | null>(null);

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
  const goalsRef = useRef(goals);
  goalsRef.current = goals;

  /**
   * Un objectif créé devient l'objectif montré. `GoalModal` ne rend pas l'`id`
   * écrit : on retient les objectifs d'avant, et le premier objectif racine
   * inconnu qui apparaît après le rafraîchissement est le nouveau.
   */
  const avantCreation = useRef<Set<number> | null>(null);
  const nouvelObjectif = useCallback(() => {
    avantCreation.current = new Set(goalsRef.current.map((g) => g.id));
    setCreating(true);
  }, []);
  useEffect(() => {
    const avant = avantCreation.current;
    if (!avant) return;
    const neuf = goals.find((g) => g.parent_goal_id === null && !avant.has(g.id));
    if (neuf) {
      avantCreation.current = null;
      setChoisiId(neuf.id);
    }
  }, [goals]);

  // action palette "Nouvel objectif" → ouvre le formulaire
  useEffect(() => {
    window.addEventListener("sb:new-goal", nouvelObjectif);
    return () => window.removeEventListener("sb:new-goal", nouvelObjectif);
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
  const [demande, setDemande] = useState<number | null>(null);
  useEffect(() => {
    const surDemande = (e: Event) => {
      const id = (e as CustomEvent<number>).detail;
      if (id) setDemande(id);
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

  const choisi =
    roots.find((g) => g.id === choisiId) ??
    (isPhone ? null : (orderedCategories.flatMap((c) => groups.get(c)!)[0] ?? null));

  /**
   * ⭐ Corbeille (migration 027) : un objectif part AVEC ses phases et
   * sous-objectifs — et, depuis le 2026-09-30, avec ses TÂCHES (demande
   * d'Antonin ; `corbeille/lots.ts`). La confirmation ne reste que pour le cas
   * lourd — il emporte des étapes ou des tâches — et elle dit combien. Sinon,
   * la corbeille et son « Annuler » suffisent.
   */
  const supprimerObjectif = (goal: Goal) => jeter("goal", goal.id, goal.title, refresh);

  const ajouterEtape = (goal: Goal) => {
    setChoisiId(goal.id);
    setAjoutPour(goal.id);
  };

  // ─── Le menu d'un objectif ────────────────────────────────────────────────
  // Clic droit sur une ligne de la liste, ou le « ⋯ » de la fiche — le MÊME
  // menu (règle 18). Les étapes ont le leur dans la feuille de route (`MenuEtape`).
  const menu = useMenuContextuel<Goal>();
  const ia = useIaPossible();
  // Les objectifs en péril, pour offrir « Pourquoi, et que faire ? » (#13) à
  // ceux-là seulement. Même détection que le Calendrier, relue ici.
  const enPeril = useMemo(
    () =>
      ia
        ? new Set(
            objectifsEnPeril(goals, data.tasks, completions, todayStr(), {
              habits: data.habits,
              habitChecks: data.habitChecks,
            }).map((p) => p.goal.id),
          )
        : new Set<number>(),
    [ia, goals, data.tasks, completions, data.habits, data.habitChecks],
  );
  const entreesObjectif = (goal: Goal): EntreePossible[] => {
    const bilan = bilanDeDepart(goals, data.tasks, goal.id);
    return [
      { id: "ajouter-etape", libelle: t("Ajouter une étape"), icone: <IconPlus />, executer: () => ajouterEtape(goal) },
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
    const actif = choisi?.id === goal.id;
    return (
      <li
        key={goal.id}
        onContextMenu={(e) => menu.ouvrirAuPoint(e, goal)}
        onKeyDown={(e) => void menu.ouvrirAuClavier(e, goal)}
      >
        <button
          type="button"
          onClick={() => setChoisiId(goal.id)}
          aria-current={actif ? "true" : undefined}
          className={`block w-full rounded-[10px] px-3 py-2.5 text-left transition-colors ${
            actif ? "bg-surface-2" : "hover:bg-surface-2/50"
          }`}
        >
          <span className="flex items-baseline gap-3">
            <span className={`min-w-0 flex-1 truncate text-sm font-medium ${acheve ? "text-text-dim line-through" : "text-text"}`}>
              {goal.title}
            </span>
            <span className="shrink-0 font-display text-sm font-bold text-text">
              {m.pct == null ? "—" : `${m.pct}%`}
            </span>
          </span>
          {/* UNE ligne, jamais deux : la prochaine action si elle existe (le
              carré est l'icône de la tâche, DESIGN.md « Les types de nœud »),
              sinon l'échéance de l'objectif. */}
          {acheve ? (
            <span className="mt-0.5 block text-xs text-success">{t("Atteint")}</span>
          ) : suite ? (
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-text-dim">
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
            <span className={`mt-0.5 block text-xs ${dl.urgent ? "font-medium text-red" : "text-text-dim"}`}>{dl.label}</span>
          ) : null}
        </button>
      </li>
    );
  };

  // ─── La fiche ─────────────────────────────────────────────────────────────

  const fiche = (goal: Goal) => {
    const m = mesures.get(goal.id)!;
    const acheve = estAcheve(m);
    const aDesEtapes = goals.some((g) => g.parent_goal_id === goal.id);
    // ⭐ Un objectif MESURÉ qui n'a encore rien à mesurer n'affiche pas un faux
    // 0 % : il le dit, et la feuille de route dessous propose la première étape.
    const sansMesure = m.pct == null && !goal.manual_progress && !aDesEtapes;
    const dl = deadlineInfo(goal.deadline);
    const pct = m.pct;
    const menuOuvert = menu.ouvert && menu.cible?.id === goal.id;

    return (
      // `key` : changer d'objectif repart d'une fiche neuve — sinon un champ
      // « ajouter une étape » ouvert sur l'un resterait ouvert sur l'autre.
      <div key={goal.id} className="flex min-h-0 flex-col">
        {/* ⚠️ Le retour vit HORS de la zone qui défile : posé dans la fiche, il
            partait avec le contenu dès qu'on descendait dans la feuille de
            route — vu à l'écran à 390 pt le 2026-09-29. */}
        {isPhone && (
          <button
            type="button"
            onClick={() => setChoisiId(null)}
            className="cible-tactile-ligne -ml-1 mb-2 self-start rounded-md px-1 py-1 text-sm text-text-dim transition-colors hover:text-text"
          >
            ← {t("Tous les objectifs")}
          </button>
        )}
        <section className="card min-h-0 flex-1 overflow-y-auto p-4 lg:p-6" aria-label={goal.title}>
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 font-display text-2xl font-extrabold text-text [overflow-wrap:anywhere]">
              {goal.title}
            </h2>
            <button
              type="button"
              onClick={() => setEnCarte(goal)}
              className="cible-tactile-ligne flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-text-dim hover:bg-surface-2 hover:text-text"
              data-tip={t("Voir en carte mentale")}
              data-tip-sub={t("La même feuille de route, en carte mentale. Ce que tu y changes change ici aussi.")}
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
              className="cible-tactile flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-dim hover:bg-surface-2 hover:text-text"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
          </div>

          <p className="mt-1 text-xs text-text-dim">
            {t(SCOPE_LABEL[goal.scope])}
            {goal.deadline && <> · {jourLong(goal.deadline)}</>}
            {dl?.urgent && !acheve && <span className="font-medium text-red"> · {dl.label}</span>}
          </p>
          {goal.description && <p className="mt-2 text-sm text-text-dim">{goal.description}</p>}

          {sansMesure ? (
            <p className="mt-4 text-sm text-text-dim">
              {t("Pas encore de feuille de route.")}{" "}
              <button
                type="button"
                onClick={async () => {
                  await majFeuilleDeRoute(goal.id, { manual_progress: 1 });
                  await refresh();
                }}
                className="cible-tactile-ligne font-medium text-blue hover:underline"
                data-tip={t("Pour un objectif qui ne se découpe pas : tu règles toi-même son avancement.")}
              >
                {t("Suivre à la main")}
              </button>
            </p>
          ) : (
            <>
              <div className="mt-4 flex items-center gap-4">
                <div className="pill h-1.5 flex-1 overflow-hidden bg-surface-2">
                  {pct != null && (
                    <div
                      className={`pill h-full transition-[width] duration-500 ${acheve ? "bg-success" : "bg-[image:var(--gradient-brand)]"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  )}
                </div>
                {/* Une feuille de route encore vide affiche « — », jamais un faux 0 %. */}
                <span className="shrink-0 font-display text-3xl font-extrabold text-text">
                  {pct == null ? "—" : `${pct}%`}
                </span>
              </div>
              {/* ⭐ UNE phrase d'origine. L'audit (D1, point 2) : « 45 % saisi à
                  la main » sur la ligne, et juste dessous « la feuille de route
                  n'est pas lue » dans un bandeau — deux vérités pour un chiffre.
                  Le bandeau a quitté la feuille de route ; la phrase dit les deux. */}
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
                      className="cible-tactile-ligne font-medium text-blue hover:underline"
                    >
                      {t("La faire compter")}
                    </button>
                  </>
                ) : (
                  origineEnClair(m)
                )}
              </p>
            </>
          )}

          <FeuilleDeRoute
            racine={goal}
            data={data}
            contexte={contexte}
            sources={sources}
            mesures={mesures}
            replis={replis}
            onReplier={onReplier}
            ajoutOuvert={ajoutPour === goal.id}
            onFermerAjout={() => setAjoutPour((a) => (a === goal.id ? null : a))}
            onModifier={setEditing}
            refresh={refresh}
          />
        </section>
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col p-4 lg:p-8">
      {/* Sur iPhone, la fiche prend l'écran : l'en-tête du module laisse la
          place au retour, comme la barre de navigation d'iOS. */}
      {!(isPhone && choisi) && (
        <header className="view-head shrink-0">
          <h1 className="text-3xl text-text">{t("Objectifs")}</h1>
          <button
            type="button"
            onClick={nouvelObjectif}
            data-tip={t("Nouvel objectif")}
            data-tip-sub={t("Un titre suffit. La feuille de route viendra quand tu en auras besoin.")}
            className="pill fill-primary px-4 py-2 text-sm font-semibold"
          >
            {t("+ Nouvel objectif")}
          </button>
        </header>
      )}

      {roots.length === 0 ? (
        <section className="card mt-6 p-3">
          <p className="py-10 text-center text-sm text-text-dim">
            {t(
              "Aucun objectif. Commence par le long terme, puis découpe-le en étapes quand tu en as besoin. Range-les par catégorie (Formation, Santé…).",
            )}
          </p>
        </section>
      ) : (
        <div
          className={`grid min-h-0 flex-1 gap-4 ${isPhone && choisi ? "" : "mt-6"} ${
            isPhone ? "grid-cols-1" : "grid-cols-[minmax(220px,300px)_minmax(0,1fr)]"
          }`}
        >
          {(!isPhone || !choisi) && (
            <nav aria-label={t("Mes objectifs")} className="min-h-0 overflow-y-auto">
              {orderedCategories.map((cat) => (
                <div key={cat} className="mb-3">
                  {avecIntertitres && (
                    <h2 className="hud-label px-3 pb-1 pt-1">{cat === NONE ? t("Sans catégorie") : cat}</h2>
                  )}
                  <ul className="flex flex-col gap-0.5">{groups.get(cat)!.map(ligneListe)}</ul>
                </div>
              ))}
            </nav>
          )}
          {choisi && fiche(choisi)}
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

      {(creating || editing) && (
        <GoalModal
          goal={editing}
          goals={goals}
          onClose={() => {
            avantCreation.current = null;
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
