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
export function parserSaisie(texte: string, aujourdHui: string): string | null {
  const brut = texte.trim();
  if (!brut) return null;
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
   */
  if (/\p{L}/u.test(brut)) return null;
  const [anneeCourante, moisCourant] = aujourdHui.split("-").map(Number);

  // Une suite de huit chiffres est lue telle quelle : ni la langue ni les
  // séparateurs n'entrent en jeu. `2026-09-24` arrive ici par ce chemin.
  const chiffres = brut.replace(/\D/g, "");
  if (/^\d{8}$/.test(chiffres)) {
    const enAnneeDAbord = Number(chiffres.slice(0, 4));
    // Quatre chiffres plausibles en tête : c'est une date ISO, le seul format
    // où l'année ouvre. Sinon, l'année ferme, dans l'ordre de la langue.
    if (enAnneeDAbord >= 1900 && enAnneeDAbord <= 2200) {
      const a = enAnneeDAbord;
      const m = Number(chiffres.slice(4, 6));
      const j = Number(chiffres.slice(6, 8));
      return jourReel(a, m, j) ? `${pad4(a)}-${pad2(m)}-${pad2(j)}` : null;
    }
    const ordre = ordreDesChamps();
    const vals: Record<ChampDePart, number> = { jour: 0, mois: 0, annee: 0 };
    vals[ordre[0]] = Number(chiffres.slice(0, 2));
    vals[ordre[1]] = Number(chiffres.slice(2, 4));
    vals[ordre[2]] = Number(chiffres.slice(4, 8));
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
    return assembler(anneeCourante, mois, jour);
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

/** Le mois et l'année en titre du calendrier : « septembre 2026 ». */
export function formaterMois(jour: string): string {
  return new Date(`${jour}T12:00:00`).toLocaleDateString(localeTag(), {
    month: "long",
    year: "numeric",
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
