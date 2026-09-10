// ─────────────────────────────────────────────────────────────────────────────
// Factur-X — le XML CII qui voyage DANS le PDF.
//
// CE QUE C'EST. Depuis 2026, la facturation électronique entre entreprises
// françaises se généralise : un document lisible par un humain (le PDF) qui
// porte, en pièce jointe, le même contenu lisible par une machine (ce XML).
// La norme s'appelle Factur-X en France, ZUGFeRD en Allemagne ; c'est le même
// format, et le profil BASIC est le plus petit qui soit exploitable.
//
// ⚠️⚠️ RÉSERVE À DIRE NOIR SUR BLANC, ET RÉPÉTÉE DANS LA DOCUMENTATION :
//
//     Ce qu'on produit est un PDF VALIDE portant un XML Factur-X CONFORME.
//     Ce n'est PAS un PDF/A-3 CERTIFIÉ.
//
// La différence n'est pas cosmétique. PDF/A-3 impose un profil de couleurs
// embarqué, des polices toutes incorporées avec leurs métriques, un
// dictionnaire XMP complet et une déclaration de conformité vérifiable par un
// validateur agréé. pdf-lib ne produit pas ça, et prétendre le contraire
// exposerait l'utilisateur à un rejet au moment précis où il compte dessus.
//
// La conformité FINALE se jouera au branchement d'une plateforme de
// dématérialisation partenaire (PDP), en 2027. Ce fichier prépare le terrain :
// le XML est juste, il est complet pour le profil BASIC, et il n'y aura qu'à le
// republier autrement.
//
// ⚠️ AUCUN APPEL RÉSEAU, AUCUNE PLATEFORME BRANCHÉE. « Préparé, pas branché »
// est écrit dans la migration 023 et dans le cadrage du chantier.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invoice, InvoiceIssuer, InvoiceLine, InvoiceParty } from "../../types";
import { E8 } from "../montants";
import { totauxFacture } from "./totaux";
import { emetteurDe } from "./document";

/** Nom de fichier IMPOSÉ par la norme pour la pièce jointe. */
export const NOM_FICHIER_FACTURX = "factur-x.xml";

/** Identifiant du profil BASIC (URN de la spécification EN 16931). */
export const PROFIL_BASIC =
  "urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic";

/**
 * Code du type de document, au sens de la liste UNTDID 1001.
 *
 * ⚠️ 380 = facture, 381 = AVOIR. Se tromper ici fait entrer un avoir comme une
 * facture dans la comptabilité du client — le montant est négatif, mais le sens
 * comptable est faux, et c'est le genre d'erreur qu'une machine ne rattrape pas.
 * Un devis n'a pas de code de facture : il ne s'exporte pas en Factur-X.
 */
export function codeTypeDocument(type: Invoice["type"]): "380" | "381" | null {
  if (type === "facture") return "380";
  if (type === "avoir") return "381";
  return null;
}

/** Échappe le texte pour XML. Sans ça, une raison sociale « Dupont & Fils » casse le document. */
export function echapperXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Centimes → décimal à deux chiffres, sans jamais passer par un flottant. */
export function montantXml(cents: number): string {
  const negatif = cents < 0;
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return negatif ? `-${s}` : s;
}

/** Quantité à l'échelle 10⁻⁸ → décimal lisible, quatre chiffres au plus. */
export function quantiteXml(quantiteE8: number): string {
  const negatif = quantiteE8 < 0;
  const abs = BigInt(Math.abs(quantiteE8));
  const entier = abs / E8;
  const frac = (abs % E8).toString().padStart(8, "0").slice(0, 4).replace(/0+$/, "");
  const s = frac ? `${entier}.${frac}` : `${entier}`;
  return negatif ? `-${s}` : s;
}

/** Taux à l'échelle 10⁻⁴ → « 20.00 ». */
export function tauxXml(tauxE4: number): string {
  return (tauxE4 / 100).toFixed(2);
}

/** 'YYYY-MM-DD' → 'YYYYMMDD', format 102 de la norme. */
export function dateXml(date: string): string {
  return date.replace(/-/g, "");
}

/**
 * ⚠️ Le code de catégorie de TVA, et le cas qui compte ici.
 *
 * `S` = taux normal, `E` = exonéré. La FRANCHISE EN BASE relève de `E`, avec
 * une raison d'exonération obligatoire : sans elle, un validateur rejette le
 * document. C'est le cas NOMINAL de cette app, pas un cas limite.
 */
export function categorieTva(franchise: boolean, tauxE4: number): "S" | "E" | "Z" {
  if (franchise) return "E";
  return tauxE4 > 0 ? "S" : "Z";
}

