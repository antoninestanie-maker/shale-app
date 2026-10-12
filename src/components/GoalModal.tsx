import { useEffect, useState } from "react";
import { descendantIds } from "../lib/logic";
import { peutRangerSous } from "../lib/objectifs/structure";
import { createGoal, createTask, majFeuilleDeRoute, updateGoal, type GoalInput } from "../lib/repo";
import { prioriteDe } from "../lib/priorite";
import { ChoixPriorite } from "./Priorite";
import {
  etapesACreer,
  lignesAffichees,
  lignesUtiles,
  tachesACreer,
  tachesAffichees,
  type LigneTache,
} from "../lib/objectifs/creation";
import type { Goal, Priority } from "../lib/types";

import { t } from "../lib/i18n";
import ChampDate from "./ChampDate";
interface Props {
  goal: Goal | null; // null = création
  goals: Goal[];
  defaultParentId?: number | null; // l'objectif sous lequel la ligne naît, s'il est déjà connu
  onClose: () => void;
  onSaved: () => Promise<void>;
}

/** Libellés français, traduits à l'affichage — cf. `GoalsView`. */
const SCOPES: { value: Goal["scope"]; label: string }[] = [
  { value: "short", label: "Court terme" },
  { value: "medium", label: "Moyen terme" },
  { value: "long", label: "Long terme" },
];

