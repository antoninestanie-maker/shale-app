import { DUREE_DEFAUT_MIN, finApres } from "../calendrier/agenda";
import { parserSaisie } from "../calendrier/champDate";
import { getLang, localeTag, type Lang } from "../i18n";
import { addDays, weekdayOf } from "../logic";
import { planificationDeSaisie } from "../taches";
import { prochainJourDeSemaine } from "./dates";

/**
 * ⭐ L'AJOUT RAPIDE COMPREND UNE DATE (2026-10-11).
 *
 * Le crible du labo (constat 6) : « Relancer le devis jeudi », « … vendredi »,
 * « next Thursday », « demain », « 10/15 » — quatre utilisateurs sur cinq ont
 * écrit le jour dans la phrase, et la tâche est tombée dans « Sans date », le
 * mot resté dans le titre.
 *
 * Ce fichier LIT la date dans la phrase. Il ne l'applique jamais : la ligne de
 * saisie la montre en pastille AVANT validation, retirable d'un geste (alors le
 * mot reste dans le titre — « Lire Vendredi ou la vie sauvage » doit pouvoir
 * rester entier). C'est la leçon de PIEGES § 16.1 : un champ qui interprète
 * doit rendre son interprétation avant de l'écrire.
 *
 * Ce qui est lu, dans la langue de l'app :
 *   • français : aujourd'hui, ce soir, demain, après-demain ; lundi … dimanche
 *     (« jeudi », « ce jeudi », « jeudi prochain ») ; « dans 3 jours », « dans
 *     une semaine » ; « 15/10 », « 15/10/2027 » ; « le 15 » ; « 15 octobre » ;
 *   • anglais : today, tonight, tomorrow, the day after tomorrow ; monday …
 *     sunday (« thursday », « next thursday », « on thursday ») ; « in 3 days »,
 *     « in a week » ; « 10/15 » ; « the 15th » ; « October 15 », « 15 Oct ».
 *
 * ⭐ SECONDE PASSE DU LABO (2026-10-12, constat 2) — trois choses de plus :
 *   • un jour de la semaine SUIVI D'UN NUMÉRO (« jeudi 22 », « jeudi 22
 *     octobre », "thursday the 22nd", "Thursday, October 22") désigne CE jour du
 *     mois : c'est le numéro qui fait foi, et tout le groupe quitte le titre.
 *     « Commander le chêne avant jeudi 22 » donnait « Commander le chêne 22 »
 *     au jeudi 15 — une semaine trop tôt, sans un mot ;
 *   • les petits mots qui PRÉCÈDENT la date partent avec elle : pour, avant,
 *     d'ici, le, ce ; on, by, before, for, this, next, the. Seulement COLLÉS à
 *     une date reconnue : « Payer avant le contrôle » reste entier ;
 *   • L'HEURE accolée à la date (« jeudi 14h30 », « demain à 10h », "thursday
 *     2:30pm") est lue avec elle : la tâche reçoit un créneau d'une heure.
 *
 * ⚠️ LA LANGUE DE L'APP SEULEMENT. Lire les deux vocabulaires partout ferait de
 * « Préparer le Black Friday » une tâche du vendredi dans l'app française.
 *
 * ⚠️ Les noms de jours et de mois sont DEMANDÉS À `Intl`, jamais recopiés : une
 * table en dur serait de la donnée que les outils i18n ne voient pas
 * (PIEGES § 5.2 bis). L'ordre jour/mois d'une date en chiffres vient de
 * `parserSaisie` (`champDate.ts`), qui le demande lui aussi à `Intl`.
 *
 * ⚠️ TOUT EST FONCTION : la langue peut changer sans rechargement (PIEGES § 5.2).
 *
 * Logique pure : ni DOM, ni horloge. Le jour s'injecte.
 */

/** Une date lue dans une phrase. */
export interface DateLue {
  /** 'YYYY-MM-DD'. */
  jour: string;
  /** L'heure lue avec la date — 'HH:MM', ou `null`. */
  heure: string | null;
  /** Le titre, une fois les mots de la date retirés. Jamais vide. */
  titre: string;
  /** Les mots lus, tels que tapés (« jeudi prochain ») — pour la pastille. */
  mots: string;
}

