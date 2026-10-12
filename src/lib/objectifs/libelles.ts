import { formatNumber, pick, t } from "../i18n";
import type { Goal } from "../types";
import type { Mesure } from "./progression";
import type { NatureLigne } from "./structure";

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

/**
 * ⭐ LE MOT D'UNE LIGNE — à un seul endroit, et d'après son CONTENU.
 *
 * « Étape », et « phase » quand elle en contient d'autres (2026-10-12, validé
 * par Antonin : « je valide »). Le pourquoi est écrit en entier au-dessus de
 * `natureDe`, dans `structure.ts`. « Sous-objectif » ne s'affiche plus nulle
 * part ; en anglais, “step” et “phase”, plus de “sub-goal”.
 *
 * ⚠️ Chaque clé EN LITTÉRAL dans son `t()` (`i18n:check` ne lit que ça).
 */
export function nomDeNature(nature: NatureLigne): string {
  switch (nature) {
    case "objectif":
      return t("Objectif");
    case "phase":
      return t("Phase");
    case "etape":
      return t("Étape");
  }
}

/** Ce qu'est cette ligne, en une phrase — pour une bulle, jamais écrit à demeure. */
export function aideDeNature(nature: NatureLigne): string {
  switch (nature) {
    case "objectif":
      return t("Ce que tu veux atteindre.");
    case "phase":
      return t("Une phase regroupe des étapes.");
    case "etape":
      return t("Une étape regroupe des tâches.");
  }
}

/**
 * « 1 étape sur 3 · 2 tâches sur 5 », « 12/50 séances », « saisi à la main » —
 * ou RIEN.
 *
 * ⭐ 2026-10-11 — LES COMPTEURS DISENT CE QU'ON VOIT. La ligne écrivait
 * « 1 étape » au-dessus de trois (seules les étapes garnies étaient comptées)
 * et « 0/1 élément » pour un objectif à deux étapes et une tâche. Le labo
 * (constat 3) : « je ne crois plus aux chiffres de l'app ». Elle dit désormais
 * combien d'étapes il y a et combien sont FAITES, puis la même chose pour ce
 * qui est rattaché — « tâches » quand ce ne sont que des tâches, « éléments »
 * dès qu'un événement s'y mêle.
 *
 * ⭐ UNE ÉTAPE VIDE SE TAIT TOUJOURS (2026-09-30 : « vide non compté, ça ne
 * sert à rien ») — mais ce n'est plus la même étape : elle porte une case à
 * cocher, qui dit tout. Rien à écrire à côté.
 *
 * ⚠️ Une PANNE, elle, reste écrite : une source supprimée ou une cible à zéro
 * ne sont pas des étapes vides, ce sont des réglages cassés qu'on ne devinerait
 * pas.
 */
export function origineEnClair(m: Mesure): string {
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
      // ⚠️ Chaque clé est écrite EN LITTÉRAL dans son `t()` : `i18n:check` ne
      // lit que les littéraux, une clé passée par une variable lui échappe.
      if (o.etapesTotal > 0) {
        const v = { n: nombre(o.etapesFaites), total: nombre(o.etapesTotal) };
        morceaux.push(auSingulier(o.etapesFaites) ? t("{n} étape sur {total}", v) : t("{n} étapes sur {total}", v));
      }
      if (o.elementsTotal > 0) {
        const v = { n: nombre(o.elementsFaits), total: nombre(o.elementsTotal) };
        const un = auSingulier(o.elementsFaits);
        morceaux.push(
          o.elementsSontDesTaches
            ? un
              ? t("{n} tâche sur {total}", v)
              : t("{n} tâches sur {total}", v)
            : un
              ? t("{n} élément sur {total}", v)
              : t("{n} éléments sur {total}", v),
        );
      }
      return morceaux.join(" · ");
    }
    case "unite":
      return "";
    case "panne":
      switch (o.raison) {
        case "cible-nulle":
          return t("cible à zéro");
        case "source-introuvable":
          return t("source introuvable");
        default:
          return "";
      }
  }
}

/**
 * « 1 étape sur 3 » : le nom s'accorde avec ce qui est FAIT, pas avec le total.
 *
 * ⚠️ Pas `tp()` : il met tout au pluriel sauf 1, ce qui est la règle anglaise
 * (“0 steps out of 3”). En français, zéro s'accorde au singulier (« 0 étape
 * sur 3 ») — et ce compteur-là s'affiche à zéro sur chaque objectif neuf.
 */
function auSingulier(faits: number): boolean {
  return faits === 1 || (faits === 0 && pick(true, false));
}

/**
 * ⭐ Un « — » PARLE : il dit ce qui est cassé et comment le réparer.
 *
 * ⚠️ Depuis le 2026-10-11, seul un RÉGLAGE CASSÉ est sans mesure. Une étape
 * vide ne l'est plus (elle se coche) : les phrases « Cette phase ne compte pas
 * encore… », « Rien à mesurer pour l'instant… » et « Aucune de ses étapes n'a
 * encore de quoi se mesurer » sont parties avec la règle qu'elles expliquaient.
 * La phrase attend dans la bulle du « — », au survol prolongé (2026-09-30).
 */
export function pourquoiSansMesure(m: Mesure): string | null {
  if (m.origine.type !== "panne") return null;
  switch (m.origine.raison) {
    case "cible-nulle":
      return t("Une cible de zéro ne se mesure pas. Donne-lui un nombre à atteindre.");
    case "source-introuvable":
      return t("L’élément qui comptait a été supprimé. Choisis une autre source, ou compte à la main.");
    case "cycle":
      return t("Cette étape est rangée sous elle-même. Range-la ailleurs.");
  }
}

// ─── Repliement ─────────────────────────────────────────────────────────────

/**
 * Le dépliage PAR DÉFAUT d'une étape, avant tout geste de l'utilisateur.
 *
 * ⭐ Une feuille de route de six phases toutes ouvertes remplit l'écran d'un
 * objectif unique. Donc : la phase EN COURS (la première, dans l'ordre, qui
 * n'est pas terminée) est dépliée ; les terminées et celles d'après sont
 * repliées et se résument en une ligne. Une étape qui n'en contient pas
 * d'autres ne déplie jamais son détail seule.
 *
 * ⚠️ `estPhase` lit le CONTENU (`natureDe`), plus `is_milestone` (2026-10-12) :
 * une « phase » stockée mais vide est une étape, elle reste repliée.
 */
export function deplieParDefaut(
  etape: Pick<Goal, "id">,
  freres: readonly Pick<Goal, "id">[],
  acheve: (id: number) => boolean,
  estPhase: (id: number) => boolean,
): boolean {
  if (!estPhase(etape.id)) return false;
  const enCours = freres.find((f) => estPhase(f.id) && !acheve(f.id));
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
