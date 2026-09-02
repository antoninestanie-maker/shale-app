import { useCallback, useEffect, useMemo, useState } from "react";
import EventModal from "../components/calendrier/EventModal";
import GrilleHoraire from "../components/calendrier/GrilleHoraire";
import VueAgenda from "../components/calendrier/VueAgenda";
import { IconAlert, IconCalendar, IconChevronLeft, IconChevronRight } from "../components/icons";
import {
  entreesDeLaPlage,
  entreesDuJour,
  grilleDuMois,
  joursEntre,
  moisDe,
  semaineDe,
  type EntreeAgenda,
  type SourcesAgenda,
} from "../lib/calendrier/agenda";
import { chargeDuJour, joursSurcharges } from "../lib/calendrier/charge";
import {
  capaciteDuJour,
  creneauxLibres,
  profilDisponibilite,
} from "../lib/calendrier/disponibilite";
import { objectifsEnPeril } from "../lib/calendrier/peril";
import { addDays, toDateStr, todayStr } from "../lib/logic";
import {
  appliquerReport,
  deleteTask,
  fetchCalendarEvents,
  fetchRecurringEvents,
  setTaskDone,
  setTaskSchedule,
  upsertJournal,
} from "../lib/repo";
import { demandeUneDecision, replanifier, reporter } from "../lib/taches";
import type { AppData, CalendarEvent, Task } from "../lib/types";
import { localeTag, t, tp } from "../lib/i18n";
import { estTelephone, useIsPhone } from "../lib/platform";

/**
 * Le 13ᵉ module — Calendrier.
 *
 * Il ne possède aucune donnée : il RASSEMBLE ce que quatre modules savent déjà
 * (événements, tâches datées, habitudes, échéances d'objectifs) et croise ce
 * que personne ne croisait — le temps qui reste et le travail qui reste.
 *
 * ⚠️ L'app PROPOSE, elle ne place jamais rien toute seule. Les créneaux
 * suggérés sont un fond en pointillé ; c'est Antonin qui dépose.
 */

type Mode = "agenda" | "mois" | "semaine" | "jour";

/** Sur combien de jours la vue agenda déroule. Un mois : au-delà, on planifie. */
const AGENDA_JOURS = 30;

/**
 * Combien d'alertes de chaque famille le bandeau montre avant de compter le
 * reste.
 *
 * ⚠️ Deux, et c'est une leçon d'écran, pas une préférence : avec trois
 * objectifs en péril et une tâche à décider, le bandeau occupait la moitié de
 * la fenêtre et poussait le calendrier hors de vue. Un module de calendrier
 * dont on ne voit pas le calendrier a échoué, même si tout ce qu'il dit est
 * vrai.
 */
const MAX_ALERTES = 2;

/**
 * ⚠️ La table des modes garde ses libellés en FRANÇAIS et les traduit à
 * l'affichage : un `t()` ici serait évalué à l'import, donc figé dans la langue
 * de démarrage.
 */
const MODES: { id: Mode; label: string; aide: string; telephone: boolean }[] = [
  {
    id: "agenda",
    label: "Agenda",
    aide: "Ce qui vient, dans l'ordre où ça vient.",
    telephone: true,
  },
  {
    id: "mois",
    label: "Mois",
    aide: "Vue d'ensemble : ce qui est chargé, ce qui est libre.",
    // ⚠️ Sept colonnes sur six pouces : chaque jour ferait moins de cinquante
    // points et ne montrerait qu'un titre coupé. La vue est retirée du
    // téléphone, pas rétrécie — une forme illisible ne s'améliore pas en
    // devenant plus petite.
    telephone: false,
  },
  {
    id: "semaine",
    label: "Semaine",
    aide: "L'horizon où la planification se décide.",
    telephone: false,
  },
  {
    id: "jour",
    label: "Jour",
    aide: "La grille horaire, pour poser les créneaux.",
    telephone: true,
  },
];

interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