// ─── Aplatir la phrase sans en changer la longueur ───────────────────────────

/**
 * Minuscule, sans accent, apostrophe droite — et EXACTEMENT la même longueur
 * que l'original : les positions trouvées dans la phrase aplatie servent à
 * découper la phrase d'origine.
 */
function aplatir(phrase: string): string {
  let out = "";
  for (let i = 0; i < phrase.length; i++) {
    const c = phrase[i];
    if (c === "’" || c === "‘" || c === "ʼ") out += "'";
    else if (c === " " || c === " ") out += " ";
    else {
      const bas = (c.normalize("NFD")[0] ?? c).toLowerCase();
      out += bas.length === 1 ? bas : c;
    }
  }
  return out;
}

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ─── Le vocabulaire ──────────────────────────────────────────────────────────

/**
 * Les mots qui ne viennent pas d'`Intl`. Ils ne sont JAMAIS affichés (ce sont
 * des mots qu'on RECONNAÎT), donc ils ne passent pas par `t()` ; ils se
 * choisissent sur la langue de l'app, à l'appel.
 */
interface Vocabulaire {
  /** Expression (source de regex, déjà aplatie) → écart en jours. */
  relatifs: [string, number][];
  /** Ce qu'on avale DEVANT une date : « pour jeudi », "by thursday". */
  devant: string;
  /**
   * Le jour de la semaine, article et « prochain » compris : `JOUR` est
   * remplacé par l'alternance des noms. AUCUN groupe capturant ici — la même
   * expression sert de préfixe aux dates écrites (« jeudi 22 octobre »).
   */
  semaine: string;
  /** L'ordinal collé à un numéro nu : « 1er », "22nd". */
  ordinal: string;
  /** « dans 3 jours » : groupes (quantité)(unité). */
  dans: string;
  nombres: Record<string, number>;
  /** Une unité est-elle une semaine ? */
  semaines: RegExp;
  /** « le 15 » / "the 15th" : un groupe, le jour du mois. */
  quantieme: string;
  /**
   * Ce qui, juste après « le 15 », dit que ce n'était pas une date. Les deux
   * points n'en font partie que suivis d'un chiffre (« 14:30 ») : « Jeudi 22 :
   * commander le chêne » est bien une date.
   */
  pasUneDate: string;
  /** Un jour puis un mois, un mois puis un jour : groupes nommés j, m, a. */
  avecMois: string[];
  /** Devant une date en chiffres. */
  devantChiffres: string;
  /**
   * Les écritures d'une heure : groupes nommés `p` (la préposition), `h`, `m`,
   * `ap` (am / pm), `midi`. Dans l'ordre où on les essaie.
   */
  heures: string[];
  /** La langue compte-t-elle sur 24 heures ? Alors « à 2h » se lit 02:00. */
  vingtQuatre: boolean;
  /**
   * Le mot qui, juste DEVANT une heure, dit qu'elle appartient au titre : « le
   * train de 14h30 », « le 20h », "the 6pm news". Alternance de mots aplatis.
   */
  tientLHeure: string;
}

