// ─────────────────────────────────────────────────────────────────────────────
// Ce qu'un document DOIT porter — le contenu légal, séparé du dessin.
//
// ⚠️ CE FICHIER EST PUR, ET C'EST TOUT SON INTÉRÊT. Les mentions obligatoires
// d'une facture ne sont pas une question de mise en page : elles sont une
// question de droit. En les calculant ici, on peut les TESTER — une facture à
// laquelle il manque le SIRET de l'émetteur ou la mention de franchise est
// irrégulière, et c'est le genre de défaut qu'on ne voit pas en regardant un
// PDF joli.
//
// `pdf.ts` ne fait que dessiner ce que ce fichier décide.
//
// ⭐ L'ÉMETTEUR VIENT DE L'INSTANTANÉ FIGÉ quand il existe. Un document émis en
// 2026 doit se réimprimer en 2028 avec l'adresse de 2026 — sinon on produit un
// document que le client n'a jamais reçu. C'est précisément ce que la colonne
// `emetteur_fige` (migration 023) sert à garantir, et le seul endroit qui la
// consomme est ici.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Invoice,
  InvoiceIssuer,
  InvoiceLine,
  InvoiceParty,
} from "../../types";
import { formaterCents, formaterQuantite } from "../montants";
import {
  MENTION_FRANCHISE,
  formaterTaux,
  totauxFacture,
  type VentilationTaux,
} from "./totaux";

/** Une partie, réduite aux lignes qui s'impriment. */
export interface BlocPartie {
  nom: string;
  lignes: string[];
  /** SIREN/SIRET/TVA, déjà étiquetés. */
  identifiants: string[];
}

export interface LigneImprimable {
  description: string;
  quantite: string;
  prixUnitaire: string;
  /** Vide en franchise en base. */
  taux: string;
  totalHt: string;
}

export interface DocumentImprimable {
  /** « Facture », « Avoir », « Devis » — le mot qui titre la page. */
  titre: string;
  numero: string;
  dateEmission: string;
  dateEcheance: string;
  objet: string;
  emetteur: BlocPartie;
  destinataire: BlocPartie;
  lignes: LigneImprimable[];
  franchise: boolean;
  ventilation: VentilationTaux[];
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  /**
   * Toutes les mentions à imprimer, dans l'ordre — la mention légale de régime
   * d'abord, puis les conditions, les pénalités et l'indemnité.
   */
  mentions: string[];
  /** Coordonnées bancaires, si l'émetteur en a. */
  reglement: string[];
  /**
   * ⚠️ Ce qui MANQUE pour que le document soit régulier. Vide = complet.
   * Ce n'est pas bloquant — on imprime quand même — mais l'interface doit le
   * dire : mieux vaut une facture émise avec un avertissement qu'une facture
   * irrégulière émise en silence.
   */
  manques: string[];
}

/**
 * Le montant légal de l'indemnité forfaitaire de recouvrement entre
 * professionnels. Il est de 40 € depuis 2012 (art. D. 441-5 du code de
 * commerce) ; la valeur reste stockée sur l'émetteur pour qu'un changement de
 * texte n'impose pas une migration.
 */
export const INDEMNITE_LEGALE_CENTS = 4000;

function bloc(
  nom: string,
  adresse: (string | null)[],
  identifiants: [string, string | null][],
): BlocPartie {
  return {
    nom,
    lignes: adresse.filter((x): x is string => !!x && x.trim() !== ""),
    identifiants: identifiants
      .filter(([, v]) => !!v && v.trim() !== "")
      .map(([label, v]) => `${label} ${v}`),
  };
}

/**
 * Assemble le document imprimable.
 *
 * ⚠️ `emetteurCourant` n'est utilisé QUE si la facture ne porte pas
 * d'instantané — c'est-à-dire pour un brouillon, à l'aperçu. Dès qu'elle est
 * émise, c'est l'instantané qui fait foi, et il ne se relit jamais ailleurs.
 */