export default function CalendarView({ data, refresh }: Props) {
  const aujourdhui = todayStr();
  const isPhone = useIsPhone();
  /**
   * ⚠️ Deux défauts, parce que ce sont deux usages. Sur le bureau, la SEMAINE :
   * l'horizon où la planification se décide. Sur téléphone, l'AGENDA : on y
   * consulte bien plus qu'on n'y planifie, et sept colonnes n'y tiennent pas.
   */
  const [mode, setMode] = useState<Mode>(() => (estTelephone() ? "agenda" : "semaine"));
  const [curseur, setCurseur] = useState(aujourdhui);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [modale, setModale] = useState<{ event: CalendarEvent | null; jour: string; heure: string | null } | null>(null);

  // Les jours réellement affichés, selon le mode.
  const jours = useMemo(() => {
    if (mode === "jour") return [curseur];
    if (mode === "semaine") return semaineDe(curseur);
    if (mode === "agenda") {
      const fin = new Date(`${curseur}T12:00:00`);
      fin.setDate(fin.getDate() + AGENDA_JOURS - 1);
      return joursEntre(curseur, toDateStr(fin));
    }
    return grilleDuMois(curseur);
  }, [mode, curseur]);

  const chargerEvents = useCallback(async () => {
    // Les récurrents sont chargés à part : leur `date` est celle de la première
    // occurrence, et une fenêtre de dates les raterait s'ils ont commencé
    // l'an dernier.
    const [fenetre, recurrents] = await Promise.all([
      fetchCalendarEvents(jours[0], jours[jours.length - 1]),
      fetchRecurringEvents(),
    ]);
    const vus = new Set(fenetre.map((e) => e.id));
    setEvents([...fenetre, ...recurrents.filter((e) => !vus.has(e.id))]);
  }, [jours]);

  useEffect(() => {
    void chargerEvents();
  }, [chargerEvents]);

  /**
   * ⭐ LE REPORT DES TÂCHES NON FAITES — appliqué à l'ouverture du calendrier.
   *
   * Une tâche datée d'hier et non cochée ne disparaît pas : elle remonte au
   * jour suivant, et son compteur s'incrémente.
   *
   * ⚠️ POURQUOI C'EST SANS DANGER DE LE FAIRE À CHAQUE OUVERTURE : l'opération
   * est IDEMPOTENTE. Une fois la tâche reportée à aujourd'hui, elle n'est plus
   * en retard, donc `reporter()` rend `null` et plus rien ne bouge. Pas besoin
   * d'un drapeau « déjà fait aujourd'hui » dans les réglages — un drapeau
   * mentirait le jour où l'app reste ouverte à cheval sur minuit.
   *
   * ⚠️ `reporter()` refuse de lui-même les récurrentes et celles qui ont atteint
   * le seuil : la règle vit dans `lib/taches.ts`, jamais recopiée ici.
   */
  useEffect(() => {
    let annule = false;
    void (async () => {
      const faites = new Set(
        data.completions.filter((c) => c.done).map((c) => `${c.task_id}:${c.date}`),
      );
      let bouge = false;
      for (const tache of data.tasks) {
        const report = reporter(tache, aujourdhui, faites.has(`${tache.id}:${tache.due_date}`));
        if (!report) continue;
        await appliquerReport(tache.id, report);
        bouge = true;
      }
      if (bouge && !annule) await refresh();
    })();
    return () => {
      annule = true;
    };
  }, [data.tasks, data.completions, aujourdhui, refresh]);

  const sources: SourcesAgenda = useMemo(
    () => ({ events, tasks: data.tasks, completions: data.completions, goals: data.goals }),
    [events, data.tasks, data.completions, data.goals],
  );

  const parJour = useMemo(
    () => entreesDeLaPlage(sources, jours[0], jours[jours.length - 1], aujourdhui),
    [sources, jours, aujourdhui],
  );

  const profil = useMemo(() => profilDisponibilite(data.focusSessions), [data.focusSessions]);
  const surcharges = useMemo(() => joursSurcharges(parJour, profil), [parJour, profil]);
  const peril = useMemo(
    () => objectifsEnPeril(data.goals, data.tasks, data.completions, aujourdhui),
    [data.goals, data.tasks, data.completions, aujourdhui],
  );

  /** Tâches qui ont assez glissé pour qu'on cesse de les reporter en silence. */
  const aDecider = useMemo(
    () =>
      data.tasks.filter(
        (t) => demandeUneDecision(t) && !!t.due_date && t.due_date <= aujourdhui,
      ),
    [data.tasks, aujourdhui],
  );

  const suggestions = useMemo(() => {
    if (mode === "mois") return [];
    return jours.flatMap((jour) =>
      creneauxLibres(profil, parJour.get(jour) ?? [], jour, {
        dureeMin: 60,
        eviterMarche: true,
        limite: mode === "jour" ? 3 : 1,
        pasAvant: jour === aujourdhui ? heureCourante() : undefined,
      }).map((c) => ({ jour, debut: c.debut, fin: c.fin })),
    );
  }, [mode, jours, parJour, profil, aujourdhui]);

  // ─── Gestes ────────────────────────────────────────────────────────────────

  const deplacer = useCallback(
    async (entree: EntreeAgenda, jour: string, heure: string) => {
      if (entree.kind === "task") {
        const tache = data.tasks.find((t) => t.id === entree.id);
        const duree = entree.dureeMin ?? 60;
        const fin = finApres(heure, duree);
        await setTaskSchedule(entree.id, jour, heure, fin);
        // Déplacer à la main n'est pas subir un glissement : le compteur de
        // reports repart de zéro (voir `lib/taches.ts`).
        if (tache && tache.postponed_count > 0) await appliquerReport(entree.id, replanifier(jour));
      } else if (entree.kind === "event") {
        const e = events.find((x) => x.id === entree.id);
        if (!e) return;
        const { updateCalendarEvent } = await import("../lib/repo");
        await updateCalendarEvent(e.id, {
          title: e.title,
          body: e.body,
          date: jour,
          start_at: heure,
          end_at: finApres(heure, entree.dureeMin ?? 60),
          all_day: false,
          color: e.color,
          recurrence: e.recurrence ?? "none",
        });
      }
      await Promise.all([refresh(), chargerEvents()]);
    },
    [data.tasks, events, refresh, chargerEvents],
  );

  const ouvrir = useCallback(
    (entree: EntreeAgenda) => {
      if (entree.kind === "event") {
        const e = events.find((x) => x.id === entree.id);
        if (e) setModale({ event: e, jour: entree.date, heure: null });
      }
    },
    [events],
  );

  const naviguer = useCallback(
    (sens: number) => {
      if (mode === "jour") setCurseur((c) => addDays(c, sens));
      else if (mode === "semaine") setCurseur((c) => addDays(c, 7 * sens));
      else {
        const d = new Date(`${curseur}T12:00:00`);
        d.setMonth(d.getMonth() + sens);
        setCurseur(toDateStr(d));
      }
    },
    [mode, curseur],
  );

  const titre = useMemo(() => {
    const d = new Date(`${curseur}T12:00:00`);
    if (mode === "mois") {
      return d.toLocaleDateString(localeTag(), { month: "long", year: "numeric" });
    }
    if (mode === "jour") {
      return d.toLocaleDateString(localeTag(), { weekday: "long", day: "numeric", month: "long" });
    }
    if (mode === "agenda") {
      // ⚠️ Vu à l'écran sur le simulateur : sans cette branche, l'agenda
      // héritait du titre de la SEMAINE et annonçait « 31 août – 6 sept. » pour
      // une vue qui couvre trente jours. Un en-tête qui ment sur ce qu'on
      // regarde est pire qu'un en-tête absent.
      const fin = new Date(`${curseur}T12:00:00`);
      fin.setDate(fin.getDate() + AGENDA_JOURS - 1);
      return `${d.toLocaleDateString(localeTag(), { day: "numeric", month: "short" })} – ${fin.toLocaleDateString(
        localeTag(),
        { day: "numeric", month: "short" },
      )}`;
    }
    const s = semaineDe(curseur);
    const debut = new Date(`${s[0]}T12:00:00`).toLocaleDateString(localeTag(), { day: "numeric", month: "short" });
    const fin = new Date(`${s[6]}T12:00:00`).toLocaleDateString(localeTag(), { day: "numeric", month: "short" });
    return `${debut} – ${fin}`;
  }, [mode, curseur]);

  return (
    <div className="mx-auto max-w-6xl p-8">
      <header className="view-head">
        <div className="flex items-center gap-3">
          <IconCalendar className="h-6 w-6 text-text-dim" />
          <h1 className="text-3xl capitalize text-text">{titre}</h1>
        </div>
        <button
          type="button"
          onClick={() => setModale({ event: null, jour: curseur, heure: null })}
          data-tip={t("Nouvel événement")}
          data-tip-sub={t("Un rendez-vous, un créneau bloqué, un anniversaire.")}
          className="pill bg-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {t("+ Nouvel événement")}
        </button>
      </header>

      {/* Navigation + modes */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => naviguer(-1)}
            data-tip={t("Précédent")}
            aria-label={t("Précédent")}
            className="pill cible-tactile flex items-center justify-center p-2 text-text-dim hover:bg-overlay hover:text-text"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurseur(aujourdhui)}
            data-tip={t("Revenir à aujourd'hui")}
            className="pill cible-tactile-ligne px-3 py-1.5 text-xs font-medium text-text-dim hover:bg-overlay hover:text-text"
          >
            {t("Aujourd'hui")}
          </button>
          <button
            type="button"
            onClick={() => naviguer(1)}
            data-tip={t("Suivant")}
            aria-label={t("Suivant")}
            className="pill cible-tactile flex items-center justify-center p-2 text-text-dim hover:bg-overlay hover:text-text"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="mx-1 h-4 w-px bg-border" />

        <div className="flex gap-1.5">
          {MODES.filter((m) => !isPhone || m.telephone).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              data-tip={t(m.label)}
              data-tip-sub={t(m.aide)}
              className={`pill cible-tactile-ligne border px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === m.id
                  ? "border-border-strong bg-overlay-2 text-text"
                  : "border-border text-text-dim hover:text-text"
              }`}
            >
              {t(m.label)}
            </button>
          ))}
        </div>
      </div>

      <BandeauIntelligence
        aujourdhui={aujourdhui}
        entreesDuJourCourant={parJour.get(aujourdhui) ?? entreesDuJour(sources, aujourdhui, aujourdhui)}
        profil={profil}
        peril={peril}
        aDecider={aDecider}
        onFait={async (tache) => {
          await setTaskDone(tache.id, aujourdhui, true);
          await refresh();
        }}
        onReplanifier={async (tache, jour) => {
          await appliquerReport(tache.id, replanifier(jour));
          await refresh();
        }}
        onSupprimer={async (tache) => {
          await deleteTask(tache.id);
          await refresh();
        }}
      />

      {/* ⚠️ Si la rotation fait passer en téléphone alors qu'on était en vue
          semaine, on retombe sur l'agenda : rester sur une vue retirée du menu
          laisserait l'utilisateur devant un écran qu'il ne peut plus quitter. */}
      {isPhone && !MODES.find((m) => m.id === mode)?.telephone && (
        <ModeRetombe onRetomber={() => setMode("agenda")} />
      )}

      <section className="card mt-6 overflow-hidden">
        {mode === "agenda" ? (
          <div className="max-h-[70vh] overflow-y-auto" style={{ maxHeight: "calc(70vh * var(--zoom-inv, 1))" }}>
            <VueAgenda
              depuis={curseur}
              jours={AGENDA_JOURS}
              parJour={parJour}
              aujourdhui={aujourdhui}
              onOuvrir={ouvrir}
              onJour={(jour) => {
                setCurseur(jour);
                setMode("jour");
              }}
            />
          </div>
        ) : mode === "mois" ? (
          <VueMois
            jours={jours}
            mois={moisDe(curseur)}
            parJour={parJour}
            surcharges={surcharges}
            aujourdhui={aujourdhui}
            onJour={(jour) => {
              setCurseur(jour);
              setMode("jour");
            }}
          />
        ) : (
          <div className="max-h-[70vh] overflow-y-auto" style={{ maxHeight: "calc(70vh * var(--zoom-inv, 1))" }}>
            <GrilleHoraire
              jours={jours}
              parJour={parJour}
              aujourdhui={aujourdhui}
              suggestions={suggestions}
              onDeposer={deplacer}
              onOuvrir={ouvrir}
              onCreer={(jour, heure) => setModale({ event: null, jour, heure })}
              onJour={(jour) => {
                setCurseur(jour);
                setMode("jour");
              }}
            />
          </div>
        )}
      </section>

      {mode === "jour" && (
        <>
          <CreneauxProposes
            creneaux={suggestions.filter((s) => s.jour === curseur)}
            appris={profil.appris}
            capacite={capaciteDuJour(profil, curseur)}
          />
          <NoteDuJour
            jour={curseur}
            data={data}
            refresh={refresh}
            charge={chargeDuJour(parJour.get(curseur) ?? [], profil, curseur)}
            capacite={capaciteDuJour(profil, curseur)}
            appris={profil.appris}
          />
        </>
      )}

      {modale && (
        <EventModal
          event={modale.event}
          jour={modale.jour}
          heure={modale.heure}
          onClose={() => setModale(null)}
          onSaved={async () => {
            await Promise.all([refresh(), chargerEvents()]);
          }}
        />
      )}
    </div>
  );
}

