import { useCallback, useEffect, useMemo, useReducer, type CSSProperties } from "react";
import ShaleMark from "./ShaleMark";
import {
  modeleInitial,
  reduire,
  type EtatEntree,
} from "../../lib/entree/machine";
import { reperesEntree, variablesEntree } from "../../lib/entree/geometrie";
import { appEstPrete, rectMarque, rectParDefaut, surAppPrete } from "../../lib/entree/signal";

/**
 * L'entrée dans Shale : on traverse la marque.
 *
 * Le POURQUOI et l'empilement des trois couches sont dans `src/index.css`,
 * § « L'entrée dans Shale ». Ici, la mécanique.
 *
 * ⭐ Ce fichier ne contient AUCUNE logique d'états — elle est dans
 * `lib/entree/machine.ts`, pure et testée. Ici on ne fait que brancher des
 * événements réels sur elle : `animationend`, une tape, un minuteur, et le
 * signal « l'app est prête ». C'est ce partage qui rend testable le cas qui
 * casse en silence (`prefers-reduced-motion`).
 */

/** Le nom de l'animation qui clôt chaque temps. */
const ANIMATION_DE: Record<string, EtatEntree> = {
  // Le temps 1 a DEUX horloges possibles, et une seule est garantie.
  // `entree-effacer` vit sur le formulaire, qui n'existe qu'après connexion ;
  // `entree-tenir` / `entree-apparaitre` vivent sur la copie de la marque, qui
  // existe toujours. C'est cette dernière qui fait foi. (Voir le § « LE TEMPS 1
  // EST PORTÉ PAR LA COPIE » de `src/index.css` : sans elle, l'ouverture à
  // froid restait bloquée 2,5 s.)
  "entree-effacer": "poser",
  "entree-tenir": "poser",
  "entree-apparaitre": "poser",
  "entree-approche": "approche",
  "entree-ouvrir": "traversee",
  // Même leçon qu'au temps 1 : deux horloges valent mieux qu'une. Celle-ci vit
  // sur la copie, celle du dessus sur l'enveloppe de l'app. La première qui
  // finit fait avancer la machine ; la seconde est ignorée (la machine rejette
  // un `animationend` qui ne vient pas du temps en cours).
  "entree-traversee-marque": "traversee",
  // Le repli sans mouvement : c'est l'app qui porte le fondu, et c'est lui qui
  // fait avancer la machine. Sans cette ligne, `prefers-reduced-motion`
  // laisserait l'utilisateur derrière le voile jusqu'au minuteur de sécurité.
  "entree-fondu": "traversee",
};

/** Le grossissement du temps 2. Le temps 3 le prolonge (voir les keyframes). */
const ECHELLE = 4.5;

/**
 * Les quatre facteurs de la parallaxe des strates.
 * ⚠️ Dans l'ordre de `BARS` de `ShaleMark` : la troisième est l'accent.
 */
const PARALLAXE = [1.0, 1.06, 1.12, 1.18] as const;

/**
 * Le filet. Un chargement bloqué ne doit JAMAIS piéger quelqu'un derrière un
 * logo : au pire, on saute à l'état final et l'app apparaît telle qu'elle est.
 */
const EXPIRATION_MS = 2500;

