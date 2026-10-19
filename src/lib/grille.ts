/**
 * Ce que la grille redimensionnable (`components/grid/ResizableGrid.tsx`) fait
 * d'un identifiant de panneau ENREGISTRÉ qui n'existe plus à l'écran.
 *
 * Une grille garde trois réglages par vue : `order.<vue>` (l'ordre choisi),
 * `hidden.<vue>` (les panneaux masqués) et `layout.<vue>` (les tailles
 * épinglées). Ils survivent aux versions : le jour où un panneau est retiré de
 * l'app, son identifiant y traîne encore.
 *
 * ⭐ 2026-10-11 — la jauge « Énergie restante » (`energy` sur Aujourd'hui,
 * `settings-energy` dans les Réglages) est retirée pour tout le monde. Ces deux
 * règles vivaient en ligne dans le composant ; elles sortent ici pour qu'un
 * test les tienne (`grille.test.ts`) : un identifiant orphelin ne doit laisser
 * NI TROU dans la grille, NI PASTILLE « + … » pour rallumer une carte qui
 * n'existe plus.
 *
 * ⚠️ On ne nettoie PAS les réglages : l'identifiant orphelin reste dans la
 * base, inerte. Un appareil resté en ancienne version le lit encore
 * (`order.<vue>` est synchronisé), et une taille épinglée orpheline n'est
 * jamais lue — la grille n'interroge `layout.<vue>` que par l'identifiant d'un
 * panneau présent.
 */

/**
 * L'ordre réellement rendu : l'ordre enregistré, réduit aux panneaux présents,
 * puis les panneaux présents qu'il ne connaît pas encore, dans l'ordre du code.
 */
export function ordreEffectif(enregistre: readonly string[], presents: readonly string[]): string[] {
  const connus = new Set(presents);
  const gardes = enregistre.filter((id) => connus.has(id));
  const vus = new Set(gardes);
  return [...gardes, ...presents.filter((id) => !vus.has(id))];
}

/**
 * Les panneaux masqués qu'on peut PROPOSER de rallumer : ceux qui existent
 * encore. Un masqué orphelin n'a ni titre ni contenu à remettre.
 */
export function masquesConnus(masques: readonly string[], presents: readonly string[]): string[] {
  const connus = new Set(presents);
  return masques.filter((id) => connus.has(id));
}

// ─────────────────────────────────────────────────────────────────────────────
// Aujourd'hui AU TÉLÉPHONE — les habitudes juste sous les tâches (12/10), puis
// toutes les cartes d'action en tête (19/10, plus bas).
//
// ⭐ 2026-10-12, crible du labo, constat 14. Au téléphone les cartes
// s'empilent sur une seule colonne, dans l'ordre du bureau : bandeaux, puis
// colonne gauche et colonne droite ENTRELACÉES. « Habitudes à tenir », troisième
// de la colonne gauche, tombait donc après Discipline, Tâches, Timer et
// Calendrier — à plus de deux écrans de défilement, pour trois cases à cocher.
// C'est le moment où Léa aurait fermé l'app.
//
// La règle ne vaut QUE pour le téléphone : au bureau, les deux colonnes se
// voient d'un coup et l'ordre de Personnaliser reste celui d'Antonin.
//
// ⚠️ Elle s'applique à l'ordre RENDU par la grille, donc aussi à un ordre
// enregistré en glissant les cartes sur le bureau (`order.today` est
// synchronisé) : au doigt il n'y a pas de poignée pour le corriger.
// ─────────────────────────────────────────────────────────────────────────────

/** Déplace `id` juste après `apres`. Rien ne bouge si l'un des deux manque. */
export function placerApres(ordre: readonly string[], id: string, apres: string): string[] {
  if (id === apres || !ordre.includes(id) || !ordre.includes(apres)) return [...ordre];
  const sans = ordre.filter((x) => x !== id);
  sans.splice(sans.indexOf(apres) + 1, 0, id);
  return sans;
}

// ⭐ 2026-10-19, audit « alléger » : au téléphone, Aujourd'hui commence par
// ce qu'on FAIT (tâches, habitudes, agenda, timer), et finit par ce qu'on
// MESURE (série, discipline, objectifs). Avant, quatre cartes de chiffres
// (série, 7 jours, focus, anneau de discipline) passaient devant la liste des
// tâches : elle commençait à plus d'un écran et demi de défilement. Les cartes
// qui ne sont pas dans la liste gardent leur ordre relatif, après.

