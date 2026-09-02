import { useEffect, useState } from "react";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent, type CalendarEventInput } from "../../lib/repo";
import type { CalendarEvent } from "../../lib/types";
import { IconTrash } from "../icons";
import { t } from "../../lib/i18n";

/**
 * Créer ou modifier un événement.
 *
 * ⚠️ Les libellés de la table `COULEURS` gardent la phrase FRANÇAISE et sont
 * traduits à l'affichage : un `t()` dans une constante de module serait évalué
 * à l'import, donc figé dans la langue de démarrage.
 */
const COULEURS: { token: string; label: string }[] = [
  { token: "blue", label: "Bleu" },
  { token: "green", label: "Vert" },
  { token: "violet", label: "Violet" },
  { token: "yellow", label: "Jaune" },
  { token: "red", label: "Rouge" },
];

const RECURRENCES: { valeur: string; label: string }[] = [
  { valeur: "none", label: "Une seule fois" },
  { valeur: "daily", label: "Tous les jours" },
  { valeur: "weekdays", label: "Du lundi au vendredi" },
];

interface Props {
  /** `null` = création. */
  event: CalendarEvent | null;
  /** Jour pré-rempli à la création. */
  jour: string;
  /** Heure pré-remplie à la création (dépôt sur la grille). */
  heure?: string | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function EventModal({ event, jour, heure, onClose, onSaved }: Props) {
  const [titre, setTitre] = useState(event?.title ?? "");
  const [corps, setCorps] = useState(event?.body ?? "");
  const [date, setDate] = useState(event?.date ?? jour);
  const [debut, setDebut] = useState(event?.start_at ?? heure ?? "");
  const [fin, setFin] = useState(event?.end_at ?? "");
  const [journee, setJournee] = useState(!!event?.all_day);
  const [couleur, setCouleur] = useState(event?.color ?? "blue");
  const [recurrence, setRecurrence] = useState(event?.recurrence ?? "none");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function enregistrer() {
    if (!titre.trim()) {
      setErreur(t("Un événement a besoin d'un titre."));
      return;
    }
    // ⚠️ Une fin antérieure au début n'est pas rattrapée en silence : la corriger
    // à la place de l'utilisateur déplacerait son rendez-vous sans le dire.
    if (!journee && debut && fin && fin <= debut) {
      setErreur(t("La fin doit venir après le début."));
      return;
    }
    setEnCours(true);
    const input: CalendarEventInput = {
      title: titre.trim(),
      body: corps.trim() || null,
      date,
      start_at: journee ? null : debut || null,
      end_at: journee ? null : fin || null,
      all_day: journee,
      color: couleur,
      recurrence,
    };
    if (event) await updateCalendarEvent(event.id, input);
    else await createCalendarEvent(input);
    await onSaved();
    onClose();
  }

  async function supprimer() {
    if (!event) return;
    setEnCours(true);
    await deleteCalendarEvent(event.id);
    await onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card card-solid w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl text-text">
          {event ? t("Modifier l'événement") : t("Nouvel événement")}
        </h2>

        <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-text-dim">
          {t("Titre")}
        </label>
        <input
          autoFocus
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder={t("Point hebdo, dentiste, anniversaire…")}
          className="mt-1.5 w-full rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
        />

        <div className="mt-4 flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium uppercase tracking-wide text-text-dim">
              {t("Date")}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
            />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm text-text-dim">
            <input
              type="checkbox"
              checked={journee}
              onChange={(e) => setJournee(e.target.checked)}
              className="h-4 w-4"
            />
            {t("Toute la journée")}
          </label>
        </div>

        {!journee && (
          <div className="mt-4 flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium uppercase tracking-wide text-text-dim">
                {t("Début")}
              </label>
              <input
                type="time"
                value={debut}
                onChange={(e) => setDebut(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium uppercase tracking-wide text-text-dim">
                {t("Fin")}
              </label>
              <input
                type="time"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
              />
            </div>
          </div>
        )}

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-text-dim">
          {t("Répétition")}
        </label>
        <select
          value={recurrence ?? "none"}
          onChange={(e) => setRecurrence(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
        >
          {RECURRENCES.map((r) => (
            <option key={r.valeur} value={r.valeur}>
              {t(r.label)}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-text-dim">
          {t("Couleur")}
        </label>
        <div className="mt-1.5 flex gap-2">
          {COULEURS.map((c) => (
            <button
              key={c.token}
              type="button"
              onClick={() => setCouleur(c.token)}
              data-tip={t(c.label)}
              aria-label={t(c.label)}
              className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: `var(--color-${c.token})`,
                borderColor: couleur === c.token ? "var(--color-text)" : "transparent",
              }}
            />
          ))}
        </div>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-text-dim">
          {t("Note")}
        </label>
        <textarea
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
          rows={2}
          className="mt-1.5 w-full resize-none rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
        />

        {erreur && <p className="mt-3 text-sm text-red">{erreur}</p>}

        <div className="mt-6 flex items-center justify-between">
          {event ? (
            <button
              type="button"
              onClick={supprimer}
              disabled={enCours}
              data-tip={t("Supprimer l'événement")}
              className="pill flex items-center gap-1.5 px-3 py-2 text-sm text-text-dim hover:text-red"
            >
              <IconTrash className="h-4 w-4" />
              {t("Supprimer")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="pill px-4 py-2 text-sm text-text-dim hover:text-text"
            >
              {t("Annuler")}
            </button>
            <button
              type="button"
              onClick={enregistrer}
              disabled={enCours}
              className="pill bg-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {t("Enregistrer")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
