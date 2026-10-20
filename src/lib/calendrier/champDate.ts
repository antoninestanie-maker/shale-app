import { localeTag, t } from "../i18n";
import { addDays, toDateStr, weekdayOf } from "../logic";

/**
 * ⭐ LA SAISIE ET L'ÉCRITURE D'UNE DATE, au même endroit et sans DOM.
 *
 * Le champ de date de l'app (`components/ChampDate.tsx`) remplace
 * `<input type="date">` : c'est lui qui porte le calendrier à la Apple. Toute
 * sa logique vit ici, en TypeScript pur, pour être testable en
 * `environment: "node"` — le composant ne garde que le placement et les gestes,
 * comme `mentions.ts` / `mentionsDom.ts` le font déjà.
 *
 * ⚠️ LA GRILLE DU MOIS N'EST PAS RÉÉCRITE ICI. `grilleDuMois` d'`agenda.ts`
 * existe, elle est testée, et elle rend TOUJOURS six semaines du lundi au
 * dimanche — exactement ce qu'un sélecteur demande. Une seconde grille aurait
 * fini par décaler d'un jour par rapport au calendrier de l'app.
 *
 * ⚠️ TOUT EST FONCTION, rien n'est constante de module : l'ordre des champs et
 * les noms de mois dépendent de la langue, qu'on peut changer sans recharger
 * (PIEGES § 5.2).
 */

/** Les trois champs d'une date numérique, dans l'ordre où la langue les écrit. */
export type ChampDePart = "jour" | "mois" | "annee";

/**
 * L'ordre des champs dans la langue de l'app : `jour/mois/année` en français,
 * `mois/jour/année` en anglais américain.
 *
 * ⚠️ DEMANDÉ À `Intl`, jamais recopié dans une table. Une table à deux entrées
 * serait fausse dès la troisième langue, et les DEUX outils i18n resteraient au
 * vert devant elle — une table de constantes est de la donnée (PIEGES § 5.2 bis).
 */
