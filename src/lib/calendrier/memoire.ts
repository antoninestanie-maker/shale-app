/**
 * Ce que le Calendrier retient d'une visite à l'autre, PENDANT la session.
 *
 * ⭐ 2026-10-21, audit du 20/10, constat 17 (et rang 32 du 12/10). La vue par
 * défaut est la SEMAINE, partout — décision d'Antonin du 2026-10-13, qui tient.
 * Mais une vue CHOISIE (l'agenda, au téléphone) était oubliée dès qu'on
 * quittait le module : passage par Tâches, retour par « Plus › Calendrier »,
 * et l'on retombait sur la semaine. Le choix est retenu ici, en mémoire.
 *
 * ⚠️ En mémoire seulement, exprès : au lancement suivant de l'app, le
 * Calendrier rouvre sur la semaine, comme l'a voulu Antonin. Rien n'est écrit
 * dans les réglages (rien à synchroniser, rien à migrer).
 *
 * Même chose pour le bandeau d'alertes replié au téléphone : déplié une fois,
 * il le reste jusqu'à la fin de la session.
 */

export type VueCalendrier = "agenda" | "mois" | "semaine" | "jour";

export const VUE_PAR_DEFAUT: VueCalendrier = "semaine";

let vueChoisie: VueCalendrier | null = null;
let alertesDepliees = false;

/**
 * La vue sur laquelle le Calendrier s'ouvre. Au téléphone, le mois n'existe
 * pas (sept colonnes illisibles) : un mois choisi au bureau rouvre la semaine.
 */
export function vueAOuvrir(telephone: boolean): VueCalendrier {
  const v = vueChoisie ?? VUE_PAR_DEFAUT;
  return telephone && v === "mois" ? VUE_PAR_DEFAUT : v;
}

/** À appeler quand l'utilisateur CHOISIT une vue (les boutons Agenda, Mois…). */
export function retenirVue(v: VueCalendrier): void {
  vueChoisie = v;
}

export function alertesDeplieesAuTelephone(): boolean {
  return alertesDepliees;
}

export function retenirAlertesDepliees(depliees: boolean): void {
  alertesDepliees = depliees;
}

/** Pour les tests : l'état d'un lancement neuf. */
export function oublierMemoireCalendrier(): void {
  vueChoisie = null;
  alertesDepliees = false;
}
