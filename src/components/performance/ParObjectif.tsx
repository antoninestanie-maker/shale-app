import { useEffect, useMemo, useState } from "react";
import { formaterDansPhrase } from "../../lib/calendrier/champDate";
import { pick, t, tp } from "../../lib/i18n";
import { todayStr, weekdayOf } from "../../lib/logic";
import { allerVers, ouvrirParId } from "../../lib/naviguer";
import { estExemple } from "../../lib/onboarding/exemples";
import { plageDeDates } from "../../lib/performance/dates";
import {
  enHeures,
  enHeuresInsecable,
  heuresPourChamp,
  lireHeures,
  tableauParObjectif,
  type FaitEcheance,
  type LigneObjectif,
  type Semaine,
  type SemaineMesuree,
} from "../../lib/performance/parObjectif";
import { chargerPromesses, enregistrerPromesse } from "../../lib/performance/promessesAcces";
import type { AppData } from "../../lib/types";
import { IconChevronRight } from "../icons";
import BadgeExemple from "../onboarding/BadgeExemple";

/**
 * ⭐ « PAR OBJECTIF » — UN ESSAI (2026-10-11). Les heures passées sur chaque
 * objectif cette semaine, face aux heures qu'on lui a promises.
 *
 * Tout le calcul est dans `lib/performance/parObjectif.ts` ; ce fichier
 * n'affiche que ce qu'il rend. L'essai se retire d'un bloc — la liste des
 * endroits est en tête de ce fichier-là.
 *
 * CE QUE L'ÉCRAN S'INTERDIT
 *   • aucun rouge sur une promesse pas tenue, aucun mot de reproche : sans
 *     promesse la ligne ne montre que le temps passé, avec elle ce qu'il reste ;
 *   • aucune promesse tracée sur une semaine passée (la base ne connaît que
 *     celle d'aujourd'hui) ;
 *   • aucune liste de tâches : la vue Tâches reçoit un rangement par objectif,
 *     un lien vers l'objectif suffit ici ;
 *   • aucun pronostic sur l'échéance : des faits, ou ce que le Calendrier dit déjà.
 */