/** Les cartes d'action, dans l'ordre où elles s'affichent en tête au téléphone. */
export const EN_TETE_AU_TELEPHONE = ["tasks", "habitudes", "calendar", "timer"] as const;

/** L'ordre des cartes d'Aujourd'hui sur un téléphone. */
export function ordreAujourdhuiAuTelephone(ordre: readonly string[]): string[] {
  const tete: string[] = EN_TETE_AU_TELEPHONE.filter((id) => ordre.includes(id));
  return [...tete, ...ordre.filter((id) => !tete.includes(id))];
}

// ─────────────────────────────────────────────────────────────────────────────
// Les deux colonnes d'Aujourd'hui — tant que personne n'a rien déplacé.
//
// ⭐ 2026-10-11. La grille place chaque panneau « au premier endroit où il
// tient » (`grid-auto-flow: row dense`). Avec des cartes étroites (4 colonnes)
// et larges (8), ce placement ne fait PAS deux colonnes : dès que « Tâches du
// jour » est plus courte que « Discipline » — trois tâches, ou un compte neuf —
// le Timer et les Habitudes se glissent sous les tâches, le Calendrier (large)
// descend d'autant, et il reste un trou sous l'anneau de Discipline. Vu à
// l'écran en retirant la jauge d'énergie, qui occupait justement cette place ;
// le trou existait AVANT elle (capture `avant-neuf/001.jpg`), elle le masquait
// seulement quand la liste des tâches était assez longue.
//
// La parade : un panneau peut être ANCRÉ à un bord de la grille. Les cartes de
// la « colonne gauche » de Personnaliser partent de la première colonne, celles
// de la « colonne droite » finissent à la dernière. Chaque colonne devient une
// pile continue : plus de trou entre deux cartes, et l'écran tient enfin ce que
// Personnaliser annonce.
//
// ⚠️ L'ancre ne vaut que pour la disposition INTACTE. Dès que l'utilisateur
// déplace un panneau à la main ou change une largeur, la grille entière
// redevient libre, exactement comme avant : on ne lui reprend pas ce qu'il a
// rangé, et faire passer une carte d'une colonne à l'autre reste possible.
// ─────────────────────────────────────────────────────────────────────────────

/** Le bord auquel un panneau s'accroche : le début (gauche) ou la fin (droite) de la grille. */
export type Ancre = "debut" | "fin";

/**
 * La disposition est-elle encore celle du code ? Faux dès que l'ordre affiché
 * n'est plus celui des panneaux présents, ou qu'un panneau présent a une
 * largeur enregistrée différente de sa largeur par défaut.
 *
 * ⚠️ Une HAUTEUR épinglée ne compte pas : elle ne déplace personne d'une
 * colonne à l'autre. Et une largeur enregistrée pour un panneau disparu (la
 * jauge `energy`) non plus — elle est ignorée, comme partout ici.
 */
export function dispositionIntacte(
  ordre: readonly string[],
  presents: readonly { id: string; largeurParDefaut: number }[],
  largeurs: Readonly<Record<string, { w: number } | undefined>>,
): boolean {
  if (ordre.length !== presents.length) return false;
  return presents.every(
    (p, i) => ordre[i] === p.id && (largeurs[p.id] === undefined || largeurs[p.id]!.w === p.largeurParDefaut),
  );
}

/**
 * Ce panneau-ci garde-t-il son ancre ?
 *
 * - `largeur` : celle qu'il a À L'ÉCRAN (un aperçu de redimensionnement, ou le
 *   plancher d'une fenêtre étroite, peut l'avoir changée) ;
 * - `plancher` : la plus petite largeur qu'un panneau peut prendre à cette
 *   largeur de fenêtre. S'il ne reste pas la place d'un voisin à côté de lui,
 *   l'ancre ne ferait qu'ouvrir un vide : on la lâche (téléphone, fenêtre
 *   étroite).
 */
export function ancreTient(o: {
  intacte: boolean;
  largeur: number;
  largeurParDefaut: number;
  plancher: number;
  colonnes: number;
}): boolean {
  return o.intacte && o.largeur === o.largeurParDefaut && o.plancher <= o.colonnes - o.largeur;
}

