import { RevueHebdo } from "../components/ia/RevueHebdo";
import { useIaPossible } from "../lib/ia/useIa";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  addDays,
  computeStreak,
  nomCourtDuJour,
  pctOfList,
  streakHistory,
  todayStr,
  todayTasks,
  weekdayOf,
} from "../lib/logic";
import { addMetric, getSetting, setMetricValue, setSetting } from "../lib/repo";
import {
  bornes,
  comparer,
  estPlage,
  focusDansLeTemps,
  lisser,
  minutesDeFocus,
  moyenne,
  parJourDeSemaine,
  pointsDAttention,
  serieHabitudes,
  serieTaches,
  tachesHorsCompte,
  tenueParHabitude,
  PLAGES,
  PLAGE_PAR_DEFAUT,
  type Comparaison,
  type Plage,
  type PointDAttention,
  type PointJour,
} from "../lib/performance/analyse";
import { jourEnClair, plageDeDates } from "../lib/performance/dates";
import { jourEnCours, periodeSansMesure } from "../lib/performance/jour";
import { enHeuresInsecable } from "../lib/performance/durees";
import { CourbeDiscipline, GrilleCarres, LegendeCourbe, type Carre } from "../components/performance/Discipline";
import { RangeeAujourdhui } from "../components/performance/RangeeAujourdhui";
import { serieHabitude } from "../lib/habitudes";
import { allerVers } from "../lib/naviguer";
import type { View } from "../components/Sidebar";
import { fmtR, tradeStats } from "../lib/trades";
import type { AppData, CustomMetric } from "../lib/types";
import { IconFlame, IconTrendDown, IconTrendUp, IconX } from "../components/icons";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";
import { useEntitlements } from "../lib/entitlements";

import { formatDate, localeTag, t, tp } from "../lib/i18n";
import MenuContextuel, { BoutonMenu } from "../components/menu/MenuContextuel";
import { useMenuContextuel, type EtatMenu } from "../components/menu/useMenuContextuel";
import { entreesMetrique } from "../components/menu/catalogue/metrique";
import { jeter } from "../components/corbeille/geste";
interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

/**
 * ⭐ UNE PÉRIODE POUR TOUT L'ONGLET (2026-10-09). Avant, seul le graphique de
 * complétion avait son réglage (jour / semaine / mois) ; les autres cartes
 * regardaient chacune une fenêtre différente (30 jours, 6 mois, « tout »), et
 * deux chiffres voisins ne parlaient pas de la même période.
 * Clés FRANÇAISES : table de module, donc traduite à l'affichage.
 */
const LIBELLE_PLAGE: Record<Plage, { court: string; long: string }> = {
  7: { court: "7 j", long: "7 derniers jours" },
  30: { court: "30 j", long: "30 derniers jours" },
  90: { court: "3 mois", long: "3 derniers mois" },
  180: { court: "6 mois", long: "6 derniers mois" },
};

/** Le réglage qui retient la période choisie (synchronisé : c'est une préférence, pas une géométrie). */
const CLE_PLAGE = "perf.plage";

/** « 08/10 » en français, « 10/08 » en anglais — midi (PIEGES § 4.1). */
function jourCourt(date: string): string {
  const [a, m, j] = date.split("-").map(Number);
  return formatDate(new Date(a, m - 1, j, 12), { day: "2-digit", month: "2-digit" });
}

/** « jeudi » / « Thursday » — même ancrage que `nomCourtDuJour` (le 4 janvier 1970 est un dimanche). */
function nomLongDuJour(jsDay: number): string {
  return new Date(1970, 0, 4 + jsDay, 12).toLocaleDateString(localeTag(), { weekday: "long" });
}

/** Un an de carrés : 53 colonnes de 17 px tiennent dans la carte pleine largeur. */
const SEMAINES_CARRES = 53;

/** Les dernières semaines en colonnes (lundi → dimanche), pour `GrilleCarres`. */
function enSemaines(serie: readonly PointJour[], lundi: string, today: string): Carre[][] {
  const par = new Map(serie.map((p) => [p.date, p.pct]));
  const semaines: Carre[][] = [];
  for (let w = SEMAINES_CARRES - 1; w >= 0; w--) {
    const col: Carre[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(lundi, -7 * w + d);
      col.push({ date, pct: par.get(date) ?? null, futur: date > today, enCours: date === today });
    }
    semaines.push(col);
  }
  return semaines;
}

/**
 * L'écart à la période d'avant : une flèche, un nombre signé, et le rouge quand ça baisse.
 *
 * ⭐ EN POUR CENT, plus en « pts » (2026-10-13, Antonin : « on parle en −3 pts,
 * personne ne comprend, on remplace par des pourcentages »). Le chiffre est le
 * même — 72 % contre 75 % la période d'avant donne « −3 % » — c'est le mot qui
 * change. La bulle donne les deux valeurs, pour qui veut vérifier.
 */
function Ecart({ n, texte }: { n: number | null; texte: (abs: number) => string }) {
  if (n === null) return <span className="text-text-dim">—</span>;
  if (n === 0) return <span className="text-text-dim">{t("stable")}</span>;
  const monte = n > 0;
  return (
    <span className={`flex shrink-0 items-center gap-1 font-medium ${monte ? "text-text" : "text-red"}`}>
      {monte ? <IconTrendUp className="h-3.5 w-3.5" /> : <IconTrendDown className="h-3.5 w-3.5" />}
      {monte ? "+" : "−"}
      {texte(Math.abs(n))}
    </span>
  );
}

