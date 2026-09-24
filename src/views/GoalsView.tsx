import { useCallback, useEffect, useMemo, useState } from "react";
import GoalModal from "../components/GoalModal";
import FeuilleDeRoute from "../components/objectifs/FeuilleDeRoute";
import CarteObjectif from "../components/objectifs/CarteObjectif";
import { IconChevronDown, IconChevronRight } from "../components/icons";
import { todayStr } from "../lib/logic";
import { lireReplis, origineEnClair, type Replis } from "../lib/objectifs/libelles";
import { estAcheve, mesurer, type Mesure, type SourcesProgression } from "../lib/objectifs/progression";
import { CONTEXTE_VIDE, rattachementsDe, type ContexteObjectifs } from "../lib/objectifs/contexte";
import { uidDeLigne } from "../lib/objectifs/progression";
import { fetchContexteObjectifs, getSetting, majFeuilleDeRoute, setSetting } from "../lib/repo";
import { descendantsVivants } from "../lib/corbeille/lots";
import { jeter } from "../components/corbeille/geste";
import MenuContextuel from "../components/menu/MenuContextuel";
import ConfirmationEnLigne from "../components/ConfirmationEnLigne";
import { useMenuContextuel } from "../components/menu/useMenuContextuel";
import { IconPencil, IconPlus, IconTrash } from "../components/icons";
import type { EntreePossible } from "../lib/menu/entrees";
import type { AppData, Goal } from "../lib/types";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";

import { pick, t, tp } from "../lib/i18n";
interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

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

