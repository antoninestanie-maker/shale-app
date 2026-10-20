/**
 * ⭐ LA PORTE ENTRE LES ÉCRITURES DE L'UTILISATEUR ET L'APPLICATION DISTANTE
 * (audit du 2026-10-20, donnees-2).
 *
 * Pendant qu'une page reçue du cloud s'applique, le drapeau `applying` vaut
 * '1' dans la base, et TOUS les déclencheurs d'outbox se taisent — c'est ce qui
 * empêche une ligne reçue de repartir. Mais le drapeau est global : une tâche
 * cochée, une note créée PENDANT ce temps s'écrivaient en local sans jamais
 * entrer dans la file d'envoi. Le commentaire d'`enApplication` le disait —
 * « à condition que TOUT passe par ici » — et `repo.ts` n'y passait pas.
 *
 * La règle : une application FERME la porte, attend que les écritures déjà
 * lancées soient finies, et seulement alors lève le drapeau. Une écriture de
 * l'utilisateur qui arrive porte fermée attend la fin de l'application — un
 * délai de l'ordre d'une page, jamais une perte.
 *
 * ⚠️ L'application elle-même écrit par la connexion BRUTE (`getDbBrute`) : par
 * la connexion gardée, elle s'attendrait elle-même, pour toujours.
 *
 * ⚠️ Pas couvert : les fenêtres secondaires (capture, timer) ont leur propre
 * contexte JavaScript, donc leur propre porte. Seule la fenêtre principale
 * applique ; une écriture faite dans une autre fenêtre à cet instant précis
 * reste exposée (PIEGES, même date).
 */

let porteFermee: Promise<void> | null = null;
let enVol = 0;
let quandVide: (() => void)[] = [];

/** Une écriture de l'utilisateur : attend que la porte soit ouverte, et se compte. */
export async function ecritureUtilisateur<T>(ecrire: () => Promise<T>): Promise<T> {
  while (porteFermee) await porteFermee;
  enVol++;
  try {
    return await ecrire();
  } finally {
    enVol--;
    if (enVol === 0) for (const r of quandVide.splice(0)) r();
  }
}

/**
 * Ferme la porte et attend que plus rien ne soit en vol. Rend la fonction qui
 * la rouvre — à appeler dans un `finally`.
 */
export async function fermerLaPorte(): Promise<() => void> {
  let ouvrir!: () => void;
  const porte = new Promise<void>((r) => (ouvrir = r));
  porteFermee = porte;
  if (enVol > 0) await new Promise<void>((r) => quandVide.push(r));
  return () => {
    if (porteFermee === porte) porteFermee = null;
    ouvrir();
  };
}
