import { useEffect, useMemo, useRef, useState } from "react";
import TaskModal from "../components/TaskModal";
import { recurrenceLabel, todayStr, todayTasks } from "../lib/logic";
import {
  addTag,
  deleteTag,
  basculerTache,
  renommerTache,
} from "../lib/repo";
import { CaseACocher, useCochesOptimistes } from "../components/CaseACocher";
import type { AppData, Tag, Task } from "../lib/types";
import { IconSearch, IconTrash, IconX } from "../components/icons";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";

import { t, tp } from "../lib/i18n";
import ConfirmationEnLigne from "../components/ConfirmationEnLigne";
import BadgeExemple from "../components/onboarding/BadgeExemple";
import { estExemple } from "../lib/onboarding/exemples";
import ChampDate from "../components/ChampDate";
import { consommerDemande } from "../lib/naviguer";
import MenuContextuel, { BoutonMenu } from "../components/menu/MenuContextuel";
import { useMenuContextuel } from "../components/menu/useMenuContextuel";
import { entreesTache, gestesCommunsTache, type GestesTache } from "../components/menu/catalogue/tache";

interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

type StatusFilter = "all" | "todo" | "done";

const PRIORITY_COLOR: Record<string, string> = {
  high: "var(--color-red)",
  medium: "var(--color-yellow)",
  low: "var(--color-text-dim)",
};

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

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

