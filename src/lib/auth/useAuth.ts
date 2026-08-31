import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_EMAILS, AUTH_CONFIGURED, STRIPE_ENABLED } from "./config";
import { estActive, hasAccess } from "./access";
import { deposerMotDePasse, viderSas } from "../sync/sas";
import { t } from "../i18n";
import {
  fetchSubscription,
  getUser,
  refreshSession,
  signInWithPassword,
  signOutServer,
  isActive,
  signUpWithPassword,
  updatePassword,
  type Session,
  type Subscription,
} from "./supabase";
import {
  lireMeta,
  marquerActive,
  memoriser,
  oublier,
  lireRefreshToken,
  refreshTokenHerite,
} from "./stockage";

// ─────────────────────────────────────────────────────────────────────────────
// État de la porte d'entrée.
//
//  loading      — on vérifie la session AUPRÈS DU SERVEUR. SQLite n'est pas lue,
//                 l'app n'est pas montée.
//  signedOut    — pas de session valide → mur de connexion.
//  offlineGrace — le serveur est injoignable, mais une session a été validée il
//                 y a moins de GRACE_JOURS. L'app s'ouvre, avec la mention
//                 « hors ligne ». Voir la constante, plus bas.
//  noSub        — connecté, aucun abonnement actif. Sans objet tant que
//                 STRIPE_ENABLED est faux.
//  ready        — session prouvée par le serveur → l'app est déverrouillée.
// ─────────────────────────────────────────────────────────────────────────────
export type AuthStatus = "loading" | "signedOut" | "noSub" | "ready" | "offlineGrace";

/**
 * Combien de temps l'app s'ouvre sans avoir pu joindre le serveur.
 *
 * ⚠️ C'EST UNE PORTE DÉROBÉE, VOLONTAIRE ET BORNÉE. Quiconque coupe le réseau
 * ouvre l'app pendant ce délai avec un jeton qui n'est plus vérifiable — un
 * compte supprimé hier fonctionne encore aujourd'hui en mode avion.
 *
 * Elle est assumée parce que l'alternative est pire : Shale est *offline-first*,
 * ses données vivent dans SQLite sur la machine de l'utilisateur, et un mur qui
 * exige le réseau enferme quelqu'un hors de SES PROPRES données dès qu'il est
 * dans un train. Refuser l'entrée à un client légitime pour gêner un fraudeur
 * qui a, de toute façon, la base en clair sur son disque, ce serait se tromper
 * de menace.
 *
 * Le délai court depuis la DERNIÈRE VALIDATION SERVEUR (`lastVerifiedAt`), pas
 * depuis le dernier démarrage : rester hors ligne ne le prolonge jamais.
 */
export const GRACE_JOURS = 30;
const GRACE_MS = GRACE_JOURS * 24 * 60 * 60 * 1000;

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  subscription: Subscription | null;
  isAdmin: boolean;
  error: string | null;
  /**
   * `remember` est CONSERVÉ dans la signature mais n'a plus d'effet : la session
   * est toujours persistée. Il ne servait qu'à ne PAS l'enregistrer — une case
   * « se souvenir de moi » qui, sur une app de bureau rouverte tous les matins,
   * ne faisait que forcer une ressaisie quotidienne du mot de passe. Le retirer
   * demanderait de toucher `LoginScreen` sans rien gagner.
   */
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  /**
   * Crée un compte et, si le projet Supabase n'exige pas de confirmation par
   * e-mail, ouvre la session dans la foulée. `needsConfirmation` dit lequel des
   * deux s'est produit : l'écran doit afficher « va cliquer le lien » au lieu
   * d'attendre une entrée dans l'app qui ne viendra pas.
   */
  signUp: (
    email: string,
    password: string,
    remember: boolean,
  ) => Promise<{ needsConfirmation: boolean }>;
  /** Change le mot de passe du compte connecté (l'utilisateur reste connecté). */
  changePassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  recheck: () => Promise<void>;
  /**
   * Un jeton d'accès VALABLE, renouvelé si nécessaire.
   *
   * ⚠️ Ajouté pour la synchronisation, et il corrige un défaut qui la dépasse :
   * la session n'était rafraîchie qu'au DÉMARRAGE de l'app. Or un jeton
   * Supabase vit une heure. Tout ce qui appelle le backend en tâche de fond
   * dans une app laissée ouverte — la synchronisation toutes les 90 s en
   * premier — récoltait donc un 401 perpétuel après la première heure, sans
   * que rien ne le signale. Un appel ponctuel déclenché par un clic ne le
   * voyait pas : l'utilisateur relançait l'app avant de s'en apercevoir.
   *
   * `forcer` sert quand le serveur refuse un jeton que l'app croyait frais.
   */
  jetonFrais: (forcer?: boolean) => Promise<string>;
}

