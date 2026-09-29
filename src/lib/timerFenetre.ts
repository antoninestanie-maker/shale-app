// La fenêtre séparée du Timer (2026-09-29) — et le canal qui la relie à l'app.
//
// ⭐ UNE SEULE SOURCE DE VÉRITÉ : LA FENÊTRE PRINCIPALE.
// La session vit dans `useFocus`, monté dans `App` (fenêtre `main`). La fenêtre
// `timer` n'ouvre PAS la base et n'a pas de session à elle : elle AFFICHE ce que
// l'app lui diffuse, et lui RENVOIE les gestes (pause, reprendre, terminer). Deux
// horloges qui se tiendraient chacune leur compte finiraient par se contredire —
// une pause prise d'un côté, un « terminé » écrit deux fois en base de l'autre.
//
// Ce qui passe par le canal n'est pas « il reste N secondes » (il faudrait le
// renvoyer chaque seconde, et la fenêtre afficherait le retard du message) mais
// l'INSTANT DE FIN : la fenêtre recalcule le reste elle-même, avec la même
// formule que `useFocus`, sur la même horloge de la machine. Pendant une pause,
// il n'y a plus d'instant de fin — c'est le reste figé qui voyage.
//
// Transport : événements Tauri dans l'app native (émis à TOUTES les fenêtres),
// `BroadcastChannel` dans le navigateur (mode démo), où la fenêtre séparée est
// une fenêtre surgissante ouverte par `window.open`.
import { useEffect, useRef } from "react";
import { IS_IOS } from "./platform";
import type { ActiveFocus, FocusController } from "./useFocus";

/** L'étiquette de la fenêtre Tauri — la même que dans `capabilities/timer.json`. */
export const LABEL_FENETRE_TIMER = "timer";

const EVT_ETAT = "shale:timer-etat";
const EVT_COMMANDE = "shale:timer-commande";
const CANAL_NAVIGATEUR = "shale-timer";

export interface SessionPartagee {
  label: string;
  kind: "focus" | "break";
  plannedMin: number;
}

export interface EtatTimerPartage {
  /** `null` : aucune session — la fenêtre séparée n'a plus rien à montrer. */
  session: SessionPartagee | null;
  /** Instant de fin (ms depuis l'époque) quand le décompte tourne ; `null` en pause. */
  finMs: number | null;
  /** Reste figé pendant une pause, en secondes ; `null` quand le décompte tourne. */
  restantFigeSec: number | null;
}

/** Ce que la fenêtre séparée peut demander à l'app. `etat` : « renvoie-moi l'état ». */
export type CommandeTimer = "etat" | "pause" | "reprendre" | "terminer" | "montrer-app";

const COMMANDES: readonly CommandeTimer[] = ["etat", "pause", "reprendre", "terminer", "montrer-app"];

function estTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Cette webview est-elle la fenêtre séparée du Timer ?
 *
 * Même double détection que la fenêtre de capture (`main.tsx`) : l'étiquette
 * de la fenêtre dans l'app native, `?pane=timer` dans le navigateur.
 */
export function estFenetreTimer(): boolean {
  if (typeof window === "undefined") return false;
  if (new URLSearchParams(location.search).get("pane") === LABEL_FENETRE_TIMER) return true;
  if (estTauri()) {
    const label = (
      window as unknown as {
        __TAURI_INTERNALS__: { metadata?: { currentWindow?: { label?: string } } };
      }
    ).__TAURI_INTERNALS__.metadata?.currentWindow?.label;
    return label === LABEL_FENETRE_TIMER;
  }
  return false;
}

/**
 * La fenêtre séparée a-t-elle un sens ici ?
 *
 * Non sur iPhone et iPad : Tauri n'y gère qu'une seule webview, il n'y a pas de
 * seconde fenêtre à ouvrir. Le plein écran, lui, reste proposé partout.
 */
export function fenetreSepareeDisponible(): boolean {
  return !IS_IOS;
}

// ─── Calculs purs (testés dans timerFenetre.test.ts) ─────────────────────────

/** L'état à diffuser, tiré de ce que `useFocus` expose. */
export function etatDepuisFocus(
  session: ActiveFocus | null,
  enPause: boolean,
  restantSec: number,
): EtatTimerPartage {
  if (!session) return { session: null, finMs: null, restantFigeSec: null };
  return {
    session: { label: session.label, kind: session.kind, plannedMin: session.plannedMin },
    finMs: enPause ? null : session.startedAtMs + session.plannedMin * 60_000,
    restantFigeSec: enPause ? restantSec : null,
  };
}

