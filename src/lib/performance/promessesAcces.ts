import { getSetting, setSetting } from "../repo";
import { CLE_PROMESSES, ecrirePromesses, lirePromesses, poserPromesse } from "./promesses";

/**
 * Lire et écrire les heures promises (`promesses.ts`) — la seule partie de
 * l'essai « Par objectif » qui touche à la base.
 *
 * Tout passe par `getSetting` / `setSetting` de `repo.ts`, qui existent des
 * deux côtés (SQLite et démo) avec la même sémantique : une clé, une chaîne.
 * `promesses.api.test.ts` rejoue ce fichier sur une vraie base, puis en démo.
 */

/** Les promesses du compte. Une lecture qui échoue rend « aucune » : l'onglet s'ouvre quand même. */
export async function chargerPromesses(): Promise<Map<string, number>> {
  try {
    return lirePromesses(await getSetting(CLE_PROMESSES));
  } catch {
    return new Map();
  }
}

/**
 * Pose (ou retire) la promesse d'un objectif.
 *
 * ⚠️ RELIT le réglage avant d'écrire, au lieu d'écrire la carte que l'écran a
 * en mémoire : une promesse arrivée par synchronisation depuis l'ouverture de
 * l'onglet ne doit pas être écrasée par une carte périmée.
 *
 * ⚠️ N'ÉCRIT QUE SI LA VALEUR CHANGE. Chaque écriture de `settings` part dans
 * la file de synchronisation ; sortir d'un champ sans l'avoir modifié ne doit
 * rien envoyer. Rend la carte à jour, et `ecrit` pour qui veut le savoir.
 */
export async function enregistrerPromesse(
  uid: string,
  heures: number,
): Promise<{ promesses: Map<string, number>; ecrit: boolean }> {
  const brut = await getSetting(CLE_PROMESSES);
  const avant = lirePromesses(brut);
  const apres = poserPromesse(avant, uid, heures);
  const texte = ecrirePromesses(apres);
  // Comparées sous leur forme écrite : c'est elle qui part en synchronisation.
  if (texte === ecrirePromesses(avant)) return { promesses: avant, ecrit: false };
  await setSetting(CLE_PROMESSES, texte);
  return { promesses: apres, ecrit: true };
}
