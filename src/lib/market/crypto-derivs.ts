// Dérivés crypto — Binance USD-M Futures (keyless, gratuit). Funding rate +
// open interest sur BTCUSDT : les meilleurs signaux de volatilité imminente
// pour le scalp (doc §4-5). Funding très positif = excès de longs = risque de purge.
// + ratio long/short des top traders et Fear & Greed (alternative.me) : lecture
// contrarienne du positionnement/sentiment.
import { getJson } from "./http";
import type { CryptoDerivs } from "./types";

const FAPI = "https://fapi.binance.com/fapi/v1";
const FDATA = "https://fapi.binance.com/futures/data";
const FNG_URL = "https://api.alternative.me/fng/?limit=1";

interface PremiumIndex {
  lastFundingRate: string;
  nextFundingTime: number;
  markPrice: string;
}

/** Ratio comptes long/short des top traders (non bloquant si indispo). */
async function fetchLongShortRatio(errors: string[]): Promise<number | null> {
  try {
    const rows = await getJson<{ longShortRatio: string }[]>(
      `${FDATA}/topLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1`,
    );
    const v = parseFloat(rows[0]?.longShortRatio ?? "");
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  } catch (e) {
    errors.push(`long-short: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Fear & Greed crypto (non bloquant si indispo). */
async function fetchFearGreed(
  errors: string[],
): Promise<{ value: number; label: string } | null> {
  try {
    const res = await getJson<{ data?: { value: string; value_classification: string }[] }>(
      FNG_URL,
    );
    const d = res.data?.[0];
    if (!d) return null;
    const value = parseInt(d.value, 10);
    return Number.isFinite(value) ? { value, label: d.value_classification } : null;
  } catch (e) {
    errors.push(`fear-greed: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export async function fetchCryptoDerivs(errors: string[]): Promise<CryptoDerivs | null> {
  try {
    const [premium, oi, long_short_ratio, fear_greed] = await Promise.all([
      getJson<PremiumIndex>(`${FAPI}/premiumIndex?symbol=BTCUSDT`),
      getJson<{ openInterest: string }>(`${FAPI}/openInterest?symbol=BTCUSDT`),
      fetchLongShortRatio(errors),
      fetchFearGreed(errors),
    ]);
    const fundingPct = parseFloat(premium.lastFundingRate) * 100; // % par 8h
    const oiBtc = parseFloat(oi.openInterest);
    const markPrice = parseFloat(premium.markPrice);

    // Seuil ~0.05% : au-delà, le financement paye cher un côté = déséquilibre.
    let signal: CryptoDerivs["signal"] = "neutre";
    if (fundingPct > 0.05) signal = "longs_surchauffe";
    else if (fundingPct < -0.05) signal = "shorts_surchauffe";

    return {
      symbol: "BTCUSDT",
      funding_rate_pct: Math.round(fundingPct * 1000) / 1000,
      next_funding: new Date(premium.nextFundingTime).toISOString(),
      open_interest_btc: Math.round(oiBtc),
      open_interest_usd: Math.round(oiBtc * markPrice),
      signal,
      long_short_ratio,
      fear_greed,
      ts: new Date().toISOString(),
    };
  } catch (e) {
    errors.push(`crypto-derivs: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
