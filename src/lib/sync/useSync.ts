import { useCallback, useEffect, useRef, useState } from "react";

import { getDb } from "../db";
import { isTauri } from "../repo";
import { AUTH_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } from "../auth/config";
import type { Session } from "../auth/supabase";
import type { SousCles } from "./crypto";
import { synchroniser } from "./engine";
import { deriverKek } from "./kdf";
import {
  activer as activerCle,
  changerMotDePasse as reScellerMotDePasse,
  ouvrirAvecCode,
  ouvrirAvecMotDePasse,
  poserCodeRecuperation as poserCode,
  retirerCodeRecuperation as retirerCode,
  CleAbsente,
} from "./keys";
import { DepotSupabase, lireDek, oublierDek, rangerDek } from "./keystore";
import { lireMeta, lireOutbox, type BaseLocale } from "./local";
import { nombreEnAttente } from "./outbox";
import { demarrerPlanificateur, type Planificateur } from "./planificateur";
import { TransportSupabase, type ConfigSupabase } from "./transport";

/**
 * Point d'entrée unique de la synchronisation pour l'interface.
 *
 * ─── POURQUOI L'ACTIVATION EST EXPLICITE ───────────────────────────────────
 * Ouvrir la clé exige le MOT DE PASSE, qui n'existe que le temps de l'écran de
 * connexion — « rester connecté » conserve une session, pas un mot de passe. On
 * pourrait l'intercepter au login, mais cela mêlerait la porte d'entrée de
 * l'app à une fonctionnalité optionnelle, et obligerait à traiter le cas « mot
 * de passe correct mais clé de synchronisation absente » en plein écran de
 * connexion. L'activation se fait donc dans Réglages, une fois. Ensuite la clé
 * vit dans le trousseau et les lancements suivants l'ouvrent en silence.
 */

export type Statut =
  /** Mode démo, preview navigateur, ou auth non configurée : rien à synchroniser. */
  | "indisponible"
  /** Jamais activée sur ce compte. */
  | "inactive"
  /** Activée, mais la clé n'est pas ouverte ici (nouvel appareil, trousseau muet). */
  | "verrouillee"
  | "active";

export type Activite = "repos" | "enCours" | "horsLigne" | "echec";

export interface EtatSync {
  statut: Statut;
  activite: Activite;
  /** Nombre d'ENTITÉS en attente d'envoi (pas d'écritures : voir `outbox.ts`). */
  enAttente: number;
  /** Dernier échange réussi, ISO. */
  dernierSucces: string | null;
  /** Dernière erreur lisible, ou `null`. */
  erreur: string | null;
  /** Faux si la clé n'a pas pu être rangée durablement (trousseau indisponible). */
  clePersistee: boolean;
}

export interface ApiSync extends EtatSync {
  synchroniserMaintenant(): Promise<void>;
  /** Première activation sur le compte. Renvoie le code de récupération. */
  activer(motDePasse: string, avecRecuperation: boolean): Promise<string | null>;
  /** Ouvre la clé sur cet appareil-ci. */
  deverrouiller(motDePasse: string): Promise<void>;
  /** Ouvre la clé quand le mot de passe est perdu. */
  deverrouillerAvecCode(code: string): Promise<void>;
  /** Re-scelle l'enveloppe après un changement de mot de passe. */
  reSceller(nouveauMotDePasse: string): Promise<void>;
  regenererCodeRecuperation(): Promise<string>;
  supprimerCodeRecuperation(): Promise<void>;
  /** Oublie la clé sur CET appareil. Les données locales restent intactes. */
  oublierClé(): Promise<void>;
}

const ETAT_INITIAL: EtatSync = {
  statut: "indisponible",
  activite: "repos",
  enAttente: 0,
  dernierSucces: null,
  erreur: null,
  clePersistee: true,
};

// ─── Mode démo ───────────────────────────────────────────────────────────────
// Sans Tauri ni Supabase, la synchronisation est inerte : toute son interface
// renverrait `null` et deviendrait invisible jusqu'à ce que le backend soit
// branché ET l'app native reconstruite. On ne peut ni la relire, ni l'ajuster.
//
// D'où cet état simulé, réglable depuis Réglages — exactement le même parti que
// le sélecteur d'offre (`demoTier`) qui permet d'éprouver le paywall sans
// backend. Il ne synchronise évidemment rien : il ne sert qu'à VOIR les écrans.

