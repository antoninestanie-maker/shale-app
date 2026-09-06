import { useEffect, useState } from "react";
import { createCalendarEvent, deleteCalendarEvent, updateCalendarEvent, type CalendarEventInput } from "../../lib/repo";
import { DUREE_DEFAUT_MIN, finApres, minutesDe } from "../../lib/calendrier/agenda";
import {
  ORDRE_SEMAINE,
  addDays,
  nomCourtDuJour,
  parseRecurrence,
  serialiserRecurrence,
  type ModeRecurrence,
} from "../../lib/logic";
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

/**
 * ⭐ EXACTEMENT LE VOCABULAIRE DES TÂCHES — les mêmes quatre entrées, les mêmes
 * mots (`TaskModal`).
 *
 * Il y en avait TROIS ici, et écrites autrement : « Une seule fois / Tous les
 * jours / Du lundi au vendredi » contre « Une fois / Quotidien / Lun–ven /
 * Jours précis ». Une même grammaire, deux lectures, et « jours choisis »
 * inatteignable pour un événement alors que la colonne et le moteur le
 * savaient faire depuis la migration 020. Aligner sur les tâches plutôt que
 * l'inverse : elles avaient déjà les quatre, et cela SUPPRIME la seconde
 * formulation au lieu de la traduire (décision d'Antonin, 2026-09-05).
 *
 * ⚠️ Les libellés gardent la phrase FRANÇAISE et sont traduits à l'affichage :
 * un `t()` dans une constante de module serait évalué à l'import, donc figé
 * dans la langue de démarrage (PIEGES § 5.2). Et comme ils passent par une clé
 * CALCULÉE, `i18n:check` ne les réclamera jamais — c'est ainsi que les trois
 * anciens libellés s'affichaient EN FRANÇAIS dans l'app anglaise avec les deux
 * outils au vert (§ 5.2 bis). Leurs entrées d'`en.ts` sont écrites à la main.
 */
