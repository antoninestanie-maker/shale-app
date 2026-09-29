// ─────────────────────────────────────────────────────────────────────────────
// La logique des brouillons à valider — pure, testée à part du composant.
//
// Principe 2 du chantier : AUCUNE sortie de modèle n'écrit en base. Tout
// arrive ici : l'utilisateur coche, corrige, accepte ou rejette ; seul ce qu'il
// a coché, dans la version qu'il a corrigée, part vers `onValider`. C'est la
// protection contre les erreurs du modèle ET contre une injection venue d'une
// note, d'un PDF ou d'un flux — au pire des propositions absurdes, jamais une
// écriture.
// ─────────────────────────────────────────────────────────────────────────────

export interface EtatPropositions<T> {
  ordre: readonly string[];
  items: Readonly<Record<string, { valeur: T; cochee: boolean }>>;
}

export function initialiser<T>(items: readonly T[], cle: (t: T, i: number) => string, cochees = true): EtatPropositions<T> {
  const ordre: string[] = [];
  const table: Record<string, { valeur: T; cochee: boolean }> = {};
  items.forEach((valeur, i) => {
    let k = cle(valeur, i);
    // Une clé en double écraserait une proposition en silence.
    while (k in table) k = `${k}~${i}`;
    ordre.push(k);
    table[k] = { valeur, cochee: cochees };
  });
  return { ordre, items: table };
}

export function basculer<T>(e: EtatPropositions<T>, k: string): EtatPropositions<T> {
  const it = e.items[k];
  return it ? { ...e, items: { ...e.items, [k]: { ...it, cochee: !it.cochee } } } : e;
}

export function modifier<T>(e: EtatPropositions<T>, k: string, valeur: T): EtatPropositions<T> {
  const it = e.items[k];
  return it ? { ...e, items: { ...e.items, [k]: { ...it, valeur } } } : e;
}

export function toutes<T>(e: EtatPropositions<T>, cochee: boolean): EtatPropositions<T> {
  return {
    ...e,
    items: Object.fromEntries(e.ordre.map((k) => [k, { ...e.items[k], cochee }])),
  };
}

/** Ce qui sera écrit : les cochées, dans l'ordre d'origine, telles que corrigées. */
export function choisies<T>(e: EtatPropositions<T>): T[] {
  return e.ordre.filter((k) => e.items[k].cochee).map((k) => e.items[k].valeur);
}
