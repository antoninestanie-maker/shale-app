import { uidDeLigne } from "./objectifs/progression";
import { estExemple } from "./onboarding/exemples";
// ⚠️ La même formule que `norm` (`lib/actions.ts`), dont `NotesView` se sert pour
// résoudre ses `[[liens]]` — prise ici parce qu'`actions.ts` importe le dépôt
// entier, et que ce fichier doit rester pur. Un test tient les deux d'accord.
import { normaliser as norm } from "./tachesVue";
import type { Note, ObjectLink } from "./types";

/**
 * « À trier » — l'onglet de la vue Notes (2026-10-11).
 *
 * ⭐ D'OÙ IL VIENT. Le labo avait proposé un module « Boîte d'entrée ». Antonin
 * l'a refusé comme module : « c'est corrigé en partie par le raccourci sur
 * téléphone, on peut rajouter un onglet dans Notes à la limite ». Ce fichier
 * est la règle de cet onglet, et RIEN d'autre : ni module, ni compteur ailleurs
 * dans l'app.
 *
 * ⭐ LE CRITÈRE, ET POURQUOI CELUI-LÀ. Rien, en base, ne distingue une note née
 * du raccourci (⌘⇧N, bouton Action de l'iPhone) d'une note née du bouton « + » :
 * les deux appellent `createNote("Nouvelle note", "")`. Marquer l'origine
 * demanderait une colonne, donc une migration, pour un onglet « à la limite ».
 * On lit donc ce qui existe déjà : une note est À TRIER tant qu'elle n'est
 * RELIÉE À RIEN et qu'on ne l'a pas GARDÉE TELLE QUELLE.
 *
 *   • « reliée » = une arête `object_links`, dans un sens ou dans l'autre
 *     (objectif, sujet, fiche, tâche, événement, autre note…), ou un lien
 *     `[[titre]]` qui aboutit à une autre note, dans un sens ou dans l'autre ;
 *   • « gardée telle quelle » = son `uid` figure dans le réglage
 *     `notes.rangees` — une liste, dans la table `settings`, sans colonne
 *     nouvelle. Le précédent est `clePositionsObjectif` (un réglage par objet).
 *
 * ⚠️ SES LIMITES, dites plutôt que cachées :
 *   • l'onglet ne sait pas si la note a été « prise à la volée » : une note
 *     écrite posément, seule dans son coin, y figure aussi — jusqu'au geste
 *     « Garder telle quelle » ;
 *   • une arête vers un objet en corbeille compte encore (la corbeille ne
 *     détruit pas les arêtes, migration 027). À la purge, trente jours plus
 *     tard, l'arête part et la note revient à trier ;
 *   • `notes.rangees` est UNE valeur, synchronisée en dernier-écrit-gagne :
 *     deux appareils qui gardent chacun une note au même moment, hors ligne,
 *     n'en retiennent qu'une. L'autre reparaît dans l'onglet ; rien n'est perdu.
 *
 * ⚠️ CE FICHIER NE TOUCHE NI À LA BASE NI AU DOM : il se teste seul.
 */

/** La clé du réglage. ⚠️ Synchronisée : ni `layout.`, ni rien qui ressemble à un secret. */
export const CLE_NOTES_RANGEES = "notes.rangees";

/** Les liens `[[titre]]` d'un corps de note. Source unique : `NotesView` s'en sert aussi. */
export const WIKI_RE = /\[\[([^\]]+)\]\]/g;

/** Pourquoi une note est, ou n'est pas, dans l'onglet. */
export type EtatDeTri =
  /** Reliée à rien, pas gardée : elle est dans l'onglet. */
  | "a-trier"
  /** Reliée à rien, mais gardée telle quelle — le geste se défait. */
  | "gardee"
  /** Reliée à quelque chose. */
  | "reliee"
  /** Contenu de départ créé par l'app : personne ne l'a « noté à la volée ». */
  | "exemple";

/**
 * La liste des notes gardées, relue du réglage.
 *
 * Tolérante : une valeur absente, illisible, ou écrite par une version future
 * dans une autre forme se lit « aucune ». Le pire qui arrive est qu'une note
 * reparaisse dans l'onglet — jamais qu'une erreur empêche d'ouvrir la vue.
 */
