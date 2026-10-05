// ─────────────────────────────────────────────────────────────────────────────
// `useBrief(data, actif)` — le brief du jour et la clôture, pour la carte
// d'Aujourd'hui.
//
// DÉCLENCHEMENT : à la première ouverture de l'app après l'heure choisie (7 h
// par défaut), ou à cette heure-là si l'app tourne — une vérification par
// minute. UN brief par jour : stocké dans `ia_contenus` (migration 029),
// synchronisé ; un appareil qui arrive après un autre lit celui-là au lieu
// d'en payer un second (le serveur refuse le doublon : `already_done`).
//
// Après un échec, pas de relance automatique le même jour : un appel qui
// échoue en boucle toutes les minutes viderait le quota de la personne. Le
// bouton « Réessayer » reste là.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import type { EtatAppelIa } from "../../components/ia/EtatIa";
import { getLang } from "../i18n";
import { todayStr } from "../logic";
import { ecrireContenuIa, fetchCalendarEvents, fetchRecurringEvents, lireContenuIa, marquerContenuIaLu } from "../repo";
import type { AppData, CalendarEvent } from "../types";
import { faitsDeLaJournee, heureDe, lireHeures, lireSujets, payloadBrief, HEURE_BRIEF_DEFAUT, HEURE_CLOTURE_DEFAUT } from "./brief";
import { SORTIES, type SortieDe } from "./contrats";
import { valider } from "./schema";
import { useIa } from "./useIa";

export type BriefDuJour = SortieDe<"brief"> & { genereLe: string };

/** Un brief relu de la base (ou venu d'un autre appareil) est revalidé. */
export function briefLisible(contenu: unknown): BriefDuJour | null {
  if (typeof contenu !== "object" || contenu === null) return null;
  const { genereLe, ...sortie } = contenu as Record<string, unknown>;
  if (typeof genereLe !== "string" || valider(SORTIES.brief, sortie).length > 0) return null;
  return { ...(sortie as SortieDe<"brief">), genereLe };
}

export async function evenementsDuJour(jour: string): Promise<CalendarEvent[]> {
  const [duJour, recurrents] = await Promise.all([fetchCalendarEvents(jour, jour), fetchRecurringEvents()]);
  const vus = new Set(duJour.map((e) => e.id));
  return [...duJour, ...recurrents.filter((e) => !vus.has(e.id))];
}

export function useBrief(data: AppData, actif: boolean) {
  // `run` est stable (useCallback) ; l'objet `useIa()` entier ne l'est pas.
  const { run } = useIa();
  const jour = todayStr();
  const [brief, setBrief] = useState<BriefDuJour | null>(null);
  const [lu, setLu] = useState(false);
  const [charge, setCharge] = useState(false);
  const [etat, setEtat] = useState<EtatAppelIa>({ etat: "repos" });
  const [heures, setHeures] = useState({ brief: HEURE_BRIEF_DEFAUT, cloture: HEURE_CLOTURE_DEFAUT });
  const enCours = useRef(false);
  const arrete = useRef<string | null>(null); // jour où l'automatique s'est arrêté
  const dataRef = useRef(data);
  dataRef.current = data;

  const relire = useCallback(async () => {
    const c = await lireContenuIa("brief", jour).catch(() => null);
    setBrief(c ? briefLisible(c.contenu) : null);
    setLu(!!c?.lu_le);
    setCharge(true);
  }, [jour]);

  const generer = useCallback(
    async (regenerer: boolean) => {
      if (enCours.current) return;
      enCours.current = true;
      setEtat({ etat: "chargement" });
      try {
        const [sujets, events] = await Promise.all([lireSujets(), evenementsDuJour(jour)]);
        const journee = faitsDeLaJournee(dataRef.current, events, jour);
        const r = await run("brief", payloadBrief(getLang(), jour, sujets, journee, regenerer));
        if (r.ok) {
          const contenu: BriefDuJour = { ...r.data, genereLe: new Date().toISOString() };
          await ecrireContenuIa("brief", jour, contenu);
          setBrief(contenu);
          setLu(false);
          setEtat({ etat: "repos" });
        } else {
          arrete.current = jour;
          setEtat({ etat: "erreur", code: r.code, resetsAt: r.resetsAt ?? null });
        }
      } catch {
        arrete.current = jour;
        setEtat({ etat: "erreur", code: "ai_unavailable" });
      } finally {
        enCours.current = false;
      }
    },
    [run, jour],
  );

  // Lecture au montage, relecture chaque minute (la synchronisation peut
  // apporter le brief d'un autre appareil), et génération à l'heure dite.
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    void lireHeures().then((h) => vivant && setHeures(h));
    void relire();
    const tic = setInterval(() => void relire(), 60_000);
    return () => {
      vivant = false;
      clearInterval(tic);
    };
  }, [actif, relire]);

  useEffect(() => {
    if (!actif || !charge || brief || enCours.current || arrete.current === jour) return;
    const verifier = () => {
      if (heureDe(new Date()) >= heures.brief && !enCours.current && arrete.current !== jour) void generer(false);
    };
    verifier();
    const tic = setInterval(verifier, 60_000);
    return () => clearInterval(tic);
  }, [actif, charge, brief, heures.brief, jour, generer]);

  const marquerLu = useCallback(async () => {
    await marquerContenuIaLu("brief", jour).catch(() => undefined);
    setLu(true);
  }, [jour]);

  return {
    jour,
    brief,
    lu,
    etat,
    heures,
    /** Heure de proposer la clôture du soir ? */
    heureDeCloture: heureDe(new Date()) >= heures.cloture,
    reessayer: () => void generer(false),
    regenerer: () => void generer(true),
    marquerLu,
  };
}
