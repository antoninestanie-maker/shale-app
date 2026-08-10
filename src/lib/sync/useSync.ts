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
  ouvrirAvecMotDePasse,
  SecretInvalide,
} from "./keys";
import { DepotSupabase, lireDek, oublierDek, rangerDek } from "./keystore";
import { ecrireMeta, lireMeta, lireOutbox, toutRemettreEnFile, type BaseLocale } from "./local";
import { nombreEnAttente } from "./outbox";
import { TABLES_SYNC } from "./scope";
import { demarrerPlanificateur, type Planificateur } from "./planificateur";
import { EVENEMENT_SECRET, retirerMotDePasse } from "./sas";
import { TransportSupabase, type ConfigSupabase } from "./transport";

/**
 * Point d'entrée unique de la synchronisation pour l'interface.
 *
 * ─── CONNECTÉ = SYNCHRONISÉ, SANS RIEN DEMANDER ───────────────────────────
 * Il n'y a ni écran d'activation, ni code à noter. Se connecter suffit.
 *
 * Le chiffrement de bout en bout est conservé : ce qui change, c'est d'où vient
 * le secret. Il exige le MOT DE PASSE, qui n'existe que le temps de l'écran de
 * connexion — « rester connecté » conserve une session, pas un mot de passe.
 * Plutôt que de le redemander dans une cérémonie que personne ne comprend, on
 * le saisit au vol à l'instant où l'utilisateur vient de le taper (`sas.ts`).
 * Ensuite la clé vit dans le trousseau, et les lancements suivants l'ouvrent
 * en silence sans rien réclamer.
 *
 * ⚠️ CE QUE CE CHOIX COÛTE, ET QUI EST ASSUMÉ. Sans code de récupération, un
 * mot de passe RÉINITIALISÉ PAR E-MAIL rend la copie cloud illisible : elle est
 * scellée par l'ancien. Deux garde-fous, et une limite :
 *   • changement de mot de passe depuis l'app → l'enveloppe est re-scellée
 *     automatiquement, rien n'est perdu ;
 *   • un appareil qui détient encore la clé la re-scelle de la même façon ;
 *   • mais si AUCUN appareil ne l'a plus, la copie cloud est irrécupérable —
 *     statut `orpheline`. Les données LOCALES, elles, restent intactes, et
 *     l'utilisateur peut repartir d'elles.
 */

