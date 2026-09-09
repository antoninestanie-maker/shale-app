// ─────────────────────────────────────────────────────────────────────────────
// Deux factures, un seul numéro — détecter, jamais corriger.
//
// D'OÙ VIENT LE PROBLÈME. Le compteur d'une série (`invoice_series.prochain`)
// est une donnée synchronisée comme une autre, donc soumise au last-write-wins :
// il ÉCRASE, il n'additionne pas. Deux appareils hors-ligne qui émettent chacun
// une facture attribueront donc le même numéro, et la synchronisation n'en
// gardera qu'un seul compteur. Ce n'est pas un défaut réparable ici : c'est la
// conséquence inévitable d'un compteur répliqué sans serveur d'arbitrage.
//
// ⚠️⚠️ POURQUOI ON NE RENUMÉROTE PAS.
//
// La correction automatique semble évidente — on renumérote la plus récente et
// le problème disparaît. Elle est interdite, pour une raison qui n'est pas
// technique : un numéro déjà envoyé à un client est la référence commune de
// DEUX comptabilités. Le changer dans le dos de l'utilisateur, c'est faire
// diverger sa facture de celle que son client a classée, sans que ni l'un ni
// l'autre ne l'apprenne. C'est un faux en écriture accompli par une bonne
// intention.
//
// Ce fichier produit donc un DIAGNOSTIC — qui, quoi, depuis quand — et
// l'interface le montre. L'utilisateur tranche : il sait, lui, laquelle des deux
// est partie chez un client.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invoice } from "../../types";

export interface Collision {
  /** Le numéro en double. */
  numero: string;
  /** Série concernée. `null` si les factures ne partagent pas la même série. */
  serieId: number | null;
  /** Les factures qui le portent, de la plus ancienne à la plus récente. */
  factures: Invoice[];
  /**
   * ⭐ Laquelle a le plus de chances d'être déjà partie chez un client : la
   * PLUS ANCIENNE par date d'émission, à égalité la plus anciennement créée.
   *
   * C'est une SUGGESTION affichée, pas une décision appliquée. L'app ne sait
   * pas ce qui a été envoyé ; elle sait seulement ce qui a été émis en premier.
   */
  gardeeSuggeree: Invoice;
}

/**
 * Tous les numéros portés par plus d'une facture.
 *
 * ⚠️ Les brouillons sont écartés : ils n'ont pas de numéro (`null`), et deux
 * `null` ne sont pas un doublon.
 *
 * ⚠️ La comparaison se fait par (série, numéro) et non par numéro seul. Deux
 * séries différentes ont parfaitement le droit de produire « 0001 » — c'est même
 * le cas nominal d'un devis et d'une facture la première année. Une facture sans
 * série (donnée ancienne ou importée) tombe dans un groupe à part, comparé par
 * numéro seul : mieux vaut un faux positif visible qu'un vrai doublon manqué.
 */
export function collisionsNumeros(factures: readonly Invoice[]): Collision[] {
  const groupes = new Map<string, Invoice[]>();

  for (const f of factures) {
    if (f.numero === null || f.numero === "") continue;
    const cle = `${f.serie_id ?? "sans-serie"}::${f.numero}`;
    const groupe = groupes.get(cle);
    if (groupe) groupe.push(f);
    else groupes.set(cle, [f]);
  }

  const out: Collision[] = [];
  for (const groupe of groupes.values()) {
    if (groupe.length < 2) continue;

    const triees = [...groupe].sort(comparerAnciennete);
    out.push({
      numero: triees[0].numero as string,
      serieId: triees[0].serie_id,
      factures: triees,
      gardeeSuggeree: triees[0],
    });
  }

  // Les collisions les plus anciennes d'abord : ce sont celles dont les
  // documents ont eu le plus de temps pour partir chez un client.
  return out.sort((a, b) => comparerAnciennete(a.factures[0], b.factures[0]));
}

/**
 * ⚠️ `date_emission` peut être nulle sur une facture ancienne ou importée. On
 * retombe alors sur `created_at`, qui existe toujours — plutôt que de traiter le
 * nul comme « très ancien » ou « très récent », deux réponses aussi arbitraires
 * l'une que l'autre.
 */
function comparerAnciennete(a: Invoice, b: Invoice): number {
  const da = a.date_emission ?? a.created_at.slice(0, 10);
  const db = b.date_emission ?? b.created_at.slice(0, 10);
  if (da !== db) return da.localeCompare(db);
  return a.created_at.localeCompare(b.created_at);
}

/**
 * Le compteur d'une série est-il en retard sur ce qu'elle a déjà produit ?
 *
 * C'est la trace typique d'un LWW qui a écrasé un compteur : la série dit
 * « prochain = 4 » alors qu'une facture porte déjà « F-2026-0007 ». Émettre
 * maintenant produirait un numéro déjà utilisé — donc une collision de plus.
 *
 * ⚠️ On ne CORRIGE PAS le compteur non plus, pour la même raison qu'on ne
 * renumérote pas : le recaler ferait sauter des numéros, donc des trous dans une
 * série qui doit être continue. On signale, et l'interface propose le recalage
 * comme un geste explicite.
 */
export interface CompteurEnRetard {
  serieId: number;
  /** Ce que la série croit être le prochain numéro. */
  prochain: number;
  /** Le plus grand compteur réellement observé dans les numéros émis. */
  observe: number;
}

export function compteursEnRetard(
  series: readonly { id: number; prochain: number }[],
  factures: readonly Invoice[],
): CompteurEnRetard[] {
  const maxParSerie = new Map<number, number>();

  for (const f of factures) {
    if (f.numero === null || f.serie_id === null) continue;
    // Le compteur est le DERNIER groupe de chiffres du numéro. « F-2026-0007 »
    // → 7. Prendre le premier attraperait l'année ; prendre tous les chiffres
    // collés donnerait 20260007.
    const chiffres = f.numero.match(/(\d+)(?!.*\d)/);
    if (!chiffres) continue;
    const n = Number(chiffres[1]);
    if (!Number.isFinite(n)) continue;
    maxParSerie.set(f.serie_id, Math.max(maxParSerie.get(f.serie_id) ?? 0, n));
  }

  const out: CompteurEnRetard[] = [];
  for (const serie of series) {
    const observe = maxParSerie.get(serie.id);
    if (observe !== undefined && serie.prochain <= observe)
      out.push({ serieId: serie.id, prochain: serie.prochain, observe });
  }
  return out;
}