function prefereMoinsDeMouvement(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface Entree {
  readonly phase: EtatEntree;
  readonly active: boolean;
  /** À poser sur le mur ET sur l'enveloppe de l'app : les deux portent des animations. */
  readonly gererAnimation: (e: { animationName: string }) => void;
  readonly demarrer: () => void;
}

/**
 * Pilote la transition. Rend l'état et les branchements ; le rendu du voile est
 * dans `<VoileEntree>`.
 */
export function useEntree(): Entree {
  const reduit = useMemo(prefereMoinsDeMouvement, []);
  const [modele, envoyer] = useReducer(
    reduire,
    { reduit, appPrete: appEstPrete() },
    modeleInitial,
  );
  const phase = modele.etat;
  const active = phase !== "idle" && phase !== "done";

  const demarrer = useCallback(() => envoyer({ type: "demarrer" }), []);

  const gererAnimation = useCallback((e: { animationName: string }) => {
    const temps = ANIMATION_DE[e.animationName];
    // Une animation étrangère qui remonte par bouillonnement n'est pas un temps.
    if (temps) envoyer({ type: "finAnimation", temps });
  }, []);

  // « L'app est prête » peut arriver à n'importe quel moment, y compris avant
  // le démarrage. La machine sait la retenir.
  useEffect(() => surAppPrete(() => envoyer({ type: "appPrete" })), []);

  // Les repères géométriques du FLIP, posés sur <html> parce que le voile, la
  // copie et l'enveloppe de l'app vivent dans trois sous-arbres différents.
  // Le calcul lui-même est pur et testé (`lib/entree/geometrie.ts`).
  useEffect(() => {
    if (!active) return;
    const racine = document.documentElement;
    const taille = 52; // celle de la marque sur l'écran de connexion
    const rect =
      rectMarque() ?? rectParDefaut(taille, window.innerWidth, window.innerHeight);
    const vars = variablesEntree(
      reperesEntree(rect, window.innerWidth, window.innerHeight, ECHELLE),
    );
    for (const [k, v] of Object.entries(vars)) racine.style.setProperty(k, v);
    return () => {
      for (const k of Object.keys(vars)) racine.style.removeProperty(k);
    };
  }, [active]);

  /**
   * ⚠️ ONGLET CACHÉ : on saute directement à l'état final.
   *
   * Constaté en mesurant, le 2026-09-12 : quand `document.hidden` est vrai, le
   * navigateur GÈLE la timeline. Les animations restent `running` avec un
   * `currentTime` bloqué à 0, et `animationend` n'arrive jamais. Quelqu'un qui
   * se connecte puis change d'application aussitôt retrouverait donc un mur
   * figé, jusqu'à ce que le minuteur de sécurité tombe 2,5 s plus tard.
   *
   * Une animation que personne ne regarde n'a rien à jouer. On la termine.
   */
  useEffect(() => {
    if (!active) return;
    const verifier = () => {
      if (document.hidden) envoyer({ type: "interrompre" });
    };
    verifier(); // déjà caché au démarrage : on ne commence même pas
    document.addEventListener("visibilitychange", verifier);
    return () => document.removeEventListener("visibilitychange", verifier);
  }, [active]);

  // Interruption et filet de sécurité, montés ensemble et démontés ensemble.
  useEffect(() => {
    if (!active) return;
    const sauter = () => envoyer({ type: "interrompre" });
    const minuteur = window.setTimeout(() => envoyer({ type: "expiration" }), EXPIRATION_MS);
    // `capture` : on veut la tape AVANT que quoi que ce soit d'autre la mange.
    window.addEventListener("pointerdown", sauter, { capture: true });
    window.addEventListener("keydown", sauter, { capture: true });
    return () => {
      window.clearTimeout(minuteur);
      window.removeEventListener("pointerdown", sauter, { capture: true });
      window.removeEventListener("keydown", sauter, { capture: true });
    };
  }, [active]);

  return { phase, active, gererAnimation, demarrer };
}

/**
 * Le voile : le mur de connexion figé, plus la copie animée de la marque.
 *
 * `enfants` est le mur lui-même (`ChassisFactice` + `LoginScreen`), rendu tel
 * quel : c'est ce qui garantit la continuité, l'utilisateur ne voit rien
 * changer au premier temps hormis le formulaire qui s'efface.
 */
export function VoileEntree({
  phase,
  origine,
  gererAnimation,
  enfants,
}: {
  phase: EtatEntree;
  /** D'où l'on vient : après connexion il y a un formulaire à effacer, à froid non. */
  origine: "connexion" | "froid";
  gererAnimation: (e: { animationName: string }) => void;
  enfants: React.ReactNode;
}) {
  const actif = phase !== "idle" && phase !== "done";
  // ⚠️ `will-change` posé au démarrage et retiré à la fin, jamais en permanence :
  // laissé là, il garde une couche de compositing pour rien, sur toutes les
  // vues, pour le restant de la session.
  const style: CSSProperties = actif ? { willChange: "transform, opacity" } : {};

  return (
    <>
      <div
        className={actif ? "entree-voile" : undefined}
        data-entree={actif ? phase : undefined}
        onAnimationEnd={gererAnimation}
        // Pendant qu'il s'efface, le mur ne doit plus rien recevoir : ni la
        // tabulation, ni un lecteur d'écran, ni un clic qui repartirait dans
        // un formulaire déjà soumis.
        inert={actif}
      >
        {enfants}
      </div>
      {actif && (
        <div
          className="entree-copie"
          data-phase={phase}
          data-origine={origine}
          style={style}
          // ⚠️ SON PROPRE `onAnimationEnd`, et ce n'est pas une redondance.
          // La copie est la SŒUR du voile, pas son enfant — il le faut, sinon
          // le `z-index: 200` du voile l'enfermerait dans son contexte
          // d'empilement et elle passerait sous l'app. Un événement ne
          // remontant qu'à ses ANCÊTRES, le gestionnaire du voile ne l'entend
          // donc jamais. C'est ce qui laissait la machine bloquée au temps 1 :
          // relevé dans l'app iOS, `1584 poser` → `4100 done`, 2516 ms de
          // minuteur pour une animation de 200 ms.
          onAnimationEnd={gererAnimation}
          aria-hidden
        >
          <ShaleMark size="100%" parallaxe={PARALLAXE} />
        </div>
      )}
    </>
  );
}

export type { EtatEntree };
