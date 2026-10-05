import {
  COULEURS_BRANCHE,
  RACINE,
  type Carte,
  type Noeud,
  type RefNoeud,
} from "../carte";
import { t } from "../i18n";
import type { Goal, Habit, LinkKind, Priority, Task } from "../types";
import type { KindCarte } from "../carte";
import { rattachementsDe, type ContexteObjectifs } from "./contexte";
import { uidDeLigne } from "./progression";
import { etapesTriees } from "./structure";

/**
 * ⭐ LE PONT ENTRE UNE FEUILLE DE ROUTE ET UNE CARTE MENTALE — DANS LES DEUX SENS.
 *
 * Antonin, 2026-09-20 : « ce serait aussi bon que ce système d'objectifs puisse
 * apparaître sous forme de carte mentale et inversement, en créant une carte
 * mentale, de pouvoir en faire un objectif avec sous-objectif etc. »
 *
 * Deux fonctions, deux sens, et AUCUNE synchronisation permanente entre les
 * deux formes. C'est la décision de conception de ce fichier, et elle mérite sa
 * phrase : une carte qui resterait branchée sur les objectifs devrait répondre à
 * « que se passe-t-il quand on supprime un nœud ? » — et la seule réponse
 * honnête serait « on supprime l'objectif », c'est-à-dire un geste destructeur
 * derrière un geste de dessin. Donc :
 *
 *   • `carteDObjectif()` DESSINE la feuille de route. La carte obtenue se lit,
 *     se déplie, s'exporte, et chaque nœud ouvre son objet. Elle ne s'écrit pas :
 *     la feuille de route reste le seul endroit où l'on modifie un objectif.
 *   • `planDeCarte()` LIT une carte mentale et en propose un objectif complet,
 *     une fois, sur un geste explicite. Ce qui existe déjà (une tâche citée par
 *     un nœud `@`) est RATTACHÉ, jamais recopié.
 *
 * ⚠️ TOUT CE FICHIER EST PUR — même partage que `lib/carte.ts` lui-même : aucun
 * accès à la base, aucun DOM. L'écriture vit dans `creerDepuisCarte.ts`, court
 * exprès. C'est ce qui rend les deux traductions testables ligne à ligne, alors
 * qu'aucun test de ce dépôt ne prouve une interface (PIEGES § 7.1).
 */

// ─── Sens 1 : la feuille de route DESSINÉE ───────────────────────────────────

export interface SourcesCarte {
  goals: readonly Goal[];
  tasks: readonly Task[];
  contexte: ContexteObjectifs;
  /** Les habitudes : une étape comptée par une habitude la montre en feuille. */
  habits?: readonly Habit[];
  /**
   * Les positions posées à la main, lues dans le réglage de l'objectif
   * (`clePositionsObjectif`), par `kind:uid`. Jamais sur les lignes d'objectif.
   */
  positions?: Readonly<PositionsObjectif>;
}

/**
 * ⚠️ CHANGÉ LE 2026-09-29 (décision F de l'arrêt 1) : le texte d'un nœud est
 * le TITRE, et rien d'autre. Il portait « · 42 % » et « ✓ » — donc l'export
 * PNG/SVG d'une carte d'objectif figeait un pourcentage et des coches qui
 * mentaient dès le lendemain. L'état se dessine désormais dans la couche
 * vivante de l'éditeur (`carteEtat.ts`, `EtatsVivants.tsx`), jamais dans le SVG.
 */

/**
 * La feuille de route d'un objectif, en carte mentale.
 *
 * Les identifiants de nœud sont STABLES (`g12`, `t7`, `note:…`) : replier une
 * branche puis rafraîchir la vue ne rebat pas les cartes.
 *
 * ⚠️ Chaque nœud porte une `ref` — donc son texte n'est qu'une copie
 * d'affichage, exactement comme pour un jeton de mention. C'est ce qui rend le
 * nœud cliquable ET ce qui interdit de le renommer depuis la carte : le titre
 * vit dans l'objet, pas dans le dessin.
 */
