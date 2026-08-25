// ─────────────────────────────────────────────────────────────────────────────
// Cotations — Yahoo et Binance, sans clé d'API, comme le Market Brain.
//
// CE FICHIER NE TOUCHE PAS À LA BASE. Il va chercher un prix et le rend ; c'est
// `repo.ts` qui écrit dans le cache. La séparation permet de tester le parsing
// sans base et sans réseau, et elle suit ce que fait déjà `market/prices.ts`.
//
// CE QU'IL RÉUTILISE, ET CE QU'IL NE RÉUTILISE PAS. La couche réseau vient de
// `market/http.ts` : `getJson` bascule sur `tauri-plugin-http` dans l'app native
// (indispensable — le webview bloquerait ces domaines par CORS) et sur `fetch`
// en mode navigateur. En revanche `market/prices.ts` n'est PAS réutilisable ici
// et n'est pas touché : il ne connaît que cinq instruments câblés en dur, dont
// il construit des blocs ATR/RSI pour le prompt du LLM. Un portefeuille libre a
// besoin d'autre chose — d'où ce fichier, qui reste au-dessus de `http.ts` sans
// dupliquer une ligne de `prices.ts`.
//
// AUCUN APPEL N'EST BLOQUANT. L'écran lit le cache et s'affiche ; le
// rafraîchissement se fait derrière. Une cotation qui ne répond pas laisse une
// ligne datée, jamais un écran vide ni une valeur à zéro.
// ─────────────────────────────────────────────────────────────────────────────
import { getJson } from "../market/http";
import type { FinanceFxRate, FinanceQuote } from "../types";
import { divArrondi, E8 } from "./montants";

const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart";
const BINANCE = "https://api.binance.com/api/v3/ticker/price";

/**
 * Prix → entier à l'échelle 10⁻⁸.
 *
 * Passe par la CHAÎNE quand l'API en fournit une (Binance rend
 * `"104238.12000000"`) : `parseFloat` puis `× 1e8` réintroduirait l'imprécision
 * binaire que tout le module évite, et sur un prix elle se propage à chaque
 * ligne du portefeuille. Yahoo, lui, ne rend qu'un nombre JSON : on repasse par
 * sa représentation décimale, qui est exacte pour les valeurs qu'il produit.
 */
export function prixVersE8(brut: string | number): number | null {
  const texte = typeof brut === "number" ? String(brut) : brut.trim();
  const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(texte);
  if (!m) return null;
  const [, signe, entier, decimales = "", exposant] = m;
  if (!entier && !decimales) return null;
  if (exposant) return null; // notation scientifique : aucune API n'en produit ici
  const chiffres = BigInt(`${entier || "0"}${decimales}`);
  const e8 = divArrondi(chiffres * E8, 10n ** BigInt(decimales.length));
  const n = Number(e8);
  if (!Number.isSafeInteger(n)) return null;
  return signe === "-" ? -n : n;
}

/**
 * Devise d'une paire Binance, déduite de son suffixe.
 *
 * Binance ne renvoie pas de devise : `BTCUSDT` coté « 104238.12 » ne dit pas en
 * quoi. Les stablecoins adossés au dollar sont traités comme du dollar — c'est
 * l'approximation habituelle, et elle est explicite ici plutôt que noyée dans
 * un appel.
 */
export function deviseBinance(symbole: string): string | null {
  const s = symbole.toUpperCase();
  for (const [suffixe, devise] of [
    ["USDT", "USD"],
    ["USDC", "USD"],
    ["BUSD", "USD"],
    ["FDUSD", "USD"],
    ["EUR", "EUR"],
    ["GBP", "GBP"],
    ["TRY", "TRY"],
  ] as const) {
    if (s.endsWith(suffixe)) return devise;
  }
  return null;
}

interface YahooChart {
  chart: {
    result:
      | [{ meta: { regularMarketPrice?: number; currency?: string } }]
      | null;
    error: unknown;
  };
}

