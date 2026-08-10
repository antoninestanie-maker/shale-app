import { useCallback, useEffect, useRef, useState } from "react";

import { getDb } from "../db";
import { isTauri } from "../repo";
import { AUTH_CONFIGURED, SUPABASE_ANON_KEY, SUPABASE_URL } from "../auth/config";
import type { Session } from "../auth/supabase";
import type { SousCles } from "./crypto";
import { synchroniser } from "./engine";
import { RequeteRefusee, SessionExpiree } from "./http";
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

/**
 * Pourquoi le dernier cycle a échoué. L'indicateur en a besoin : « réessaiera
 * tout seul » et « n'aboutira jamais sans intervention » ne se disent pas de la
 * même façon, et les fondre en un seul « échec » revient soit à alarmer pour
 * une coupure de Wi-Fi, soit à taire un schéma qui n'a jamais été joué.
 */
export type Raison =
  /** Réseau, serveur occupé : ça repartira tout seul. Rien à dire. */
  | "passagere"
  /** Session périmée et non renouvelable : il faut se reconnecter. */
  | "session"
  /** Refus ferme du serveur (schéma absent, politique RLS) : ça doit se voir. */
  | "configuration";

export interface EtatSync {
  statut: Statut;
  activite: Activite;
  /** Nombre d'ENTITÉS en attente d'envoi (pas d'écritures : voir `outbox.ts`). */
  enAttente: number;
  /** Dernier échange réussi, ISO. */
  dernierSucces: string | null;
  /** Dernière erreur lisible, ou `null`. */
  erreur: string | null;
  /** Nature du dernier échec. `null` quand il n'y en a pas. */
  raison: Raison | null;
  /** Faux si la clé n'a pas pu être rangée durablement (trousseau indisponible). */
  clePersistee: boolean;
}

export interface ApiSync extends EtatSync {
  synchroniserMaintenant(): Promise<void>;
  /**
   * Première activation sur le compte.
   *
   * ⚠️ Le code de récupération est FOURNI, pas renvoyé : quand cette promesse
   * se résout, la synchronisation existe déjà côté serveur. Le montrer après
   * reviendrait à faire confirmer « je l'ai noté » à quelqu'un qui n'a plus la
   * possibilité de renoncer. L'appelant le tire (`genererCode()`), le fait
   * confirmer, puis active. Cf. `SyncOnboarding.tsx`.
   */
  activer(motDePasse: string, codeRecuperation: string | null): Promise<void>;
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
  raison: null,
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
    raison: null,
    clePersistee: true,
    synchroniserMaintenant: rien,
    async activer() {
      setStatut("active");
      setStatutDemo("active");
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

/**
 * ⚠️ `RequeteRefusee` mérite d'être distinguée. C'est l'erreur qu'on obtiendra
 * si `sync.sql` n'a pas été joué sur le projet (404 sur la table), ou si une
 * politique RLS refuse (42501) : elle ne guérira pas en attendant, et la
 * confondre avec une coupure réseau produirait exactement le pire scénario —
 * une app qui affiche « hors ligne » pendant des jours alors que le backend
 * n'a jamais existé.
 */
function raisonDe(e: unknown): Raison {
  if (e instanceof SessionExpiree) return "session";
  if (e instanceof RequeteRefusee) return "configuration";
  return "passagere";
}

export function useSync(
  session: Session | null,
  /** Voir `AuthState.jetonFrais` : un jeton Supabase ne vit qu'une heure. */
  jetonFrais: (forcer?: boolean) => Promise<string>,
): ApiSync {
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
      // Le renouvellement peut échouer (refresh token révoqué côté serveur, ou
      // simplement réseau coupé). On le renomme en `SessionExpiree` pour que le
      // transport et l'indicateur le lisent comme tel, au lieu d'un message
      // GoTrue brut affiché dans une info-bulle de sidebar.
      jeton: async (forcer) => {
        try {
          return await jetonFrais(forcer);
        } catch (e) {
          throw new SessionExpiree(lisible(e));
        }
      },
      userId: session?.user.id ?? "",
    }),
    [jetonFrais, session],
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
      setEtat((e) => ({ ...e, erreur: null, raison: null }));
    } catch (e) {
      setEtat((prev) => ({ ...prev, erreur: lisible(e), raison: raisonDe(e) }));
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
      setEtat((e) => ({ ...e, statut: "active", clePersistee: persistee, erreur: null, raison: null }));
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
        if (!annule)
          setEtat((prev) => ({ ...prev, statut: "verrouillee", erreur: lisible(e), raison: raisonDe(e) }));
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
    async (motDePasse: string, codeRecuperation: string | null) => {
      if (!session) throw new Error("session absente");
      const r = await activerCle(depot(), deriverKek, session.user.id, motDePasse, codeRecuperation);
      await demarrer(r.cles, r.dek);
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
