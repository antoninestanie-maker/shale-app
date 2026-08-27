// Centre de notifications — client des commandes Rust (`src-tauri/src/notifications/`).
//
// Le Rust est propriétaire du journal : il vit dans `notifications.json`, jamais
// en base ni en localStorage. Ce fichier n'en est qu'une façade typée, plus un
// hook qui écoute l'événement `shale:notification` pour refléter en direct les
// notifications produites par le planificateur.
//
// Hors Tauri (preview navigateur), tout retombe sur un journal démo en mémoire,
// comme le reste de l'app.
import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./repo";
import { creneauxBriefingActifs } from "./market/rappels";

import { t } from "./i18n";
/** Événement émis par le Rust à chaque notification produite. */
export const NOTIF_EVENT = "shale:notification";

/** Une notification au journal. Miroir exact de `LogEntry` côté Rust. */
export interface NotifEntry {
  id: string;
  /** Règles à l'origine (plusieurs = notification de synthèse). */
  rules: string[];
  dedupe_keys: string[];
  title: string;
  body: string;
  /** Vue à ouvrir au clic, ou null. */
  target: string | null;
  /** RFC 3339 avec décalage local. */
  created_at: string;
  read: boolean;
  /**
   * Remise au système — PAS la preuve d'un affichage. macOS ne renvoie aucun
   * signal d'autorisation (cf. `emitter.rs`) : le centre in-app fait foi.
   */
  handed_to_system: boolean;
}

// — Journal démo (preview navigateur) —

const demoLog = (): NotifEntry[] => [
  {
    id: "demo_2",
    rules: ["habits_pending"],
    dedupe_keys: ["habits_pending:demo"],
    title: "2 habitudes t'attendent",
    body: t("Il te reste 2 habitudes à cocher aujourd'hui (Sport, Lecture)."),
    target: "journal",
    created_at: new Date(Date.now() - 25 * 60_000).toISOString(),
    read: false,
    handed_to_system: true,
  },
  {
    id: "demo_1",
    rules: ["inactivity"],
    dedupe_keys: ["inactivity:demo"],
    title: t("Ton savoir t'attend"),
    body: t("4 jours sans ouvrir une fiche. Deux minutes suffisent pour reprendre le fil."),
    target: "knowledge",
    created_at: new Date(Date.now() - 26 * 3600_000).toISOString(),
    read: true,
    handed_to_system: true,
  },
];

// — Préférences —

/** Réglages communs à toute règle, plus ses seuils propres (à plat). */
export interface RulePrefs {
  enabled: boolean;
  cooldown_h: number;
  [param: string]: number | boolean;
}

/**
 * Modification partielle d'une règle. Pas `Partial<RulePrefs>` : sur un type à
 * signature d'index, `Partial` rend aussi les valeurs `| undefined`, et l'objet
 * fusionné cesse d'être un `RulePrefs` valide.
 */
export type RulePrefsPatch = Record<string, number | boolean>;

export interface NotifPrefs {
  enabled: boolean;
  quiet_hours: { start: number; end: number };
  daily_cap: number;
  check_interval_min: number;
  keep_running_in_background: boolean;
  /** Langue des rappels ("fr" | "en") — le Rust n'a pas accès au localStorage. */
  lang: string;
  /**
   * Le rappel de briefing de marché (8 h / 14 h).
   *
   * ⚠️ Hors de `rules`, et ce n'est pas un rangement approximatif : il n'a
   * aucune CONDITION. Il ne passe donc pas par le moteur de règles, pas par le
   * plafond quotidien, et il est le seul à obtenir du système un vrai
   * rendez-vous quotidien plutôt qu'une échéance reprogrammée (MOBILE.md
   * § 13.4). L'interrupteur est ici ; les créneaux, eux, sont recalculés et
   * poussés à chaque projection (`market/rappels.ts`).
   */
  market_briefing: boolean;
  rules: Record<string, RulePrefs>;
}

export interface NotifStatus {
  last_run_at: string | null;
  log_count: number;
}