/**
 * Les secondes restantes, à l'instant `maintenantMs`.
 *
 * ⚠️ Même arrondi que `useFocus` (`Math.round`, plancher à 0) : la fenêtre
 * séparée et l'app doivent afficher le même chiffre à la même seconde.
 */
export function restantDepuisEtat(etat: EtatTimerPartage, maintenantMs: number): number {
  if (!etat.session) return 0;
  if (etat.restantFigeSec !== null) return Math.max(0, etat.restantFigeSec);
  if (etat.finMs === null) return 0;
  return Math.max(0, Math.round((etat.finMs - maintenantMs) / 1000));
}

/**
 * Les groupes de chiffres de l'horloge à volets : `["36", "50"]`, ou
 * `["01", "59", "59"]` avec les heures.
 *
 * Les heures dépendent de la DURÉE PRÉVUE, pas du reste : une session de
 * 90 min garde trois volets jusqu'au bout. Décidé sur le reste, l'horloge
 * perdrait un volet à 59:59 et toute la rangée sauterait au milieu de la séance.
 */
export function decouperTemps(sec: number, avecHeures: boolean): string[] {
  const s = Math.max(0, Math.floor(sec));
  const deux = (n: number) => String(n).padStart(2, "0");
  if (avecHeures) {
    return [deux(Math.floor(s / 3600)), deux(Math.floor((s % 3600) / 60)), deux(s % 60)];
  }
  // Sans heures, les minutes peuvent dépasser 59 (reste d'une session qu'on a
  // décidé d'afficher en deux volets) : elles s'écrivent alors sur trois chiffres.
  return [deux(Math.floor(s / 60)), deux(s % 60)];
}

/**
 * Millisecondes jusqu'au prochain changement du chiffre affiché.
 *
 * ⭐ Pourquoi pas `setInterval(1000)` : le chiffre change quand le reste
 * franchit une demi-seconde (arrondi de `useFocus`), à un instant qui n'a
 * aucune raison de tomber sur le battement d'un minuteur. Un battement réglé à
 * quelques millisecondes d'une frontière la voit tantôt avant, tantôt après :
 * une seconde sautée, puis une seconde affichée deux fois. Sur une horloge à
 * volets, ça se VOIT — deux bascules collées, puis un trou. On se réveille donc
 * juste après chaque frontière.
 */
export function delaiAvantProchaineSeconde(finMs: number, maintenantMs: number): number {
  const reste = finMs - maintenantMs;
  // Le chiffre passe de n à n − 1 quand le reste franchit (n − 0,5) s.
  const jusquA = (((reste - 500) % 1000) + 1000) % 1000;
  // Une marge : se réveiller juste APRÈS la frontière, jamais juste avant.
  return jusquA + 12;
}

/** Trois volets dès qu'une session prévoit une heure ou plus. */
export function afficheLesHeures(plannedMin: number): boolean {
  return plannedMin >= 60;
}

/** Une commande reçue est-elle l'une des nôtres ? Le canal est ouvert à toute l'app. */
export function estCommande(x: unknown): x is CommandeTimer {
  return typeof x === "string" && (COMMANDES as readonly string[]).includes(x);
}

// ─── Transport ────────────────────────────────────────────────────────────────

type MessageNavigateur =
  | { type: "etat"; etat: EtatTimerPartage }
  | { type: "commande"; commande: CommandeTimer };

function posterNavigateur(message: MessageNavigateur): void {
  if (typeof BroadcastChannel === "undefined") return;
  const canal = new BroadcastChannel(CANAL_NAVIGATEUR);
  canal.postMessage(message);
  canal.close();
}

function emettre(evt: string, payload: unknown, message: MessageNavigateur): void {
  if (estTauri()) {
    void import("@tauri-apps/api/event")
      .then(({ emit }) => emit(evt, payload))
      .catch((e) => console.error("timer : diffusion impossible", e));
  } else {
    posterNavigateur(message);
  }
}

/**
 * S'abonner à un événement, en rendant un désabonnement SYNCHRONE.
 *
 * ⚠️ `listen` de Tauri est asynchrone : un composant démonté avant la réponse
 * laisserait un écouteur orphelin. D'où le drapeau `fini`, qui débranche
 * l'écouteur au moment où il arrive.
 */
