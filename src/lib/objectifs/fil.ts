import { estAcheve, type Mesure } from "./progression";

/**
 * ⭐ LE FIL D'UN OBJECTIF (2026-10-08) — la barre de progression du site, le
 * long de la feuille de route. Ce module dit QUOI dessiner ; `index.css`
 * (`.fil-item`) dit comment.
 *
 * Le fil est une suite de TRONÇONS, un par item, dans l'ordre de la page :
 *   les étapes de premier niveau → les éléments rattachés à l'objectif
 *   lui-même (s'il y en a) → « ajouter une étape » → l'arrivée.
 * Chaque tronçon part du nœud de son item et va jusqu'au nœud suivant ; il est
 * rempli de la part FAITE de son item — pas de l'avancement global : on voit
 * quelle étape avance, pas seulement combien.
 *
 * ⚠️ Aucune règle métier ici : la part vient de `mesurer` (`Mesure.fraction`),
 * l'achèvement d'`estAcheve`. Le fil ne calcule rien que la vue n'affiche déjà.
 */

export type EtatFil = "vide" | "cours" | "atteint";

type MesureLue = Pick<Mesure, "pct" | "fraction" | "videsProfonds">;

export interface TronconFil {
  /** `g<id>` pour une étape, sinon `directs`, `ajout`, `fin`. */
  cle: string;
  etat: EtatFil;
  /** 0 → 1 : la part du tronçon dessinée en trait plein. */
  part: number;
}

export interface Fil {
  troncons: TronconFil[];
  /**
   * L'item qui porte l'orbe — « tu en es là » : le premier, dans l'ordre, qui
   * n'est pas atteint. `null` quand l'objectif est atteint (c'est l'arrivée
   * qui s'allume) ou quand rien de mesurable ne reste.
   */
  courant: string | null;
}

const borner = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/**
 * L'état d'un nœud. ⚠️ « Atteint » suit `estAcheve`, pas « 100 % » : une étape
 * à 100 % qui porte encore une sous-étape vide n'est pas finie (PIEGES § 14) —
 * son tronçon est plein, son nœud reste « en cours ».
 */
export function etatFil(m: MesureLue | undefined): EtatFil {
  if (!m) return "vide";
  if (estAcheve(m)) return "atteint";
  return (m.pct ?? 0) > 0 ? "cours" : "vide";
}

export function filDObjectif(p: {
  /** Les étapes de premier niveau, DANS L'ORDRE de la feuille de route. */
  etapes: readonly { id: number }[];
  mesures: ReadonlyMap<number, MesureLue>;
  /**
   * Les éléments rattachés à l'objectif lui-même. `presents` : la section
   * existe à l'écran (elle peut ne contenir que des éléments non comptés).
   */
  directs: { presents: boolean; total: number; faits: number };
  /** L'objectif entier est-il achevé (`estAcheve` de sa mesure) ? */
  atteint: boolean;
}): Fil {
  const troncons: TronconFil[] = p.etapes.map((e) => {
    const m = p.mesures.get(e.id);
    return { cle: `g${e.id}`, etat: etatFil(m), part: borner(m?.fraction ?? 0) };
  });

  if (p.directs.presents) {
    const { total, faits } = p.directs;
    // Rien de comptable (que des récurrentes, des notes) : le tronçon ne dit
    // rien tant que l'objectif n'est pas atteint — puis il se remplit avec lui.
    const etat: EtatFil = p.atteint || (total > 0 && faits >= total) ? "atteint" : faits > 0 ? "cours" : "vide";
    troncons.push({ cle: "directs", etat, part: p.atteint ? 1 : total > 0 ? borner(faits / total) : 0 });
  }

  const premier = troncons.find((t) => t.etat !== "atteint" && (t.cle !== "directs" || p.directs.total > 0));
  const courant = p.atteint ? null : (premier?.cle ?? null);

  // « Ajouter une étape » : une place encore vide sur le chemin. Le fil ne la
  // traverse en plein qu'une fois l'objectif atteint.
  troncons.push({ cle: "ajout", etat: p.atteint ? "atteint" : "vide", part: p.atteint ? 1 : 0 });
  troncons.push({ cle: "fin", etat: p.atteint ? "atteint" : "vide", part: 0 });
  return { troncons, courant };
}
