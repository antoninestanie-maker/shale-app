import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth, type AuthState } from "../../lib/auth/useAuth";
import LoginScreen from "./LoginScreen";
import ChassisFactice from "./ChassisFactice";
import SubscriptionRequired from "./SubscriptionRequired";
import ShaleMark from "./ShaleMark";
import { useEntree, VoileEntree } from "./EntryTransition";
import { mesurerMarque } from "../../lib/entree/signal";
import { openExternal } from "../../lib/auth/external";
import { ACCOUNT_PAGES, STRIPE_ENABLED } from "../../lib/auth/config";

import { t, tp } from "../../lib/i18n";
// Contexte d'auth exposé à l'app déverrouillée (déconnexion, e-mail, abonnement).
const AuthContext = createContext<AuthState | null>(null);

/** Accès à la session depuis l'app (ex. bouton « Se déconnecter » dans Réglages). */
export function useSession(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error(t("useSession doit être utilisé dans <AuthGate>"));
  return ctx;
}

function Splash() {
  /**
   * ⭐ La marque du Splash EST le point de départ de l'ouverture à froid.
   *
   * Sans session à ouvrir, il n'y a pas d'écran de connexion pour donner sa
   * position à la transition. On relève donc celle-ci, tant qu'elle est à
   * l'écran : la traversée repart exactement d'où la marque pulsait, au lieu
   * de sauter au centre géométrique.
   */
  const marque = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mesurerMarque(marque.current);
  });

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg">
      <div ref={marque} className="animate-pulse">
        <ShaleMark size={48} />
      </div>
      <p className="text-sm text-text-dim">{t("Chargement…")}</p>
    </div>
  );
}

/**
 * Bandeau d'essai : discret tant qu'il reste du temps, ambre sur la fin.
 * Il ne s'affiche que pendant l'essai gratuit — jamais pour un abonné.
 */
function TrialBanner({ days }: { days: number }) {
  const urgent = days <= 2;
  return (
    <div
      className={`flex items-center justify-center gap-3 border-b px-4 py-1.5 text-[12px] ${
        urgent
          ? "border-yellow/30 bg-yellow/10 text-yellow"
          : "border-border bg-surface text-text-dim"
      }`}
    >
      <span>
        {t("Essai gratuit —")}{" "}
        <span className="font-semibold">
          {days === 0
            ? t("dernier jour")
            : tp(days, "{n} jour restant", "{n} jours restants")}
        </span>
      </span>
      <button
        onClick={() => openExternal(ACCOUNT_PAGES.home)}
        className="underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
      >
        {t("Choisir ma formule")}
      </button>
    </div>
  );
}

/**
 * Bandeau « hors ligne » du mode dégradé.
 *
 * Discret mais permanent : l'utilisateur doit pouvoir comprendre, sans le
 * chercher, pourquoi sa synchronisation ne part pas. « Réessayer » repasse par
 * le serveur — c'est le seul chemin de retour vers `ready`.
 */
function BandeauHorsLigne({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center gap-3 border-b border-border bg-surface px-4 py-1.5 text-[12px] text-text-dim">
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow" />
        {t("Hors ligne — tes données restent sur ce Mac, la synchronisation reprendra plus tard.")}
      </span>
      <button
        onClick={onRetry}
        className="underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
      >
        {t("Réessayer")}
      </button>
    </div>
  );
}

/**
 * Le mur de connexion, plein cadre.
 *
 * Le décor est une MAQUETTE (`ChassisFactice`), pas l'app : la monter pour la
 * flouter reviendrait à lire SQLite et à rendre de vraies données avant toute
 * authentification. Voir le fichier, qui porte le raisonnement.
 */
function Mur({ auth }: { auth: AuthState }) {
  return (
    <div className="relative h-screen overflow-hidden bg-bg">
      <ChassisFactice />
      <div className="relative h-full">
        <LoginScreen
          onSignIn={auth.signIn}
          onSignUp={auth.signUp}
          erreurInitiale={auth.error}
        />
      </div>
    </div>
  );
}