export default function GoalsView({ data, refresh }: Props) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [parentForNew, setParentForNew] = useState<number | null>(null);
  /** L'objectif dont on demande la suppression (il a des étapes : la question est posée dans la ligne). */
  const [deletingId, setDeletingId] = useState<number | null>(null);
  /** L'objectif dont la ligne « ajouter une étape » vient d'être ouverte par son bouton. */
  const [ajoutPour, setAjoutPour] = useState<number | null>(null);
  /** L'objectif regardé en carte mentale (lecture) — un seul à la fois, plein écran. */
  const [enCarte, setEnCarte] = useState<Goal | null>(null);

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
      const suivant = { ...r, [cle]: ouvert };
      void setSetting(CLE_REPLIS, JSON.stringify(suivant));
      return suivant;
    });
  }, []);

  // action palette "Nouvel objectif" → ouvre le formulaire
  useEffect(() => {
    const onNew = () => setCreating(true);
    window.addEventListener("sb:new-goal", onNew);
    return () => window.removeEventListener("sb:new-goal", onNew);
  }, []);

  const { goals, tasks, completions } = data;

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

  /**
   * Combien d'étapes (phases et sous-objectifs, à toute profondeur) partiraient
   * AVEC cet objectif — la règle même de la corbeille (`descendantsVivants`).
   */
  const etapesDe = (goal: Goal) =>
    descendantsVivants(
      goals.map((g) => ({ id: g.id, parent_goal_id: g.parent_goal_id, deleted_at: null })),
      goal.id,
    ).length - 1;

  /**
   * ⭐ Corbeille (migration 027) — et un CHANGEMENT DE COMPORTEMENT, décidé à
   * l'arrêt 1 : un objectif part désormais AVEC ses phases et sous-objectifs
   * (avant : ils remontaient d'un niveau). Ses tâches restent, détachées tant
   * qu'il est en corbeille, et le retrouvent à la restauration.
   *
   * La confirmation en deux clics ne reste QUE pour le cas lourd — un objectif
   * qui emporte des étapes — et elle dit combien. Sans étape, la corbeille et
   * son « Annuler » suffisent.
   */
  const supprimerObjectif = (goal: Goal) => jeter("goal", goal.id, goal.title, refresh);
  /**
   * Le bouton de la ligne. Avec des étapes, la question est posée DANS la
   * ligne (`ConfirmationEnLigne`), comme le menu la pose dans le menu — plus de
   * double-clic « sûr ? », qui ne disait pas ce qui partait (2026-09-24).
   */
  const handleDelete = async (goal: Goal) => {
    if (etapesDe(goal) > 0) {
      setDeletingId(goal.id);
      return;
    }
    await supprimerObjectif(goal);
  };

  const ajouterEtape = (goal: Goal) => {
    setAjoutPour(goal.id);
    onReplier(`g${goal.id}`, true);
  };

  // ─── Le menu contextuel d'un objectif ─────────────────────────────────────
  // Les MÊMES gestes que les trois boutons de la ligne (règle 18). Les étapes,
  // elles, ont déjà leur menu « ⋯ » dans la feuille de route (`MenuEtape`).
  const menu = useMenuContextuel<Goal>();
  const entreesObjectif = (goal: Goal): EntreePossible[] => {
    const n = etapesDe(goal);
    return [
      { id: "ajouter-etape", libelle: t("Ajouter une étape"), icone: <IconPlus />, executer: () => ajouterEtape(goal) },
      { id: "modifier", libelle: t("Modifier…"), icone: <IconPencil />, executer: () => setEditing(goal) },
      {
        id: "supprimer",
        libelle: t("Supprimer"),
        icone: <IconTrash />,
        danger: true,
        // Cas LOURD : il emporte des étapes. La confirmation reste, et dit
        // combien (cahier des charges, phase 3).
        confirmation:
          n > 0
            ? {
                libelle: t("Confirmer la suppression"),
                detail: tp(
                  n,
                  "Il part avec 1 étape dans Supprimés récemment. Ses tâches restent.",
                  "Il part avec ses {n} étapes dans Supprimés récemment. Ses tâches restent.",
                ),
              }
            : undefined,
        executer: () => supprimerObjectif(goal),
      },
    ];
  };

  const renderGoal = (goal: Goal) => {
    const m = mesures.get(goal.id)!;
    const aDesEtapes = goals.some((g) => g.parent_goal_id === goal.id);
    const aDesTaches =
      tasks.some((x) => x.goal_id === goal.id) || rattachementsDe(uidDeLigne("goal", goal), contexte).length > 0;
    const avecFeuille = aDesEtapes || aDesTaches || ajoutPour === goal.id;
    const cle = `g${goal.id}`;
    // Déplié d'office s'il a une feuille de route : c'est ce que montrait la vue
    // d'avant, qui imbriquait toujours les sous-objectifs. Un objectif qui n'a
    // que des tâches rattachées reste replié — elles se lisent dans « 1/2
    // éléments », et les déplier chez tout le monde au premier lancement ne
    // serait que du bruit.
    const ouvert = replis[cle] ?? (aDesEtapes || ajoutPour === goal.id);
    const dl = deadlineInfo(goal.deadline);
    // ⭐ Un objectif MESURÉ qui n'a encore rien à mesurer n'affiche pas un faux
    // 0 % : il propose l'action. C'est l'état vide qui parle.
    const sansMesure = m.pct == null && !goal.manual_progress && !aDesEtapes;
    const pct = m.pct;

    return (
      <div key={goal.id}>
        <div
          className="group flex flex-wrap items-center gap-3 rounded-[10px] px-3 py-3 hover:bg-surface-2"
          onContextMenu={(e) => menu.ouvrirAuPoint(e, goal)}
          onKeyDown={(e) => void menu.ouvrirAuClavier(e, goal)}
        >
          {avecFeuille && !(ajoutPour === goal.id && !aDesEtapes && !aDesTaches) ? (
            <button
              type="button"
              onClick={() => onReplier(cle, !ouvert)}
              className="cible-tactile -ml-1 flex h-7 w-6 shrink-0 items-center justify-center rounded-md text-text-dim hover:text-text"
              aria-expanded={ouvert}
              aria-label={
                ouvert
                  ? t("Replier la feuille de route de « {titre} »", { titre: goal.title })
                  : t("Déplier la feuille de route de « {titre} »", { titre: goal.title })
              }
            >
              {ouvert ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
            </button>
          ) : (
            <span className="-ml-1 w-6 shrink-0" aria-hidden />
          )}

          {/* basis-[14rem] : base flex qui déclenche le repli. En fenêtre
              étroite la barre de progression et les actions passent à la ligne
              au lieu de sortir du panneau (clippées = incliquables). En plein
              écran tout tient sur une ligne : rendu inchangé. */}
          <div className="min-w-0 flex-1 basis-[14rem]">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`truncate text-sm ${estAcheve(m) ? "text-text-dim line-through" : "text-text"}`}
              >
                {goal.title}
              </span>
              <span className="pill shrink-0 bg-surface-2 px-2 py-0.5 text-[10px] text-text-dim">
                {t(SCOPE_LABEL[goal.scope])}
              </span>
              {dl && (
                <span
                  className={`pill shrink-0 px-2 py-0.5 text-[10px] font-medium ${
                    dl.urgent ? "bg-red/15 text-red" : "bg-surface-2 text-text-dim"
                  }`}
                >
                  {dl.label}
                </span>
              )}
            </div>
            {goal.description && (
              <p className="mt-0.5 truncate text-xs text-text-dim">
                {goal.description}
              </p>
            )}
            {!sansMesure && (
              <p className="mt-0.5 truncate text-[11px] text-text-dim">{origineEnClair(m)}</p>
            )}
          </div>

          {sansMesure ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
              {ajoutPour !== goal.id && (
                <button
                  type="button"
                  onClick={() => {
                    setAjoutPour(goal.id);
                    onReplier(cle, true);
                  }}
                  className="cible-tactile pill border border-border px-2.5 py-1 font-medium text-text hover:bg-surface"
                >
                  {t("+ Ajouter une étape")}
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await majFeuilleDeRoute(goal.id, { manual_progress: 1 });
                  await refresh();
                }}
                className="cible-tactile px-1 text-text-dim hover:text-text hover:underline"
                data-tip={t("Suivre à la main")}
                data-tip-sub={t("Pour un objectif qui ne se découpe pas : tu règles toi-même son avancement.")}
              >
                {t("ou suivre à la main")}
              </button>
            </div>
          ) : (
            <div className="flex w-44 shrink-0 items-center gap-2">
              <div className="pill h-1.5 flex-1 overflow-hidden bg-surface-2">
                {pct != null && (
                  <div
                    className={`pill h-full transition-[width] duration-500 ${estAcheve(m) ? "bg-success" : "bg-[image:var(--gradient-brand)]"}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                )}
              </div>
              {/* Une feuille de route encore vide affiche « — », jamais un faux 0 %. */}
              <span className="w-12 text-right font-display text-sm font-bold text-text">
                {pct == null ? "—" : `${pct}%`}
              </span>
            </div>
          )}

          {/* ⚠️ Visibles au focus clavier et en permanence au doigt : aucune
              action ne doit exister uniquement au survol. */}
          <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
            <button
              type="button"
              onClick={() => ajouterEtape(goal)}
              className="cible-tactile rounded-md p-1.5 text-text-dim hover:bg-surface hover:text-text"
              aria-label={t("Ajouter une étape à {title}", { title: goal.title })}
              data-tip={t("Ajouter une étape")}
              data-tip-sub={t("Une phase ou un sous-objectif, en une ligne. Entrée pour enchaîner.")}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setEditing(goal)}
              className="cible-tactile rounded-md p-1.5 text-text-dim hover:bg-surface hover:text-text"
              aria-label={t("Modifier {title}", { title: goal.title })}
              data-tip={t("Modifier l’objectif")}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleDelete(goal)}
              className="cible-tactile rounded-md p-1.5 text-text-dim transition-colors hover:bg-surface hover:text-red"
              aria-label={t("Supprimer {title}", { title: goal.title })}
              data-tip={t("Supprimer l’objectif")}
              // ⚠️ Cette bulle disait « les sous-objectifs remontent d'un
              // niveau » : faux depuis la corbeille, ils partent avec lui.
              data-tip-sub={
                etapesDe(goal) > 0
                  ? tp(
                      etapesDe(goal),
                      "Il part avec 1 étape dans Supprimés récemment, 30 jours. Ses tâches restent.",
                      "Il part avec ses {n} étapes dans Supprimés récemment, 30 jours. Ses tâches restent.",
                    )
                  : t("Il reste 30 jours dans Supprimés récemment. Ses tâches restent.")
              }
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
            </button>
          </span>
        </div>

        {deletingId === goal.id && (
          <ConfirmationEnLigne
            className="mx-3 mb-2"
            question={tp(
              etapesDe(goal),
              "Supprimer « {titre} » ? Il part avec 1 étape dans Supprimés récemment. Ses tâches restent.",
              "Supprimer « {titre} » ? Il part avec ses {n} étapes dans Supprimés récemment. Ses tâches restent.",
              { titre: goal.title },
            )}
            libelle={t("Supprimer")}
            onRenoncer={() => setDeletingId(null)}
            onConfirmer={async () => {
              setDeletingId(null);
              await supprimerObjectif(goal);
            }}
          />
        )}

        {avecFeuille && ouvert && (
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
            onCarte={setEnCarte}
            refresh={refresh}
          />
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="view-head">
        <h1 className="text-3xl text-text">{t("Objectifs")}</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          data-tip={t("Nouvel objectif")}
          data-tip-sub={t("Un titre suffit. La feuille de route viendra quand tu en auras besoin.")}
          className="pill fill-primary px-4 py-2 text-sm font-semibold"
        >
          {t("+ Nouvel objectif")}
        </button>
      </header>

      {roots.length === 0 ? (
        <ResizableGrid gridId="goals" className="mt-6">
        <ResizablePanel id="goals-list" defaultW={12}>
        <section className="card p-3">
          <p className="py-10 text-center text-sm text-text-dim">
            {t(
              "Aucun objectif. Commence par le long terme, puis découpe-le en étapes quand tu en as besoin. Range-les par catégorie (Trading, Formation…).",
            )}
          </p>
        </section>
        </ResizablePanel>
        </ResizableGrid>
      ) : (
        <ResizableGrid gridId="goals" className="mt-6">
          {orderedCategories.map((cat) => {
            const list = groups.get(cat)!;
            const label = cat === NONE ? t("Sans catégorie") : cat;
            return (
              <ResizablePanel
                key={cat}
                id={`goals-cat-${cat}`}
                title={label}
                defaultW={12}
              >
                <section className="card p-3">
                  <div className="mb-1 flex items-center gap-2 px-2 pt-1">
                    <h2 className="hud-label">{label}</h2>
                    <span className="pill bg-surface-2 px-2 py-0.5 text-[10px] text-text-dim">
                      {list.length}
                    </span>
                  </div>
                  {list.map((g) => renderGoal(g))}
                </section>
              </ResizablePanel>
            );
          })}
        </ResizableGrid>
      )}

      {enCarte && (
        <CarteObjectif
          /* ⚠️ On relit l'objectif dans `data` plutôt que de garder la copie
             capturée au clic : rattacher une tâche depuis la carte refermerait
             sur un objet périmé, et le dessin ne bougerait pas. */
          racine={goals.find((g) => g.id === enCarte.id) ?? enCarte}
          data={data}
          contexte={contexte}
          mesures={mesures}
          onFermer={() => setEnCarte(null)}
        />
      )}

      {(creating || editing || parentForNew !== null) && (
        <GoalModal
          goal={editing}
          goals={goals}
          defaultParentId={parentForNew}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            setParentForNew(null);
          }}
          onSaved={async () => {
            await refresh();
            setCreating(false);
            setEditing(null);
            setParentForNew(null);
          }}
        />
      )}

      {/* Un seul menu pour toute la liste, recalculé depuis les objectifs frais :
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