/** La valeur CSS de `grid-column` : libre, accrochée au début, ou à la fin. */
export function colonneCss(largeur: number, ancre: Ancre | null): string {
  if (ancre === "debut") return `1 / span ${largeur}`;
  if (ancre === "fin") return `span ${largeur} / -1`;
  return `span ${largeur}`;
}

/**
 * ⭐ LA PLACE DE LA BARRE DE POIGNÉES DANS UN EN-TÊTE (2026-10-12).
 *
 * LE DÉFAUT. Antonin, sur Performance : « les widgets bougent quand je passe
 * dessus, car un s'agrandit quand je passe la souris dessus ». Au survol d'un
 * panneau, la barre de poignées apparaît en haut à droite ; un en-tête marqué
 * `.rgrid-head` réserve alors sa place par un `padding-right`, pour que ses
 * contrôles ne passent pas dessous. Mais cet en-tête sait se replier
 * (`flex-wrap`) : quand il n'avait pas la place de s'écarter, il passait sur
 * deux lignes, la carte grandissait de 24 px et la grille se réagençait — au
 * simple passage de la souris. Mesuré à 1470×923, densité 110 % : « par jour
 * de la semaine » (Performance) et « objectif quotidien » (Timer).
 *
 * LA RÈGLE. Survoler un panneau ne change JAMAIS sa hauteur. Un en-tête est
 * donc dans l'un de trois cas, décidés par la MESURE, pas par le survol :
 *   • hors de portée de la barre (plus bas, ou plus à gauche) : rien n'est
 *     réservé, ni au repos ni au survol ;
 *   • il a la place : la réserve n'est posée qu'au survol, comme avant — la
 *     mesure a vérifié qu'elle ne change pas sa hauteur ;
 *   • il n'a PAS la place (« serré ») : la réserve est PERMANENTE. Il est
 *     replié au repos comme il l'aurait été au survol, et le survol n'y
 *     change plus rien.
 * Dans les trois cas, aucun contrôle ne passe sous la barre.
 *
 * Ces deux fonctions sont la règle ; la mesure elle-même (lire le DOM, poser
 * le résultat) est dans `components/grid/entetes.ts`.
 */

/** L'air laissé entre la barre de poignées et ce qui s'en écarte, en px locaux. */
export const AIR_BARRE = 8;

/** Un rectangle lu à l'écran (`getBoundingClientRect`) : seuls ces bords comptent. */
export interface BordsEcran {
  haut: number;
  bas: number;
  gauche: number;
  droite: number;
}

/**
 * La largeur à réserver à droite d'un en-tête pour que la barre de poignées ne
 * recouvre rien, en px LOCAUX. 0 : la barre ne passe pas sur cet en-tête.
 *
 * ⚠️ Calculée d'après les rectangles RÉELS, plus d'après une constante. La
 * constante (5,25 rem) supposait une carte au bord rembourré de 20 px : sur un
 * panneau sans carte (« Métriques »), le bouton « Ajouter » restait 4 px sous
 * la barre ; sur une carte, elle réservait 10 px de trop.
 *
 * `echelle` : px d'écran pour un px local (la densité de l'interface) — les
 * rectangles sont en px d'écran, le `padding` s'écrit en px locaux.
 */
export function reserveDEntete(tete: BordsEcran, barre: BordsEcran, echelle: number): number {
  const e = Number.isFinite(echelle) && echelle > 0 ? echelle : 1;
  // Barre absente (au doigt elle est `display: none`) : rectangle vide.
  if (barre.droite - barre.gauche <= 0 || barre.bas - barre.haut <= 0) return 0;
  // Pas à la même hauteur : un second en-tête, plus bas dans la carte.
  if (tete.haut >= barre.bas || tete.bas <= barre.haut) return 0;
  const recouvert = (tete.droite - barre.gauche) / e;
  if (recouvert <= 0) return 0;
  return Math.ceil(recouvert + AIR_BARRE);
}

/**
 * L'en-tête est-il « serré » : la réserve le fait-elle GRANDIR ?
 * `sans` et `avec` : sa hauteur mesurée sans réserve, puis avec. Un demi-pixel
 * de jeu : deux mesures du même en-tête peuvent différer d'un arrondi.
 */
export function enteteSerre(sans: number, avec: number): boolean {
  return avec - sans > 0.5;
}
