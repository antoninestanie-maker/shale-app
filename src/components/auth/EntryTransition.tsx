import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type CSSProperties,
} from "react";
import ShaleMark from "./ShaleMark";
import {
  modeleInitial,
  reduire,
  type EtatEntree,
  type ModeEntree,
} from "../../lib/entree/machine";
import { reperesEntree, variablesEntree } from "../../lib/entree/geometrie";
import { animationEntreeAuDemarrage } from "../../lib/entree/reglage";
import { appEstPrete, rectMarque, rectParDefaut, surAppPrete } from "../../lib/entree/signal";
import {
  ANCRE_COIN,
  CONTRACTION,
  PIECES,
  coteCoin,
  rayonCoin,
  transformation,
  trou,
  type Piece,
  type Trou,
} from "../../lib/entree/trou";

/**
 * L'entrée dans Shale : la lueur s'allume, puis on ENTRE dans le logo.
 *
 * ⭐ 2026-10-20, demande d'Antonin : « inspire-toi de l'animation d'entrée de X
 * sur téléphone […] c'est de ça que je parle quand je dis qu'on rentre dans
 * le logo ». L'icône se contracte, puis grossit jusqu'à sortir de l'écran, et
 * l'app apparaît À TRAVERS sa plaque — une fenêtre qui s'ouvre.
 *
 * Un seul logo du premier pixel à l'app : l'écran de lancement (iOS) et la
 * couche `#lancement` d'`index.html` (Mac) montrent l'icône au centre, lueur
 * éteinte ; la transition repart EXACTEMENT de cette image.
 *
 *   poser      la lueur s'allume (≈ 500 ms)
 *   approche   l'inspiration : l'icône se contracte à 86 % (≈ 220 ms), la
 *              nuit autour d'elle se pose (à froid elle l'est déjà ; après
 *              connexion, c'est le mur qui s'efface)
 *   traversee  on entre : l'icône grossit jusqu'à sortir de l'écran ; sa
 *              plaque s'efface d'abord, ses traits ensuite, et l'app,
 *              derrière, se voit par le trou (≈ 650 ms)
 *
 * Le trou est fait de pièces qui ne bougent que par `transform` (pourquoi :
 * `lib/entree/trou.ts`). Ces mouvements sont lancés ici, par l'API Web
 * Animations, tous à la MÊME heure de départ : leurs positions dépendent de la
 * fenêtre et de l'icône, qu'une image clé CSS ne connaît pas. Les HORLOGES de
 * la machine, elles, restent des animations CSS vides sur la copie.
 *
 * Le POURQUOI et l'empilement sont dans `src/index.css`, § « L'entrée dans
 * Shale ». Ici, la mécanique.
 *
 * ⭐ Ce fichier ne contient AUCUNE logique d'états — elle est dans
 * `lib/entree/machine.ts`, pure et testée. Ici on ne fait que brancher des
 * événements réels sur elle : `animationend`, une tape, un minuteur, et le
 * signal « l'app est prête ». C'est ce partage qui rend testable le cas qui
 * casse en silence (`prefers-reduced-motion`).
 */

/** Le nom de l'animation qui clôt chaque temps. */
const ANIMATION_DE: Record<string, EtatEntree> = {
  // ⭐ Chaque temps a son horloge sur la COPIE de l'icône, qui existe toujours
  // (après connexion comme à froid). Ce sont des animations VIDES : elles ne
  // dessinent rien, leur seul travail est de FINIR pour que la machine avance.
  // Le dessin est porté par des animations voisines (la lueur, la sortie),
  // dont la fin est ignorée ici. Voir le § « LE TEMPS 1 EST PORTÉ PAR LA
  // COPIE » de `src/index.css` : sans horloge sur la copie, l'ouverture à
  // froid restait bloquée 2,5 s (2026-09-12).
  "entree-tenir": "poser",
  "entree-maintien": "approche",
  // Deux horloges pour la sortie, comme avant : la copie et l'enveloppe de
  // l'app. La première qui finit fait avancer la machine ; la seconde est
  // ignorée (la machine rejette un `animationend` qui ne vient pas du temps
  // en cours).
  "entree-sortie": "traversee",
  "entree-ouvrir": "traversee",
  // Le repli sans mouvement : c'est l'app qui porte le fondu, et c'est lui qui
  // fait avancer la machine. Sans cette ligne, `prefers-reduced-motion`
  // laisserait l'utilisateur derrière le voile jusqu'au minuteur de sécurité.
  "entree-fondu": "traversee",
};

/** Plus de grossissement depuis 2026-10-19 : gardé à 1 pour `reperesEntree`. */
const ECHELLE = 1;

/**
 * Le filet. Un chargement bloqué ne doit JAMAIS piéger quelqu'un derrière un
 * logo : au pire, on saute à l'état final et l'app apparaît telle qu'elle est.
 */
const EXPIRATION_MS = 3500;