export type Statut =
  /** Mode démo, preview navigateur, ou auth non configurée : rien à synchroniser. */
  | "indisponible"
  /** Jamais activée sur ce compte. Transitoire : la connexion suivante l'active. */
  | "inactive"
  /** La clé n'est pas ouverte ici et le mot de passe n'a pas été retapé. */
  | "verrouillee"
  /**
   * Une clé existe dans le cloud, mais le mot de passe actuel ne l'ouvre pas :
   * il a été réinitialisé par e-mail depuis un autre appareil, et l'enveloppe
   * est restée scellée par l'ancien. Les données locales sont intactes ; la
   * copie cloud, elle, est perdue et doit être republiée depuis cet appareil.
   */
  | "orpheline"
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
   * Efface la copie cloud devenue illisible et la reconstruit depuis cet
   * appareil. Réservé au statut `orpheline` — destructif pour ce qui n'existe
   * QUE sur un autre appareil.
   */
  republier(motDePasse: string): Promise<void>;
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
    if (
      v === "indisponible" ||
      v === "inactive" ||
      v === "verrouillee" ||
      v === "orpheline" ||
      v === "active"
    )
      return v;
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
    async republier() {
      setStatut("active");
      setStatutDemo("active");
    },
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

  /**
   * Met en service la synchronisation SANS rien demander.
   *
   * ─── LA RÈGLE : CONNECTÉ = SYNCHRONISÉ ───────────────────────────────────
   * Il n'y a plus d'écran d'activation, plus de code à noter, plus de case à
   * cocher. Se connecter suffit. Le chiffrement de bout en bout est conservé —
   * ce qui change, c'est d'où vient le secret : le mot de passe que
   * l'utilisateur vient de taper, saisi au vol par le sas, au lieu d'une
   * cérémonie qui le lui redemandait.
   *
   * Trois chemins, dans cet ordre de préférence :
   *   1. la clé est déjà dans le trousseau → on démarre, rien à faire ;
   *   2. un mot de passe attend dans le sas → on crée la clé (premier compte)
   *      ou on la rouvre (nouvel appareil), en silence ;
   *   3. ni l'un ni l'autre → on reste verrouillé et l'app fonctionne
   *      normalement, les écritures s'empilant dans l'outbox.
   *
   * Le cas 3 est RARE et ne survient qu'avec « rester connecté » sur un
   * appareil dont le trousseau a été vidé : la session est restaurée sans que
   * le mot de passe ait été retapé.
   */
  const ouvrirSansRienDemander = useCallback(async (): Promise<void> => {
    if (!session) return;

    // ⚠️ Retiré dans TOUS les cas, même si on n'en a pas l'usage : le sas ne
    // doit pas garder un mot de passe en mémoire au-delà de cet instant.
    const motDePasse = retirerMotDePasse();

    // La clé est-elle déjà à portée — en mémoire, ou dans le trousseau ?
    const dek = dekRef.current ?? (await lireDek());

    if (dek) {
      if (!clesRef.current) {
        const { deriverSousCles } = await import("./crypto");
        await demarrer(await deriverSousCles(dek), dek);
      }

      // ⚠️ RE-SCELLEMENT SYSTÉMATIQUE à chaque mot de passe vu.
      //
      // Il ne sert pas qu'au changement de mot de passe explicite : il couvre
      // surtout la RÉINITIALISATION PAR E-MAIL, faite ailleurs, dont l'app
      // n'est jamais informée. Sans lui, l'enveloppe resterait scellée par
      // l'ancien mot de passe, et le prochain appareil ne pourrait plus rien
      // ouvrir — alors que la clé était là, intacte, sur celui-ci.
      //
      // Coût : une dérivation (~150 ms) et un POST, une fois par connexion.
      // Bénéfice : l'enveloppe correspond TOUJOURS au dernier mot de passe
      // employé. Vérifier d'abord si c'est nécessaire coûterait la même
      // dérivation — autant re-sceller.
      //
      // Best-effort et SILENCIEUX : hors ligne au lancement, ça échoue sans
      // conséquence, et la connexion suivante rattrapera.
      if (motDePasse) {
        try {
          await reScellerMotDePasse(depot(), deriverKek, session.user.id, dek, motDePasse);
        } catch {
          /* réessayé à la prochaine connexion */
        }
      }
      return;
    }

    if (!motDePasse) {
      // On ne sait pas encore si le compte a une clé ailleurs, et le savoir
      // demanderait le réseau. « Verrouillée » est l'hypothèse la moins
      // destructrice : elle ne propose jamais de créer une clé qui existerait
      // déjà, ce qui rendrait l'ancienne copie cloud orpheline.
      setEtat((e) => ({ ...e, statut: "verrouillee" }));
      return;
    }

    try {
      const enveloppes = await depot().lire();

      if (!enveloppes) {
        // Premier appareil de ce compte : la clé naît ici. Aucun code de
        // récupération — c'est le choix produit (voir `SyncSettings`).
        const r = await activerCle(depot(), deriverKek, session.user.id, motDePasse, null);
        await demarrer(r.cles, r.dek);
        return;
      }

      const r = await ouvrirAvecMotDePasse(depot(), deriverKek, session.user.id, motDePasse);
      await demarrer(r.cles, r.dek);
    } catch (e) {
      // ⚠️ Un mot de passe VALIDE pour se connecter mais qui n'ouvre pas
      // l'enveloppe signifie une seule chose : il a été réinitialisé par
      // e-mail depuis un autre appareil. L'enveloppe est scellée par l'ANCIEN.
      // Sans clé locale, la copie cloud est irrécupérable — d'où un statut
      // dédié plutôt qu'un « mot de passe invalide » qui serait mensonger.
      const perdue = e instanceof SecretInvalide;
      setEtat((prev) => ({
        ...prev,
        statut: perdue ? "orpheline" : "verrouillee",
        erreur: perdue ? null : lisible(e),
        raison: perdue ? null : raisonDe(e),
      }));
    }
  }, [depot, demarrer, session]);

  // ─── Mise en service au démarrage ──────────────────────────────────────────
  useEffect(() => {
    if (!utilisable) {
      setEtat({ ...ETAT_INITIAL, statut: "indisponible" });
      return;
    }
    void ouvrirSansRienDemander();
  }, [utilisable, ouvrirSansRienDemander]);

  // ─── Mot de passe déposé pendant que l'app tourne ──────────────────────────
  // Connexion (le dépôt précède le montage de ce hook, d'où l'appel ci-dessus)
  // ET changement de mot de passe (le dépôt arrive bien après). Les deux passent
  // par le même chemin, qui sait lequel des deux il traite.
  useEffect(() => {
    if (!utilisable) return;
    const surSecret = () => void ouvrirSansRienDemander();
    window.addEventListener(EVENEMENT_SECRET, surSecret);
    return () => window.removeEventListener(EVENEMENT_SECRET, surSecret);
  }, [utilisable, ouvrirSansRienDemander]);

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

  /*
   * Retirées avec l'activation automatique (2026-08-10) : `activer`,
   * `deverrouiller`, `deverrouillerAvecCode`, `reSceller`,
   * `regenererCodeRecuperation`, `supprimerCodeRecuperation`.
   *
   * Plus aucun écran ne les appelait — l'ouverture se fait toute seule à la
   * connexion (`ouvrirSansRienDemander`). Les garder aurait laissé, sur un
   * module de sécurité, une surface publique que rien n'exerce ni ne teste.
   *
   * ⚠️ Les fonctions correspondantes de `keys.ts` sont CONSERVÉES, elles, et
   * restent testées : c'est la couche où le code de récupération reviendrait
   * si la décision produit changeait. C'est l'exposition à l'interface qui a
   * disparu, pas la mécanique.
   */


  /**
   * Repart de zéro depuis CET appareil.
   *
   * Seule issue quand le mot de passe a été réinitialisé par e-mail et qu'aucun
   * appareil ne détient plus la clé : l'enveloppe du serveur est scellée par un
   * secret que personne n'a, donc son contenu est déjà perdu — pas par cette
   * opération, mais avant elle.
   *
   * Ce qui est détruit : la copie CLOUD, illisible de toute façon.
   * Ce qui est préservé : la base locale, intégralement — c'est elle qu'on
   * republie. L'utilisateur ne perd donc rien de ce qu'il a sur cet appareil.
   *
   * ⚠️ En revanche, ce qui n'existait QUE sur un autre appareil et n'a jamais
   * été rapatrié ici est perdu pour de bon. À dire avant, pas après.
   */
  const republier = useCallback(
    async (motDePasse: string) => {
      if (!session) throw new Error("session absente");

      // 1. Clé neuve, scellée par le mot de passe actuel.
      const r = await activerCle(depot(), deriverKek, session.user.id, motDePasse, null);

      // 2. Le contenu du serveur devient du bruit : on l'efface AVANT de
      //    republier, sinon le premier cycle tirerait des lignes illisibles.
      await new TransportSupabase(config()).effacerTout();

      // 3. Oublier ce qu'on croyait savoir du serveur — plus rien n'est vrai.
      const db = (await getDb()) as unknown as BaseLocale;
      await ecrireMeta(db, "cursor", "0");
      await db.execute("DELETE FROM sync_state");

      // 4. Tout remettre en file : la base locale devient la nouvelle source.
      await toutRemettreEnFile(db, TABLES_SYNC);

      await demarrer(r.cles, r.dek);
      await planRef.current?.maintenant();
    },
    [config, depot, demarrer, session],
  );

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
    republier,
    oublierClé,
  };
}
