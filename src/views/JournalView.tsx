import { useEffect, useMemo, useRef, useState } from "react";
import type { View } from "../components/Sidebar";
import {
  addDays,
  dayStat,
  todayStr,
  weekdayOf,
} from "../lib/logic";
import { COULEUR_HABITUDE_PAR_DEFAUT, PALETTE_HABITUDES, derniersJours, serieHabitude } from "../lib/habitudes";
import { useIsPhone } from "../lib/platform";
import { jourDeCocheAffiche } from "../lib/jourDeCoche";
import {
  addHabit,
  createNote,
  recolorerHabitude,
  renommerHabitude,
  setHabitCheck,
  upsertJournal,
} from "../lib/repo";
import type { AppData, Habit } from "../lib/types";
import { IconBolt, IconFlame, IconX } from "../components/icons";
import BarreJours from "../components/BarreJours";
import { CarresHabitude, GrilleHabitudes } from "../components/habitudes/Grilles";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";

import { formatDate, localeTag, t } from "../lib/i18n";
import BadgeExemple from "../components/onboarding/BadgeExemple";
import { CaseACocher, useCochesOptimistes } from "../components/CaseACocher";
import { estExemple } from "../lib/onboarding/exemples";
import MenuContextuel, { BoutonMenu } from "../components/menu/MenuContextuel";
import { useMenuContextuel } from "../components/menu/useMenuContextuel";
import { entreesHabitude, entreesJour } from "../components/menu/catalogue/journal";
import { jeter } from "../components/corbeille/geste";
import ChampRenommage from "../components/taches/ChampRenommage";

