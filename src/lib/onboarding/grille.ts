import { minutesDeHeure, type Plage, type ReglagesHoraires } from "./reglages";

/**
 * ⭐ La grille de la semaine — 168 cases, une par heure.
 *
 * LA THÈSE. C'est le SOUS-PRODUIT VISUEL de ce que la personne vient de saisir,
 * pas une analyse. On ne lui apprend rien qu'elle n'ait dit ; on lui montre la
 * forme de ce qu'elle a dit. Le chiffre parle tout seul et l'app ne le commente
 * pas.
 *
 * ⚠️ CE QUE CETTE GRILLE NE FAIT JAMAIS, et c'est le cœur du cahier des
 * charges :
 *
 *   • aucune estimation de « temps perdu sans Shale », aucun coefficient
 *     inventé, aucune projection de gain calculée par l'app. Le seul chiffre de
 *     gain de toute l'app vient du CURSEUR, donc de l'utilisateur ;
 *   • aucune formulation en perte. On dit « il te reste 32 h libres », jamais
 *     « tu perds 14 h » — c'est `heuresLibres()` qui est exposée, et il n'existe
 *     volontairement aucune fonction qui compte les heures occupées ;
 *   • le sommeil est un bloc INCOMPRESSIBLE. Il gagne toutes les collisions
 *     (voir `PRIORITE`), et rien ici ne sait le raccourcir.
 */

/** Les quatre catégories de la grille. `libre` est le RÉSIDU, jamais un choix. */
export type Categorie = "sommeil" | "travail" | "trajet" | "libre";

export const JOURS = 7;
export const HEURES = 24;
export const CASES = JOURS * HEURES; // 168

/**
 * ⭐ Qui gagne quand deux déclarations se recouvrent, du plus fort au plus faible.
 *
 * `sommeil` d'abord : c'est la règle du chantier, pas une commodité. Quelqu'un
 * qui déclare travailler jusqu'à minuit et se coucher à 23 h voit ses 23 h – 00 h
 * en sommeil, et l'app ne lui propose pas d'y travailler.
 *
 * `trajet` avant `travail` : un bloc contraint a été saisi NOMMÉMENT, un par un,
 * là où la plage de travail est une généralité. Le plus précis l'emporte sur le
 * plus large — sinon déclarer son trajet du matin n'aurait aucun effet visible,
 * et la question du troisième écran ne brancherait rien.
 */
const PRIORITE: readonly Categorie[] = ["sommeil", "trajet", "travail", "libre"];

/** `grille[jour][heure]`, jour en convention `getDay()` (0 = dimanche). */
export type Grille = Categorie[][];

/**
 * Une plage, découpée en minutes occupées par jour de semaine.
 *
 * ⚠️ FRANCHIR MINUIT EST LE CAS NORMAL, pas le cas limite : « je me couche à
 * 23 h et je me lève à 7 h » est la réponse que tout le monde donne. Une plage
 * dont la fin est ≤ au début se poursuit donc sur le JOUR SUIVANT, et ses
 * minutes d'après-minuit se posent sur `(jour + 1) % 7`. L'oublier collait huit
 * heures de sommeil sur la seule heure 23 h et rendait 161 cases libres.
 */
function poser(
  minutes: (Categorie | null)[][],
  plage: Plage,
  categorie: Categorie,
): void {
  const debut = minutesDeHeure(plage.debut);
  const fin = minutesDeHeure(plage.fin);
  if (debut == null || fin == null) return;
  // Une plage de durée nulle n'occupe rien. Une plage qui « finit » avant de
  // commencer franchit minuit : sa durée est ce qui reste jusqu'au lendemain.
  const duree = fin > debut ? fin - debut : fin === debut ? 0 : 24 * 60 - debut + fin;
  if (duree <= 0) return;

  for (const jour of plage.jours) {
    for (let m = 0; m < duree; m++) {
      const absolu = debut + m;
      const j = (jour + Math.floor(absolu / (24 * 60))) % JOURS;
      const min = absolu % (24 * 60);
      const dejaLa = minutes[j][min];
      // Une minute n'appartient qu'à une catégorie : la plus prioritaire.
      if (dejaLa == null || PRIORITE.indexOf(categorie) < PRIORITE.indexOf(dejaLa)) {
        minutes[j][min] = categorie;
      }
    }
  }
}

/** Tous les jours de la semaine — le sommeil ne prend pas de week-end. */
const TOUS_LES_JOURS = [0, 1, 2, 3, 4, 5, 6];

