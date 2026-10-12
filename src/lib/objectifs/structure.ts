import type { Goal } from "../types";

/**
 * La forme d'une feuille de route : trois niveaux, et c'est une règle de SAISIE.
 *
 *   objectif racine (niveau 0)
 *   ├── phase (niveau 1 : une étape qui en contient d'autres)
 *   │   └── étape (niveau 2)
 *   └── étape (niveau 1)
 *
 * ⚠️ AUCUN CHECK EN BASE (migration 026, PIEGES § 3.4) : une ligne distante qui
 * violerait une contrainte de profondeur arrêterait la synchronisation. La règle
 * vit donc ici, et elle ne s'applique qu'à ce que l'utilisateur CRÉE. Une
 * arborescence plus profonde — les objectifs d'avant ce chantier, où rien ne
 * bornait l'imbrication — se LIT sans erreur (`progression.ts` descend à
 * n'importe quelle profondeur) ; elle ne peut simplement plus s'approfondir.
 */

export const NIVEAU_MAX = 2;

/** 0 pour une racine. Garde anti-cycle : une boucle rend le niveau atteint. */
export function niveauDe(goal: Goal, goals: readonly Goal[]): number {
  const parDeId = new Map(goals.map((g) => [g.id, g]));
  const vus = new Set<number>([goal.id]);
  let niveau = 0;
  let courant = goal;
  while (courant.parent_goal_id != null) {
    const parent = parDeId.get(courant.parent_goal_id);
    if (!parent || vus.has(parent.id)) break;
    vus.add(parent.id);
    niveau++;
    courant = parent;
  }
  return niveau;
}

/** L'objectif racine d'une étape (lui-même s'il est racine). */
export function racineDe(goal: Goal, goals: readonly Goal[]): Goal {
  const parDeId = new Map(goals.map((g) => [g.id, g]));
  const vus = new Set<number>([goal.id]);
  let courant = goal;
  while (courant.parent_goal_id != null) {
    const parent = parDeId.get(courant.parent_goal_id);
    if (!parent || vus.has(parent.id)) break;
    vus.add(parent.id);
    courant = parent;
  }
  return courant;
}

/**
 * Les étapes DIRECTES d'un objectif, dans l'ordre d'affichage — exemples
 * compris : un exemple doit se voir.
 *
 * ⚠️ UN SEUL TRI POUR TOUT LE DÉPÔT. Il vivait dans `FeuilleDeRoute.tsx` ; la
 * carte mentale (`objectifs/carte.ts`) doit dessiner les branches dans l'ordre
 * EXACT où la feuille de route les empile, sinon les deux formes du même
 * objectif ne se superposent plus dans la tête de qui les regarde.
 */
