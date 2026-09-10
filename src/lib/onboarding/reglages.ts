/**
 * Ce que l'accueil du premier démarrage demande, et où ça se range.
 *
 * ⭐ LA RÈGLE DU CHANTIER : chaque question posée configure quelque chose.
 * Une réponse qui ne branche rien n'a pas à être demandée. Les trois réponses
 * de ce fichier alimentent, toutes les trois :
 *
 *   • le REPLI du profil de disponibilité (`calendrier/disponibilite.ts`) —
 *     donc les créneaux libres proposés par le calendrier, le point de départ
 *     avant que l'apprentissage des heures réellement tenues prenne le relais ;
 *   • la CAPACITÉ d'une journée, donc la détection de journée surchargée
 *     (`calendrier/charge.ts`) ;
 *   • la GRILLE de la semaine, et par elle le plafond du curseur de clôture.
 *
 * ⚠️ CE FICHIER NE TOUCHE PAS À LA BASE et n'affiche rien. Il est testable sans
 * SQLite, sans Tauri et sans React — même posture que `lib/liens.ts`.
 *
 * ⚠️ CONVENTION DES JOURS : `getDay()` de JavaScript, **0 = dimanche**, comme
 * partout ailleurs dans le dépôt (le dialecte de récurrence de la migration 020
 * l'emploie déjà, cf. `parseRecurrence`). L'AFFICHAGE, lui, commence le lundi —
 * c'est `ORDRE_SEMAINE` de `logic.ts` qui s'en charge, et PIEGES § 4.2 dit
 * pourquoi les deux ne doivent jamais être confondus.
 */

/** Une plage horaire répétée sur certains jours de la semaine. */
export interface Plage {
  /** Jours concernés, convention `getDay()` (0 = dimanche). */
  jours: number[];
  /** Début, 'HH:MM' local. */
  debut: string;
  /** Fin, 'HH:MM' local. Peut être ANTÉRIEURE à `debut` : la plage franchit minuit. */
  fin: string;
}

/** Un bloc contraint récurrent — trajet, cours, garde. Il porte un nom. */
export interface BlocContraint extends Plage {
  label: string;
}

/**
 * Les réponses de l'accueil, telles qu'elles vivent dans `settings`.
 *
 * ⚠️ Le sommeil est décrit par ses BORNES (coucher → lever), jamais par une
 * durée. C'est délibéré et ça vaut pour toute l'app : une durée invite à être
 * réduite, une heure de coucher invite à être tenue. Rien, nulle part, ne doit
 * proposer de dormir moins pour récupérer des heures.
 */
export interface ReglagesHoraires {
  /** Heure de lever habituelle, 'HH:MM'. */
  lever: string;
  /** Heure de coucher habituelle, 'HH:MM'. */
  coucher: string;
  /** Jours et horaires de travail. */
  travail: Plage;
  /** Trajets et autres blocs contraints récurrents. Peut être vide. */
  contraints: BlocContraint[];
}

/**
 * ⭐ Ce que vaut un accueil entièrement SKIPPÉ.
 *
 * Ces valeurs ne sont pas choisies pour être « raisonnables » dans l'abstrait :
 * `travail` reproduit EXACTEMENT le repli qui existait avant ce chantier
 * (9 h – 18 h, du lundi au vendredi — décidé par Antonin le 2026-09-02 et
 * inscrit dans `disponibilite.ts`). Un skip complet laisse donc l'app dans le
 * comportement qu'elle avait déjà, ni dégradé ni deviné.
 *
 * Le lever et le coucher, eux, n'avaient aucun équivalent : 07:00 / 23:00 est
 * un défaut affiché comme tel à l'écran, et il ne sert qu'à dessiner la grille.
 */
export const REGLAGES_PAR_DEFAUT: ReglagesHoraires = {
  lever: "07:00",
  coucher: "23:00",
  travail: { jours: [1, 2, 3, 4, 5], debut: "09:00", fin: "18:00" },
  contraints: [],
};

// ─── Clés de `settings` ──────────────────────────────────────────────────────

/**
 * ⚠️ Ces clés sont SYNCHRONISÉES sans que personne ne les inscrive nulle part :
 * `sync/scope.ts` synchronise `settings` en entier et n'exclut qu'une liste
 * courte. Deux conditions à ne pas violer si on en ajoute :
 *
 *   • ne jamais préfixer `sync.` (exclu — c'est la plomberie du moteur) ;
 *   • ne jamais faire ressembler la clé à un secret (`ressembleAUnSecret`
 *     refuse `key`, `token`, `secret`, `password`, `apikey`).
 */
export const CLE_ACCUEIL_FAIT = "onboarding.done_at";
export const CLE_LEVER = "horaires.lever";
export const CLE_COUCHER = "horaires.coucher";
export const CLE_TRAVAIL = "horaires.travail";
export const CLE_CONTRAINTS = "horaires.contraints";
export const CLE_EXEMPLES_CREES = "exemples.crees_at";

/** Les clés que le REJEU depuis les Réglages écrase, et elles seules. */
export const CLES_HORAIRES: readonly string[] = [
  CLE_LEVER,
  CLE_COUCHER,
  CLE_TRAVAIL,
  CLE_CONTRAINTS,
];

// ─── Lecture et écriture, en logique pure ────────────────────────────────────