export default function ParObjectif({ data }: { data: AppData }) {
  const today = todayStr();
  const [promesses, setPromesses] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let vivant = true;
    void chargerPromesses().then((p) => {
      if (vivant) setPromesses(p);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const tableau = useMemo(
    () =>
      tableauParObjectif({
        goals: data.goals,
        tasks: data.tasks,
        completions: data.completions,
        habits: data.habits,
        habitChecks: data.habitChecks,
        focusSessions: data.focusSessions,
        promesses,
        today,
      }),
    [data.goals, data.tasks, data.completions, data.habits, data.habitChecks, data.focusSessions, promesses, today],
  );

  /** Le seul geste d'écriture de l'onglet. N'écrit que si la valeur change (`enregistrerPromesse`). */
  const promettre = async (uid: string, heures: number) => {
    try {
      const { promesses: suite } = await enregistrerPromesse(uid, heures);
      setPromesses(suite);
    } catch {
      /* l'écriture a échoué : le champ garde l'ancienne valeur, rien n'est affiché de faux */
    }
  };

  const dates = plageDeDates(tableau.semaine.debut, tableau.semaine.fin, today);

  return (
    <div className="mt-5 flex flex-col gap-3">
      {/* ⭐ La semaine dit ses dates : trois « cette semaine » cohabitent dans
          l'app, et celle-ci (lundi → dimanche) n'est pas celle du Timer. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 px-1">
        <div
          className="min-w-0"
          data-tip={t("Du lundi au dimanche, aujourd'hui compris")}
          data-tip-sub={t("Le Timer, lui, compte sept jours glissants : les deux totaux ne coïncident que le dimanche.")}
          data-tip-attente="longue"
        >
          <h2 className="hud-label">{t("Semaine du {dates}", { dates })}</h2>
          <p className="text-xs text-text-dim">{t("lundi → dimanche, aujourd'hui compris")}</p>
        </div>
        <p className="flex shrink-0 items-baseline gap-2">
          <span className="hud-label">{t("au minuteur")}</span>
          <span className="font-display text-xl font-extrabold tabular-nums text-text">{enHeures(tableau.total)}</span>
        </p>
      </div>

      {/* Sans minuteur, tout est à zéro : la limite connue, dite en une ligne. */}
      {tableau.semaineSansMinuteur && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] bg-overlay px-3 py-2 text-sm text-text-dim">
          <span className="min-w-0 flex-1 basis-[12rem]">{t("Les heures viennent du minuteur.")}</span>
          <button
            type="button"
            onClick={() => allerVers("timer")}
            className="cible-tactile-ligne shrink-0 rounded-md px-2 py-1 text-xs font-medium text-blue hover:underline"
          >
            {t("Ouvrir le Timer")}
          </button>
        </p>
      )}

      {tableau.lignes.length === 0 ? (
        <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 p-5 text-sm text-text-dim">
          <span className="min-w-0 flex-1 basis-[12rem]">{t("Aucun objectif pour l'instant.")}</span>
          <button
            type="button"
            onClick={() => allerVers("goals")}
            className="cible-tactile-ligne shrink-0 rounded-md px-2 py-1 text-xs font-medium text-blue hover:underline"
          >
            {t("Ouvrir les Objectifs")}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {tableau.lignes.map((l) => (
            <Ligne
              key={l.goal.id}
              ligne={l}
              semaine={tableau.semaine}
              max={tableau.maxSemaine}
              today={today}
              onPromettre={(h) => promettre(l.uid, h)}
            />
          ))}
        </ul>
      )}

      {/* « Hors objectif » : montré, jamais réparti. Total = lignes + ceci. */}
      {(tableau.horsObjectif.minutes > 0 || tableau.horsObjectif.passees.some((s) => s.minutes > 0)) && (
        <section className="card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3
              className="hud-label"
              data-tip={t("Le temps du minuteur sans objectif")}
              data-tip-sub={t("Séances sans tâche, ou dont la tâche n'est rattachée à aucun objectif. Montré, jamais réparti.")}
            >
              {t("hors objectif")}
            </h3>
            <span className="font-display text-xl font-extrabold tabular-nums text-text">
              {enHeures(tableau.horsObjectif.minutes)}
            </span>
          </div>
          <Semaines
            passees={tableau.horsObjectif.passees}
            courante={{ ...tableau.semaine, minutes: tableau.horsObjectif.minutes }}
            max={tableau.maxSemaine}
            today={today}
          />
        </section>
      )}
    </div>
  );
}

// ─── Une ligne : un objectif ─────────────────────────────────────────────────