export function carteDObjectif(racine: Goal, s: SourcesCarte): Carte {
  const noeuds: Noeud[] = [
    { id: RACINE, parent: null, texte: texteObjectif(racine), ref: refDe("goal", racine), genre: "objectif" },
  ];

  const etapes = etapesTriees(racine.id, s.goals);
  etapes.forEach((etape, i) => {
    noeuds.push({
      id: `g${etape.id}`,
      parent: RACINE,
      texte: texteObjectif(etape),
      ref: refDe("goal", etape),
      genre: etape.is_milestone ? "phase" : "sous-objectif",
      // Le côté et la teinte sont POSÉS, jamais déduits du rang à l'affichage :
      // c'est ce que fait `lireCarte` pour une carte enregistrée, et ça garde
      // le dessin identique d'une ouverture à l'autre.
      cote: i % 2 === 0 ? 1 : -1,
      teinte: i % COULEURS_BRANCHE.length,
    });
    for (const sous of etapesTriees(etape.id, s.goals)) {
      noeuds.push({
        id: `g${sous.id}`,
        parent: `g${etape.id}`,
        texte: texteObjectif(sous),
        ref: refDe("goal", sous),
        genre: "sous-objectif",
      });
      noeuds.push(...feuillesDe(sous, `g${sous.id}`, s));
    }
    noeuds.push(...feuillesDe(etape, `g${etape.id}`, s));
  });
  noeuds.push(...feuillesDe(racine, RACINE, s));

  // Les positions posées à la main, par identité GLOBALE (`kind:uid`) — la
  // racine n'en porte jamais : elle est l'origine du repère.
  if (s.positions) {
    for (const n of noeuds) {
      if (n.parent === null || !n.ref) continue;
      const p = s.positions[`${n.ref.kind}:${n.ref.uid}`];
      if (p) n.pos = { x: p.x, y: p.y };
    }
  }

  return { v: 1, noeuds };
}

/** Les tâches et les ressources rattachées à UN objectif, en nœuds-feuilles. */
function feuillesDe(goal: Goal, parent: string, s: SourcesCarte): Noeud[] {
  const out: Noeud[] = [];
  // ⭐ L'habitude qui COMPTE cette étape (migration 026, `count_source`) : le
  // seul chemin qui relie une habitude à un objectif (décision C). Elle se
  // dessine en feuille de l'étape qu'elle fait avancer.
  if (goal.count_source === "habit" && goal.count_ref_uid) {
    const h = (s.habits ?? []).find((x) => uidDeLigne("habit", x) === goal.count_ref_uid);
    if (h) {
      out.push({
        id: `h:${goal.id}`,
        parent,
        texte: h.name.trim() || t("Sans titre"),
        ref: { kind: "habit", uid: goal.count_ref_uid },
      });
    }
  }
  const taches = s.tasks
    .filter((x) => x.goal_id === goal.id)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.id - b.id);
  for (const tache of taches) {
    out.push({
      id: `t${tache.id}`,
      parent,
      texte: tache.label.trim() || t("Sans titre"),
      ref: refDe("task", tache),
    });
  }
  for (const r of rattachementsDe(uidDeLigne("goal", goal), s.contexte)) {
    out.push({
      id: `${r.kind}:${r.uid}`,
      parent,
      texte: r.titre || t("Sans titre"),
      ref: { kind: r.kind, uid: r.uid },
    });
  }
  return out;
}

/** Le titre, et lui seul (décision F) : le pourcentage vit dans la couche vivante. */
function texteObjectif(goal: Goal): string {
  return goal.title.trim() || t("Sans titre");
}

// ─── Les positions d'une carte d'objectif (2026-09-29) ────────────────────────

