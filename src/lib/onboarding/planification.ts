import { t } from "../i18n";
import type { GoalInput } from "../repo";

/**
 * ⭐ Le premier objectif planté par l'accueil, et sa feuille de route.
 *
 * Logique PURE : elle fabrique les lignes à écrire, elle n'écrit rien (c'est
 * `semer.ts` qui touche à la base). C'est ce qui rend vérifiables, par des
 * tests et non par une relecture, les interdits du chantier « premier
 * démarrage » — ils sont plus faciles à trahir qu'à tenir.
 *
 * LES CONTRAINTES, ET POURQUOI ELLES SONT ICI
 *
 * ⚠️ **AUCUNE ÉCHÉANCE**, ni sur l'objectif ni sur ses jalons.
 * `calendrier/peril.ts` ne signale que ce qui a une échéance : en donner une
 * ferait apparaître « objectif en péril » une semaine après l'installation, sur
 * la première chose que l'utilisateur ait dite à l'app.
 *
 * ⚠️ **AUCUN JALON SUGGÉRÉ.** Les gabarits de feuille de route sont
 * explicitement hors de ce chantier : proposer « Choisir la ligne éditoriale »
 * à quelqu'un dont on ignore l'objectif, c'est livrer un modèle déguisé.
 * Tout ce qui s'écrit ici vient de l'utilisateur, donc `is_example` reste à 0 —
 * et le bouton « supprimer les exemples » n'y touche jamais.
 *
 * ⚠️ **AUCUNE PROJECTION DE GAIN, AUCUNE FORMULATION EN PERTE.** Le seul
 * chiffre qui apparaît est celui du curseur, choisi par l'utilisateur, et il
 * n'apparaît que comme une intention (« libérées pour ça »), jamais comme un
 * calcul ni comme une dette.
 *
 * ⭐ **L'OBJECTIF PLANTÉ REMPLACE CELUI DU CURSEUR** — décision d'Antonin du
 * 2026-09-16. Deux objectifs au premier lancement, dont un que l'app ne sait
 * pas mesurer, serait un mauvais accueil. Le chiffre du curseur n'est donc pas
 * perdu : il devient la description de l'objectif planté. Écran passé (aucun
 * titre) → c'est l'objectif du curseur qui est créé, exactement comme avant.
 */

/** Trois lignes au plus : au-delà, l'accueil devient un formulaire. */
export const NB_JALONS_MAX = 3;

/** Nettoie les lignes de jalons : vides retirées, doublons écartés, trois au plus. */
export function jalonsPropres(lignes: readonly string[]): string[] {
  const vus = new Set<string>();
  const out: string[] = [];
  for (const brut of lignes) {
    const titre = brut.trim().replace(/\s+/g, " ");
    if (!titre) continue;
    const cle = titre.toLocaleLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push(titre);
    if (out.length === NB_JALONS_MAX) break;
  }
  return out;
}

/** Y a-t-il de quoi planter un objectif ? Un titre suffit ; les jalons sont facultatifs. */
export function planRempli(titre: string): boolean {
  return titre.trim().length > 0;
}

export interface Plan {
  /** L'objectif racine, MESURÉ : sa progression viendra de ses jalons. */
  racine: GoalInput;
  /** Ses jalons, dans l'ordre de saisie. */
  jalons: GoalInput[];
}

/**
 * Les lignes à écrire pour l'objectif planté.
 *
 * `heures` est la valeur du curseur ; à 0 (ou non posée) aucune description
 * n'est inventée.
 */
export function planDuPremierObjectif(titre: string, lignes: readonly string[], heures: number): Plan {
  const nom = titre.trim().replace(/\s+/g, " ");
  const racine: GoalInput = {
    title: nom,
    description: heures > 0 ? t("{n} h par semaine libérées pour ça.", { n: heures }) : null,
    scope: "medium",
    category: null,
    parent_goal_id: null,
    deadline: null, // ⚠️ jamais d'échéance (voir l'en-tête)
    progress_pct: 0,
    manual_progress: 0, // mesuré : c'est la feuille de route qui parle
    is_example: 0,
  };
  const jalons = jalonsPropres(lignes).map<GoalInput>((nomJalon, i) => ({
    title: nomJalon,
    description: null,
    scope: "medium",
    category: null,
    parent_goal_id: null, // posé à l'écriture, quand la racine a son id
    deadline: null,
    progress_pct: 0,
    manual_progress: 0,
    is_milestone: 1,
    position: i,
    is_example: 0,
  }));
  return { racine, jalons };
}