/**
 * Porte d'entrée.
 *
 * ⚠️ `children` — c'est-à-dire toute l'app — n'est rendu QUE dans les états
 * `ready` et `offlineGrace`. Ce n'est pas un détail de présentation : tant qu'on
 * n'y est pas, `App` n'est pas monté, donc `fetchAll()` n'est jamais appelé et
 * SQLite n'est pas lue. Un mur qui monterait l'app derrière lui ne serait pas
 * un mur.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const entree = useEntree();

  /**
   * La transition démarre quand la porte s'OUVRE, jamais au montage.
   *
   * TROIS chemins y mènent, parce qu'il y a trois murs et qu'ils tombent tous
   * sur la même porte :
   *   - `signedOut → ready` : connexion OU création de compte. Il y a un
   *     formulaire à effacer, et la marque part de sa place sur l'écran.
   *   - `loading → ready` : ouverture à froid, session déjà là. Rien à
   *     effacer ; la marque part de là où le `Splash` la faisait pulser.
   *   - `noSub → ready` : on vient de s'abonner et de cliquer « Revérifier ».
   *     ⚠️ Celui-ci manquait, et c'était une RÉGRESSION : `BootScreen` couvrait
   *     ce passage avant d'être supprimé. Sans lui, l'app apparaissait d'un
   *     coup, sans rien pour habiller la revérification côté serveur.
   *
   * ⚠️ En `StrictMode`, cet effet est joué deux fois en développement. Ce n'est
   * pas un problème : `demarrer` ne quitte que l'état `idle`, donc le second
   * appel ne fait rien. C'est la machine qui garde l'invariant, pas l'appelant.
   */
  const { demarrer } = entree;
  const statutPrecedent = useRef(auth.status);
  const [origineMemorisee, setOrigine] = useState<"connexion" | "froid">("connexion");

  /**
   * ⚠️ CE BOOLÉEN EST CALCULÉ PENDANT LE RENDU, ET C'EST NÉCESSAIRE.
   *
   * `auth.status` passe à `ready` en un rendu. Si l'on n'apprenait le
   * démarrage que dans un effet, ce rendu-là aurait déjà décidé que le mur
   * n'est plus visible : React le démonterait, et le rendu suivant le
   * remonterait. Le formulaire se réinitialiserait — champs vidés, bouton qui
   * cesse de tourner — juste avant de s'effacer. Un `useLayoutEffect` ne
   * sauverait rien : le démontage a lieu au premier rendu, avant lui.
   *
   * On lit donc le statut PRÉCÉDENT (jamais muté pendant le rendu, donc stable
   * y compris sous le double rendu de `StrictMode`) pour savoir, dès ce
   * rendu-ci, que la transition va commencer.
   */
  const venaitDuMur = statutPrecedent.current === "signedOut";
  const venaitDUnAutreMur =
    statutPrecedent.current === "loading" || statutPrecedent.current === "noSub";
  const deverrouilleMaintenant = auth.status === "ready" || auth.status === "offlineGrace";
  const demarrageImminent = (venaitDuMur || venaitDUnAutreMur) && deverrouilleMaintenant;
  const origine = demarrageImminent
    ? venaitDuMur
      ? "connexion"
      : "froid"
    : origineMemorisee;

  /**
   * ⚠️ `useLayoutEffect` et non `useEffect` : la machine doit quitter `idle`
   * AVANT que le navigateur peigne. Avec un effet ordinaire, une image
   * complète passerait entre « l'app est montée » et « le voile est posé » —
   * un clignotement de l'app avant sa propre entrée.
   *
   * ⚠️ En `StrictMode`, joué deux fois en développement. `demarrer` ne quitte
   * que l'état `idle` : le second appel ne fait rien. C'est la machine qui
   * garde l'invariant, pas l'appelant.
   */
  useLayoutEffect(() => {
    const avant = statutPrecedent.current;
    statutPrecedent.current = auth.status;
    if (avant !== "signedOut" && avant !== "loading" && avant !== "noSub") return;
    if (auth.status !== "ready" && auth.status !== "offlineGrace") return;
    setOrigine(avant === "signedOut" ? "connexion" : "froid");
    demarrer();
  }, [auth.status, demarrer]);

  if (auth.status === "loading") return <Splash />;
  if (auth.status === "noSub")
    return (
      <SubscriptionRequired
        email={auth.session?.user.email ?? ""}
        subscription={auth.subscription}
        error={auth.error}
        onRecheck={auth.recheck}
        onSignOut={auth.signOut}
      />
    );

  // Le bandeau lit `status` en direct, sans passer par `entitlementsOf` — d'où
  // le rappel du drapeau ici.
  //
  // ⚠️ CORRIGÉ LE 2026-09-02 : ce commentaire décrivait l'inverse de la réalité.
  // Il disait que « la base ouvre une ligne `trialing` à la création du compte,
  // indépendamment de Stripe ». C'était vrai jusqu'au 2026-08-31 ; depuis, le
  // trigger d'inscription écrit `status = 'none'` et **l'essai vient de Stripe**
  // (migration 004 du site) — il n'existe qu'après enregistrement d'une carte.
  //
  // Le garde `STRIPE_ENABLED` reste, et il garde son sens : si la boutique était
  // refermée un jour, un `trialing` résiduel en base ne devrait pas faire
  // réapparaître une échéance au-dessus d'un produit redevenu sans mur.
  //
  // Décision d'Antonin, 2026-09-02 : l'essai est POSSIBLE mais pas OBLIGATOIRE.
  // Le bandeau ne s'affiche donc que pour qui en a réellement un — celui qui
  // s'abonne directement (`sansEssai`) ne verra jamais d'échéance inventée.
  //
  // `entitlementsOf` serait le bon appel, mais `entitlements.ts` importe
  // `useSession` d'ici : le cycle d'imports rendrait ce module fragile pour un
  // gain nul, la question tenant en un booléen.
  const trialDays =
    STRIPE_ENABLED && auth.subscription?.status === "trialing"
      ? (auth.subscription.trial_days_left ?? null)
      : null;

  /**
   * ⚠️ `children` — c'est-à-dire toute l'app — n'est rendu QUE dans les états
   * `ready` et `offlineGrace`. Ce n'est pas un détail de présentation : tant
   * qu'on n'y est pas, `App` n'est pas monté, donc `fetchAll()` n'est jamais
   * appelé et SQLite n'est pas lue. Un mur qui monterait l'app derrière lui ne
   * serait pas un mur.
   *
   * La transition d'entrée ne desserre PAS ce garde : elle ne commence
   * qu'APRÈS le succès de l'authentification. Ce qu'elle habille, c'est le
   * chargement — pas l'attente d'un mot de passe.
   */
  const deverrouille = auth.status === "ready" || auth.status === "offlineGrace";
  const murVisible = auth.status === "signedOut" || entree.active || demarrageImminent;

  /**
   * ⚠️ L'ORDRE DE CES DEUX ENFANTS EST STRUCTUREL, pas cosmétique.
   *
   * React réconcilie les enfants d'un fragment PAR POSITION. Le mur doit donc
   * rester à l'index 0 avant comme pendant la transition : s'il changeait de
   * place, React le démonterait et le remonterait, et le formulaire se
   * réinitialiserait — champs vidés, bouton qui cesse de tourner — à l'instant
   * précis où le premier temps est censé vendre la continuité.
   *
   * L'empilement à l'écran, lui, ne vient pas du DOM mais du `z-index` :
   * voile 200, app 300 (découpée), copie de la marque 400.
   */
  return (
    <>
      {murVisible ? (
        <VoileEntree
          phase={entree.phase}
          origine={origine}
          gererAnimation={entree.gererAnimation}
          // À froid, aucun formulaire : le voile n'est que le fond de l'app,
          // et la copie de la marque joue par-dessus.
          enfants={origine === "connexion" ? <Mur auth={auth} /> : null}
        />
      ) : null}
      {deverrouille ? (
        <AuthContext.Provider value={auth}>
          {/* `display: contents` au repos : cette enveloppe n'existe pour la
              mise en page que pendant la transition. On ne peut pas la retirer
              du DOM à la fin — React démonterait `App`, qui relirait SQLite. */}
          <div
            className="entree-app"
            data-phase={entree.phase}
            onAnimationEnd={entree.gererAnimation}
          >
            {auth.status === "offlineGrace" && <BandeauHorsLigne onRetry={auth.recheck} />}
            {trialDays !== null && <TrialBanner days={trialDays} />}
            {children}
          </div>
        </AuthContext.Provider>
      ) : null}
    </>
  );
}