/** Repli silencieux quand la rotation retire la vue courante du menu. */
function ModeRetombe({ onRetomber }: { onRetomber: () => void }) {
  useEffect(() => {
    onRetomber();
  }, [onRetomber]);
  return null;
}

// ─── Le bandeau d'intelligence ───────────────────────────────────────────────

function BandeauIntelligence({
  aujourdhui,
  entreesDuJourCourant,
  profil,
  peril,
  aDecider,
  onFait,
  onReplanifier,
  onSupprimer,
}: {
  aujourdhui: string;
  entreesDuJourCourant: EntreeAgenda[];
  profil: ReturnType<typeof profilDisponibilite>;
  peril: ReturnType<typeof objectifsEnPeril>;
  aDecider: Task[];
  onFait: (t: Task) => Promise<void>;
  onReplanifier: (t: Task, jour: string) => Promise<void>;
  onSupprimer: (t: Task) => Promise<void>;
}) {
  const charge = chargeDuJour(entreesDuJourCourant, profil, aujourdhui);
  const rien = !charge.surchargee && peril.length === 0 && aDecider.length === 0;
  if (rien) return null;

  return (
    <div className="mt-4 space-y-2">
      {charge.surchargee && (
        <Alerte couleur="yellow">
          <strong>{t("Journée surchargée.")}</strong>{" "}
          {t("{posees} posées pour {capacite} de capacité.", {
            posees: enHeures(charge.posees),
            capacite: enHeures(charge.capacite),
          })}{" "}
          {charge.sansCreneau > 0 &&
            tp(
              charge.sansCreneau,
              "Et {n} tâche sans horaire, qui n'est pas comptée.",
              "Et {n} tâches sans horaire, qui ne sont pas comptées.",
            )}{" "}
          {!profil.appris && (
            <span className="text-text-dim">
              {t("(capacité par défaut — pas encore assez de sessions pour l'apprendre)")}
            </span>
          )}
        </Alerte>
      )}

      {peril.slice(0, MAX_ALERTES).map((p) => (
        <Alerte key={p.goal.id} couleur="red">
          <strong>{p.goal.title}</strong>{" "}
          {p.joursRestants < 0
            ? tp(-p.joursRestants, "échéance dépassée d'{n} jour.", "échéance dépassée de {n} jours.")
            : tp(p.joursRestants, "{n} jour restant, {pct} % fait.", "{n} jours restants, {pct} % fait.", {
                pct: p.progression,
              })}{" "}
          {p.jalonsRestants + p.tachesRestantes > 0 &&
            tp(
              p.jalonsRestants + p.tachesRestantes,
              "{n} jalon non terminé.",
              "{n} jalons non terminés.",
            )}{" "}
          {p.declaratif && (
            <span className="text-text-dim">
              {t("(progression déclarée à la main, pas mesurée)")}
            </span>
          )}
        </Alerte>
      ))}

      {peril.length > MAX_ALERTES && (
        <p className="px-1 text-xs text-text-dim">
          {tp(
            peril.length - MAX_ALERTES,
            "+ {n} autre objectif en péril, dans le module Objectifs.",
            "+ {n} autres objectifs en péril, dans le module Objectifs.",
          )}
        </p>
      )}

      {aDecider.slice(0, MAX_ALERTES).map((tache) => (
        <Alerte key={tache.id} couleur="violet">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              <strong>{tache.label}</strong>{" "}
              {tp(
                tache.postponed_count,
                "prévue le {date}, repoussée {n} fois.",
                "prévue le {date}, repoussée {n} fois.",
                { date: tache.postponed_from ?? tache.due_date ?? "" },
              )}{" "}
              <span className="text-text-dim">
                {t("Une tâche reportée cinq fois n'est pas une tâche, c'est une décision à prendre.")}
              </span>
            </span>
            <span className="ml-auto flex gap-1.5">
              <button type="button" onClick={() => void onFait(tache)} className="pill cible-tactile-ligne border border-border px-2.5 py-1 text-xs hover:bg-overlay">
                {t("La faire maintenant")}
              </button>
              <button
                type="button"
                onClick={() => void onReplanifier(tache, addDays(aujourdhui, 7))}
                className="pill cible-tactile-ligne border border-border px-2.5 py-1 text-xs hover:bg-overlay"
              >
                {t("Replanifier dans 7 jours")}
              </button>
              <button type="button" onClick={() => void onSupprimer(tache)} className="pill cible-tactile-ligne border border-border px-2.5 py-1 text-xs text-text-dim hover:text-red">
                {t("Supprimer")}
              </button>
            </span>
          </div>
        </Alerte>
      ))}
      {aDecider.length > MAX_ALERTES && (
        <p className="px-1 text-xs text-text-dim">
          {tp(
            aDecider.length - MAX_ALERTES,
            "+ {n} autre tâche attend une décision.",
            "+ {n} autres tâches attendent une décision.",
          )}
        </p>
      )}
    </div>
  );
}

