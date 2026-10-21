import { useLayoutEffect, useRef, type CSSProperties } from "react";
import ShaleMark from "./auth/ShaleMark";
import Chargement from "./Chargement";
import type { AnimationEntree } from "../lib/entree/reglage";

/**
 * Changer de module : l'icône seulement si le module n'est pas prêt
 * (2026-10-21, choix d'Antonin entre deux options).
 *
 * Le 21/10 au matin, CHAQUE changement de module jouait un passage de 560 ms
 * (icône, lueur, voile). Abandonné le jour même : dans un outil qu'on traverse
 * cinquante fois par jour, une demi-seconde à chaque clic se lit comme de la
 * lenteur, et le voile cachait un module souvent déjà prêt.
 *
 * La règle désormais :
 *   - module prêt (déjà chargé) : il s'affiche aussitôt, sans rien devant ;
 *   - module pas prêt : le repli de `Suspense` montre l'attente
 *     (`Chargement.tsx`, l'icône qui respire) — mais seulement passé 150 ms ;
 *   - quand il arrive, l'icône SORT comme à la fin de l'entrée : elle
 *     rétrécit à 0,88 en s'effaçant pendant que le voile se lève sur le
 *     module (`SortieAttente`). Elle part de l'endroit, de la taille, de la
 *     lueur et de l'échelle exactes où l'attente l'avait laissée : aucun saut.
 *   - attente plus courte que 150 ms : l'icône n'a jamais été vue, pas de
 *     sortie.
 */

/** Ce que l'attente laisse à la sortie, mesuré au moment où elle disparaît. */
export interface EtatAttente {
  /** Rectangle de l'icône, relatif à la zone du module, en pixels d'écran. */
  x: number;
  y: number;
  taille: number;
  /** Opacité de l'icône (le fondu d'apparition de l'attente peut être en cours). */
  opacite: number;
  lueur: number;
  echelle: number;
}

/** En dessous, l'icône d'attente n'a pas encore paru (`.chargement`, délai 150 ms). */
const ATTENTE_INVISIBLE_MS = 150;

/**
 * Le repli de `Suspense` : l'attente, plus une mesure au moment où le module
 * arrive. ⚠️ `useLayoutEffect` : sa fin s'exécute pendant le commit, AVANT que
 * le module soit peint, alors que l'attente est encore dans le document — un
 * `useEffect` la mesurerait détachée, et la sortie arriverait une image trop
 * tard.
 */
export function AttenteModule({
  texte,
  zone,
  onSortie,
}: {
  texte: string;
  /** La zone du module, pour situer l'icône par rapport au voile. */
  zone: React.RefObject<HTMLElement | null>;
  onSortie: (e: EtatAttente) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const debut = performance.now();
    const el = ref.current;
    return () => {
      if (performance.now() - debut < ATTENTE_INVISIBLE_MS) return;
      const racine = el?.querySelector<HTMLElement>(".chargement");
      const icone = el?.querySelector<HTMLElement>(".chargement-icone");
      const lueur = el?.querySelector<HTMLElement>(".chargement-lueur");
      const z = zone.current;
      if (!racine || !icone || !lueur || !z) return;
      const r = icone.getBoundingClientRect();
      const rz = z.getBoundingClientRect();
      const transform = getComputedStyle(icone).transform;
      // Le rectangle mesuré INCLUT l'échelle en cours : on le ramène à
      // l'échelle 1, la sortie la réapplique autour du même centre.
      const echelle = transform && transform !== "none" ? new DOMMatrix(transform).a || 1 : 1;
      const taille = r.width / echelle;
      onSortie({
        x: r.left + r.width / 2 - taille / 2 - rz.left,
        y: r.top + r.height / 2 - taille / 2 - rz.top,
        taille,
        opacite: Number(getComputedStyle(racine).opacity) || 0,
        lueur: Number(getComputedStyle(lueur).opacity) || 0,
        echelle,
      });
    };
  }, [zone, onSortie]);
  return (
    <div ref={ref} style={{ display: "contents" }}>
      <Chargement texte={texte} />
    </div>
  );
}

/**
 * La sortie de l'attente, par-dessus le module qui vient d'arriver. Un voile
 * du fond, l'icône à la place exacte de l'attente ; tout s'efface en 380 ms
 * (« courte » : 240 ms). « Aucune » et `prefers-reduced-motion` : pas de
 * sortie, c'est `App.tsx` qui ne la rend pas. Aucun clic n'est pris.
 */
export default function SortieAttente({
  etat,
  mode,
  onFin,
}: {
  etat: EtatAttente;
  mode: Exclude<AnimationEntree, "aucune">;
  onFin: () => void;
}) {
  const style = {
    "--sortie-x": `${etat.x}px`,
    "--sortie-y": `${etat.y}px`,
    "--sortie-taille": `${etat.taille}px`,
    "--sortie-opacite": etat.opacite,
    "--sortie-lueur": etat.lueur,
    "--sortie-echelle": etat.echelle,
  } as CSSProperties;
  return (
    <div
      aria-hidden
      className="sortie-attente"
      data-mode={mode}
      style={style}
      onAnimationEnd={(e) => {
        // Seule la fin du VOILE clôt la sortie ; celle de l'icône remonte aussi.
        if (e.target === e.currentTarget) onFin();
      }}
    >
      <div className="sortie-attente-icone">
        <ShaleMark size="100%" lueur={false} />
        <ShaleMark size="100%" variante="lueur-seule" className="sortie-attente-lueur" />
      </div>
    </div>
  );
}
