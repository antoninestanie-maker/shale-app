import { useMemo, useState } from "react";
import { CaseACocher } from "./CaseACocher";
import { IconChevronRight, IconSablier, IconTarget } from "./icons";
import MenuContextuel, { BoutonMenu } from "./menu/MenuContextuel";
import { useMenuContextuel } from "./menu/useMenuContextuel";
import { entreesTache, gestesCommunsTache, type GestesTache } from "./menu/catalogue/tache";
import BoutonDate from "./taches/BoutonDate";
import ChampRenommage from "./taches/ChampRenommage";
import { t, tp } from "../lib/i18n";
import { useIaPossible } from "../lib/ia/useIa";
import { effectiveProgress, todayStr } from "../lib/logic";
import { ouvrirParId } from "../lib/naviguer";
import { estAcheve, mesurer, type SourcesProgression } from "../lib/objectifs/progression";
import { objectifsEnRetard } from "../lib/objectifs/retard";
import { couleurPriorite, phrasePriorite } from "../lib/priorite";
import { renommerTache } from "../lib/repo";
import { useGesteFocus } from "../lib/seance/gesteFocus";
import { tachesEnRetard } from "../lib/taches";
import type { AppData, Task, TodayTask } from "../lib/types";

/** Combien de lignes on montre avant « Afficher les autres ». */
const VISIBLES = 3;

/**
 * ⭐ « EN RETARD » — en tête d'Aujourd'hui (2026-10-11).
 *
 * Le crible du labo (constat 4) : l'écran d'ouverture ne signalait aucun
 * retard. La tâche d'hier, reportée deux fois, y était une ligne comme les
 * autres ; « échéance dépassée de 73 jours » n'était écrit qu'au Calendrier.
 *
 *   • les tâches datées d'avant aujourd'hui et pas faites (`tachesEnRetard`) :
 *     elles ne sont plus dans le compte du jour, elles attendent ici qu'on les
 *     fasse ou qu'on les replanifie — la case, la date et le « ⋯ » agissent sur
 *     place ;
 *   • les objectifs dont l'échéance est dépassée (`objectifsEnRetard`) : la
 *     ligne ouvre l'objectif.
 *
 * ⚠️ ABSENTE quand il n'y a rien : sur un compte neuf, elle n'existe pas.
 *
 * ⚠️ En tête de l'ÉCRAN, pas dans la carte des tâches : cette carte peut être
 * masquée par Personnaliser, et un objectif en retard n'est pas une tâche.
 *
 * ⚠️ Pas de rouge : c'est un fait, pas une alarme. Le sablier et le mot
 * suffisent.
 */