interface Props {
  data: AppData;
  refresh: () => Promise<void>;
  navigate: (view: View) => void;
}

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
  /**
   * ⭐ LE JOUR CHOISI (2026-10-13). Tout l'écran s'y rapporte : le texte de
   * l'entrée, et la case de chaque habitude. Aujourd'hui par défaut ; la barre
   * du haut (`BarreJours`) le change. Les petits carrés d'une ligne ne sont
   * plus des boutons : on cochait un autre jour sans le vouloir (Antonin).
   */
  const [jourChoisi, setJourChoisi] = useState(today);
  // Minuit passé, l'app restée ouverte : un jour « choisi » dans le futur
  // n'existe pas — et celui qui regardait aujourd'hui suit le nouveau jour.
  const jour = jourChoisi > today ? today : jourChoisi;
  const dernierAujourdhui = useRef(today);
  useEffect(() => {
    if (dernierAujourdhui.current === today) return;
    setJourChoisi((j) => (j === dernierAujourdhui.current ? today : j));
    dernierAujourdhui.current = today;
  }, [today]);
  const { etat: etatCoche, basculer } = useCochesOptimistes();
  const basculerHabitude = (habitId: number, date: string, reel: boolean) =>
    basculer(`h${habitId}:${date}`, reel, async (coche) => {
      // Le jour « aujourd'hui » se relit AU CLIC (rythme-3) ; un jour choisi
      // dans la barre reste ce jour-là.
      await setHabitCheck(habitId, jourDeCocheAffiche(date, today, todayStr()), coche);
      await refresh();
    });
  const entry = data.journal.find((j) => j.date === jour);
  const [body, setBody] = useState(entry?.body ?? "");
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef<number | undefined>(undefined);
  /** Ce qui attend d'être écrit, AVEC son jour : jamais « le jour courant ». */
  const enAttente = useRef<{ jour: string; body: string } | null>(null);

  const [newHabit, setNewHabit] = useState("");
  const [newColor, setNewColor] = useState(COULEUR_HABITUDE_PAR_DEFAUT);
  /** L'habitude dont le nom est en cours de saisie, sur sa ligne. */
  const [enRenommage, setEnRenommage] = useState<number | null>(null);
  const menuHabitude = useMenuContextuel<Habit>();
  /** Le menu de l'entrée du jour : une seule cible, la carte elle-même. */
  const menuJour = useMenuContextuel<"jour">();

  // resynchronise si l'entrée change (autre jour choisi, autre appareil, reload…)
  useEffect(() => {
    setBody(entry?.body ?? "");
  }, [jour, entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Écrit tout de suite ce qui attendait. ⚠️ Le jour est celui de la FRAPPE
   * (`enAttente`), pas celui qu'on regarde au moment où le minuteur tombe :
   * changer de jour dans les 600 ms aurait écrit le texte du lundi dans le
   * mardi (la leçon du chantier H, 2026-09-06).
   */
  const ecrireEnAttente = async () => {
    window.clearTimeout(saveTimer.current);
    const a = enAttente.current;
    enAttente.current = null;
    if (!a) return;
    await upsertJournal(a.jour, a.body);
    setSaved(true);
    await refresh();
  };

  const save = (b: string) => {
    setSaved(false);
    enAttente.current = { jour, body: b };
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void ecrireEnAttente(), 600);
  };

  // Quitter l'écran dans les 600 ms ne doit pas perdre la dernière phrase.
  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      const a = enAttente.current;
      enAttente.current = null;
      if (a) void upsertJournal(a.jour, a.body);
    },
    [],
  );

  const choisirJour = async (j: string) => {
    if (j === jour || j > today) return;
    await ecrireEnAttente();
    setJourChoisi(j);
  };

  // La série se calcule dans `lib/habitudes.ts` : la carte mentale l'affiche
  // aussi (2026-09-29), et deux calculs finiraient par diverger.
  const habitStreak = (habitId: number): number => serieHabitude(habitId, data.habitChecks, today);

  const handleAddHabit = async () => {
    const name = newHabit.trim();
    if (!name) return;
    await addHabit(name, newColor);
    setNewHabit("");
    await refresh();
  };

  /**
   * Un seul clic : l'habitude part dans « Supprimés récemment » avec son
   * historique de coches, et le toast propose « Annuler ». La croix de la ligne
   * et le menu appellent cette même fonction (règle 18).
   */
  const supprimerHabitude = async (h: Habit) => {
    await jeter("habit", h.id, h.name, refresh);
  };

  /** Le menu et le double-clic sur le nom passent par ces deux-là (règle 18). */
  const validerNom = async (h: Habit, nom: string) => {
    setEnRenommage(null);
    if (nom.trim() && nom.trim() !== h.name) {
      await renommerHabitude(h.id, nom);
      await refresh();
    }
  };
  const recolorer = async (h: Habit, couleur: string) => {
    await recolorerHabitude(h.id, couleur);
    await refresh();
  };

  /**
   * Efface l'entrée du jour CHOISI. ⚠️ L'écriture EN VOL part d'abord : sans elle, le
   * minuteur de 600 ms écrirait APRÈS le jet — et l'`upsert` du journal
   * réanime une entrée en corbeille (voir `upsertJournal`), qui reviendrait
   * donc toute seule. L'entrée est capturée ici, pas relue après l'await.
   */
  const effacerJour = async () => {
    const cible = entry;
    if (!cible) return;
    await ecrireEnAttente();
    await jeter("journal", cible.id, cible.date, refresh);
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

  // Les quatorze derniers jours de chaque habitude, à lire (`lib/habitudes.ts`).
  const isPhone = useIsPhone();
  const joursLigne = useMemo(() => derniersJours(today), [today]);
  const estAujourdhui = jour === today;
  const jourEnLettres = formatDate(new Date(`${jour}T12:00:00`), { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-5xl p-8 telephone:p-4">
      <header className="view-head">
        <h1 className="text-3xl text-text">{t("Habitudes")}</h1>
        <button
          type="button"
          onClick={generateReview}
          data-tip={t("Revue de la semaine")}
          data-tip-sub={t("Crée une note avec les chiffres de la semaine : tâches faites et temps de focus.")}
          className="pill inline-flex items-center gap-1.5 border border-border px-4 py-2 text-sm text-text-dim hover:border-accent/50 hover:text-text"
        >
          <IconBolt className="h-3.5 w-3.5" /> {t("Générer la revue de la semaine")}
        </button>
      </header>

      {/* ⭐ Le jour choisi — aujourd'hui par défaut. Tout ce qui suit s'y rapporte. */}
      <div className="mt-6">
        <BarreJours jour={jour} aujourdhui={today} onChoisir={(j) => void choisirJour(j)} />
        {/* Au téléphone la barre n'a pas la place du bouton « Aujourd'hui ». */}
        {jour !== today && (
          <button
            type="button"
            onClick={() => void choisirJour(today)}
            className="cible-tactile-ligne mt-1 hidden px-2 text-xs font-medium text-accent telephone:block"
          >
            {t("Revenir à aujourd'hui")}
          </button>
        )}
      </div>

      <ResizableGrid gridId="journal" className="mt-4">
      {/* Entrée du jour choisi */}
      <ResizablePanel id="journal-entry" defaultW={12}>
      <section
        className="card group/ligne p-5"
        onContextMenu={(e) => {
          // Dans le champ de texte, le menu natif (couper, coller, orthographe)
          // reste le bon : on ne le remplace pas.
          if ((e.target as HTMLElement).closest("textarea")) return;
          menuJour.ouvrirAuPoint(e, "jour");
        }}
      >
        <div className="rgrid-head flex items-center justify-between">
          <h2 className="hud-label">
            {new Date(`${jour}T12:00:00`).toLocaleDateString(localeTag(), {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>
          <span className="flex items-center gap-1">
            <span className="hud-label">{saved ? t("enregistré") : "…"}</span>
            <BoutonMenu
              onOuvrir={(e) => menuJour.ouvrirSousLeBouton(e, "jour")}
              ouvert={menuJour.ouvert}
              libelle={t("Actions sur l'entrée du jour")}
            />
          </span>
        </div>

        {/* Humeur et énergie retirées le 2026-10-13 (Antonin) : l'entrée du
            jour, c'est son texte. Les colonnes restent en base, intactes. */}
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            save(e.target.value);
          }}
          placeholder={t("Réflexion du jour — qu'est-ce qui s'est passé, qu'est-ce que tu en retires ?")}
          rows={4}
          className="mt-4 w-full resize-none rounded-[10px] border border-border bg-surface-2/60 px-3.5 py-2.5 text-sm leading-relaxed text-text placeholder:text-text-dim focus:border-accent focus:outline-none"
        />
      </section>
      </ResizablePanel>

      {/* Habitudes */}
      <ResizablePanel id="journal-habits" defaultW={12} minH={280}>
      <section className="card p-5 telephone:p-4">
        <div className="rgrid-head flex items-center justify-between">
          <h2 className="hud-label">{t("habitudes — 12 semaines")}</h2>
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
              className="w-40 min-w-0 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-accent focus:outline-none"
            />
            <span className="flex flex-wrap gap-1">
              {PALETTE_HABITUDES.map(({ valeur: c, nom }) => (
                // Le BOUTON fait 44 pt au doigt ; la pastille, elle, garde ses
                // 16 px — d'où la couleur portée par un enfant, pas par lui.
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className="cible-tactile flex h-4 w-4 items-center justify-center rounded-full"
                  aria-label={t("Couleur {name}", { name: t(nom) })}
                  aria-pressed={newColor === c}
                  data-tip={t(nom)}
                  data-tip-sub={t("Couleur de l’habitude")}
                >
                  <span
                    className={`block h-4 w-4 rounded-full ${newColor === c ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                </button>
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
        <GrilleHabitudes habits={data.habits} habitChecks={data.habitChecks} today={today} className="mt-4" />

        {/* Lignes par habitude */}
        <ul className="panel-scroll mt-5 flex flex-col gap-3">
          {data.habits.length === 0 && (
            <li className="py-4 text-center text-sm text-text-dim">
              {t("Ajoute ta première habitude — méditation, sport, lecture…")}
            </li>
          )}
          {data.habits.map((habit) => {
            const enBase = new Set(
              data.habitChecks
                .filter((c) => c.habit_id === habit.id)
                .map((c) => c.date),
            );
            // L'état AFFICHÉ : ce qu'on vient de cliquer, en attendant la base.
            const checks = {
              has: (date: string) => etatCoche(`h${habit.id}:${date}`, enBase.has(date)),
            };
            return (
              <li
                key={habit.id}
                // `flex-wrap` : au téléphone, les jours passent sur leur propre
                // rangée (`order-last w-full`) au lieu d'écraser le nom.
                className="group group/ligne flex flex-wrap items-center gap-x-3 gap-y-1"
                onContextMenu={(e) => menuHabitude.ouvrirAuPoint(e, habit)}
                onKeyDown={(e) => void menuHabitude.ouvrirAuClavier(e, habit)}
              >
                {/* ⭐ LA SEULE COCHE DE LA LIGNE : celle du jour choisi dans la barre. */}
                <CaseACocher
                  cochee={checks.has(jour)}
                  couleur={habit.color}
                  onBascule={() => void basculerHabitude(habit.id, jour, checks.has(jour))}
                  libelle={
                    estAujourdhui
                      ? t("{nom} aujourd'hui", { nom: habit.name })
                      : t("{nom}, {date}", { nom: habit.name, date: jourEnLettres })
                  }
                  tip={habit.name}
                  tipSub={estAujourdhui ? t("Cocher pour aujourd’hui.") : t("Cocher pour le {date}.", { date: jourEnLettres })}
                />
                {/* ⭐ Le nom prend TOUTE la place libre (crible du labo, constat 8).
                    Il était figé à 128 px : « Exemple · habitud… » coupé au
                    bureau à côté d'une ligne vide, et — pire — écrasé à une
                    largeur nulle au téléphone, où les quatorze carrés ne lui
                    laissaient rien. `truncate-souris` : au doigt, pas de bulle
                    pour lire la suite, donc il passe à la ligne. */}
                {enRenommage === habit.id ? (
                  <span className="min-w-0 flex-1">
                    <ChampRenommage
                      valeur={habit.name}
                      libelle={t("Nouveau nom de l'habitude")}
                      onValider={(nom) => void validerNom(habit, nom)}
                      onAnnuler={() => setEnRenommage(null)}
                    />
                  </span>
                ) : (
                  <span
                    className="truncate-souris min-w-0 flex-1 truncate text-sm text-text"
                    title={habit.name}
                    onDoubleClick={() => setEnRenommage(habit.id)}
                  >
                    {habit.name}
                  </span>
                )}
                {/* ⚠️ Pour un exemple, le badge REMPLACE la série. Le cahier des
                    charges interdit qu'une habitude d'exemple affiche 0 %, et
                    l'autre issue — lui fabriquer des coches passées — aurait
                    menti sur l'historique de l'utilisateur. Dès qu'il la coche,
                    elle est adoptée et sa vraie série apparaît. */}
                {estExemple(habit) ? (
                  <BadgeExemple />
                ) : (
                  <span className="pill inline-flex shrink-0 items-center gap-1 bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-text-dim">
                    <IconFlame className="h-2.5 w-2.5" /> {habitStreak(habit.id)}
                  </span>
                )}
                {/* Les quatorze derniers jours, à LIRE : plus aucun carré ne se
                    clique (2026-10-13). Au téléphone ils passent sous le nom,
                    alignés sur lui — à côté, ils l'écrasaient (constat 8). */}
                <CarresHabitude
                  jours={joursLigne}
                  tenue={checks.has}
                  couleur={habit.color}
                  jourChoisi={jour}
                  className={isPhone ? "order-last w-full pb-1.5 pl-8" : ""}
                />
                {/* Au doigt, pas de survol : la croix s'efface devant « ⋯ »,
                    qui porte la même suppression (règle 17). */}
                <button
                  type="button"
                  onClick={() => void supprimerHabitude(habit)}
                  aria-label={t("Supprimer l’habitude")}
                  data-tip={t("Supprimer l’habitude")}
                  data-tip-sub={t("Elle part dans Supprimés récemment avec son historique de coches.")}
                  className="shrink-0 rounded-md px-1.5 text-xs text-text-dim opacity-0 transition-all hover:text-red focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:hidden"
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
                <BoutonMenu
                  onOuvrir={(e) => menuHabitude.ouvrirSousLeBouton(e, habit)}
                  ouvert={menuHabitude.ouvert && menuHabitude.cible?.id === habit.id}
                  libelle={t("Actions sur « {titre} »", { titre: habit.name })}
                />
              </li>
            );
          })}
        </ul>
      </section>
      </ResizablePanel>
      </ResizableGrid>

      <MenuContextuel
        etat={menuJour}
        libelle={t("Actions sur l'entrée du jour")}
        entrees={menuJour.cible ? entreesJour(body, !!entry, { effacer: effacerJour }) : []}
      />
      {/* Recalculé depuis les habitudes fraîches : une habitude effacée
          ailleurs ferme le menu au lieu d'y agir. */}
      <MenuContextuel
        etat={menuHabitude}
        libelle={t("Actions sur « {titre} »", { titre: menuHabitude.cible?.name ?? "" })}
        entrees={(() => {
          const h = menuHabitude.cible && data.habits.find((x) => x.id === menuHabitude.cible!.id);
          if (!h) return [];
          const coche = etatCoche(`h${h.id}:${jour}`, data.habitChecks.some((c) => c.habit_id === h.id && c.date === jour));
          return entreesHabitude(h, coche, {
            // La case de la ligne : le jour CHOISI (règle 18).
            basculer: (x) => void basculerHabitude(x.id, jour, coche),
            renommer: (x) => setEnRenommage(x.id),
            recolorer: (x, c) => void recolorer(x, c),
            supprimer: supprimerHabitude,
          }, estAujourdhui ? null : jourEnLettres);
        })()}
      />
    </div>
  );
}