const VOCABULAIRE: Record<Lang, Vocabulaire> = {
  fr: {
    relatifs: [
      ["apres[- ]demain", 2],
      ["demain", 1],
      ["aujourd'?hui", 0],
      ["ce soir", 0],
    ],
    devant: "(?:(?:pour|avant|d'ici(?: a)?) )?",
    semaine: "(?:(?:le|ce) )?(?:JOUR)(?: prochain)?",
    ordinal: "(?:er)?",
    dans: "dans (\\d{1,3}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quinze) (jours?|semaines?)",
    nombres: { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, quinze: 15 },
    semaines: /^semaine/,
    quantieme: "le (\\d{1,2})(?:er)?",
    pasUneDate: "(?:\\s*(?:h\\b|h\\d|heures?\\b|e\\b|eme\\b|[%€$/])|[:.,]\\d)",
    avecMois: ["(?:le )?(?<j>\\d{1,2})(?:er)? (?<m>MOIS)\\.?(?: (?<a>\\d{4}))?"],
    devantChiffres: "(?:le )?",
    heures: [
      "(?<p>a |vers )?(?<h>\\d{1,2}) ?h(?: ?(?<m>\\d{2}))?",
      "(?<p>a |vers )?(?<h>\\d{1,2}):(?<m>\\d{2})",
      "(?<p>a )?(?<midi>midi)",
    ],
    vingtQuatre: true,
    tientLHeure: "de|du|des|d'|le|la|les|l'|un|une|au|aux|ce|cette",
  },
  en: {
    relatifs: [
      ["(?:the )?day after tomorrow", 2],
      ["tomorrow", 1],
      ["today", 0],
      ["tonight", 0],
    ],
    devant: "(?:(?:on|by|before|until|for) )?",
    semaine: "(?:(?:next|this) )?(?:JOUR)",
    ordinal: "(?:st|nd|rd|th)?",
    dans: "in (\\d{1,3}|a|an|one|two|three|four|five|six|seven|eight|nine|ten) (days?|weeks?)",
    nombres: { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 },
    semaines: /^week/,
    quantieme: "the (\\d{1,2})(?:st|nd|rd|th)",
    pasUneDate: "(?:\\s*(?:am|pm|a\\.m|p\\.m)\\b|[%€$/]|[:.,]\\d)",
    avecMois: [
      "(?<m>MOIS)\\.? (?<j>\\d{1,2})(?:st|nd|rd|th)?(?:,? (?<a>\\d{4}))?",
      "(?:the )?(?<j>\\d{1,2})(?:st|nd|rd|th)? (?:of )?(?<m>MOIS)\\.?(?: (?<a>\\d{4}))?",
    ],
    devantChiffres: "",
    heures: [
      "(?<p>at )?(?<h>\\d{1,2})(?::(?<m>\\d{2}))? ?(?<ap>am|pm|a\\.m\\.?|p\\.m\\.?)",
      "(?<p>at )?(?<h>\\d{1,2}):(?<m>\\d{2})",
      "(?<p>at )?(?<midi>noon)",
    ],
    vingtQuatre: false,
    tientLHeure: "the|a|an|of|from|this|that",
  },
};

/** Les sept noms de jour, aplatis, à l'index de `getDay()` (0 = dimanche). */
function nomsDesJours(): string[] {
  // Le 4 janvier 1970 est un dimanche (voir `nomCourtDuJour`, `lib/logic.ts`).
  return Array.from({ length: 7 }, (_, i) =>
    aplatir(new Date(1970, 0, 4 + i, 12).toLocaleDateString(localeTag(), { weekday: "long" })),
  );
}

/** Pour chaque mois (0 = janvier), ses écritures aplaties : la longue, la courte. */
function nomsDesMois(): string[][] {
  return Array.from({ length: 12 }, (_, m) => {
    const d = new Date(2026, m, 15, 12);
    const noms = new Set<string>();
    for (const forme of ["long", "short"] as const) {
      const nom = aplatir(d.toLocaleDateString(localeTag(), { month: forme })).replace(/\.$/, "");
      // Deux lettres ne suffisent pas à dire un mois.
      if (nom.length >= 3) noms.add(nom);
    }
    return [...noms];
  });
}

// ─── Lire ────────────────────────────────────────────────────────────────────

interface Candidat {
  jour: string;
  debut: number;
  fin: number;
}

/**
 * Ce que rend la lecture d'une occurrence :
 *   • un jour ('YYYY-MM-DD') — c'est une date ;
 *   • `null` — ça RESSEMBLAIT à une date et ce n'en est pas une lisible : le
 *     passage est interdit (voir `Trouvailles`) ;
 *   • `undefined` — ce n'était pas une date du tout, on passe sans rien interdire.
 */
type Lecture = string | null | undefined;

