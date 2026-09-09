// ─────────────────────────────────────────────────────────────────────────────
// Le SECOND runway — celui qui voit les créances arriver.
//
// ⚠️⚠️ LE RUNWAY PRUDENT NE CHANGE PAS DE DÉFINITION. C'est la contrainte
// centrale de ce fichier. `runway.ts` reste intact, mot pour mot : quelqu'un a
// déjà pris une décision sur le chiffre qu'il produit, et redéfinir un chiffre
// sous les pieds de celui qui s'y fie est la pire chose qu'un outil financier
// puisse faire. On en AJOUTE un second, à côté, nommé autrement.
//
// LES DEUX QUESTIONS, ET POURQUOI IL EN FAUT DEUX :
//
//   • prudent        — « combien de mois je tiens avec l'argent que j'AI ? »
//   • avec créances  — « et si mes clients payent à l'échéance ? »
//
// Un indépendant avec 3 000 € en banque et 12 000 € de factures échues dans
// quinze jours n'est pas dans la situation que le premier chiffre décrit. Mais
// il n'est pas non plus dans celle du second : un client peut ne pas payer.
// C'est précisément pour cela que les deux sont affichés CÔTE À CÔTE, et que
// l'un ne remplace jamais l'autre.
//
// ⚠️ AUCUNE PROBABILITÉ ICI NON PLUS. Une créance entre pour son montant plein,
// à sa date d'échéance. Pondérer par un « taux de recouvrement estimé »
// donnerait l'apparence de la rigueur à une invention.
//
// ⚠️ ON N'EXTRAPOLE JAMAIS. Même doctrine que le runway existant : les créances
// sont des événements DATÉS, pas une tendance. Après la dernière échéance
// connue, il ne reste que le burn — donc la même pente qu'avant.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invoice, InvoicePayment } from "../../types";
import type { Burn } from "../burn";
import { JOURS_PAR_MOIS, joursEntre } from "../calendrier";
import type { Runway, RunwayEtat } from "../runway";
import { dateEpuisement } from "../runway";
import { etatFacture } from "./statuts";

/** Un encaissement ou un décaissement ATTENDU, à sa date d'échéance. */
export interface EcheanceAttendue {
  /** 'YYYY-MM-DD'. */
  date: string;
  /** SIGNÉ : positif = une créance rentre, négatif = une dette sort. */
  cents: number;
  invoiceId: number;
}

/**
 * Ce qu'on attend, et quand.
 *
 * ⚠️ UN DEVIS N'ENTRE JAMAIS. Un devis n'est pas dû : le compter reviendrait à
 * dépenser un contrat qu'on n'a pas signé.
 *
 * ⚠️ Une facture SANS ÉCHÉANCE n'entre pas non plus. On ne sait pas quand
 * l'argent arrive, et lui inventer une date — « dans 30 jours » — placerait un
 * événement précis sur une donnée absente.
 *
 * ⭐ UNE ÉCHÉANCE DÉJÀ PASSÉE ET IMPAYÉE ENTRE À LA DATE DU JOUR, pas à sa date
 * d'échéance. Une créance échue depuis trois mois est toujours attendue ; la
 * dater dans le passé la ferait entrer avant le point de départ de la
 * projection, donc disparaître du calcul. C'est le contraire de ce qu'on veut :
 * ce sont justement les créances en retard qui pèsent le plus.
 */