export function documentImprimable(
  facture: Invoice,
  lignes: readonly InvoiceLine[],
  destinataire: InvoiceParty | null,
  emetteurCourant: InvoiceIssuer | null,
  locale = "fr-FR",
): DocumentImprimable {
  const em = emetteurDe(facture, emetteurCourant);
  const franchise = em?.regime === "franchise_en_base";
  const totaux = totauxFacture(lignes, { franchiseEnBase: franchise });
  const devise = facture.devise || "EUR";

  const titre =
    facture.type === "avoir" ? "Avoir" : facture.type === "devis" ? "Devis" : "Facture";

  const mentions: string[] = [];
  // ⭐ La mention de régime EN PREMIER : c'est la seule qui soit obligatoire
  // par elle-même, et son absence rend le document irrégulier.
  if (franchise) mentions.push(MENTION_FRANCHISE);
  if (facture.mentions && facture.mentions.trim() !== "" && facture.mentions !== MENTION_FRANCHISE)
    mentions.push(facture.mentions.trim());
  if (facture.conditions_paiement) mentions.push(facture.conditions_paiement);
  if (em?.penalites_retard) mentions.push(em.penalites_retard);

  // ⚠️ L'indemnité forfaitaire n'a de sens qu'entre PROFESSIONNELS, et elle ne
  // s'applique pas à un devis (rien n'est dû) ni à un avoir (rien n'est
  // réclamé).
  if (facture.type === "facture" && facture.sens === "vente" && em)
    mentions.push(
      `Indemnité forfaitaire pour frais de recouvrement : ${formaterCents(
        em.indemnite_forfaitaire_cents,
        devise,
        locale,
      )}`,
    );

  const reglement: string[] = [];
  if (em?.iban) reglement.push(`IBAN ${em.iban}`);
  if (em?.bic) reglement.push(`BIC ${em.bic}`);

  return {
    titre,
    numero: facture.numero ?? "",
    dateEmission: facture.date_emission ?? "",
    dateEcheance: facture.date_echeance ?? "",
    objet: facture.objet ?? "",
    emetteur: bloc(
      em?.denomination ?? "",
      [
        em?.forme_juridique ?? null,
        em?.adresse ?? null,
        [em?.code_postal, em?.ville].filter(Boolean).join(" ") || null,
        em?.pays ?? null,
      ],
      [
        ["SIRET", em?.siret ?? null],
        ["SIREN", em?.siren ?? null],
        ["RCS", em?.rcs ?? null],
        ["APE", em?.ape ?? null],
        ["TVA", em?.tva_intra ?? null],
      ],
    ),
    destinataire: bloc(
      destinataire?.nom ?? "",
      [
        destinataire?.adresse ?? null,
        [destinataire?.code_postal, destinataire?.ville].filter(Boolean).join(" ") || null,
        destinataire?.pays ?? null,
      ],
      [
        ["SIRET", destinataire?.siret ?? null],
        ["TVA", destinataire?.tva_intra ?? null],
      ],
    ),
    lignes: [...lignes]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        description: l.description,
        quantite: formaterQuantite(l.quantite_e8, locale),
        prixUnitaire: formaterCents(l.prix_unitaire_cents, devise, locale),
        taux: franchise ? "" : formaterTaux(l.taux_tva_e4, locale),
        totalHt: formaterCents(l.total_ht_cents, devise, locale),
      })),
    franchise,
    ventilation: totaux.ventilation,
    totalHt: formaterCents(totaux.totalHtCents, devise, locale),
    totalTva: formaterCents(totaux.totalTvaCents, devise, locale),
    totalTtc: formaterCents(totaux.totalTtcCents, devise, locale),
    mentions,
    reglement,
    manques: manquesLegaux(facture, lignes, destinataire, em),
  };
}

/** L'émetteur figé si le document en porte un, sinon l'émetteur courant. */
export function emetteurDe(
  facture: Pick<Invoice, "emetteur_fige">,
  courant: InvoiceIssuer | null,
): InvoiceIssuer | null {
  if (!facture.emetteur_fige) return courant;
  try {
    return JSON.parse(facture.emetteur_fige) as InvoiceIssuer;
  } catch {
    // ⚠️ Un instantané illisible ne doit PAS faire échouer l'impression : on
    // retombe sur l'émetteur courant, qui est au pire légèrement postérieur.
    // Perdre la facture entière pour un JSON abîmé serait disproportionné.
    return courant;
  }
}

/**
 * Ce qui manque pour que le document soit RÉGULIER.
 *
 * ⚠️ Liste volontairement courte : elle ne contient que ce dont l'absence est
 * une irrégularité, pas ce qui serait « mieux ». Une liste qui crie pour tout
 * finit par ne plus être lue.
 */
export function manquesLegaux(
  facture: Pick<Invoice, "type" | "sens" | "numero" | "date_emission">,
  lignes: readonly InvoiceLine[],
  destinataire: InvoiceParty | null,
  emetteur: InvoiceIssuer | null,
): string[] {
  const out: string[] = [];
  // Un achat n'est pas MON document : je n'ai pas à en garantir la régularité.
  if (facture.sens === "achat") return out;

  if (!emetteur || !emetteur.denomination.trim())
    out.push("La dénomination de l'émetteur est vide.");
  if (emetteur && !emetteur.siret && !emetteur.siren)
    out.push("L'émetteur n'a ni SIRET ni SIREN.");
  if (emetteur && !emetteur.adresse) out.push("L'adresse de l'émetteur est vide.");
  if (!destinataire) out.push("Aucun client n'est renseigné.");
  else if (!destinataire.adresse) out.push("L'adresse du client est vide.");
  if (lignes.length === 0) out.push("Le document n'a aucune ligne.");
  // Un devis n'a pas d'obligation de numérotation légale.
  if (facture.type !== "devis" && !facture.numero)
    out.push("Le document n'a pas de numéro.");
  if (!facture.date_emission) out.push("Le document n'a pas de date d'émission.");

  return out;
}
