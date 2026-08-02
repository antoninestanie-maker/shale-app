import { useEffect, useMemo, useRef, useState } from "react";
import type { View } from "../components/Sidebar";
import {
  addDays,
  dayStat,
  todayStr,
  weekdayOf,
} from "../lib/logic";
import {
  addHabit,
  createNote,
  deleteHabit,
  setHabitCheck,
  upsertJournal,
} from "../lib/repo";
import type { AppData } from "../lib/types";
import { IconBolt, IconFlame, IconMood, IconX } from "../components/icons";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";

import { localeTag, t } from "../lib/i18n";
interface Props {
  data: AppData;
  refresh: () => Promise<void>;
  navigate: (view: View) => void;
}

const MOOD_LEVELS = [0, 1, 2, 3, 4] as const;
const HABIT_COLORS = ["var(--color-green)", "var(--color-blue)", "var(--color-yellow)", "#a78bfa", "#fb923c", "#f472b6"];

function fmtMin(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** Corps de la revue hebdo, prérempli avec les stats de la semaine écoulée. */
function buildWeeklyReview(data: AppData): { title: string; body: string } {
  const today = todayStr();
  const monday = addDays(today, weekdayOf(today) === 0 ? -6 : 1 - weekdayOf(today));
  const days: string[] = [];
  for (let d = monday; d <= today; d = addDays(d, 1)) days.push(d);

  const pcts = days
    .map((d) => dayStat(data.tasks, data.completions, d).pct)
    .filter((p): p is number => p !== null);
  const avg = pcts.length
    ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)
    : 0;

  const focusMin = data.focusSessions
    .filter((s) => s.kind === "focus" && s.ended_at && s.started_at.slice(0, 10) >= monday)
    .reduce((a, s) => {
      const ms =
        new Date(s.ended_at!.replace(" ", "T")).getTime() -
        new Date(s.started_at.replace(" ", "T")).getTime();
      return a + Math.max(0, Math.round(ms / 60_000));
    }, 0);

  const moods = data.journal.filter((j) => j.date >= monday && j.mood);
  const avgMood = moods.length
    ? (moods.reduce((a, j) => a + (j.mood ?? 0), 0) / moods.length).toFixed(1)
    : "—";

  const dateLabel = new Date(monday.replace(/-/g, "/")).toLocaleDateString(localeTag(), {
    day: "numeric",
    month: "long",
  });

  return {
    title: t("Revue — semaine du {date}", { date: dateLabel }),
    body: [
      `## Stats de la semaine`,
      t("- Complétion moyenne : {avg} %", { avg }),
      t("- Temps de focus : {time}", { time: fmtMin(focusMin) }),
      `- Humeur moyenne : ${avgMood}/5`,
      ``,
      `## Ce qui a marché`,
      `- `,
      ``,
      `## À améliorer`,
      `- `,
      ``,
      `## Priorités de la semaine prochaine`,
      `1. `,
      `2. `,
      `3. `,
    ].join("\n"),
  };
}