/** Cotation d'un symbole Yahoo (action, ETF, indice, matière première, FX). */
export async function coterYahoo(symbole: string): Promise<FinanceQuote | null> {
  const url = `${YAHOO}/${encodeURIComponent(symbole)}?interval=1d&range=1d`;
  const data = await getJson<YahooChart>(url);
  const meta = data.chart.result?.[0]?.meta;
  if (!meta?.regularMarketPrice || !meta.currency) return null;
  const price_e8 = prixVersE8(meta.regularMarketPrice);
  if (price_e8 === null) return null;
  return {
    symbol: symbole,
    price_e8,
    currency: meta.currency.toUpperCase(),
    source: "yahoo",
    fetched_at: new Date().toISOString(),
  };
}

/** Cotation d'une paire Binance (spot, sans clé). */
export async function coterBinance(symbole: string): Promise<FinanceQuote | null> {
  const data = await getJson<{ symbol: string; price: string }>(
    `${BINANCE}?symbol=${encodeURIComponent(symbole.toUpperCase())}`,
  );
  const price_e8 = prixVersE8(data.price);
  const currency = deviseBinance(data.symbol);
  if (price_e8 === null || !currency) return null;
  return {
    symbol: symbole,
    price_e8,
    currency,
    source: "binance",
    fetched_at: new Date().toISOString(),
  };
}

export interface DemandeCotation {
  symbol: string;
  source: "yahoo" | "binance";
}

/**
 * Rafraîchit un lot de cotations.
 *
 * ⚠️ Ne rejette JAMAIS. Un symbole en échec est simplement absent du résultat et
 * consigné dans `erreurs` : le cache garde alors sa valeur précédente, et
 * l'interface affiche une cotation datée plutôt qu'un écran en erreur. Un
 * portefeuille de quinze lignes ne doit pas devenir illisible parce qu'un
 * ticker a été radié.
 */
export async function rafraichirCotations(
  demandes: DemandeCotation[],
): Promise<{ cotations: FinanceQuote[]; erreurs: string[] }> {
  const cotations: FinanceQuote[] = [];
  const erreurs: string[] = [];

  const resultats = await Promise.allSettled(
    demandes.map((d) => (d.source === "binance" ? coterBinance(d.symbol) : coterYahoo(d.symbol))),
  );

  resultats.forEach((r, i) => {
    const { symbol } = demandes[i];
    if (r.status === "rejected")
      erreurs.push(`${symbol} : ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    else if (r.value === null) erreurs.push(`${symbol} : réponse inexploitable`);
    else cotations.push(r.value);
  });

  return { cotations, erreurs };
}

/**
 * Taux de change, via les paires FX de Yahoo (`USDEUR=X`).
 *
 * Yahoo sert le FX par la même route que les actions : rien de plus à brancher,
 * et toujours sans clé.
 */
export async function coterFx(base: string, quote: string): Promise<FinanceFxRate | null> {
  if (base === quote)
    return { base, quote, rate_e8: Number(E8), fetched_at: new Date().toISOString() };
  const cotation = await coterYahoo(`${base.toUpperCase()}${quote.toUpperCase()}=X`);
  if (!cotation) return null;
  return {
    base,
    quote,
    rate_e8: cotation.price_e8,
    fetched_at: cotation.fetched_at,
  };
}

/** Idem, en lot et sans jamais rejeter. */
export async function rafraichirTaux(
  couples: { base: string; quote: string }[],
): Promise<{ taux: FinanceFxRate[]; erreurs: string[] }> {
  const taux: FinanceFxRate[] = [];
  const erreurs: string[] = [];

  const resultats = await Promise.allSettled(couples.map((c) => coterFx(c.base, c.quote)));
  resultats.forEach((r, i) => {
    const { base, quote } = couples[i];
    if (r.status === "rejected")
      erreurs.push(`${base}/${quote} : ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    else if (r.value === null) erreurs.push(`${base}/${quote} : réponse inexploitable`);
    else taux.push(r.value);
  });

  return { taux, erreurs };
}

/** Une cotation est-elle assez fraîche pour ne pas être redemandée ? */
export function estFraiche(fetched_at: string, maintenant: string, seuilMinutes = 15): boolean {
  return Date.parse(maintenant) - Date.parse(fetched_at) < seuilMinutes * 60_000;
}
