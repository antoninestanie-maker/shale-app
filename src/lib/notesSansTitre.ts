import type { Note } from "./types";

/**
 * « Sans titre » — le petit onglet de la vue Notes (2026-10-12).
 *
 * ⭐ D'OÙ IL VIENT. La veille, un onglet « À trier » montrait les notes reliées
 * à rien. Antonin l'a refusé : « Pour le "à trier", je ne suis pas d'accord. Je
 * pense que oui, toutes les notes sans titre peuvent avoir un petit onglet à
 * part. » Ce qu'il veut retrouver, c'est la note jetée à la volée (⌘⇧N, le
 * raccourci de l'iPhone, le bouton « + ») à laquelle il n'a pas donné de nom.
 *
 * ⭐ LE CRITÈRE : LE TITRE, ET RIEN D'AUTRE. Une note est sans titre quand son
 * titre est vide, ou resté tel que l'app l'a écrit. On en sort en donnant un
 * titre — aucun réglage, aucune arête, aucune lecture en base : tout se lit
 * dans la note elle-même.
 *
 * ⚠️ CE QUE L'APP ÉCRIT RÉELLEMENT, relevé dans le code le 2026-10-12 :
 *   • `createNote(t("Nouvelle note"), "")` — ⌘⇧N et le raccourci de l'iPhone
 *     (`App.tsx`), la palette (`actions.ts`), le bouton « + » (`NotesView`).
 *     Le titre est TRADUIT À LA CRÉATION puis stocké : « Nouvelle note » si
 *     l'app était en français ce jour-là, « New note » si elle était en
 *     anglais. Il ne change plus ensuite, quelle que soit la langue ;
 *   • `TITRE_SI_VIDE` — écrit par l'enregistrement de `NotesView` quand on
 *     efface le titre. Toujours en français, quelle que soit la langue.
 * Les deux langues sont donc reconnues EN MÊME TEMPS, sans regarder la langue
 * du jour : une note créée en anglais reste « sans titre » une fois l'app
 * repassée en français, et une note venue d'un autre appareil aussi.
 * Un test (`notesSansTitre.test.ts`) lit `i18n/en.ts` et casse si une
 * traduction change sans que cette liste suive.
 *
 * ⚠️ SES LIMITES, dites plutôt que cachées :
 *   • quelqu'un qui intitule VRAIMENT sa note « Nouvelle note » la retrouve
 *     dans l'onglet. On ne peut pas distinguer ce titre-là du titre d'office
 *     sans une colonne de plus ;
 *   • si une traduction de ces titres change un jour, l'ANCIENNE doit rester
 *     dans `TITRES_D_OFFICE` : des notes la portent déjà en base.
 *
 * ⚠️ CE FICHIER NE TOUCHE NI À LA BASE NI AU DOM : il se teste seul.
 */

/** Ce que l'enregistrement écrit quand le titre a été effacé. Source unique : `NotesView` s'en sert. */
export const TITRE_SI_VIDE = "Sans titre";

/**
 * Les titres que l'app pose d'elle-même, dans les deux langues.
 *
 * « Untitled » n'est écrit par aucune version à ce jour ; il est là parce que
 * c'est la traduction de `TITRE_SI_VIDE`, et qu'un correctif qui se mettrait à
 * traduire ce titre l'écrirait.
 */
const TITRES_D_OFFICE: readonly string[] = ["Nouvelle note", "New note", TITRE_SI_VIDE, "Untitled"];

/**
 * Ce que « Dupliquer » ajoute au titre (`t("{titre} (copie)")`), dans les deux
 * langues. La copie d'une note sans titre n'a pas reçu de titre non plus.
 */
const MARQUES_DE_COPIE: readonly string[] = ["(copie)", "(copy)"];

const D_OFFICE = new Set(TITRES_D_OFFICE.map((x) => x.toLowerCase()));

/**
 * La note a-t-elle un titre que quelqu'un lui a donné ?
 *
 * Vide ou fait d'espaces : non. Égal à un titre d'office, sans se soucier de
 * la casse ni des espaces autour : non. Le CONTENU ne compte pas — une note
 * pleine de texte et sans titre est sans titre, une note titrée et vide ne
 * l'est pas.
 */
export function estSansTitre(titre: string | null | undefined): boolean {
  let nu = (titre ?? "").trim().toLowerCase();
  // « Nouvelle note (copie) (copie) » : la copie d'une copie. Et « (copie) »
  // tout seul : la copie d'une note au titre vide.
  for (let retire = true; retire; ) {
    retire = false;
    for (const m of MARQUES_DE_COPIE) {
      const avant = nu.slice(0, -m.length);
      if (nu.endsWith(m) && (avant === "" || avant.endsWith(" "))) {
        nu = avant.trimEnd();
        retire = true;
      }
    }
  }
  return nu === "" || D_OFFICE.has(nu);
}

