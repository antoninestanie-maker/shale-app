import type { LinkKind, LinkOrigin, ObjectLink } from "./types";

/**
 * Les liaisons entre objets — logique pure.
 *
 * SOURCE UNIQUE de ce qu'est une arête valide, de son identité, et de ce qui la
 * rend visible. La table `object_links` (migration 020) et ce fichier disent la
 * même chose, chacun de son côté de la synchronisation ; un test compare les
 * deux plutôt que de faire confiance à la ressemblance.
 *
 * ⚠️ CE FICHIER NE TOUCHE PAS À LA BASE. Il est testable sans SQLite, sans
 * Tauri et sans réseau — c'est ce qui permet aux chantiers Calendrier et
 * Liaisons de s'appuyer dessus sans avoir à monter quoi que ce soit.
 */

/** Les sept familles d'objets qu'une arête peut relier. */
export const LINK_KINDS: readonly LinkKind[] = [
  "note",
  "knowledge",
  "task",
  "goal",
  "event",
  "trade",
  "object",
] as const;

/**
 * Vers quelle table pointe chaque famille.
 *
 * ⚠️ C'est la seule traduction possible : `object_links` ne peut pas déclarer
 * de clé étrangère SQL, puisque la table visée dépend d'une AUTRE colonne
 * (§ 5 de la migration 020). Ce dictionnaire remplace donc le `vers` de
 * `sync/fk.ts`, avec cette différence essentielle qu'il sert à LIRE, jamais à
 * traduire un identifiant local — les extrémités sont déjà des `uid`.
 */
export const TABLE_DE_KIND: Readonly<Record<LinkKind, string>> = {
  note: "notes",
  knowledge: "knowledge_entries",
  task: "tasks",
  goal: "goals",
  event: "calendar_events",
  trade: "trades",
  object: "objects",
};

const KINDS = new Set<string>(LINK_KINDS);

export function estKindConnu(valeur: string): valeur is LinkKind {
  return KINDS.has(valeur);
}

/** Une extrémité d'arête : une famille, et l'`uid` d'une ligne de cette famille. */
export interface Extremite {
  kind: LinkKind;
  uid: string;
}

/**
 * L'identité d'une arête, DÉRIVÉE de ses deux extrémités.
 *
 * ⚠️ DOIT REPRODUIRE MOT POUR MOT le trigger `object_links_uid` de la migration
 * 020. Les deux appareils calculent alors le même uid sans s'être parlé : la
 * même mention tapée des deux côtés ne fait qu'une ligne côté serveur, et le
 * conflit se résout tout seul. S'ils divergeaient, on obtiendrait deux lignes
 * serveur pour un seul fait, qui se battraient sans jamais converger — c'est le
 * mode d'échec que la migration 015 décrit, et un test le garde ici.
 *
 * `origin` n'entre PAS dans la dérivation : rattacher à la main une note déjà
 * mentionnée ne doit pas créer une seconde arête.
 */
export function uidArete(de: Extremite, vers: Extremite): string {
  return `ol:${de.kind}:${de.uid}:${vers.kind}:${vers.uid}`;
}

/**
 * Une arête a-t-elle un sens ?
 *
 * Le lien d'un objet vers LUI-MÊME est refusé : il n'apporte rien, et il
 * ferait apparaître chaque note dans son propre panneau « Mentionné dans ».
 * Une mention de soi dans son propre texte est d'ailleurs le cas le plus
 * fréquent — on cite le titre de la note qu'on écrit.
 */
export function areteValide(de: Extremite, vers: Extremite): boolean {
  if (!estKindConnu(de.kind) || !estKindConnu(vers.kind)) return false;
  if (!de.uid || !vers.uid) return false;
  return !(de.kind === vers.kind && de.uid === vers.uid);
}

/** Une arête telle qu'on la propose à l'écriture, avant qu'elle n'ait un `id`. */
export interface AreteVoulue {
  from_kind: LinkKind;
  from_uid: string;
  to_kind: LinkKind;
  to_uid: string;
  origin: LinkOrigin;
}