/** Les candidats, et les passages qui RESSEMBLAIENT à une date sans en être une. */
interface Trouvailles {
  candidats: Candidat[];
  /**
   * ⚠️ Une expression reconnue mais ILLISIBLE (« le 30 février ») interdit tout
   * ce qui la chevauche : sans cela, « le 30 » se lisait à sa place, et la
   * tâche partait au 30 du mois courant avec « février » resté dans le titre.
   * Ce qu'on ne sait pas lire entièrement, on ne le devine pas (PIEGES § 16.1).
   */
  interdits: { debut: number; fin: number }[];
}

/** Ni lettre ni chiffre de part et d'autre : « demain » n'est pas dans « lendemain ». */
const BORD_AVANT = "(^|[^\\p{L}\\p{N}])";
const BORD_APRES = "(?![\\p{L}\\p{N}])";

/** Toutes les occurrences d'une expression, avec leur position dans la phrase. */
function trouver(
  plate: string,
  source: string,
  lire: (m: RegExpExecArray, fin: number) => Lecture,
  out: Trouvailles,
): void {
  const re = new RegExp(`${BORD_AVANT}(?:${source})${BORD_APRES}`, "gu");
  let m: RegExpExecArray | null;
  while ((m = re.exec(plate))) {
    const debut = m.index + m[1].length;
    const fin = m.index + m[0].length;
    const lu = lire(m, fin);
    if (lu === null) out.interdits.push({ debut, fin });
    else if (lu) out.candidats.push({ jour: lu, debut, fin });
    // On repart juste après le début : deux expressions peuvent se chevaucher.
    re.lastIndex = debut + 1;
  }
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Le jour existe-t-il ? (`2026-02-31` n'existe pas, et ne roule pas — PIEGES § 16.1.) */
function jourReel(a: number, m: number, j: number): string | null {
  const d = new Date(a, m - 1, j, 12);
  if (d.getFullYear() !== a || d.getMonth() !== m - 1 || d.getDate() !== j) return null;
  return `${a}-${pad2(m)}-${pad2(j)}`;
}

/**
 * Un jour et un mois SANS année : la prochaine fois que cette date arrive,
 * aujourd'hui compris. « 15/01 » tapé en octobre, c'est janvier prochain — une
 * tâche qu'on note ne naît pas en retard de neuf mois.
 */
function prochaineDate(mois: number, jour: number, aujourdHui: string): string | null {
  const annee = Number(aujourdHui.slice(0, 4));
  const cetteAnnee = jourReel(annee, mois, jour);
  if (cetteAnnee && cetteAnnee >= aujourdHui) return cetteAnnee;
  // Un 29 février peut ne pas exister l'an prochain : on ne devine pas.
  return jourReel(annee + 1, mois, jour);
}

/** « le 15 » : le prochain 15, aujourd'hui compris. */
function prochainQuantieme(jour: number, aujourdHui: string): string | null {
  if (jour < 1 || jour > 31) return null;
  const [a, m] = aujourdHui.split("-").map(Number);
  // Douze mois suffisent : il y a toujours un mois de 31 jours dans l'année.
  for (let i = 0; i < 12; i++) {
    const d = new Date(a, m - 1 + i, 1, 12);
    const lu = jourReel(d.getFullYear(), d.getMonth() + 1, jour);
    if (lu && lu >= aujourdHui) return lu;
  }
  return null;
}

// ─── L'heure ─────────────────────────────────────────────────────────────────

/**
 * ⭐ UNE HEURE ÉCRITE, ou `null` si ce n'en est pas une qu'on ose lire.
 *
 * ⚠️ « 2h », « 1h30 » sont plus souvent des DURÉES que des heures (« Courir
 * jeudi 1h30 ») : sans préposition, une heure d'avant 7 h n'est pas lue. « à
 * 2h » l'est, là où l'on compte sur 24 heures ; en anglais, "at 2:30" ne dit
 * pas s'il s'agit du matin ou de l'après-midi : on ne devine pas, il faut "am"
 * ou "pm". Une heure impossible (« 25h », « 14h75 ») n'est pas une heure.
 */
function heureEcrite(g: Record<string, string | undefined>, v: Vocabulaire): string | null {
  if (g.midi) return "12:00";
  let h = Number(g.h);
  const min = g.m ? Number(g.m) : 0;
  if (min > 59) return null;
  if (g.ap) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (g.ap.startsWith("p") ? 12 : 0);
    return `${pad2(h)}:${pad2(min)}`;
  }
  if (h > 23) return null;
  if (h < 7 && !(v.vingtQuatre && g.p)) return null;
  return `${pad2(h)}:${pad2(min)}`;
}

/** L'heure écrite JUSTE APRÈS la position `fin` : « jeudi 14h30 », « jeudi, à 14h ». */
function heureApres(plate: string, fin: number, v: Vocabulaire): { heure: string; fin: number } | null {
  const suite = plate.slice(fin);
  for (const source of v.heures) {
    const m = new RegExp(`^,? (?:${source})${BORD_APRES}`, "u").exec(suite);
    if (!m) continue;
    const heure = heureEcrite(m.groups ?? {}, v);
    if (heure) return { heure, fin: fin + m[0].length };
  }
  return null;
}

/**
 * L'heure écrite JUSTE AVANT la position `debut` : « 14h30 jeudi », « à 10h
 * demain ».
 *
 * ⚠️ Devant la date, une heure peut appartenir à un NOM (« Prendre le train de
 * 14h30 jeudi », « Regarder le 20h demain ») ou être une DURÉE (« Travailler 8h
 * jeudi »). Sans sa préposition (« à », "at"), elle n'est donc pas lue quand un
 * article ou « de » la précède, ni quand elle n'a ni minutes ni am / pm — elle
 * reste dans le titre, entière.
 */
function heureAvant(plate: string, debut: number, v: Vocabulaire): { heure: string; debut: number } | null {
  const avant = plate.slice(0, debut);
  const tenue = new RegExp(`${BORD_AVANT}(?:${v.tientLHeure}) ?$`, "u");
  for (const source of v.heures) {
    const m = new RegExp(`${BORD_AVANT}(?:${source}),? $`, "u").exec(avant);
    if (!m) continue;
    const ici = m.index + m[1].length;
    const g = m.groups ?? {};
    if (!g.p && tenue.test(avant.slice(0, ici))) continue;
    // « Travailler 8h jeudi » : huit heures de travail, ou à huit heures ? Sans
    // préposition, sans minutes, sans am / pm, on ne tranche pas.
    if (!g.p && !g.m && !g.ap && !g.midi) continue;
    const heure = heureEcrite(g, v);
    if (heure) return { heure, debut: ici };
  }
  return null;
}

/**
 * Une heure SEULE dans la phrase, annoncée par sa préposition : « Appeler Paul
 * à 14h », "Call Paul at 2pm". La dernière l'emporte, comme pour les dates.
 *
 * ⚠️ La préposition est EXIGÉE : sans elle, « Regarder le 20h » et « Prendre le
 * train de 14h30 » perdraient un morceau de leur titre.
 */
function heureSeule(plate: string, v: Vocabulaire): { heure: string; debut: number; fin: number } | null {
  let trouvee: { heure: string; debut: number; fin: number } | null = null;
  for (const source of v.heures) {
    const re = new RegExp(`${BORD_AVANT}(?:${source})${BORD_APRES}`, "gu");
    let m: RegExpExecArray | null;
    while ((m = re.exec(plate))) {
      const debut = m.index + m[1].length;
      const fin = m.index + m[0].length;
      const heure = m.groups?.p ? heureEcrite(m.groups, v) : null;
      if (heure && (!trouvee || fin > trouvee.fin)) trouvee = { heure, debut, fin };
      re.lastIndex = debut + 1;
    }
  }
  return trouvee;
}

// ─── Le titre ────────────────────────────────────────────────────────────────

/**
 * Les mots de la date retirés, ce qui reste du titre.
 *
 * ⚠️ On ne retouche QUE la jointure : le reste du titre est celui que
 * l'utilisateur a tapé, espaces et ponctuation compris (« Paul : devis » garde
 * son espace française).
 */
function titreSans(phrase: string, debut: number, fin: number): string {
  let avant = phrase.slice(0, debut).replace(/\s+$/, "");
  let apres = phrase.slice(fin).replace(/^\s+/, "");
  // Une parenthèse ou un crochet qui ne contenait que la date.
  if (/[([]$/.test(avant) && /^[)\]]/.test(apres)) {
    avant = avant.slice(0, -1).replace(/\s+$/, "");
    apres = apres.slice(1).replace(/^\s+/, "");
  }
  // La ponctuation qui tenait la date au reste : « …, jeudi », « Jeudi : … ».
  if (apres === "") avant = avant.replace(/[\s,;:\-–—]+$/, "");
  if (avant === "") apres = apres.replace(/^[\s,;:.\-–—]+/, "");
  if (!avant) {
    // La date ouvrait la phrase : le mot suivant devient le premier.
    return apres ? apres[0].toLocaleUpperCase(localeTag()) + apres.slice(1) : "";
  }
  if (!apres) return avant.trim();
  return (/^[,;.!?)\]]/.test(apres) ? avant + apres : `${avant} ${apres}`).trim();
}

