import { toDateStr } from "../logic";

/**
 * ⭐ LA DURÉE D'UNE SÉANCE DE FOCUS = LE TEMPS TRAVAILLÉ (lot 3 de l'audit du
 * 2026-10-20, temps-2 ; A07b-04 et A07b-20, « non tranchés » jusque-là).
 *
 * Partout, la durée d'une séance se lit `ended_at − started_at` : « Focus
 * aujourd'hui », l'objectif quotidien, Performance, la capacité apprise par le
 * Calendrier (`disponibilite.ts`). Or la reprise après une pause ne décalait le
 * départ qu'en mémoire, et la fin écrivait l'heure du moment :
 *   • 25 min de travail et 30 min de pause valaient 55 min ;
 *   • capot fermé (ou iPhone verrouillé) pendant la séance, on rouvrait 2 h plus
 *     tard et la séance valait 2 h — le minuteur ne battait plus, il s'est
 *     terminé au réveil ;
 *   • l'app quittée pendant une pause oubliait la pause.
 *
 * La règle : `started_at` reste l'heure VRAIE du début (la liste des séances
 * l'affiche), et `ended_at` s'écrit `début + temps travaillé`, borné à la durée
 * prévue. Aucune migration : toutes les lectures existantes deviennent justes.
 * ⚠️ `ended_at` n'est donc plus l'heure où l'on a cliqué « Terminer » quand il y
 * a eu une pause : c'est voulu, c'est elle qui porte la durée.
 */
export function finEnregistree(p: {
  /** L'heure vraie du début (`started_at`). */
  debutReelMs: number;
  /** Le départ du compte à rebours, décalé de chaque pause. */
  departMs: number;
  plannedMin: number;
  /** En pause : l'instant où elle a commencé. */
  pauseeA: number | null;
  maintenantMs: number;
}): number {
  const finDuTravail = p.pauseeA ?? p.maintenantMs;
  const travaille = Math.max(0, finDuTravail - p.departMs);
  return p.debutReelMs + Math.min(travaille, p.plannedMin * 60_000);
}

/** Un instant, au format des colonnes de l'app (`YYYY-MM-DD HH:MM:SS`, heure locale). */
export function horodatageLocal(ms: number): string {
  const d = new Date(ms);
  return `${toDateStr(d)} ${d.toTimeString().slice(0, 8)}`;
}

// ─── La pause survit à un redémarrage (A07b-20) ─────────────────────────────

/**
 * Ce qu'il faut retenir d'une séance en cours pour la reprendre telle quelle :
 * de combien son départ a été décalé par les pauses déjà prises, et si elle est
 * en pause en ce moment.
 *
 * ⚠️ Dans le stockage local, pas en base : une séance en cours vit sur
 * l'appareil qui la chronomètre, et une colonne demanderait une migration pour
 * un état de quelques minutes. Si le stockage est vide ou illisible, on retombe
 * sur l'ancien comportement (la pause est perdue), jamais sur une erreur.
 */
export interface PauseRetenue {
  id: number;
  decalageMs: number;
  pauseeA: number | null;
}

const CLE = "shale.focus.pause";

export function lirePause(id: number, stockage: Pick<Storage, "getItem"> | null = stockageLocal()): PauseRetenue | null {
  try {
    const brut = stockage?.getItem(CLE);
    if (!brut) return null;
    const p = JSON.parse(brut) as Partial<PauseRetenue>;
    if (p.id !== id || typeof p.decalageMs !== "number" || !Number.isFinite(p.decalageMs)) return null;
    const pauseeA = typeof p.pauseeA === "number" && Number.isFinite(p.pauseeA) ? p.pauseeA : null;
    return { id, decalageMs: Math.max(0, p.decalageMs), pauseeA };
  } catch {
    return null;
  }
}

export function retenirPause(
  p: PauseRetenue | null,
  stockage: Pick<Storage, "setItem" | "removeItem"> | null = stockageLocal(),
): void {
  try {
    if (p) stockage?.setItem(CLE, JSON.stringify(p));
    else stockage?.removeItem(CLE);
  } catch {
    // Stockage refusé (navigation privée, quota) : la pause ne survivra pas à
    // un redémarrage, rien de plus.
  }
}

function stockageLocal(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