function Ligne({
  ligne,
  semaine,
  max,
  today,
  onPromettre,
}: {
  ligne: LigneObjectif;
  semaine: Semaine;
  max: number;
  today: string;
  onPromettre: (heures: number) => Promise<void>;
}) {
  const { goal, minutes, promesse } = ligne;
  const part = promesse ? Math.min(100, Math.round((minutes / (promesse * 60)) * 100)) : 0;

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* Les tâches de l'objectif ne sont pas listées ici : on y va. */}
        <button
          type="button"
          onClick={() => ouvrirParId("goal", goal.id)}
          className="cible-tactile-ligne group/titre flex min-w-0 flex-1 basis-[12rem] items-center gap-1.5 text-left"
          data-tip={t("Ouvrir l'objectif")}
        >
          <span className="truncate truncate-souris text-sm font-semibold text-text" title={goal.title}>
            {goal.title}
          </span>
          {estExemple(goal) && <BadgeExemple />}
          <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-text-dim transition-colors group-hover/titre:text-text" />
        </button>
        <ChampPromesse titre={goal.title} promesse={promesse} onPromettre={onPromettre} />
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="shrink-0 font-display text-2xl font-extrabold tabular-nums text-text">
          {enHeures(minutes)}
          {promesse != null && (
            <span className="ml-1.5 font-body text-sm font-medium text-text-dim">/ {enHeures(promesse * 60)}</span>
          )}
        </p>
        <p className="min-w-0 text-xs text-text-dim">
          {promesse == null ? (
            t("cette semaine")
          ) : ligne.tenue ? (
            <span className="font-medium text-success">{t("promesse tenue")}</span>
          ) : ligne.premiereSemaine ? (
            <span
              data-tip={t("Objectif créé cette semaine")}
              data-tip-sub={t("Sa première semaine est entamée : ce qu'il reste d'ici dimanche s'affichera à partir de lundi.")}
            >
              {t("première semaine")}
            </span>
          ) : weekdayOf(today) === 0 ? (
            t("reste {duree} d'ici ce soir", { duree: enHeuresInsecable(ligne.reste ?? 0) })
          ) : (
            t("reste {duree} d'ici dimanche", { duree: enHeuresInsecable(ligne.reste ?? 0) })
          )}
        </p>
      </div>

      {/* La jauge de la semaine — seulement s'il y a une promesse à laquelle la
          rapporter. Bleu de marque en cours, encre une fois tenue (DESIGN.md). */}
      {promesse != null && (
        <div className="pill mt-2 h-2 overflow-hidden bg-surface-2" aria-hidden>
          <div
            className={`pill h-full ${ligne.tenue ? "bg-success" : ""}`}
            style={{ width: `${part}%`, ...(ligne.tenue ? {} : { background: "var(--gradient-brand)" }) }}
          />
        </div>
      )}

      <Semaines passees={ligne.passees} courante={{ ...semaine, minutes }} max={max} today={today} moyenne={ligne.moyennePassee} />

      <Echeance fait={ligne.echeance} promesse={promesse} today={today} />
    </li>
  );
}

// ─── Le champ des heures promises ────────────────────────────────────────────

/**
 * Modifiable sur place. Vide = pas de promesse. La valeur n'est écrite qu'à la
 * sortie du champ ou sur Entrée, et seulement si elle change ; une saisie
 * illisible rend l'ancienne valeur. Échap annule.
 */
function ChampPromesse({
  titre,
  promesse,
  onPromettre,
}: {
  titre: string;
  promesse: number | null;
  onPromettre: (heures: number) => Promise<void>;
}) {
  const virgule = pick(",", ".");
  const [brouillon, setBrouillon] = useState<string | null>(null);
  const valeur = brouillon ?? heuresPourChamp(promesse, virgule);

  const valider = () => {
    if (brouillon === null) return;
    const heures = lireHeures(brouillon);
    setBrouillon(null);
    if (heures === null) return; // illisible : l'ancienne valeur revient
    if (heures === (promesse ?? 0)) return; // rien n'a changé : rien à écrire
    void onPromettre(heures);
  };

  return (
    <label className="flex shrink-0 items-center gap-2 text-xs text-text-dim">
      <input
        value={valeur}
        onChange={(e) => setBrouillon(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={valider}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            // Une couche au-dessus a déjà pris cet Échap : on n'y touche pas.
            if (e.defaultPrevented) return;
            if (brouillon === null) return;
            e.preventDefault();
            setBrouillon(null);
          }
        }}
        inputMode="decimal"
        autoComplete="off"
        placeholder="—"
        aria-label={t("Heures promises par semaine à « {titre} »", { titre })}
        data-tip={t("Heures promises par semaine")}
        data-tip-sub={t("Vide : pas de promesse, la ligne ne montre que le temps passé.")}
        className="cible-tactile w-16 rounded-[10px] border border-border bg-surface-2 px-2.5 py-1.5 text-right text-sm tabular-nums text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
      />
      <span className="whitespace-nowrap">{t("h par semaine")}</span>
    </label>
  );
}

// ─── Les semaines précédentes, en barres à l'encre ───────────────────────────

/**
 * Une barre par semaine où l'objectif existait, la plus ancienne à gauche ; la
 * semaine en cours en dernier, plus claire (elle n'est pas finie). L'échelle
 * est COMMUNE à toutes les lignes : deux objectifs se comparent d'un coup d'œil.
 *
 * ⚠️ Aucun trait de promesse : on ne connaît que celle d'aujourd'hui.
 */