const RECURRENCES: { valeur: ModeRecurrence; label: string }[] = [
  { valeur: "none", label: "Une fois" },
  { valeur: "daily", label: "Quotidien" },
  { valeur: "weekdays", label: "Lun–ven" },
  { valeur: "custom", label: "Jours précis" },
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
  /**
   * ⭐ Un créneau neuf dure une heure. Le laisser vide donnait une carte trop
   * courte pour porter son étiquette d'heure (`GrilleHoraire` la masque sous
   * 45 min) : on posait un rendez-vous à 14:37 et l'écran n'en disait rien.
   */
  const [fin, setFin] = useState(
    event?.end_at ?? (heure ? finApres(heure, DUREE_DEFAUT_MIN) : ""),
  );
  const [journee, setJournee] = useState(!!event?.all_day);
  /**
   * ⭐ Le multi-jours passe par une CASE À COCHER, pas par un champ de date
   * laissé vide.
   *
   * ⚠️ Un `<input type="date">` VIDE n'affiche RIEN sur iOS — pas même le
   * gabarit `jj/mm/aaaa` que rend le bureau (vu à l'écran le 2026-08-27, cf.
   * `TasksView`). Un second champ de date optionnel serait donc, sur téléphone,
   * un rectangle gris muet dont rien ne dirait ce qu'il est. La case l'annonce
   * et ne le montre que quand il sert.
   */
  const [plusieurs, setPlusieurs] = useState(
    !!event?.end_date && event.end_date > event.date,
  );
  const [finJour, setFinJour] = useState(
    event?.end_date && event.end_date > event.date ? event.end_date : "",
  );
  const [couleur, setCouleur] = useState(event?.color ?? "blue");
  const recLue = parseRecurrence(event?.recurrence ?? null);
  const [recMode, setRecMode] = useState<ModeRecurrence>(recLue.mode);
  const [jours, setJours] = useState<number[]>(recLue.jours);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  /**
   * ⭐ DÉPLACER LE DÉBUT DÉPLACE LA FIN, en gardant la durée.
   *
   * ⚠️ On ne « corrige » jamais la fin en la tirant derrière le début : on la
   * TRANSLATE. Avancer un rendez-vous d'une heure ne doit pas le raccourcir, et
   * un utilisateur qui a choisi 45 minutes les garde. Quand aucune fin n'existe
   * encore, on retombe sur la durée par défaut plutôt que de laisser un créneau
   * ouvert — c'est ce qui garantit qu'une fin est toujours postérieure à son
   * début sans avoir à l'imposer par un message d'erreur.
   */
  function changerDebut(nouveau: string) {
    const ancien = minutesDe(debut);
    const suivant = minutesDe(nouveau);
    const duree = minutesDe(fin) != null && ancien != null ? minutesDe(fin)! - ancien : null;
    setDebut(nouveau);
    if (suivant == null) return;
    setFin(finApres(nouveau, duree != null && duree > 0 ? duree : DUREE_DEFAUT_MIN));
  }

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
    if (!journee && !plusieurs && debut && fin && fin <= debut) {
      setErreur(t("La fin doit venir après le début."));
      return;
    }
    if (plusieurs && (!finJour || finJour <= date)) {
      setErreur(t("Le dernier jour doit venir après le premier."));
      return;
    }
    // Une répétition « jours précis » sans aucun jour ne se projette nulle part :
    // l'événement disparaîtrait du calendrier sans qu'on sache pourquoi.
    if (!plusieurs && recMode === "custom" && jours.length === 0) {
      setErreur(t("Choisis au moins un jour de répétition."));
      return;
    }
    setEnCours(true);
    const input: CalendarEventInput = {
      title: titre.trim(),
      body: corps.trim() || null,
      date,
      end_date: plusieurs ? finJour : null,
      start_at: journee ? null : debut || null,
      end_at: journee ? null : fin || null,
      all_day: journee,
      color: couleur,
      // ⚠️ La récurrence est FORCÉE à « une fois » sur un multi-jours, et
      // l'interface a déjà retiré le choix. Le forcer ici aussi ferme le cas où
      // l'on coche « plusieurs jours » APRÈS avoir choisi une répétition : sans
      // cela, on enregistrerait une série dont chaque terme dure trois jours et
      // qui se recouvre elle-même dès le quotidien.
      recurrence: plusieurs ? "none" : serialiserRecurrence(recMode, jours),
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

        <div className="mt-4 flex gap-3">
          <label className="flex items-center gap-2 text-sm text-text-dim">
            <input
              type="checkbox"
              checked={plusieurs}
              onChange={(e) => {
                setPlusieurs(e.target.checked);
                // Le lendemain par défaut : c'est la plage la plus courte qui
                // mérite le nom, et elle évite au champ de naître invalide.
                if (e.target.checked && !finJour) setFinJour(addDays(date, 1));
              }}
              className="h-4 w-4"
            />
            {t("Sur plusieurs jours")}
          </label>
          {plusieurs && (
            <div className="flex flex-1 items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-text-dim">
                {t("jusqu'au")}
              </span>
              <input
                type="date"
                value={finJour}
                min={date}
                onChange={(e) => setFinJour(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
              />
            </div>
          )}
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
                onChange={(e) => changerDebut(e.target.value)}
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

        {/* ⭐ LE MULTI-JOURS ET LA RÉPÉTITION NE SE MÉLANGENT PAS, et l'interface
            rend le mélange IMPOSSIBLE plutôt que de le décourager — même
            principe que la frontière entre tâche datée et tâche récurrente
            (`lib/taches.ts`). Une série dont chaque terme durerait trois jours
            se recouvrirait elle-même dès « tous les jours », et le vocabulaire
            de récurrence de l'app ne connaît ni le mois ni l'année : il n'y a
            donc aucune combinaison qui veuille dire quelque chose.
            On ANNONCE le retrait au lieu de faire disparaître un champ en
            silence : un contrôle qui s'évapore se lit comme un bogue. */}
        {plusieurs ? (
          <p className="mt-4 rounded-lg border border-border bg-overlay px-3 py-2 text-xs text-text-dim">
            {t("Un événement sur plusieurs jours ne se répète pas.")}
          </p>
        ) : (
          <>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-text-dim">
              {t("Répétition")}
            </label>
            <select
              value={recMode}
              onChange={(e) => setRecMode(e.target.value as ModeRecurrence)}
              className="mt-1.5 w-full rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
            >
              {RECURRENCES.map((r) => (
                <option key={r.valeur} value={r.valeur}>
                  {t(r.label)}
                </option>
              ))}
            </select>
            {recMode === "custom" && (
              <div className="mt-2 flex gap-1.5">
                {ORDRE_SEMAINE.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setJours((prev) =>
                        prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                      )
                    }
                    className={`cible-tactile h-8 w-9 rounded-[8px] border text-xs font-medium transition-colors ${
                      jours.includes(d)
                        ? "border-blue bg-blue/20 text-text"
                        : "border-border text-text-dim hover:text-text"
                    }`}
                  >
                    {/* ⚠️ `nomCourtDuJour` et non `DAY_SHORT` : la table est
                        française et les deux outils i18n sont aveugles devant
                        elle. `Intl` connaît toutes les langues. */}
                    {nomCourtDuJour(d)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

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