/**
 * ⭐ OÙ VIVENT LES POSITIONS D'UNE CARTE D'OBJECTIF — décision B de l'arrêt 1.
 *
 * Un réglage par objectif, SYNCHRONISÉ, indexé par l'`uid` des nœuds. Surtout
 * pas sur les lignes d'objectif : un glisser réécrirait la ligne, et le
 * last-write-wins écraserait un renommage fait sur l'autre appareil. Et pas
 * sous `layout.*`, exclu de la synchronisation parce qu'il dépend de l'écran —
 * ce n'est pas le cas ici, les positions sont LOGIQUES. Vérifié en exécutant
 * `settingSynchronisable` (rapport de phase 0, § 2.4).
 *
 * Le prix, accepté : un seul bloc par objectif, donc LWW sur le bloc — deux
 * appareils qui déplacent deux nœuds au même instant, l'un des deux gagne.
 * C'est de la mise en page, jamais une donnée.
 */
export const clePositionsObjectif = (uidObjectif: string) => `carte.objectif.${uidObjectif}`;

export type PositionsObjectif = Record<string, { x: number; y: number }>;

/** Relit le réglage en tolérant n'importe quoi : une position illisible est ignorée, jamais une erreur. */
export function lirePositionsObjectif(brut: string | null | undefined): PositionsObjectif {
  if (!brut) return {};
  try {
    const o = JSON.parse(brut) as { pos?: Record<string, { x?: unknown; y?: unknown }> };
    const out: PositionsObjectif = {};
    for (const [cle, p] of Object.entries(o?.pos ?? {})) {
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out[cle] = { x: Number(p.x), y: Number(p.y) };
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Le réglage à écrire, depuis la carte affichée. Clés TRIÉES : deux écritures
 * de la même mise en page rendent la même chaîne, et on n'écrit rien (donc
 * rien dans la file de synchronisation) quand rien n'a bougé.
 *
 * ⚠️ Une position ORPHELINE (objet supprimé) disparaît ici à la première
 * écriture qui suit ; à la lecture, elle est simplement ignorée.
 */
export function ecrirePositionsObjectif(carte: Carte): string {
  const pos: PositionsObjectif = {};
  for (const n of carte.noeuds) {
    if (n.parent === null || !n.ref || !n.pos) continue;
    pos[`${n.ref.kind}:${n.ref.uid}`] = n.pos;
  }
  const trie = Object.fromEntries(Object.keys(pos).sort().map((k) => [k, pos[k]]));
  return JSON.stringify({ v: 1, pos: trie });
}

/**
 * ⭐ LA CARTE D'OBJECTIF EST RE-DÉRIVÉE À CHAQUE ÉCRITURE — mais ce que
 * l'utilisateur a fait de la VUE ne doit pas sauter pour autant.
 *
 * Après un renommage, une tâche créée, une coche, la feuille de route est
 * relue et la carte redessinée. On garde de l'écran : les replis, et les
 * positions posées depuis (l'écriture du réglage est différée). Et le nœud
 * en cours de saisie (`garder`), qui n'existe pas encore dans les données.
 */
export function fusionnerCarteObjectif(derivee: Carte, locale: Carte, garder: string | null): Carte {
  const parId = new Map(locale.noeuds.map((n) => [n.id, n]));
  const noeuds: Noeud[] = derivee.noeuds.map((n) => {
    const l = parId.get(n.id);
    if (!l) return n;
    const { plie: _p, pos: _q, ...reste } = n;
    return { ...reste, ...(l.plie ? { plie: true as const } : {}), ...(l.pos ? { pos: l.pos } : {}) };
  });
  if (garder) {
    const g = parId.get(garder);
    if (g && g.parent && noeuds.some((n) => n.id === g.parent) && !noeuds.some((n) => n.id === g.id)) noeuds.push(g);
  }
  return { ...derivee, noeuds };
}

/** L'identité d'un objet, pour un nœud-référence (même `uid` que les arêtes). */
function refDe(kind: LinkKind, ligne: { id: number; uid?: string | null }): RefNoeud {
  return { kind, uid: uidDeLigne(kind, ligne) };
}

// ─── Sens 2 : une carte mentale DEVENUE objectif ─────────────────────────────

/** Une tâche du plan : à créer (texte seul), ou à rattacher (`ref` d'une tâche existante). */
export interface TachePlan {
  titre: string;
  ref?: RefNoeud;
  /** 'YYYY-MM-DD' — posé par l'import d'une checklist, jamais par une carte. */
  echeance?: string;
  priorite?: Priority;
}

/** Une note, une fiche ou un événement cité par la carte : rattaché par une arête. */
export interface RessourcePlan {
  kind: LinkKind;
  uid: string;
}

export interface EtapePlan {
  titre: string;
  /** `true` = phase (`is_milestone`), parce qu'elle porte des sous-objectifs. */
  phase: boolean;
  sousEtapes: EtapePlan[];
  taches: TachePlan[];
  ressources: RessourcePlan[];
}

export interface PlanObjectif {
  titre: string;
  etapes: EtapePlan[];
  /** Les tâches pendues directement au centre de la carte. */
  taches: TachePlan[];
  ressources: RessourcePlan[];
  /** Nœuds écartés (vides, ou dont la cible n'existe plus), sous-arbres compris. */
  ignores: number;
  /**
   * ⭐ Ce qui APPARTIENT DÉJÀ à un autre objectif — une étape typée, une tâche
   * rattachée ailleurs. Décision d'Antonin (arrêt 1, 2026-09-29) : ni recopié,
   * ni déplacé en silence. Laissé où il est, et compté à part.
   */
  laisses: { kind: KindCarte; uid: string; titre: string }[];
  /**
   * Les habitudes citées — des objets LIBRES (une habitude n'appartient à aucun
   * objectif). Rattachées, sur demande du panneau, par une étape qui les compte.
   */
  habitudes: { uid: string; titre: string }[];
}

/** Ce que le plan sait déjà des objets existants, pour ne rien déplacer en silence. */
export interface ExistantsPlan {
  tasks: readonly Pick<Task, "id" | "uid" | "goal_id">[];
}

/**
 * ⭐ CE QU'UNE CARTE MENTALE DEVIENT, ET POURQUOI CETTE CORRESPONDANCE-LÀ.
 *
 * La feuille de route n'a que trois niveaux (`structure.ts`), une carte mentale
 * n'en a aucun. Il fallait donc une règle, et une seule, qui ne perde rien :
 *
 *   centre              → l'objectif
 *   niveau 1 AVEC enfants  → une PHASE (elle en regroupe d'autres)
 *   niveau 1 SANS enfant   → un sous-objectif direct
 *   niveau 2               → un sous-objectif de la phase
 *   niveau 3 et au-delà    → des TÂCHES du sous-objectif qui les porte
 *
 * ⭐ Le dernier point est le cœur de la traduction : au fond d'une carte
 * mentale, on n'écrit plus des intentions, on écrit ce qu'il y a à faire. Les
 * transformer en sous-objectifs de sous-objectifs aurait demandé un quatrième
 * niveau à la feuille de route ; les jeter aurait fait disparaître du travail
 * déjà pensé. Elles deviennent donc des tâches, à plat, sur l'objectif le plus
 * proche au-dessus d'elles.
 *
 * ⚠️ UN NŒUD QUI CITE DÉJÀ UN OBJET NE SE RECOPIE PAS :
 *   • une tâche citée est RATTACHÉE (`tasks.goal_id`) ;
 *   • une note, une fiche, un événement sont rattachés par une arête ;
 *   • tout le reste (un objectif, un trade) ne sait pas se rattacher à un
 *     objectif : on garde son TITRE comme texte, et la ligne devient une étape
 *     ou une tâche ordinaire. Perdre le lien vaut mieux que perdre l'idée.
 *
 * ⚠️ Un nœud vide, ou dont la cible a disparu (`mort`), est écarté AVEC ce qui
 * pend dessous : rattacher les orphelins au grand-parent inventerait une
 * structure que personne n'a dessinée. Le compte est rendu, pour que l'écran
 * puisse le dire avant de créer.
 */
export function planDeCarte(carte: Carte, existants?: ExistantsPlan): PlanObjectif {
  const racine = carte.noeuds.find((n) => n.parent === null) ?? carte.noeuds[0];
  const plan: PlanObjectif = {
    titre: (racine?.texte ?? "").trim(),
    etapes: [],
    taches: [],
    ressources: [],
    ignores: 0,
    laisses: [],
    habitudes: [],
  };
  const ranger = (n: Noeud, taches: TachePlan[], ressources: RessourcePlan[]) =>
    poserRattachement(n, taches, ressources, plan, existants);
  if (!racine) return plan;

  const enfants = (id: string) => carte.noeuds.filter((n) => n.parent === id);
  /** Un nœud écarté emporte son sous-arbre : on les compte tous. */
  const ecarter = (n: Noeud) => {
    plan.ignores += 1 + compterDescendants(carte, n.id);
  };

  for (const niveau1 of enfants(racine.id)) {
    if (!retenu(niveau1)) {
      ecarter(niveau1);
      continue;
    }
    const range = ranger(niveau1, plan.taches, plan.ressources);
    if (range) {
      // Une tâche ou une ressource citée au premier niveau appartient à
      // l'objectif lui-même ; ce qui pend dessous n'a plus de porteur. Sous une
      // ÉTAPE EXISTANTE laissée en place, ce qui pend reste avec elle.
      if (niveau1.ref?.kind !== "goal") for (const dessous of enfants(niveau1.id)) ecarter(dessous);
      continue;
    }

    const sousNiveaux = enfants(niveau1.id);
    const etape: EtapePlan = {
      titre: niveau1.texte.trim(),
      phase: false,
      sousEtapes: [],
      taches: [],
      ressources: [],
    };

    for (const niveau2 of sousNiveaux) {
      if (!retenu(niveau2)) {
        ecarter(niveau2);
        continue;
      }
      if (ranger(niveau2, etape.taches, etape.ressources)) {
        if (niveau2.ref?.kind !== "goal") for (const dessous of enfants(niveau2.id)) ecarter(dessous);
        continue;
      }
      const sous: EtapePlan = {
        titre: niveau2.texte.trim(),
        phase: false,
        sousEtapes: [],
        taches: [],
        ressources: [],
      };
      // Tout ce qui pend sous le niveau 2 devient une tâche de ce
      // sous-objectif, à plat, dans l'ordre où la carte les porte.
      //
      // ⚠️ À CETTE PROFONDEUR, un nœud écarté n'emporte PAS son sous-arbre : il
      // n'y a plus de structure à préserver, tout arrive au même endroit. Un
      // nœud vide au milieu de la liste est donc simplement sauté, et ce qui
      // pendait dessous reste une tâche du même sous-objectif.
      for (const profond of descendants(carte, niveau2.id)) {
        if (!retenu(profond)) {
          plan.ignores += 1;
          continue;
        }
        if (ranger(profond, sous.taches, sous.ressources)) continue;
        sous.taches.push({ titre: profond.texte.trim() });
      }
      etape.sousEtapes.push(sous);
    }

    // Une étape qui porte des sous-objectifs est une PHASE : c'est la seule
    // forme que la feuille de route accepte à ce niveau (`peutAjouterEtape`).
    etape.phase = etape.sousEtapes.length > 0;
    plan.etapes.push(etape);
  }

  return plan;
}

/** Un nœud entre dans le plan s'il a du texte et si sa cible existe encore. */
function retenu(n: Noeud): boolean {
  return !n.mort && n.texte.trim().length > 0;
}

/**
 * Si le nœud cite un objet, le ranger et rendre `true`.
 * Sinon `false` : c'est du texte, l'appelant en fait une étape ou une tâche.
 *
 * ⚠️ CORRIGÉ LE 2026-09-29 (décision D de l'arrêt 1). Jusque-là, un nœud qui
 * citait un OBJECTIF rendait `false` : son titre devenait une étape NEUVE —
 * un doublon de l'étape qu'il désignait. Et une tâche citée était rattachée
 * au nouvel objectif même si elle en avait déjà un : elle le quittait, sans
 * que le panneau le dise. Désormais :
 *   • un objectif cité (une étape typée) est LAISSÉ où il est, et compté ;
 *   • une tâche déjà rattachée ailleurs aussi ; une tâche libre est rattachée ;
 *   • une habitude citée est mise de côté pour le panneau, qui propose de la
 *     rattacher par une étape qui la compte.
 */
function poserRattachement(
  n: Noeud,
  taches: TachePlan[],
  ressources: RessourcePlan[],
  plan: PlanObjectif,
  existants?: ExistantsPlan,
): boolean {
  if (!n.ref) return false;
  const titre = n.texte.trim();
  if (n.ref.kind === "goal") {
    plan.laisses.push({ kind: "goal", uid: n.ref.uid, titre });
    return true;
  }
  if (n.ref.kind === "habit") {
    plan.habitudes.push({ uid: n.ref.uid, titre });
    return true;
  }
  if (n.ref.kind === "task") {
    const tache = existants?.tasks.find((x) => uidDeLigne("task", x) === n.ref!.uid);
    if (tache?.goal_id != null) {
      plan.laisses.push({ kind: "task", uid: n.ref.uid, titre });
      return true;
    }
    taches.push({ titre, ref: { kind: "task", uid: n.ref.uid } });
    return true;
  }
  if (n.ref.kind === "note" || n.ref.kind === "knowledge" || n.ref.kind === "event") {
    ressources.push({ kind: n.ref.kind, uid: n.ref.uid });
    return true;
  }
  return false;
}

/** Tous les descendants, en profondeur, dans l'ordre du tableau (donc déterministe). */
function descendants(carte: Carte, id: string): Noeud[] {
  const out: Noeud[] = [];
  for (const n of carte.noeuds.filter((x) => x.parent === id)) {
    out.push(n);
    out.push(...descendants(carte, n.id));
  }
  return out;
}

function compterDescendants(carte: Carte, id: string): number {
  return descendants(carte, id).length;
}

/** Ce que le plan va créer, pour l'annoncer AVANT de l'écrire. */
export interface ComptesPlan {
  etapes: number;
  phases: number;
  taches: number;
  tachesRattachees: number;
  ressources: number;
  /** Étapes et tâches qui appartiennent déjà à un autre objectif : laissées en place. */
  laisses: number;
  habitudes: number;
}

export function comptesDuPlan(plan: PlanObjectif): ComptesPlan {
  const c: ComptesPlan = {
    etapes: 0,
    phases: 0,
    taches: 0,
    tachesRattachees: 0,
    ressources: 0,
    laisses: plan.laisses.length,
    habitudes: plan.habitudes.length,
  };
  const compterTaches = (liste: readonly TachePlan[]) => {
    for (const x of liste) {
      if (x.ref) c.tachesRattachees++;
      else c.taches++;
    }
  };
  compterTaches(plan.taches);
  c.ressources += plan.ressources.length;
  for (const e of plan.etapes) {
    c.etapes++;
    if (e.phase) c.phases++;
    compterTaches(e.taches);
    c.ressources += e.ressources.length;
    for (const s of e.sousEtapes) {
      c.etapes++;
      compterTaches(s.taches);
      c.ressources += s.ressources.length;
    }
  }
  return c;
}
