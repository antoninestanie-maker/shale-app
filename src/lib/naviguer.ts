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
  kind: LinkKind;
  /** Numéro LOCAL, résolu depuis l'uid avant l'émission. */
  id: number;
}

/** Le module qui affiche chaque famille. */
export const VUE_DE_KIND: Record<LinkKind, View> = {
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

async function idDepuisUid(kind: LinkKind, uid: string): Promise<number | null> {
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
