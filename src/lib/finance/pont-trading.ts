// ─────────────────────────────────────────────────────────────────────────────
// Le pont — ce que le trading rapporte, en euros.
//
// LE PROBLÈME QUE ÇA RÉSOUT. Le journal de Shale est en R, et c'est une bonne
// chose : raisonner en R interdit de confondre un bon trade avec un gros trade.
// Mais un R n'a jamais payé un loyer. Quelqu'un qui vit de son trading a besoin,
// une fois, de traduire — sans quoi il tient deux comptabilités qui ne se
// parlent pas, ce qui est exactement la situation que Shale prétend supprimer.
//
// COMMENT. Il n'existe AUCUN montant en euros fiable dans le journal :
// `trades` ne stocke que `risk_r` et `result_r`. Les euros n'apparaissent que
// dans `position_size_calculations` (des brouillons de calculateur, pas des
// trades réalisés) et `live_positions.risk_amount` (uniquement les positions
// passées par le tracker). La conversion repose donc sur UN paramètre déclaré
// par l'utilisateur — ce que vaut 1 R en euros — et rien n'est réécrit dans
// `trades` : le journal reste en R, la traduction vit ici.
//
// ⚠️ LES BACKTESTS SONT EXCLUS. `trades.mode` vaut 'live' ou 'backtest' depuis
// la migration 007. Un backtest ne paye pas de loyer ; le compter gonflerait la
// part du burn prétendument couverte, c'est-à-dire précisément le chiffre sur
// lequel quelqu'un déciderait de quitter son emploi.
// ─────────────────────────────────────────────────────────────────────────────
import type { Trade } from "../types";
import { moisEntre } from "./calendrier";
import { multiplierParRatio } from "./montants";

export interface PontTrading {
  /** Trades `live` retenus sur la période. */
  nbTrades: number;
  /** Somme des R. Décimale — c'est la donnée telle que le journal la stocke. */
  sommeR: number;
  risqueParRCents: number;
  /** Résultat en euros sur TOUTE la période. */
  contributionCents: number;
  /** Le même, ramené au mois, pour être comparable au burn. */
  contributionMensuelleCents: number;
  burnNetCents: number;
  /**
   * Part du burn mensuel couverte, en pourcentage.
   * `null` quand le burn net est nul ou négatif : « couvrir 100 % de rien » n'a
   * pas de sens, et la division donnerait l'infini.
   */
  partDuBurnPct: number | null;
  /** Mois de charges que la contribution TOTALE permet de tenir. */
  moisCouverts: number | null;
  debut: string;
  fin: string;
}

/**
 * Contribution du trading, en euros, sur une période.
 *
 * `debut` et `fin` sont inclusifs, au format YYYY-MM-DD.
 */
export function pontTrading(
  trades: Trade[],
  debut: string,
  fin: string,
  risqueParRCents: number,
  burnNetCents: number,
): PontTrading {
  const retenus = trades.filter(
    (t) => t.mode !== "backtest" && t.date >= debut && t.date <= fin,
  );
  const sommeR = retenus.reduce((s, t) => s + t.result_r, 0);
  const contributionCents = multiplierParRatio(risqueParRCents, sommeR);

  // Une période plus courte qu'un mois ne doit pas être extrapolée : ramener
  // trois jours de trading à un rythme mensuel multiplierait le résultat par
  // dix, ce qui produirait un « 340 % du burn couvert » après une bonne semaine.
  const mois = Math.max(moisEntre(debut, fin), 1);
  const contributionMensuelleCents = Math.round(contributionCents / mois);

  const partDuBurnPct =
    burnNetCents > 0
      ? Math.round((contributionMensuelleCents / burnNetCents) * 1000) / 10
      : null;

  const moisCouverts =
    burnNetCents > 0 ? Math.round((contributionCents / burnNetCents) * 10) / 10 : null;

  return {
    nbTrades: retenus.length,
    sommeR,
    risqueParRCents,
    contributionCents,
    contributionMensuelleCents,
    burnNetCents,
    partDuBurnPct,
    moisCouverts,
    debut,
    fin,
  };
}

/**
 * Valeur de départ proposée pour « 1 R en euros », déduite des réglages du
 * calculateur de position (`sizing.capital` × `sizing.risk` %).
 *
 * C'est une SUGGESTION affichée dans le champ, jamais une valeur appliquée en
 * silence : le risque par trade a pu changer dix fois sur la période couverte,
 * et personne d'autre que l'utilisateur ne sait ce qu'il a réellement risqué.
 */
export function risqueParRSuggere(
  capital: number | null,
  risquePct: number | null,
): number | null {
  if (capital === null || risquePct === null) return null;
  if (!Number.isFinite(capital) || !Number.isFinite(risquePct)) return null;
  if (capital <= 0 || risquePct <= 0) return null;
  return Math.round(capital * 100 * (risquePct / 100));
}