/**
 * ⭐ La date écrite dans une phrase, ou `null`.
 *
 * Quand la phrase en porte plusieurs, c'est la DERNIÈRE qui compte : on écrit
 * « Préparer la réunion de lundi demain », rarement l'inverse. À position
 * égale, la plus longue (« le 15 novembre » l'emporte sur « le 15 »).
 *
 * ⚠️ Un jour de la semaine désigne sa PROCHAINE occurrence, jamais aujourd'hui :
 * « jeudi » tapé un jeudi, c'est dans sept jours (pour aujourd'hui, on écrit
 * « aujourd'hui »). « jeudi » et « jeudi prochain » rendent le même jour — la
 * nuance entre les deux varie d'une personne à l'autre, et la pastille montre
 * la date retenue, jour ET numéro, avant qu'on valide.
 *
 * ⚠️ Une phrase qui n'est QUE une date n'est pas lue : il n'y aurait plus de
 * titre.
 *
 * `parDefaut` : le jour d'une ligne qui date d'office (la carte d'Aujourd'hui).
 * Une heure seule (« Appeler Paul à 14h ») s'y pose sur ce jour-là ; sans lui,
 * une heure sans date n'est pas lue — un créneau sans jour ne se pose nulle
 * part (`planificationDeSaisie`).
 */
