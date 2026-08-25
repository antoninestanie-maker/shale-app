// ─────────────────────────────────────────────────────────────────────────────
// Le patrimoine net — reconstitué à partir de relevés épars.
//
// L'utilisateur ne relève pas ses soldes tous les jours ; il le fait quand il y
// pense, une fois par mois dans le meilleur des cas. Une courbe qui ne
// montrerait que les points saisis serait donc pleine de trous, et deux comptes
// relevés à des dates différentes ne seraient jamais additionnables.
//
// D'où l'INTERPOLATION : entre deux relevés d'un même compte, on trace la ligne
// droite ; après le dernier, on prolonge à l'horizontale. On n'EXTRAPOLE jamais
// — ni avant le premier relevé, ni au-delà du dernier avec une pente. Inventer
// une tendance là où il n'y a pas de mesure produirait un patrimoine qui monte
// tout seul, ce qui est exactement le mensonge qu'un outil financier ne doit pas
// faire. La ligne droite entre deux points mesurés, elle, ne dit rien de plus
// que « ça a bougé de ça, entre ces deux dates ».
// ─────────────────────────────────────────────────────────────────────────────
import type { FinanceAccount, FinanceBalance } from "../types";
import { ajouterMois, joursEntre } from "./calendrier";
import { divArrondi } from "./montants";

/** Relevés d'un compte, triés par date croissante. */
export function relevesDe(balances: FinanceBalance[], accountId: number): FinanceBalance[] {
  return balances
    .filter((b) => b.account_id === accountId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Solde d'un compte à une date, interpolé entre les relevés qui l'encadrent.
 * `null` si ce compte n'a jamais été relevé — jamais `0`, qui serait une
 * réponse plausible et fausse.
 */
export function soldeInterpole(releves: FinanceBalance[], date: string): number | null {
  if (releves.length === 0) return null;

  const premier = releves[0];
  if (date <= premier.date) return premier.amount_cents;

  const dernier = releves[releves.length - 1];
  if (date >= dernier.date) return dernier.amount_cents;

  for (let i = 1; i < releves.length; i++) {
    const b = releves[i];
    if (b.date < date) continue;
    const a = releves[i - 1];
    const total = joursEntre(a.date, b.date);
    if (total <= 0) return b.amount_cents;
    const ecoule = joursEntre(a.date, date);
    const delta = divArrondi(
      BigInt(b.amount_cents - a.amount_cents) * BigInt(ecoule),
      BigInt(total),
    );
    return a.amount_cents + Number(delta);
  }
  return dernier.amount_cents;
}

export interface LignePatrimoine {
  compte: FinanceAccount;
  /** `null` = jamais relevé. */
  montantCents: number | null;
  /** Date du dernier relevé connu, `null` si aucun. */
  dernierReleve: string | null;
  /** Le dernier relevé remonte à plus de `seuilJours` : le chiffre est daté. */
  perime: boolean;
}

export interface Patrimoine {
  /** Tout ce qui est relevé, comptes de crédit compris (donc soldes négatifs). */
  totalCents: number;
  /** La part marquée `is_liquid` — c'est elle, et elle seule, qui fait le runway. */
  liquideCents: number;
  lignes: LignePatrimoine[];
  /** Comptes actifs sans le moindre relevé : le total est incomplet de ce nombre. */
  sansReleve: number;
}

/**
 * Patrimoine à une date donnée.
 *
 * Les comptes archivés sont écartés : les garder ferait remonter un solde figé
 * pour l'éternité, puisque l'interpolation prolonge le dernier relevé à
 * l'horizontale.
 *
 * `sansReleve` n'est pas décoratif : un total juste sur les comptes connus reste
 * un total FAUX du patrimoine si trois comptes n'ont jamais été saisis, et
 * l'interface doit pouvoir le dire.
 */
export function patrimoineAu(
  comptes: FinanceAccount[],
  balances: FinanceBalance[],
  date: string,
  seuilJours = 45,
): Patrimoine {
  let totalCents = 0;
  let liquideCents = 0;
  let sansReleve = 0;
  const lignes: LignePatrimoine[] = [];

  for (const compte of comptes) {
    if (compte.archived === 1) continue;
    const releves = relevesDe(balances, compte.id);
    const montantCents = soldeInterpole(releves, date);
    const dernierReleve = releves.length ? releves[releves.length - 1].date : null;

    if (montantCents === null) sansReleve++;
    else {
      totalCents += montantCents;
      if (compte.is_liquid === 1) liquideCents += montantCents;
    }

    lignes.push({
      compte,
      montantCents,
      dernierReleve,
      perime: dernierReleve !== null && joursEntre(dernierReleve, date) > seuilJours,
    });
  }

  return { totalCents, liquideCents, lignes, sansReleve };
}

export interface PointPatrimoine {
  date: string;
  totalCents: number;
  liquideCents: number;
}

/** Suite de dates au premier de chaque mois, de `debut` à `fin` inclus. */
export function datesMensuelles(debut: string, fin: string): string[] {
  const dates: string[] = [];
  let d = `${debut.slice(0, 7)}-01`;
  // Garde-fou : une plage aberrante (dates inversées, année à quatre chiffres
  // saisie de travers) ne doit pas produire une boucle sans fin.
  for (let i = 0; i < 600 && d <= fin; i++) {
    dates.push(d);
    d = ajouterMois(d, 1);
  }
  return dates;
}

/** Courbe du patrimoine net : un point par date demandée. */
export function seriePatrimoine(
  comptes: FinanceAccount[],
  balances: FinanceBalance[],
  dates: string[],
): PointPatrimoine[] {
  return dates.map((date) => {
    const p = patrimoineAu(comptes, balances, date);
    return { date, totalCents: p.totalCents, liquideCents: p.liquideCents };
  });
}
