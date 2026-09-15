import type { CalendarEvent, LinkKind, ObjectLink } from "../types";

/**
 * Ce que la feuille de route des objectifs lit HORS d'`AppData` (chantier
 * feuille de route, phase D) : les arêtes qui touchent un objectif, les
 * événements qu'elles citent, et le titre de chaque note ou fiche citée.
 *
 * ⚠️ Une arête dont l'autre extrémité n'existe pas (encore, ou plus) est
 * ÉCARTÉE ici : l'ordre d'arrivée de la synchronisation n'est pas garanti, et un
 * rattachement ne doit jamais apparaître comme une ligne sans titre
 * (§ « une cible supprimée n'abandonne pas de backlink fantôme », migration 020).
 */
export interface ContexteObjectifs {
  liens: ObjectLink[];
  evenements: (CalendarEvent & { uid: string })[];
  /** Titre par `kind:uid`, pour les notes, fiches et événements cités. */
  titres: Record<string, string>;
}

export const FAMILLES_RATTACHABLES: readonly LinkKind[] = ["note", "knowledge", "event"];

/** Commun au natif et à la démo : même tri, même filtre des extrémités absentes. */
export function assemblerContexte(
  bruts: readonly ObjectLink[],
  notes: readonly { uid: string; title: string }[],
  fiches: readonly { uid: string; title: string }[],
  evenements: readonly (CalendarEvent & { uid: string })[],
): ContexteObjectifs {
  const titres: Record<string, string> = {};
  for (const n of notes) titres[`note:${n.uid}`] = n.title;
  for (const f of fiches) titres[`knowledge:${f.uid}`] = f.title;
  for (const e of evenements) titres[`event:${e.uid}`] = e.title;
  const liens = bruts.filter((l) => {
    const autre = l.from_kind === "goal" ? { kind: l.to_kind, uid: l.to_uid } : { kind: l.from_kind, uid: l.from_uid };
    // Les tâches passent par `goal_id`, les autres familles sont hors périmètre.
    return FAMILLES_RATTACHABLES.includes(autre.kind) && `${autre.kind}:${autre.uid}` in titres;
  });
  return { liens, evenements: [...evenements], titres };
}


export interface Rattachement {
  /** L'arête elle-même : c'est elle qu'on supprime pour détacher. */
  lien: ObjectLink;
  kind: LinkKind;
  uid: string;
  titre: string;
}

/**
 * Les notes, fiches et événements rattachés à UN objectif, dédoublonnés par
 * (famille, uid) : une arête posée dans les deux sens ne s'affiche qu'une fois.
 * Ordre : les événements d'abord (ils comptent), puis les ressources.
 */
export function rattachementsDe(uidObjectif: string, contexte: ContexteObjectifs): Rattachement[] {
  const vus = new Set<string>();
  const out: Rattachement[] = [];
  for (const l of contexte.liens) {
    const autre =
      l.from_kind === "goal" && l.from_uid === uidObjectif
        ? { kind: l.to_kind, uid: l.to_uid }
        : l.to_kind === "goal" && l.to_uid === uidObjectif
          ? { kind: l.from_kind, uid: l.from_uid }
          : null;
    if (!autre) continue;
    const cle = `${autre.kind}:${autre.uid}`;
    if (vus.has(cle) || !(cle in contexte.titres)) continue;
    vus.add(cle);
    out.push({ lien: l, ...autre, titre: contexte.titres[cle] });
  }
  const rang = (k: LinkKind) => (k === "event" ? 0 : 1);
  return out.sort((a, b) => rang(a.kind) - rang(b.kind));
}

export const CONTEXTE_VIDE: ContexteObjectifs = { liens: [], evenements: [], titres: {} };
