import { useEffect, useMemo, useState } from "react";
import {
  dansLeBandeau,
  entreesDuJour,
  type EcheanceFacture,
  type EntreeAgenda,
} from "../lib/calendrier/agenda";
import { chargeDuJour } from "../lib/calendrier/charge";
import { profilDisponibilite } from "../lib/calendrier/disponibilite";
import { fetchCalendarEvents, fetchFacturation, fetchRecurringEvents } from "../lib/repo";
import { echeancesDuCalendrier } from "../lib/finance/facturation/relances";
import { FINANCE_ACTIF } from "../lib/features";
import { todayStr } from "../lib/logic";
import type { AppData, CalendarEvent } from "../lib/types";
import { IconSablier } from "./icons";
import { BadgeDEntree } from "./taches/BadgeEtat";
import { formatHeure, t } from "../lib/i18n";

/**
 * Le widget « Calendrier » du tableau de bord — la journée en cours.
 *
 * ⚠️ UN WIDGET EST UN COUP D'ŒIL, pas un formulaire (règle posée le
 * 2026-07-12, cf. `TimerCard`). On lit ce qui vient, on ne saisit rien : créer,
 * déplacer et décider se font dans le module.
 */
export default function CalendarCard({ data }: { data: AppData }) {
  const aujourdhui = todayStr();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  /** Les échéances de facturation du jour (migration 023). */
  const [echeances, setEcheances] = useState<EcheanceFacture[]>([]);

  useEffect(() => {
    let annule = false;
    void (async () => {
      const [duJour, recurrents, facturation] = await Promise.all([
        fetchCalendarEvents(aujourdhui, aujourdhui),
        fetchRecurringEvents(),
        // ⚠️ Jamais bloquant : le widget doit s'afficher même si la
        // facturation ne répond pas.
        fetchFacturation().catch(() => null),
      ]);
      if (annule) return;
      const vus = new Set(duJour.map((e) => e.id));
      setEvents([...duJour, ...recurrents.filter((e) => !vus.has(e.id))]);
      // Finance mise de côté (`FINANCE_ACTIF`) : aucune échéance de facture sur la carte.
      if (facturation && FINANCE_ACTIF)
        setEcheances(
          echeancesDuCalendrier(
            facturation.factures,
            facturation.paiements,
            facturation.tiers,
            aujourdhui,
          ),
        );
    })();
    return () => {
      annule = true;
    };
  }, [aujourdhui]);

  const entrees = useMemo(
    () =>
      entreesDuJour(
        {
          events,
          tasks: data.tasks,
          completions: data.completions,
          goals: data.goals,
          echeances,
        },
        aujourdhui,
        aujourdhui,
      ),
    [events, data.tasks, data.completions, data.goals, echeances, aujourdhui],
  );

  const profil = useMemo(() => profilDisponibilite(data.focusSessions), [data.focusSessions]);
  const charge = useMemo(
    () => chargeDuJour(entrees, profil, aujourdhui),
    [entrees, profil, aujourdhui],
  );

  return (
    <section className="card p-5">
      {/* Même en-tête que les autres cartes d'Aujourd'hui (`hud-label mb-3`) :
          celui-ci était seul en 14 px avec une icône. `.rgrid-head` écarte la
          pastille « Surchargée » de la barre de poignées au survol. */}
      <header className="rgrid-head mb-3 flex items-center justify-between gap-2">
        <h2 className="hud-label">{t("Calendrier")}</h2>
        {charge.surchargee && (
          <span
            className="pill px-2 py-0.5 text-[0.65rem] font-medium"
            style={{
              color: "var(--color-yellow)",
              backgroundColor: "color-mix(in srgb, var(--color-yellow) 14%, transparent)",
            }}
          >
            {t("Surchargée")}
          </span>
        )}
      </header>

      {entrees.length === 0 ? (
        <p className="panel-grow flex items-center justify-center py-4 text-center text-sm text-text-dim">
          {t("Rien de prévu aujourd'hui.")}
        </p>
      ) : (
        <ul className="panel-scroll space-y-1.5">
          {entrees.map((e) => (
            <li key={`${e.kind}-${e.id}`} className="flex items-center gap-2 text-sm">
              <span
                className="h-3 w-0.5 shrink-0 rounded-full"
                style={{ backgroundColor: couleur(e) }}
              />
              <span className="w-16 shrink-0 text-xs tabular-nums text-text-dim">
                {dansLeBandeau(e) ? t("jour") : e.start_at ? formatHeure(e.start_at) : "—"}
              </span>
              <span
                className="truncate-souris min-w-0 truncate text-text"
                style={{
                  textDecoration: e.faite ? "line-through" : undefined,
                  opacity: e.faite ? 0.5 : 1,
                }}
              >
                {e.enRetard && <IconSablier className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-red" />}
                <BadgeDEntree entree={e} />
                {e.titre}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function couleur(e: EntreeAgenda): string {
  if (e.kind === "deadline") return "var(--color-violet)";
  if (e.enRetard) return "var(--color-red)";
  if (e.kind === "event") return `var(--color-${e.color ?? "blue"})`;
  if (e.kind === "recurrence") return "var(--color-text-dim)";
  return "var(--color-success)";
}
