/**
 * ⭐ UNE ÉCRITURE DIFFÉRÉE, SÉRIALISÉE, QUI NE PERD RIEN.
 *
 * Écrite pour la page d'un sujet du Savoir (audit du 2026-10-20, savoir-7 ;
 * A10-13) : chaque frappe dans sa description lançait, sans attendre la
 * précédente, une écriture de tout le corps, une réconciliation des liens et
 * un rechargement de tout le Savoir. Une ligne d'outbox par lettre, et deux
 * écritures parties dans l'ordre sans garantie d'arriver dans l'ordre.
 *
 * Le contrat, celui des notes et des fiches (700 ms, flush) :
 *   • `planifier` remplace la valeur en attente et relance le délai : seule la
 *     DERNIÈRE valeur part ;
 *   • les écritures ne se chevauchent jamais : la suivante attend la fin de la
 *     précédente (une file) ;
 *   • `vider` fait partir tout de suite ce qui attend, et rend la fin de la
 *     file — à appeler au démontage et au changement d'objet.
 *
 * ⚠️ La valeur porte TOUT ce dont l'écriture a besoin (l'id, et la fonction
 * des liens de CET objet) : vidée après un changement de sujet, elle ne doit
 * pas écrire dans le suivant (la leçon du chantier H, 2026-09-06).
 */
export interface EcritureDifferee<V> {
  planifier(valeur: V): void;
  vider(): Promise<void>;
}

export function ecritureDifferee<V>(ecrire: (valeur: V) => Promise<void>, delaiMs: number): EcritureDifferee<V> {
  let enAttente: { valeur: V } | null = null;
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  let file: Promise<void> = Promise.resolve();

  const partir = (): Promise<void> => {
    if (minuteur) {
      clearTimeout(minuteur);
      minuteur = null;
    }
    if (!enAttente) return file;
    const { valeur } = enAttente;
    enAttente = null;
    file = file.then(() => ecrire(valeur)).catch((e) => console.error("écriture différée :", e));
    return file;
  };

  return {
    planifier(valeur) {
      enAttente = { valeur };
      if (minuteur) clearTimeout(minuteur);
      minuteur = setTimeout(() => void partir(), delaiMs);
    },
    vider: partir,
  };
}