export default function TasksView({ data, refresh }: Props) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  /** La tâche dont le libellé est en cours de renommage, EN PLACE. */
  const [renommeId, setRenommeId] = useState<number | null>(null);
  const menu = useMenuContextuel<Task & { done: boolean }>();

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const today = todayStr();

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

  // action palette "Nouvelle tâche" → ouvre le formulaire
  useEffect(() => {
    const onNew = () => setCreating(true);
    window.addEventListener("sb:new-task", onNew);
    return () => window.removeEventListener("sb:new-task", onNew);
  }, []);

  const { etat, basculer } = useCochesOptimistes();
  const jourCoche = dateFilter || today;

  // done affiché : récurrente → faite aujourd'hui ; ponctuelle → déjà faite un jour
  const rows = useMemo(() => {
    const base = dateFilter
      ? todayTasks(data.tasks, data.completions, dateFilter)
      : data.tasks.map((t) => {
          const isRec = !!t.recurrence && t.recurrence !== "none";
          const done = isRec
            ? data.completions.some(
                (c) => c.task_id === t.id && c.date === today && c.done,
              )
            : data.completions.some((c) => c.task_id === t.id && c.done);
          return { ...t, done };
        });

    return base
      .map((x) => ({ ...x, done: etat(`t${x.id}:${jourCoche}`, x.done) }))
      .filter((t) => {
        if (status === "todo" && t.done) return false;
        if (status === "done" && !t.done) return false;
        if (tagFilter && t.tag !== tagFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority])
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return b.id - a.id;
      });
  }, [data, status, tagFilter, dateFilter, today, etat, jourCoche]);

  const tagColor = (name: string | null) =>
    data.tags.find((t) => t.name === name)?.color ?? "var(--color-blue)";

  const goalTitle = (goalId: number | null) =>
    goalId == null ? null : (data.goals.find((g) => g.id === goalId)?.title ?? null);

  // avec filtre date, on coche pour ce jour-là ; sinon pour aujourd'hui.
  // ⚠️ Décocher une PONCTUELLE efface toutes ses coches (`basculerTache`) :
  // sans filtre, elle s'affiche faite dès qu'un jour quelconque la dit faite.
  const handleToggle = (task: Task & { done: boolean }) =>
    basculer(`t${task.id}:${jourCoche}`, task.done, async (fait) => {
      await basculerTache(task, jourCoche, fait);
      await refresh();
    });

  /**
   * ⭐ Les gestes du menu contextuel — et du bouton « ⋯ », qui en est le jumeau.
   * Chacun est la fonction du geste qui existait déjà (règle 18) : la case,
   * le crayon, et pour le reste les gestes communs aux vues qui montrent une
   * tâche (`catalogue/tache.tsx`).
   *
   * La suppression part désormais à la CORBEILLE, avec « Annuler » : le
   * double-clic de confirmation protégeait d'un geste irréversible qui ne
   * l'est plus. La tâche garde son historique de coches — il reviendra avec
   * elle.
   */
  const gestes: GestesTache = {
    ...gestesCommunsTache(refresh),
    basculer: (task) => void handleToggle(task as Task & { done: boolean }),
    renommer: (task) => setRenommeId(task.id),
    modifier: (task) => setEditing(task),
  };
  const handleDelete = (task: Task) => gestes.supprimer(task);

  const validerRenommage = async (task: Task, libelle: string) => {
    setRenommeId(null);
    if (libelle.trim() && libelle.trim() !== task.label) {
      await renommerTache(task.id, libelle);
      await refresh();
    }
  };

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
      setTagASupprimer(tag);
      return;
    }
    await effacerTag(tag);
  };

  const chip = (active: boolean) =>
    `pill border px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "border-text/30 bg-surface-2 text-text"
        : "border-border text-text-dim hover:text-text"
    }`;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="view-head">
        <h1 className="text-3xl text-text">{t("Tâches")}</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          data-tip={t("Nouvelle tâche")}
          data-tip-sub={t("Libellé, tag, priorité, récurrence et objectif lié.")}
          className="pill fill-primary px-4 py-2 text-sm font-semibold"
        >
          {t("+ Nouvelle tâche")}
        </button>
      </header>

      {/* Filtres */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              /* ⚠️ Les TROIS passent par `t()`. Deux ne le faisaient pas —
                 « Toutes » et « Faites » s'affichaient en français dans l'app
                 anglaise, à côté d'un « To do » traduit. Vu à l'écran le
                 2026-09-18, et invisible pour les deux outils : `i18n:check` ne
                 voit que les clés ÉCRITES, et `i18n:durs` « ne suit pas la
                 donnée » — ces libellés vivent dans un tableau, donc il les
                 range en « entrées de table » (PIEGES § 5.2 bis). */
              ["all", t("Toutes"), t("Toutes les tâches du jour, faites ou non.")],
              ["todo", t("À faire"), t("Uniquement celles qui restent à faire.")],
              ["done", t("Faites"), t("Uniquement celles déjà cochées.")],
            ] as [StatusFilter, string, string][]
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              data-tip={label}
              data-tip-sub={hint}
              className={chip(status === value)}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="mx-1 h-4 w-px bg-border" />

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            data-tip={t("Tous les tags")}
            data-tip-sub={t("Retire le filtre par tag.")}
            className={chip(tagFilter === null)}
          >
            {t("Tous les tags")}
          </button>
          {data.tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => setTagFilter(tagFilter === tag.name ? null : tag.name)}
              data-tip={tag.name}
              data-tip-sub={
                tagFilter === tag.name ? t("Retirer ce filtre.") : t("N’afficher que les tâches de ce tag.")
              }
              className="pill border px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                tagFilter === tag.name
                  ? {
                      borderColor: tag.color,
                      backgroundColor: `color-mix(in srgb, ${tag.color} 16%, transparent)`,
                      color: tag.color,
                    }
                  : { borderColor: "var(--color-border)", color: "var(--color-text-dim)" }
              }
            >
              {tag.name}
            </button>
          ))}
        </div>

        <span className="mx-1 h-4 w-px bg-border" />

        {/* ⚠️ Le libellé « échéance » n'est pas décoratif, il rend le contrôle
            IDENTIFIABLE. Un `<input type="date">` VIDE n'affichait rien du tout
            sur iOS — pas même le gabarit `jj/mm/aaaa` que rend le bureau. Vu à
            l'écran sur iPhone 17 le 2026-08-27 : un rectangle gris muet au
            milieu des filtres, dont rien ne disait ce qu'il était.

            ⚠️ Et ce n'était PAS une affaire de `color-scheme`, contrairement à
            ce que la première hypothèse disait : vérifié en ouvrant un
            `<select>` voisin, iOS rend son panneau natif en clair même sous un
            `color-scheme: dark` figé.

            ⭐ 2026-09-18 : le champ natif a disparu de toute l'app au profit de
            `ChampDate`, qui écrit sa valeur en clair — donc le défaut du
            rectangle muet n'existe plus. Le libellé reste pour une AUTRE
            raison : dire ce que la date filtre. */}
        {/* ⭐ Le libellé « échéance » RESTE, même si le bouton n'est plus muet :
            dans une rangée de filtres, il dit ce que la date filtre — et non
            simplement qu'une date se choisit ici. `ChampDate` porte déjà
            l'icône de calendrier, donc elle n'est plus doublée. */}
        <span className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface-2 px-2 py-1 focus-within:border-blue">
          <span className="hud-label shrink-0">{t("échéance")}</span>
          <ChampDate
            valeur={dateFilter}
            onChange={setDateFilter}
            aria={t("échéance")}
            placeholder={t("toutes dates")}
            tip={t("Tâches dues à cette date")}
            className="cible-tactile-ligne flex min-w-0 items-center gap-1.5 bg-transparent text-xs text-text outline-none"
          />
        </span>
        {dateFilter && (
          <button
            type="button"
            onClick={() => setDateFilter("")}
            data-tip={t("Effacer le filtre de date")}
            className="inline-flex items-center gap-1 text-xs text-text-dim hover:text-text"
          >
            <IconX className="h-3 w-3" /> {t("effacer")}
          </button>
        )}
      </div>

      <ResizableGrid gridId="tasks" className="mt-4">
      {/* Liste */}
      <ResizablePanel id="tasks-list" defaultW={12} minH={240}>
      <section className="card">
        <ul className="panel-scroll flex flex-col p-2">
          {rows.length === 0 && (
            <li className="py-10 text-center text-sm text-text-dim">
              {t("Aucune tâche ne correspond à ces filtres.")}
            </li>
          )}
          {rows.map((task) => (
            /* ⚠️ Clic droit et touches de LIGNE sur le <li> : ils marchent que le
               focus soit sur la case, sur un bouton ou sur « ⋯ ». F2 renomme
               (c'est ce qu'annonce le menu), Maj+F10 / touche Menu ouvre le
               menu — macOS ne le fait pas tout seul (PIEGES § 19.2). */
            <li
              key={task.id}
              className="group group/ligne flex items-center gap-3 rounded-[10px] px-3 py-2.5 hover:bg-surface-2"
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
                cochee={task.done}
                onBascule={() => void handleToggle(task)}
                libelle={task.label}
                tip={task.done ? t("Marquer à faire") : t("Marquer faite")}
                tipSub={t("Compte dans la discipline du jour.")}
              />

              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: PRIORITY_COLOR[task.priority] }}
                title={t("Priorité {p}", { p: task.priority })}
              />

              {/* min-w-0 + clamp : un libellé long se coupe proprement au lieu
                  de pousser les chips hors de la carte. */}
              {renommeId === task.id ? (
                /* ⭐ RENOMMER EN PLACE, jamais dans une fenêtre (cahier des
                   charges, § 7). Entrée valide, Échap annule, quitter le champ
                   valide — comme un nom de fichier dans le Finder. */
                <input
                  autoFocus
                  defaultValue={task.label}
                  aria-label={t("Nouveau nom de la tâche")}
                  onFocus={(e) => e.currentTarget.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void validerRenommage(task, e.currentTarget.value);
                    } else if (e.key === "Escape") {
                      // On MARQUE la touche : Échap ne doit rien fermer d'autre.
                      e.preventDefault();
                      e.stopPropagation();
                      setRenommeId(null);
                    }
                  }}
                  onBlur={(e) => void validerRenommage(task, e.currentTarget.value)}
                  className="min-w-0 flex-1 rounded-md border border-blue bg-surface px-2 py-0.5 text-sm text-text focus:outline-none"
                />
              ) : (
                <span
                  className={`clamp-2 min-w-0 flex-1 text-sm ${task.done ? "text-text-dim line-through" : "text-text"}`}
                  title={task.label}
                >
                  {task.label}
                </span>
              )}

              {estExemple(task) && <BadgeExemple />}

              {recurrenceLabel(task.recurrence) && (
                <span className="pill shrink-0 bg-surface-2 px-2 py-0.5 text-[11px] text-text-dim">
                  ↻ {recurrenceLabel(task.recurrence)}
                </span>
              )}

              {goalTitle(task.goal_id) && (
                <span
                  className="pill max-w-[28%] shrink-0 truncate border border-blue/30 bg-blue/10 px-2 py-0.5 text-[11px] font-medium text-blue"
                  title={t("Rattachée à l'objectif « {title} »", { title: goalTitle(task.goal_id) ?? "" })}
                >
                  ◎ {goalTitle(task.goal_id)}
                </span>
              )}

              {task.tag && (
                <span
                  className="pill max-w-[28%] shrink-0 truncate px-2 py-0.5 text-[11px] font-medium"
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

              {/* Au survol, deux accélérateurs pour la souris. Au doigt, ils
                  s'effacent : le « ⋯ » juste après porte les mêmes gestes, et
                  il est TOUJOURS visible (règle 17). */}
              <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 [@media(pointer:coarse)]:hidden">
                <button
                  type="button"
                  onClick={() => setEditing(task)}
                  data-tip={t("Modifier la tâche")}
                  className="rounded-md p-1.5 text-text-dim hover:bg-surface hover:text-text"
                  aria-label={t("Modifier")}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(task)}
                  className="rounded-md p-1.5 text-text-dim transition-colors hover:bg-surface hover:text-red"
                  aria-label={t("Supprimer")}
                  data-tip={t("Supprimer la tâche")}
                  data-tip-sub={t("Elle reste 30 jours dans Supprimés récemment, avec son historique.")}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              </span>
              <BoutonMenu
                onOuvrir={(e) => menu.ouvrirSousLeBouton(e, task)}
                ouvert={menu.ouvert && menu.cible?.id === task.id}
                libelle={t("Actions sur « {titre} »", { titre: task.label })}
              />
            </li>
          ))}
        </ul>
      </section>
      </ResizablePanel>

      {/* Tags */}
      <ResizablePanel id="tasks-tags" defaultW={12}>
      <section className="card p-5">
        <h2 className="mb-3 hud-label">
          Tags
        </h2>
        <div className="flex flex-wrap items-center gap-2">
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
                className="opacity-60 hover:opacity-100"
                aria-label={t("Supprimer le tag {name}", { name: tag.name })}
                data-tip={t("Supprimer le tag « {name} »", { name: tag.name })}
                data-tip-sub={t("Les tâches concernées sont conservées, simplement sans tag.")}
              >
                <IconX className="h-3 w-3" />
              </button>
            </span>
          ))}

          {tagASupprimer && (
            <ConfirmationEnLigne
              className="basis-full"
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
            className="flex min-w-0 flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleAddTag();
            }}
          >
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder={t("Nouveau tag…")}
              className="w-36 min-w-0 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
            />
            <span className="flex flex-wrap gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTagColor(c)}
                  className={`h-5 w-5 rounded-full transition-transform ${
                    newTagColor === c ? "scale-110 ring-2 ring-blue" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={t("Couleur {name}", { name: c })}
                  data-tip={t("Couleur du tag")}
                />
              ))}
            </span>
            <button
              type="submit"
              disabled={!newTagName.trim()}
              className="pill bg-surface-2 px-3 py-1.5 text-xs font-medium text-text disabled:opacity-40"
            >
              {t("Ajouter")}
            </button>
          </form>
        </div>
      </section>
      </ResizablePanel>
      </ResizableGrid>

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

      {/* ⭐ UN SEUL menu pour toute la liste. Les entrées sont recalculées depuis
          les lignes FRAÎCHES : si la synchronisation retire la tâche pendant que
          le menu est ouvert, le tableau devient vide et le menu se ferme seul. */}
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

      <MenuContextuel
        etat={menu}
        libelle={t("Actions sur « {titre} »", { titre: menu.cible?.label ?? "" })}
        entrees={(() => {
          const fraiche = menu.cible && rows.find((r) => r.id === menu.cible!.id);
          return fraiche ? entreesTache(fraiche, gestes, { faite: fraiche.done, objectifs: data.goals }) : [];
        })()}
      />
    </div>
  );
}
