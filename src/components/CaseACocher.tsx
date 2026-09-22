// ⭐ La case à cocher de l'app (2026-09-22) — tâches, habitudes, feuille de
// route. Il y en avait trois copies, chacune avec sa taille de clic et aucune
// ne réagissait avant la fin de l'écriture + du `refresh()` complet : on
// cliquait, rien ne bougeait, on recliquait… et on défaisait sa propre coche.
//
// Deux pièces :
//  · `CocheVisuelle` — la boîte seule, quand toute la ligne est déjà le bouton
//    (widget « Aujourd'hui ») ;
//  · `CaseACocher` — un vrai bouton, avec une zone de clic plus large que la
//    boîte (marge négative : la mise en page ne bouge pas d'un pixel).
// Et `useCochesOptimistes`, qui fait basculer la case AU CLIC, avant la base.
import { useCallback, useLayoutEffect, useRef, useState } from "react";

export function CocheVisuelle({
  cochee,
  couleur,
  taille = "md",
}: {
  cochee: boolean;
  /** Teinte de la boîte cochée (habitudes) ; vert par défaut. */
  couleur?: string;
  taille?: "sm" | "md";
}) {
  const boite = taille === "sm" ? "h-4 w-4 rounded" : "h-5 w-5 rounded-md";
  // L'animation ne joue qu'au PASSAGE à « cochée » : au chargement d'une
  // liste pleine de tâches faites, vingt cases qui sautent à la fois, c'est
  // du bruit. `useLayoutEffect` pour que le trait ne soit jamais peint entier
  // une image avant de se dessiner.
  const avant = useRef(cochee);
  const [anime, setAnime] = useState(false);
  useLayoutEffect(() => {
    if (cochee && !avant.current) setAnime(true);
    if (!cochee) setAnime(false);
    avant.current = cochee;
  }, [cochee]);
  return (
    <span
      aria-hidden
      data-anime={anime ? "1" : undefined}
      className={`coche flex ${boite} shrink-0 items-center justify-center border transition-colors duration-150 ${
        cochee
          ? couleur
            ? "border-transparent"
            : "border-green bg-green"
          : "border-text-dim/40 group-hover:border-text-dim"
      }`}
      style={cochee && couleur ? { backgroundColor: couleur } : undefined}
    >
      {cochee && (
        <svg viewBox="0 0 12 12" className={taille === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} fill="none">
          <path
            className="coche-trait"
            d="M2 6.5 4.5 9 10 3.5"
            stroke="var(--color-surface)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

export function CaseACocher({
  cochee,
  onBascule,
  libelle,
  couleur,
  taille,
  tip,
  tipSub,
}: {
  cochee: boolean;
  onBascule: () => void;
  /** Lu par le lecteur d'écran : le NOM de l'élément, l'état vient d'`aria-checked`. */
  libelle: string;
  couleur?: string;
  taille?: "sm" | "md";
  tip?: string;
  tipSub?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={cochee}
      aria-label={libelle}
      data-tip={tip}
      data-tip-sub={tipSub}
      onClick={(e) => {
        // La ligne peut porter son propre clic (ouvrir la fiche) : cocher ne
        // doit jamais l'ouvrir en plus.
        e.stopPropagation();
        onBascule();
      }}
      className="cible-tactile group -m-1.5 flex shrink-0 items-center justify-center rounded-lg p-1.5 focus-visible:outline-2 focus-visible:outline-blue"
    >
      <CocheVisuelle cochee={cochee} couleur={couleur} taille={taille} />
    </button>
  );
}

/**
 * L'état affiché d'une case = ce que l'utilisateur vient de demander, tant que
 * la base ne l'a pas encore rendu ; ensuite, la base.
 *
 * ⚠️ Un compteur par clé, pas un simple booléen « en attente » : sur un double
 * clic, la PREMIÈRE écriture se termine pendant que la seconde court encore.
 * Effacer la surcharge à ce moment-là ferait clignoter la case sur l'état
 * intermédiaire. Seule la dernière demande en cours a le droit de l'effacer.
 *
 * Les écritures d'une même case s'ENCHAÎNENT (file par clé) : « cocher » puis
 * « décocher » lancés à 100 ms d'écart ne doivent jamais toucher la base dans
 * l'ordre inverse.
 *
 * Si l'écriture échoue, la surcharge tombe quand même : la case revient à ce
 * que dit la base. Mieux vaut une coche qui se défait qu'une coche qui ment.
 */
export function useCochesOptimistes() {
  const [surcharges, setSurcharges] = useState<ReadonlyMap<string, boolean>>(new Map());
  const courant = useRef(new Map<string, boolean>());
  const generation = useRef(new Map<string, number>());
  const file = useRef(new Map<string, Promise<void>>());

  const etat = useCallback(
    (cle: string, reel: boolean) => surcharges.get(cle) ?? reel,
    [surcharges],
  );

  const basculer = useCallback(
    async (cle: string, reel: boolean, ecrire: (cochee: boolean) => Promise<unknown>) => {
      const cible = !(courant.current.get(cle) ?? reel);
      const n = (generation.current.get(cle) ?? 0) + 1;
      generation.current.set(cle, n);
      courant.current.set(cle, cible);
      setSurcharges(new Map(courant.current));
      const suite = (file.current.get(cle) ?? Promise.resolve())
        .then(() => ecrire(cible))
        .then(
          () => undefined,
          (e) => console.error("[coche] écriture refusée", e),
        );
      file.current.set(cle, suite);
      await suite;
      if (generation.current.get(cle) === n) {
        courant.current.delete(cle);
        file.current.delete(cle);
        setSurcharges(new Map(courant.current));
      }
    },
    [],
  );

  return { etat, basculer };
}