/** Les notes de l'onglet, dans l'ordre où on les a reçues. */
export function notesSansTitre<N extends Pick<Note, "title">>(notes: readonly N[]): N[] {
  return notes.filter((n) => estSansTitre(n.title));
}

/** Ce qu'une ligne de la liste montre à la place du titre. */
export type LibelleDeLigne =
  /** La note a un titre : on le montre. */
  | { genre: "titre"; texte: string }
  /** Sans titre, mais écrite : le début de son texte la désigne. */
  | { genre: "extrait"; texte: string }
  /** Sans titre et sans un mot, mais pas vide : une image, un dessin, une carte, une pièce jointe. */
  | { genre: "sans-mots" }
  /** Sans titre et sans rien dedans. */
  | { genre: "vide" };

/** Assez pour remplir une ligne de la liste ; le reste est coupé à l'affichage. */
const LONGUEUR_EXTRAIT = 90;

/** Les balises qui portent un contenu sans texte. Une note qui en a une n'est pas « vide ». */
const OBJET_SANS_TEXTE = /<(img|svg|canvas|video|audio|figure|object|iframe)\b/i;

/**
 * ⭐ CE QUI RÈGLE « DIX "NOUVELLE NOTE" D'AFFILÉE ». Avant, la liste montrait le
 * titre stocké : dix notes rapides y étaient dix lignes identiques, que seule
 * l'ouverture distinguait. Une note sans titre est maintenant désignée par le
 * début de son texte.
 *
 * `textePlat` est le texte de la note SANS balisage — `plainText(note.body)`,
 * que la vue calcule : il lui faut le DOM, et ce fichier n'en a pas.
 * `corps` est le HTML tel qu'il est stocké, lu seulement pour savoir si une
 * note sans un mot contient quand même quelque chose.
 */
export function libelleDeLigne(
  titre: string | null | undefined,
  textePlat: string,
  corps: string | null | undefined,
): LibelleDeLigne {
  if (!estSansTitre(titre)) return { genre: "titre", texte: (titre ?? "").trim() };
  const texte = textePlat.replace(/\s+/g, " ").trim();
  if (texte) {
    // Coupé sur des CARACTÈRES entiers : un `slice` nu trancherait un emoji
    // ou une lettre accentuée composée en deux.
    const lettres = Array.from(texte);
    return {
      genre: "extrait",
      texte: lettres.length > LONGUEUR_EXTRAIT ? `${lettres.slice(0, LONGUEUR_EXTRAIT).join("").trimEnd()}…` : texte,
    };
  }
  return OBJET_SANS_TEXTE.test(corps ?? "") ? { genre: "sans-mots" } : { genre: "vide" };
}

/**
 * Une note NEUVE : sans titre ET sans rien dedans — celle que ⌘⇧N, le « + »,
 * la palette et le raccourci de l'iPhone viennent de créer.
 *
 * Elle reçoit le curseur dans son TEXTE (2026-10-12) : avant, il fallait
 * cliquer avant d'écrire, ce qui défait une note prise à la volée. Un corps
 * qui ne porte que des balises vides (« <p><br></p> ») compte pour vide ; une
 * image, un croquis ou une carte, non.
 */
export function estNoteNeuve(titre: string, corps: string): boolean {
  if (!estSansTitre(titre)) return false;
  if (/<(img|figure|svg)\b/i.test(corps)) return false;
  return corps.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}

const ENTITES: Readonly<Record<string, string>> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/**
 * Le début du TEXTE d'un corps HTML, sans DOM — pour nommer une note sans
 * titre là où l'on n'a pas `plainText` sous la main : la corbeille, le bandeau
 * de suppression (2026-10-20, audit complet : « la corbeille nomme ainsi toute
 * note sans titre », savoir-10). Trois notes rapides jetées y étaient trois
 * lignes « Nouvelle note » identiques.
 *
 * Les blocs sans texte lisible (carte mentale, croquis : `<figure>`, `<svg>`)
 * sont sautés en entier — leurs libellés internes ne sont pas « le début de la
 * note ». Rend une chaîne vide s'il ne reste pas un mot.
 */
export function extraitDuCorps(corps: string | null | undefined, longueur = LONGUEUR_EXTRAIT): string {
  if (!corps) return "";
  const texte = corps
    .replace(/<(figure|svg|style|script)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    // Un corps lu TRONQUÉ (la corbeille n'en lit que le début) peut finir au
    // milieu d'une balise — une image en `data:` surtout : on ne montre pas sa
    // base64.
    .replace(/<[^>]*$/, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") {
        const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
      }
      return ENTITES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
  const lettres = Array.from(texte);
  return lettres.length > longueur ? `${lettres.slice(0, longueur).join("").trimEnd()}…` : texte;
}