export function ordreDesChamps(): ChampDePart[] {
  const parts = new Intl.DateTimeFormat(localeTag(), {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(new Date(2026, 10, 24, 12));
  const ordre: ChampDePart[] = [];
  for (const p of parts) {
    if (p.type === "day") ordre.push("jour");
    else if (p.type === "month") ordre.push("mois");
    else if (p.type === "year") ordre.push("annee");
  }
  // Une locale exotique pourrait n'en donner qu'une partie : on complète plutôt
  // que de rendre un ordre incomplet, dont `parserSaisie` ne saurait rien faire.
  for (const c of ["jour", "mois", "annee"] as ChampDePart[]) if (!ordre.includes(c)) ordre.push(c);
  return ordre;
}

/** Le gabarit à afficher en indice du champ : `jj/mm/aaaa`, `mm/jj/aaaa`… */
export function gabaritDeSaisie(): string {
  const lettre: Record<ChampDePart, string> = {
    jour: t("jj"),
    mois: t("mm"),
    annee: t("aaaa"),
  };
  return ordreDesChamps()
    .map((c) => lettre[c])
    .join("/");
}

/** Le jour existe-t-il vraiment ? (`2026-02-31` n'existe pas.) */
function jourReel(a: number, m: number, j: number): boolean {
  if (m < 1 || m > 12 || j < 1) return false;
  const d = new Date(a, m - 1, j, 12);
  return d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === j;
}

/**
 * ⭐ CE QUI EST TAPÉ AU CLAVIER → une date, ou `null`.
 *
 * ⚠️ C'EST LA RAISON POUR LAQUELLE LE CHAMP RESTE UN CHAMP. La roulette d'heure
 * a laissé cette leçon écrite noir sur blanc : taper « 1437 » bat deux molettes,
 * et lui retirer le clavier aurait défait le chantier de la veille. Un calendrier
 * qui ne se pointe qu'à la souris coûterait le même prix — viser le 24 mars
 * demande six clics de flèche, ou trois frappes.
 *
 * Accepte, dans l'ordre de la langue : `24/09/2026`, `24-9-26`, `24 09 2026`,
 * `24/09` (année courante), `24` (mois courant), `24092026` et `20260924`.
 *
 * ⚠️ UN JOUR IMPOSSIBLE EST REFUSÉ, il ne roule pas. `new Date(2026, 1, 31)`
 * rend le 3 mars sans rien dire : taper 31/02 sur une échéance l'aurait déplacée
 * en silence, et une date qu'on croit avoir posée est pire qu'un champ vide.
 */
export function parserSaisie(
  texte: string,
  aujourdHui: string,
  options: {
    /**
     * Une date tapée SANS année qui tombe avant ce jour passe à l'année
     * suivante (2026-10-20). Le panneau passe sa borne `min` : « 15/01 » tapé
     * en octobre dans une échéance qui ne peut pas être passée, c'est janvier
     * prochain — pas « Date hors des bornes ».
     */
    apres?: string;
  } = {},
): string | null {
  const brut = texte.trim();
  if (!brut) return null;
  const [anneeCourante, moisCourant] = aujourdHui.split("-").map(Number);
  /** Sans année écrite : l'année du jour donné, ou la suivante si `apres` l'exige. */
  const sansAnnee = (mois: number, jour: number): string | null => {
    const cette = assembler(anneeCourante, mois, jour);
    if (!cette || !options.apres || cette >= options.apres) return cette;
    return assembler(anneeCourante + 1, mois, jour) ?? cette;
  };

  /**
   * ⚠️ UNE LETTRE SUFFIT À REFUSER, et c'est la même exigence que le jour
   * impossible : ce qu'on ne sait pas lire entièrement, on ne le devine pas.
   *
   * Sans ce refus, « 12 mars » se lisait comme le 12 du mois AFFICHÉ (les
   * lettres tombaient dans les séparateurs), et « 24/12x » comme le 24
   * décembre. Vu à l'écran le 2026-09-18 : le panneau annonçait « jeudi 24
   * décembre » sur une saisie qui contenait un caractère parasite. Le panneau
   * dit ce qu'il a lu avant qu'on valide, donc le dégât restait rattrapable —
   * mais une lecture qu'on doit relire n'est pas une lecture.
   *
   * ⭐ 2026-10-20 (audit, constat 8) — SAUF UN NOM DE MOIS ENTIER. Léa a tapé
   * « 20 mai 2027 » et lu « Date illisible ». Une date écrite en toutes lettres
   * se lit ENTIÈREMENT (`lireMoisEcrit`) : ce n'est pas deviner. Tout le reste
   * avec une lettre (« 24/12x », « le 24 », « demain ») reste refusé.
   */
  if (/\p{L}/u.test(brut)) {
    const ecrit = lireMoisEcrit(brut);
    if (!ecrit) return null;
    return ecrit.annee == null
      ? sansAnnee(ecrit.mois, ecrit.jour)
      : assembler(ecrit.annee, ecrit.mois, ecrit.jour);
  }

  /**
   * ⭐ HUIT CHIFFRES COLLÉS : l'ordre de la langue, ou l'ISO — celui qui donne
   * un jour réel.
   *
   * ⚠️ BOGUE CORRIGÉ LE 2026-10-20 (audit, constat 8). Ce chemin prenait aussi
   * les saisies AVEC séparateurs (les chiffres étaient d'abord recollés), et
   * l'ISO passait en premier dès que les quatre premiers chiffres faisaient une
   * année plausible (1900 à 2200). Or « 20/02/2027 » recollé donne « 2002… » :
   * lu comme l'an 2002, mois 20 — refusé. Tous les jours du 19 au 22 tombaient
   * dans ce piège (« 19/05/2027 » = 1905, « 21/05/2027 » = 2105) ; « 20/02/27 »
   * passait, n'ayant que six chiffres. Trois utilisateurs du labo sur trois ont
   * lu « Date illisible » sur le format que le champ leur demandait.
   *
   * Maintenant : seuls huit chiffres SANS séparateur passent ici, et les deux
   * lectures sont essayées. Elles ne peuvent pas réussir toutes les deux (en
   * ISO, les chiffres 5-6 sont un mois, donc l'année « jj/mm/AAAA » commencerait
   * par 0 ou 1 — hors des années admises).
   */
  if (/^\d{8}$/.test(brut)) {
    const ordre = ordreDesChamps();
    const vals: Record<ChampDePart, number> = { jour: 0, mois: 0, annee: 0 };
    vals[ordre[0]] = Number(brut.slice(0, 2));
    vals[ordre[1]] = Number(brut.slice(2, 4));
    vals[ordre[2]] = Number(brut.slice(4, 8));
    const langue = anneePlausible(vals.annee) ? assembler(vals.annee, vals.mois, vals.jour) : null;
    if (langue) return langue;
    const a = Number(brut.slice(0, 4));
    return anneePlausible(a) ? assembler(a, Number(brut.slice(4, 6)), Number(brut.slice(6, 8))) : null;
  }
  // Six chiffres collés : jour, mois, année sur deux chiffres, dans l'ordre de
  // la langue (« 200227 »). Le pendant de « 20/02/27 », qui passait déjà.
  if (/^\d{6}$/.test(brut)) {
    const ordre = ordreDesChamps();
    const vals: Record<ChampDePart, number> = { jour: 0, mois: 0, annee: 0 };
    vals[ordre[0]] = Number(brut.slice(0, 2));
    vals[ordre[1]] = Number(brut.slice(2, 4));
    vals[ordre[2]] = Number(brut.slice(4, 6));
    return assembler(vals.annee, vals.mois, vals.jour);
  }

  const morceaux = brut.split(/[^\d]+/).filter(Boolean).map(Number);
  if (morceaux.some((n) => !Number.isFinite(n))) return null;
  const ordre = ordreDesChamps();

  if (morceaux.length === 1) {
    // Un seul nombre : le jour du mois courant. C'est le raccourci qui rend la
    // frappe plus rapide que le clic quand on reste dans le mois affiché.
    return assembler(anneeCourante, moisCourant, morceaux[0]);
  }
  if (morceaux.length === 2) {
    // Deux nombres : jour et mois dans l'ordre de la langue, année courante.
    const iJour = ordre.indexOf("jour");
    const iMois = ordre.indexOf("mois");
    const jour = morceaux[iJour < iMois ? 0 : 1];
    const mois = morceaux[iJour < iMois ? 1 : 0];
    return sansAnnee(mois, jour);
  }
  if (morceaux.length === 3) {
    // Une année en tête l'emporte sur l'ordre de la langue : personne n'écrit
    // « 2026 » en pensant à un jour.
    if (morceaux[0] > 31) return assembler(morceaux[0], morceaux[1], morceaux[2]);
    const vals: Record<ChampDePart, number> = { jour: 0, mois: 0, annee: 0 };
    ordre.forEach((c, i) => {
      vals[c] = morceaux[i];
    });
    return assembler(vals.annee, vals.mois, vals.jour);
  }
  return null;
}

const anneePlausible = (a: number) => a >= 1900 && a <= 2200;

/** Minuscule, sans accent : « Févr. » → « fevr. ». */
const sansAccent = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * Le rang (1 à 12) d'un mot de mois dans la langue de l'app, ou `null`.
 *
 * Le nom long, le nom court d'`Intl`, ou un début d'au moins trois lettres qui
 * ne désigne QU'UN mois (« sept », « fev », « juil » ; pas « jui », juin ou
 * juillet). Les noms viennent d'`Intl`, jamais d'une table (PIEGES § 5.2 bis).
 */
export function rangDuMois(mot: string): number | null {
  const m = sansAccent(mot).replace(/\.$/, "");
  if (m.length < 3) return null;
  const longs: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(2026, i, 15, 12);
    const long = sansAccent(d.toLocaleDateString(localeTag(), { month: "long" }));
    const court = sansAccent(d.toLocaleDateString(localeTag(), { month: "short" })).replace(/\.$/, "");
    if (m === long || m === court) return i + 1;
    longs.push(long);
  }
  const prefixes = longs.flatMap((l, i) => (l.startsWith(m) ? [i + 1] : []));
  return prefixes.length === 1 ? prefixes[0] : null;
}

