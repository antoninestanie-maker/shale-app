import { useEffect, useMemo, useState } from "react";
import { entreesDuJour, type EntreeAgenda } from "../lib/calendrier/agenda";
import { chargeDuJour } from "../lib/calendrier/charge";
import { profilDisponibilite } from "../lib/calendrier/disponibilite";
import { fetchCalendarEvents, fetchRecurringEvents } from "../lib/repo";
import { todayStr } from "../lib/logic";
import type { AppData, CalendarEvent } from "../lib/types";
import { IconCalendar } from "./icons";
import { t } from "../lib/i18n";

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

  useEffect(() => {
    let annule = false;
    void (async () => {
      const [duJour, recurrents] = await Promise.all([
        fetchCalendarEvents(aujourdhui, aujourdhui),
        fetchRecurringEvents(),
      ]);
      if (annule) return;
      const vus = new Set(duJour.map((e) => e.id));
      setEvents([...duJour, ...recurrents.filter((e) => !vus.has(e.id))]);
    })();
    return () => {
      annule = true;
    };
  }, [aujourdhui]);

  const entrees = useMemo(
    () =>
      entreesDuJour(
        { events, tasks: data.tasks, completions: data.completions, goals: data.goals },
        aujourdhui,
        aujourdhui,
      ),
    [events, data.tasks, data.completions, data.goals, aujourdhui],
  );

  const profil = useMemo(() => profilDisponibilite(data.focusSessions), [data.focusSessions]);
  const charge = useMemo(
    () => chargeDuJour(entrees, profil, aujourdhui),
    [entrees, profil, aujourdhui],
  );

  return (
    <section className="card flex flex-col p-5">
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-text-dim">
          <IconCalendar className="h-4 w-4" />
          {t("Calendrier")}
        </h2>
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
        <p className="panel-grow mt-4 text-sm text-text-dim">
          {t("Rien de prévu aujourd'hui.")}
        </p>
      ) : (
        <ul className="panel-scroll mt-3 space-y-1.5">
          {entrees.map((e) => (
            <li key={`${e.kind}-${e.id}`} className="flex items-center gap-2 text-sm">
              <span
                className="h-3 w-0.5 shrink-0 rounded-full"
                style={{ backgroundColor: couleur(e) }}
              />
              <span className="w-11 shrink-0 text-xs tabular-nums text-text-dim">
                {e.start_at ?? (e.allDay ? t("jour") : "—")}
              </span>
              <span
                className="truncate text-text"
                style={{
                  textDecoration: e.faite ? "line-through" : undefined,
                  opacity: e.faite ? 0.5 : 1,
                }}
              >
                {e.enRetard && "⌛ "}
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
  return "var(--color-green)";
}
