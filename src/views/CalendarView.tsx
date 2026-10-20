import { useCallback, useEffect, useMemo, useState } from "react";
import EventModal from "../components/calendrier/EventModal";
import GrilleHoraire, { creneauSous } from "../components/calendrier/GrilleHoraire";
import VueAgenda from "../components/calendrier/VueAgenda";
import { IconAlert, IconCalendar, IconChevronLeft, IconChevronRight } from "../components/icons";
import {
  DUREE_DEFAUT_MIN,
  bandesDu,
  dansLeBandeau,
  entreesDeLaPlage,
  entreesDuJour,
  finApres,
  grilleDuMois,
  joursEntre,
  moisDe,
  semaineDe,
  type EntreeAgenda,
  type EcheanceFacture,
  type SourcesAgenda,
} from "../lib/calendrier/agenda";
import { echeancesDuCalendrier } from "../lib/finance/facturation/relances";
import { FINANCE_ACTIF } from "../lib/features";
import { chargeDuJour, joursSurcharges } from "../lib/calendrier/charge";
import { alertesDeplieesAuTelephone, retenirAlertesDepliees, retenirVue, vueAOuvrir } from "../lib/calendrier/memoire";
import {
  capaciteDuJour,
  creneauxLibres,
  profilDisponibilite,
} from "../lib/calendrier/disponibilite";
import { blocsDuJour, optionsDuProfil } from "../lib/onboarding/horaires";
import { useHoraires } from "../lib/onboarding/useHoraires";
import { formaterDansPhrase } from "../lib/calendrier/champDate";
import { AGENDA_JOURS, curseurApres } from "../lib/calendrier/navigation";
import { jourDeCocheTache } from "../lib/jourDeCoche";
import { useSourcesProgression } from "../lib/objectifs/useProgression";
import { objectifsEnPeril } from "../lib/calendrier/peril";
import { addDays, toDateStr, todayStr } from "../lib/logic";
import {
  appliquerReport,
  basculerTache,
  createTask,
  fetchCalendarEvents,
  fetchFacturation,
  fetchRecurringEvents,
  setTaskSchedule,
  upsertJournal,
} from "../lib/repo";
import { replanifier, reportsAAppliquer, tachesADecider } from "../lib/taches";
import type { AppData, CalendarEvent, Task } from "../lib/types";
import { formatHeure, localeTag, t, tp } from "../lib/i18n";
import { useIsPhone } from "../lib/platform";
import MenuContextuel from "../components/menu/MenuContextuel";
import { useMenuContextuel } from "../components/menu/useMenuContextuel";
import {
  entreesCreneau,
  entreesEvenement,
  gestesCommunsEvenement,
} from "../components/menu/catalogue/evenement";
import { entreesTache, gestesCommunsTache } from "../components/menu/catalogue/tache";
import { jeter } from "../components/corbeille/geste";
import { consommerDemande, ouvrirParId } from "../lib/naviguer";
import { useEntitlements } from "../lib/entitlements";
import { useIaPossible } from "../lib/ia/useIa";
import { demanderIa } from "../lib/ia/demande";
import { IconeIa } from "../components/ia/IconeIa";
import { afficherToast } from "../lib/toast";
import { useGesteFocus } from "../lib/seance/gesteFocus";
import type { EntreePossible } from "../lib/menu/entrees";
import PointAction from "../components/PointAction";
import { useActions } from "../lib/pointAction/contexte";
import { cleObjectif, cleTache } from "../lib/pointAction/regle";
import { BadgeDEntree } from "../components/taches/BadgeEtat";

/**
 * Ce sur quoi le menu du Calendrier est ouvert. Des IDENTIFIANTS, jamais des
 * objets : les entrées sont recalculées depuis les données fraîches à chaque
 * rendu, et un objet effacé entre-temps par la synchronisation ferme le menu
 * au lieu d'agir sur un fantôme.
 */
type CibleCalendrier =
  | { type: "event"; id: number }
  | { type: "task"; id: number; date: string }
  | { type: "creneau"; jour: string; heure: string };

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

