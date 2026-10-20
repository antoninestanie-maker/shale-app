import { useState } from "react";
import type { Goal, Tag, TodayTask } from "../lib/types";
import { CocheVisuelle } from "./CaseACocher";
import MenuContextuel, { BoutonMenu } from "./menu/MenuContextuel";
import { useMenuContextuel } from "./menu/useMenuContextuel";
import { entreesTache, gestesCommunsTache, type GestesTache } from "./menu/catalogue/tache";
import { renommerTache } from "../lib/repo";
import { useIaPossible } from "../lib/ia/useIa";
import { ouvrirParId } from "../lib/naviguer";
import { focusPossible } from "../lib/seance/focusTache";
import { focusDeTache, useGesteFocus } from "../lib/seance/gesteFocus";

import { t } from "../lib/i18n";
import { todayStr } from "../lib/logic";
import { phrasePriorite } from "../lib/priorite";
import BadgeEtat from "./taches/BadgeEtat";
import ChampRenommage from "./taches/ChampRenommage";
import { badgeEtat } from "../lib/taches/etat";
import SaisieRapide from "./taches/SaisieRapide";
import type { AjoutRapide } from "../lib/taches/saisieRapide";
interface Props {
  tasks: TodayTask[];
  tags: Tag[];
  goals?: Goal[];
  onToggle: (task: TodayTask) => void;
  /**
   * Ajouter une tâche. `jour` : la date lue dans la phrase ou choisie au
   * calendrier — à défaut AUJOURD'HUI, puisque c'est la liste du jour
   * (`SaisieRapide`, 2026-10-11).
   */
  onAdd: (ajout: AjoutRapide) => void;
  /**
   * Le rafraîchissement de l'app — il active le MENU CONTEXTUEL des tâches
   * (Renommer, Dater, Rattacher, Dupliquer, Supprimer…). Sans lui, le widget
   * reste celui d'avant, sans menu.
   */
  refresh?: () => Promise<void>;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "var(--color-yellow)",
  medium: "var(--color-text-dim)",
  low: "var(--color-text-dim)",
};

