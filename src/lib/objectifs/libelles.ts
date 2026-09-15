import { formatNumber, t, tp } from "../i18n";
import type { Goal } from "../types";
import type { Mesure } from "./progression";

/**
 * Ce que la vue Objectifs DIT de chaque ligne — logique pure, sans DOM.
 *
 * ⭐ « Chaque ligne dit d'où vient son pourcentage. » Un pourcentage dont on ne
 * peut pas remonter la source est exactement la barre déclarative que ce
 * chantier remplace ; c'est ce qui rend son absence acceptable. Ces phrases
 * vivent donc ici, testées, et pas dans le JSX où rien ne les garde.
 *
 * ⚠️ Des FONCTIONS, jamais des constantes de module : `t()` y serait figé dans
 * la langue de démarrage (PIEGES § 5.2).
 */

/** « 3/7 tâches », « 12/50 backtests », « saisi à la main », « jalon vide, non compté ». */
export function origineEnClair(m: Mesure, estJalon = false): string {
  const o = m.origine;
  switch (o.type) {
    case "manuel":
      return t("saisi à la main");
    case "cible": {
      const unite = o.unite?.trim();
      return unite ? `${nombre(o.compte)}/${nombre(o.cible)} ${unite}` : `${nombre(o.compte)}/${nombre(o.cible)}`;
    }
    case "feuille": {
      const morceaux: string[] = [];
      if (o.etapesComptees > 0) morceaux.push(tp(o.etapesComptees, "{n} étape", "{n} étapes"));
      if (o.elementsTotal > 0) {
        morceaux.push(tp(o.elementsTotal, "{faits}/{n} élément", "{faits}/{n} éléments", { faits: o.elementsFaits }));
      }
      if (m.vides > 0) morceaux.push(tp(m.vides, "{n} vide, non comptée", "{n} vides, non comptées"));
      return morceaux.join(" · ");
    }
    case "vide":
      switch (o.raison) {
        case "cible-nulle":
          return t("cible à zéro, non comptée");
        case "source-introuvable":
          return t("source introuvable, non comptée");
        case "etapes-vides":
          return estJalon ? t("jalon aux étapes vides, non compté") : t("étapes vides, non comptées");
        default:
          return estJalon ? t("jalon vide, non compté") : t("vide, non compté");
      }
  }
}

/**
 * ⭐ Un état vide PARLE : il dit pourquoi l'étape ne compte pas et ce qui la
 * ferait compter. Un cadre gris n'apprend rien (audit UI du 2026-08-28).
 */
export function pourquoiVide(m: Mesure, estJalon: boolean): string | null {
  if (m.origine.type !== "vide") return null;
  switch (m.origine.raison) {
    case "cible-nulle":
      return t("Une cible de zéro ne se mesure pas. Donne-lui un nombre à atteindre.");
    case "source-introuvable":
      return t("L’élément qui comptait a été supprimé. Choisis une autre source, ou compte à la main.");
    case "etapes-vides":
      return t("Aucune de ses étapes n’a encore de quoi se mesurer.");
    default:
      return estJalon
        ? t("Ce jalon ne compte pas encore. Ajoute-lui un sous-objectif, rattache une tâche ou fixe un nombre à atteindre.")
        : t("Rien à mesurer pour l’instant. Rattache une tâche ou fixe un nombre à atteindre.");
  }
}

/** Ce que change le poids, en toutes lettres — jamais un champ muet. */
export function effetDuPoids(poids: number, parent: Pick<Goal, "title"> | null): string {
  const p = poids > 0 ? poids : 1;
  const titre = parent?.title ?? t("l’objectif");
  if (p === 1) return t("Poids 1 : cette étape pèse autant que ses sœurs dans « {titre} ».", { titre });
  return t("Poids {p} : cette étape compte {p} fois plus qu’une étape de poids 1 dans « {titre} ».", { p, titre });
}

// ─── Repliement ─────────────────────────────────────────────────────────────

/**
 * Le dépliage PAR DÉFAUT d'une étape, avant tout geste de l'utilisateur.
 *
 * ⭐ Une feuille de route de six jalons tout ouverts remplit l'écran d'un
 * objectif unique. Donc : le jalon EN COURS (le premier, dans l'ordre, qui
 * n'est pas terminé) est déplié ; les terminés et ceux d'après sont repliés et
 * se résument en une ligne. Un sous-objectif ne déplie jamais son détail seul.
 */
export function deplieParDefaut(
  etape: Pick<Goal, "id" | "is_milestone">,
  freres: readonly Pick<Goal, "id" | "is_milestone">[],
  acheve: (id: number) => boolean,
): boolean {
  if (!etape.is_milestone) return false;
  const enCours = freres.find((f) => f.is_milestone && !acheve(f.id));
  return enCours?.id === etape.id;
}

/** Les choix explicites, tels que rangés dans le réglage `layout.goals.replis`. */
export type Replis = Record<string, boolean>;

export function lireReplis(brut: string | null): Replis {
  if (!brut) return {};
  try {
    const v = JSON.parse(brut);
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Replis = {};
    for (const [k, b] of Object.entries(v)) if (typeof b === "boolean") out[k] = b;
    return out;
  } catch {
    return {};
  }
}

// ─── Ordre ──────────────────────────────────────────────────────────────────

/** Déplace l'élément `de` à l'index `vers` ; rend un NOUVEAU tableau. */
export function deplacer<T>(liste: readonly T[], de: number, vers: number): T[] {
  const out = [...liste];
  if (de < 0 || de >= out.length) return out;
  const [x] = out.splice(de, 1);
  out.splice(Math.max(0, Math.min(vers, out.length)), 0, x);
  return out;
}

/**
 * Où tombe un glissement : l'index d'insertion parmi les AUTRES lignes, dont on
 * connaît le milieu vertical RÉEL (mesuré dans le DOM au moment du geste, jamais
 * mémorisé au début — la liste peut défiler pendant qu'on glisse).
 *
 * ⚠️ La ligne glissée n'y figure pas : elle suit le doigt par un `transform`,
 * donc son rectangle ne dit plus où elle est dans la liste.
 */
export function indexDInsertion(milieuxDesAutres: readonly number[], y: number): number {
  return milieuxDesAutres.filter((m) => m < y).length;
}

/** `Intl` dans la langue de l'app, jamais une table maison (PIEGES § 5.2 bis). */
function nombre(n: number): string {
  return formatNumber(n, { maximumFractionDigits: 0 });
}