export default function JournalView({ data, refresh, navigate }: Props) {
  const today = todayStr();
  const entry = data.journal.find((j) => j.date === today);
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(entry?.energy ?? null);
  const [body, setBody] = useState(entry?.body ?? "");
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef<number | undefined>(undefined);

  const [newHabit, setNewHabit] = useState("");
  const [newColor, setNewColor] = useState(HABIT_COLORS[0]);
  const [deletingHabit, setDeletingHabit] = useState<number | null>(null);
  const deleteTimer = useRef<number | undefined>(undefined);

  // resynchronise si l'entrée change (autre appareil, reload…)
  useEffect(() => {
    setMood(entry?.mood ?? null);
    setEnergy(entry?.energy ?? null);
    setBody(entry?.body ?? "");
  }, [entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (m: number | null, en: number | null, b: string) => {
    setSaved(false);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      await upsertJournal(today, { mood: m, energy: en, body: b });
      setSaved(true);
      await refresh();
    }, 600);
  };

  // Grille type GitHub : 12 semaines, intensité = part d'habitudes cochées
  const grid = useMemo(() => {
    const nHabits = Math.max(data.habits.length, 1);
    const checksByDate = new Map<string, number>();
    for (const c of data.habitChecks) {
      checksByDate.set(c.date, (checksByDate.get(c.date) ?? 0) + 1);
    }
    const monday = addDays(today, weekdayOf(today) === 0 ? -6 : 1 - weekdayOf(today));
    const weeks: { date: string; ratio: number; future: boolean }[][] = [];
    for (let w = 11; w >= 0; w--) {
      const col: { date: string; ratio: number; future: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(monday, -7 * w + d);
        col.push({
          date,
          ratio: Math.min((checksByDate.get(date) ?? 0) / nHabits, 1),
          future: date > today,
        });
      }
      weeks.push(col);
    }
    return weeks;
  }, [data.habitChecks, data.habits.length, today]);

  const habitStreak = (habitId: number): number => {
    let streak = 0;
    let d = today;
    const set = new Set(
      data.habitChecks.filter((c) => c.habit_id === habitId).map((c) => c.date),
    );
    if (!set.has(d)) d = addDays(d, -1); // aujourd'hui pas encore coché ne casse pas
    while (set.has(d)) {
      streak++;
      d = addDays(d, -1);
    }
    return streak;
  };

  const handleAddHabit = async () => {
    const name = newHabit.trim();
    if (!name) return;
    await addHabit(name, newColor);
    setNewHabit("");
    await refresh();
  };

  const handleDeleteHabit = async (id: number) => {
    if (deletingHabit !== id) {
      setDeletingHabit(id);
      window.clearTimeout(deleteTimer.current);
      deleteTimer.current = window.setTimeout(() => setDeletingHabit(null), 3000);
      return;
    }
    setDeletingHabit(null);
    await deleteHabit(id);
    await refresh();
  };

  const generateReview = async () => {
    const { title, body: reviewBody } = buildWeeklyReview(data);
    const existing = data.notes.find((n) => n.title === title);
    const id = existing?.id ?? (await createNote(title, reviewBody));
    await refresh();
    navigate("notes");
    window.setTimeout(
      () => window.dispatchEvent(new CustomEvent("sb:open-note", { detail: id })),
      100,
    );
  };

  const last14 = useMemo(() => {
    const out: string[] = [];
    for (let i = 13; i >= 0; i--) out.push(addDays(today, -i));
    return out;
  }, [today]);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl text-text">{t("Journal")}</h1>
        <button
          type="button"
          onClick={generateReview}
          data-tip={t("Revue de la semaine")}
          data-tip-sub={t("Crée une note qui récapitule humeur, énergie et habitudes des 7 derniers jours.")}
          className="pill inline-flex items-center gap-1.5 border border-border px-4 py-2 text-sm text-text-dim hover:border-blue/50 hover:text-text"
        >
          <IconBolt className="h-3.5 w-3.5" /> {t("Générer la revue de la semaine")}
        </button>
      </header>

      <ResizableGrid gridId="journal" className="mt-6">
      {/* Entrée du jour */}
      <ResizablePanel id="journal-entry" defaultW={12}>
      <section className="card p-5">
        <div className="rgrid-head flex items-center justify-between">
          <h2 className="hud-label">
            {new Date().toLocaleDateString(localeTag(), {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          <span className="hud-label">{saved ? t("enregistré") : "…"}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-8">
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">Humeur</p>
            <div className="flex flex-wrap gap-1">
              {MOOD_LEVELS.map((lvl, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const v = mood === i + 1 ? null : i + 1;
                    setMood(v);
                    save(v, energy, body);
                  }}
                  data-tip={`Humeur ${i + 1}/5`}
                  data-tip-sub={mood === i + 1 ? t("Cliquer à nouveau pour effacer.") : undefined}
                  className={`flex h-9 w-9 items-center justify-center rounded-[10px] border transition-all ${
                    mood === i + 1
                      ? "border-blue bg-blue/15 text-blue scale-110"
                      : "border-border text-text-dim opacity-60 hover:opacity-100"
                  }`}
                >
                  <IconMood level={lvl} className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Énergie")}</p>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    const nv = energy === v ? null : v;
                    setEnergy(nv);
                    save(mood, nv, body);
                  }}
                  data-tip={t("Énergie {v}/5", { v })}
                  data-tip-sub={energy === v ? t("Cliquer à nouveau pour effacer.") : undefined}
                  className={`flex h-9 w-9 items-center justify-center rounded-[10px] border font-mono text-sm transition-all ${
                    energy !== null && v <= energy
                      ? "border-green/50 bg-green/15 text-green"
                      : "border-border text-text-dim hover:text-text"
                  }`}
                >
                  <IconBolt className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            save(mood, energy, e.target.value);
          }}
          placeholder={t("Réflexion du jour — qu'est-ce qui s'est passé, qu'est-ce que tu en retires ?")}
          rows={3}
          className="mt-4 w-full resize-none rounded-[10px] border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm leading-relaxed text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
        />
      </section>
      </ResizablePanel>

      {/* Habitudes */}
      <ResizablePanel id="journal-habits" defaultW={12} minH={280}>
      <section className="card p-5">
        <div className="rgrid-head flex items-center justify-between">
          <h2 className="hud-label">habitudes — 12 semaines</h2>
          <form
            className="flex min-w-0 flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleAddHabit();
            }}
          >
            <input
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
              placeholder={t("Nouvelle habitude…")}
              className="w-40 min-w-0 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
            />
            <span className="flex flex-wrap gap-1">
              {HABIT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`h-4 w-4 rounded-full ${newColor === c ? "ring-2 ring-blue" : ""}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Couleur ${c}`}
                  data-tip={t("Couleur de l’habitude")}
                />
              ))}
            </span>
            <button
              type="submit"
              disabled={!newHabit.trim()}
              className="pill bg-surface-2 px-3 py-1.5 text-xs font-medium text-text disabled:opacity-40"
            >
              {t("Ajouter")}
            </button>
          </form>
        </div>

        {/* Grille combinée type GitHub */}
        <div className="mt-4 flex gap-[3px]">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell) => (
                <div
                  key={cell.date}
                  title={`${cell.date} — ${Math.round(cell.ratio * data.habits.length)}/${data.habits.length}`}
                  className="h-3.5 w-3.5 rounded-[3px]"
                  style={{
                    backgroundColor: cell.future
                      ? "transparent"
                      : cell.ratio === 0
                        ? "var(--color-overlay)"
                        : `color-mix(in srgb, var(--color-green) ${Math.round(25 + cell.ratio * 75)}%, transparent)`,
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Lignes par habitude */}
        <ul className="panel-scroll mt-5 flex flex-col gap-3">
          {data.habits.length === 0 && (
            <li className="py-4 text-center text-sm text-text-dim">
              {t("Ajoute ta première habitude — méditation, sport, lecture…")}
            </li>
          )}
          {data.habits.map((habit) => {
            const checks = new Set(
              data.habitChecks
                .filter((c) => c.habit_id === habit.id)
                .map((c) => c.date),
            );
            return (
              <li key={habit.id} className="group flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setHabitCheck(habit.id, today, !checks.has(today)).then(refresh)
                  }
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    checks.has(today) ? "border-transparent" : "border-text-dim/40"
                  }`}
                  style={checks.has(today) ? { backgroundColor: habit.color } : {}}
                  aria-label={`${habit.name} aujourd'hui`}
                  data-tip={habit.name}
                  data-tip-sub={t("Cocher pour aujourd’hui.")}
                >
                  {checks.has(today) && (
                    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                      <path d="M2 6.5 4.5 9 10 3.5" stroke="var(--color-surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span className="w-32 truncate text-sm text-text">{habit.name}</span>
                <span className="pill inline-flex shrink-0 items-center gap-1 bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-dim">
                  <IconFlame className="h-2.5 w-2.5" /> {habitStreak(habit.id)}
                </span>
                <span className="flex flex-1 justify-end gap-[3px]">
                  {last14.map((date) => (
                    <button
                      key={date}
                      type="button"
                      data-tip={date}
                      data-tip-sub={t("Cocher ou décocher ce jour.")}
                      onClick={() =>
                        setHabitCheck(habit.id, date, !checks.has(date)).then(refresh)
                      }
                      className="h-3.5 w-3.5 rounded-[3px] transition-transform hover:scale-125"
                      style={{
                        backgroundColor: checks.has(date)
                          ? habit.color
                          : "var(--color-border)",
                      }}
                    />
                  ))}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteHabit(habit.id)}
                  data-tip={deletingHabit === habit.id ? "Confirmer" : t("Supprimer l’habitude")}
                  data-tip-sub={t("Un second clic supprime l’habitude et son historique de coches.")}
                  className={`shrink-0 rounded-md px-1.5 text-xs transition-all ${
                    deletingHabit === habit.id
                      ? "bg-red/20 font-semibold text-red"
                      : "text-text-dim opacity-0 hover:text-red group-hover:opacity-100"
                  }`}
                >
                  {deletingHabit === habit.id ? t("sûr ?") : <IconX className="h-3.5 w-3.5" />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      </ResizablePanel>
      </ResizableGrid>
    </div>
  );
}