export function etapesTriees(parentId: number, goals: readonly Goal[]): Goal[] {
  return goals
    .filter((g) => g.parent_goal_id === parentId)
    .sort(
      (a, b) =>
        (a.position ?? 0) - (b.position ?? 0) ||
        (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") ||
        a.id - b.id,
    );
}

/**
 * ⚠️ LES IDENTIFIANTS RESTENT `"jalon"` ET `"sous-objectif"` : ce sont des CLÉS
 * (la colonne `goals.is_milestone`, le `genre` d'un nœud de carte enregistré
 * dans une note), pas du texte. Aucune migration pour un mot.
 *
 * 2026-09-20 — « jalon » ne s'affiche plus : le mot affiché était « phase ».
 * 2026-10-12 — « sous-objectif » ne s'affiche plus non plus, et le genre ne se
 * CHOISIT plus : voir `natureDe`, juste dessous. Ce type ne sert plus qu'à
 * nommer la valeur stockée ; aucun écran ne le lit pour décider d'un mot.
 */
export type GenreEtape = "jalon" | "sous-objectif";

/**
 * ⭐ CE QU'UNE LIGNE EST, D'APRÈS CE QU'ELLE CONTIENT (2026-10-12).
 *
 * Antonin a validé, le 12 octobre, la proposition du chantier « étapes
 * cochables » : « garder "étape" comme seul mot affiché, "phase" seulement
 * quand une étape en contient d'autres, et retirer "sous-objectif" de
 * l'écran ». Réponse : « je valide ».
 *
 *   • la racine est l'OBJECTIF ;
 *   • une ligne qui porte au moins une étape est une PHASE ;
 *   • toute autre ligne est une ÉTAPE.
 *
 * ⚠️ DÉCISION RETOURNÉE. Du 2026-09-14 au 2026-10-12, le genre se choisissait
 * à la création (« Phase | Sous-objectif ») et se lisait dans
 * `goals.is_milestone`. Une phase vide s'appelait « phase », une étape
 * s'appelait « sous-objectif », et le bouton disait « Ajouter une étape » :
 * trois mots pour la même ligne (labo du 2026-10-11, constat 22, les cinq
 * utilisateurs). La colonne reste écrite (voir `ajouter.ts`), pour qu'un
 * appareil resté sur l'ancienne version lise encore une arborescence
 * cohérente ; plus AUCUN écran de cette version ne la lit.
 *
 * `goals` : les lignes VIVANTES (ce que `fetchAll` rend). Une phase dont la
 * dernière étape part à la corbeille redevient donc une étape, à la lecture.
 */
export type NatureLigne = "objectif" | "phase" | "etape";

export function natureDe(goal: Pick<Goal, "id" | "parent_goal_id">, goals: readonly Pick<Goal, "parent_goal_id">[]): NatureLigne {
  if (goal.parent_goal_id == null) return "objectif";
  return goals.some((g) => g.parent_goal_id === goal.id) ? "phase" : "etape";
}

/**
 * La CLÉ sous laquelle une nature est enregistrée dans une carte mentale
 * (`GenreRef`, `lib/carte.ts`) : « sous-objectif » y désigne une étape. Le mot
 * ne s'affiche jamais ; la clé ne change pas, les cartes déjà enregistrées
 * dans des notes la portent.
 */
export function cleDeNature(nature: NatureLigne): "objectif" | "phase" | "sous-objectif" {
  return nature === "etape" ? "sous-objectif" : nature;
}

/** Une ligne (étape OU objectif) porte-t-elle des étapes ? */
export function contientDesEtapes(goal: Pick<Goal, "id">, goals: readonly Pick<Goal, "parent_goal_id">[]): boolean {
  return goals.some((g) => g.parent_goal_id === goal.id);
}

/**
 * Peut-on créer une étape sous `parent` ?
 *
 * Trois niveaux, et c'est tout : sous l'objectif (niveau 0) ou sous une de ses
 * étapes (niveau 1) — qui devient alors une phase. Jamais sous une étape de
 * niveau 2 : là, ce qu'on ajoute est une tâche.
 *
 * ⚠️ Jusqu'au 2026-10-12 la fonction prenait un GENRE (« une phase ne naît que
 * sous une racine, un sous-objectif sous une racine ou une phase »). Le genre
 * ne se choisit plus : c'est le contenu qui nomme.
 */
export function peutAjouterEtape(parent: Goal, goals: readonly Goal[]): boolean {
  return niveauDe(parent, goals) < NIVEAU_MAX;
}

/** Combien de niveaux d'étapes pendent sous cette ligne (0 : aucune). Garde anti-cycle. */
export function hauteurSous(goal: Pick<Goal, "id">, goals: readonly Goal[]): number {
  const descendre = (id: number, vus: Set<number>): number => {
    let h = 0;
    for (const e of goals) {
      if (e.parent_goal_id !== id || vus.has(e.id)) continue;
      h = Math.max(h, 1 + descendre(e.id, new Set(vus).add(e.id)));
    }
    return h;
  };
  return descendre(goal.id, new Set([goal.id]));
}

/**
 * Peut-on RANGER `goal` (avec ce qui pend dessous) sous `parent` sans dépasser
 * les trois niveaux ? Sert à la liste « Objectif parent » de la fenêtre : une
 * phase ne se range pas sous une étape, ses étapes tomberaient au niveau 3.
 * `goal` absent : une ligne neuve, sans rien dessous.
 */
export function peutRangerSous(parent: Goal, goal: Pick<Goal, "id"> | null, goals: readonly Goal[]): boolean {
  return niveauDe(parent, goals) + 1 + (goal ? hauteurSous(goal, goals) : 0) <= NIVEAU_MAX;
}

/**
 * Le premier objectif, en remontant depuis `voulu` (inclus), qui peut recevoir
 * une étape. Sert à la carte mentale : une étape dessinée sous une étape de
 * niveau 2 naît sous la phase au-dessus, et l'écran le dit.
 */
export function premierAccueil(voulu: Goal, goals: readonly Goal[]): Goal | null {
  const parDeId = new Map(goals.map((g) => [g.id, g]));
  const vus = new Set<number>();
  for (let g: Goal | undefined = voulu; g && !vus.has(g.id); g = g.parent_goal_id == null ? undefined : parDeId.get(g.parent_goal_id)) {
    vus.add(g.id);
    if (peutAjouterEtape(g, goals)) return g;
  }
  return null;
}

/** L'objectif a-t-il une feuille de route (au moins une étape) ? */
export function aUneFeuilleDeRoute(goal: Pick<Goal, "id">, goals: readonly Goal[]): boolean {
  return goals.some((g) => g.parent_goal_id === goal.id);
}