/**
 * Ce qu'il faut vraiment écrire pour un texte donné : les arêtes valides, sans
 * doublon.
 *
 * Deux mentions de la même note dans le même paragraphe ne font qu'UNE arête —
 * sinon le panneau « Mentionné dans » afficherait deux fois la même ligne, et
 * l'index unique de la table refuserait la seconde écriture de toute façon.
 * Autant que l'appelant n'ait jamais à gérer cette erreur.
 *
 * La PREMIÈRE occurrence gagne, y compris pour `origin` : une mention tapée
 * puis rattachée à la main reste une mention.
 */
export function normaliserAretes(voulues: readonly AreteVoulue[]): AreteVoulue[] {
  const vues = new Set<string>();
  const gardees: AreteVoulue[] = [];
  for (const a of voulues) {
    const de = { kind: a.from_kind, uid: a.from_uid };
    const vers = { kind: a.to_kind, uid: a.to_uid };
    if (!areteValide(de, vers)) continue;
    const cle = uidArete(de, vers);
    if (vues.has(cle)) continue;
    vues.add(cle);
    gardees.push(a);
  }
  return gardees;
}

/**
 * Ce qu'il faut écrire et ce qu'il faut effacer pour que les arêtes d'un texte
 * reflètent ce qu'il contient MAINTENANT.
 *
 * Retirer une mention d'une note doit retirer l'arête : sans ce calcul, une
 * mention effacée continuerait d'apparaître à jamais dans le panneau
 * « Mentionné dans » de sa cible, et personne ne comprendrait pourquoi.
 *
 * ⚠️ Ne touche QUE les arêtes d'origine `mention`. Un rattachement fait à la
 * main ne se retire pas parce qu'un texte a changé — c'est un geste délibéré,
 * il demande un geste délibéré pour être défait.
 */
export function diffMentions(
  existantes: readonly ObjectLink[],
  voulues: readonly AreteVoulue[],
): { aCreer: AreteVoulue[]; aSupprimer: ObjectLink[] } {
  const gardees = normaliserAretes(voulues);
  const cleVoulue = new Set(
    gardees.map((a) => uidArete({ kind: a.from_kind, uid: a.from_uid }, { kind: a.to_kind, uid: a.to_uid })),
  );
  const cleExistante = new Set(existantes.map((l) => l.uid));

  return {
    aCreer: gardees.filter(
      (a) =>
        !cleExistante.has(
          uidArete({ kind: a.from_kind, uid: a.from_uid }, { kind: a.to_kind, uid: a.to_uid }),
        ),
    ),
    aSupprimer: existantes.filter((l) => l.origin === "mention" && !cleVoulue.has(l.uid)),
  };
}

/**
 * Les arêtes réellement AFFICHABLES : celles dont l'extrémité citée existe
 * encore ici.
 *
 * ⚠️ Indispensable malgré la cascade de suppression de la migration 020 (§ 8),
 * et pour une raison qui n'a rien à voir avec elle : l'ordre d'arrivée des
 * lignes distantes n'est pas garanti. Une arête peut être appliquée AVANT
 * l'objet qu'elle cite. Elle est alors conservée — pas mise en quarantaine —
 * et devient visible d'elle-même au cycle suivant.
 *
 * `existe` est injectée plutôt que lue en base : c'est ce qui rend cette
 * fonction testable sans SQLite, et ce qui permet à l'appelant de charger les
 * uid d'un seul coup au lieu d'une requête par arête.
 */
export function aretesResolues(
  aretes: readonly ObjectLink[],
  existe: (kind: LinkKind, uid: string) => boolean,
): ObjectLink[] {
  return aretes.filter((l) => existe(l.from_kind, l.from_uid) && existe(l.to_kind, l.to_uid));
}

/**
 * Les backlinks d'un objet, groupés par famille — la forme qu'attend le panneau
 * « Mentionné dans ».
 *
 * L'ordre des familles suit `LINK_KINDS`, pas l'ordre d'insertion : la même
 * fiche doit présenter ses sections dans le même ordre à chaque ouverture.
 */
export function grouperParKind(aretes: readonly ObjectLink[]): Map<LinkKind, ObjectLink[]> {
  const groupes = new Map<LinkKind, ObjectLink[]>();
  for (const kind of LINK_KINDS) {
    const dedans = aretes.filter((l) => l.from_kind === kind);
    if (dedans.length) groupes.set(kind, dedans);
  }
  return groupes;
}
