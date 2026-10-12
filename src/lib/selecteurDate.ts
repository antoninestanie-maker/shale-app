/**
 * ⭐ LE CALENDRIER, OUVERT SUR PLACE — un seul hôte, dans `App.tsx` (2026-10-11).
 *
 * Le crible du labo (constats 7 et 10) : « Dater › Choisir une date… » rouvrait
 * toute la fenêtre de modification d'une tâche, et depuis Aujourd'hui faisait
 * quitter l'écran. Ce canal ouvre le calendrier de l'app (`PanneauDate`, celui
 * de `ChampDate`) là où on le demande : sous le « ⋯ » d'une ligne, sous la date
 * d'une tâche, dans la ligne d'ajout rapide. Il n'y a toujours qu'UN calendrier.
 *
 * ⚠️ PAS UN ÉVÉNEMENT DU DOM : un écouteur de module, comme `lib/toast.ts`
 * (PIEGES § 6.2 ter — un événement envoyé à un module chargé en `lazy` tombe
 * dans le vide). L'hôte (`SelecteurDateFlottant`) vit dans `App.tsx`, toujours
 * monté ; tant qu'il n'est pas là (les tests), demander ne fait rien.
 *
 * ⚠️ Ce fichier ne touche à rien : ni base, ni horloge. Ce que la date choisie
 * ÉCRIT appartient à l'appelant (`onChoisir`) — pour une tâche, c'est le geste
 * `dater` du catalogue (`components/menu/catalogue/tache.tsx`), le même que les
 * autres entrées de « Dater » (règle 18).
 */

/** Un rectangle d'ancrage, en coordonnées de fenêtre. */
export interface AncreFenetre {
  top: number;
  bottom: number;
  left: number;
}

export interface DemandeDate {
  /**
   * Où s'accrocher — RELU à chaque placement, pour suivre le défilement.
   * `null` : l'ancre n'existe plus (la ligne a été retirée), le panneau reste
   * où il est.
   */
  ancre: () => AncreFenetre | null;
  /** 'YYYY-MM-DD', ou '' quand aucune date n'est posée. */
  valeur: string;
  /** Le jour choisi, ou '' pour retirer la date. */
  onChoisir: (jour: string) => void;
  /** Faux là où retirer la date n'a pas de sens. Vrai par défaut. */
  effacable?: boolean;
  /** Un élément où cliquer n'est PAS « cliquer dehors » : le bouton qui ouvre. */
  ami?: () => HTMLElement | null;
  /** À qui rendre le focus à la fermeture (un choix, Échap). */
  focusApres?: () => HTMLElement | null;
}

let courante: DemandeDate | null = null;
const abonnes = new Set<() => void>();

function publier(demande: DemandeDate | null): void {
  courante = demande;
  for (const f of abonnes) f();
}

/** Ouvre le calendrier — remplace celui qui serait déjà ouvert. */
export function ouvrirSelecteurDate(demande: DemandeDate): void {
  publier(demande);
}

/** Ferme le calendrier, s'il est ouvert. */
export function fermerSelecteurDate(): void {
  if (courante) publier(null);
}

/** Réservés à l'hôte (`useSyncExternalStore`). */
export function abonnerSelecteurDate(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
export function demandeDeDate(): DemandeDate | null {
  return courante;
}

/**
 * L'ancre d'un ÉLÉMENT : son rectangle, tant qu'il est dans le document.
 *
 * ⚠️ Mesuré à chaque appel : une ligne de liste défile, et le panneau doit la
 * suivre plutôt que rester accroché au vide.
 */
export function ancreSurElement(el: HTMLElement): () => AncreFenetre | null {
  return () => {
    if (!el.isConnected) return null;
    const r = el.getBoundingClientRect();
    // Un élément sorti du flux (`display: none`) mesure 0 × 0 en (0, 0).
    if (r.width === 0 && r.height === 0) return null;
    return { top: r.top, bottom: r.bottom, left: r.left };
  };
}

/** L'ancre d'un POINT (le curseur d'un clic droit) : déjà en coordonnées de fenêtre. */
export function ancreSurPoint(x: number, y: number): () => AncreFenetre {
  return () => ({ top: y, bottom: y, left: x });
}