const CLE_DEMO = "shale.demo.sync";

export function statutDemo(): Statut {
  try {
    const v = localStorage.getItem(CLE_DEMO);
    if (v === "indisponible" || v === "inactive" || v === "verrouillee" || v === "active") return v;
  } catch {
    /* stockage indisponible */
  }
  return "inactive";
}

export function setStatutDemo(v: Statut): void {
  try {
    localStorage.setItem(CLE_DEMO, v);
  } catch {
    /* stockage indisponible */
  }
}

const CODE_DEMO = "SHALE-4T7K-9BQZ-2MXE-8PWA-5RVH-3JND-6C1F";

function useSyncDemo(): ApiSync {
  const [statut, setStatut] = useState<Statut>(statutDemo);
  const rien = async () => {};
  return {
    statut,
    activite: "repos",
    enAttente: statut === "active" ? 3 : 0,
    dernierSucces: statut === "active" ? new Date(Date.now() - 4 * 60_000).toISOString() : null,
    erreur: null,
    clePersistee: true,
    synchroniserMaintenant: rien,
    async activer() {
      setStatut("active");
      setStatutDemo("active");
      return CODE_DEMO;
    },
    async deverrouiller() {
      setStatut("active");
      setStatutDemo("active");
    },
    async deverrouillerAvecCode() {
      setStatut("active");
      setStatutDemo("active");
    },
    reSceller: rien,
    async regenererCodeRecuperation() {
      return CODE_DEMO;
    },
    supprimerCodeRecuperation: rien,
    async oublierClé() {
      setStatut("verrouillee");
      setStatutDemo("verrouillee");
    },
  };
}