export default function EnRetard(props: {
  data: AppData;
  /** Les sources de la mesure d'un objectif (`useSourcesProgression`). */
  sources: SourcesProgression;
  refresh: () => Promise<void>;
  /** La bascule de la carte « Tâches du jour » — la même fonction (règle 18). */
  onToggle: (task: TodayTask) => void;
  /** Ce que la case affiche : la coche optimiste de la vue. */
  cochee: (task: Task) => boolean;
}) {
  const { data, sources, refresh } = props;
  const today = todayStr();
  const ia = useIaPossible();
  const menu = useMenuContextuel<Task>();
  // « Focus 25 min » : le geste de toute l'app (règle 18), lu dans le contexte.
  const gesteFocus = useGesteFocus();
  const [renommeId, setRenommeId] = useState<number | null>(null);
  const [tout, setTout] = useState(false);

  const taches = useMemo(() => tachesEnRetard(data.tasks, data.completions, today), [data.tasks, data.completions, today]);
  const objectifs = useMemo(
    () => objectifsEnRetard(data.goals, (g) => estAcheve(mesurer(g, sources)), today),
    [data.goals, sources, today],
  );

  const total = taches.length + objectifs.length;
  if (total === 0) return null;

  const gestes: GestesTache = {
    ...gestesCommunsTache(refresh),
    basculer: (task) => props.onToggle({ ...task, done: props.cochee(task) }),
    renommer: (task) => setRenommeId(task.id),
    modifier: (task) => ouvrirParId("task", task.id),
    focus: gesteFocus,
  };

  const validerRenommage = async (task: Task, libelle: string) => {
    setRenommeId(null);
    if (!libelle.trim() || libelle.trim() === task.label) return;
    await renommerTache(task.id, libelle);
    await refresh();
  };

  // Les tâches d'abord : ce sont elles qu'on règle d'un geste.
  const lignes = [
    ...taches.map((task) => ({ cle: `t${task.id}`, task, objectif: null })),
    ...objectifs.map((o) => ({ cle: `o${o.goal.id}`, task: null, objectif: o })),
  ];
  const visibles = tout ? lignes : lignes.slice(0, VISIBLES);

  return (
    <section className="card mt-4 px-3 py-3 lg:px-4" aria-labelledby="aujourdhui-en-retard">
      <h2 id="aujourdhui-en-retard" className="flex items-center gap-2 px-2">
        <IconSablier className="h-3.5 w-3.5 shrink-0 text-text-dim" />
        <span className="hud-label">{t("En retard")}</span>
        <span className="text-xs tabular-nums text-text-dim">{total}</span>
      </h2>

      <ul className="mt-1 flex flex-col">
        {visibles.map(({ cle, task, objectif }) =>
          task ? (
            <li
              key={cle}
              className="group/ligne flex items-center gap-3 rounded-[10px] px-2 py-1.5 transition-colors hover:bg-surface-2"
              onContextMenu={(e) => menu.ouvrirAuPoint(e, task)}
              onKeyDown={(e) => {
                if (renommeId === task.id) return; // le champ gère ses touches
                if (menu.ouvrirAuClavier(e, task)) return;
                if (e.key !== "F2" || e.defaultPrevented) return;
                e.preventDefault();
                setRenommeId(task.id);
              }}
            >
              <CaseACocher
                cochee={props.cochee(task)}
                onBascule={() => gestes.basculer(task)}
                libelle={task.label}
                anneau={couleurPriorite(task.priority)}
                tip={t("Marquer faite")}
                tipSub={phrasePriorite(task.priority)}
              />
              {/* Le libellé et ses faits : côte à côte au bureau, l'un sous
                  l'autre à 390 px — le titre garde toute la largeur. */}
              <div className="flex min-w-0 flex-1 flex-col gap-x-3 sm:flex-row sm:items-baseline">
                {renommeId === task.id ? (
                  <ChampRenommage
                    valeur={task.label}
                    onValider={(libelle) => void validerRenommage(task, libelle)}
                    onAnnuler={() => setRenommeId(null)}
                  />
                ) : (
                  <span
                    className={`truncate-souris min-w-0 truncate text-sm ${props.cochee(task) ? "text-text-dim line-through" : "text-text"}`}
                    title={task.label}
                  >
                    {task.label}
                  </span>
                )}
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-text-dim">
                  <BoutonDate task={task} aujourdHui={today} dater={gestes.dater} className="font-medium text-text" />
                  {task.postponed_count > 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{tp(task.postponed_count, "reportée une fois", "reportée {n} fois")}</span>
                    </>
                  )}
                </span>
              </div>
              <BoutonMenu
                visible
                onOuvrir={(e) => menu.ouvrirSousLeBouton(e, task)}
                ouvert={menu.ouvert && menu.cible?.id === task.id}
                libelle={t("Actions sur « {titre} »", { titre: task.label })}
              />
            </li>
          ) : (
            <li key={cle}>
              {/* Toute la ligne ouvre l'objectif : c'est là qu'on agit sur lui. */}
              <button
                type="button"
                onClick={() => ouvrirParId("goal", objectif!.goal.id)}
                className="cible-tactile-ligne flex w-full items-center gap-3 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
              >
                <IconTarget className="h-4 w-4 shrink-0 text-text-dim" />
                <span className="flex min-w-0 flex-1 flex-col gap-x-3 sm:flex-row sm:items-baseline">
                  <span className="truncate-souris min-w-0 truncate text-sm text-text" title={objectif!.goal.title}>
                    {objectif!.goal.title}
                  </span>
                  <span className="shrink-0 text-xs text-text-dim">
                    {tp(objectif!.jours, "échéance dépassée d'un jour", "échéance dépassée de {n} jours")}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-text-dim">
                  {effectiveProgress(objectif!.goal, sources.goals, sources.tasks, sources.completions, sources)}%
                </span>
                <IconChevronRight className="h-4 w-4 shrink-0 text-text-dim" aria-hidden />
              </button>
            </li>
          ),
        )}
      </ul>

      {lignes.length > VISIBLES && (
        <button
          type="button"
          onClick={() => setTout((v) => !v)}
          aria-expanded={tout}
          className="cible-tactile-ligne ml-2 mt-0.5 text-xs font-medium text-text-dim hover:text-text"
        >
          {tout
            ? t("Réduire")
            : tp(lignes.length - VISIBLES, "Afficher la dernière", "Afficher les {n} autres")}
        </button>
      )}

      <MenuContextuel
        etat={menu}
        libelle={t("Actions sur « {titre} »", { titre: menu.cible?.label ?? "" })}
        entrees={(() => {
          // Relue dans les tâches FRAÎCHES : cochée ou reportée pendant que le
          // menu est ouvert, elle n'est plus en retard — le menu se ferme seul.
          const fraiche = menu.cible && taches.find((x) => x.id === menu.cible!.id);
          return fraiche
            ? entreesTache(fraiche, gestes, { faite: props.cochee(fraiche), objectifs: data.goals, ia })
            : [];
        })()}
      />
    </section>
  );
}