export function echeancesAttendues(
  factures: readonly Invoice[],
  paiements: readonly InvoicePayment[],
  aujourdhui: string,
): EcheanceAttendue[] {
  const parFacture = new Map<number, InvoicePayment[]>();
  for (const p of paiements) {
    const liste = parFacture.get(p.invoice_id);
    if (liste) liste.push(p);
    else parFacture.set(p.invoice_id, [p]);
  }

  const out: EcheanceAttendue[] = [];
  for (const f of factures) {
    if (f.type === "devis") continue;
    if (f.date_echeance === null) continue;

    const etat = etatFacture(f, parFacture.get(f.id) ?? [], aujourdhui);
    if (etat.statut === "brouillon" || etat.statut === "annulee") continue;
    if (etat.resteDuCents === 0) continue;

    out.push({
      date: f.date_echeance < aujourdhui ? aujourdhui : f.date_echeance,
      cents: f.sens === "achat" ? -etat.resteDuCents : etat.resteDuCents,
      invoiceId: f.id,
    });
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Runway « avec créances ».
 *
 * ⚠️ LES QUATRE ÉTATS D'IMPOSSIBILITÉ DU RUNWAY EXISTANT SONT RESPECTÉS, et
 * dans le même ordre — c'est ce qui permet à l'interface de traiter les deux
 * chiffres avec le même code. Sans liquidités connues rien n'est calculable ;
 * sans burn déclaré on ne devine pas ; un burn couvert ne s'épuise pas.
 *
 * ⭐ LE CALCUL EST UNE SIMULATION JOUR PAR JOUR, pas une division.
 *
 * Une division `(liquidités + créances) ÷ burn` serait fausse et
 * confortablement fausse : elle supposerait que l'argent est là dès aujourd'hui.
 * Quelqu'un dont la trésorerie tombe à zéro le 12 du mois et dont le client
 * paye le 20 est en défaut le 12, même si le total de fin de mois est
 * confortable. Le trou se voit en avançant dans le temps, jamais en divisant.
 *
 * On avance donc jour par jour : le burn ronge au prorata quotidien, les
 * échéances entrent à leur date, et on s'arrête au premier jour où le solde
 * passe sous zéro.
 */
export function runwayAvecCreances(
  liquideCents: number | null,
  burn: Burn,
  echeances: readonly EcheanceAttendue[],
  date: string,
  /**
   * Horizon de simulation, en jours. Au-delà, le chiffre ne décrit plus rien de
   * décidable — et la boucle doit s'arrêter quelque part.
   */
  horizonJours = 366 * 3,
): Runway {
  const base = { liquideCents, burnNetCents: burn.netCents };

  // ── Les quatre impossibilités, dans l'ordre du runway existant ────────────
  if (liquideCents === null)
    return { ...base, etat: "sans-donnees", mois: null, dateEpuisement: null };

  if (burn.actifs === 0)
    return { ...base, etat: "sans-burn", mois: null, dateEpuisement: null };

  // ⚠️ Le burn NET couvert ⇒ infini, et les créances n'y changent rien : elles
  // ne peuvent qu'ajouter de l'argent à une situation qui ne se dégrade pas.
  // Sauf si les DETTES fournisseurs dépassent tout ce qu'on a — auquel cas
  // c'est la simulation ci-dessous qui le dira. On la laisse donc décider quand
  // il y a des échéances négatives, plutôt que de conclure « infini » trop vite.
  const dettes = echeances.reduce((s, e) => (e.cents < 0 ? s + e.cents : s), 0);
  if (burn.netCents <= 0 && liquideCents + dettes >= 0)
    return { ...base, etat: "infini", mois: null, dateEpuisement: null };

  if (liquideCents <= 0 && !echeances.some((e) => e.cents > 0))
    return { ...base, etat: "epuise", mois: 0, dateEpuisement: date };

  // ── La simulation ─────────────────────────────────────────────────────────
  // Le burn est mensuel ; on le ramène au jour par la longueur MOYENNE d'un
  // mois, la même constante que le reste du module. Un mois calendaire exact
  // ferait varier la pente de 3 % selon février ou juillet, pour une prévision
  // qui n'a pas cette précision.
  const burnParJour = burn.netCents / JOURS_PAR_MOIS;

  // Index des entrées par nombre de jours écoulés depuis `date`.
  const parJour = new Map<number, number>();
  for (const e of echeances) {
    const j = Math.max(0, joursEntre(date, e.date));
    if (j > horizonJours) continue;
    parJour.set(j, (parJour.get(j) ?? 0) + e.cents);
  }

  let solde = liquideCents;
  for (let j = 0; j <= horizonJours; j++) {
    solde += parJour.get(j) ?? 0;
    if (solde < 0) {
      const mois = j / JOURS_PAR_MOIS;
      return {
        ...base,
        etat: j === 0 ? "epuise" : "ok",
        mois,
        dateEpuisement: dateEpuisement(date, mois),
      };
    }
    solde -= burnParJour;
  }

  // ⚠️ Tenu jusqu'au bout de l'horizon : on ne dit PAS « infini ». Infini a un
  // sens précis dans ce module — les revenus récurrents couvrent les charges —
  // et ce n'est pas le cas ici : c'est seulement qu'on a cessé de regarder.
  // `mois` porte donc l'horizon atteint, et l'interface dit « plus de N mois ».
  return {
    ...base,
    etat: "ok",
    mois: horizonJours / JOURS_PAR_MOIS,
    dateEpuisement: null,
  };
}

/**
 * Les deux runways, prêts à être affichés côte à côte.
 *
 * ⭐ `ecart` n'est renseigné que si les DEUX sont calculables et chiffrés :
 * comparer « 4,2 mois » à « sans données » ne veut rien dire, et afficher un
 * écart dans ce cas laisserait croire à une mesure.
 */
export interface DeuxRunways {
  prudent: Runway;
  avecCreances: Runway;
  /** Mois gagnés par les créances. `null` si la comparaison n'a pas de sens. */
  ecartMois: number | null;
}

export function comparerRunways(prudent: Runway, avecCreances: Runway): DeuxRunways {
  const comparable =
    prudent.mois !== null &&
    avecCreances.mois !== null &&
    estChiffre(prudent.etat) &&
    estChiffre(avecCreances.etat);

  return {
    prudent,
    avecCreances,
    ecartMois: comparable ? (avecCreances.mois as number) - (prudent.mois as number) : null,
  };
}

function estChiffre(etat: RunwayEtat): boolean {
  return etat === "ok" || etat === "epuise";
}
