// ─────────────────────────────────────────────────────────────────────────────
// Le multi-devise — un taux qui ne bouge plus.
//
// ⚠️⚠️ LE TAUX EST FIGÉ À LA DATE DE L'OPÉRATION, JAMAIS RECALCULÉ.
//
// C'est la seule règle de ce fichier, et elle mérite d'être dite crûment : si le
// taux d'une facture en dollars était relu dans le cache à chaque affichage, le
// montant encaissé il y a six mois CHANGERAIT TOUT SEUL entre deux ouvertures de
// l'app. L'utilisateur verrait sa trésorerie bouger sans avoir rien saisi, et le
// total de son année ne serait jamais deux fois le même.
//
// Le taux est donc écrit en dur dans la ligne, au moment de la saisie
// (`invoices.taux_change_e8`, `invoice_payments.taux_change_e8`), et ce fichier
// ne fait que l'appliquer.
//
// ⚠️ `finance_fx_cache` NE PEUT PAS SERVIR DE SOURCE HISTORIQUE. Elle ne garde
// qu'UN taux courant par paire, écrasé à chaque rafraîchissement — il n'y a pas
// de colonne date, et il n'y en aura pas : c'est un cache, pas un historique.
// Elle sert donc à PROPOSER une valeur au moment où l'utilisateur saisit, et à
// rien d'autre. Ce qui suit ne la lit jamais.
//
// AUCUN HÔTE RÉSEAU NOUVEAU. Le taux vient de `coterFx()` (`../quotes.ts`), qui
// passe par les paires FX de Yahoo — déjà autorisé dans
// `src-tauri/capabilities/default.json`. Rien à ajouter, donc rien à
// réinstaller.
// ─────────────────────────────────────────────────────────────────────────────
import type { FinanceFxRate } from "../../types";
import { E8, divArrondi } from "../montants";

/** Le taux neutre : 1 pour 1, à l'échelle 10⁻⁸. */
export const TAUX_IDENTITE = Number(E8);

/**
 * Convertit un montant en centimes avec un taux figé.
 *
 * ⚠️ `tauxE8` NULLABLE, et un `null` ne vaut PAS 1. Il veut dire « aucun taux
 * n'a été figé », ce qui n'arrive légitimement que quand la devise de
 * l'opération est déjà la devise de référence. L'appelant qui a un doute doit
 * le lever avant, pas ici : rendre le montant tel quel serait plausible et
 * faux dès que les devises diffèrent.
 *
 * `bigint` de bout en bout : un montant en centimes multiplié par un taux à
 * l'échelle 10⁻⁸ dépasse 2^53 à partir de ~90 000 € — c'est-à-dire tout de
 * suite, pour une facture.
 */
export function convertirAuTaux(cents: number, tauxE8: number | null): number {
  if (tauxE8 === null) return cents;
  return Number(divArrondi(BigInt(cents) * BigInt(tauxE8), E8));
}

/**
 * Le montant d'une opération, exprimé dans la devise de référence du module.
 *
 * C'est la seule forme dans laquelle un montant peut rejoindre le patrimoine, le
 * runway ou un total : additionner 1 000 € et 1 000 $ produirait un chiffre qui
 * ne désigne rien.
 */
export function enDeviseReference(
  operation: { montantCents: number; devise: string; tauxChangeE8: number | null },
  deviseReference: string,
): number {
  if (operation.devise === deviseReference) return operation.montantCents;
  return convertirAuTaux(operation.montantCents, operation.tauxChangeE8);
}

/**
 * Une opération est-elle convertible ? Sinon, pourquoi.
 *
 * ⭐ Elle existe pour que l'interface puisse DIRE qu'un montant manque de son
 * taux, au lieu de l'afficher converti au petit bonheur. Un montant dont on ne
 * sait pas la valeur ne doit pas se fondre dans un total : il doit se voir.
 */
export function tauxManquant(
  operation: { devise: string; tauxChangeE8: number | null },
  deviseReference: string,
): boolean {
  return operation.devise !== deviseReference && operation.tauxChangeE8 === null;
}

/**
 * Le taux à PROPOSER au moment de la saisie, depuis le cache de marché.
 *
 * ⚠️ `null` si le cache ne connaît pas la paire — et l'interface doit alors
 * laisser l'utilisateur saisir le taux à la main plutôt que de refuser la
 * facture. Un indépendant qui facture en francs suisses depuis un avion doit
 * pouvoir le faire.
 *
 * ⚠️ Ce que rend cette fonction est une SUGGESTION, valable à l'instant où on la
 * lit. Elle n'a rien à voir avec le taux d'une opération déjà enregistrée, qui
 * est figé et ne se relit jamais ici.
 */
export function tauxPropose(
  cache: readonly FinanceFxRate[],
  base: string,
  quote: string,
): number | null {
  if (base === quote) return TAUX_IDENTITE;
  const direct = cache.find((t) => t.base === base && t.quote === quote);
  if (direct) return direct.rate_e8;

  // L'inverse, faute de mieux : le cache peut connaître USD→EUR sans connaître
  // EUR→USD. Un aller-retour d'arrondi coûte au plus un centime sur le taux, ce
  // qui reste très en dessous de l'écart entre deux cotations de la journée.
  const inverse = cache.find((t) => t.base === quote && t.quote === base);
  if (inverse && inverse.rate_e8 !== 0)
    return Number(divArrondi(E8 * E8, BigInt(inverse.rate_e8)));

  return null;
}

/**
 * Formatage d'un taux pour l'affichage : 108500000 → « 1,085 ».
 *
 * Quatre décimales : c'est la précision que publient les banques, et deux de
 * plus que ce qu'un humain relit. En afficher huit suggérerait une exactitude
 * que la cotation du jour n'a pas.
 */
export function formaterTaux(tauxE8: number, locale = "fr-FR"): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(tauxE8 / Number(E8));
}