function prefereMoinsDeMouvement(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface Entree {
  readonly phase: EtatEntree;
  readonly active: boolean;
  /** Le choix de l'utilisateur, lu avant le premier rendu. */
  readonly mode: ModeEntree;
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
  // ⚠️ Lu au MIROIR, pas à SQLite : la transition décide avant que la base ait
  // parlé. Sans ça, « Aucune » laisserait passer une image de voile — soit
  // exactement ce que l'utilisateur vient de refuser.
  const mode = useMemo(animationEntreeAuDemarrage, []);
  const [modele, envoyer] = useReducer(
    reduire,
    { reduit, mode, appPrete: appEstPrete() },
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

  return { phase, active, mode, gererAnimation, demarrer };
}

/**
 * La première image : fond nuit, halo rouge, l'icône au centre sans lueur.
 *
 * Le même balisage que `#lancement` dans `index.html` (même classes, même
 * style en ligne là-bas) : React le reprend sans qu'un pixel bouge, puis la
 * transition d'entrée repart de lui. `sansIcone` : le voile de l'entrée à
 * froid, dont l'icône est la copie animée, posée exactement au même endroit.
 */
export function Lancement({
  sansIcone = false,
  enfants,
}: {
  sansIcone?: boolean;
  enfants?: React.ReactNode;
}) {
  return (
    <div className="lancement" aria-hidden={!enfants}>
      <div className="lancement-halo" />
      {!sansIcone && <ShaleMark size="100%" lueur={false} className="lancement-icone" />}
      {enfants}
    </div>
  );
}

/**
 * Le voile : le mur de connexion (ou, à froid, la première image), plus la
 * copie animée de l'icône.
 *
 * `enfants` est le mur lui-même (`ChassisFactice` + `LoginScreen`), rendu tel
 * quel : c'est ce qui garantit la continuité, l'utilisateur ne voit rien
 * changer au premier temps hormis le formulaire qui s'efface.
 */
export function VoileEntree({
  phase,
  origine,
  mode,
  gererAnimation,
  enfants,
}: {
  phase: EtatEntree;
  /** D'où l'on vient : après connexion il y a un formulaire à effacer, à froid non. */
  origine: "connexion" | "froid";
  mode: ModeEntree;
  gererAnimation: (e: { animationName: string }) => void;
  enfants: React.ReactNode;
}) {
  const actif = phase !== "idle" && phase !== "done";
  const copie = useRef<HTMLDivElement>(null);
  const masque = useRef<HTMLDivElement>(null);
  useEntreeDansLeLogo(phase, copie, masque);
  // ⚠️ `will-change` posé au démarrage et retiré à la fin, jamais en permanence :
  // laissé là, il garde une couche de compositing pour rien, sur toutes les
  // vues, pour le restant de la session.
  const style: CSSProperties = actif ? { willChange: "transform, opacity" } : {};

  return (
    <>
      <div
        className={actif ? "entree-voile" : undefined}
        data-entree={actif ? phase : undefined}
        data-origine={actif ? origine : undefined}
        onAnimationEnd={gererAnimation}
        // Pendant qu'il s'efface, le mur ne doit plus rien recevoir : ni la
        // tabulation, ni un lecteur d'écran, ni un clic qui repartirait dans
        // un formulaire déjà soumis.
        inert={actif}
      >
        {enfants}
      </div>
      {actif && phase !== "poser" && !prefereMoinsDeMouvement() && (
        <div className="entree-masque" ref={masque} aria-hidden>
          {PIECES.map((p) => (
            <div key={p} className={`entree-piece entree-piece-${p.length > 2 ? "pan" : "coin"}`} data-piece={p} />
          ))}
        </div>
      )}
      {actif && (
        <div
          ref={copie}
          className="entree-copie"
          data-phase={phase}
          data-origine={origine}
          // « Courte » : chaque temps dure moins longtemps (CSS).
          data-mode={mode}
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
          {/* L'icône, lueur éteinte : la première image, au pixel près. En
              deux calques, parce qu'en entrant la plaque s'efface AVANT les
              traits : on passe à travers elle, puis les traits filent. */}
          <span className="entree-calque entree-plaque">
            <ShaleMark size="100%" variante="plaque-seule" />
          </span>
          <span className="entree-calque entree-traits">
            <ShaleMark size="100%" variante="trait" />
          </span>
          {/* La lueur, dans son propre calque : elle s'allume par l'opacité
              seule — le flou est peint UNE fois, jamais pendant l'animation.
              Posée par-dessus les traits : blanc sur blanc, ils ne changent
              pas ; autour d'eux, c'est la lueur de l'icône de référence. */}
          <span className="entree-calque entree-lueur" aria-hidden>
            <ShaleMark size="100%" variante="lueur-seule" />
          </span>
        </div>
      )}
    </>
  );
}

/** Une durée CSS (`450ms`, `0.3s`) lue sur un élément, en millisecondes. */
function dureeCss(el: Element, nom: string, repli: number): number {
  const v = getComputedStyle(el).getPropertyValue(nom).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return repli;
  return v.endsWith("ms") ? n : n * 1000;
}

/**
 * La courbe de l'entrée dans le logo. Un zoom se perçoit en RAPPORTS : pour
 * qu'il semble aller à vitesse constante, l'échelle doit croître de façon
 * exponentielle. Cette courbe en est l'ajustement (×22 en 600 ms), à peine
 * accéléré au départ. La première version (0.7, 0, 0.84, 0) laissait l'icône
 * petite 60 % du temps puis explosait d'un coup (vu au ralenti, 2026-10-20).
 */
const COURBE_ENTREE = "cubic-bezier(0.45, 0.02, 0.8, 0.15)";
/** L'inspiration : une contraction douce. */
const COURBE_INSPIRATION = "cubic-bezier(0.45, 0, 0.55, 1)";

/**
 * Lance les mouvements de l'approche et de la traversée (Web Animations).
 * Tous partent à la même heure (`startTime`), sinon une image de décalage
 * entre la plaque et le trou laisserait voir l'app sur un liseré.
 */
function useEntreeDansLeLogo(
  phase: EtatEntree,
  copie: React.RefObject<HTMLDivElement | null>,
  masque: React.RefObject<HTMLDivElement | null>,
) {
  const geo = useRef<Trou | null>(null);
  useLayoutEffect(() => {
    if (phase !== "approche" && phase !== "traversee") return;
    const c = copie.current;
    const m = masque.current;
    if (!c || !m) return;
    if (!geo.current) {
      // Mesuré AVANT tout mouvement (à l'approche, la copie est encore à 1).
      const r = c.getBoundingClientRect();
      geo.current = trou(
        r.left + r.width / 2,
        r.top + r.height / 2,
        r.width,
        window.innerWidth,
        window.innerHeight,
      );
      const t = geo.current;
      for (const el of Array.from(m.children) as HTMLElement[]) {
        const p = el.dataset.piece as Piece;
        if (p.length === 2) {
          const cote = coteCoin(t);
          el.style.width = el.style.height = `${cote}px`;
          const ray = rayonCoin(t);
          const ancre = ANCRE_COIN[p as "hg" | "hd" | "bg" | "bd"];
          el.style.background = `radial-gradient(circle ${ray}px at ${ancre}, transparent ${ray - 0.75}px, var(--entree-nuit) ${ray + 0.75}px)`;
        }
      }
    }
    const t = geo.current;
    const debut = document.timeline.currentTime ?? undefined;
    const anims: Animation[] = [];
    const lancer = (el: Element, images: Keyframe[], options: KeyframeAnimationOptions) => {
      const a = el.animate(images, { fill: "both", ...options });
      if (debut !== undefined && debut !== null) a.startTime = debut;
      anims.push(a);
    };
    const pieces = Array.from(m.children) as HTMLElement[];

    if (phase === "approche") {
      const duree = dureeCss(c, "--entree-t-maintien", 220);
      const options = { duration: duree, easing: COURBE_INSPIRATION };
      lancer(c, [{ transform: "scale(1)" }, { transform: `scale(${CONTRACTION})` }], options);
      for (const el of pieces) {
        const p = el.dataset.piece as Piece;
        lancer(
          el,
          [{ transform: transformation(t, p, 1) }, { transform: transformation(t, p, CONTRACTION) }],
          options,
        );
      }
      // La nuit se pose autour de l'icône. À froid, elle y est déjà (le
      // lancement) : seul le halo s'éteint. Après connexion, le mur s'efface.
      lancer(m, [{ opacity: 0 }, { opacity: 1 }], { duration: duree, easing: "linear" });
    } else {
      const duree = dureeCss(c, "--entree-t-sortie", 650);
      const options = { duration: duree, easing: COURBE_ENTREE };
      const fin = t.echelleFinale;
      lancer(c, [{ transform: `scale(${CONTRACTION})` }, { transform: `scale(${fin})` }], options);
      for (const el of pieces) {
        const p = el.dataset.piece as Piece;
        lancer(
          el,
          [{ transform: transformation(t, p, CONTRACTION) }, { transform: transformation(t, p, fin) }],
          options,
        );
      }
      lancer(m, [{ opacity: 1 }, { opacity: 1 }], { duration: duree });
      // On passe à travers la plaque d'abord, puis les traits filent.
      const plaque = c.querySelector(".entree-plaque");
      const traits = c.querySelectorAll(".entree-traits, .entree-lueur");
      if (plaque)
        lancer(plaque, [{ opacity: 1 }, { opacity: 1, offset: 0.12 }, { opacity: 0, offset: 0.42 }, { opacity: 0 }], {
          duration: duree,
          easing: "linear",
        });
      traits.forEach((el) =>
        lancer(el, [{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0, offset: 0.72 }, { opacity: 0 }], {
          duration: duree,
          easing: "linear",
        }),
      );
    }
    // ⚠️ Pas d'annulation au changement de temps : `fill: both` tient la
    // dernière image, et la suivante part de la même valeur. On annule tout
    // au démontage (fin de la transition) seulement.
    return () => {
      if (phase === "traversee") for (const a of anims) a.cancel();
    };
  }, [phase, copie, masque]);
}

export type { EtatEntree };

