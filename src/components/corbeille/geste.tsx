/**
 * Les gestes de la corbeille, tels que l'INTERFACE les fait : jeter, restaurer,
 * supprimer pour de bon — chacun avec son toast.
 *
 * ⭐ UN SEUL CHEMIN POUR TOUTES LES VUES. Les dix endroits de l'app qui
 * suppriment quelque chose, le menu contextuel ET son bouton « ⋯ », appellent
 * `jeter()`. C'est la règle 18 du chantier : une entrée de menu appelle
 * exactement la même fonction que le bouton qui lui correspond.
 *
 * ⚠️ RÈGLE 15 — LA CIBLE EST CAPTURÉE À LA NAISSANCE DU TOAST. « Annuler »
 * restaure le `kind` et l'`id` fermés dans sa fermeture, jamais « l'objet
 * sélectionné » au moment du clic : c'est la leçon du chantier H (le contenu
 * d'une note écrit dans une autre, 2026-09-06). Entre le jet et le clic,
 * l'utilisateur a pu ouvrir autre chose.
 */

import { IconTrash } from "../icons";
import { formatDate, t, tp } from "../../lib/i18n";
import {
  fetchAll,
  mettreEnCorbeille,
  restaurer,
  supprimerDefinitivement,
} from "../../lib/repo";
import { todayStr } from "../../lib/logic";
import type { Carte } from "../../lib/carte";
import { cartesDuHtml } from "../../lib/carteDom";
import { objetsDesCartes, resoudreEmportes } from "../../lib/objectifs/emportes";
import type { KindCorbeille } from "../../lib/corbeille/regles";
import type { ElementCorbeille } from "../../lib/corbeille/base";
import { afficherToast } from "../../lib/toast";
import { allerVers, ouvrirObjet } from "../../lib/naviguer";
import type { LinkKind } from "../../lib/types";
import { FAMILLES } from "./familles";

/** Combien de temps un « Annuler » reste à l'écran. 4,5 s ne suffisent pas à le lire ET à y aller. */
export const DUREE_ANNULER = 8000;

const LIABLES: readonly KindCorbeille[] = ["note", "task", "goal", "event", "knowledge", "object"];

