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
import type { Mouvement } from "./facturation/tresorerie";
import { mouvementsDansFenetre } from "./facturation/tresorerie";
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

/**
 * ⭐⭐ LE SOLDE COMPOSÉ — la règle qui gouverne tout le chantier facturation.
 *
 *     solde = dernier relevé saisi
 *           + mouvements datés STRICTEMENT APRÈS ce relevé
 *
 * Finance est un module de SNAPSHOTS : le solde n'est pas calculé, il est
 * relevé à la main. Un encaissement du 15 février s'ajoute au relevé du
 * 1er février. Le jour où l'utilisateur relève son solde au 1er mars, cet
 * encaissement devient ANTÉRIEUR au relevé : la banque l'a déjà compté dans le
 * chiffre affiché, donc il est ABSORBÉ et cesse d'être ajouté.
 *
 * ⚠️⚠️ SANS CETTE FENÊTRE, L'UTILISATEUR COMPTE DEUX FOIS LE MÊME EURO, ET RIEN
 * NE LE LUI SIGNALE. C'est exactement le type de faux chiffre que la doctrine
 * du module interdit depuis la migration 018.
 *
 * ⭐ ET LA COMPOSITION NE S'APPLIQUE QUE DANS LA ZONE D'EXTRAPOLATION.
 *
 * C'est le point qui se pense mal, et il vaut son paragraphe. `soldeInterpole`
 * trace une DROITE entre deux relevés qui encadrent la date : cette droite
 * contient déjà, au prorata, tout ce qui s'est passé entre les deux — le
 * paiement du 15 février compris, puisque le relevé du 1er mars le contient.
 * Ajouter les mouvements par-dessus une valeur interpolée les compterait donc
 * une seconde fois, sur chaque point passé de la courbe.
 *
 * On ne compose donc QUE lorsque la date évaluée dépasse le dernier relevé du
 * compte — c'est-à-dire là où `soldeInterpole` prolonge à l'horizontale et ne
 * sait, de son propre aveu, plus rien. Entre deux relevés, ce sont les relevés
 * qui font foi ; après le dernier, ce sont les mouvements.
 *
 * ⚠️ `null` reste `null`. Un compte jamais relevé ne devient pas « 300 € »
 * parce qu'un encaissement de 300 € existe : on ne sait toujours pas ce qu'il y
 * avait dessus avant.
 */
export function soldeCompose(
  releves: FinanceBalance[],
  mouvements: readonly Mouvement[],
  accountId: number,
  date: string,
): number | null {
  const base = soldeInterpole(releves, date);
  if (base === null) return null;
  if (mouvements.length === 0) return base;

  const dernier = releves[releves.length - 1].date;
  // Date encadrée par des relevés : l'interpolation fait déjà le travail.
  if (date <= dernier) return base;

  return base + mouvementsDansFenetre(mouvements, accountId, dernier, date);
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
  /**
   * Encaissements et décaissements de la facturation (migration 023).
   *
   * ⚠️ EN DERNIÈRE POSITION, derrière un paramètre optionnel, et c'est
   * délibéré : `seuilJours` était déjà le quatrième et des appelants le
   * passent. Le déplacer aurait cassé des appels existants pour une question
   * d'esthétique de signature.
   *
   * Vide par défaut : sans facturation, `patrimoineAu` se comporte
   * EXACTEMENT comme avant ce chantier.
   */
  mouvements: readonly Mouvement[] = [],
): Patrimoine {
  let totalCents = 0;
  let liquideCents = 0;
  let sansReleve = 0;
  const lignes: LignePatrimoine[] = [];

  for (const compte of comptes) {
    if (compte.archived === 1) continue;
    const releves = relevesDe(balances, compte.id);
    const montantCents = soldeCompose(releves, mouvements, compte.id, date);
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
  mouvements: readonly Mouvement[] = [],
): PointPatrimoine[] {
  return dates.map((date) => {
    const p = patrimoineAu(comptes, balances, date, undefined, mouvements);
    return { date, totalCents: p.totalCents, liquideCents: p.liquideCents };
  });
}
