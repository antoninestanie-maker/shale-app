/**
 * Ce qu'un menu contextuel propose sur un DOCUMENT de facturation (facture,
 * devis, avoir — vente ou achat).
 *
 * ⚠️⚠️ SEUL UN BROUILLON VA À LA CORBEILLE (Phase 0, validé par Antonin). Une
 * facture émise a un numéro de la série légale : la faire disparaître, même
 * trente jours, ouvrirait un trou dans la numérotation. Elle s'annule par un
 * AVOIR, depuis sa fenêtre. L'entrée « Supprimer » reste donc AFFICHÉE et
 * grisée, avec sa raison — une entrée qui disparaît sans dire pourquoi fait
 * chercher un bouton qui n'existe pas.
 *
 * ⚠️ RÈGLE 18 — « Supprimer le brouillon » appelle `jeterBrouillon`, la MÊME
 * fonction que le bouton « Supprimer » de la fenêtre du brouillon.
 */

import { IconPencil, IconSend, IconTrash } from "../../icons";
import { IconCopier } from "../icones";
import { t } from "../../../lib/i18n";
import type { EntreePossible } from "../../../lib/menu/entrees";
import { copierTexte } from "../../../lib/menu/pressePapier";
import type { Invoice } from "../../../lib/types";
import { jeter } from "../../corbeille/geste";

/** Le bouton de la fenêtre ET l'entrée du menu. Rend `false` si le document n'est pas un brouillon. */
export function jeterBrouillon(facture: Invoice, apres: () => unknown): Promise<boolean> {
  return jeter("invoice", facture.id, facture.objet ?? facture.numero ?? "", apres);
}

export interface GestesFacture {
  /** Le crayon de la ligne. */
  ouvrir: (f: Invoice) => void;
  /** Le bouton d'encaissement de la ligne — `null` quand la ligne ne l'a pas. */
  encaisser: ((f: Invoice) => void) | null;
  supprimer: (f: Invoice) => Promise<void>;
}

export function entreesFacture(f: Invoice, gestes: GestesFacture): EntreePossible[] {
  const brouillon = f.statut === "brouillon";
  const encaisser = gestes.encaisser;
  return [
    {
      id: "ouvrir",
      libelle: brouillon ? t("Modifier…") : t("Ouvrir"),
      icone: <IconPencil />,
      executer: () => gestes.ouvrir(f),
    },
    encaisser && {
      id: "encaisser",
      libelle: f.sens === "achat" ? t("Enregistrer un décaissement") : t("Enregistrer un encaissement"),
      icone: <IconSend />,
      executer: () => encaisser(f),
    },
    f.numero != null && {
      id: "copier-numero",
      libelle: t("Copier le numéro"),
      icone: <IconCopier />,
      executer: async () => {
        await copierTexte(f.numero ?? "");
      },
    },
    {
      id: "supprimer",
      libelle: brouillon ? t("Supprimer le brouillon") : t("Supprimer"),
      icone: <IconTrash />,
      danger: true,
      desactive: brouillon
        ? undefined
        : { raison: t("Un document émis ne se supprime pas : il s'annule par un avoir, depuis sa fenêtre.") },
      executer: () => gestes.supprimer(f),
    },
  ];
}
