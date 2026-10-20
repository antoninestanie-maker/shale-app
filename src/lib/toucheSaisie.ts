/**
 * « N » — la touche de saisie (2026-10-20, audit complet, constat 22 : « pas
 * de touche de saisie » ; rang 28 du 12/10 : « n » sans effet).
 *
 * Hors de tout champ, « N » pose le curseur dans la ligne d'ajout rapide de
 * l'écran (Tâches, ou « Tâches du jour » sur Aujourd'hui) ; s'il n'y en a pas,
 * elle ouvre les Tâches sur cette ligne. Le raccourci de Things et de Linear,
 * sans modificateur parce qu'il ne vit que HORS des champs.
 *
 * Ce fichier dit QUAND la touche est pour nous ; `App.tsx` l'écoute.
 */
import { cibleDeSaisie } from "./annulerSuppression";

/** Le geste déposé quand il faut d'abord ouvrir les Tâches (`naviguer.ts`). */
export const GESTE_SAISIE_RAPIDE = "sb:saisie-rapide";

export function estToucheSaisie(
  e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "repeat" | "defaultPrevented" | "target">,
): boolean {
  if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.key !== "n" && e.key !== "N") return false;
  return !cibleDeSaisie(e.target);
}
