// ─────────────────────────────────────────────────────────────────────────────
// Les relances — une échéance dépassée remonte dans Aujourd'hui et le Calendrier.
//
// ⚠️⚠️ AUCUN SECOND MÉCANISME DE LIAISON N'EST INVENTÉ, et ce fichier est là
// pour le prouver : il ne fait que traduire des factures en `EcheanceFacture`,
// la forme que `lib/calendrier/agenda.ts` sait déjà consommer.
//
// POURQUOI PAS `object_links` (le socle de la migration 020). Sa colonne
// `from_kind`/`to_kind` porte un `CHECK` à liste FERMÉE — 'note', 'knowledge',
// 'task', 'goal', 'event', 'trade', 'object' — et SQLite ne sait pas modifier
// un CHECK : y ajouter 'invoice' imposerait de RECRÉER la table d'arêtes, sur
// une migration supplémentaire, pour des données qui ne sont pas des arêtes.
//
// Et ce n'était de toute façon pas le bon socle : les quatre familles déjà
// affichées par le calendrier (événements, tâches datées, occurrences,
// échéances d'objectifs) n'ont AUCUNE arête. Le calendrier ne possède aucune
// donnée — il RASSEMBLE ce que les modules savent déjà. Une échéance de facture
// est la cinquième source, pas une liaison.
//
// ⚠️ AUCUNE TABLE, AUCUNE MIGRATION SUPPLÉMENTAIRE. Conforme au cadrage.
//
// ⚠️ PAS DE RELANCE AUTOMATIQUE PAR E-MAIL. L'app n'envoie rien à personne :
// elle met sous les yeux, l'utilisateur décide.
// ─────────────────────────────────────────────────────────────────────────────
import type { EcheanceFacture } from "../../calendrier/agenda";
import type { Invoice, InvoiceParty, InvoicePayment } from "../../types";
import { etatFacture } from "./statuts";

/**
 * Les échéances à faire remonter dans le calendrier.
 *
 * ⚠️ Ce qui n'entre PAS, et pourquoi :
 *   • un DEVIS — il n'est pas dû, sa date de validité n'est pas une échéance ;
 *   • un BROUILLON ou une facture ANNULÉE — rien n'est réclamé ;
 *   • une facture SOLDÉE — elle n'a plus de raison d'apparaître ;
 *   • une facture SANS ÉCHÉANCE — on ne lui invente pas de date.
 *
 * ⭐ Les ACHATS entrent, eux : une facture fournisseur à payer le 15 est un
 * rendez-vous avec sa trésorerie autant qu'une créance à recouvrer. Le libellé
 * dit lequel des deux c'est.
 */
export function echeancesDuCalendrier(
  factures: readonly Invoice[],
  paiements: readonly InvoicePayment[],
  tiers: readonly InvoiceParty[],
  aujourdhui: string,
): EcheanceFacture[] {
  const parFacture = new Map<number, InvoicePayment[]>();
  for (const p of paiements) {
    const liste = parFacture.get(p.invoice_id);
    if (liste) liste.push(p);
    else parFacture.set(p.invoice_id, [p]);
  }
  const nomDe = new Map(tiers.map((t) => [t.id, t.nom]));

  const out: EcheanceFacture[] = [];
  for (const f of factures) {
    if (f.type === "devis") continue;
    if (f.date_echeance === null) continue;

    const etat = etatFacture(f, parFacture.get(f.id) ?? [], aujourdhui);
    if (etat.statut === "brouillon" || etat.statut === "annulee") continue;
    // ⚠️ `aEchoir || enRetard` et non « reste dû ≠ 0 » : c'est `statuts.ts` qui
    // décide de ce qui est exigible, et un avoir n'y est jamais.
    if (!etat.aEchoir && !etat.enRetard) continue;

    const qui = f.party_id === null ? "" : (nomDe.get(f.party_id) ?? "");
    out.push({
      id: f.id,
      date: f.date_echeance,
      titre: libelle(f, qui),
      enRetard: etat.enRetard,
    });
  }
  return out;
}

/**
 * Le libellé affiché dans la journée.
 *
 * ⚠️ Valeurs FRANÇAISES assemblées ici, traduites à l'affichage par l'appelant
 * — jamais de `t()` dans une couche pure, qui serait figée dans la langue de
 * départ et intestable.
 */
function libelle(f: Invoice, qui: string): string {
  const quoi = f.numero ?? (f.sens === "achat" ? "Achat" : "Facture");
  return qui ? `${quoi} · ${qui}` : quoi;
}

/**
 * Les échéances qui MÉRITENT d'être annoncées aujourd'hui.
 *
 * ⭐ Deux cas seulement : ce qui échoit AUJOURD'HUI, et ce qui est déjà en
 * retard. Annoncer « échéance dans 12 jours » chaque matin pendant douze jours
 * apprend à ignorer l'annonce — c'est la même règle que le seuil de surcharge
 * du calendrier, fixé à 1,0 pour ne pas crier trop souvent.
 */
export function relancesDuJour(
  echeances: readonly EcheanceFacture[],
  aujourdhui: string,
): EcheanceFacture[] {
  return echeances
    .filter((e) => e.enRetard || e.date === aujourdhui)
    .sort((a, b) => a.date.localeCompare(b.date));
}