// La même union que `ModeCalendrier` (`calendrier/navigation.ts`), dont la
// règle de « Précédent / Suivant » et `AGENDA_JOURS` viennent.
type Mode = import("../lib/calendrier/memoire").VueCalendrier;

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
    // ⭐ Rendue au téléphone le 2026-10-13 (Antonin : « la vue par défaut doit
    // être celle de semaine, pareil sur le téléphone, c'est plus lisible »).
    // Elle en avait été retirée pour ses sept colonnes de moins de cinquante
    // points ; la grille s'y resserre (`compact`), et l'agenda reste à un
    // toucher pour lire les titres en entier.
    telephone: true,
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
   * ⭐ LA SEMAINE PARTOUT (2026-10-13, Antonin). Jusque-là le téléphone
   * s'ouvrait sur l'AGENDA (« on y consulte plus qu'on n'y planifie ») ; il a
   * tranché : la semaine est plus lisible, au téléphone aussi.
   * ⭐ Et une vue CHOISIE est retenue pour la session (`lib/calendrier/memoire.ts`,
   * constat 17 du 20/10) : revenir au module ne la reprend plus.
   */
  const [mode, setMode] = useState<Mode>(() => vueAOuvrir(isPhone));
  const [curseur, setCurseur] = useState(aujourdhui);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [modale, setModale] = useState<{ event: CalendarEvent | null; jour: string; heure: string | null } | null>(null);
  /**
   * ⭐ LE MOUVEMENT COURANT — ce qui relance l'animation sans rien remonter.
   *
   * `tour` alterne le nom de l'image clé (voir `cal-glisse-a` / `-b` dans
   * `index.css`) : une animation CSS ne se rejoue pas si on lui redonne le
   * même nom, et la parade habituelle — changer la `key` React — détruirait et
   * reconstruirait toute la grille. Or c'est précisément ce coût-là qu'on
   * cherche à masquer, pas à doubler : un changement de semaine reconstruit
   * déjà 112 cellules, mesuré entre 23 et 40 ms.
   *
   * `sens` vaut -1, 0 ou +1 : la période suivante entre par la droite, la
   * précédente par la gauche, et 0 signifie « fondu sans direction » — un
   * changement de vue ne va nulle part.
   */
  const [mouvement, setMouvement] = useState({ tour: 0, sens: 0 });

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
   * ⭐ Ouvrir un rendez-vous demandé ailleurs — une mention, « Cité dans »
   * (2026-10-20, audit complet, constat 5). Avant, le calendrier s'ouvrait sur
   * la semaine du jour, sous les alertes, sans rien montrer. La demande peut
   * avoir été DÉPOSÉE avant que la vue (chargée en `lazy`) soit montée
   * (`lib/naviguer.ts`).
   */
  useEffect(() => {
    let vivant = true;
    const ouvrir = async (id: number) => {
      // Tous les événements : celui qu'on cherche peut être loin de la semaine
      // affichée. La table est petite ; la recherche n'a lieu qu'à la demande.
      const tous = await fetchCalendarEvents("0000-01-01", "9999-12-31");
      const ev = tous.find((x) => x.id === id);
      if (!ev || !vivant) return;
      setCurseur(ev.date);
      setModale({ event: ev, jour: ev.date, heure: null });
    };
    const surDemande = (e: Event) => void ouvrir((e as CustomEvent<number>).detail);
    window.addEventListener("sb:open-event", surDemande);
    const enAttente = consommerDemande("event");
    if (enAttente != null) void ouvrir(enAttente);
    return () => {
      vivant = false;
      window.removeEventListener("sb:open-event", surDemande);
    };
  }, []);

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
      const reports = reportsAAppliquer(data.tasks, data.completions, aujourdhui);
      for (const { id, report } of reports) await appliquerReport(id, report);
      if (reports.length > 0 && !annule) await refresh();
    })();
    return () => {
      annule = true;
    };
  }, [data.tasks, data.completions, aujourdhui, refresh]);

  /**
   * ⭐ Les échéances de facturation (migration 023).
   *
   * ⚠️ Chargées ICI, et pas par `fetchAll` : le calendrier ne possède aucune
   * donnée, il RASSEMBLE — et faire porter les factures par `AppData`
   * obligerait chaque écran de l'app à les transporter pour rien.
   */
  const [echeances, setEcheances] = useState<EcheanceFacture[]>([]);
  useEffect(() => {
    let annule = false;
    void (async () => {
      const f = await fetchFacturation().catch(() => null);
      if (annule || !f) return;
      // Finance mise de côté (`FINANCE_ACTIF`) : aucune échéance de facture dans l'agenda.
      setEcheances(FINANCE_ACTIF ? echeancesDuCalendrier(f.factures, f.paiements, f.tiers, aujourdhui) : []);
    })();
    return () => {
      annule = true;
    };
  }, [aujourdhui]);

  const sources: SourcesAgenda = useMemo(
    () => ({
      events,
      tasks: data.tasks,
      completions: data.completions,
      goals: data.goals,
      echeances,
    }),
    [events, data.tasks, data.completions, data.goals, echeances],
  );

  const parJour = useMemo(
    () => entreesDeLaPlage(sources, jours[0], jours[jours.length - 1], aujourdhui),
    [sources, jours, aujourdhui],
  );

  // ⭐ Les heures déclarées à l'accueil nourrissent enfin le repli et les
  // créneaux (2026-10-20, audit, constat 7 — `lib/onboarding/horaires.ts`).
  const horaires = useHoraires();
  const profil = useMemo(
    () => profilDisponibilite(data.focusSessions, optionsDuProfil(horaires)),
    [data.focusSessions, horaires],
  );
  // Éviter les sessions de marché n'a de sens que pour qui a Market Brain.
  // ⚠️ Corrigé le 2026-09-30 : c'était `true` pour TOUT LE MONDE. Or Sydney,
  // Tokyo, Londres et New York se relaient sans trou du lundi au vendredi
  // (heure de Paris : 23 h → 23 h), donc aucune proposition de créneau en
  // semaine, pour personne — y compris sans l'offre Trade.
  const eviterMarche = useEntitlements().afficheModule("market");
  const ia = useIaPossible();
  const surcharges = useMemo(() => joursSurcharges(parJour, profil), [parJour, profil]);
  const sourcesObjectifs = useSourcesProgression(data);
  const peril = useMemo(
    () =>
      // Les sources complètes (arêtes, événements rattachés, l'heure), comme la
      // page de l'objectif (objectifs-1, 2026-10-20).
      objectifsEnPeril(data.goals, data.tasks, data.completions, aujourdhui, sourcesObjectifs),
    [data.goals, data.tasks, data.completions, aujourdhui, sourcesObjectifs],
  );

  /**
   * Tâches qui ont assez glissé pour qu'on cesse de les reporter en silence.
   * ⚠️ Pas celles qui sont FAITES : « La faire maintenant » laissait le bandeau
   * en place (2026-10-09). La règle vit dans `lib/taches.ts`.
   */
  const aDecider = useMemo(
    () => tachesADecider(data.tasks, data.completions, aujourdhui),
    [data.tasks, data.completions, aujourdhui],
  );

  const suggestions = useMemo(() => {
    // ⚠️ La grille horaire seulement — et, au téléphone, la vue Jour seulement
    // (2026-10-13) : dans une colonne de quarante-cinq points le cadre n'a pas
    // la place de dire « Créneau libre », et un pointillé muet est exactement
    // ce qu'Antonin a pris pour un défaut.
    if (mode === "mois" || mode === "agenda") return [];
    if (isPhone && mode !== "jour") return [];
    return jours
      // ⚠️ Jamais dans le PASSÉ : on ne propose pas de travailler lundi dernier.
      // Seul aujourd'hui était borné (`pasAvant`) ; les jours d'avant recevaient
      // leur créneau comme les autres.
      .filter((jour) => jour >= aujourdhui)
      .flatMap((jour) =>
        creneauxLibres(profil, parJour.get(jour) ?? [], jour, {
          dureeMin: 60,
          eviterMarche,
          limite: mode === "jour" ? 3 : 1,
          pasAvant: jour === aujourdhui ? heureCourante() : undefined,
          bloques: blocsDuJour(horaires, jour),
        }).map((c) => ({ jour, debut: c.debut, fin: c.fin })),
      );
  }, [mode, jours, parJour, profil, aujourdhui, eviterMarche, isPhone, horaires]);

  // ─── Gestes ────────────────────────────────────────────────────────────────

  const deplacer = useCallback(
    async (entree: EntreeAgenda, jour: string, heure: string) => {
      if (entree.kind === "task") {
        const tache = data.tasks.find((t) => t.id === entree.id);
        const duree = entree.dureeMin ?? DUREE_DEFAUT_MIN;
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
          // ⚠️ La PLAGE suit l'événement. Seul un événement d'une journée peut
          // être saisi dans la grille — les multi-jours vivent dans le bandeau,
          // qui n'a pas de poignée — mais recopier `end_date` tel quel
          // inverserait les bornes le jour où ce ne serait plus vrai. On
          // translate l'écart, ou on rend `null`.
          end_date: e.end_date && e.end_date > e.date
            ? addDays(jour, joursEntre(e.date, e.end_date).length - 1)
            : null,
          start_at: heure,
          end_at: finApres(heure, entree.dureeMin ?? DUREE_DEFAUT_MIN),
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

  // ─── Le menu contextuel ─────────────────────────────────────────────────────
  const menu = useMenuContextuel<CibleCalendrier>();
  const apresEvenement = useCallback(async () => {
    await Promise.all([refresh(), chargerEvents()]);
  }, [refresh, chargerEvents]);
  const communsEvenement = gestesCommunsEvenement(apresEvenement);
  const communsTache = gestesCommunsTache(apresEvenement);
  // « Focus 25 min » manquait au menu d'une tâche du Calendrier (2026-10-12).
  const gesteFocus = useGesteFocus();

  /**
   * ⭐ UN SEUL ÉCOUTEUR pour toute la grille, pas un par bloc : il reconnaît
   * l'entrée à son `data-entree`, le créneau vide à son `data-jour` et son
   * `data-heure`. Le code de glisser-déposer de `GrilleHoraire`, qui a déjà
   * coûté plusieurs pièges, n'a pas été touché.
   *
   * Les échéances (objectifs, factures) n'ont pas de menu ici : elles
   * appartiennent à leur module, où le leur existe.
   */
  /** Ce qu'un bloc désigne pour le menu — `null` : il n'en a pas ici (une échéance). */
  const cibleDuBloc = (kind: string, id: number, date: string): CibleCalendrier | null => {
    if (kind === "event" && events.some((x) => x.id === id)) return { type: "event", id };
    if ((kind === "task" || kind === "recurrence") && data.tasks.some((x) => x.id === id))
      return { type: "task", id, date };
    return null;
  };

  const surClicDroit = (e: React.MouseEvent) => {
    const cible = e.target as Element;
    const bloc = cible.closest<HTMLElement>("[data-entree]");
    if (bloc) {
      const [kind, idTexte, date] = (bloc.dataset.entree ?? "").split(":");
      const c = cibleDuBloc(kind, Number(idTexte), date);
      if (c) menu.ouvrirAuPoint(e, c);
      return;
    }
    // Le MÊME calcul que le clic sur un créneau (`creneauSous`) : l'heure sous
    // le pointeur, à la minute près. `data-heure` seul ne porte que « 14 ».
    const creneau = creneauSous(e.clientX, e.clientY);
    if (creneau) menu.ouvrirAuPoint(e, { type: "creneau", ...creneau });
  };

  /**
   * ⭐ LE MÊME MENU, AU DOIGT : un maintien sur le bloc (2026-10-13). Le clic
   * droit n'existe pas sur un téléphone, et `ouvrirAuPoint` y est muet exprès
   * (`lib/menu/tactile.ts`) ; le menu s'ancre donc sur le bloc lui-même.
   */
  const surMaintien = (entree: EntreeAgenda, el: HTMLElement) => {
    const c = cibleDuBloc(entree.kind, entree.id, entree.date);
    if (c) menu.ouvrirSurElement(el, c);
  };

  const entreesDuMenu = (): EntreePossible[] => {
    const c = menu.cible;
    if (!c) return [];
    if (c.type === "event") {
      const ev = events.find((x) => x.id === c.id);
      if (!ev) return [];
      return entreesEvenement(ev, {
        ...communsEvenement,
        // La MÊME fenêtre que le clic sur l'événement (règle 18).
        modifier: (x) => setModale({ event: x, jour: x.date, heure: null }),
      });
    }
    if (c.type === "task") {
      const tache = data.tasks.find((x) => x.id === c.id);
      if (!tache) return [];
      const recurrente = !!tache.recurrence && tache.recurrence !== "none";
      // Faite CE jour-là pour une récurrente ; faite tout court pour une
      // ponctuelle — la règle de `basculerTache`.
      const faite = data.completions.some(
        (x) => x.task_id === tache.id && !!x.done && (!recurrente || x.date === c.date),
      );
      return entreesTache(
        tache,
        {
          ...communsTache,
          // ⭐ Une ponctuelle se coche À AUJOURD'HUI, comme partout ailleurs
          // (Tâches, Aujourd'hui, « La faire maintenant ») : la date du bloc
          // réécrivait un jour passé (0 tâche → 1/1) ou envoyait la coche dans
          // le futur (temps-3, 2026-10-20). Une récurrente se coche jour par
          // jour : son occurrence, c'est la date du bloc.
          basculer: (x) => void basculerTache(x, jourDeCocheTache(x, c.date, todayStr()), !faite).then(apresEvenement),
          renommer: () => undefined, // omis : `renommable: false`
          modifier: (x) => ouvrirParId("task", x.id),
          focus: gesteFocus,
        },
        { faite, objectifs: data.goals, renommable: false, ia },
      );
    }
    return entreesCreneau(c.jour, c.heure, {
      // La même fenêtre qu'un clic sur un créneau vide.
      nouvelEvenement: (jour, heure) => setModale({ event: null, jour, heure }),
      nouvelleTache: async (jour, heure) => {
        const id = await createTask({
          label: t("Nouvelle tâche"),
          tag: null,
          priority: "medium",
          recurrence: "none",
          goal_id: null,
          due_date: jour,
          start_at: heure,
          end_at: finApres(heure, DUREE_DEFAUT_MIN),
        });
        await apresEvenement();
        afficherToast({
          msg: t("Tâche ajoutée à {heure}", { heure: formatHeure(heure) }),
          actionLabel: t("Nommer"),
          onAction: () => ouvrirParId("task", id),
        });
      },
    });
  };

  const naviguer = useCallback(
    (sens: number) => {
      setMouvement((m) => ({ tour: m.tour + 1, sens }));
      // La règle (agenda par pages de 30 jours, mois sans débordement) vit dans
      // `lib/calendrier/navigation.ts`, testée.
      setCurseur((c) => curseurApres(mode, c, sens));
    },
    [mode],
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
    <div className="mx-auto max-w-6xl p-8 telephone:p-4">
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
          className="pill fill-primary px-4 py-2 text-sm font-semibold"
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
            onClick={() => {
              if (curseur === aujourdhui) return;
              setMouvement((m) => ({ tour: m.tour + 1, sens: curseur > aujourdhui ? -1 : 1 }));
              setCurseur(aujourdhui);
            }}
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
              onClick={() => {
                if (m.id === mode) return;
                setMouvement((x) => ({ tour: x.tour + 1, sens: 0 }));
                setMode(m.id);
                retenirVue(m.id);
              }}
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
        replie={isPhone}
        aujourdhui={aujourdhui}
        entreesDuJourCourant={parJour.get(aujourdhui) ?? entreesDuJour(sources, aujourdhui, aujourdhui)}
        profil={profil}
        peril={peril}
        onExpliquerPeril={ia ? (goalId) => demanderIa({ action: "peril", goalId }) : undefined}
        aDecider={aDecider}
        onFait={async (tache) => {
          // La bascule de toutes les cases de tâche (règle 18).
          await basculerTache(tache, aujourdhui, true);
          await refresh();
        }}
        onReplanifier={async (tache, jour) => {
          await appliquerReport(tache.id, replanifier(jour));
          await refresh();
        }}
        onSupprimer={async (tache) => {
          // Corbeille (migration 027) : « Annuler » dans le toast.
          await jeter("task", tache.id, tache.label, refresh);
        }}
      />

      {/* ⚠️ Si la rotation fait passer en téléphone alors qu'on était en vue
          mois, on retombe sur la semaine : rester sur une vue retirée du menu
          laisserait l'utilisateur devant un écran qu'il ne peut plus quitter. */}
      {isPhone && !MODES.find((m) => m.id === mode)?.telephone && (
        <ModeRetombe onRetomber={() => setMode("semaine")} />
      )}

      <section className="card mt-6 overflow-hidden" onContextMenu={surClicDroit}>
        {/* ⚠️ Le calque animé n'a PAS de `key` : il ne doit rien remonter. Seul
            le nom de l'image clé change, ce qui suffit à relancer l'animation
            et ce qui la rend interruptible — il n'y en a jamais qu'une
            attachée à la fois, donc trois clics rapides ne peuvent pas en
            empiler trois. */}
        <div
          className="cal-anime"
          style={
            {
              animationName:
                mouvement.sens === 0
                  ? mouvement.tour % 2 === 0
                    ? "cal-fondu-a"
                    : "cal-fondu-b"
                  : mouvement.tour % 2 === 0
                    ? "cal-glisse-a"
                    : "cal-glisse-b",
              "--cal-dx": `${mouvement.sens * 1.25}rem`,
            } as React.CSSProperties
          }
        >
        {mode === "agenda" ? (
          // Au téléphone, l'agenda ne défile plus DANS sa carte : c'est la page
          // qui défile (constat 1 du 20/10, corrigé large — deux défilements
          // emboîtés, le second sans barre visible sur iOS). La grille horaire
          // garde le sien : 24 heures, et le glisser y fait défiler au bord.
          <div
            className={isPhone ? undefined : "max-h-[calc(70vh*var(--zoom-inv))] overflow-y-auto"}
            style={isPhone ? undefined : { maxHeight: "calc(70vh * var(--zoom-inv, 1))" }}
          >
            <VueAgenda
              depuis={curseur}
              jours={AGENDA_JOURS}
              parJour={parJour}
              aujourdhui={aujourdhui}
              onOuvrir={ouvrir}
              onMenu={surMaintien}
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
          <div className="max-h-[calc(70vh*var(--zoom-inv))] overflow-y-auto" style={{ maxHeight: "calc(70vh * var(--zoom-inv, 1))" }}>
            <GrilleHoraire
              jours={jours}
              parJour={parJour}
              aujourdhui={aujourdhui}
              suggestions={suggestions}
              onDeposer={deplacer}
              onOuvrir={ouvrir}
              onCreer={(jour, heure) => setModale({ event: null, jour, heure })}
              onMenu={surMaintien}
              // Sept colonnes dans 390 pt : la grille se resserre. La vue Jour,
              // elle, a toute la largeur pour une seule colonne.
              compact={isPhone && mode === "semaine"}
              onJour={(jour) => {
                setCurseur(jour);
                setMode("jour");
              }}
            />
          </div>
        )}
        </div>
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

      <MenuContextuel
        etat={menu}
        libelle={t("Actions du calendrier")}
        entrees={entreesDuMenu()}
      />

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
  replie = false,
  aujourdhui,
  entreesDuJourCourant,
  profil,
  peril,
  aDecider,
  onFait,
  onReplanifier,
  onSupprimer,
  onExpliquerPeril,
}: {
  /**
   * Au téléphone, plusieurs alertes se replient en UNE ligne qu'on déplie
   * (constat 17 du 20/10) : quatre bandeaux remplissaient l'écran, la grille
   * commençait à 841 px sur un écran de 844 (mesuré dans WebKit).
   */
  replie?: boolean;
  aujourdhui: string;
  entreesDuJourCourant: EntreeAgenda[];
  profil: ReturnType<typeof profilDisponibilite>;
  peril: ReturnType<typeof objectifsEnPeril>;
  aDecider: Task[];
  onFait: (t: Task) => Promise<void>;
  onReplanifier: (t: Task, jour: string) => Promise<void>;
  onSupprimer: (t: Task) => Promise<void>;
  /** « Pourquoi, et que faire ? » (IA, #13) — absent sans Shale Pro. */
  onExpliquerPeril?: (goalId: number) => void;
}) {
  const { requise } = useActions();
  const charge = chargeDuJour(entreesDuJourCourant, profil, aujourdhui);
  const [deplie, setDeplie] = useState(alertesDeplieesAuTelephone);
  const rien = !charge.surchargee && peril.length === 0 && aDecider.length === 0;
  if (rien) return null;
  const nombre = (charge.surchargee ? 1 : 0) + peril.length + aDecider.length;
  const enUneLigne = replie && nombre > 1;
  const basculer = () => {
    setDeplie((v) => {
      retenirAlertesDepliees(!v);
      return !v;
    });
  };

  if (enUneLigne && !deplie) {
    const actionRequise =
      peril.some((p) => requise(cleObjectif(p.goal.id))) || aDecider.some((x) => requise(cleTache(x.id)));
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={basculer}
          aria-expanded={false}
          className="cible-tactile-ligne flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm text-text"
          style={{
            borderColor: "color-mix(in srgb, var(--color-yellow) 40%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--color-yellow) 8%, transparent)",
          }}
        >
          <IconAlert className="h-4 w-4 shrink-0" style={{ color: "var(--color-yellow)" }} />
          <span className="min-w-0 flex-1">
            <strong>{tp(nombre, "{n} alerte", "{n} alertes")}</strong>{" "}
            <span className="text-text-dim">
              {[
                charge.surchargee ? t("aujourd’hui surchargé") : null,
                peril.length > 0 ? tp(peril.length, "{n} objectif", "{n} objectifs") : null,
                aDecider.length > 0 ? tp(aDecider.length, "{n} tâche à décider", "{n} tâches à décider") : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          {actionRequise && <PointAction libelle={t("Action requise")} />}
          <span className="shrink-0 text-xs font-medium text-text-dim">{t("Afficher")}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {enUneLigne && (
        <button
          type="button"
          onClick={basculer}
          aria-expanded
          className="cible-tactile-ligne px-1 text-xs font-medium text-text-dim"
        >
          {t("Masquer les alertes")}
        </button>
      )}
      {charge.surchargee && (
        <Alerte couleur="yellow">
          {/* Le jour est NOMMÉ (constat 17 : « surchargée » sans dire quel
              jour) — c'est toujours aujourd'hui, `chargeDuJour(…, aujourdhui)`. */}
          <strong>{t("Aujourd'hui, journée surchargée.")}</strong>{" "}
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
          {/* ⚠️ Une phrase séparée, et pas un total commun : un événement
              « journée entière » n'est pas une tâche. Le compte était juste, le
              mot était faux — corrigé le 2026-09-07. */}
          {charge.evenementsSansHeure > 0 &&
            tp(
              charge.evenementsSansHeure,
              "Et {n} événement sans horaire, qui n'est pas compté.",
              "Et {n} événements sans horaire, qui ne sont pas comptés.",
            )}{" "}
          {!profil.appris && (
            <span className="text-text-dim">
              {t("(capacité par défaut — pas encore assez de sessions pour l'apprendre)")}
            </span>
          )}
        </Alerte>
      )}

      {peril.slice(0, MAX_ALERTES).map((p) => (
        <Alerte
          key={p.goal.id}
          // Grammaire (2026-10-20) : dépassée = rouge (retard), en péril = ambre (attention).
          couleur={p.joursRestants < 0 ? "red" : "yellow"}
          action={requise(cleObjectif(p.goal.id))}
        >
          <strong>{p.goal.title}</strong>{" "}
          {p.racine && (
            <span className="text-text-dim">{t("(étape de « {titre} »)", { titre: p.racine.title })} </span>
          )}
          {p.joursRestants < 0
            ? tp(-p.joursRestants, "échéance dépassée d'{n} jour.", "échéance dépassée de {n} jours.")
            : tp(p.joursRestants, "{n} jour restant, {pct} % fait.", "{n} jours restants, {pct} % fait.", {
                pct: p.progression,
              })}{" "}
          {p.etapesRestantes + p.tachesRestantes > 0 &&
            tp(
              p.etapesRestantes + p.tachesRestantes,
              "{n} étape ou tâche restante.",
              "{n} étapes ou tâches restantes.",
            )}{" "}
          {p.declaratif && (
            <span className="text-text-dim">
              {t("(progression déclarée à la main, pas mesurée)")}
            </span>
          )}{" "}
          {onExpliquerPeril && (
            <button
              type="button"
              onClick={() => onExpliquerPeril(p.goal.id)}
              className="pill cible-tactile-ligne ml-1 inline-flex items-center gap-1.5 border border-border px-2.5 py-0.5 text-xs hover:bg-overlay"
            >
              <IconeIa className="h-3.5 w-3.5" />
              {t("Pourquoi, et que faire ?")}
            </button>
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
        <Alerte key={tache.id} couleur="yellow" action={requise(cleTache(tache.id))}>
          <div className="flex flex-wrap items-center gap-2">
            <span>
              <strong>{tache.label}</strong>{" "}
              {tp(
                tache.postponed_count,
                "prévue le {date}, repoussée {n} fois.",
                "prévue le {date}, repoussée {n} fois.",
                { date: formaterDansPhrase(tache.postponed_from ?? tache.due_date ?? "", aujourdhui) },
              )}{" "}
              <span className="text-text-dim">
                {/* Sans chiffre, exprès (Antonin, 2026-10-10) : la maxime en citait un, qui
                    contredisait le « repoussée 2 fois » écrit juste avant (`SEUIL_REPORT`). */}
                {t("Une tâche qu'on reporte sans cesse n'est pas une tâche, c'est une décision à prendre.")}
              </span>
            </span>
            {/* `flex-wrap` : à 390 px les trois boutons ne tiennent pas sur une
                rangée — « Supprimer » était écrasé, son texte hors de sa pastille. */}
            <span className="ml-auto flex flex-wrap gap-1.5">
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

function Alerte({
  couleur,
  action = false,
  children,
}: {
  couleur: string;
  /** Une action est requise (`lib/pointAction`) : le point en haut à droite. */
  action?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg border p-3 text-sm text-text"
      style={{
        borderColor: `color-mix(in srgb, var(--color-${couleur}) 40%, transparent)`,
        backgroundColor: `color-mix(in srgb, var(--color-${couleur}) 8%, transparent)`,
      }}
    >
      <IconAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: `var(--color-${couleur})` }} />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <PointAction className="mt-1.5" libelle={t("Action requise")} />}
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
      {/* ⭐ SIX RANGÉES DE SEMAINE, ET NON QUARANTE-DEUX CELLULES À LA SUITE.
          C'est ce qui rend une bande CONTINUE possible : une barre ne peut
          s'étendre que dans la grille où elle vit, et une grille de 42 cellules
          ne sait pas où une semaine finit. Chaque rangée porte donc sa propre
          grille de sept colonnes, plus un calque de barres au-dessus. */}
      {semaines(jours).map((semaine) => (
        <RangeeSemaine
          key={semaine[0]}
          semaine={semaine}
          mois={mois}
          parJour={parJour}
          surcharges={surcharges}
          aujourdhui={aujourdhui}
          onJour={onJour}
        />
      ))}
    </div>
  );
}

/** Les 42 jours de la grille du mois, découpés en six semaines de sept. */
function semaines(jours: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < jours.length; i += 7) out.push(jours.slice(i, i + 7));
  return out;
}

/** Une rangée de sept jours, et les séjours qui la traversent. */
function RangeeSemaine({
  semaine,
  mois,
  parJour,
  surcharges,
  aujourdhui,
  onJour,
}: {
  semaine: string[];
  mois: string;
  parJour: ReadonlyMap<string, EntreeAgenda[]>;
  surcharges: Set<string>;
  aujourdhui: string;
  onJour: (jour: string) => void;
}) {
  const bandes = bandesDu(semaine, parJour);
  const etages = bandes.length ? Math.max(...bandes.map((b) => b.rang)) + 1 : 0;
  /**
   * ⚠️ La place des barres est RÉSERVÉE dans les cellules, pas prise dessus.
   * Le calque des barres est en position absolue : sans ce creux, il
   * recouvrirait les premières entrées de la journée, qui disparaîtraient sans
   * message — le pire des défauts d'affichage, parce qu'il ne se voit que
   * lorsqu'on cherche ce qui manque.
   */
  const creux = etages * 0.95;

  return (
    <div className="relative">
      <div className="grid grid-cols-7">
        {semaine.map((jour) => {
          // Ce que porte le bandeau ne se répète pas dans la liste du jour.
          const entrees = (parJour.get(jour) ?? []).filter((e) => !dansLeBandeau(e));
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
                    jour === aujourdhui ? "bg-accent-solid font-semibold text-on-accent" : "text-text-dim"
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
              <span className="mt-1 block space-y-0.5" style={{ paddingTop: `${creux}rem` }}>
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
                    {e.start_at ? `${formatHeure(e.start_at)} ` : ""}
                    <BadgeDEntree entree={e} />
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

      {/* ⚠️ `pointer-events-none` : les barres SE LAISSENT TRAVERSER. Sans cela
          elles feraient un trou dans la surface cliquable de la journée, et
          cliquer sur un séjour n'ouvrirait rien du tout. La vue mois est une
          vue d'ensemble — on y ouvre une journée, pas un événement. */}
      {bandes.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-8 grid grid-cols-7 gap-y-0.5">
          {bandes.map((b) => (
            <span
              key={`${b.entree.kind}-${b.entree.id}-${b.colonne}`}
              className="mx-1 truncate px-1 text-[0.65rem] leading-[0.85rem]"
              style={{
                gridColumn: `${b.colonne + 1} / span ${b.span}`,
                gridRow: b.rang + 1,
                backgroundColor: `color-mix(in srgb, ${couleurEntree(b.entree)} 20%, transparent)`,
                borderLeft: b.debuteAvant ? undefined : `2px solid ${couleurEntree(b.entree)}`,
                borderTopLeftRadius: b.debuteAvant ? 0 : "0.25rem",
                borderBottomLeftRadius: b.debuteAvant ? 0 : "0.25rem",
                borderTopRightRadius: b.finitApres ? 0 : "0.25rem",
                borderBottomRightRadius: b.finitApres ? 0 : "0.25rem",
              }}
            >
              {b.debuteAvant && "◀ "}
              {b.entree.titre}
              {b.finitApres && " ▶"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function couleurEntree(e: EntreeAgenda): string {
  if (e.kind === "deadline") return "var(--color-violet)";
  if (e.enRetard) return "var(--color-red)";
  if (e.kind === "event") return `var(--color-${e.color ?? "blue"})`;
  if (e.kind === "recurrence") return "var(--color-text-dim)";
  return "var(--color-success)";
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
                  borderColor: "color-mix(in srgb, var(--color-success) 40%, transparent)",
                  color: "var(--color-success)",
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
        {charge.evenementsSansHeure > 0 && (
          <p className="mt-1 text-xs text-text-dim">
            {tp(
              charge.evenementsSansHeure,
              "{n} événement sans horaire — non compté, faute de durée connue.",
              "{n} événements sans horaire — non comptés, faute de durée connue.",
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
            await upsertJournal(jour, corps);
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

function heureCourante(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
