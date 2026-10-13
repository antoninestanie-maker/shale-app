// Le visage de l'horloge du Timer : les VOLETS (2026-09-29) ou l'ANNEAU, celui
// d'avant (2026-10-13, Antonin : « ajouter la possibilité de choisir entre les
// volets ou l'ancien timer »).
//
// Un réglage ordinaire (`settings`, clé `timer_style`) : il se synchronise comme
// les durées sur mesure, donc le choix fait sur le Mac vaut sur l'iPhone. La
// fenêtre séparée, elle, n'ouvre pas la base : elle reçoit le style avec l'état
// de la séance (`timerFenetre.ts`).
import { useCallback, useEffect, useState } from "react";
import { getSetting, setSetting } from "./repo";

export type StyleHorloge = "volets" | "anneau";

export const CLE_STYLE_HORLOGE = "timer_style";
export const STYLE_HORLOGE_DEFAUT: StyleHorloge = "volets";

/** Tout ce qui n'est pas « anneau » est « volets » : une valeur inconnue ne casse rien. */
export function lireStyleHorloge(brut: unknown): StyleHorloge {
  return brut === "anneau" ? "anneau" : STYLE_HORLOGE_DEFAUT;
}

/** Le même événement que les autres réglages du Timer (`TimerView.bumpGoal`). */
const EVT = "sb:settings-changed";

/** Le style courant, et de quoi le changer. Toutes les horloges montées suivent. */
export function useStyleHorloge(): [StyleHorloge, (s: StyleHorloge) => Promise<void>] {
  const [style, setStyle] = useState<StyleHorloge>(STYLE_HORLOGE_DEFAUT);

  useEffect(() => {
    let vivant = true;
    const lire = () =>
      getSetting(CLE_STYLE_HORLOGE)
        .then((v) => {
          if (vivant) setStyle(lireStyleHorloge(v));
        })
        .catch(() => {});
    void lire();
    window.addEventListener(EVT, lire);
    return () => {
      vivant = false;
      window.removeEventListener(EVT, lire);
    };
  }, []);

  const choisir = useCallback(async (s: StyleHorloge) => {
    setStyle(s);
    await setSetting(CLE_STYLE_HORLOGE, s);
    window.dispatchEvent(new CustomEvent(EVT));
  }, []);

  return [style, choisir];
}