export function lireDate(phrase: string, aujourdHui: string, parDefaut: string | null = null): DateLue | null {
  try {
    return lire(phrase, aujourdHui, parDefaut);
  } catch {
    // Une expression que le moteur ne saurait pas compiler ne doit pas casser
    // la ligne de saisie : la tâche se crée sans date, comme avant.
    return null;
  }
}

function lire(phrase: string, aujourdHui: string, parDefaut: string | null): DateLue | null {
  const plate = aplatir(phrase);
  const v = VOCABULAIRE[getLang()];
  const trouvailles: Trouvailles = { candidats: [], interdits: [] };

  for (const [mots, ecart] of v.relatifs) {
    trouver(plate, `${v.devant}${mots}`, () => addDays(aujourdHui, ecart), trouvailles);
  }

  const jours = nomsDesJours();
  const alternance = [...jours].sort((a, b) => b.length - a.length).map(echapper).join("|");
  /** « jeudi », « ce jeudi », « jeudi prochain » — sans groupe capturant. */
  const semaine = v.semaine.replace("JOUR", alternance);
  /** Le même, avec le nom du jour capturé (groupe 2 d'une occurrence). */
  const semaineLue = v.semaine.replace("(?:JOUR)", `(${alternance})`);
  /**
   * ⭐ Le jour de la semaine DEVANT une date écrite : « jeudi 22 octobre »,
   * « jeudi 15/10 », "Thursday, October 22", "thursday the 22nd". Il part du
   * titre avec elle, et c'est la date écrite qui fait foi — même si elle tombe
   * un autre jour : la pastille montre alors « ven. 23 oct. », l'écart se voit.
   */
  const jourDevant = `(?:${semaine},? )?`;

  trouver(plate, `${v.devant}${semaineLue}`, (m) => prochainJourDeSemaine(aujourdHui, jours.indexOf(m[2])), trouvailles);

  /**
   * ⭐ « jeudi 22 » : un jour de la semaine suivi d'un NUMÉRO NU (2026-10-12).
   *
   * C'est le numéro qui fait foi : le prochain 22, ce mois-ci ou le suivant.
   *
   * ⚠️ Mais un numéro nu peut aussi être une QUANTITÉ (« Acheter jeudi 2
   * baguettes », « Courir jeudi 45 minutes »). On tranche sur ce qui suit :
   *   • rien, une ponctuation ou une heure → c'est une date. Impossible
   *     (« jeudi 45 ») : on ne lit RIEN, pas même « jeudi » — on ne devine pas ;
   *   • un autre mot → c'est une date seulement si le numéro tombe bien ce
   *     jour-là (le 22 est un jeudi). Sinon c'est une quantité : « jeudi » se
   *     lit seul, comme avant, et le nombre reste dans le titre.
   */
  trouver(
    plate,
    `${v.devant}${semaineLue},? (\\d{1,2})${v.ordinal}(?!${v.pasUneDate})`,
    (m, fin) => {
      const jour = prochainQuantieme(Number(m[3]), aujourdHui);
      const suite = plate.slice(fin);
      if (/^\s*(?:$|[,;:.!?)\]–—-])/.test(suite) || heureApres(plate, fin, v)) return jour;
      return jour && weekdayOf(jour) === jours.indexOf(m[2]) ? jour : undefined;
    },
    trouvailles,
  );

  trouver(
    plate,
    v.dans,
    (m) => {
      const n = /^\d+$/.test(m[2]) ? Number(m[2]) : v.nombres[m[2]];
      if (!n) return null;
      return addDays(aujourdHui, v.semaines.test(m[3]) ? n * 7 : n);
    },
    trouvailles,
  );

  // Une date en chiffres : `parserSaisie` connaît l'ordre des champs de la
  // langue. Seule la barre oblique compte comme séparateur — « pages 10-15 »
  // et « version 1.2 » ne sont pas des dates.
  trouver(
    plate,
    `${v.devant}${jourDevant}${v.devantChiffres}(\\d{1,2}/\\d{1,2}(?:/(\\d{4}|\\d{2}))?)`,
    (m) => {
      const lu = parserSaisie(m[2], aujourdHui);
      if (!lu) return null;
      // L'année est écrite : on la respecte, même passée.
      return m[3] ? lu : prochaineDate(Number(lu.slice(5, 7)), Number(lu.slice(8, 10)), aujourdHui);
    },
    trouvailles,
  );

  trouver(
    plate,
    `${v.devant}${jourDevant}${v.quantieme}(?!${v.pasUneDate})`,
    (m) => prochainQuantieme(Number(m[2]), aujourdHui),
    trouvailles,
  );

  const mois = nomsDesMois();
  const tousLesMois = mois
    .flat()
    .sort((a, b) => b.length - a.length)
    .map(echapper)
    .join("|");
  for (const forme of v.avecMois) {
    trouver(
      plate,
      `${v.devant}${jourDevant}${forme.replace("MOIS", tousLesMois)}`,
      (m) => {
        const g = m.groups ?? {};
        const rang = mois.findIndex((noms) => noms.includes(g.m));
        if (rang < 0) return null;
        const quantieme = Number(g.j);
        return g.a ? jourReel(Number(g.a), rang + 1, quantieme) : prochaineDate(rang + 1, quantieme, aujourdHui);
      },
      trouvailles,
    );
  }

  const candidats = trouvailles.candidats.filter(
    (c) => !trouvailles.interdits.some((x) => c.debut < x.fin && x.debut < c.fin),
  );

  let jour: string;
  let debut: number;
  let fin: number;
  let heure: string | null = null;
  if (candidats.length > 0) {
    // La dernière de la phrase ; à fin égale, la plus longue.
    candidats.sort((a, b) => b.fin - a.fin || a.debut - b.debut);
    ({ jour, debut, fin } = candidats[0]);
    // ⭐ L'heure accolée à la date part avec elle : « jeudi 14h30 », « 10h demain ».
    const apres = heureApres(plate, fin, v);
    const avant = apres ? null : heureAvant(plate, debut, v);
    if (apres) ({ heure, fin } = apres);
    else if (avant) ({ heure, debut } = avant);
  } else {
    // Pas de date. Une heure seule ne se lit que sur une ligne qui date
    // d'office — et jamais à côté d'une date qu'on n'a pas su lire.
    const seule = parDefaut && trouvailles.interdits.length === 0 ? heureSeule(plate, v) : null;
    if (!seule || !parDefaut) return null;
    ({ heure, debut, fin } = seule);
    jour = parDefaut;
  }

  const titre = titreSans(phrase, debut, fin);
  if (!titre) return null;
  return { jour, heure, titre, mots: phrase.slice(debut, fin).trim() };
}