export default function GoalModal({
  goal,
  goals,
  defaultParentId = null,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [scope, setScope] = useState<Goal["scope"]>(goal?.scope ?? "short");
  const [category, setCategory] = useState(goal?.category ?? "");
  const [parentId, setParentId] = useState<number | null>(
    goal?.parent_goal_id ?? defaultParentId,
  );

  // Catégories déjà utilisées → suggestions (datalist), sans doublon.
  const knownCategories = Array.from(
    new Set(
      goals
        .map((g) => g.category?.trim())
        .filter((c): c is string => !!c),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  // ⭐ Un objectif NEUF naît mesuré (décision d'Antonin, 2026-09-14) : la barre
  // manuelle cesse d'être le défaut. Un objectif existant garde son réglage —
  // aucun chiffre ne bouge sans un geste. Et la base garde son DEFAULT 1 de la
  // 001 : c'est l'app qui écrit la colonne, toujours.
  const [manual, setManual] = useState((goal?.manual_progress ?? 0) === 1);
  const [progress, setProgress] = useState(goal?.progress_pct ?? 0);
  const [priorite, setPriorite] = useState<Priority>(prioriteDe(goal ?? {}));
  const [saving, setSaving] = useState(false);
  /**
   * ⭐ La priorité n'a de sens que pour une ÉTAPE (2026-09-30) : un objectif
   * racine n'a pas de sœur à devancer. Elle s'affiche dès qu'un parent est
   * choisi — y compris quand on range un objectif sous un autre.
   */
  const estEtape = parentId != null;

  /**
   * ⭐ LE PREMIER JET — des étapes et des tâches, dans l'écran qui crée
   * l'objectif. Demande d'Antonin, 2026-09-20.
   *
   * ⚠️ À LA CRÉATION SEULEMENT. Sur un objectif existant, ces deux listes
   * feraient un second chemin d'ajout à côté de la feuille de route, qui le
   * fait déjà mieux (elle enchaîne à l'infini, elle sait promouvoir une phase,
   * elle rattache l'existant) : deux chemins pour une même écriture finissent
   * par diverger. La fenêtre de MODIFICATION reste donc ce qu'elle était.
   *
   * ⚠️ Et tout est OPTIONNEL : un titre et `Entrée` créent toujours un objectif
   * nu, au même coût qu'avant (règle tenue depuis le 2026-09-16).
   */
  const [etapes, setEtapes] = useState<string[]>([""]);
  const [taches, setTaches] = useState<LigneTache[]>([{ nom: "", echeance: "" }]);
  const lignesEtapes = lignesAffichees(etapes);
  const lignesTaches = tachesAffichees(taches);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⚠️ Une couche AU-DESSUS a déjà traité la touche : elle l'a marquée.
      // Sans ce garde, un seul Échap ferme DEUX étages d'un coup — et si
      // l'étage du dessous est un formulaire, la saisie part avec.
      // Convention posée par KnowledgeView le 2026-08-26, généralisée ici
      // le 2026-08-28 après l'avoir reproduite : ⌘K par-dessus une tâche.
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // parents interdits : soi-même et ses descendants (cycles)
  const forbidden = goal ? descendantIds(goal.id, goals) : new Set<number>();
  if (goal) forbidden.add(goal.id);
  // Trois niveaux au plus (`lib/objectifs/structure.ts`) : un parent possible
  // est un objectif ou une de ses étapes, tant que ce qui pend sous la ligne
  // qu'on range y tient (2026-10-12 : plus besoin que le parent soit une
  // « phase » déclarée, il le devient en recevant une étape). Le parent ACTUEL
  // reste proposé même s'il ne l'est plus — une arborescence d'avant la 026 ne
  // doit pas perdre son lien parce qu'on corrige un titre.
  const parentOptions = goals.filter(
    (g) => !forbidden.has(g.id) && (g.id === goal?.parent_goal_id || peutRangerSous(g, goal, goals)),
  );

  const nbEtapes = lignesUtiles(etapes).length;
  const nbTaches = tachesACreer(taches, 0).length;

  /**
   * `Entrée` dans une ligne du premier jet DESCEND d'un champ, elle ne soumet
   * pas le formulaire.
   *
   * ⚠️ Sans `preventDefault`, la soumission implicite du `<form>` créerait
   * l'objectif au milieu de la saisie des étapes — en emportant les lignes déjà
   * tapées, mais pas celle qu'on écrivait.
   */
  const ligneSuivante = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const champs = e.currentTarget
      .closest("[data-lignes]")
      ?.querySelectorAll<HTMLInputElement>("input");
    champs?.[i + 1]?.focus();
  };

  const canSave = title.trim().length > 0 && !saving;

  /**
   * Ranger une ligne sous une ÉTAPE en fait une phase. L'écran le sait déjà (il
   * nomme d'après le contenu) ; on tient la colonne `is_milestone` d'accord
   * pour un appareil resté sur une version d'avant le 2026-10-12 — la même
   * écriture que `lib/objectifs/ajouter.ts`.
   */
  const promouvoirParent = async () => {
    const parent = parentId == null ? null : goals.find((g) => g.id === parentId);
    if (parent && parent.parent_goal_id != null && !parent.is_milestone) {
      await majFeuilleDeRoute(parent.id, { is_milestone: 1 });
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const input: GoalInput = {
      title: title.trim(),
      description: description.trim() || null,
      scope,
      category: category.trim() || null,
      parent_goal_id: parentId,
      deadline: deadline || null,
      progress_pct: progress,
      manual_progress: manual ? 1 : 0,
    };
    if (goal) {
      await updateGoal(goal.id, input);
      // ⚠️ Pas par `updateGoal`, qui n'écrit que la fiche et ne connaît pas la
      // priorité (même règle que la feuille de route, `majFeuilleDeRoute`).
      if (estEtape && priorite !== prioriteDe(goal)) await majFeuilleDeRoute(goal.id, { priority: priorite });
      await promouvoirParent();
    } else {
      // ⚠️ L'ORDRE COMPTE : les étapes et les tâches ont besoin de l'`id` de la
      // racine, qui n'existe qu'une fois la ligne écrite. Aucune transaction
      // (`repo.ts` n'en expose pas) : une interruption laisse un objectif
      // partiellement garni, visible et modifiable — jamais une donnée
      // fantôme.
      const racineId = await createGoal(estEtape ? { ...input, priority: priorite } : input);
      await promouvoirParent();
      const base = { scope: input.scope, category: input.category };
      for (const etape of etapesACreer(base, etapes, racineId)) await createGoal(etape);
      for (const t of tachesACreer(taches, racineId)) await createTask(t);
    }
    await onSaved();
  };

  return (
    <div
      className="fenetre-voile fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      {/* ⭐ Le pied reste, le corps défile — `.fenetre` dans `index.css`
          (2026-10-12, crible du labo, constat 20). La carte entière défilait
          jusque-là, « Créer » compris : avec une étape et une tâche, le bouton
          passait sous le bas de la fenêtre à 900 px de haut, et sous la barre
          d'onglets au téléphone. La borne de hauteur (les anciens `90vh` et
          `78vh au doigt`) est maintenant celle du voile. */}
      <div
        className="card fenetre w-full max-w-md bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg text-text">
          {goal ? (estEtape ? t("Modifier l'étape") : t("Modifier l'objectif")) : t("Nouvel objectif")}
        </h2>

        <form
          className="fenetre-colonne mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="fenetre-corps flex flex-col gap-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("Titre de l'objectif")}
            className="w-full rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("Description (optionnel)")}
            rows={2}
            className="w-full resize-none rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
          />

          {estEtape && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Priorité")}</p>
              <ChoixPriorite valeur={priorite} onChange={setPriorite} />
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">Horizon</p>
            <div className="flex gap-1.5">
              {SCOPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setScope(s.value)}
                  className={`pill border px-3 py-1.5 text-xs font-medium transition-colors ${
                    scope === s.value
                      ? "border-text/30 bg-surface-2 text-text"
                      : "border-border text-text-dim hover:text-text"
                  }`}
                >
                  {t(s.label)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Catégorie")}</p>
            <input
              list="goal-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t("ex. Formation, Santé, Finances… (optionnel)")}
              className="w-full rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
            />
            <datalist id="goal-categories">
              {knownCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {knownCategories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {knownCategories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(category === c ? "" : c)}
                    className={`pill border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      category.trim() === c
                        ? "border-blue bg-blue/15 text-blue"
                        : "border-border text-text-dim hover:text-text"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="auto-tiles gap-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">
                {t("Objectif parent")}
              </p>
              <select
                value={parentId ?? ""}
                onChange={(e) =>
                  setParentId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus:border-blue focus:outline-none"
              >
                <option value="">{t("Aucun")}</option>
                {parentOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">
                Deadline
              </p>
              <ChampDate
                valeur={deadline}
                onChange={setDeadline}
                aria={t("Deadline")}
                placeholder={t("Sans date")}
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-text-dim">{t("Progression")}</p>
              <button
                type="button"
                onClick={() => setManual(!manual)}
                className={`pill border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  manual
                    ? "border-border text-text-dim"
                    : "border-blue bg-blue/15 text-blue"
                }`}
              >
                {manual ? t("saisie à la main") : t("mesurée")}
              </button>
            </div>
            {manual ? (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="flex-1 accent-[var(--color-blue)]"
                />
                <span className="w-12 text-right font-display text-sm font-bold text-text">
                  {progress}%
                </span>
              </div>
            ) : (
              <p className="text-xs text-text-dim">
                {t("Mesurée sur ce qui est fait : ses étapes, ses tâches, ses nombres à atteindre.")}
              </p>
            )}
          </div>

          {/* ⭐ LE PREMIER JET, à la création seulement — voir l'état `etapes`. */}
          {!goal && (
            <div className="rounded-[12px] border border-border bg-surface-2/40 p-3">
              <p className="hud-label">{t("Par quoi commencer")}</p>
              <p className="mt-0.5 text-[11px] text-text-dim">
                {t("Facultatif : tout se complète ensuite dans la feuille de route.")}
              </p>

              {/* ⭐ LES TÂCHES D'ABORD (2026-10-12). Antonin : « cocher une étape
                  sans tâche n'a pas tellement de sens. Dans ce cas, l'étape est
                  une tâche. » Ce qu'on a à faire se saisit donc en premier ; les
                  étapes viennent ensuite, pour qui veut regrouper. Chaque
                  intitulé dit lequel est lequel — sans phrase d'aide : celle
                  qui était écrite sous les tâches attend dans leur bulle. */}
              <p
                className="mb-1 mt-3 text-xs font-medium text-text-dim"
                data-tip={t("Elles comptent dans l’avancement de l’objectif")}
                data-tip-sub={t("Avec une échéance, elles paraissent dans le Calendrier et dans Aujourd’hui.")}
                data-tip-attente="longue"
              >
                {t("Tâches · ce qu’il y a à faire")}
                {nbTaches > 0 && <span className="ml-1.5 text-text-dim/70">{nbTaches}</span>}
              </p>
              {/* ⚠️ L'ORDRE DU DOM EST L'ORDRE DES LIGNES : c'est lui que
                  `Entrée` suit pour descendre d'un champ. Un conteneur marqué
                  plutôt qu'un tableau de refs — le même geste vaut pour les
                  étapes, juste dessous. */}
              <div data-lignes className="flex flex-col gap-1.5">
                {lignesTaches.map((ligne, i) => (
                  /* ⚠️ `flex-wrap` ET une base flex sur le nom : sur iPhone, le
                     champ de date passe à la ligne au lieu de comprimer le nom
                     jusqu'à une lettre par ligne (règle du 2026-07-26). */
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    <input
                      value={ligne.nom}
                      onChange={(e) =>
                        setTaches(
                          lignesTaches.map((x, k) => (k === i ? { ...x, nom: e.target.value } : x)),
                        )
                      }
                      onKeyDown={ligneSuivante(i)}
                      placeholder={i === 0 ? t("ex. Réviser 1 h") : t("Tâche suivante…")}
                      aria-label={t("Tâche {n}", { n: i + 1 })}
                      className="min-w-0 flex-1 basis-[9rem] rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
                    />
                    <ChampDate
                      valeur={ligne.echeance}
                      onChange={(v) =>
                        setTaches(lignesTaches.map((x, k) => (k === i ? { ...x, echeance: v } : x)))
                      }
                      aria={t("Échéance de la tâche {n}", { n: i + 1 })}
                      placeholder={t("Sans échéance")}
                      /* ⚠️ Largeur FIXE, et c'est de l'alignement, pas du
                         zèle : le libellé du champ de date change de longueur
                         avec la date (« Demain », « mer. 24 sept. »), et sans
                         largeur posée chaque rangée de tâche décalait son nom
                         d'une dizaine de pixels par rapport à la précédente.
                         Le libellé tronque déjà (`truncate` dans `ChampDate`). */
                      className="cible-tactile-ligne flex w-[10.5rem] shrink-0 items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-left text-sm text-text transition-colors hover:border-border-strong focus:border-blue focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <p className="mb-1 mt-3 text-xs font-medium text-text-dim">
                {t("Étapes · pour regrouper des tâches")}
                {nbEtapes > 0 && <span className="ml-1.5 text-text-dim/70">{nbEtapes}</span>}
              </p>
              <div data-lignes className="flex flex-col gap-1.5">
                {lignesEtapes.map((valeur, i) => (
                  <input
                    key={i}
                    value={valeur}
                    onChange={(e) =>
                      setEtapes(lignesEtapes.map((v, k) => (k === i ? e.target.value : v)))
                    }
                    onKeyDown={ligneSuivante(i)}
                    placeholder={i === 0 ? t("ex. Préparation") : t("Étape suivante…")}
                    aria-label={t("Étape {n}", { n: i + 1 })}
                    className="w-full rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
                  />
                ))}
              </div>
            </div>
          )}

          </div>

          <div className="fenetre-pied mt-[10px] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="pill px-4 py-2 text-sm font-medium text-text-dim hover:text-text"
            >
              {t("Annuler")}
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="pill fill-primary px-5 py-2 text-sm font-semibold disabled:opacity-40"
            >
              {goal ? t("Enregistrer") : t("Créer")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