/**
 * Description des règles côté UI : libellé, explication et seuil réglable.
 *
 * Le Rust porte aussi un libellé (`NotificationRule::label`), mais l'écran a
 * besoin de plus — une phrase d'explication et le type d'entrée du seuil. Une
 * règle absente de cette table reste pilotable (interrupteur + cooldown
 * génériques) : ajouter une règle côté Rust ne casse donc pas cet écran.
 */
export interface RuleParamMeta {
  key: string;
  label: string;
  min: number;
  max: number;
  suffix?: string;
}

export const ruleMeta = (): Record<
  string,
  { label: string; desc: string; params?: RuleParamMeta[] }
> => ({
  streak_at_risk: {
    label: t("Série en danger"),
    desc: t("En fin de journée, si une série en cours — habitudes ou tâches — risque d'être rompue."),
    params: [
      { key: "hour", label: t("heure de l'alerte"), min: 0, max: 23, suffix: "h" },
      { key: "min_streak", label: t("à partir de"), min: 1, max: 365, suffix: "jours" },
    ],
  },
  habits_pending: {
    label: t("Habitudes non cochées"),
    desc: t("Le soir, si des habitudes du jour attendent encore d'être cochées."),
    params: [{ key: "hour", label: t("heure du rappel"), min: 0, max: 23, suffix: "h" }],
  },
  inactivity: {
    label: t("Savoir délaissé"),
    desc: t("Après plusieurs jours sans ouvrir une fiche du Savoir."),
    params: [{ key: "days", label: t("après"), min: 1, max: 60, suffix: "jours" }],
  },
});

export const DEFAULT_PREFS: NotifPrefs = {
  enabled: true,
  quiet_hours: { start: 8, end: 22 },
  lang: "fr",
  market_briefing: true,
  daily_cap: 2,
  check_interval_min: 15,
  keep_running_in_background: true,
  rules: {
    streak_at_risk: { enabled: true, cooldown_h: 20, hour: 21, min_streak: 3 },
    habits_pending: { enabled: true, cooldown_h: 20, hour: 20 },
    inactivity: { enabled: true, cooldown_h: 48, days: 3 },
  },
};

/** Copie démo, modifiable en mémoire pour que l'écran reste manipulable. */
let demoPrefs: NotifPrefs = structuredClone(DEFAULT_PREFS);

export async function fetchPrefs(): Promise<NotifPrefs> {
  if (!isTauri) return structuredClone(demoPrefs);
  return invoke<NotifPrefs>("notif_get_prefs");
}

/** Renvoie ce qui a RÉELLEMENT été stocké : le Rust borne les valeurs. */
/**
 * Recopie la langue courante dans les préférences du moteur Rust.
 *
 * Le planificateur tourne fenêtre fermée, hors de toute webview : il ne peut
 * pas lire `localStorage`. La langue doit donc être POUSSÉE vers
 * `notifications.json` à chaque changement, sinon un rappel envoyé la nuit
 * repartirait dans l'ancienne langue.
 */
export async function syncLang(lang: string): Promise<void> {
  try {
    const prefs = await fetchPrefs();
    if (prefs.lang === lang) return;
    await savePrefs({ ...prefs, lang });
  } catch {
    /* moteur indisponible (mode démo, fichier illisible) : sans conséquence */
  }
}

export async function savePrefs(prefs: NotifPrefs): Promise<NotifPrefs> {
  if (!isTauri) {
    demoPrefs = structuredClone(prefs);
    return structuredClone(demoPrefs);
  }
  return invoke<NotifPrefs>("notif_set_prefs", { prefs });
}

export async function fetchStatus(): Promise<NotifStatus> {
  if (!isTauri) return { last_run_at: null, log_count: demoLog().length };
  return invoke<NotifStatus>("notif_status");
}

/** Évaluation immédiate des règles (natif uniquement). */
export async function runNow(): Promise<void> {
  if (!isTauri) return;
  await invoke("notif_run_now");
}