/**
 * Panne réseau, ou refus du serveur ?
 *
 * La distinction commande TOUT le comportement au démarrage : un refus veut
 * dire « déconnecte », une panne veut dire « on verra plus tard ». Les
 * confondre, c'est soit déconnecter les gens dans le train, soit laisser entrer
 * avec un jeton révoqué.
 *
 * `fetch` rejette avec un TypeError quand la requête ne part pas — DNS, réseau
 * coupé, serveur injoignable. Un 4xx, lui, est une RÉPONSE : le serveur a parlé,
 * et il a dit non.
 */
function estPanneReseau(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const statut = (e as { status?: number })?.status;
  // Pas de statut = la requête n'a jamais abouti. Un 5xx est une panne côté
  // serveur, pas un refus : on ne déconnecte pas pour ça.
  return statut === undefined || statut >= 500;
}

// ── Mode démo (auth non configurée) ────────────────────────────────────────
// Permet de développer l'UI sans backend : n'importe quel identifiant entre,
// et l'abonnement est considéré actif. Voir src/lib/auth/config.ts.
//
// L'offre simulée est réglable (Réglages → compte, en démo uniquement) : sans
// ça, le gating des modules trading ne serait pas testable sans Supabase.
const DEMO_TIER_KEY = "shale.demo.tier";

export function demoTier(): "shale" | "shale_trade" | "trialing" {
  try {
    const v = localStorage.getItem(DEMO_TIER_KEY);
    if (v === "shale" || v === "shale_trade" || v === "trialing") return v;
  } catch {
    /* stockage indisponible */
  }
  return "shale_trade";
}

export function setDemoTier(v: "shale" | "shale_trade" | "trialing"): void {
  try {
    localStorage.setItem(DEMO_TIER_KEY, v);
  } catch {
    /* stockage indisponible */
  }
}

// `activated: true` partout ici : le mode démo n'a pas de base où lire une
// liste d'invités, et un mur d'activation infranchissable en preview navigateur
// rendrait l'UI indéveloppable. Le bypass est celui du mode démo tout entier —
// il ne s'applique jamais quand `AUTH_CONFIGURED` est vrai.
function demoSub(): Subscription {
  const v = demoTier();
  if (v === "trialing")
    return {
      status: "trialing",
      plan: "demo",
      tier: "shale",
      billing_period: null,
      current_period_end: null,
      trial_days_left: 5,
      is_active: true,
      has_trading: true, // l'essai ouvre tout
      activated: true,
    };
  return {
    status: "active",
    plan: "demo",
    tier: v,
    billing_period: "monthly",
    current_period_end: null,
    is_active: true,
    has_trading: v === "shale_trade",
    activated: true,
  };
}
function demoSession(email: string): Session {
  return {
    access_token: "demo",
    refresh_token: "demo",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "demo-user", email: email || "demo@shale.app" },
  };
}

