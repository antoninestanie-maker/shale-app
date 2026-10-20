import { useEffect, useState } from "react";

import { lireReglages, type ReglagesHoraires } from "./reglages";
import { EVT_HORAIRES, lireToutesLesCles } from "./semer";

/**
 * ⭐ Les heures déclarées à l'accueil, pour le calendrier (2026-10-20, audit,
 * constat 7). Voir `horaires.ts` : ce branchement n'avait jamais été fait.
 *
 * `null` tant que la lecture n'a pas abouti — le profil garde alors le repli
 * d'origine, qui est aussi la valeur d'un accueil passé (`REGLAGES_PAR_DEFAUT`).
 * Relu quand l'accueil (rejoué ou non) enregistre de nouvelles réponses.
 *
 * ⚠️ Une clé arrivée par synchronisation n'est relue qu'au prochain montage de
 * la vue ou au prochain enregistrement : les horaires changent rarement, et
 * une vue de calendrier se remonte à chaque navigation.
 */
export function useHoraires(): ReglagesHoraires | null {
  const [horaires, setHoraires] = useState<ReglagesHoraires | null>(null);
  useEffect(() => {
    let vivant = true;
    const relire = () => {
      lireToutesLesCles()
        .then((cles) => {
          if (vivant) setHoraires(lireReglages(cles));
        })
        .catch(() => {
          // Une lecture qui échoue laisse le repli d'origine : rien ne casse.
        });
    };
    relire();
    window.addEventListener(EVT_HORAIRES, relire);
    return () => {
      vivant = false;
      window.removeEventListener(EVT_HORAIRES, relire);
    };
  }, []);
  return horaires;
}