export function lireRangees(brut: string | null | undefined): Set<string> {
  if (!brut) return new Set();
  try {
    const v: unknown = JSON.parse(brut);
    if (!Array.isArray(v)) return new Set();
    return new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0));
  } catch {
    return new Set();
  }
}

/** La même liste, telle qu'on l'écrit. Triée : deux appareils d'accord écrivent la même valeur. */
export function ecrireRangees(rangees: ReadonlySet<string>): string {
  return JSON.stringify([...rangees].sort());
}

/** La liste avec `uid` en plus (`gardee`) ou en moins. Ne modifie pas l'entrée. */
export function basculerRangee(rangees: ReadonlySet<string>, uid: string, gardee: boolean): Set<string> {
  const suivant = new Set(rangees);
  if (gardee) suivant.add(uid);
  else suivant.delete(uid);
  return suivant;
}

/** Les titres cités par `[[…]]` dans un corps, normalisés (casse et accents). */
function titresCites(corps: string): Set<string> {
  const cites = new Set<string>();
  for (const m of corps.matchAll(WIKI_RE)) {
    const titre = norm(m[1].trim());
    if (titre) cites.add(titre);
  }
  return cites;
}

/**
 * Les uid des notes reliées à quelque chose.
 *
 * ⚠️ UNE PIÈCE JOINTE NE RANGE PAS UNE NOTE. Déposer un PDF dans une note écrit
 * une arête `note → file` (migration 028) ; la note n'en est pas moins seule.
 * Les arêtes dont l'autre bout est un fichier sont donc ignorées.
 */
function uidsRelies(notes: readonly Note[], liens: readonly ObjectLink[]): Set<string> {
  const relies = new Set<string>();

  for (const l of liens) {
    if (l.from_kind === "file" || l.to_kind === "file") continue;
    if (l.from_kind === "note") relies.add(l.from_uid);
    if (l.to_kind === "note") relies.add(l.to_uid);
  }

  // Les liens `[[titre]]` : ils ne passent pas par `object_links`, mais la vue
  // les affiche déjà comme des liens (« référencée par »). Une note qui en
  // porte un, ou qui en reçoit un, n'est pas seule.
  const parTitre = new Map<string, string[]>();
  for (const n of notes) {
    const cle = norm(n.title.trim());
    if (!cle) continue;
    const uid = uidDeLigne("note", n);
    const deja = parTitre.get(cle);
    if (deja) deja.push(uid);
    else parTitre.set(cle, [uid]);
  }
  for (const n of notes) {
    const uid = uidDeLigne("note", n);
    for (const titre of titresCites(n.body ?? "")) {
      // ⚠️ Se citer soi-même ne relie à rien — même règle que `areteValide`.
      const cibles = (parTitre.get(titre) ?? []).filter((u) => u !== uid);
      if (cibles.length === 0) continue;
      relies.add(uid);
      for (const c of cibles) relies.add(c);
    }
  }

  return relies;
}

/**
 * L'état de chaque note, par `id`.
 *
 * `notes` sont les notes VIVANTES (pas celles de la corbeille) ; `liens`, les
 * arêtes qui touchent une note ; `rangees`, les uid gardés tels quels.
 */
export function etatsDeTri(
  notes: readonly Note[],
  liens: readonly ObjectLink[],
  rangees: ReadonlySet<string>,
): Map<number, EtatDeTri> {
  const relies = uidsRelies(notes, liens);
  const etats = new Map<number, EtatDeTri>();
  for (const n of notes) {
    const uid = uidDeLigne("note", n);
    // L'ordre compte : un exemple relié reste un exemple (il ne se trie pas),
    // et une note reliée n'est plus « gardée » — elle est simplement rangée.
    if (estExemple(n)) etats.set(n.id, "exemple");
    else if (relies.has(uid)) etats.set(n.id, "reliee");
    else if (rangees.has(uid)) etats.set(n.id, "gardee");
    else etats.set(n.id, "a-trier");
  }
  return etats;
}

/** Les notes de l'onglet, dans l'ordre où on les a reçues. */
export function notesATrier(
  notes: readonly Note[],
  liens: readonly ObjectLink[],
  rangees: ReadonlySet<string>,
): Note[] {
  const etats = etatsDeTri(notes, liens, rangees);
  return notes.filter((n) => etats.get(n.id) === "a-trier");
}