export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  // La session, lisible SANS passer par le rendu. `jetonFrais` doit être stable
  // (elle est mémorisée par le transport de synchronisation, qui ne se
  // reconstruit pas à chaque rendu) tout en voyant toujours la session à jour :
  // une dépendance sur `session` la ferait changer d'identité à chaque
  // renouvellement, donc redémarrerait le planificateur pour rien.
  const sessionRef = useRef<Session | null>(null);
  // Un seul renouvellement en vol : sans ce partage, trois appels simultanés
  // consommeraient trois fois le même refresh token — que GoTrue fait tourner à
  // chaque usage, donc les deux derniers échoueraient et déconnecteraient.
  const renouvellementRef = useRef<Promise<Session> | null>(null);

  /** Date de la dernière confirmation par le SERVEUR. Pilote le délai de grâce. */
  const verifieLeRef = useRef<number>(0);

  /**
   * Le serveur a-t-il confirmé l'activation de ce compte ?
   *
   * Un ref et non un état : il n'est lu que par `ranger`, pour décider ce qui
   * part sur le disque. Il retombe à `false` à chaque `resolve`, avant la
   * vérification — jamais l'inverse.
   */
  const activeRef = useRef(false);

  /**
   * Range une session validée : en mémoire, et sur le disque.
   *
   * `remember` a disparu de la signature. Il ne servait qu'à ne PAS persister —
   * une case « se souvenir de moi » qui, sur une app de bureau qu'on rouvre tous
   * les matins, n'avait pour effet que de faire ressaisir le mot de passe.
   */
  const ranger = useCallback((s: Session | null, verifieLe = Date.now()) => {
    sessionRef.current = s;
    setSession(s);
    if (s) {
      verifieLeRef.current = verifieLe;
      void memoriser(s, verifieLe, activeRef.current);
    } else {
      verifieLeRef.current = 0;
      activeRef.current = false;
      void oublier();
    }
  }, []);

  /** Marge avant expiration : renouveler pile à l'heure, c'est arriver en retard. */
  const MARGE_S = 60;

  const jetonFrais = useCallback(async (forcer = false): Promise<string> => {
    const s = sessionRef.current;
    if (!s) throw new Error(t("Aucune session ouverte."));
    if (!AUTH_CONFIGURED) return s.access_token;

    const perime = s.expires_at - MARGE_S < Math.floor(Date.now() / 1000);
    if (!forcer && !perime) return s.access_token;

    if (!renouvellementRef.current) {
      renouvellementRef.current = refreshSession(s.refresh_token)
        .then((frais) => {
          // Un renouvellement réussi EST une confirmation par le serveur : il a
          // accepté le jeton. Le délai de grâce repart donc de maintenant.
          ranger(frais);
          return frais;
        })
        .finally(() => {
          renouvellementRef.current = null;
        });
    }
    return (await renouvellementRef.current).access_token;
  }, [ranger]);

  /**
   * Résout l'état à partir d'une session DÉJÀ VALIDÉE par le serveur.
   *
   * ⚠️ Cette fonction ne valide rien elle-même — elle ne lit qu'un abonnement.
   * C'est exactement la confusion qui a créé la faille : jusqu'au 2026-08-12,
   * l'échec de `fetchSubscription` (un 401 sur jeton bidon) tombait dans le
   * `catch`, et le `else` de `STRIPE_ENABLED` concluait « ready ». Autrement
   * dit, **l'échec de la vérification valait autorisation**.
   *
   * Les deux questions sont désormais séparées : « ce jeton est-il authentique »
   * se règle avant d'arriver ici, par `getUser()` ou par un renouvellement
   * réussi ; « ce compte a-t-il un abonnement » se règle ici, et son échec ne
   * peut plus ouvrir la porte puisque la porte est déjà franchie.
   */
  const resolve = useCallback(
    async (s: Session, verifieLe = Date.now()): Promise<string | null> => {
      if (!AUTH_CONFIGURED) {
        activeRef.current = true; // voir `demoSub`
        ranger(s, verifieLe);
        setSubscription(demoSub());
        setStatus("ready");
        return null;
      }

      // ── L'ordre de ces trois gestes est le sujet ────────────────────────────
      // 1. `activeRef` retombe à faux : rien n'est encore prouvé ;
      // 2. on RANGE quand même la session. Non par confiance, mais parce que
      //    GoTrue fait TOURNER le `refresh_token` à chaque usage : celui qu'on
      //    tient est le seul valide, et ne pas l'écrire condamnerait le
      //    prochain démarrage. La méta partie sur le disque dit `activated:
      //    false` — donc même tuée ici, l'app ne s'ouvrira pas hors ligne ;
      // 3. on demande au serveur, et alors seulement on décide.
      activeRef.current = false;
      ranger(s, verifieLe);

      let sub: Subscription;
      try {
        sub = await fetchSubscription(s);
      } catch (e) {
        // La lecture a échoué — la session, elle, est prouvée. Mais c'est CETTE
        // lecture qui porte l'activation : sans elle, il n'y a pas de « on
        // ouvre par défaut » possible. L'ancien code s'y autorisait quand
        // Stripe était éteint (« aucun droit à vérifier ») ; depuis le
        // 2026-08-13 il y a un droit à vérifier, toujours, et son échec ne peut
        // pas valoir autorisation.
        //
        // Le jeton n'est PAS effacé : c'est une panne, pas un refus. Réessayer
        // ou se reconnecter suffit, et un utilisateur légitime ne perd pas son
        // délai de grâce hors ligne pour un 500 passager.
        const msg = e instanceof Error ? e.message : t("Vérification du compte impossible.");
        setSubscription(null);
        setError(msg);
        setStatus("signedOut");
        viderSas();
        return msg;
      }

      setSubscription(sub);

      // ── Compte non activé → retour au mur, pas d'écran intermédiaire ───────
      // Le renvoyer vers `SubscriptionRequired` serait mentir : il n'y a rien à
      // acheter, et son bouton mène à une page d'abonnement sans objet. Il n'y a
      // rien à FAIRE dans l'app tant qu'on n'a pas été invité — donc rien à
      // montrer d'autre que la porte, et la raison pour laquelle elle est close.
      // ⚠️ Depuis que Stripe est allumé, ces deux situations n'ont plus rien à
      // voir, et leur dire la même chose est une faute : quelqu'un qui vient de
      // payer 19 € et à qui on répond « écris-nous pour demander un accès »
      // conclut qu'il s'est fait avoir. On sait pourtant les distinguer —
      // `status` dit s'il a payé.
      if (!estActive(sub)) {
        const aPaye = STRIPE_ENABLED && isActive(sub?.status);
        const msg = aPaye
          ? t(
              "Ton abonnement est bien enregistré, et il n'y a rien à refaire. L'accès est ouvert à la main, compte par compte : le tien le sera très vite. Reconnecte-toi un peu plus tard.",
            )
          : t(
              "Ce compte n'est pas encore activé. L'accès à Shale est ouvert compte par compte — écris-nous depuis le site pour demander le tien.",
            );
        setError(msg);
        // Efface jeton + méta : rien ne doit pouvoir rouvrir hors ligne. Et le
        // mot de passe déposé pour la synchronisation part avec — il n'y a
        // aucune donnée à synchroniser pour qui n'entre pas.
        ranger(null);
        viderSas();
        setSubscription(null);
        setStatus("signedOut");
        return msg;
      }

      // Activé, et le serveur vient de le dire : le disque peut le savoir.
      activeRef.current = true;
      marquerActive();
      setStatus(hasAccess(sub) ? "ready" : "noSub");
      return null;
    },
    [ranger],
  );

  // ── Au démarrage ──────────────────────────────────────────────────────────
  // Restaurer NE VAUT PAS ouvrir. On échange le jeton de rafraîchissement contre
  // une session fraîche, puis on demande au serveur qui en est le porteur. Tant
  // que ces deux appels n'ont pas répondu, l'état reste `loading` : l'app n'est
  // pas montée et SQLite n'est pas lue.
  useEffect(() => {
    let annule = false;
    (async () => {
      const meta = lireMeta();
      const jeton = (await lireRefreshToken()) ?? refreshTokenHerite();

      if (!jeton) {
        if (!annule) setStatus("signedOut");
        return;
      }
      if (!AUTH_CONFIGURED) {
        if (!annule) await resolve(demoSession(meta?.email ?? ""));
        return;
      }

      try {
        const fraiche = await refreshSession(jeton);
        // Le renouvellement suffirait à prouver la session. On demande quand
        // même l'identité : c'est elle qui dit si le COMPTE existe encore, et
        // elle met à jour l'e-mail affiché si l'utilisateur l'a changé ailleurs.
        const u = await getUser(fraiche.access_token);
        if (!annule) await resolve({ ...fraiche, user: u });
      } catch (e) {
        if (annule) return;

        // ── Le serveur a-t-il refusé, ou n'a-t-il pas répondu ? ─────────────
        if (!estPanneReseau(e)) {
          // Refus net : jeton révoqué, expiré, compte supprimé. On oublie.
          await oublier();
          setStatus("signedOut");
          return;
        }

        // Panne réseau. Une session validée récemment ouvre l'app en mode
        // dégradé — voir GRACE_JOURS pour le raisonnement.
        //
        // ⚠️ `meta.activated` est aussi indispensable que le délai. Sans lui, le
        // chemin le plus court pour entrer sans invitation serait : s'inscrire,
        // se voir refuser, couper le réseau, relancer. Le mode dégradé ne peut
        // assouplir que ce qu'il a déjà vérifié une fois.
        const age = meta ? Date.now() - meta.lastVerifiedAt : Infinity;
        if (meta?.activated && age < GRACE_MS) {
          verifieLeRef.current = meta.lastVerifiedAt;
          // On reprend le fait à son compte, sinon le premier renouvellement
          // réussi (au retour du réseau, via `jetonFrais` → `ranger`) réécrirait
          // la méta avec `activated: false` et fermerait la porte au prochain
          // démarrage hors ligne — à quelqu'un qui a pourtant été vérifié.
          activeRef.current = true;
          setSession({
            // Aucun `access_token` : il n'y en a pas, et il ne faut pas en
            // inventer. Tout appel réseau authentifié échouera, ce qui est le
            // comportement voulu — la synchronisation ne doit pas partir ici.
            access_token: "",
            refresh_token: jeton,
            expires_at: 0,
            user: { id: meta.userId, email: meta.email },
          });
          setSubscription(null);
          setStatus("offlineGrace");
          return;
        }

        // Hors délai, jamais activé, ou aucune session validée auparavant : la
        // connexion exige le réseau, et on dit LAQUELLE des trois — se voir
        // reprocher trente jours d'absence quand on a installé l'app ce matin
        // envoie chercher la panne exactement là où elle n'est pas.
        setError(
          !meta
            ? t("La première connexion demande une connexion Internet.")
            : !meta.activated
              ? t("L'activation de ce compte n'a pas encore été vérifiée. Connecte-toi une fois en ligne.")
              : t("Hors ligne depuis plus de {n} jours. Reconnecte-toi une fois en ligne.", {
                  n: GRACE_JOURS,
                }),
        );
        setStatus("signedOut");
      }
    })();
    return () => {
      annule = true;
    };
  }, [resolve]);

  const signIn = useCallback(
    async (email: string, password: string, _remember: boolean) => {
      setError(null);
      const s = AUTH_CONFIGURED
        ? await signInWithPassword(email.trim(), password)
        : demoSession(email.trim());
      // Le serveur vient de délivrer cette session : elle est validée par
      // construction, `resolve` n'a pas à la revérifier.
      // ⚠️ Le mot de passe est le SEUL secret dont l'utilisateur dispose, et il
      // n'existe qu'ici. La synchronisation chiffrée en a besoin pour créer ou
      // rouvrir sa clé ; sans ce dépôt il faudrait le redemander dans un écran
      // dédié. `useSync` le retire et l'efface dans la foulée — voir `sync/sas.ts`.
      deposerMotDePasse(password);
      // ⚠️ `resolve` REND le motif de refus au lieu de lever : il est appelé
      // aussi au démarrage et depuis `recheck`, où une exception n'aurait
      // personne à qui parler. Ici, elle a quelqu'un — `LoginScreen` n'affiche
      // que ce que sa propre promesse rejette, jamais l'état `error` du hook.
      // Sans ce `throw`, un compte non activé verrait le bouton « Se connecter »
      // s'arrêter de tourner et l'écran ne rien dire : le pire des deux mondes,
      // refusé sans savoir pourquoi.
      const refus = await resolve(s);
      if (refus) throw new Error(refus);
    },
    [resolve],
  );

  const signUp = useCallback(
    async (email: string, password: string, _remember: boolean) => {
      setError(null);
      if (!AUTH_CONFIGURED) {
        await resolve(demoSession(email.trim()));
        return { needsConfirmation: false };
      }
      const s = await signUpWithPassword(email.trim(), password);
      if (!s) return { needsConfirmation: true };
      deposerMotDePasse(password);
      // Un compte tout juste créé n'est PAS activé — c'est le cas nominal, pas
      // une anomalie. `resolve` le refuse et rend le motif, qu'on lève pour que
      // l'écran l'affiche : « ton compte est créé, il attend son activation »
      // est précisément ce que l'inscrit doit lire.
      const refus = await resolve(s);
      if (refus) throw new Error(refus);
      return { needsConfirmation: false };
    },
    [resolve],
  );

  const changePassword = useCallback(
    async (newPassword: string) => {
      // En mode démo il n'y a pas de compte : accepter silencieusement plutôt
      // que d'afficher une erreur sur un écran qui n'a rien fait de mal.
      if (!AUTH_CONFIGURED) return;
      await updatePassword(await jetonFrais(), newPassword);
      // L'enveloppe de la clé de synchronisation est scellée par l'ANCIEN mot de
      // passe : sans re-scellement, la copie cloud deviendrait illisible depuis
      // tout nouvel appareil. `useSync` s'en charge en voyant passer celui-ci.
      deposerMotDePasse(newPassword);
    },
    [jetonFrais],
  );

  const signOut = useCallback(async () => {
    // Best-effort : sans réseau la révocation n'a pas lieu, mais le jeton local
    // part quand même. Mieux vaut une session orpheline côté serveur qu'un
    // bouton « Se déconnecter » qui ne déconnecte pas.
    if (session?.access_token && AUTH_CONFIGURED) await signOutServer(session.access_token);
    viderSas();
    // ⚠️ `oublier()` purge les jetons — et RIEN D'AUTRE. `shale.db` n'est pas
    // touchée : les données appartiennent à l'utilisateur, se déconnecter n'est
    // pas se désinscrire. Une déconnexion qui efface le journal de bord serait
    // une perte irréversible pour un geste qu'on fait parfois par prudence.
    ranger(null);
    setSubscription(null);
    setError(null);
    setStatus("signedOut");
  }, [session, ranger]);

  const recheck = useCallback(async () => {
    if (!session) return;
    // Le motif de refus rendu par `resolve` n'a personne à qui parler ici :
    // « Réessayer » ne rejette pas de promesse, il repeint l'écran. L'état
    // (`error`, `status`) porte déjà tout, et `LoginScreen` l'affiche.
    if (!AUTH_CONFIGURED) {
      await resolve(session);
      return;
    }
    // Depuis `offlineGrace`, c'est la tentative de retour en ligne : on repasse
    // par le serveur, sans quoi « Réessayer » ne réessaierait rien.
    try {
      const fraiche = await refreshSession(session.refresh_token);
      const u = await getUser(fraiche.access_token);
      await resolve({ ...fraiche, user: u });
      setError(null);
    } catch (e) {
      if (!estPanneReseau(e)) {
        await oublier();
        ranger(null);
        setStatus("signedOut");
      }
      // Panne réseau : on reste où l'on est, l'utilisateur réessaiera.
    }
  }, [session, resolve, ranger]);

  // Rôle admin : allowlist d'e-mails en prod ; toujours vrai en démo.
  const isAdmin = !AUTH_CONFIGURED
    ? true
    : !!session && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(session.user.email.toLowerCase());

  return {
    status,
    session,
    subscription,
    isAdmin,
    error,
    signIn,
    signUp,
    changePassword,
    signOut,
    recheck,
    jetonFrais,
  };
}