function Alerte({ couleur, children }: { couleur: string; children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border p-3 text-sm text-text"
      style={{
        borderColor: `color-mix(in srgb, var(--color-${couleur}) 40%, transparent)`,
        backgroundColor: `color-mix(in srgb, var(--color-${couleur}) 8%, transparent)`,
      }}
    >
      <IconAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: `var(--color-${couleur})` }} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ─── La vue mois ─────────────────────────────────────────────────────────────

function VueMois({
  jours,
  mois,
  parJour,
  surcharges,
  aujourdhui,
  onJour,
}: {
  jours: string[];
  mois: string;
  parJour: ReadonlyMap<string, EntreeAgenda[]>;
  surcharges: Set<string>;
  aujourdhui: string;
  onJour: (jour: string) => void;
}) {
  const enTetes = jours.slice(0, 7);
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border">
        {enTetes.map((jour) => (
          <span key={jour} className="py-2 text-center text-[0.65rem] uppercase tracking-wide text-text-dim">
            {new Date(`${jour}T12:00:00`).toLocaleDateString(localeTag(), { weekday: "short" })}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {jours.map((jour) => {
          const entrees = parJour.get(jour) ?? [];
          const horsMois = jour.slice(0, 7) !== mois;
          return (
            <button
              key={jour}
              type="button"
              onClick={() => onJour(jour)}
              data-tip={t("Ouvrir cette journée")}
              className="min-h-[5.5rem] border-b border-l border-border p-1.5 text-left align-top transition-colors first:border-l-0 hover:bg-overlay"
              style={{ opacity: horsMois ? 0.4 : 1 }}
            >
              <span className="flex items-center gap-1">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.7rem] ${
                    jour === aujourdhui ? "bg-blue font-semibold text-white" : "text-text-dim"
                  }`}
                >
                  {Number(jour.slice(8))}
                </span>
                {surcharges.has(jour) && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: "var(--color-yellow)" }}
                    title={t("Journée surchargée")}
                  />
                )}
              </span>
              <span className="mt-1 block space-y-0.5">
                {entrees.slice(0, 3).map((e) => (
                  <span
                    key={`${e.kind}-${e.id}`}
                    className="block truncate rounded px-1 text-[0.65rem]"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${couleurEntree(e)} 14%, transparent)`,
                      borderLeft: `2px solid ${couleurEntree(e)}`,
                      textDecoration: e.faite ? "line-through" : undefined,
                      opacity: e.faite ? 0.5 : 1,
                    }}
                  >
                    {e.start_at ? `${e.start_at} ` : ""}
                    {e.titre}
                  </span>
                ))}
                {entrees.length > 3 && (
                  <span className="block text-[0.6rem] text-text-dim">
                    {t("+ {n} autres", { n: entrees.length - 3 })}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function couleurEntree(e: EntreeAgenda): string {
  if (e.kind === "deadline") return "var(--color-violet)";
  if (e.enRetard) return "var(--color-red)";
  if (e.kind === "event") return `var(--color-${e.color ?? "blue"})`;
  if (e.kind === "recurrence") return "var(--color-text-dim)";
  return "var(--color-green)";
}

// ─── Les créneaux proposés ───────────────────────────────────────────────────

/**
 * ⚠️ CE PANNEAU EXISTE POUR LE CAS OÙ IL N'Y A RIEN À PROPOSER.
 *
 * Vu à l'écran : un mercredi dont les heures apprises sont déjà occupées ne
 * recevait aucun pointillé, et l'app ne disait rien. Un silence est
 * indiscernable d'une panne — l'utilisateur ne peut pas savoir si le calcul n'a
 * rien trouvé ou s'il n'a pas tourné. On dit donc toujours quelque chose, et
 * surtout POURQUOI.
 */
function CreneauxProposes({
  creneaux,
  appris,
  capacite,
}: {
  creneaux: { debut: string; fin: string }[];
  appris: boolean;
  capacite: number;
}) {
  return (
    <section className="card mt-6 p-5">
      <h2 className="text-sm font-medium uppercase tracking-wide text-text-dim">
        {t("Créneaux libres proposés")}
      </h2>
      {creneaux.length > 0 ? (
        <>
          <ul className="mt-3 flex flex-wrap gap-2">
            {creneaux.map((c) => (
              <li
                key={c.debut}
                className="pill border px-3 py-1.5 text-sm tabular-nums"
                style={{
                  borderColor: "color-mix(in srgb, var(--color-green) 40%, transparent)",
                  color: "var(--color-green)",
                }}
              >
                {c.debut} – {c.fin}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-dim">
            {appris
              ? t("Tes heures les plus souvent tenues, encore libres. À toi de déposer.")
              : t("Heures ouvrées par défaut : l'app n'a pas encore assez de sessions pour apprendre les tiennes.")}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-text-dim">
          {capacite === 0
            ? t("Aucune heure de travail apprise pour ce jour de la semaine.")
            : t("Rien à proposer : tes heures habituelles sont déjà prises ce jour-là.")}
        </p>
      )}
    </section>
  );
}

// ─── La note du jour — le pont entre Journal et Calendrier ───────────────────

function NoteDuJour({
  jour,
  data,
  refresh,
  charge,
  capacite,
  appris,
}: {
  jour: string;
  data: AppData;
  refresh: () => Promise<void>;
  charge: ReturnType<typeof chargeDuJour>;
  capacite: number;
  appris: boolean;
}) {
  const entree = data.journal.find((j) => j.date === jour);
  const [corps, setCorps] = useState(entree?.body ?? "");
  const [enregistre, setEnregistre] = useState(true);

  useEffect(() => {
    setCorps(entree?.body ?? "");
    setEnregistre(true);
  }, [jour, entree?.body]);

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <section className="card p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-text-dim">
          {t("La charge de cette journée")}
        </h2>
        <p className="mt-3 text-2xl text-text">
          {enHeures(charge.posees)}
          <span className="text-base text-text-dim"> / {enHeures(capacite)}</span>
        </p>
        <p className="mt-1 text-xs text-text-dim">
          {appris
            ? t("Capacité apprise de tes sessions de concentration.")
            : t("Capacité par défaut : pas encore assez de sessions pour l'apprendre.")}
        </p>
        {charge.sansCreneau > 0 && (
          <p className="mt-2 text-xs text-text-dim">
            {tp(
              charge.sansCreneau,
              "{n} tâche sans horaire — non comptée, faute de durée connue.",
              "{n} tâches sans horaire — non comptées, faute de durée connue.",
            )}
          </p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-text-dim">
          {t("La note de cette journée")}
        </h2>
        <textarea
          value={corps}
          onChange={(e) => {
            setCorps(e.target.value);
            setEnregistre(false);
          }}
          onBlur={async () => {
            if (enregistre) return;
            await upsertJournal(jour, {
              mood: entree?.mood ?? null,
              energy: entree?.energy ?? null,
              body: corps,
            });
            setEnregistre(true);
            await refresh();
          }}
          rows={4}
          placeholder={t("Ce qui s'est passé ce jour-là…")}
          className="mt-3 w-full resize-none rounded-lg border border-border bg-overlay px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
        />
        <p className="mt-1 text-xs text-text-dim">
          {enregistre ? t("Enregistré.") : t("Non enregistré — sortir du champ enregistre.")}
        </p>
      </section>
    </div>
  );
}

// ─── Petites aides ───────────────────────────────────────────────────────────

function enHeures(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return t("{n} min", { n: m });
  if (m === 0) return t("{n} h", { n: h });
  return `${h} h ${String(m).padStart(2, "0")}`;
}

function finApres(debut: string, dureeMin: number): string {
  const [h, m] = debut.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + dureeMin);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function heureCourante(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