function ecouter(
  evt: string,
  type: MessageNavigateur["type"],
  surMessage: (payload: unknown) => void,
  surPret?: () => void,
): () => void {
  let fini = false;
  let debrancher: (() => void) | undefined;
  if (estTauri()) {
    import("@tauri-apps/api/event")
      .then(({ listen }) => listen(evt, (e) => surMessage(e.payload)))
      .then((u) => {
        if (fini) {
          u();
          return;
        }
        debrancher = u;
        surPret?.();
      })
      .catch((e) => console.error("timer : écoute impossible", e));
  } else if (typeof BroadcastChannel !== "undefined") {
    const canal = new BroadcastChannel(CANAL_NAVIGATEUR);
    canal.onmessage = (e: MessageEvent<MessageNavigateur>) => {
      if (e.data?.type !== type) return;
      surMessage(e.data.type === "etat" ? e.data.etat : e.data.commande);
    };
    debrancher = () => canal.close();
    surPret?.();
  }
  return () => {
    fini = true;
    debrancher?.();
  };
}

export function diffuserEtat(etat: EtatTimerPartage): void {
  emettre(EVT_ETAT, etat, { type: "etat", etat });
}

export function envoyerCommande(commande: CommandeTimer): void {
  emettre(EVT_COMMANDE, commande, { type: "commande", commande });
}

/**
 * `surPret` est appelé une fois l'écoute EFFECTIVEMENT branchée : c'est là, et
 * pas avant, qu'il faut demander l'état — sinon la réponse de l'app peut partir
 * avant que la fenêtre écoute, et se perdre.
 */
export function ecouterEtat(
  surEtat: (etat: EtatTimerPartage) => void,
  surPret?: () => void,
): () => void {
  return ecouter(
    EVT_ETAT,
    "etat",
    (p) => {
      if (p && typeof p === "object" && "session" in p) surEtat(p as EtatTimerPartage);
    },
    surPret,
  );
}

export function ecouterCommandes(surCommande: (c: CommandeTimer) => void): () => void {
  return ecouter(EVT_COMMANDE, "commande", (p) => {
    if (estCommande(p)) surCommande(p);
  });
}

// ─── Fenêtres ─────────────────────────────────────────────────────────────────

/**
 * Ouvre la fenêtre séparée, ou la ramène devant si elle existe déjà.
 * Rend `false` si elle n'a pas pu s'ouvrir (l'appelant le dit à l'écran).
 *
 * ⚠️ Créée À LA DEMANDE, pas déclarée dans `tauri.conf.json` comme la capture :
 * une fenêtre déclarée charge toute l'app au démarrage, cachée, pour une
 * fonction qu'on n'utilise qu'en séance. Il faut en échange la permission
 * `core:webview:allow-create-webview-window` sur la fenêtre `main`.
 */
export async function ouvrirFenetreTimer(fondCss: string): Promise<boolean> {
  if (!fenetreSepareeDisponible()) return false;
  if (!estTauri()) {
    const url = `${location.pathname}?pane=${LABEL_FENETRE_TIMER}`;
    const w = window.open(url, "shale-timer", "popup=yes,width=560,height=360");
    w?.focus();
    return w !== null;
  }
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const existante = await WebviewWindow.getByLabel(LABEL_FENETRE_TIMER);
    if (existante) {
      await existante.unminimize().catch(() => {});
      await existante.show();
      await existante.setFocus();
      return true;
    }
    const fenetre = new WebviewWindow(LABEL_FENETRE_TIMER, {
      title: "Timer — Shale",
      width: 560,
      height: 360,
      // En dessous, l'en-tête et les boutons ne laissent plus de place aux volets.
      minWidth: 360,
      minHeight: 320,
      center: true,
      focus: true,
      // Comme la fenêtre principale : le contenu passe sous une barre de titre
      // transparente, les pastilles de macOS restent en haut à gauche.
      titleBarStyle: "overlay",
      hiddenTitle: true,
      // Le fond de la fenêtre, sous la webview : sans lui, un thème clair
      // s'ouvre sur un éclair sombre le temps que la page se peigne.
      backgroundColor: fondCss,
    });
    return await new Promise<boolean>((resoudre) => {
      void fenetre.once("tauri://created", () => resoudre(true));
      void fenetre.once("tauri://error", (e) => {
        console.error("timer : la fenêtre séparée n'a pas pu s'ouvrir", e.payload);
        resoudre(false);
      });
    });
  } catch (e) {
    console.error("timer : la fenêtre séparée n'a pas pu s'ouvrir", e);
    return false;
  }
}

