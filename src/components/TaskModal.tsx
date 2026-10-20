import { useEffect, useRef, useState } from "react";
import {
  ORDRE_SEMAINE,
  nomCourtDuJour,
  parseRecurrence,
  serialiserRecurrence,
  type ModeRecurrence,
} from "../lib/logic";
import { changerEtatTache, createTask, updateTask, type TaskInput } from "../lib/repo";
import { DUREE_DEFAUT_MIN, finApres, minutesDe } from "../lib/calendrier/agenda";
import { changerEtat, etatDe, planificationDeSaisie } from "../lib/taches";
import { todayStr } from "../lib/logic";
import RouletteHeure from "./calendrier/RouletteHeure";
import type { EtatTache, Goal, Priority, Tag, Task } from "../lib/types";

import { t } from "../lib/i18n";
import ChampDate from "./ChampDate";
import { ChoixPriorite } from "./Priorite";
import CiteDans from "./liens/CiteDans";
import { uidDeLigne } from "../lib/objectifs/progression";
import { poserGarde } from "../lib/saisieGardee";
interface Props {
  task: Task | null; // null = création
  tags: Tag[];
  goals: Goal[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

/** Les états qu'on choisit ici (migration 031). ⚠️ Une fonction : `t()` à l'affichage. */
const choixEtats = (): { value: EtatTache; label: string }[] => [
  { value: "todo", label: t("À faire") },
  { value: "doing", label: t("En cours") },
  { value: "waiting", label: t("En attente") },
  { value: "dropped", label: t("Abandonnée") },
];

const recModes = (): { value: ModeRecurrence; label: string }[] => [
  { value: "none", label: t("Une fois") },
  { value: "daily", label: t("Quotidien") },
  { value: "weekdays", label: t("Lun–ven") },
  { value: "custom", label: t("Jours précis") },
];

export default function TaskModal({ task, tags, goals, onClose, onSaved }: Props) {
  const parsed = parseRecurrence(task?.recurrence ?? null);
  const [label, setLabel] = useState(task?.label ?? "");
  const [tag, setTag] = useState<string | null>(task?.tag ?? null);
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [recMode, setRecMode] = useState<ModeRecurrence>(parsed.mode);
  const [days, setDays] = useState<number[]>(parsed.jours);
  const [goalId, setGoalId] = useState<number | null>(task?.goal_id ?? null);
  /** L'état (031) — seulement en modification : une tâche naît « à faire ». */
  const [etat, setEtat] = useState<EtatTache>(task ? etatDe(task) : "todo");
  const [attenteDe, setAttenteDe] = useState(task?.waiting_for ?? "");
  const [relance, setRelance] = useState(task?.follow_up_on ?? "");
  /**
   * ⭐ LA DATE D'UNE TÂCHE, ENFIN SAISISSABLE ICI.
   *
   * `tasks` porte `due_date`, `start_at` et `end_at` depuis la migration 020,
   * mais AUCUNE interface ne les renseignait : le seul chemin était de glisser
   * la tâche sur le calendrier. Antonin : « pour les tâches on ne peut pas
   * saisir de date ».
   *
   * ⚠️ ET LEUR ABSENCE ICI LES EFFAÇAIT. `updateTask` écrit `due_date = $6`
   * sans condition ; ce formulaire ne les envoyait pas, donc renommer une tâche
   * qu'on avait posée sur le calendrier lui retirait sa date et son créneau,
   * en silence. Le mode démo ne pouvait pas le montrer — son `updateTask` fait
   * un `Object.assign`, qui ignore une clé absente au lieu de la vider.
   */
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [debut, setDebut] = useState(task?.start_at ?? "");
  const [fin, setFin] = useState(task?.end_at ?? "");
  /** Repliée par défaut, comme dans le formulaire d'événement. */
  const [roulette, setRoulette] = useState(false);
  const [saving, setSaving] = useState(false);

  /**
   * ⭐ ÉCHAP NE JETTE PLUS UNE SAISIE SANS DEMANDER (2026-10-20, audit,
   * constat 39 — Rémi : « Brouillon interrompu par Échap », rouvert vide).
   *
   * Tant que rien n'a changé, Échap et le clic sur le voile ferment comme
   * avant. Dès qu'un champ a bougé, ils demandent d'abord, dans le pied de la
   * fenêtre : « Ne pas garder » (qui prend le focus : Entrée confirme) ou
   * « Continuer » (Échap, une seconde fois, revient à la saisie). « Annuler »,
   * lui, est un geste explicite : il ferme sans demander.
   */
  const instantane = JSON.stringify([
    label.trim(),
    tag,
    priority,
    recMode,
    [...days].sort(),
    goalId,
    etat,
    attenteDe,
    relance,
    dueDate,
    debut,
    fin,
  ]);
  const depart = useRef(instantane);
  const modifie = instantane !== depart.current;
  const [confirmer, setConfirmer] = useState(false);
  const boutonAbandon = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmer) boutonAbandon.current?.focus();
  }, [confirmer]);
  const demanderFermeture = () => {
    if (!modifie) return onClose();
    // Une question posée ici ne reprend aucune navigation suspendue.
    apresAbandon.current = null;
    setConfirmer(true);
  };
  const fermeture = useRef({ demanderFermeture, confirmer });
  fermeture.current = { demanderFermeture, confirmer };
  /**
   * ⭐ Modifiée, la fenêtre garde aussi la NAVIGATION (2026-10-21, lot 6 ;
   * `lib/saisieGardee.ts`) : au téléphone, toucher un onglet pendant la saisie
   * pose la même question ; « Ne pas garder » ferme puis reprend la navigation.
   */
  const apresAbandon = useRef<(() => void) | null>(null);
  const abandonConsenti = useRef(false);
  useEffect(() => {
    if (!modifie) return;
    return poserGarde((poursuivre) => {
      if (abandonConsenti.current) return false;
      apresAbandon.current = poursuivre;
      setConfirmer(true);
      return true;
    });
  }, [modifie]);
  const nePasGarder = () => {
    const ensuite = apresAbandon.current;
    apresAbandon.current = null;
    abandonConsenti.current = true;
    onClose();
    ensuite?.();
  };

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
        if (fermeture.current.confirmer) setConfirmer(false);
        else fermeture.current.demanderFermeture();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Même règle que le formulaire d'événement : la fin TRANSLATE avec le début. */
  function changerDebut(nouveau: string) {
    const ancien = minutesDe(debut);
    const duree = minutesDe(fin) != null && ancien != null ? minutesDe(fin)! - ancien : null;
    setDebut(nouveau);
    if (minutesDe(nouveau) == null) return;
    setFin(finApres(nouveau, duree != null && duree > 0 ? duree : DUREE_DEFAUT_MIN));
  }

  const toggleDay = (d: number) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  const canSave =
    label.trim().length > 0 &&
    !saving &&
    (recMode !== "custom" || days.length > 0);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const recurrence = serialiserRecurrence(recMode, days);
    const input: TaskInput = {
      label: label.trim(),
      tag,
      priority,
      recurrence,
      goal_id: goalId,
      // ⚠️ La frontière datée / récurrente est tenue par `lib/taches.ts`, pas
      // par ce formulaire : l'interface retire déjà le champ, mais une règle
      // recopiée dans chaque formulaire finit par diverger.
      ...planificationDeSaisie(recurrence, dueDate, debut, fin),
    };
    if (task) {
      await updateTask(task.id, input);
      await enregistrerEtat(task);
    } else await createTask(input);
    await onSaved();
  };

  /**
   * L'état ne s'écrit que s'il a CHANGÉ — et un état gardé garde sa date
   * (`state_since`) : préciser « de quoi on attend » ne doit pas faire croire
   * que l'attente commence aujourd'hui.
   */
  const enregistrerEtat = async (tache: Task) => {
    const avant = etatDe(tache);
    const attente = { waiting_for: attenteDe, follow_up_on: relance || null };
    if (etat !== avant) {
      // Reprendre une routine range sa pause dans `pauses` (032) : `changerEtat`
      // part de l'état d'avant, comme le menu.
      await changerEtatTache(tache.id, changerEtat(tache, etat, todayStr(), attente));
      return;
    }
    if (etat !== "waiting") return;
    // D'attente à attente, `changerEtat` garde `state_since` : la suspension continue.
    const neuf = changerEtat(tache, "waiting", todayStr(), attente);
    if (neuf.waiting_for === (tache.waiting_for ?? null) && neuf.follow_up_on === (tache.follow_up_on ?? null)) return;
    await changerEtatTache(tache.id, neuf);
  };

  return (
    <div
      className="fenetre-voile fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={demanderFermeture}
    >
      {/* Le pied reste, le corps défile (`.fenetre`, `index.css`). Cette
          fenêtre n'avait AUCUNE borne de hauteur : sur un écran bas elle
          sortait par le haut et par le bas, sans défiler. */}
      <div
        className="card fenetre w-full max-w-md bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg text-text">
          {task ? t("Modifier la tâche") : t("Nouvelle tâche")}
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
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("Nom de la tâche")}
            className="w-full rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none"
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Priorité")}</p>
            {/* « Haute / Moyenne / Basse » jusqu'au 2026-09-30 : un seul
                vocabulaire désormais, celui des étapes (`lib/priorite.ts`). */}
            <ChoixPriorite valeur={priority} onChange={setPriority} />
          </div>

          {task && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">{t("État")}</p>
              <div className="flex flex-wrap gap-1.5">
                {choixEtats().map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setEtat(m.value)}
                    className={`pill border px-3 py-1.5 text-xs font-medium transition-colors ${
                      etat === m.value
                        ? "border-text/30 bg-surface-2 text-text"
                        : "border-border text-text-dim hover:text-text"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {etat === "waiting" && (
                <div className="mt-2 flex flex-col gap-2">
                  <input
                    value={attenteDe}
                    onChange={(e) => setAttenteDe(e.target.value)}
                    placeholder={t("En attente de… (une personne, une réponse)")}
                    aria-label={t("En attente de")}
                    className="w-full rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-accent focus:outline-none"
                  />
                  <div>
                    {/* Étiquetée : seule, « Demain » se confondait avec l'échéance plus bas. */}
                    <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Relance")}</p>
                    <ChampDate
                      valeur={relance}
                      onChange={setRelance}
                      aria={t("Relance")}
                      placeholder={t("Sans relance")}
                    />
                  </div>
                </div>
              )}
              {etat === "dropped" && (
                <p className="mt-2 text-xs text-text-dim">
                  {t("Elle sort des listes et ne compte plus nulle part. « À faire » la reprend.")}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">
              {t("Récurrence")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recModes().map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setRecMode(m.value)}
                  className={`pill border px-3 py-1.5 text-xs font-medium transition-colors ${
                    recMode === m.value
                      ? "border-text/30 bg-surface-2 text-text"
                      : "border-border text-text-dim hover:text-text"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {recMode === "custom" && (
              <div className="mt-2 flex gap-1.5">
                {ORDRE_SEMAINE.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`h-8 w-9 rounded-[8px] border text-xs font-medium transition-colors ${
                      days.includes(d)
                        ? "border-accent bg-accent/20 text-text"
                        : "border-border text-text-dim hover:text-text"
                    }`}
                  >
                    {nomCourtDuJour(d)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ⭐ DATE ET RÉCURRENCE S'EXCLUENT — l'interface rend le mélange
              IMPOSSIBLE, elle ne le décourage pas. C'est la règle structurante
              de `lib/taches.ts` : une tâche datée arrive une fois et se
              reporte ; une tâche récurrente n'a pas de date, ses occurrences
              se calculent, et une occurrence manquée n'est PAS en retard —
              elle est manquée. Reporter une habitude quotidienne en ferait
              deux le lendemain, puis trois : l'app transformerait un jour de
              repos en dette.

              On ANNONCE le retrait plutôt que de faire disparaître un bloc en
              silence — un contrôle qui s'évapore se lit comme un bogue. */}
          {recMode === "none" ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Échéance")}</p>
              <ChampDate
                valeur={dueDate}
                onChange={setDueDate}
                aria={t("Échéance")}
                placeholder={t("Sans échéance")}
              />
              {/* Le créneau n'a de sens qu'une fois la journée choisie : une
                  heure sans date ne se pose nulle part dans le calendrier. */}
              {dueDate && (
                <div className="mt-2 flex gap-3">
                  <div className="flex-1">
                    <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Début")}</p>
                    <input
                      type="time"
                      value={debut}
                      onChange={(e) => changerDebut(e.target.value)}
                      className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Fin")}</p>
                    <input
                      type="time"
                      value={fin}
                      onChange={(e) => setFin(e.target.value)}
                      className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              )}
              {dueDate && (
                <>
                  <button
                    type="button"
                    onClick={() => setRoulette((v) => !v)}
                    className="cible-tactile-ligne mt-2 text-xs text-text-dim hover:text-text"
                  >
                    {roulette ? t("Masquer la roulette") : t("Choisir à la roulette")}
                  </button>
                  {roulette && (
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <RouletteHeure valeur={debut} onChange={changerDebut} aria={t("Début")} />
                      </div>
                      <div className="flex-1">
                        <RouletteHeure valeur={fin} onChange={setFin} aria={t("Fin")} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-xs text-text-dim">
              {t("Une tâche qui se répète n'a pas d'échéance : ses occurrences se calculent.")}
            </p>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Tag")}</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTag(null)}
                className={`pill border px-3 py-1.5 text-xs font-medium transition-colors ${
                  tag === null
                    ? "border-text/30 bg-surface-2 text-text"
                    : "border-border text-text-dim hover:text-text"
                }`}
              >
                {t("Aucun")}
              </button>
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTag(t.name)}
                  className="pill border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={
                    tag === t.name
                      ? {
                          borderColor: t.color,
                          backgroundColor: `color-mix(in srgb, ${t.color} 16%, transparent)`,
                          color: t.color,
                        }
                      : { borderColor: "var(--color-border)", color: "var(--color-text-dim)" }
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Ce qui cite cette tâche — une note, un rendez-vous (2026-10-21,
              lot 6 de l'audit, constat 5) : le lien se voit des deux côtés. */}
          {task && <CiteDans kind="task" uid={uidDeLigne("task", task)} />}

          {goals.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">
                {t("Objectif lié")}
              </p>
              <select
                value={goalId ?? ""}
                onChange={(e) =>
                  setGoalId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
              >
                <option value="">{t("Aucun")}</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          </div>

          {confirmer ? (
          <div className="fenetre-pied mt-[10px] flex flex-wrap items-center justify-end gap-2" role="alertdialog" aria-label={t("Abandonner la saisie ?")}>
            <p className="mr-auto text-sm text-text">{t("Abandonner la saisie ?")}</p>
            <button
              type="button"
              onClick={() => {
                apresAbandon.current = null;
                setConfirmer(false);
              }}
              className="pill px-4 py-2 text-sm font-medium text-text-dim hover:text-text"
            >
              {t("Continuer")}
            </button>
            <button
              ref={boutonAbandon}
              type="button"
              onClick={nePasGarder}
              className="pill border border-border px-4 py-2 text-sm font-semibold text-text hover:border-border-strong"
            >
              {t("Ne pas garder")}
            </button>
          </div>
          ) : (
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
              {task ? t("Enregistrer") : t("Créer")}
            </button>
          </div>
          )}
        </form>
      </div>
    </div>
  );
}