// ─── La ligne de saisie ──────────────────────────────────────────────────────

/** L'état d'une ligne d'ajout rapide. */
export interface Saisie {
  /** Ce qui est tapé. */
  texte: string;
  /** La date posée au calendrier, sans rien taper — 'YYYY-MM-DD' ou `null`. */
  choisie: string | null;
  /** Les mots dont on a retiré la pastille : ils restent dans le titre. */
  ecartee: string | null;
}

export interface SaisieResolue {
  /** Le libellé que la tâche portera. */
  titre: string;
  /** Sa date, ou `null`. */
  jour: string | null;
  /** Son heure de début ('HH:MM'), lue dans la phrase avec la date — ou `null`. */
  heure: string | null;
  /**
   * D'où vient la date : `lue` dans la phrase, `choisie` au calendrier, ou la
   * date `defaut` de la ligne (Aujourd'hui date du jour ce qu'on y ajoute).
   */
  origine: "lue" | "choisie" | "defaut" | null;
  /** Les mots lus, pour une date `lue`. */
  mots: string | null;
}

/**
 * ⭐ Ce que la ligne va créer — et ce que la pastille doit montrer.
 *
 *   • une date CHOISIE au calendrier l'emporte, et le titre reste entier ;
 *   • sinon la date LUE dans la phrase (et son heure), dont les mots quittent
 *     le titre — sauf si on a retiré sa pastille (`ecartee`) : le titre reste
 *     alors entier ;
 *   • sinon la date par DÉFAUT de la ligne, s'il y en a une.
 */
