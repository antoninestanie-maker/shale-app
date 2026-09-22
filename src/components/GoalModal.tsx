import { useEffect, useState } from "react";
import { descendantIds } from "../lib/logic";
import { niveauDe } from "../lib/objectifs/structure";
import { createGoal, createTask, updateGoal, type GoalInput } from "../lib/repo";
import {
  etapesACreer,
  lignesAffichees,
  lignesUtiles,
  tachesACreer,
  tachesAffichees,
  type LigneTache,
} from "../lib/objectifs/creation";
import type { Goal } from "../lib/types";

import { t } from "../lib/i18n";
import ChampDate from "./ChampDate";
interface Props {
  goal: Goal | null; // null = création
  goals: Goal[];
  defaultParentId?: number | null; // pré-rempli via t("+ sous-objectif")
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
  const [saving, setSaving] = useState(false);

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
  // est une racine ou un jalon. Le parent ACTUEL reste proposé même s'il ne
  // l'est plus — une arborescence d'avant la 026 ne doit pas perdre son lien
  // parce qu'on corrige un titre.
  const parentOptions = goals.filter(
    (g) =>
      !forbidden.has(g.id) &&
      (g.id === goal?.parent_goal_id || niveauDe(g, goals) === 0 || (!!g.is_milestone && niveauDe(g, goals) === 1)),
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
    } else {
      // ⚠️ L'ORDRE COMPTE : les étapes et les tâches ont besoin de l'`id` de la
      // racine, qui n'existe qu'une fois la ligne écrite. Aucune transaction
      // (`repo.ts` n'en expose pas) : une interruption laisse un objectif
      // partiellement garni, visible et modifiable — jamais une donnée
      // fantôme.
      const racineId = await createGoal(input);
      const base = { scope: input.scope, category: input.category };
      for (const etape of etapesACreer(base, etapes, racineId)) await createGoal(etape);
      for (const t of tachesACreer(taches, racineId)) await createTask(t);
    }
    await onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      {/* ⚠️ `vh` MULTIPLIÉ par `--zoom-inv` : le `zoom` CSS de la densité
          multiplie aussi les unités de viewport, donc `90vh` vaut 1 170 px dans
          une fenêtre de 900 à densité « Large » — la fenêtre dépasserait
          l'écran (règle du 2026-08-28).

          ⚠️ Et 78vh AU DOIGT, pas 90 : la barre d'onglets du téléphone est en
          `fixed` PAR-DESSUS (80 px environ). Mesuré sur iPhone 390 × 844 le
          2026-09-20 : à 90vh, le pied de la fenêtre — donc le bouton
          « Créer » — passait sous la barre. 78vh est la valeur que `MobileNav`
          applique déjà à sa propre feuille, pour exactement cette raison. */}
      <div
        className="card max-h-[calc(90vh*var(--zoom-inv))] w-full max-w-md overflow-y-auto bg-surface p-6 [@media(pointer:coarse)]:max-h-[calc(78vh*var(--zoom-inv))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg text-text">
          {goal ? t("Modifier l'objectif") : t("Nouvel objectif")}
        </h2>

        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
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
              placeholder={t("ex. Trading, Formation, Santé… (optionnel)")}
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

              <p className="mb-1 mt-3 text-xs font-medium text-text-dim">
                {t("Premières étapes")}
                {nbEtapes > 0 && <span className="ml-1.5 text-text-dim/70">{nbEtapes}</span>}
              </p>
              {/* ⚠️ L'ORDRE DU DOM EST L'ORDRE DES LIGNES : c'est lui que
                  `Entrée` suit pour descendre d'un champ. Un conteneur marqué
                  plutôt qu'un tableau de refs — le même geste vaut pour les
                  tâches, juste dessous. */}
              <div data-lignes className="flex flex-col gap-1.5">
                {lignesEtapes.map((valeur, i) => (
                  <input
                    key={i}
                    value={valeur}
                    onChange={(e) =>
                      setEtapes(lignesEtapes.map((v, k) => (k === i ? e.target.value : v)))
                    }
                    onKeyDown={ligneSuivante(i)}
                    placeholder={i === 0 ? t("ex. Préparer le plan de trading") : t("Étape suivante…")}
                    aria-label={t("Étape {n}", { n: i + 1 })}
                    className="w-full rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
                  />
                ))}
              </div>

              <p className="mb-1 mt-3 text-xs font-medium text-text-dim">
                {t("Premières tâches")}
                {nbTaches > 0 && <span className="ml-1.5 text-text-dim/70">{nbTaches}</span>}
              </p>
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
                      placeholder={i === 0 ? t("ex. Backtester 1 h") : t("Tâche suivante…")}
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
              <p className="mt-1.5 text-[11px] text-text-dim">
                {t("Les tâches naissent rattachées à l’objectif : elles comptent dans son avancement, et leur échéance les fait apparaître dans le calendrier.")}
              </p>
            </div>
          )}

          <div className="mt-2 flex justify-end gap-2">
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