/**
 * ⭐ LA MOYENNE DE LA PÉRIODE, DANS SA CARTE (2026-10-12).
 *
 * Antonin, après essai : « Tâches tenues, ce n'est pas nécessaire. Habitudes
 * tenues, c'est bien de l'avoir dans la discipline, mais pas en plus. » Les
 * tuiles sont retirées ; le chiffre, lui, ne quitte pas l'onglet : il est sous
 * le titre de la carte qui trace sa courbe, avec son écart à la même durée
 * juste avant (le principe du 2026-10-09 : un 72 % seul ne dit pas si on
 * progresse).
 *
 * `note` : ce que la moyenne ne compte PAS (« 1 en retard ou reportée, non
 * comptée », A07b-06). « À améliorer » se tire de la même liste.
 */
function MoyenneDePeriode(p: {
  comparaison: Comparaison;
  periode: string;
  periodeAvant: string;
  bulle: string;
  detail: string;
  note?: string | null;
}) {
  const { valeur, avant, ecart } = p.comparaison;
  // La période d'avant, en dates, et ce qu'elle valait — sur l'écart, ou sur
  // la période quand il n'y a pas d'écart à montrer.
  const bulleAvant = {
    "data-tip": t("Période d'avant : {dates}", { dates: p.periodeAvant }),
    "data-tip-sub":
      avant === null
        ? t("Rien de mesuré sur ces jours-là : pas d'écart à donner.")
        : t("{avant} sur ces jours-là, {valeur} sur cette période.", {
            avant: `${avant} %`,
            valeur: valeur === null ? "—" : `${valeur} %`,
          }),
  };
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <p
        className="font-display text-2xl font-extrabold tabular-nums text-text"
        data-tip={p.bulle}
        data-tip-sub={p.detail}
        data-tip-attente="longue"
      >
        {valeur === null ? "—" : `${valeur}%`}
      </p>
      {/* ⚠️ Sans écart à donner, pas de « — » : dans cette ligne il se lisait
          comme un séparateur resté en l'air (vu au téléphone, où aucune bulle
          ne l'explique). La raison passe alors sur la période elle-même. */}
      <p className="text-xs text-text-dim" {...(ecart === null ? bulleAvant : {})}>
        {t("en moyenne")} · {p.periode}
      </p>
      {ecart !== null && (
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-text-dim" {...bulleAvant}>
          <Ecart n={ecart} texte={(abs: number) => `${abs} %`} />
          <span>{t("par rapport à la période d'avant")}</span>
        </p>
      )}
      {p.note && (
        <p className="flex items-baseline gap-1.5 text-xs text-text-dim">
          <span className="h-1.5 w-1.5 shrink-0 -translate-y-px rounded-full bg-yellow" aria-hidden />
          <span className="min-w-0">{p.note}</span>
        </p>
      )}
    </div>
  );
}

function frDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(localeTag(), {
    day: "numeric",
    month: "short",
  });
}

const tooltipStyle = {
  backgroundColor: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--color-text)",
};