export const RAISON_EXONERATION_FRANCHISE = "TVA non applicable, art. 293 B du CGI";

/**
 * Le XML Factur-X d'un document, profil BASIC.
 *
 * `null` quand le document ne s'exporte pas — un devis n'est pas une facture,
 * et un achat n'est pas MON document.
 */
export function facturxXml(
  facture: Invoice,
  lignes: readonly InvoiceLine[],
  destinataire: InvoiceParty | null,
  emetteurCourant: InvoiceIssuer | null,
): string | null {
  const code = codeTypeDocument(facture.type);
  if (code === null || facture.sens === "achat") return null;
  if (!facture.numero || !facture.date_emission) return null;

  const em = emetteurDe(facture, emetteurCourant);
  const franchise = em?.regime === "franchise_en_base";
  const totaux = totauxFacture(lignes, { franchiseEnBase: franchise });
  const devise = facture.devise || "EUR";
  const x = echapperXml;

  const lignesXml = [...lignes]
    .sort((a, b) => a.position - b.position)
    .map((l, i) => {
      const taux = franchise ? 0 : l.taux_tva_e4;
      return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${x(l.description || "—")}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${montantXml(l.prix_unitaire_cents)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${quantiteXml(l.quantite_e8)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${categorieTva(franchise, taux)}</ram:CategoryCode>
          <ram:RateApplicablePercent>${tauxXml(taux)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${montantXml(l.total_ht_cents)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
    })
    .join("\n");

  // ⭐ UNE ENTRÉE PAR TAUX, pas un total : c'est la ventilation que la norme
  // attend, et c'est la même que celle imprimée sur le PDF — les deux sortent
  // de `totauxFacture`, donc elles ne peuvent pas diverger.
  const taxesXml = totaux.ventilation
    .map(
      (v) => `      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${montantXml(v.tvaCents)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>${
          franchise
            ? `\n        <ram:ExemptionReason>${x(RAISON_EXONERATION_FRANCHISE)}</ram:ExemptionReason>`
            : ""
        }
        <ram:BasisAmount>${montantXml(v.baseHtCents)}</ram:BasisAmount>
        <ram:CategoryCode>${categorieTva(franchise, v.tauxE4)}</ram:CategoryCode>
        <ram:RateApplicablePercent>${tauxXml(v.tauxE4)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`,
    )
    .join("\n");

  const echeance = facture.date_echeance
    ? `      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${dateXml(facture.date_echeance)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>\n`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${PROFIL_BASIC}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${x(facture.numero)}</ram:ID>
    <ram:TypeCode>${code}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${dateXml(facture.date_emission)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${lignesXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${x(em?.denomination ?? "")}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${x(em?.code_postal ?? "")}</ram:PostcodeCode>
          <ram:LineOne>${x(em?.adresse ?? "")}</ram:LineOne>
          <ram:CityName>${x(em?.ville ?? "")}</ram:CityName>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>${
          em?.siret
            ? `\n        <ram:SpecifiedLegalOrganization>\n          <ram:ID schemeID="0009">${x(em.siret)}</ram:ID>\n        </ram:SpecifiedLegalOrganization>`
            : ""
        }${
          em?.tva_intra
            ? `\n        <ram:SpecifiedTaxRegistration>\n          <ram:ID schemeID="VA">${x(em.tva_intra)}</ram:ID>\n        </ram:SpecifiedTaxRegistration>`
            : ""
        }
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${x(destinataire?.nom ?? "")}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:PostcodeCode>${x(destinataire?.code_postal ?? "")}</ram:PostcodeCode>
          <ram:LineOne>${x(destinataire?.adresse ?? "")}</ram:LineOne>
          <ram:CityName>${x(destinataire?.ville ?? "")}</ram:CityName>
          <ram:CountryID>${x(destinataire?.pays === "France" || !destinataire?.pays ? "FR" : destinataire.pays)}</ram:CountryID>
        </ram:PostalTradeAddress>${
          destinataire?.tva_intra
            ? `\n        <ram:SpecifiedTaxRegistration>\n          <ram:ID schemeID="VA">${x(destinataire.tva_intra)}</ram:ID>\n        </ram:SpecifiedTaxRegistration>`
            : ""
        }
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery/>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${x(devise)}</ram:InvoiceCurrencyCode>
${taxesXml}
${echeance}      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${montantXml(totaux.totalHtCents)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${montantXml(totaux.totalHtCents)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${x(devise)}">${montantXml(totaux.totalTvaCents)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${montantXml(totaux.totalTtcCents)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${montantXml(totaux.totalTtcCents)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
`;
}