/** Une paire clé/valeur telle que `settings` la stocke. */
export type Reglages = Readonly<Record<string, string | null | undefined>>;

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Vrai si `valeur` est une heure 'HH:MM' valide. */
export function estHeure(valeur: unknown): valeur is string {
  return typeof valeur === "string" && HHMM.test(valeur);
}

/** Minutes depuis minuit, ou `null` si l'heure est illisible. */
export function minutesDeHeure(valeur: unknown): number | null {
  if (!estHeure(valeur)) return null;
  return Number(valeur.slice(0, 2)) * 60 + Number(valeur.slice(3, 5));
}

const joursValides = (v: unknown): number[] | null => {
  if (!Array.isArray(v)) return null;
  const propres = v.filter((j) => Number.isInteger(j) && j >= 0 && j <= 6) as number[];
  return [...new Set(propres)].sort((a, b) => a - b);
};

function plageValide(v: unknown): Plage | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const jours = joursValides(o.jours);
  if (!jours || !estHeure(o.debut) || !estHeure(o.fin)) return null;
  return { jours, debut: o.debut, fin: o.fin };
}

/**
 * Les réglages relus depuis `settings`.
 *
 * ⚠️ TOLÉRANT PAR CONSTRUCTION, et ce n'est pas de la négligence : ces lignes
 * arrivent aussi par SYNCHRONISATION, écrites par une version de l'app qu'on ne
 * connaît pas — plus ancienne, plus récente, ou interrompue au milieu de son
 * accueil. Une valeur illisible retombe sur son défaut, champ par champ, plutôt
 * que de faire tomber tout le bloc : perdre l'heure de coucher parce qu'un
 * trajet est mal formé donnerait une grille fausse sans rien dire.
 */
export function lireReglages(reglages: Reglages): ReglagesHoraires {
  const lever = estHeure(reglages[CLE_LEVER]) ? reglages[CLE_LEVER]! : REGLAGES_PAR_DEFAUT.lever;
  const coucher = estHeure(reglages[CLE_COUCHER])
    ? reglages[CLE_COUCHER]!
    : REGLAGES_PAR_DEFAUT.coucher;

  let travail = REGLAGES_PAR_DEFAUT.travail;
  const bruTravail = analyser(reglages[CLE_TRAVAIL]);
  const lu = plageValide(bruTravail);
  if (lu) travail = lu;

  const contraints: BlocContraint[] = [];
  const bruContraints = analyser(reglages[CLE_CONTRAINTS]);
  if (Array.isArray(bruContraints)) {
    for (const brut of bruContraints) {
      const plage = plageValide(brut);
      if (!plage) continue;
      const label = (brut as Record<string, unknown>).label;
      contraints.push({ ...plage, label: typeof label === "string" ? label : "" });
    }
  }

  return { lever, coucher, travail, contraints };
}

function analyser(valeur: string | null | undefined): unknown {
  if (typeof valeur !== "string" || valeur === "") return null;
  try {
    return JSON.parse(valeur);
  } catch {
    return null;
  }
}

/** Les écritures de `settings` que valent ces réponses. Clé → valeur. */
export function ecrireReglages(r: ReglagesHoraires): Record<string, string> {
  return {
    [CLE_LEVER]: r.lever,
    [CLE_COUCHER]: r.coucher,
    [CLE_TRAVAIL]: JSON.stringify(r.travail),
    [CLE_CONTRAINTS]: JSON.stringify(r.contraints),
  };
}

// ─── Ce que les réglages valent pour le calendrier ───────────────────────────

/**
 * ⭐ Le REPLI du profil de disponibilité, dérivé des heures déclarées.
 *
 * C'est LE point de branchement du chantier : avant lui, `disponibilite.ts`
 * codait en dur « 9 h – 18 h, du lundi au vendredi » pour tout le monde, et ses
 * deux appelants ne lui passaient aucune option. L'accueil ne fait pas
 * apparaître un nouveau moteur — il remplit celui qui existait avec ce que la
 * personne vient de dire.
 *
 * ⚠️ Les bornes sont des HEURES ENTIÈRES, parce que le profil raisonne par
 * heure. Le début est arrondi vers le BAS et la fin vers le HAUT : une plage
 * 09:30 – 17:30 rend 9 → 18. Arrondir vers l'intérieur retirerait à quelqu'un
 * deux heures qu'il vient de déclarer travailler, et les créneaux proposés
 * cesseraient de couvrir le début et la fin de ses journées.
 */
export function repliDuTravail(r: ReglagesHoraires): {
  debut: number;
  fin: number;
  jours: number[];
} {
  const debutMin = minutesDeHeure(r.travail.debut) ?? 9 * 60;
  const finMin = minutesDeHeure(r.travail.fin) ?? 18 * 60;
  const debut = Math.floor(debutMin / 60);
  // Une plage de travail qui franchit minuit (équipe de nuit) ne peut pas être
  // décrite par une borne haute plus petite que la borne basse : le profil
  // raisonne à l'intérieur d'une journée. On la borne à 24 h, ce qui donne « du
  // début du travail à la fin de la journée » — faux d'une poignée d'heures,
  // mais jamais vide, là où `fin < debut` ne proposerait plus AUCUN créneau.
  const fin = finMin <= debutMin ? 24 : Math.ceil(finMin / 60);
  return { debut, fin, jours: [...r.travail.jours].sort((a, b) => a - b) };
}