export default function TodayTasks({ tasks, tags, goals, onToggle, onAdd, refresh }: Props) {
  const ia = useIaPossible();
  // ⭐ Le minuteur vient du contexte (2026-10-12), plus d'une prop que la vue
  // retirait dès qu'une séance existait : le ▶ et l'entrée du menu appellent le
  // même geste (règle 18), et c'est `regleFocus` qui dit ce qu'il fait.
  const gesteFocus = useGesteFocus();
  const [renommeId, setRenommeId] = useState<number | null>(null);
  const menu = useMenuContextuel<TodayTask>();

  // Les gestes du menu : la case de CE widget pour Terminer (règle 18), le
  // renommage en place, et l'éditeur de la vue Tâches pour « Modifier… » — le
  // widget n'en a pas à lui. Le reste est commun à toutes les vues de tâches.
  const gestes: GestesTache | null = refresh
    ? {
        ...gestesCommunsTache(refresh),
        basculer: (task) => onToggle(task as TodayTask),
        renommer: (task) => setRenommeId(task.id),
        modifier: (task) => ouvrirParId("task", task.id),
        focus: gesteFocus,
      }
    : null;

  const validerRenommage = async (task: TodayTask, libelle: string) => {
    setRenommeId(null);
    if (!refresh || !libelle.trim() || libelle.trim() === task.label) return;
    await renommerTache(task.id, libelle);
    await refresh();
  };
  const tagColor = (name: string | null) =>
    tags.find((t) => t.name === name)?.color ?? "var(--color-blue)";
  const goalTitle = (goalId: number | null) =>
    goalId == null ? null : (goals?.find((g) => g.id === goalId)?.title ?? null);

  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  return (
    // panel-col + panel-grow : la carte grandit → c'est la LISTE qui prend la
    // hauteur (et défile si on rétrécit), pas un vide sous le contenu.
    <div className="panel-col panel-grow">
      {/* ⭐ La même ligne d'ajout que la vue Tâches. Ici, une tâche ajoutée
          sans date naît datée d'AUJOURD'HUI : c'est la liste du jour, et une
          tâche sans date n'y paraîtrait pas. La pastille le dit avant qu'on valide. */}
      <SaisieRapide
        className="shrink-0"
        parDefaut={todayStr()}
        placeholder={t("Ajouter une tâche…  (Entrée)")}
        aria={t("Ajouter une tâche")}
        onAjouter={onAdd}
      />

      <ul className="panel-scroll mt-3 flex flex-col gap-1 pr-0.5">
        {sorted.length === 0 && (
          <li className="flex flex-1 flex-col items-center justify-center gap-1 py-6 text-center">
            <p className="text-sm text-text-dim">{t("Rien pour aujourd'hui.")}</p>
            <p className="text-xs text-text-dim/70">{t("Ajoute une première tâche ↑")}</p>
          </li>
        )}
        {sorted.map((task) => (
          <li
            key={task.id}
            className="group group/ligne relative flex shrink-0 items-center gap-0.5"
            onContextMenu={gestes ? (e) => menu.ouvrirAuPoint(e, task) : undefined}
            onKeyDown={(e) => {
              if (!gestes || renommeId === task.id) return;
              if (menu.ouvrirAuClavier(e, task)) return;
              if (e.key !== "F2" || e.defaultPrevented) return;
              e.preventDefault();
              setRenommeId(task.id);
            }}
          >
            {renommeId === task.id ? (
              /* Renommer EN PLACE. Pas dans le bouton-case : un champ dans un
                 <button> n'est pas du HTML valide, et chaque frappe cocherait. */
              <ChampRenommage
                valeur={task.label}
                onValider={(libelle) => void validerRenommage(task, libelle)}
                onAnnuler={() => setRenommeId(null)}
                className="my-1 min-w-0 flex-1 rounded-md border border-accent bg-surface px-2 py-1 text-sm text-text focus:outline-none"
              />
            ) : (
            <button
              type="button"
              role="checkbox"
              aria-checked={task.done}
              aria-label={task.label}
              onClick={() => onToggle(task)}
              data-tip={task.done ? t("Marquer à faire") : t("Marquer faite")}
              // ⚠️ Pas « la série du jour » (rythme-9, 2026-10-20) : la série de
              // l'accueil compte les habitudes. Une tâche compte dans la série
              // de TÂCHES, que montre Performance.
              data-tip-sub={t("Compte dans la série de tâches, dans Performance.")}
              className="cible-tactile-ligne flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-overlay"
            >
              <CocheVisuelle cochee={task.done} />

              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: PRIORITY_COLOR[task.priority] }}
                // Disait « Priorité high » : la valeur brute de la base, jamais traduite.
                title={phrasePriorite(task.priority)}
              />

              {/* min-w-0 + clamp : un libellé très long ne pousse jamais les
                  chips hors de la carte, il se coupe proprement sur 2 lignes. */}
              {/* `truncate-souris` : au doigt, pas de bulle pour lire la suite —
                  le titre reprend toutes ses lignes (voir `index.css`). */}
              <span
                className={`truncate-souris clamp-2 min-w-0 flex-1 text-sm ${
                  task.done ? "text-text-dim line-through" : "text-text"
                }`}
                title={task.label}
              >
                {task.label}
              </span>

              {/* L'état se voit ici aussi (audit 2026-10-20, constat 21) : la
                  liste du jour n'a que des tâches à faire ou EN COURS. */}
              <BadgeEtat badge={badgeEtat(task, task.done, todayStr())} />

              {goalTitle(task.goal_id) && (
                <span
                  className="shrink-0 text-accent"
                  title={t("Rattachée à l'objectif « {title} »", { title: goalTitle(task.goal_id) ?? "" })}
                  aria-label={t("Objectif : {title}", { title: goalTitle(task.goal_id) ?? "" })}
                >
                  ◎
                </span>
              )}

              {task.tag && (
                <span
                  className="pill max-w-[35%] shrink-0 truncate px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${tagColor(task.tag)} 16%, transparent)`,
                    color: tagColor(task.tag),
                  }}
                  title={task.tag}
                >
                  {task.tag}
                </span>
              )}
            </button>
            )}
            {/* ⚠️ Au doigt, le ▶ est RETIRÉ, pas révélé : sur un téléphone, ses
                28 px écrasaient le libellé (« Sessio n… », mesuré à 390 px le
                2026-09-25). Le « ⋯ », toujours visible au doigt, porte « Focus
                25 min » — la même fonction (règle 18). */}
            {(() => {
              // Le ▶ ne se montre que s'il AGIT (lancer, reprendre). Grisé, il
              // n'aurait rien dit : c'est l'entrée du « ⋯ » qui porte la raison.
              if (!gesteFocus || renommeId === task.id) return null;
              const { regle, libelle } = focusDeTache(gesteFocus, task, task.done);
              if (!focusPossible(regle)) return null;
              return (
                <button
                  type="button"
                  onClick={() => void gesteFocus.agir(task, task.done)}
                  data-tip={libelle}
                  data-tip-sub={regle.quoi === "reprendre" ? undefined : t("Démarre un pomodoro dédié à cette tâche.")}
                  aria-label={t("Focus sur {label}", { label: task.label })}
                  className="shrink-0 rounded-md p-1.5 text-text-dim opacity-0 transition-opacity hover:text-accent group-hover:opacity-100 focus-visible:opacity-100 [@media(pointer:coarse)]:hidden"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                    <path d="M8 5.14v13.72c0 .86.95 1.38 1.68.92l10.9-6.86a1.09 1.09 0 0 0 0-1.84L9.68 4.22A1.09 1.09 0 0 0 8 5.14Z" />
                  </svg>
                </button>
              );
            })()}
            {gestes && renommeId !== task.id && (
              <BoutonMenu
                visible
                onOuvrir={(e) => menu.ouvrirSousLeBouton(e, task)}
                ouvert={menu.ouvert && menu.cible?.id === task.id}
                libelle={t("Actions sur « {titre} »", { titre: task.label })}
              />
            )}
          </li>
        ))}
      </ul>

      {/* Dans un panneau de GRILLE, qui rogne ce qui déborde (`overflow: clip`) :
          c'est précisément pourquoi le menu vit dans un portail (PIEGES § 14.1). */}
      {gestes && (
        <MenuContextuel
          etat={menu}
          libelle={t("Actions sur « {titre} »", { titre: menu.cible?.label ?? "" })}
          entrees={(() => {
            const fraiche = menu.cible && tasks.find((x) => x.id === menu.cible!.id);
            return fraiche ? entreesTache(fraiche, gestes, { faite: fraiche.done, objectifs: goals ?? [], ia }) : [];
          })()}
        />
      )}
    </div>
  );
}
