// ─────────────────────────────────────────────────────────────────────────────
// Le hook du module Finance — tout ce qui n'est ni pur ni du JSX.
//
// Il charge la base, dérive les chiffres via les fonctions pures voisines, et
// rafraîchit les cotations EN ARRIÈRE-PLAN. Ce dernier point n'est pas un
// détail d'optimisation : la vue s'affiche avec ce que le cache contient, tout
// de suite, et le réseau ne bloque jamais un rendu. Une cotation qui ne répond
// pas laisse une ligne datée, pas un écran d'attente.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { todayStr } from "../logic";
import {
  fetchFinance,
  fetchSizingSettings,
  getSetting,
  isTauri,
  saveFinanceFx,
  saveFinanceQuotes,
  setSetting,
  type FinanceData,
} from "../repo";
import { burnMensuel, recurrentsPerimes } from "./burn";
import { ajouterMois, debutDeMois } from "./calendrier";
import { datesMensuelles, patrimoineAu, seriePatrimoine } from "./patrimoine";
import { risqueParRSuggere } from "./pont-trading";
import { estFraiche, rafraichirCotations, rafraichirTaux } from "./quotes";
import { runway } from "./runway";
import { valoriser } from "./valorisation";

/** Réglage : ce que vaut 1 R en centimes. Déclaré, jamais deviné. */
export const CLE_RISQUE_PAR_R = "finance.risk_per_r_cents";
/** Devise d'affichage du module. */
export const CLE_DEVISE = "finance.devise";
export const DEVISE_DEFAUT = "EUR";

const VIDE: FinanceData = {
  comptes: [],
  balances: [],
  recurrents: [],
  categories: [],
  holdings: [],
  quotes: [],
  fx: [],
};

/** Événement interne : une écriture a eu lieu, tout le monde se resynchronise. */
const EVENT = "sb:finance";
export const signalerChangementFinance = () => window.dispatchEvent(new CustomEvent(EVENT));

