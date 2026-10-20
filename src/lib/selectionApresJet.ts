/**
 * Ce que devient la note OUVERTE quand on en jette une, puis qu'on l'« Annule »
 * (2026-10-20, audit complet, savoir-9).
 *
 * ⚠️ LE DÉFAUT. Le rafraîchissement passé à `jeter()` est rappelé deux fois : au
 * jet, et après la restauration (« Annuler » ou ⌘Z). Il refermait « la note qui
 * était ouverte au jet » sans regarder la sélection du moment : jeter A, ouvrir
 * B, cliquer « Annuler » → A revenait, mais B se fermait sous les doigts (au
 * téléphone : retour à la liste au milieu de la frappe), et A n'était pas
 * rouverte.
 *
 * ⭐ LA RÈGLE. Au jet, on ne ferme que si la note jetée est TOUJOURS celle qui
 * est ouverte. Au retour, on rouvre la note revenue seulement si rien d'autre
 * n'a été ouvert entre-temps — jamais on ne prend la place de ce qu'on lit.
 */
export function selectionApresJet(
  etape: "jet" | "retour",
  jetee: number,
  etaitOuverte: boolean,
  courante: number | null,
): number | null {
  if (!etaitOuverte) return courante;
  if (etape === "jet") return courante === jetee ? null : courante;
  return courante ?? jetee;
}
