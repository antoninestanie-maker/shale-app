// Enregistrer ce qui est réellement entré en banque.
//
// ⚠️ C'EST LE GESTE QUI TOUCHE LE RUNWAY. Un encaissement saisi ici modifie le
// solde composé (`patrimoine.ts`), donc le chiffre roi du module. D'où deux
// garde-fous qui ne sont PAS de la coquetterie de formulaire :
//
//   ① un montant supérieur au reste dû est REFUSÉ, avec le montant réel. Dans
//      neuf cas sur dix c'est un zéro de trop, et l'accepter ferait entrer un
//      trop-perçu dans la trésorerie ;
//   ② le compte crédité peut rester vide, et le formulaire DIT ce que ça
//      coûte : sans compte, l'app ne sait pas où l'argent est arrivé, donc le
//      paiement ne rejoint aucun solde. Le laisser deviner produirait un
//      patrimoine faux.
import { useState } from "react";

import { IconAlert } from "../icons";
import { Dialogue } from "./ComptesPanel";
import { Champ, ChampMontant, Montant, inputCls } from "./champs";
import { refusPaiement, resteDuCents } from "../../lib/finance/facturation/statuts";
import { createInvoicePayment, deleteInvoicePayment, setInvoiceStatut } from "../../lib/repo";
import { statutCalcule } from "../../lib/finance/facturation/statuts";
import type { FinanceAccount, Invoice, InvoicePayment } from "../../lib/types";
import { formatDate, t } from "../../lib/i18n";

/** Moyens proposés. Valeurs FRANÇAISES stockées, traduites à l'affichage. */
const MOYENS = ["Virement", "Carte", "Chèque", "Espèces", "Prélèvement"] as const;

export default function FormulaireEncaissement({
  facture,
  paiements,
  comptes,
  aujourdhui,
  onFerme,
  onChange,
}: {
  facture: Invoice;
  /** Les paiements DÉJÀ enregistrés sur cette facture. */
  paiements: readonly InvoicePayment[];
  comptes: readonly FinanceAccount[];
  aujourdhui: string;
  onFerme: () => void;
  onChange: () => Promise<void> | void;
}) {
  const achat = facture.sens === "achat";
  const reste = resteDuCents(facture, paiements);

  const [montantCents, setMontantCents] = useState<number | null>(reste);
  const [date, setDate] = useState(aujourdhui);
  const [accountId, setAccountId] = useState<number | null>(
    comptes.find((c) => c.is_liquid === 1 && c.archived === 0)?.id ?? null,
  );
  const [moyen, setMoyen] = useState<string>("Virement");
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);

  const refus = refusPaiement(facture, paiements, {
    montantCents: montantCents ?? 0,
    date,
  });

  const valider = async () => {
    if (refus || montantCents === null) return;
    setEnCours(true);
    try {
      await createInvoicePayment({
        invoice_id: facture.id,
        date,
        montant_cents: montantCents,
        devise: facture.devise,
        // ⚠️ Le taux est FIGÉ à la saisie, jamais relu ensuite : sinon le
        // montant encaissé changerait tout seul entre deux ouvertures.
        taux_change_e8: facture.taux_change_e8,
        account_id: accountId,
        moyen,
        note: note || null,
      });

      // Le statut suit les paiements — il n'est pas décidé par ce formulaire.
      const apres = [...paiements, { montant_cents: montantCents }];
      const statut = statutCalcule(facture, apres);
      if (statut !== facture.statut) await setInvoiceStatut(facture.id, statut);

      await onChange();
      onFerme();
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async (id: number) => {
    await deleteInvoicePayment(id);
    const restants = paiements.filter((p) => p.id !== id);
    const statut = statutCalcule(facture, restants);
    if (statut !== facture.statut) await setInvoiceStatut(facture.id, statut);
    await onChange();
  };

  return (
    <Dialogue
      titre={achat ? t("Enregistrer un décaissement") : t("Enregistrer un encaissement")}
      onFerme={onFerme}
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-[10px] border border-border bg-overlay px-3 py-2">
          <p className="truncate text-sm text-text">
            {facture.numero ?? t("Brouillon")}
            {facture.objet ? ` · ${facture.objet}` : ""}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-text-dim">
            {t("Reste à payer")}
            <Montant cents={reste} devise={facture.devise} className="text-xs" />
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ChampMontant
            label={t("Montant")}
            valeurCents={montantCents}
            onChange={setMontantCents}
            autoFocus
          />
          <Champ label={t("Date")}>
            <input
              type="date"
              className={inputCls}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Champ>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label={achat ? t("Compte débité") : t("Compte crédité")}>
            <select
              className={inputCls}
              value={accountId ?? ""}
              onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("— non précisé —")}</option>
              {comptes
                .filter((c) => c.archived === 0)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
            </select>
          </Champ>
          <Champ label={t("Moyen")}>
            <select
              className={inputCls}
              value={moyen}
              onChange={(e) => setMoyen(e.target.value)}
            >
              {MOYENS.map((m) => (
                <option key={m} value={m}>
                  {t(m)}
                </option>
              ))}
            </select>
          </Champ>
        </div>

        {/* ⭐ Dire ce que coûte un compte non précisé, au lieu de l'interdire.
            Un virement dont on ne sait plus sur quel compte il est tombé doit
            pouvoir se saisir — il compte pour la facture, pas pour le solde. */}
        {accountId === null && (
          <p className="flex items-start gap-1.5 text-[11px] text-text-dim">
            <IconAlert className="mt-0.5 h-3 w-3 shrink-0" />
            {t(
              "Sans compte, ce paiement suit la facture mais n'entre dans aucun solde : l'app ne sait pas où l'argent est arrivé.",
            )}
          </p>
        )}

        <Champ label={t("Note")}>
          <input
            className={inputCls}
            value={note}
            placeholder={t("Facultative")}
            onChange={(e) => setNote(e.target.value)}
          />
        </Champ>

        {/* ⚠️ Le refus est EXPLIQUÉ, et il donne le montant réel : « ce montant
            dépasse ce qu'il reste à payer » sans le chiffre obligerait à
            refermer le dialogue pour aller le lire. */}
        {refus && (
          <p className="flex items-start gap-1.5 rounded-[10px] border border-red/40 px-3 py-2 text-xs text-red">
            <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {t(refus.message)}
              {refus.resteDuCents !== undefined && (
                <>
                  {" "}
                  <Montant
                    cents={refus.resteDuCents}
                    devise={facture.devise}
                    className="text-xs text-red"
                  />
                </>
              )}
            </span>
          </p>
        )}

        {paiements.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Déjà enregistré")}</p>
            <ul className="flex flex-col gap-1">
              {paiements.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border px-2.5 py-1.5 text-xs"
                >
                  <span className="text-text-dim">
                    {formatDate(p.date)}
                    {p.moyen ? ` · ${t(p.moyen)}` : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <Montant cents={p.montant_cents} devise={p.devise} className="text-xs" />
                    <button
                      type="button"
                      onClick={() => void supprimer(p.id)}
                      data-tip={t("Retirer cet encaissement")}
                      className="cible-tactile-ligne rounded-[8px] px-1.5 py-0.5 text-text-dim transition-colors hover:bg-overlay hover:text-red"
                    >
                      {t("Retirer")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFerme}
            className="pill border border-border bg-surface-2 px-4 py-2 text-sm text-text"
          >
            {t("Annuler")}
          </button>
          <button
            type="button"
            onClick={valider}
            disabled={refus !== null || enCours}
            className="pill bg-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {t("Enregistrer")}
          </button>
        </div>
      </div>
    </Dialogue>
  );
}