export function useFinance() {
  const [data, setData] = useState<FinanceData>(VIDE);
  const [pret, setPret] = useState(false);
  const [risqueParRCents, setRisqueParRCents] = useState<number | null>(null);
  const [risqueSuggere, setRisqueSuggere] = useState<number | null>(null);
  const [devise, setDeviseEtat] = useState(DEVISE_DEFAUT);
  const [marcheEnCours, setMarcheEnCours] = useState(false);
  const [erreursMarche, setErreursMarche] = useState<string[]>([]);
  const marcheFait = useRef(false);

  const recharger = useCallback(async () => {
    const [d, brut, dev] = await Promise.all([
      fetchFinance(),
      getSetting(CLE_RISQUE_PAR_R),
      getSetting(CLE_DEVISE),
    ]);
    setData(d);
    const n = brut === null ? null : Number(brut);
    setRisqueParRCents(n !== null && Number.isFinite(n) ? n : null);
    setDeviseEtat(dev || DEVISE_DEFAUT);
  }, []);

  useEffect(() => {
    let vivant = true;
    const charger = () =>
      recharger()
        .catch(() => {})
        .finally(() => {
          if (vivant) setPret(true);
        });
    charger();
    window.addEventListener(EVENT, charger);
    return () => {
      vivant = false;
      window.removeEventListener(EVENT, charger);
    };
  }, [recharger]);

  // Valeur PROPOSÉE pour « 1 R en euros », lue des réglages du calculateur.
  // Proposée seulement : le risque par trade a pu changer dix fois sur la
  // période, et personne d'autre que l'utilisateur ne sait ce qu'il a risqué.
  useEffect(() => {
    fetchSizingSettings()
      .then((s) => setRisqueSuggere(risqueParRSuggere(s.capital, s.risk)))
      .catch(() => {});
  }, []);

  const aujourdhui = todayStr();

  const patrimoine = useMemo(
    () => patrimoineAu(data.comptes, data.balances, aujourdhui),
    [data.comptes, data.balances, aujourdhui],
  );

  const burn = useMemo(
    () => burnMensuel(data.recurrents, aujourdhui),
    [data.recurrents, aujourdhui],
  );

  const perimes = useMemo(
    () => recurrentsPerimes(data.recurrents, aujourdhui),
    [data.recurrents, aujourdhui],
  );

  // ⚠️ `null` et non `0` quand rien n'est relevé : « je n'ai pas de données »
  // et « je n'ai pas d'argent » sont deux réponses opposées, et le runway les
  // traite différemment.
  const liquideConnu = patrimoine.lignes.some((l) => l.montantCents !== null)
    ? patrimoine.liquideCents
    : null;

  const piste = useMemo(
    () => runway(liquideConnu, burn, aujourdhui),
    [liquideConnu, burn, aujourdhui],
  );

  const valorisation = useMemo(
    () => valoriser(data.holdings, data.quotes, data.fx, devise, new Date().toISOString()),
    [data.holdings, data.quotes, data.fx, devise],
  );

  /** Courbe du patrimoine sur les douze derniers mois, plus le mois courant. */
  const serie = useMemo(() => {
    const fin = debutDeMois(aujourdhui);
    return seriePatrimoine(
      data.comptes,
      data.balances,
      datesMensuelles(ajouterMois(fin, -12), fin),
    );
  }, [data.comptes, data.balances, aujourdhui]);

  const enregistrerRisqueParR = useCallback(async (cents: number | null) => {
    setRisqueParRCents(cents);
    await setSetting(CLE_RISQUE_PAR_R, cents === null ? "" : String(cents)).catch(() => {});
  }, []);

  const enregistrerDevise = useCallback(async (code: string) => {
    setDeviseEtat(code);
    await setSetting(CLE_DEVISE, code).catch(() => {});
  }, []);

  /**
   * Va chercher les cotations manquantes ou datées.
   *
   * Ne rejette jamais et ne vide jamais le cache : au pire, l'écran garde ses
   * chiffres précédents et l'utilisateur voit qu'ils datent.
   */
  const rafraichirMarche = useCallback(
    async (forcer = false) => {
      if (data.holdings.length === 0) return;
      setMarcheEnCours(true);
      try {
        const maintenant = new Date().toISOString();
        const connues = new Map(data.quotes.map((q) => [q.symbol, q]));
        const demandes = data.holdings
          .filter((h) => h.source !== "manuel")
          .filter((h) => {
            const q = connues.get(h.symbol);
            return forcer || !q || !estFraiche(q.fetched_at, maintenant);
          })
          .map((h) => ({ symbol: h.symbol, source: h.source as "yahoo" | "binance" }));

        const { cotations, erreurs } = await rafraichirCotations(demandes);
        if (cotations.length) await saveFinanceQuotes(cotations);

        // Les devises à convertir se déduisent des cotations qu'on VIENT
        // d'obtenir, cache compris : demander un taux pour une devise qu'aucune
        // position n'utilise serait un appel réseau pour rien.
        const devises = new Set(
          [...cotations, ...data.quotes].map((q) => q.currency).filter((c) => c !== devise),
        );
        const { taux, erreurs: erreursFx } = await rafraichirTaux(
          [...devises].map((base) => ({ base, quote: devise })),
        );
        if (taux.length) await saveFinanceFx(taux);

        setErreursMarche([...erreurs, ...erreursFx]);
        if (cotations.length || taux.length) await recharger();
      } catch {
        /* jamais bloquant */
      } finally {
        setMarcheEnCours(false);
      }
    },
    [data.holdings, data.quotes, devise, recharger],
  );

  // Un seul rafraîchissement automatique par session de vue, et seulement dans
  // l'app native : en preview navigateur, ces domaines sont bloqués par CORS et
  // l'appel n'aurait aucune chance d'aboutir.
  useEffect(() => {
    if (!pret || marcheFait.current || !isTauri || data.holdings.length === 0) return;
    marcheFait.current = true;
    void rafraichirMarche();
  }, [pret, data.holdings.length, rafraichirMarche]);

  return {
    pret,
    data,
    aujourdhui,
    patrimoine,
    burn,
    runway: piste,
    valorisation,
    serie,
    perimes,
    devise,
    risqueParRCents,
    risqueSuggere,
    marcheEnCours,
    erreursMarche,
    recharger,
    enregistrerRisqueParR,
    enregistrerDevise,
    rafraichirMarche,
  };
}

export type FinanceEtat = ReturnType<typeof useFinance>;