/** Ce que la projection a décidé, tel que le Rust le rend. */
export interface PlanReport {
  /** `granted` | `denied` | `prompt` sur iOS ; `sans-objet` sur le bureau. */
  permission: string;
  planned: { at: string; title: string; rules: string[] }[];
  /**
   * Combien d'échéances iOS a acceptées. Zéro sur le bureau.
   *
   * ⚠️ Il n'y a volontairement PAS de « en attente côté système » : le
   * greffon ne sait pas répondre à cette question sur iOS en 2.3.3 — voir
   * `EngineState::scheduled_ids` côté Rust. Un compte qui vaudrait toujours
   * zéro ferait accuser le dépôt d'un échec qui n'a pas lieu.
   */
  deposited: number;
}

/**
 * Projette les règles dans le futur et, sur iOS, dépose les échéances auprès
 * du système.
 *
 * ⚠️ Appelée au démarrage ET à chaque passage en arrière-plan (`App.tsx`).
 * C'est le remplacement du planificateur Rust, que iOS suspend : une fois
 * l'app hors de l'écran, plus rien ne tourne — seul le système peut encore
 * afficher quelque chose, et seulement s'il l'a reçu à l'avance.
 *
 * Ne demande jamais l'autorisation : voir `requestNotifPermission`.
 */
export async function planNotifications(hasTrading: boolean): Promise<PlanReport | null> {
  if (!isTauri) return null;
  // Le briefing de marché ne se déduit pas de la base : il dépend de l'offre du
  // compte, de la clé LLM et du fuseau de l'appareil — trois choses que seul le
  // front connaît. On les recalcule ICI, à chaque projection, plutôt que de les
  // stocker : une valeur stockée serait périmée dès le premier voyage ou le
  // premier changement de langue.
  const briefing = await creneauxBriefingActifs(hasTrading).catch(() => []);
  return invoke<PlanReport>("notif_plan", { briefing });
}

/**
 * Ouvre le dialogue d'autorisation système (iOS).
 *
 * ⚠️ À n'appeler QUE sur un geste explicite : sur iOS il ne s'ouvre qu'une
 * fois dans la vie de l'app, et un refus y est définitif — il faut ensuite
 * passer par les Réglages du téléphone. D'où l'appel à l'ACTIVATION du
 * réglage « notifications », là où la valeur est comprise, et jamais au
 * démarrage (`MOBILE.md` § 3.6).
 */
export async function requestNotifPermission(): Promise<string> {
  if (!isTauri) return "sans-objet";
  return invoke<string>("notif_request_permission");
}

/**
 * Une demande de note rapide attendait-elle ?
 *
 * Le pendant front de l'`AppIntent` du bouton Action (`note_rapide.rs` côté
 * Rust, `QuickNoteIntent.swift` côté Swift). Le Swift ne peut pas appeler la
 * webview : il pose un fichier, qu'on relève ici. La demande est CONSOMMÉE à
 * la lecture — une pression, une note — et le Rust jette celles de plus de deux
 * minutes, pour qu'un geste fait app déjà ouverte ne rouvre pas une note des
 * heures plus tard.
 *
 * Rangé ici et non dans un module à part : c'est la même famille que les
 * rappels — du système d'exploitation qui parle à l'app, pas l'inverse.
 */
export async function noteRapideDemandee(): Promise<boolean> {
  if (!isTauri) return false;
  return invoke<boolean>("note_rapide_demandee");
}

/** Notification de test — seul diagnostic fiable de l'autorisation macOS. */
export async function sendTest(): Promise<NotifEntry | null> {
  if (!isTauri) return null;
  return invoke<NotifEntry>("notif_test");
}

// — Commandes —

export async function fetchNotifications(): Promise<NotifEntry[]> {
  if (!isTauri) return [...demoLog()];
  return invoke<NotifEntry[]>("notif_list");
}

export async function markRead(id: string): Promise<NotifEntry[]> {
  if (!isTauri) {
    const e = demoLog().find((n) => n.id === id);
    if (e) e.read = true;
    return [...demoLog()];
  }
  return invoke<NotifEntry[]>("notif_mark_read", { id });
}