function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export default function PerformanceView({ data, refresh }: Props) {
  const iaPossible = useIaPossible();
  // Palier ET profil de licence : le panneau suit le module Trading.
  const hasTrading = useEntitlements().afficheModule("trading");
  const today = todayStr();
  const { tasks, completions, goals, metrics, metricEntries, goalLog } = data;

  const [plage, setPlage] = useState<Plage>(PLAGE_PAR_DEFAUT);
  useEffect(() => {
    getSetting(CLE_PLAGE).then((v) => {
      const n = Number(v);
      if (estPlage(n)) setPlage(n);
    });
  }, []);
  const choisirPlage = (p: Plage) => {
    setPlage(p);
    void setSetting(CLE_PLAGE, String(p));
  };
  const [selGoalId, setSelGoalId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const menuMetrique = useMenuContextuel<CustomMetric>();

  const derived = useMemo(() => {
    const list = todayTasks(tasks, completions, today);
    const todayPct = pctOfList(list);
    const runs = streakHistory(tasks, completions, today, todayPct);
    return {
      liste: list,
      todayPct,
      current: computeStreak(tasks, completions, today, todayPct),
      best: runs.reduce((m, r) => Math.max(m, r.length), 0),
      runs: runs.slice(0, 6),
    };
  }, [tasks, completions, today]);

  /**
   * ⭐ LE JOUR EN COURS, À PART (2026-10-11) — il se voit, et ne se compare à
   * rien. La liste du jour vient de `todayTasks` : c'est elle qui dit ce
   * qu'est « une tâche du jour », pas cette vue.
   */
  const jour = useMemo(
    () =>
      jourEnCours({
        listeDuJour: derived.liste,
        habits: data.habits,
        habitChecks: data.habitChecks,
        focusSessions: data.focusSessions,
        today,
      }),
    [derived.liste, data.habits, data.habitChecks, data.focusSessions, today],
  );

  /**
   * ⭐ TOUTE L'ANALYSE DE LA PÉRIODE, en un seul endroit — et calculée par
   * `lib/performance/analyse.ts`, pas ici. Une période = des jours FINIS (elle
   * s'arrête à hier) ; aujourd'hui n'entre dans aucune moyenne, il est
   * seulement le dernier point des courbes.
   */
  const analyse = useMemo(() => {
    const b = bornes(today, plage);
    const { habits, habitChecks, focusSessions } = data;
    const aujourdHui = { date: today, pct: derived.todayPct };

    // Les moyennes, et celles de la période d'avant.
    const sTaches = serieTaches(tasks, completions, b.debut, b.fin);
    const sHabitudes = serieHabitudes(habits, habitChecks, b.debut, b.fin, today);
    const cTaches = comparer(moyenne(sTaches), moyenne(serieTaches(tasks, completions, b.debutAvant, b.finAvant)));
    const cHabitudes = comparer(
      moyenne(sHabitudes),
      moyenne(serieHabitudes(habits, habitChecks, b.debutAvant, b.finAvant, today)),
    );

    // Les courbes : six jours d'ÉLAN avant la période, sinon la moyenne sur 7
    // jours du premier point ne porterait que sur lui-même.
    const elan = addDays(b.debut, -6);
    // ⚠️ La moyenne s'arrête à HIER : aujourd'hui n'est pas fini, et l'y mettre
    // ferait plonger la courbe chaque matin (vu à l'écran : 20 % à 9 h). Le
    // point du jour reste tracé, sur le trait fin.
    const courbe = (long: PointJour[]) => ({
      points: long.slice(6),
      lisse: [...lisser(long.slice(0, -1)).slice(6), null],
    });
    const courbeTaches = courbe(serieTaches(tasks, completions, elan, today, aujourdHui));
    const courbeHabitudes = courbe(serieHabitudes(habits, habitChecks, elan, today, today));

    // Les carrés : toujours un an — la régularité se lit sur la durée.
    const lundi = addDays(today, weekdayOf(today) === 0 ? -6 : 1 - weekdayOf(today));
    const debutCarres = addDays(lundi, -7 * (SEMAINES_CARRES - 1));
    const carresTaches = enSemaines(serieTaches(tasks, completions, debutCarres, today, aujourdHui), lundi, today);
    const carresHabitudes = enSemaines(serieHabitudes(habits, habitChecks, debutCarres, today, today), lundi, today);

    // Par jour de la semaine : les deux séries côte à côte.
    const semT = parJourDeSemaine(sTaches);
    const semH = parJourDeSemaine(sHabitudes);
    const semaine = semT.map((j, i) => ({ label: nomCourtDuJour(j.jour), taches: j.pct, habitudes: semH[i].pct }));

    // Le focus.
    const focus = minutesDeFocus(focusSessions, b.debut, b.fin);
    // ⭐ Le jour en cours a sa barre (pas « jour »), marquée : elle n'entre
    // dans aucun total, comme le dernier point des courbes.
    const temps = focusDansLeTemps(focusSessions, b.debut, b.fin, today);

    return {
      // ⭐ Chaque chiffre dit sa période (2026-10-11) : ses dates, en clair.
      periode: plageDeDates(b.debut, b.fin, today),
      periodeAvant: plageDeDates(b.debutAvant, b.finAvant, today),
      // Ce que la moyenne des tâches ne compte pas (constat 9 du labo, A07b-06).
      horsCompte: tachesHorsCompte(tasks, completions, today).length,
      sansMesure: periodeSansMesure({ taches: cTaches.valeur, habitudes: cHabitudes.valeur, focus }),
      // Le chiffre du TIMER (« cette semaine » = sept jours glissants,
      // aujourd'hui compris) : donné dans la bulle du total de focus, sur
      // « 7 j » seulement, pour qu'on puisse recouper les deux écrans.
      focusGlissant:
        plage === 7
          ? {
              minutes: minutesDeFocus(focusSessions, addDays(today, -6), today),
              dates: plageDeDates(addDays(today, -6), today, today),
            }
          : null,
      cTaches,
      cHabitudes,
      courbeTaches,
      courbeHabitudes,
      carresTaches,
      carresHabitudes,
      semaine,
      aDesJours: semT.some((j) => j.pct !== null) || semH.some((j) => j.pct !== null),
      focus,
      temps: {
        pas: temps.pas,
        tranches: temps.tranches.map((x) => ({
          label: x.enCours ? t("auj.") : jourCourt(x.debut),
          // Le titre de la bulle : les DATES de la tranche. En pas « semaine »
          // ce sont sept jours depuis le début de la période, pas un
          // lundi → dimanche — d'où les dates plutôt que le mot « semaine ».
          titre: x.enCours ? `${jourEnClair(x.debut)} · ${t("en cours|jour")}` : plageDeDates(x.debut, x.fin, today),
          minutes: x.minutes,
          enCours: !!x.enCours,
        })),
      },
      habitudes: tenueParHabitude(habits, habitChecks, today, plage).map((h) => ({
        ...h,
        serie: serieHabitude(h.habit.id, habitChecks, today),
      })),
      points: pointsDAttention({ tasks, completions, habits, habitChecks, focusSessions, today, plage }),
    };
  }, [data, tasks, completions, today, plage, derived.todayPct]);

  /**
   * Un point d'attention, en clair : UN fait et son chiffre, et le module où
   * agir. ⚠️ Pas de conseil : l'app dit ce qu'elle mesure, pas quoi en faire.
   */
  const lirePoint = (pt: PointDAttention): { texte: string; action?: string; vue?: View } => {
    switch (pt.genre) {
      case "reports":
        return {
          texte: tp(
            pt.n,
            "{n} tâche reportée au moins deux fois, toujours pas faite.",
            "{n} tâches reportées au moins deux fois, toujours pas faites.",
          ),
          action: t("Voir les tâches"),
          vue: "tasks",
        };
      case "habitude":
        return {
          texte:
            pt.avant !== null && pt.avant > pt.pct
              ? t("« {nom} » : tenue {pct} % du temps, contre {avant} % la période d'avant.", { nom: pt.nom, pct: pt.pct, avant: pt.avant })
              : t("« {nom} » : tenue {pct} % du temps.", { nom: pt.nom, pct: pt.pct }),
          action: t("Ouvrir le Journal"),
          vue: "journal",
        };
      case "jour-faible":
        return {
          texte:
            pt.quoi === "taches"
              ? t("Le {jour} : {pct} % de tes tâches faites, contre {moyenne} % en moyenne.", { jour: nomLongDuJour(pt.jour), pct: pt.pct, moyenne: pt.moyenne })
              : t("Le {jour} : {pct} % de tes habitudes tenues, contre {moyenne} % en moyenne.", { jour: nomLongDuJour(pt.jour), pct: pt.pct, moyenne: pt.moyenne }),
          action: t("Voir le calendrier"),
          vue: "calendar",
        };
      case "baisse":
        return {
          texte:
            pt.quoi === "taches"
              ? t("Tâches tenues : {valeur} %, contre {avant} % la période d'avant.", { valeur: pt.valeur, avant: pt.valeur - pt.ecart })
              : t("Habitudes tenues : {valeur} %, contre {avant} % la période d'avant.", { valeur: pt.valeur, avant: pt.valeur - pt.ecart }),
        };
      case "focus":
        return {
          texte: t("Focus : {minutes}, contre {avant} la période d'avant.", { minutes: fmtMinutes(pt.minutes), avant: fmtMinutes(pt.avant) }),
          action: t("Ouvrir le Timer"),
          vue: "timer",
        };
    }
  };

  // Courbe de R cumulé (30 j) live vs backtest
  const equity = useMemo(() => {
    const from = addDays(today, -29);
    const recent = data.trades.filter((t) => t.date >= from);
    const dates: string[] = [];
    for (let i = 29; i >= 0; i--) dates.push(addDays(today, -i));
    let live = 0;
    let backtest = 0;
    const points = dates.map((d) => {
      for (const t of recent.filter((t) => t.date === d)) {
        if ((t.mode ?? "live") === "live") live += t.result_r;
        else backtest += t.result_r;
      }
      return {
        label: d.slice(8) + "/" + d.slice(5, 7),
        live: Math.round(live * 100) / 100,
        backtest: Math.round(backtest * 100) / 100,
      };
    });
    const liveStats = tradeStats(
      recent.filter((t) => (t.mode ?? "live") === "live"),
    );
    const btStats = tradeStats(recent.filter((t) => t.mode === "backtest"));
    return { points, liveStats, btStats };
  }, [data.trades, today]);

  const goalId = selGoalId ?? goals[0]?.id ?? null;
  const goalSeries = useMemo(() => {
    if (goalId === null) return [];
    return goalLog
      .filter((p) => p.goal_id === goalId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({ label: frDate(p.date), pct: p.pct }));
  }, [goalLog, goalId]);

  const handleAddMetric = async () => {
    const name = newName.trim();
    if (!name) return;
    await addMetric(name, newUnit.trim() || null);
    setNewName("");
    setNewUnit("");
    await refresh();
  };

  /**
   * Un seul clic : la métrique part dans « Supprimés récemment » avec son
   * historique, et le toast propose « Annuler ». La croix de la carte et le
   * menu appellent cette même fonction (règle 18).
   */
  const supprimerMetrique = async (m: CustomMetric) => {
    await jeter("metric", m.id, m.name, refresh);
  };

  return (
    <div className="mx-auto max-w-5xl p-8 telephone:p-4">
      <header className="view-head">
        <h1 className="text-3xl text-text">{t("Performance")}</h1>
      </header>

      {/* ⭐ Aujourd'hui se voit, à part : il n'entre dans aucun chiffre plus bas. */}
      <RangeeAujourdhui jour={jour} serie={derived.current} />

      {/* ⭐ La période se choisit UNE fois, ici, pour toutes les cartes — et elle
          écrit ses DATES : des jours finis, aujourd'hui non compris. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p
          className="hud-label"
          data-tip={t("La période analysée : des jours finis")}
          data-tip-sub={t("Elle s'arrête à hier. Aujourd'hui n'est pas terminé : il est montré à part, au-dessus.")}
        >
          {analyse.periode} · {t("jours finis")}
        </p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("Période analysée")}>
          {PLAGES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={plage === p}
              onClick={() => choisirPlage(p)}
              data-tip={t(LIBELLE_PLAGE[p].long)}
              data-tip-sub={t("Tout l'onglet suit cette période, et se compare à la même durée juste avant.")}
              data-tip-attente="longue"
              className={`pill cible-tactile inline-flex items-center justify-center border px-3 py-1 text-xs font-medium transition-colors ${
                plage === p ? "border-text/30 bg-surface-2 text-text" : "border-border text-text-dim hover:text-text"
              }`}
            >
              {t(LIBELLE_PLAGE[p].court)}
            </button>
          ))}
        </div>
      </div>

      <ResizableGrid gridId="performance" className="mt-3">
      {/* ⭐ À AMÉLIORER — ce que la période fait ressortir, en trois lignes au
          plus. Des faits chiffrés, jamais des conseils (`pointsDAttention`). */}
      <ResizablePanel id="perf-analyse" defaultW={12}>
      <section className="card p-5">
        <div className="rgrid-head flex items-center justify-between gap-2">
          <h2 className="hud-label">{t("À améliorer")}</h2>
          <span className="shrink-0 text-[11px] text-text-dim">{analyse.periode}</span>
        </div>
        {analyse.points.length === 0 ? (
          // ⚠️ « Rien ne décroche » sur une période VIDE se lisait comme un bon
          // point, le matin d'un compte neuf (constat 2 du labo).
          <p className="mt-3 text-sm text-text-dim">
            {analyse.sansMesure ? t("Rien de mesuré sur cette période.") : t("Rien ne décroche sur cette période.")}
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {analyse.points.map((pt, i) => {
              const l = lirePoint(pt);
              return (
                <li key={`${pt.genre}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] bg-overlay px-3 py-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow" aria-hidden />
                  <span className="min-w-0 flex-1 basis-[14rem] text-sm text-text">{l.texte}</span>
                  {l.vue && (
                    <button
                      type="button"
                      onClick={() => allerVers(l.vue!)}
                      className="cible-tactile-ligne shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent hover:underline"
                    >
                      {l.action}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      </ResizablePanel>

      {/* La revue hebdomadaire (IA de Shale Pro, phase G). RETIRÉE de la grille
          sans Shale Pro et sur iOS — pas seulement masquée : un panneau caché
          resterait dans les chips « + <titre> » sous la grille. */}
      {iaPossible && (
        <ResizablePanel id="perf-revue-ia" defaultW={12}>
          <RevueHebdo data={data} refresh={refresh} />
        </ResizablePanel>
      )}

      {/* ⭐ La discipline des TÂCHES : la courbe (tendance) ET les carrés
          (régularité). Elle remplace les barres « Complétion des tâches ». */}
      <ResizablePanel id="perf-discipline" defaultW={12}>
      <section className="card p-5">
        <div className="rgrid-head flex flex-wrap items-center justify-between gap-2">
          <h2 className="hud-label shrink-0">{t("discipline — tâches")}</h2>
          <LegendeCourbe
            seuil={t("80 % : jour tenu")}
            seuilAide={{
              titre: t("Un jour est tenu quand 80 % des tâches dues sont faites"),
              detail: t("C'est le seuil des séries de jours tenus."),
            }}
          />
        </div>
        {/* ⭐ La moyenne de la période et son écart vivent ICI (2026-10-12) :
            la tuile « Tâches tenues » est retirée, pas le chiffre. */}
        <MoyenneDePeriode
          comparaison={analyse.cTaches}
          periode={analyse.periode}
          periodeAvant={analyse.periodeAvant}
          bulle={t("La part des tâches du jour faites, en moyenne sur les jours finis")}
          detail={t("Chaque jour : les routines dues, et les tâches ponctuelles cochées ce jour-là. Une tâche en retard ou reportée ne pèse sur aucun jour.")}
          // …et ce que la moyenne laisse de côté, tant qu'il y en a : « 100 % »
          // ne se lit pas au-dessus de « 1 tâche reportée, toujours pas faite »
          // sans que la carte le dise (A07b-06).
          note={
            analyse.horsCompte > 0
              ? tp(analyse.horsCompte, "{n} en retard ou reportée, non comptée", "{n} en retard ou reportées, non comptées")
              : null
          }
        />
        <CourbeDiscipline className="mt-3" points={analyse.courbeTaches.points} lisse={analyse.courbeTaches.lisse} seuil={80} />
        <p className="hud-label mb-2 mt-5">{t("régularité — un carré par jour")}</p>
        <GrilleCarres semaines={analyse.carresTaches} zeroEnRouge vide={t("rien de dû")} zero={t("rien de fait")} />
      </section>
      </ResizablePanel>

      {/* ⭐ La discipline des HABITUDES (celles du Journal) : jusqu'ici elles
          n'apparaissaient nulle part dans Performance. */}
      <ResizablePanel id="perf-habitudes" defaultW={12}>
      <section className="card p-5">
        <div className="rgrid-head flex flex-wrap items-center justify-between gap-2">
          <h2 className="hud-label shrink-0">{t("discipline — habitudes")}</h2>
          {analyse.habitudes.length > 0 && <LegendeCourbe />}
        </div>
        {analyse.habitudes.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-dim">
            {t("Ajoute une habitude dans le Journal pour suivre ta régularité ici.")}
          </p>
        ) : (
          <>
            <MoyenneDePeriode
              comparaison={analyse.cHabitudes}
              periode={analyse.periode}
              periodeAvant={analyse.periodeAvant}
              bulle={t("La part des habitudes cochées, en moyenne sur les jours finis")}
              detail={t("Une habitude compte à partir du jour de sa première coche.")}
            />
            <CourbeDiscipline className="mt-3" points={analyse.courbeHabitudes.points} lisse={analyse.courbeHabitudes.lisse} />
            <p className="hud-label mb-2 mt-5">{t("régularité — un carré par jour")}</p>
            <GrilleCarres semaines={analyse.carresHabitudes} vide={t("aucune tenue")} />
            {/* Une ligne par habitude : c'est elle qui dit LAQUELLE décroche. */}
            <ul className="mt-5 flex flex-col gap-2.5">
              {analyse.habitudes.map((h) => (
                <li key={h.habit.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex min-w-0 flex-1 basis-[9rem] items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: h.habit.color }} aria-hidden />
                    <span className="truncate truncate-souris text-xs text-text" title={h.habit.name}>
                      {h.habit.name}
                    </span>
                  </span>
                  <div className="pill h-2 min-w-[5rem] flex-[2_1_8rem] overflow-hidden bg-surface-2">
                    <div className="pill h-full" style={{ width: `${h.pct ?? 0}%`, backgroundColor: h.habit.color }} />
                  </div>
                  <span className="w-28 shrink-0 text-right font-mono text-xs text-text">
                    {h.pct === null ? "—" : `${t("{tenus}/{comptes} j", { tenus: h.tenus, comptes: h.comptes })} · ${h.pct}%`}
                  </span>
                  <span
                    className="flex w-10 shrink-0 items-center justify-end gap-0.5 text-xs text-text-dim"
                    data-tip={tp(h.serie, "{n} jour d'affilée", "{n} jours d'affilée")}
                  >
                    <IconFlame className="h-3 w-3" />
                    {h.serie}
                  </span>
                  <span className="flex w-16 shrink-0 justify-end text-xs">
                    <Ecart n={h.pct !== null && h.avant !== null ? h.pct - h.avant : null} texte={(abs: number) => `${abs} %`} />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      </ResizablePanel>

      {/* ⭐ Par jour de la semaine : OÙ ça décroche. */}
      <ResizablePanel id="perf-semaine" defaultW={6} minH={220}>
      <section className="card p-5">
        <div className="rgrid-head flex flex-wrap items-center justify-between gap-2">
          <h2 className="hud-label shrink-0">{t("par jour de la semaine")}</h2>
          <span className="shrink-0 text-[11px] text-text-dim">{analyse.periode}</span>
        </div>
        {/* ⚠️ La légende n'est PAS dans l'en-tête : titre + dates + légende ne
            tenaient pas sur une ligne avec la barre de poignées, et la carte
            grandissait au survol (2026-10-12). Sa ligne à elle, sous le titre,
            à la même place que le total de la carte voisine. */}
        <p className="mt-2 flex h-5 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-dim">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-[var(--color-success-fill)]" aria-hidden />
            {t("tâches")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px] bg-accent" aria-hidden />
            {t("habitudes")}
          </span>
        </p>
        {!analyse.aDesJours ? (
          <p className="py-6 text-center text-sm text-text-dim">{t("Rien à comparer sur cette période.")}</p>
        ) : (
          <div className="panel-chart mt-3 min-h-[150px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={150}>
              <BarChart data={analyse.semaine} margin={{ top: 4, right: 0, bottom: 0, left: -24 }} barGap={2}>
                <CartesianGrid stroke="var(--color-overlay)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--color-text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: "var(--color-text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-overlay)" }}
                  contentStyle={tooltipStyle}
                  formatter={(v, nom) => [v == null ? "—" : `${v}%`, nom === "taches" ? t("tâches") : t("habitudes")]}
                />
                <Bar dataKey="taches" fill="var(--color-success-fill)" radius={[3, 3, 3, 3]} maxBarSize={14} />
                <Bar dataKey="habitudes" fill="var(--color-accent)" radius={[3, 3, 3, 3]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      </ResizablePanel>

      {/* ⭐ Le focus dans le temps : le rythme, pas seulement le total. */}
      <ResizablePanel id="perf-focus-temps" defaultW={6} minH={220}>
      <section className="card p-5">
        <div className="rgrid-head flex flex-wrap items-center justify-between gap-2">
          <h2 className="hud-label shrink-0">
            {/* « Par tranche de 7 jours », pas « par semaine » : ces tranches
                partent du début de la période, pas d'un lundi. */}
            {analyse.temps.pas === "jour" ? t("focus — par jour") : t("focus — par tranche de 7 jours")}
          </h2>
          <span className="shrink-0 text-[11px] text-text-dim">{analyse.periode}</span>
        </div>
        {/* ⭐ Le total de la période vit ICI (2026-10-12) : la tuile « Focus »
            est retirée. Sa bulle dit toujours d'où vient l'écart avec la tuile
            « cette semaine » du Timer. */}
        <p
          className="mt-2 flex h-5 items-baseline gap-1.5 text-[11px] text-text-dim"
          data-tip={analyse.focus > 0 ? t("Le temps des séances de concentration terminées, sur les jours finis") : undefined}
          data-tip-sub={
            analyse.focus === 0
              ? undefined
              : analyse.focusGlissant
                ? t("Le Timer compte autrement : sept jours glissants, aujourd'hui compris ({dates}) — {total}.", {
                    dates: analyse.focusGlissant.dates,
                    // Insécable : dans une bulle étroite, « 8 h 15 » se coupait en « 8 / h 15 ».
                    total: enHeuresInsecable(analyse.focusGlissant.minutes),
                  })
                : t("Aujourd'hui n'y est pas : ses séances sont dans la rangée du haut.")
          }
          data-tip-attente="longue"
        >
          {/* Rien à additionner : la ligne garde sa hauteur (les deux cartes
              voisines restent alignées), le message plus bas dit le reste. */}
          {analyse.focus > 0 && (
            <>
              <span className="font-display text-base font-extrabold tabular-nums text-text">{enHeuresInsecable(analyse.focus)}</span>
              {t("au total")}
            </>
          )}
        </p>
        {analyse.focus === 0 && jour.focus.minutes === 0 ? (
          <p className="py-6 text-center text-sm text-text-dim">{t("Aucune séance de focus sur cette période.")}</p>
        ) : analyse.focus === 0 && analyse.temps.pas === "semaine" ? (
          // Le jour en cours n'a pas de barre parmi des tranches de sept jours :
          // on dit ce qu'il porte, plutôt qu'« aucune séance ».
          <p className="py-6 text-center text-sm text-text-dim">
            {t("Aucune séance sur les jours finis de cette période. Aujourd'hui : {duree}.", { duree: enHeuresInsecable(jour.focus.minutes) })}
          </p>
        ) : (
          <div className="panel-chart mt-3 min-h-[150px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={150}>
              <BarChart data={analyse.temps.tranches} margin={{ top: 4, right: 0, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--color-overlay)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--color-text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fill: "var(--color-text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-overlay)" }}
                  contentStyle={tooltipStyle}
                  labelFormatter={(label, lignes) => (lignes?.[0]?.payload as { titre?: string } | undefined)?.titre ?? String(label ?? "")}
                  formatter={(v) => [fmtMinutes(Number(v ?? 0)), t("focus")]}
                />
                <Bar dataKey="minutes" fill="var(--color-success-fill)" radius={[3, 3, 3, 3]} maxBarSize={22}>
                  {/* Aujourd'hui, plus clair : un jour pas fini, hors de tout total. */}
                  {analyse.temps.tranches.map((x, i) => (
                    <Cell
                      key={i}
                      fill={x.enCours ? "color-mix(in srgb, var(--color-success-fill) 40%, transparent)" : "var(--color-success-fill)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      </ResizablePanel>

      {/* Les séries de jours tenus — UN mot pour la chose : « série » (le
          titre disait « streaks », la tuile « série » ; constat 28 du labo). */}
      <ResizablePanel id="perf-streaks" defaultW={6} minH={200}>
        <section className="card p-5">
          <div className="rgrid-head flex flex-wrap items-center justify-between gap-2">
            <h2
              className="hud-label shrink-0"
              data-tip={t("Un jour est tenu quand 80 % des tâches dues sont faites")}
              data-tip-sub={t("Une série, ce sont des jours tenus qui se suivent. Un jour sans tâche due ne la casse pas.")}
            >
              {t("Séries de jours tenus")}
            </h2>
            {/* Le record était sous la tuile « Jours tenus d'affilée » ; la
                série en cours est maintenant dans la rangée « Aujourd'hui ». */}
            {derived.best > 0 && <span className="shrink-0 text-[11px] text-text-dim">{t("record {n} j", { n: derived.best })}</span>}
          </div>
          {derived.runs.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-dim">
              {t("Pas encore de série. Elle commence le premier jour où 80 % des tâches dues sont faites.")}
            </p>
          ) : (
            <ul className="panel-scroll mt-3 flex flex-col gap-2.5">
              {derived.runs.map((run) => (
                <li key={run.start} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-text-dim">
                    {frDate(run.start)} → {frDate(run.end)}
                  </span>
                  <div className="pill h-2 flex-1 overflow-hidden bg-surface-2">
                    <div
                      className="pill h-full bg-success"
                      style={{
                        width: `${Math.min((run.length / Math.max(derived.best, 1)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-display text-sm font-bold text-text">
                    {t("{n} j", { n: run.length })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </ResizablePanel>

      {/* Progression des objectifs */}
      <ResizablePanel id="perf-goals" defaultW={6}>
        <section className="card p-5">
          <div className="rgrid-head flex items-center justify-between gap-2">
            <h2 className="shrink-0 hud-label">
              {t("Objectifs")}
            </h2>
            {goals.length > 0 && (
              <select
                value={goalId ?? ""}
                onChange={(e) => setSelGoalId(Number(e.target.value))}
                className="min-w-0 flex-1 truncate rounded-[10px] border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none"
              >
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          {goalSeries.length < 2 ? (
            <p className="py-6 text-center text-sm text-text-dim">
              {t("L'historique se construit au fil des jours — reviens demain.")}
            </p>
          ) : (
            <div className="panel-chart mt-3 min-h-[150px]">
              <ResponsiveContainer width="100%" height="100%" minHeight={150}>
                <ComposedChart data={goalSeries} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id="goalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-overlay)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [`${v ?? 0}%`, t("progression")]}
                  />
                  <Area
                    type="monotone"
                    dataKey="pct"
                    stroke="var(--color-accent)"
                    strokeWidth={2.5}
                    fill="url(#goalFill)"
                    activeDot={{ r: 4, fill: "var(--color-accent)" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </ResizablePanel>

      {/* Trading : R cumulé live vs backtest — réservé à Shale Trade.
          Rendu conditionnel (et non `display:none`) : la grille masonry ne doit
          pas se voir réserver une empreinte pour un panneau sans droit. */}
      {hasTrading && (
      <ResizablePanel id="perf-trading" defaultW={12}>
      <section className="card p-5">
        <div className="rgrid-head flex items-center justify-between">
          <h2 className="hud-label">{t("trading — r cumulé 30 jours")}</h2>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-text-dim">
              <span className="h-2 w-2 rounded-full bg-accent" /> live{" "}
              <span className="font-mono font-semibold text-text">
                {fmtR(equity.liveStats.totalR)}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-text-dim">
              <span className="h-2 w-2 rounded-full bg-yellow" /> backtest{" "}
              <span className="font-mono font-semibold text-text">
                {fmtR(equity.btStats.totalR)}
              </span>
            </span>
          </div>
        </div>
        {equity.liveStats.count + equity.btStats.count === 0 ? (
          <p className="py-6 text-center text-sm text-text-dim">
            {t("Aucun trade sur 30 jours — la courbe apparaîtra ici.")}
          </p>
        ) : (
          <div className="panel-chart mt-3 min-h-[150px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={150}>
              <ComposedChart
                data={equity.points}
                margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
              >
                <defs>
                  <linearGradient id="perfLiveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-overlay)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, name) => [
                    `${v ?? 0}R`,
                    name === "live" ? "live" : "backtest",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="live"
                  stroke="var(--color-accent)"
                  strokeWidth={2.5}
                  fill="url(#perfLiveFill)"
                />
                <Line
                  type="monotone"
                  dataKey="backtest"
                  stroke="var(--color-yellow)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      </ResizablePanel>
      )}

      {/* Métriques custom */}
      <ResizablePanel id="perf-metrics" defaultW={12}>
      <section>
        {/* flex-wrap + min-w-0 : en fenêtre étroite le formulaire passe sous le
            titre et les champs rétrécissent au lieu de déborder du panneau (où
            l'`overflow-x: clip` du wrap les rendait invisibles/incliquables).
            En plein écran il y a la place : aucun rétrécissement, rendu inchangé. */}
        <div className="rgrid-head flex flex-wrap items-center justify-between gap-2">
          <h2 className="hud-label">
            {t("Métriques")}
          </h2>
          <form
            className="flex min-w-0 flex-wrap items-center justify-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleAddMetric();
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("Nouvelle métrique…")}
              className="w-44 min-w-0 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-accent focus:outline-none"
            />
            <input
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder={t("unité")}
              className="w-20 min-w-0 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-accent focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="pill shrink-0 bg-surface-2 px-3 py-1.5 text-xs font-medium text-text disabled:opacity-40"
            >
              {t("Ajouter")}
            </button>
          </form>
        </div>

        {metrics.length === 0 ? (
          <div className="card mt-3 p-8 text-center text-sm text-text-dim">
            {/* Les exemples de trading ne s'affichent que là où le module existe
                (mis de côté depuis le 2026-09-30). */}
            {hasTrading
              ? t("Suis ce qui compte pour toi : heures de backtesting, trades pris, reels publiés…")
              : t("Suis ce qui compte pour toi : heures de lecture, séances de sport, pages écrites…")}
          </div>
        ) : (
          <div className="auto-tiles-lg mt-3 gap-4">
            {metrics.map((m) => (
              <MetricCard
                key={m.id}
                metric={m}
                entries={metricEntries.filter((e) => e.metric_id === m.id)}
                today={today}
                onDelete={() => void supprimerMetrique(m)}
                menu={menuMetrique}
                onSave={async (value) => {
                  await setMetricValue(m.id, today, value);
                  await refresh();
                }}
              />
            ))}
          </div>
        )}
      </section>
      </ResizablePanel>
      </ResizableGrid>

      <MenuContextuel
        etat={menuMetrique}
        libelle={t("Actions sur « {titre} »", { titre: menuMetrique.cible?.name ?? "" })}
        entrees={(() => {
          const m = menuMetrique.cible && metrics.find((x) => x.id === menuMetrique.cible!.id);
          return m ? entreesMetrique(m, { supprimer: supprimerMetrique }) : [];
        })()}
      />
    </div>
  );
}

function MetricCard({
  metric,
  entries,
  today,
  onDelete,
  onSave,
  menu,
}: {
  metric: CustomMetric;
  entries: { date: string; value: number }[];
  today: string;
  onDelete: () => void;
  menu: EtatMenu<CustomMetric>;
  onSave: (value: number) => Promise<void>;
}) {
  const todayValue = entries.find((e) => e.date === today)?.value ?? 0;
  const [draft, setDraft] = useState<string>(String(todayValue));

  const last14 = useMemo(() => {
    const byDate = new Map(entries.map((e) => [e.date, e.value]));
    const out: { label: string; value: number }[] = [];
    const [y, m, d] = today.split("-").map(Number);
    for (let i = 13; i >= 0; i--) {
      const date = new Date(y, m - 1, d - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      out.push({ label: key.slice(8), value: byDate.get(key) ?? 0 });
    }
    return out;
  }, [entries, today]);

  const total7 = last14.slice(7).reduce((a, e) => a + e.value, 0);

  const save = () => {
    const v = parseFloat(draft.replace(",", "."));
    if (!Number.isNaN(v)) onSave(v);
  };

  return (
    <div
      className="card group group/ligne p-4"
      onContextMenu={(e) => {
        // Dans le champ de valeur, le menu natif (coller…) reste le bon.
        if ((e.target as HTMLElement).closest("input")) return;
        menu.ouvrirAuPoint(e, metric);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-text-dim">{metric.name}</p>
        <span className="-mr-1 -mt-1 flex shrink-0 items-center">
          {/* Au doigt, pas de survol : la croix s'efface devant « ⋯ », qui
              porte la même suppression (règle 17). */}
          <button
            type="button"
            onClick={onDelete}
            className="shrink-0 rounded-md px-1 text-xs text-text-dim opacity-0 transition-colors hover:text-red focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:hidden"
            aria-label={t("Supprimer {name}", { name: metric.name })}
            data-tip={t("Supprimer la métrique")}
            data-tip-sub={t("Elle part dans Supprimés récemment avec tout son historique.")}
          >
            <IconX className="h-3 w-3" />
          </button>
          <BoutonMenu
            onOuvrir={(e) => menu.ouvrirSousLeBouton(e, metric)}
            ouvert={menu.ouvert && menu.cible?.id === metric.id}
            libelle={t("Actions sur « {titre} »", { titre: metric.name })}
          />
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-extrabold text-text">
          {todayValue}
        </span>
        {metric.unit && (
          <span className="text-xs text-text-dim">{t("{unite} aujourd'hui", { unite: metric.unit })}</span>
        )}
      </div>
      {/* Un total hebdomadaire porte ses DATES : ici sept jours glissants,
          aujourd'hui compris — ce n'est pas la période de l'onglet. */}
      <p className="mt-0.5 text-[11px] text-text-dim" data-tip={t("Sept jours, aujourd'hui compris")}>
        {Math.round(total7 * 10) / 10}
        {metric.unit ? ` ${metric.unit}` : ""} · {plageDeDates(addDays(today, -6), today, today)}
      </p>

      <div className="mt-2 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={last14} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Bar dataKey="value" radius={[2, 2, 2, 2]} fill="var(--color-success-fill)" maxBarSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          inputMode="decimal"
          className="w-full min-w-0 flex-1 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none"
          aria-label={t("Valeur du jour pour {name}", { name: metric.name })}
        />
        <button
          type="button"
          onClick={() => {
            const v = (parseFloat(draft.replace(",", ".")) || 0) + 1;
            setDraft(String(v));
            onSave(v);
          }}
          className="pill shrink-0 bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text hover:bg-border"
          aria-label={`+1 ${metric.unit ?? ""}`}
          data-tip={t("Incrémenter")}
          data-tip-sub={t("Ajoute 1 à la valeur du jour et l’enregistre.")}
        >
          +1
        </button>
        <button
          type="submit"
          className="pill shrink-0 fill-primary px-3 py-1.5 text-sm font-semibold"
        >
          OK
        </button>
      </form>
    </div>
  );
}