function Semaines({
  passees,
  courante,
  max,
  today,
  moyenne,
}: {
  passees: readonly SemaineMesuree[];
  courante: SemaineMesuree;
  max: number;
  today: string;
  moyenne?: number | null;
}) {
  if (passees.length === 0) return null;
  const hauteur = 36;
  const barre = (minutes: number) => (minutes <= 0 || max <= 0 ? 0 : Math.max(2, Math.round((minutes / max) * hauteur)));

  return (
    <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
      <ol className="flex items-end gap-1" style={{ height: hauteur }} aria-label={t("Semaines précédentes")}>
        {[...passees, courante].map((s, i) => {
          const enCours = i === passees.length;
          const libelle = `${plageDeDates(s.debut, s.fin, today)} · ${enHeures(s.minutes)}`;
          return (
            <li
              key={s.debut}
              className="flex h-full w-3.5 items-end"
              aria-label={enCours ? `${libelle} (${t("semaine en cours")})` : libelle}
              data-tip={libelle}
              data-tip-sub={enCours ? t("semaine en cours") : undefined}
            >
              <span
                className="block w-full rounded-[3px]"
                style={
                  s.minutes > 0
                    ? {
                        height: barre(s.minutes),
                        backgroundColor: enCours
                          ? "color-mix(in srgb, var(--color-success-fill) 40%, transparent)"
                          : "var(--color-success-fill)",
                      }
                    : // Une semaine à zéro reste visible : un trait, pas un vide.
                      { height: 2, backgroundColor: "var(--color-border-strong)" }
                }
              />
            </li>
          );
        })}
      </ol>
      <p className="min-w-0 text-[11px] text-text-dim">
        {tp(passees.length, "{n} semaine précédente", "{n} semaines précédentes")}
        {moyenne != null && passees.length > 1 && <> · {t("{duree} en moyenne", { duree: enHeuresInsecable(moyenne) })}</>}
        {passees.length === 1 && <> · {enHeuresInsecable(passees[0].minutes)}</>}
      </p>
    </div>
  );
}

// ─── L'échéance : des faits ──────────────────────────────────────────────────

function Echeance({ fait, promesse, today }: { fait: FaitEcheance; promesse: number | null; today: string }) {
  if (!fait) return null;

  // En péril ou dépassée : les MOTS du Calendrier (mêmes clés de traduction),
  // sur la mesure de `calendrier/peril.ts`. Rien n'est recalculé ici.
  if (fait.genre === "peril") {
    const p = fait.peril;
    const restant = p.etapesRestantes + p.tachesRestantes;
    return (
      <p className="mt-3 text-xs text-red">
        {p.joursRestants < 0
          ? tp(-p.joursRestants, "échéance dépassée d'{n} jour.", "échéance dépassée de {n} jours.")
          : tp(p.joursRestants, "{n} jour restant, {pct} % fait.", "{n} jours restants, {pct} % fait.", { pct: p.progression })}{" "}
        {restant > 0 && tp(restant, "{n} étape ou tâche restante.", "{n} étapes ou tâches restantes.")}{" "}
        {p.declaratif && <span className="text-text-dim">{t("(progression déclarée à la main, pas mesurée)")}</span>}
      </p>
    );
  }

  const date = formaterDansPhrase(fait.echeance, today);
  return (
    <p className="mt-3 text-xs text-text-dim">
      {fait.joursRestants === 0
        ? t("Échéance aujourd'hui.")
        : fait.semaines === 0
          ? tp(fait.joursRestants, "{n} jour d'ici le {date}", "{n} jours d'ici le {date}", { date })
          : tp(fait.semaines, "{n} semaine pleine d'ici le {date}", "{n} semaines pleines d'ici le {date}", { date })}
      {fait.heures != null && promesse != null && fait.semaines > 0 && (
        <>
          {" · "}
          {t("à {heures} par semaine, cela fait {total}", {
            heures: enHeuresInsecable(promesse * 60),
            total: enHeuresInsecable(fait.heures * 60),
          })}
        </>
      )}
    </p>
  );
}
