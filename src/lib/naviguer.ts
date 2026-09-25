import { TABLE_DE_KIND } from "./liens";
import { isTauri } from "./repo";
import type { LinkKind } from "./types";
import type { View } from "../components/Sidebar";

/**
 * Ouvrir l'objet qu'une mention désigne, depuis n'importe où.
 *
 * ⚠️ POURQUOI UN ÉVÉNEMENT DE FENÊTRE ET PAS UNE PROP. Une mention peut être
 * cliquée dans une note, dans une fiche du Savoir, dans un objet — et elle peut
 * pointer vers l'un quelconque des sept modules. Faire descendre une fonction
 * de navigation jusque dans chaque éditeur imposerait de la passer à travers
 * cinq niveaux de composants qui n'en ont que faire. Le dépôt utilise déjà ce
 * motif (`sb:open-note`, `sb:new-task`) ; on s'y range plutôt que d'en inventer
 * un second.
 */
export const EVT_OUVRIR = "sb:ouvrir-objet";

export interface DemandeOuverture {
  /**
   * ⚠️ `KindAvecVue`, jamais `LinkKind` : cet événement demande d'OUVRIR UN
   * MODULE, et une pièce jointe n'en a pas (`ouvrirObjet` la détourne avant
   * d'en arriver là). Le dire dans le type épargne un `if` à chaque écouteur —
   * et surtout, ça a immédiatement désigné `App.tsx`, qui lisait `VUE_DE_KIND`
   * sans rien écarter.
   */
  kind: KindAvecVue;
  /** Numéro LOCAL, résolu depuis l'uid avant l'émission. */
  id: number;
}

/**
 * Les familles qui ont un module — c'est-à-dire toutes, SAUF le fichier.
 *
 * ⚠️ Ce `Exclude` n'est pas une commodité de typage, c'est la règle elle-même.
 * Une pièce jointe (migration 028) ne s'ouvre pas dans un écran de Shale : elle
 * s'ouvre dans le logiciel du système. Il n'existe donc aucune valeur honnête à
 * écrire pour `file` dans cette table — et si on en inventait une (`"notes"`,
 * faute de mieux), un appelant finirait par y naviguer et l'utilisateur
 * atterrirait dans les Notes en croyant ouvrir son PDF.
 *
 * En excluant la famille du TYPE, le compilateur oblige chaque lecture de cette
 * table à écarter `file` d'abord. La règle est tenue par la forme du code et non
 * par une liste à maintenir — c'est la leçon du § 7.2 ter de `PIEGES.md`, où une
 * règle écrite en énumérant des familles avait un trou de la taille exacte de ce
 * qu'elle prétendait garder.
 */
export type KindAvecVue = Exclude<LinkKind, "file">;

export function aUneVue(kind: LinkKind): kind is KindAvecVue {
  return kind !== "file";
}

/** Le module qui affiche chaque famille. */
export const VUE_DE_KIND: Record<KindAvecVue, View> = {
  note: "notes",
  knowledge: "knowledge",
  task: "tasks",
  goal: "goals",
  event: "calendar",
  trade: "trading",
  object: "knowledge", // les objets vivent dans un onglet du Savoir
};

/**
 * Traduit l'uid en numéro local, puis demande l'ouverture.
 *
 * ⚠️ Silencieux si l'objet n'existe plus : c'est le cas d'une mention dont la
 * cible a été supprimée sur un autre appareil. L'interface marque déjà ces
 * jetons comme morts et ne les rend pas cliquables — cette garde est la seconde
 * ligne, pour le cas où la suppression arrive entre l'affichage et le clic.
 */
export async function ouvrirObjet(kind: LinkKind, uid: string): Promise<void> {
  // ⚠️ UNE PIÈCE JOINTE NE SE NAVIGUE PAS, elle s'ouvre. Ce n'est pas un cas
  // particulier pour faire taire le compilateur : c'est une action d'une autre
  // nature, qui sort de l'app. Émettre `EVT_OUVRIR` pour un fichier ferait
  // changer de module sans rien ouvrir du tout.
  if (kind === "file") {
    const { ouvrirPieceJointeOuDire } = await import("./piecesJointesOuvrir");
    await ouvrirPieceJointeOuDire(uid);
    return;
  }
  const id = await idDepuisUid(kind, uid);
  if (id == null) return;
  window.dispatchEvent(new CustomEvent<DemandeOuverture>(EVT_OUVRIR, { detail: { kind, id } }));
}

// ─── ⭐ La demande en attente ────────────────────────────────────────────────

