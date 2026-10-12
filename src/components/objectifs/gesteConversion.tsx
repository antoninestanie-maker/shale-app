import { t } from "../../lib/i18n";
import { ouvrirParId } from "../../lib/naviguer";
import { annulerConversionEnTache, convertirEtapeEnTache } from "../../lib/repo";
import { afficherToast } from "../../lib/toast";
import type { Goal } from "../../lib/types";
import { DUREE_ANNULER, titreCourt } from "../corbeille/geste";

/**
 * ⭐ « EN FAIRE UNE TÂCHE » — le geste, tel que l'interface le fait (2026-10-12).
 *
 * Un geste = une fonction (règle 18) : le bouton de la ligne et l'entrée du
 * menu « ⋯ » d'une étape vide appellent tous les deux celle-ci.
 *
 * UN toast, et son « Annuler » rend tout : l'étape revient, la tâche s'en va
 * (`repo.annulerConversionEnTache`). ⚠️ Règle 15 : le reçu est fermé ici, à la
 * naissance du toast — jamais « l'étape sélectionnée » au moment du clic.
 * « Voir » ouvre la tâche là où elle vit désormais : dans Tâches.
 *
 * Rend `false` si rien n'a été converti — l'étape a reçu une tâche ou a été
 * supprimée entre l'écran et le clic ; un message le dit.
 */
export async function convertirEnTache(etape: Pick<Goal, "id" | "title">, apres: () => unknown): Promise<boolean> {
  const recu = await convertirEtapeEnTache(etape.id);
  await apres();
  if (!recu) {
    afficherToast({ msg: t("Cette étape n’est plus vide : elle reste une étape.") });
    return false;
  }
  afficherToast({
    msg: t("« {titre} » est maintenant une tâche", { titre: titreCourt(etape.title) }),
    icone: <span className="h-4 w-4 shrink-0 rounded-[4px] border-[1.5px] border-text-dim" aria-hidden />,
    actionLabel: t("Annuler|défaire"),
    onAction: () => {
      void (async () => {
        await annulerConversionEnTache(recu);
        await apres();
      })();
    },
    lienLabel: t("Voir"),
    onLien: () => ouvrirParId("task", recu.tacheId),
    duree: DUREE_ANNULER,
  });
  return true;
}
