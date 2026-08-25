// ─────────────────────────────────────────────────────────────────────────────
// Valorisation des positions détenues — quantité × cotation, converti en euros.
//
// LA COTATION VIENT DU CACHE, TOUJOURS. Aucun appel réseau n'est fait ici : ce
// fichier ne connaît que des tables. Le rafraîchissement se fait en arrière-plan
// (`quotes.ts`), et l'écran s'affiche instantanément avec ce qu'il a — quitte à
// marquer une cotation comme datée. C'est la règle générale de Shale : le réseau
// n'est jamais sur le chemin critique d'une action utilisateur.
//
// UNE POSITION NON VALORISABLE N'EST PAS UNE POSITION À ZÉRO. Faute de cotation
// ou de taux de change, la ligne vaut `null` et se signale ; l'ajouter comme
// zéro au patrimoine reviendrait à annoncer une perte totale à quelqu'un dont le
// seul problème est une connexion coupée.
// ─────────────────────────────────────────────────────────────────────────────
import type { FinanceFxRate, FinanceHolding, FinanceQuote } from "../types";
import { convertirCents, divArrondi, E8, valeurPositionCents } from "./montants";

/**
 * Taux de `de` vers `vers`, à l'échelle 10⁻⁸.
 *
 * Cherche le couple direct, puis son inverse. L'inversion se fait en `bigint`
 * (10¹⁶ / taux) : la faire en flottant réintroduirait par la petite porte
 * l'imprécision que tout le module évite, et sur un taux elle se propage à
 * chaque ligne du portefeuille.
 */
export function tauxVers(fx: FinanceFxRate[], de: string, vers: string): number | null {
  if (de === vers) return Number(E8);
  const direct = fx.find((f) => f.base === de && f.quote === vers);
  if (direct) return direct.rate_e8;
  const inverse = fx.find((f) => f.base === vers && f.quote === de);
  if (inverse && inverse.rate_e8 !== 0) return Number(divArrondi(10n ** 16n, BigInt(inverse.rate_e8)));
  return null;
}

export interface LigneValorisation {
  holding: FinanceHolding;
  quote: FinanceQuote | null;
  /** Valeur en devise cible, en centimes. `null` si non valorisable. */
  valeurCents: number | null;
  /** Valeur − prix de revient. `null` si l'un des deux manque. */
  plusValueCents: number | null;
  /** Ce qui empêche de valoriser, pour que l'interface puisse le dire. */
  manque: "cotation" | "taux" | null;
  /** Cotation plus ancienne que le seuil : le chiffre est daté, pas faux. */
  perimee: boolean;
}

export interface Valorisation {
  lignes: LigneValorisation[];
  /** Somme des lignes valorisables uniquement. */
  totalCents: number;
  /** Nombre de lignes qu'on n'a pas su valoriser. */
  incomplets: number;
}

/**
 * Valorise un portefeuille.
 *
 * `maintenant` est passé en paramètre plutôt que lu de l'horloge : une fonction
 * pure se teste, et le seuil de péremption doit pouvoir être éprouvé sans
 * attendre vingt-quatre heures.
 */
export function valoriser(
  holdings: FinanceHolding[],
  quotes: FinanceQuote[],
  fx: FinanceFxRate[],
  devise = "EUR",
  maintenant: string = new Date().toISOString(),
  seuilHeures = 24,
): Valorisation {
  const parSymbole = new Map(quotes.map((q) => [q.symbol, q]));
  const limite = Date.parse(maintenant) - seuilHeures * 3_600_000;

  let totalCents = 0;
  let incomplets = 0;
  const lignes: LigneValorisation[] = [];

  for (const holding of holdings) {
    const quote = parSymbole.get(holding.symbol) ?? null;
    if (!quote) {
      incomplets++;
      lignes.push({
        holding,
        quote: null,
        valeurCents: null,
        plusValueCents: null,
        manque: "cotation",
        perimee: false,
      });
      continue;
    }

    const taux = tauxVers(fx, quote.currency, devise);
    if (taux === null) {
      incomplets++;
      lignes.push({
        holding,
        quote,
        valeurCents: null,
        plusValueCents: null,
        manque: "taux",
        perimee: false,
      });
      continue;
    }

    const brut = valeurPositionCents(holding.quantity_e8, quote.price_e8);
    const valeurCents = convertirCents(brut, taux);
    totalCents += valeurCents;

    lignes.push({
      holding,
      quote,
      valeurCents,
      plusValueCents:
        holding.cost_basis_cents === null ? null : valeurCents - holding.cost_basis_cents,
      manque: null,
      perimee: Date.parse(quote.fetched_at) < limite,
    });
  }

  return { lignes, totalCents, incomplets };
}