/**
 * LE PROBLÈME, VU À L'ÉCRAN. Cliquer une mention vers une note changeait bien
 * de module… et ouvrait la PREMIÈRE note, pas la bonne.
 *
 * La cause : les modules sont chargés en `React.lazy`. Au moment où `App.tsx`
 * réémet l'événement que le module écoute, ce module n'est pas encore monté —
 * personne n'écoute, l'événement tombe dans le vide. Un `setTimeout(0)` ne
 * suffit pas : ce n'est pas une question de tick, c'est une question de
 * TÉLÉCHARGEMENT de chunk, qui prend un temps qu'on ne connaît pas.
 *
 * LA PARADE. La demande est DÉPOSÉE ici et le module vient la chercher à son
 * montage. Elle ne dépend plus d'un rendez-vous chronométré entre deux
 * composants qui ne se connaissent pas. L'événement reste émis en plus, pour le
 * cas — fréquent — où le module est déjà à l'écran.
 */
let enAttente: DemandeOuverture | null = null;

export function deposerDemande(demande: DemandeOuverture): void {
  enAttente = demande;
}

/**
 * Retire et rend la demande si elle concerne cette famille.
 *
 * ⚠️ CONSOMMÉE, pas seulement lue : sans cela, revenir plus tard sur le module
 * rouvrirait le même élément, et l'utilisateur croirait à un écran figé.
 */
export function regarderDemande(kind: LinkKind): boolean {
  return enAttente?.kind === kind;
}

/**
 * ⚠️ REGARDER N'EST PAS CONSOMMER, et la distinction n'est pas théorique.
 * `KnowledgeView` a besoin de savoir qu'une demande vise un OBJET pour ouvrir le
 * bon onglet, mais c'est `GalerieObjets` — montée après elle — qui ouvrira la
 * fiche. Si le parent consommait, l'enfant ne trouverait plus rien : on
 * arriverait sur le bon onglet, devant la mauvaise fiche.
 */
export function consommerDemande(kind: LinkKind): number | null {
  if (enAttente?.kind !== kind) return null;
  const { id } = enAttente;
  enAttente = null;
  return id;
}

/**
 * Le numéro LOCAL d'un objet, depuis son identité de synchronisation.
 *
 * ⭐ Exporté depuis le 2026-09-20 : c'est l'inverse exact de `repo.uidDe`, et
 * tout ce qui reçoit un `uid` d'ailleurs (une arête, un nœud de carte mentale)
 * a besoin de retrouver la ligne locale avant d'écrire. Le recopier ailleurs
 * ferait diverger le cas du mode démo, où les identités sont synthétiques.
 */
export async function idDepuisUid(kind: LinkKind, uid: string): Promise<number | null> {
  if (!isTauri) {
    // Mode démo : les identités sont synthétiques et STABLES (`demo:note:3`),
    // donc le numéro se relit directement — voir `demo.ts`.
    const m = /^demo:[a-z]+:(\d+)$/.exec(uid);
    return m ? Number(m[1]) : null;
  }
  const { getDb } = await import("./db");
  const db = await getDb();
  const rows = await db.select<{ id: number }[]>(
    `SELECT id FROM ${TABLE_DE_KIND[kind]} WHERE uid = $1`,
    [uid],
  );
  return rows[0]?.id ?? null;
}

// ─── Aller vers une VUE (pas un objet) ───────────────────────────────────────

export const EVT_ALLER = "sb:aller-vue";

/**
 * Demande à `App.tsx` d'ouvrir une vue — « Voir la corbeille » depuis un toast,
 * « Voir » après la restauration d'une entrée de journal.
 *
 * ⚠️ Passe par la GARDE de navigation d'`App.tsx`, jamais par `setView` : une
 * vue verrouillée par l'offre ou par le profil de licence doit le rester, d'où
 * qu'on vienne. C'est le patron d'`ouvrirObjet`, sans objet à ouvrir.
 */
export function allerVers(vue: View): void {
  window.dispatchEvent(new CustomEvent<View>(EVT_ALLER, { detail: vue }));
}

/**
 * Ouvrir un objet dont on connaît déjà le numéro LOCAL — sans passer par l'uid.
 *
 * Sert au menu d'une tâche du widget d'Aujourd'hui (« Modifier… ») : la tâche
 * est là, sous la main, avec son `id` ; rien à résoudre. Même événement, même
 * garde de navigation qu'`ouvrirObjet`.
 */
export function ouvrirParId(kind: KindAvecVue, id: number): void {
  window.dispatchEvent(new CustomEvent<DemandeOuverture>(EVT_OUVRIR, { detail: { kind, id } }));
}
