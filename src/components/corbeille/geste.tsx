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
  mettreEnCorbeille,
  restaurer,
  supprimerDefinitivement,
} from "../../lib/repo";
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
  apres: () => Promise<void> | void,
): Promise<boolean> {
  const lot = await mettreEnCorbeille(kind, id);
  if (lot.ids.length === 0) return false;
  await apres();

  const nom = titreCourt(titre || t("Sans titre"));
  const autres = lot.ids.length - 1;
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

/** Ouvre l'objet restauré là où il vit — l'objet lui-même quand il se lie, sinon son module. */
export function voirObjet(kind: KindCorbeille, uid: string | null): void {
  if (uid && LIABLES.includes(kind)) void ouvrirObjet(kind as LinkKind, uid);
  else allerVers(FAMILLES[kind].vue);
}

/** Restaure depuis la vue « Supprimés récemment », et propose « Voir ». */
export async function restaurerAvecToast(
  el: Pick<ElementCorbeille, "kind" | "id" | "uid" | "titre">,
  apres: () => Promise<void> | void,
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
  apres: () => Promise<void> | void,
): Promise<void> {
  const n = await supprimerDefinitivement(el.kind, el.id);
  await apres();
  if (n === 0) return;
  afficherToast({
    msg: t("« {titre} » est supprimé pour de bon", { titre: titreCourt(titreAffiche(el)) }),
    icone: iconeCorbeille,
  });
}