/** Le compte-rendu d'erreur reste lisible : pas de pile, pas de jargon. */
function lisible(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useSync(session: Session | null): ApiSync {
  // ⚠️ Appelé INCONDITIONNELLEMENT, comme tous les hooks ci-dessous : c'est
  // seulement la valeur RENVOYÉE qui dépend du mode. Un appel conditionnel
  // casserait l'ordre des hooks au premier changement d'état.
  const demo = useSyncDemo();
  const [etat, setEtat] = useState<EtatSync>(ETAT_INITIAL);

  // Ces trois-là ne doivent PAS déclencher de rendu : ce sont des ressources,
  // pas de l'affichage. Les mettre dans un state relancerait l'effet à chaque
  // synchronisation.
  const clesRef = useRef<SousCles | null>(null);
  const dekRef = useRef<Uint8Array | null>(null);
  const planRef = useRef<Planificateur | null>(null);

  const utilisable = isTauri && AUTH_CONFIGURED && !!session;

  const config = useCallback(
    (): ConfigSupabase => ({
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      accessToken: session?.access_token ?? "",
      userId: session?.user.id ?? "",
    }),
    [session],
  );

  const depot = useCallback(() => new DepotSupabase(config()), [config]);

  /** Relit la file d'attente. Requête courte, sans effet de bord. */
  const rafraichirAttente = useCallback(async (db: BaseLocale) => {
    const entrees = await lireOutbox(db);
    const dernier = await lireMeta(db, "last_push_at");
    setEtat((e) => ({ ...e, enAttente: nombreEnAttente(entrees), dernierSucces: dernier || e.dernierSucces }));
  }, []);

  /** Un cycle complet, puis rafraîchissement de ce que l'indicateur montre. */
  const cycle = useCallback(async () => {
    const cles = clesRef.current;
    if (!cles || !session) return;
    const db = (await getDb()) as unknown as BaseLocale;
    try {
      await synchroniser({
        db,
        transport: new TransportSupabase(config()),
        cles,
        userId: session.user.id,
        deviceId: (await lireMeta(db, "device_id")) ?? "inconnu",
      });
      setEtat((e) => ({ ...e, erreur: null }));
    } catch (e) {
      setEtat((prev) => ({ ...prev, erreur: lisible(e) }));
      throw e; // le planificateur a besoin de l'échec pour son recul
    } finally {
      await rafraichirAttente(db);
    }
  }, [config, rafraichirAttente, session]);

  /** Démarre le planificateur une fois la clé ouverte. */
  const demarrer = useCallback(
    async (cles: SousCles, dek: Uint8Array) => {
      clesRef.current = cles;
      dekRef.current = dek;
      const persistee = await rangerDek(dek);
      planRef.current?.arreter();
      planRef.current = demarrerPlanificateur(cycle);
      setEtat((e) => ({ ...e, statut: "active", clePersistee: persistee, erreur: null }));
    },
    [cycle],
  );

  // ─── Ouverture silencieuse au démarrage ────────────────────────────────────
  useEffect(() => {
    if (!utilisable) {
      setEtat({ ...ETAT_INITIAL, statut: "indisponible" });
      return;
    }
    let annule = false;

    void (async () => {
      const dek = await lireDek();
      if (annule) return;

      if (dek) {
        // La clé est déjà là : rien à demander à l'utilisateur.
        const { deriverSousCles } = await import("./crypto");
        await demarrer(await deriverSousCles(dek), dek);
        return;
      }

      // Pas de clé ici. Reste à savoir si le compte en a une ailleurs — ce qui
      // distingue « à activer » de « à déverrouiller », deux écrans différents.
      try {
        const enveloppes = await depot().lire();
        if (!annule) setEtat((e) => ({ ...e, statut: enveloppes ? "verrouillee" : "inactive" }));
      } catch (e) {
        // Réseau indisponible au lancement : on ne sait pas trancher. On
        // n'invente pas — « verrouillée » est l'hypothèse la moins destructrice
        // (elle ne propose pas de créer une clé qui existerait déjà ailleurs).
        if (!annule) setEtat((prev) => ({ ...prev, statut: "verrouillee", erreur: lisible(e) }));
      }
    })();

    return () => {
      annule = true;
    };
  }, [utilisable, depot, demarrer]);

  // Le planificateur survit aux rendus mais pas au démontage.
  useEffect(() => () => planRef.current?.arreter(), []);

  // L'activité vient du planificateur, qui n'est pas réactif : on l'échantillonne.
  useEffect(() => {
    if (etat.statut !== "active") return;
    const id = setInterval(() => {
      const activite = planRef.current?.etat();
      if (activite) setEtat((e) => (e.activite === activite ? e : { ...e, activite }));
    }, 1000);
    return () => clearInterval(id);
  }, [etat.statut]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const activer = useCallback(
    async (motDePasse: string, avecRecuperation: boolean) => {
      if (!session) throw new Error("session absente");
      const r = await activerCle(depot(), deriverKek, session.user.id, motDePasse, avecRecuperation);
      await demarrer(r.cles, r.dek);
      return r.codeRecuperation;
    },
    [depot, demarrer, session],
  );

  const deverrouiller = useCallback(
    async (motDePasse: string) => {
      if (!session) throw new Error("session absente");
      const r = await ouvrirAvecMotDePasse(depot(), deriverKek, session.user.id, motDePasse);
      await demarrer(r.cles, r.dek);
    },
    [depot, demarrer, session],
  );

  const deverrouillerAvecCode = useCallback(
    async (code: string) => {
      if (!session) throw new Error("session absente");
      const r = await ouvrirAvecCode(depot(), deriverKek, session.user.id, code);
      await demarrer(r.cles, r.dek);
    },
    [depot, demarrer, session],
  );

  const reSceller = useCallback(
    async (nouveauMotDePasse: string) => {
      if (!session || !dekRef.current) throw new CleAbsente();
      await reScellerMotDePasse(depot(), deriverKek, session.user.id, dekRef.current, nouveauMotDePasse);
    },
    [depot, session],
  );

  const regenererCodeRecuperation = useCallback(async () => {
    if (!session || !dekRef.current) throw new CleAbsente();
    return poserCode(depot(), deriverKek, session.user.id, dekRef.current);
  }, [depot, session]);

  const supprimerCodeRecuperation = useCallback(async () => {
    await retirerCode(depot());
  }, [depot]);

  const oublierClé = useCallback(async () => {
    planRef.current?.arreter();
    planRef.current = null;
    clesRef.current = null;
    dekRef.current = null;
    await oublierDek();
    setEtat((e) => ({ ...e, statut: "verrouillee", activite: "repos", enAttente: 0 }));
  }, []);

  const synchroniserMaintenant = useCallback(async () => {
    await planRef.current?.maintenant();
  }, []);

  if (!utilisable) return demo;

  return {
    ...etat,
    synchroniserMaintenant,
    activer,
    deverrouiller,
    deverrouillerAvecCode,
    reSceller,
    regenererCodeRecuperation,
    supprimerCodeRecuperation,
    oublierClé,
  };
}
