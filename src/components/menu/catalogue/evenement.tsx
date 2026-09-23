/**
 * Ce qu'un menu contextuel propose sur un ÉVÉNEMENT du Calendrier, et sur un
 * CRÉNEAU VIDE.
 *
 * ⚠️ RÈGLE 18 : « Modifier… » ouvre la MÊME fenêtre que le clic sur
 * l'événement ; « Supprimer » appelle `jeter()`, comme le bouton de la fenêtre.
 *
 * ⚠️ UNE SÉRIE SE SUPPRIME EN ENTIER, ET LE MENU LE DIT. Le moteur de
 * récurrence projette un motif (`occurrenceLe`) : il n'a ni exceptions ni date
 * de fin (Phase 0, § 10). « Cette occurrence » et « celle-ci et les suivantes »
 * n'existent donc pas — l'entrée s'appelle « Supprimer la série », pour que
 * personne ne croie ne retirer qu'un mardi.
 */

import { IconCalendar, IconPencil, IconPlus, IconTrash } from "../../icons";
import { IconDupliquer } from "../icones";
import { t } from "../../../lib/i18n";
import type { EntreePossible } from "../../../lib/menu/entrees";
import type { CalendarEvent } from "../../../lib/types";
import { createCalendarEvent } from "../../../lib/repo";
import { jeter } from "../../corbeille/geste";

export interface GestesEvenement {
  /** La fenêtre de l'événement — la même que le clic. */
  modifier: (e: CalendarEvent) => void;
  dupliquer: (e: CalendarEvent) => Promise<void>;
  supprimer: (e: CalendarEvent) => Promise<void>;
}

const enSerie = (e: CalendarEvent) => !!e.recurrence && e.recurrence !== "none";

export function entreesEvenement(e: CalendarEvent, gestes: GestesEvenement): EntreePossible[] {
  return [
    { id: "modifier", libelle: t("Modifier…"), icone: <IconPencil />, executer: () => gestes.modifier(e) },
    { id: "dupliquer", libelle: t("Dupliquer"), icone: <IconDupliquer />, executer: () => gestes.dupliquer(e) },
    {
      id: "supprimer",
      libelle: enSerie(e) ? t("Supprimer la série") : t("Supprimer"),
      icone: <IconTrash />,
      danger: true,
      executer: () => gestes.supprimer(e),
    },
  ];
}

/** Dupliquer et supprimer, écrits une fois — la fenêtre de l'événement s'en sert aussi. */
export function gestesCommunsEvenement(
  apres: () => Promise<void>,
): Pick<GestesEvenement, "dupliquer" | "supprimer"> {
  return {
    async dupliquer(e) {
      await createCalendarEvent({
        // Figé dans la langue du jour, comme une note ou une tâche dupliquée.
        title: t("{titre} (copie)", { titre: e.title }),
        body: e.body,
        date: e.date,
        end_date: e.end_date,
        start_at: e.start_at,
        end_at: e.end_at,
        all_day: !!e.all_day,
        color: e.color,
        recurrence: e.recurrence ?? "none",
      });
      await apres();
    },
    async supprimer(e) {
      await jeter("event", e.id, e.title, apres);
    },
  };
}

// ─── Le créneau vide ─────────────────────────────────────────────────────────

export interface GestesCreneau {
  /** La même fenêtre que le clic sur un créneau vide, pré-remplie à l'heure. */
  nouvelEvenement: (jour: string, heure: string) => void;
  nouvelleTache: (jour: string, heure: string) => Promise<void>;
}

export function entreesCreneau(jour: string, heure: string, gestes: GestesCreneau): EntreePossible[] {
  return [
    {
      id: "nouvel-evenement",
      libelle: t("Nouvel événement ici"),
      icone: <IconCalendar />,
      executer: () => gestes.nouvelEvenement(jour, heure),
    },
    {
      id: "nouvelle-tache",
      libelle: t("Nouvelle tâche ici"),
      icone: <IconPlus />,
      executer: () => gestes.nouvelleTache(jour, heure),
    },
  ];
}
