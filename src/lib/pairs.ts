// Configuration des paires pour le calculateur de taille de position.
// Ajouter une paire = une entrée ici (ou via les paires custom dans les réglages),
// sans jamais toucher à la logique de calcul (sizing.ts).

export interface PairConfig {
  symbol: string; // "EUR/USD"
  pipSize: number; // 0.0001 (forex majors), 0.01 (XAU/USD, JPY)
  /**
   * Valeur d'un pip pour 1 lot standard, en devise du compte.
   * Valable directement quand la paire est cotée XXX/USD et le compte en USD.
   * Éditable par l'utilisateur car la convention varie selon le broker / prop firm
   * (ex. XAU/USD : 1 $ chez certains, 10 $ chez d'autres selon la définition du pip).
   */
  pipValuePerStandardLot: number;
  contractSize: number; // 100000 (forex standard), 100 (XAU/USD, en onces)
  quoteCurrency: string; // "USD"
  category: "forex_major" | "forex_jpy" | "metal" | "other";
  /**
   * true si la devise de cotation n'est pas l'USD (ex. EUR/GBP sur un compte USD) :
   * le pip value exige alors une conversion via le taux de change courant.
   * V1 : seules les paires XXX/USD (dont XAU/USD) sont supportées nativement ;
   * les paires marquées ici affichent un avertissement et exigent un pip value manuel.
   */
  requiresConversion: boolean;
}

// Paires pré-remplies (le trader utilise EUR/USD et XAU/USD).
export const DEFAULT_PAIRS: PairConfig[] = [
  {
    symbol: "EUR/USD",
    pipSize: 0.0001,
    pipValuePerStandardLot: 10, // 0.0001 × 100 000 = 10 $/lot (compte USD)
    contractSize: 100000,
    quoteCurrency: "USD",
    category: "forex_major",
    requiresConversion: false,
  },
  {
    symbol: "XAU/USD",
    pipSize: 0.01,
    // 0.01 × 100 oz = 1 $/lot. ⚠️ Certains brokers définissent 1 pip = 0.1 → 10 $/lot.
    // Vérifie la spec de ton broker/prop firm et ajuste dans les réglages si besoin.
    pipValuePerStandardLot: 1,
    contractSize: 100,
    quoteCurrency: "USD",
    category: "metal",
    requiresConversion: false,
  },
  {
    symbol: "GBP/USD",
    pipSize: 0.0001,
    pipValuePerStandardLot: 10, // 0.0001 × 100 000 = 10 $/lot (compte USD, comme EUR/USD)
    contractSize: 100000,
    quoteCurrency: "USD",
    category: "forex_major",
    requiresConversion: false,
  },
  {
    symbol: "NQ",
    // Nasdaq 100 (indice). Ici 1 pip = 1 point d'indice.
    pipSize: 1,
    // ⚠️ Valeur du point TRÈS dépendante du produit/broker :
    //   • NAS100 CFD (prop firms type Traders Casa) : souvent ~1 $/point pour 1 lot
    //   • E-mini futures NQ : 20 $/point/contrat · Micro MNQ : 2 $/point/contrat
    // Défaut prudent = 1 $/point/lot (CFD). Ajuste dans Réglages selon ta spec exacte.
    pipValuePerStandardLot: 1,
    contractSize: 1,
    quoteCurrency: "USD",
    category: "other",
    requiresConversion: false,
  },
  {
    symbol: "BTC/USD",
    // Bitcoin. Ici 1 pip = 1 $ de mouvement de prix.
    pipSize: 1,
    // ⚠️ Convention broker-dépendante (taille de contrat / valeur du point variables).
    // Défaut = 1 $/point pour 1 lot. Vérifie et ajuste dans Réglages si ton broker diffère.
    pipValuePerStandardLot: 1,
    contractSize: 1,
    quoteCurrency: "USD",
    category: "other",
    requiresConversion: false,
  },
];

/**
 * Liste effective des paires : défauts (avec overrides de pip value appliqués)
 * + paires custom ajoutées par l'utilisateur. Consommée par l'UI et le calcul.
 */
export function resolvePairs(
  pipOverrides: Record<string, number>,
  customPairs: PairConfig[],
): PairConfig[] {
  const merged = DEFAULT_PAIRS.map((p) =>
    pipOverrides[p.symbol] != null && pipOverrides[p.symbol] > 0
      ? { ...p, pipValuePerStandardLot: pipOverrides[p.symbol] }
      : p,
  );
  // Les paires custom qui ne dupliquent pas un symbole par défaut viennent s'ajouter.
  const known = new Set(merged.map((p) => p.symbol));
  for (const c of customPairs) {
    if (!known.has(c.symbol)) merged.push(c);
  }
  return merged;
}

export function findPair(
  pairs: PairConfig[],
  symbol: string | null,
): PairConfig | null {
  if (!symbol) return null;
  return pairs.find((p) => p.symbol === symbol) ?? null;
}
