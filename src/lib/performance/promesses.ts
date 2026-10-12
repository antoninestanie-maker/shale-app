import { HEURES_MAX } from "./parObjectif";

/**
 * ⭐ LES HEURES PROMISES À UN OBJECTIF — rangées SANS MIGRATION (2026-10-11).
 *
 * Fait partie de l'essai « Par objectif » de Performance (`parObjectif.ts`).
 *
 * OÙ ELLES VIVENT. Une ligne de la table `settings` : une clé, et une carte
 * JSON `uid d'objectif → heures par semaine`. Le précédent est `notes.rangees`
 * (`lib/notesATrier.ts`) : pour un essai qu'on peut retirer, une colonne sur
 * `goals` aurait demandé une migration aux trois endroits, et serait restée
 * dans les bases après le retrait.
 *
 *   • la clé est l'`uid` (jamais l'`id` local) : le réglage est SYNCHRONISÉ, et
 *     un numéro local ne désigne pas le même objectif sur un autre appareil ;
 *   • vide, zéro ou absent = PAS DE PROMESSE. L'entrée est retirée de la carte.
 *
 * ⚠️ SES LIMITES, dites plutôt que cachées :
 *   • UNE valeur pour tous les objectifs, synchronisée en dernier-écrit-gagne :
 *     deux appareils qui changent chacun une promesse au même moment, hors
 *     ligne, n'en gardent qu'une. L'autre se retape ; aucune séance n'est
 *     perdue (les heures passées viennent du minuteur, pas d'ici) ;
 *   • la promesse n'a pas d'HISTORIQUE : seule celle d'aujourd'hui est connue.
 *     C'est pourquoi l'écran n'en trace aucune sur les semaines passées ;
 *   • la carte n'est JAMAIS élaguée : un objectif en corbeille n'est plus dans
 *     les données de l'app, et un autre appareil peut en connaître que celui-ci
 *     n'a pas encore reçus. Élaguer effacerait leur promesse. Une entrée
 *     orpheline pèse une trentaine d'octets.
 *
 * ⚠️ Si l'essai est gardé, la vraie place est une colonne de `goals` : une
 * ligne par objectif se fusionne proprement entre appareils.
 *
 * ⚠️ CE FICHIER NE TOUCHE NI À LA BASE NI AU DOM : il se teste seul. La lecture
 * et l'écriture du réglage sont dans `promessesAcces.ts`.
 */

/** La clé du réglage. ⚠️ Synchronisée : ni `layout.`, ni rien qui ressemble à un secret (test). */
export const CLE_PROMESSES = "objectifs.heures_semaine";

/**
 * La carte relue du réglage.
 *
 * Tolérante : absente, illisible, ou écrite par une version future dans une
 * autre forme, elle se lit « aucune promesse ». Entrée par entrée : une valeur
 * qui n'est pas un nombre d'heures strictement positif est écartée, le reste
 * est gardé. Le pire qui arrive est une promesse à retaper.
 */
export function lirePromesses(brut: string | null | undefined): Map<string, number> {
  const carte = new Map<string, number>();
  if (!brut) return carte;
  let v: unknown;
  try {
    v = JSON.parse(brut);
  } catch {
    return carte;
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return carte;
  for (const [uid, heures] of Object.entries(v as Record<string, unknown>)) {
    if (!uid || typeof heures !== "number" || !Number.isFinite(heures) || heures <= 0) continue;
    carte.set(uid, Math.min(HEURES_MAX, heures));
  }
  return carte;
}

/** La forme écrite : clés triées, pour qu'une même carte donne toujours la même chaîne. */
export function ecrirePromesses(carte: ReadonlyMap<string, number>): string {
  const trie: Record<string, number> = {};
  for (const uid of [...carte.keys()].sort()) trie[uid] = carte.get(uid)!;
  return JSON.stringify(trie);
}

/** La carte après un changement. `heures ≤ 0` retire la promesse. Ne modifie pas l'entrée. */
export function poserPromesse(carte: ReadonlyMap<string, number>, uid: string, heures: number): Map<string, number> {
  const suite = new Map(carte);
  if (heures > 0 && Number.isFinite(heures)) suite.set(uid, Math.min(HEURES_MAX, heures));
  else suite.delete(uid);
  return suite;
}