export async function markAllRead(): Promise<NotifEntry[]> {
  if (!isTauri) {
    demoLog().forEach((n) => (n.read = true));
    return [...demoLog()];
  }
  return invoke<NotifEntry[]>("notif_mark_all_read");
}

export async function deleteNotification(id: string): Promise<NotifEntry[]> {
  if (!isTauri) {
    const i = demoLog().findIndex((n) => n.id === id);
    if (i >= 0) demoLog().splice(i, 1);
    return [...demoLog()];
  }
  return invoke<NotifEntry[]>("notif_delete", { id });
}

export async function clearNotifications(): Promise<NotifEntry[]> {
  if (!isTauri) {
    demoLog().length = 0;
    return [];
  }
  return invoke<NotifEntry[]>("notif_clear");
}

// — Affichage —

/**
 * Horodatage relatif court, à la façon de macOS. On reste sur des repères
 * lisibles d'un coup d'œil plutôt que sur une date complète.
 */
/**
 * Une échéance À VENIR — « aujourd'hui à 20:00 ».
 *
 * ⚠️ NE PAS réutiliser `formatWhen` pour ça, et c'est une erreur que j'ai
 * faite : il est écrit pour le PASSÉ (`now - date`, puis « il y a N min »).
 * Sur une date future l'écart est négatif, donc `< 1`, et il répond
 * « à l'instant ». L'écran des rappels programmés annonçait ainsi un rappel
 * de 20 h comme s'il venait de partir.
 */
export function formatWhenAhead(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hhmm = d.toTimeString().slice(0, 5);
  const day = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const demain = new Date(now);
  demain.setDate(demain.getDate() + 1);
  if (day(d) === day(now)) return t("aujourd'hui à {time}", { time: hhmm });
  if (day(d) === day(demain)) return t("demain à {time}", { time: hhmm });
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} à ${hhmm}`;
}

export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mins = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;

  const hhmm = d.toTimeString().slice(0, 5);
  const day = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day(d) === day(now)) return t("à {time}", { time: hhmm });
  if (day(d) === day(yesterday)) return t("hier à {time}", { time: hhmm });
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} à ${hhmm}`;
}

// — Hook —

export interface NotificationsState {
  list: NotifEntry[];
  unread: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * Journal + compteur non-lus, tenus à jour en direct.
 *
 * Le compteur est DÉRIVÉ de la liste (et non demandé au Rust) : une seule
 * source, donc badge et panneau ne peuvent pas diverger.
 */
export function useNotifications(): NotificationsState {
  const [list, setList] = useState<NotifEntry[]>([]);

  const refresh = useCallback(async () => {
    try {
      setList(await fetchNotifications());
    } catch (e) {
      // Un journal illisible ne doit pas casser la sidebar.
      console.error("notifications :", e);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Nouvelle notification produite par le planificateur, y compris fenêtre
  // au second plan : on la place en tête sans re-interroger le Rust.
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    let alive = true;
    import("@tauri-apps/api/event").then(({ listen }) =>
      listen<NotifEntry>(NOTIF_EVENT, (e) => {
        setList((prev) =>
          prev.some((n) => n.id === e.payload.id) ? prev : [e.payload, ...prev],
        );
      }).then((u) => {
        if (alive) unlisten = u;
        else u();
      }),
    );
    return () => {
      alive = false;
      unlisten?.();
    };
  }, []);

  const wrap = useCallback(
    (fn: () => Promise<NotifEntry[]>) => async () => {
      try {
        setList(await fn());
      } catch (e) {
        console.error("notifications :", e);
      }
    },
    [],
  );

  return {
    list,
    unread: list.filter((n) => !n.read).length,
    refresh,
    markRead: (id) => wrap(() => markRead(id))(),
    markAllRead: () => wrap(markAllRead)(),
    remove: (id) => wrap(() => deleteNotification(id))(),
    clear: () => wrap(clearNotifications)(),
  };
}
