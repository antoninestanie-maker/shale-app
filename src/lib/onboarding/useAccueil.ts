import { useEffect, useRef, useState } from "react";

import { useSyncApi } from "../../components/SyncProvider";
import { accueilNecessaire } from "./semer";

/**
 * ⭐ Faut-il jouer l'accueil — et surtout, PEUT-ON ENCORE LE SAVOIR ?
 *
 * ─── LE PROBLÈME QUE CE HOOK EXISTE POUR RÉSOUDRE ───────────────────────────
 *
 * Le drapeau « accueil terminé » vit dans `settings`, donc il arrive par
 * SYNCHRONISATION. Sur un second Mac ou un iPhone fraîchement installé, la
 * base locale est vide **avant** le premier échange : demander « l'accueil
 * est-il fait ? » à cet instant-là répond « non » pour tout le monde.
 *
 * Sans attente, le second appareil afficherait donc l'accueil, puis le verrait
 * disparaître deux secondes plus tard quand la ligne distante arrive — et
 * l'utilisateur qui aurait commencé à répondre perdrait son écran en pleine
 * saisie. C'est le point 3 de la recette d'acceptation, et il ne se joue pas
 * dans `semer.ts` : c'est une question de MOMENT, pas de donnée.
 *
 * ─── LA RÈGLE ───────────────────────────────────────────────────────────────
 *
 *   • pas de synchronisation possible (mode démo, preview, auth non
 *     configurée) → on décide tout de suite, il n'y a rien à attendre ;
 *   • un cycle a déjà abouti (`dernierSucces`) → on décide, la base locale
 *     porte ce que le compte sait ;
 *   • sinon → on ATTEND, `DELAI_MAX` au plus.
 *
 * ⚠️ POURQUOI UN DÉLAI MAXIMUM, ET CE QU'IL COÛTE. Hors ligne au premier
 * lancement, `dernierSucces` ne viendra jamais : sans borne, l'accueil ne
 * s'afficherait pas du tout et l'app démarrerait sur un écran vide sans
 * réglages. On tranche donc au bout de huit secondes, en assumant le cas
 * dégradé : l'accueil se joue, et si le drapeau distant arrive plus tard, le
 * last-write-wins gardera la version la plus récente — les deux disent « fait »,
 * seules les heures déclarées peuvent être écrasées par les plus récentes. Un
 * accueil rejoué une fois vaut mieux qu'une app sans réglages.
 */
const DELAI_MAX = 8000;

export type EtatAccueil = "indecis" | "requis" | "fait";

export function useAccueil(): { etat: EtatAccueil; terminer: () => void } {
  const { statut, dernierSucces } = useSyncApi();
  const [etat, setEtat] = useState<EtatAccueil>("indecis");
  const tranche = useRef(false);
  const [delaiEcoule, setDelaiEcoule] = useState(false);

  useEffect(() => {
    const minuterie = window.setTimeout(() => setDelaiEcoule(true), DELAI_MAX);
    return () => window.clearTimeout(minuterie);
  }, []);

  useEffect(() => {
    if (tranche.current) return;
    const rienAAttendre = statut === "indisponible";
    if (!rienAAttendre && dernierSucces == null && !delaiEcoule) return;
    tranche.current = true;
    let vivant = true;
    accueilNecessaire()
      .then((besoin) => {
        if (vivant) setEtat(besoin ? "requis" : "fait");
      })
      .catch(() => {
        // Une lecture de réglage qui échoue ne doit pas coincer l'app derrière
        // un écran de démarrage : on n'affiche pas l'accueil, il reste
        // rejouable depuis les Réglages.
        if (vivant) setEtat("fait");
      });
    return () => {
      vivant = false;
    };
  }, [statut, dernierSucces, delaiEcoule]);

  return { etat, terminer: () => setEtat("fait") };
}