/**
 * « 20 mai 2027 », « 1er mars », « May 20, 2027 », « 20th of May » → jour, mois,
 * année éventuelle. Rien d'autre : un mot qui n'est pas un mois, ou un mot de
 * plus, et c'est `null`.
 */
function lireMoisEcrit(brut: string): { jour: number; mois: number; annee: number | null } | null {
  const s = sansAccent(brut).replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const avant = /^(\d{1,2})(?:er|st|nd|rd|th)? (?:of )?(\p{L}+)\.?(?: (\d{4}|\d{2}))?$/u.exec(s);
  const apres = /^(\p{L}+)\.? (\d{1,2})(?:er|st|nd|rd|th)?(?: (\d{4}))?$/u.exec(s);
  const [jour, mot, annee] = avant ? [avant[1], avant[2], avant[3]] : apres ? [apres[2], apres[1], apres[3]] : [];
  if (!jour || !mot) return null;
  const mois = rangDuMois(mot);
  if (!mois) return null;
  return { jour: Number(jour), mois, annee: annee ? Number(annee) : null };
}

/** Deux chiffres d'année → le siècle courant. `26` vaut 2026, pas 1926. */
function assembler(annee: number, mois: number, jour: number): string | null {
  const a = annee < 100 ? 2000 + annee : annee;
  if (!jourReel(a, mois, jour)) return null;
  return `${pad4(a)}-${pad2(mois)}-${pad2(jour)}`;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const pad4 = (n: number) => String(n).padStart(4, "0");

/**
 * « Aujourd'hui », « Demain », « Hier » — ou `null` si la date est plus loin.
 *
 * Ces trois mots portent l'essentiel des échéances qu'on saisit, et ils se
 * lisent sans compter. Au-delà, un nom de jour est plus utile qu'un écart.
 */
export function libelleRelatif(jour: string, aujourdHui: string): string | null {
  if (jour === aujourdHui) return t("Aujourd'hui");
  if (jour === addDays(aujourdHui, 1)) return t("Demain");
  if (jour === addDays(aujourdHui, -1)) return t("Hier");
  return null;
}

/**
 * Ce que le champ AFFICHE quand une date est posée : « Demain », sinon
 * « jeu. 24 sept. », l'année n'apparaissant que si ce n'est pas l'année en cours.
 *
 * ⚠️ Midi, jamais minuit : un pas de date pris à minuit tombe la veille le jour
 * du passage à l'heure d'été (PIEGES § 4.1).
 */
export function formaterChamp(jour: string, aujourdHui: string): string {
  const relatif = libelleRelatif(jour, aujourdHui);
  if (relatif) return relatif;
  const d = new Date(`${jour}T12:00:00`);
  const memeAnnee = jour.slice(0, 4) === aujourdHui.slice(0, 4);
  return d.toLocaleDateString(localeTag(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(memeAnnee ? {} : { year: "numeric" }),
  });
}

/**
 * Une date AU FIL D'UNE LIGNE de liste : « hier », « demain », sinon
 * « jeu. 24 sept. ». Le mot relatif en minuscule — il suit un libellé, il
 * n'ouvre pas une phrase.
 */
export function dateAuFil(jour: string, aujourdHui: string): string {
  const relatif = libelleRelatif(jour, aujourdHui);
  return relatif ? relatif.toLocaleLowerCase(localeTag()) : formaterChamp(jour, aujourdHui);
}

/** Le mois et l'année en titre du calendrier : « septembre 2026 ». */
export function formaterMois(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString(localeTag(), {
    month: "long",
    year: "numeric",
  });
}

/**
 * Une date AU FIL D'UNE PHRASE : « 6 octobre », « October 6 » — l'année
 * seulement si ce n'est pas l'année en cours.
 *
 * ⚠️ Jamais « Hier » ni « Demain » ici (`formaterChamp`) : la phrase porte déjà
 * sa préposition (« prévue le … », “due on …”), et « prévue le Hier » ne se
 * lit pas. Et jamais la chaîne de la base : l'écran affichait « 2026-10-06 ».
 */
export function formaterDansPhrase(jour: string, aujourdHui: string): string {
  const d = new Date(`${jour.slice(0, 10)}T12:00:00`);
  // Ce qui n'est pas une date ressort tel quel, comme `formatHeure`.
  if (Number.isNaN(d.getTime())) return jour;
  const memeAnnee = jour.slice(0, 4) === aujourdHui.slice(0, 4);
  return d.toLocaleDateString(localeTag(), {
    day: "numeric",
    month: "long",
    ...(memeAnnee ? {} : { year: "numeric" }),
  });
}

/** La date entière, pour un lecteur d'écran : « mercredi 24 septembre 2026 ». */
export function formaterComplet(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString(localeTag(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Décale de `n` mois en GARDANT le jour, ramené à la fin du mois s'il n'existe
 * pas.
 *
 * ⚠️ `setMonth` ne suffit pas : le 31 janvier + 1 mois rend le 3 mars, parce que
 * février n'a pas de 31. En navigation de calendrier, cela fait SAUTER un mois à
 * chaque clic — un mois d'affichage qui n'est pas celui qu'on a demandé.
 */
export function moisDecale(jour: string, n: number): string {
  const [a, m, j] = jour.split("-").map(Number);
  const cible = new Date(a, m - 1 + n, 1, 12);
  const dernier = new Date(cible.getFullYear(), cible.getMonth() + 1, 0, 12).getDate();
  return toDateStr(new Date(cible.getFullYear(), cible.getMonth(), Math.min(j, dernier), 12));
}

/** Un mois proposé dans le choix des mois du calendrier. */
export interface MoisAuChoix {
  /** Où le curseur ira : le même jour, ramené à la fin du mois s'il manque. */
  jour: string;
  /** « janv. », “Jan” — le nom court de la langue de l'app. */
  libelle: string;
  /** Le mois en entier, pour un lecteur d'écran : « janvier 2027 ». */
  complet: string;
  /** Le mois entier est-il hors des bornes ? Il ne se choisit pas. */
  horsBornes: boolean;
}

/**
 * ⭐ LES DOUZE MOIS D'UNE ANNÉE, pour sauter loin sans taper sur la flèche
 * (2026-10-20, audit, constat 8 — « 4 à 7 tapes sur la flèche »).
 *
 * Toucher le titre du calendrier ramenait au mois en cours ; Léa et Yanis
 * cherchaient à aller en mai de l'an prochain. Le titre ouvre maintenant ce
 * choix, comme le calendrier du système : l'année se change d'une flèche, le
 * mois d'un toucher.
 *
 * `curseur` donne le jour à garder ; `annee` l'année affichée.
 */
export function moisAuChoix(annee: number, curseur: string, min?: string, max?: string): MoisAuChoix[] {
  const [a, m] = curseur.split("-").map(Number);
  return Array.from({ length: 12 }, (_, i) => {
    const jour = moisDecale(curseur, (annee - a) * 12 + (i + 1 - m));
    const premier = `${pad4(annee)}-${pad2(i + 1)}-01`;
    const dernier = toDateStr(new Date(annee, i + 1, 0, 12));
    const d = new Date(annee, i, 1, 12);
    return {
      jour,
      libelle: d.toLocaleDateString(localeTag(), { month: "short" }),
      complet: d.toLocaleDateString(localeTag(), { month: "long", year: "numeric" }),
      horsBornes: (!!min && dernier < min) || (!!max && premier > max),
    };
  });
}

/** Les touches qui déplacent le curseur dans la grille, et de combien de jours. */
export function pasDeTouche(touche: string): number | null {
  switch (touche) {
    case "ArrowLeft":
      return -1;
    case "ArrowRight":
      return 1;
    case "ArrowUp":
      return -7;
    case "ArrowDown":
      return 7;
    default:
      return null;
  }
}

/** Un raccourci proposé sous le calendrier. */
export interface Raccourci {
  cle: string;
  libelle: string;
  jour: string;
}

/**
 * Les trois dates qu'on pose le plus souvent, en un geste.
 *
 * ⚠️ « Lundi prochain » est TOUJOURS un lundi à venir, jamais aujourd'hui : un
 * raccourci qui rend la date du jour un lundi ne raccourcit rien, et laisse
 * croire qu'il n'a pas marché.
 */
export function raccourcis(aujourdHui: string): Raccourci[] {
  const wd = weekdayOf(aujourdHui); // 0 = dimanche
  const versLundi = wd === 1 ? 7 : (8 - wd) % 7 || 7;
  return [
    { cle: "aujourdhui", libelle: t("Aujourd'hui"), jour: aujourdHui },
    { cle: "demain", libelle: t("Demain"), jour: addDays(aujourdHui, 1) },
    { cle: "lundi", libelle: t("Lundi prochain"), jour: addDays(aujourdHui, versLundi) },
  ];
}

/**
 * « hier », « demain », sinon « mar. 22 sept. » — la date d'un champ, en
 * minuscule au fil d'une ligne. Sortie de `GoalsView` le 2026-10-20 : la vue
 * Tâches l'écrit aussi (« relance demain »).
 */
export function auFilDeLaLigne(jour: string, aujourdHui: string): string {
  const relatif = libelleRelatif(jour, aujourdHui);
  return relatif ? relatif.toLocaleLowerCase() : formaterChamp(jour, aujourdHui);
}