export function resoudreSaisie(saisie: Saisie, aujourdHui: string, parDefaut: string | null = null): SaisieResolue {
  const entier = saisie.texte.trim();
  if (saisie.choisie) return { titre: entier, jour: saisie.choisie, heure: null, origine: "choisie", mots: null };
  const lue = lireDate(saisie.texte, aujourdHui, parDefaut);
  if (lue && lue.mots !== saisie.ecartee) {
    return { titre: lue.titre, jour: lue.jour, heure: lue.heure, origine: "lue", mots: lue.mots };
  }
  return { titre: entier, jour: parDefaut, heure: null, origine: parDefaut ? "defaut" : null, mots: null };
}

/**
 * ⭐ Ce qu'une saisie rapide écrit dans les trois colonnes de planification.
 *
 * Une heure lue donne un créneau d'UNE HEURE — la durée par défaut du
 * Calendrier (`DUREE_DEFAUT_MIN`), celle que propose aussi la fenêtre de la
 * tâche quand on y pose un début. La frontière datée / récurrente reste tenue
 * par `planificationDeSaisie` : une heure sans jour ne s'écrit pas.
 */
export function planificationRapide(
  jour: string | null,
  heure: string | null,
): { due_date: string | null; start_at: string | null; end_at: string | null } {
  return planificationDeSaisie("none", jour ?? "", heure ?? "", heure ? finApres(heure, DUREE_DEFAUT_MIN) : "");
}