const attendre = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/**
 * Ferme la fenêtre séparée depuis ELLE-MÊME — et la ferme pour de bon.
 *
 * ⭐ `destroy()`, pas `close()` (2026-09-29, premier essai d'Antonin : « la
 * fenêtre ne se referme pas »). `close()` n'est qu'une DEMANDE, que n'importe
 * quel écouteur peut retenir ; `destroy()` ne se discute pas.
 *
 * ⚠️ Et jamais en plein écran : macOS range une fenêtre en plein écran dans son
 * propre espace. La détruire au milieu de l'animation de sortie risque l'espace
 * fantôme que la fenêtre principale a déjà connu (`CLAUDE.md`, 2026-07-26). On
 * sort d'abord, on laisse l'animation finir, puis on détruit.
 */
export async function fermerCetteFenetre(): Promise<void> {
  if (!estTauri()) {
    window.close();
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const w = getCurrentWindow();
  try {
    if (await w.isFullscreen()) {
      await w.setFullscreen(false);
      // L'animation de sortie de macOS dure ~0,7 s.
      for (let i = 0; i < 20 && (await w.isFullscreen()); i++) await attendre(100);
      await attendre(700);
    }
  } catch (e) {
    console.error("timer : sortie du plein écran avant fermeture", e);
  }
  await w.destroy();
}

/**
 * Le plein écran de l'app (`FocusOverlay`) passe la fenêtre principale en VRAI
 * plein écran macOS tant qu'il est ouvert : sans lui, la barre des menus et les
 * pastilles de la fenêtre restaient posées sur l'horloge, et Antonin a demandé
 * que « seul le timer soit affiché ».
 *
 * ⚠️ Si la fenêtre était DÉJÀ en plein écran, on n'y touche ni à l'entrée ni à
 * la sortie. Et on ne sort que du plein écran qu'on a soi-même ouvert.
 */
export function usePleinEcranNatif(actif: boolean): void {
  useEffect(() => {
    if (!actif || !estTauri() || IS_IOS) return;
    let annule = false;
    let entre = false;
    const fenetre = () => import("@tauri-apps/api/window").then((m) => m.getCurrentWindow());
    void (async () => {
      const w = await fenetre();
      if (annule || (await w.isFullscreen())) return;
      await w.setFullscreen(true);
      entre = true;
      // Refermé pendant qu'on y entrait : on ressort aussitôt.
      if (annule) {
        entre = false;
        await w.setFullscreen(false);
      }
    })().catch((e) => console.error("timer : plein écran impossible", e));
    return () => {
      annule = true;
      if (entre) {
        void fenetre()
          .then((w) => w.setFullscreen(false))
          .catch((e) => console.error("timer : sortie du plein écran impossible", e));
      }
    };
  }, [actif]);
}

/** Ramène la fenêtre principale devant (appelé DANS la fenêtre principale). */
async function montrerFenetrePrincipale(): Promise<void> {
  if (!estTauri()) {
    window.focus();
    return;
  }
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const w = getCurrentWindow();
  await w.unminimize().catch(() => {});
  await w.show();
  await w.setFocus();
}

/**
 * Le pont, côté APP : diffuse l'état de la session à chaque changement de sens
 * (départ, pause, reprise, fin) et exécute les gestes venus de la fenêtre
 * séparée. Monté UNE fois, là où vit l'affichage de la séance (`FocusOverlay`).
 *
 * Diffuser sans savoir si la fenêtre est ouverte est voulu : c'est un message
 * de quelques octets, quatre ou cinq fois par séance, et la fenêtre qui s'ouvre
 * demande de toute façon l'état en arrivant (`etat`).
 */
export function usePontFenetreTimer(focus: FocusController): void {
  const { session, paused, remainingSec } = focus;
  const etat = etatDepuisFocus(session, paused, remainingSec);
  const etatRef = useRef(etat);
  etatRef.current = etat;
  const focusRef = useRef(focus);
  focusRef.current = focus;

  // La clé ne bouge qu'aux changements de sens : `finMs` est stable tant que ça
  // tourne, `restantFigeSec` stable tant que c'est en pause.
  const cle = JSON.stringify(etat);
  useEffect(() => {
    diffuserEtat(etatRef.current);
  }, [cle]);

  useEffect(
    () =>
      ecouterCommandes((c) => {
        const f = focusRef.current;
        switch (c) {
          case "etat":
            diffuserEtat(etatRef.current);
            break;
          case "pause":
            f.pause();
            break;
          case "reprendre":
            f.resume();
            break;
          case "terminer":
            void f.stop();
            break;
          case "montrer-app":
            void montrerFenetrePrincipale().catch(() => {});
            break;
        }
      }),
    [],
  );
}