/** Un titre coupé pour tenir dans un toast, sans couper un mot au milieu si possible. */
export function titreCourt(titre: string, max = 40): string {
  const net = titre.trim();
  if (net.length <= max) return net;
  const coupe = net.slice(0, max);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > max * 0.6 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

/**
 * Le titre qu'on montre pour un élément de la corbeille.
 *
 * ⚠️ Trois familles n'ont pas toujours de titre : une entrée de journal se
 * nomme par sa DATE, un brouillon de facture peut n'avoir ni objet ni numéro,
 * et un objet peut avoir été enregistré sans nom. Une ligne vide dans la liste
 * serait impossible à reconnaître — donc impossible à restaurer à bon escient.
 */
export function titreAffiche(el: Pick<ElementCorbeille, "kind" | "titre">): string {
  if (el.kind === "journal" && el.titre) {
    // ⚠️ Midi LOCAL, pas `new Date("2026-09-22")` : cette forme est lue en UTC
    // minuit, et à l'ouest de Greenwich le Journal du 22 s'afficherait « du 21 »
    // (PIEGES § 4, les dates).
    const jour = new Date(`${el.titre}T12:00:00`);
    return t("Journal du {date}", { date: formatDate(jour, { day: "numeric", month: "long", year: "numeric" }) });
  }
  const net = el.titre?.trim();
  if (net) return net;
  return el.kind === "invoice" ? t("Brouillon sans objet") : t("Sans titre");
}

const iconeCorbeille = <IconTrash className="h-5 w-5 shrink-0 text-text-dim" />;

/**
 * Met un objet en corbeille, rafraîchit, et propose « Annuler ».
 *
 * Rend `false` si rien n'est parti — une facture émise, par exemple, que la
 * règle de données refuse (§ 5.6). L'appelant n'a alors rien à défaire.
 *
 * @param apres Le rafraîchissement de la vue appelante — appelé après le jet ET
 *              après une éventuelle annulation.
 */
export async function jeter(
  kind: KindCorbeille,
  id: number,
  titre: string,
  apres: () => unknown,
): Promise<boolean> {
  const lot = await mettreEnCorbeille(kind, id);
  if (lot.ids.length === 0) return false;
  await apres();

  // `titreAffiche` : une entrée de journal se nomme par sa date, écrite en
  // toutes lettres — jamais « 2026-09-23 » dans un toast.
  const nom = titreCourt(titreAffiche({ kind, titre }));
  // Un objectif emporte ses étapes ET ses tâches (2026-09-30) : le toast dit
  // tout ce qui est parti, pas seulement les objectifs.
  const autres = lot.ids.length + (lot.taches?.length ?? 0) - 1;
  afficherToast({
    msg:
      autres > 0
        ? tp(
            autres,
            "« {titre} » et 1 élément sont dans Supprimés récemment",
            "« {titre} » et {n} éléments sont dans Supprimés récemment",
            { titre: nom },
          )
        : t("« {titre} » est dans Supprimés récemment", { titre: nom }),
    icone: iconeCorbeille,
    actionLabel: t("Annuler"),
    // ⚠️ `kind` et `id` sont ceux de CE jet — fermés ici, jamais relus.
    onAction: () => {
      void (async () => {
        await restaurer(kind, id);
        await apres();
      })();
    },
    lienLabel: t("Voir"),
    onLien: () => allerVers("corbeille"),
    duree: DUREE_ANNULER,
  });
  return true;
}

/** Ce qu'un jet a réellement emporté — la cible fermée de son « Annuler » (règle 15). */
export interface Jete {
  kind: KindCorbeille;
  id: number;
}

/**
 * ⭐ PLUSIEURS OBJETS, UN SEUL TOAST — le nœud d'une carte qui part avec sa
 * tâche, son étape et ce qui pend dessous (2026-09-29). Trois `jeter()` à la
 * suite feraient trois toasts, chacun remplaçant le précédent : seul le
 * dernier « Annuler » resterait, et il ne rendrait qu'un objet sur trois.
 *
 * `surAnnuler` : ce que l'appelant défait en plus (la carte remet ses nœuds).
 * Rend ce qui est vraiment parti, pour qu'un ⌘Z puisse le rendre sans toast.
 */
export async function jeterPlusieurs(
  elements: readonly (Jete & { titre: string })[],
  apres: () => unknown,
  surAnnuler?: () => void,
  /**
   * Le message du toast, quand le geste n'est pas « supprimer le premier
   * élément » — retirer une carte de sa note, par exemple. Reçoit le nombre
   * total d'objets partis dans la corbeille.
   */
  message?: (total: number) => string,
): Promise<Jete[]> {
  const partis: (Jete & { titre: string })[] = [];
  let total = 0;
  for (const e of elements) {
    const lot = await mettreEnCorbeille(e.kind, e.id);
    if (lot.ids.length === 0) continue;
    partis.push(e);
    total += lot.ids.length + (lot.taches?.length ?? 0);
  }
  if (partis.length === 0) return [];
  await apres();

  const nom = titreCourt(titreAffiche(partis[0]));
  const autres = total - 1;
  const jetes = partis.map(({ kind, id }) => ({ kind, id }));
  afficherToast({
    msg: message
      ? message(total)
      : autres > 0
        ? tp(
            autres,
            "« {titre} » et 1 élément sont dans Supprimés récemment",
            "« {titre} » et {n} éléments sont dans Supprimés récemment",
            { titre: nom },
          )
        : t("« {titre} » est dans Supprimés récemment", { titre: nom }),
    icone: iconeCorbeille,
    actionLabel: t("Annuler"),
    onAction: () => {
      void (async () => {
        await restaurerJetes(jetes);
        await apres();
        surAnnuler?.();
      })();
    },
    lienLabel: t("Voir"),
    onLien: () => allerVers("corbeille"),
    duree: DUREE_ANNULER,
  });
  return jetes;
}

/**
 * Rend ce qu'un `jeterPlusieurs` a emporté, dans l'ordre INVERSE — une étape
 * revient avant la tâche qui s'y rattachait. Sans toast : c'est le ⌘Z de la
 * carte, ou l'« Annuler » du toast lui-même.
 */
export async function restaurerJetes(jetes: readonly Jete[]): Promise<void> {
  for (const j of [...jetes].reverse()) await restaurer(j.kind, j.id);
}

/**
 * Les objets qu'emporterait la disparition de ces cartes, résolus en lignes
 * locales. Lit la base elle-même : les vues qui suppriment une note n'ont pas
 * toutes les habitudes sous la main (le Savoir n'a pas `AppData`).
 */
export async function elementsDesCartes(cartes: readonly Carte[]): Promise<(Jete & { titre: string })[]> {
  if (cartes.length === 0) return [];
  const data = await fetchAll(todayStr());
  return resoudreEmportes(objetsDesCartes(cartes, data.goals), data);
}

/**
 * ⭐ JETER UNE NOTE, UNE FICHE OU UN SUJET AVEC CE QUE SES CARTES ONT CRÉÉ
 * (demande d'Antonin, 2026-09-30 : « si une carte mentale liée à un objectif
 * est supprimée, les tâches liées le soient aussi »).
 *
 * Un nœud typé EST son objet (`objectifs/emportes.ts`) : supprimer la page qui
 * porte la carte emporte donc les tâches, étapes et habitudes que ses nœuds
 * désignent — un seul toast, un seul « Annuler » qui rend tout. Sans carte,
 * c'est exactement `jeter()`.
 *
 * `corps` : le HTML le plus frais qu'a l'appelant (l'éditeur ouvert), ou `null`
 * s'il ne l'a pas — c'est alors à lui de le lire avant.
 */
export async function jeterAvecSesCartes(
  kind: "note" | "knowledge" | "object",
  id: number,
  titre: string,
  corps: string | null | undefined,
  apres: () => unknown,
): Promise<boolean> {
  const emportes = await elementsDesCartes(cartesDuHtml(corps));
  if (emportes.length === 0) return jeter(kind, id, titre, apres);
  const jetes = await jeterPlusieurs([{ kind, id, titre }, ...emportes], apres);
  return jetes.length > 0;
}

/**
 * La phrase qu'une confirmation dit avant de jeter un objectif ou une étape :
 * « Il part dans Supprimés récemment avec 2 étapes et 5 tâches. » Depuis le
 * 2026-09-30, les tâches partent avec lui — la confirmation le DIT.
 *
 * Deux morceaux au plus : le « et » est une clé de traduction, pas une
 * conjonction recollée à la main (`Intl.ListFormat` n'est pas dans la `lib`
 * TypeScript du projet).
 */
export function annonceDepart(
  genre: "objectif" | "etape",
  bilan: { etapes: number; taches: number },
): string {
  const morceaux = [
    bilan.etapes > 0 &&
      (genre === "objectif"
        ? tp(bilan.etapes, "{n} étape", "{n} étapes")
        : tp(bilan.etapes, "{n} sous-étape", "{n} sous-étapes")),
    bilan.taches > 0 && tp(bilan.taches, "{n} tâche", "{n} tâches"),
  ].filter((x): x is string => !!x);
  const liste = morceaux.length === 2 ? t("{a} et {b}", { a: morceaux[0], b: morceaux[1] }) : (morceaux[0] ?? "");
  return genre === "objectif"
    ? t("Il part dans Supprimés récemment avec {liste}.", { liste })
    : t("Elle part dans Supprimés récemment avec {liste}.", { liste });
}

/** Ouvre l'objet restauré là où il vit — l'objet lui-même quand il se lie, sinon son module. */
export function voirObjet(kind: KindCorbeille, uid: string | null): void {
  if (uid && LIABLES.includes(kind)) void ouvrirObjet(kind as LinkKind, uid);
  else allerVers(FAMILLES[kind].vue);
}

/** Restaure depuis la vue « Supprimés récemment », et propose « Voir ». */
export async function restaurerAvecToast(
  el: Pick<ElementCorbeille, "kind" | "id" | "uid" | "titre">,
  apres: () => unknown,
): Promise<void> {
  const plan = await restaurer(el.kind, el.id);
  await apres();
  if (!plan) return;
  afficherToast({
    msg: t("« {titre} » est de retour", { titre: titreCourt(titreAffiche(el)) }),
    actionLabel: t("Voir"),
    onAction: () => voirObjet(el.kind, el.uid),
  });
}

/** Supprime pour de bon depuis la vue — sans « Annuler » : c'est irréversible, et la confirmation l'a dit. */
export async function supprimerPourDeBon(
  el: Pick<ElementCorbeille, "kind" | "id" | "titre">,
  apres: () => unknown,
): Promise<void> {
  const n = await supprimerDefinitivement(el.kind, el.id);
  await apres();
  if (n === 0) return;
  afficherToast({
    msg: t("« {titre} » est supprimé pour de bon", { titre: titreCourt(titreAffiche(el)) }),
    icone: iconeCorbeille,
  });
}