/**
 * La grille, dérivée des réponses. 7 × 24 cases, toujours pleines.
 *
 * ⚠️ RÉSOLUTION EN DEUX TEMPS, et le second n'est pas cosmétique. On résout
 * d'abord MINUTE PAR MINUTE (chaque minute n'a qu'une catégorie, la plus
 * prioritaire), puis chaque case d'une heure prend la catégorie qui occupe le
 * PLUS DE MINUTES de cette heure-là.
 *
 * Faire l'inverse — « toute heure effleurée par un bloc lui appartient » —
 * aurait fait manger deux heures entières par un trajet de 08:50 à 09:10, et le
 * compte d'heures libres, qui est le seul chiffre de l'écran, aurait été faux
 * dans le sens qui décourage.
 *
 * ⭐ À ÉGALITÉ de minutes, `PRIORITE` tranche — donc l'OCCUPÉ l'emporte sur le
 * libre, et c'est un choix. Cent soixante-huit cases horaires ne savent pas
 * représenter une demi-heure : une journée 09:30 – 17:30 s'affiche forcément en
 * 7 h ou en 9 h. On prend 9. Le compte d'heures libres BORNE LE CURSEUR de
 * clôture ; le surestimer laisserait poser un objectif sur des heures qui
 * n'existent pas, là où le sous-estimer ne promet rien de faux.
 */
export function grilleSemaine(r: ReglagesHoraires): Grille {
  const minutes: (Categorie | null)[][] = Array.from({ length: JOURS }, () =>
    new Array<Categorie | null>(24 * 60).fill(null),
  );

  // Ordre d'application sans importance : `poser` arbitre par priorité.
  poser(minutes, { jours: TOUS_LES_JOURS, debut: r.coucher, fin: r.lever }, "sommeil");
  poser(minutes, r.travail, "travail");
  for (const bloc of r.contraints) poser(minutes, bloc, "trajet");

  const grille: Grille = Array.from({ length: JOURS }, () =>
    new Array<Categorie>(HEURES).fill("libre"),
  );
  for (let j = 0; j < JOURS; j++) {
    for (let h = 0; h < HEURES; h++) {
      const compte = new Map<Categorie, number>();
      for (let m = h * 60; m < (h + 1) * 60; m++) {
        const c = minutes[j][m] ?? "libre";
        compte.set(c, (compte.get(c) ?? 0) + 1);
      }
      let gagnante: Categorie = "libre";
      let meilleur = -1;
      for (const c of PRIORITE) {
        const n = compte.get(c) ?? 0;
        // `>` strict : à égalité, l'ordre de `PRIORITE` a déjà tranché.
        if (n > meilleur) {
          meilleur = n;
          gagnante = c;
        }
      }
      grille[j][h] = gagnante;
    }
  }
  return grille;
}

/**
 * ⭐ Le SEUL compte que ce module expose : les heures qui restent.
 *
 * Il n'existe volontairement aucune fonction jumelle qui compterait les heures
 * occupées, ni aucun ratio. Ce n'est pas un oubli : c'est ce qui rend
 * mécaniquement impossible d'écrire un écran « tu perds N heures » à partir
 * d'ici.
 */
export function heuresLibres(grille: Grille): number {
  let n = 0;
  for (const jour of grille) for (const c of jour) if (c === "libre") n++;
  return n;
}

/** Les heures libres d'un jour donné, convention `getDay()`. */
export function heuresLibresDuJour(grille: Grille, jour: number): number {
  return grille[jour]?.filter((c) => c === "libre").length ?? 0;
}

/**
 * ⭐ Le plafond du curseur de clôture : « combien d'heures veux-tu récupérer ? »
 *
 * Borné par le temps libre RÉELLEMENT disponible dans la grille, et non par un
 * chiffre rond : proposer de récupérer vingt heures à quelqu'un qui en a douze
 * de libres serait la première promesse que l'app ne pourrait pas tenir.
 *
 * ⚠️ Le plancher est 1 : un objectif de zéro heure n'est pas un objectif. Quand
 * la grille ne laisse aucune heure libre, le curseur n'a pas lieu d'être et
 * l'écran ne le montre pas — c'est ce que dit `maximum === 0`.
 */
export function bornesDuCurseur(grille: Grille): { minimum: number; maximum: number } {
  return { minimum: 1, maximum: heuresLibres(grille) };
}

/**
 * La valeur proposée par défaut au curseur : un CINQUIÈME des heures libres,
 * arrondi, borné à 10.
 *
 * ⚠️ Ce n'est pas une projection de gain — l'app ne prétend rien récupérer.
 * C'est la position de départ d'une poignée que l'utilisateur déplace, et la
 * valeur retenue est celle qu'il relâche. Un cinquième plutôt que la moitié
 * parce qu'une poignée posée trop haut se lit comme une consigne.
 */
export function valeurProposee(grille: Grille): number {
  const libres = heuresLibres(grille);
  if (libres <= 0) return 0;
  return Math.max(1, Math.min(10, Math.round(libres / 5)));
}
