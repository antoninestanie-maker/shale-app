// Le formulaire d'un document : en-tête, lignes, totaux, émission.
//
// ⚠️ LES TOTAUX VIENNENT DES FONCTIONS PURES, à chaque frappe. Aucune
// multiplication dans ce fichier : `totauxFacture()` fait foi, et c'est elle qui
// porte la règle « la TVA s'arrondit par taux, jamais par ligne ». Un total
// recalculé ici finirait par diverger de celui qu'on enregistre.
//
// ⚠️ UNE FACTURE ÉMISE NE SE MODIFIE PLUS. Le formulaire passe en lecture seule
// dès que le document a un numéro : ce numéro est parti chez un client, et le
// document qu'il désigne ne peut plus changer. On annule par un AVOIR.
import { useMemo, useState } from "react";

import { IconAlert, IconPlus, IconTrash } from "../icons";
import ApercuFacture from "./ApercuFacture";
import { Dialogue } from "./ComptesPanel";
import { BoutonDiscret, Champ, ChampMontant, Montant, inputCls, labelCls } from "./champs";
import { MENTION_FRANCHISE, TAUX_TVA_USUELS, formaterTaux, totalLigneHtCents, totauxFacture } from "../../lib/finance/facturation/totaux";
import { empechementsEmission, numeroSuivant } from "../../lib/finance/facturation/numerotation";
import { factureDepuisDevis, factureDuDevis } from "../../lib/finance/facturation/devis";
import { parseQuantiteE8 } from "../../lib/finance/montants";
import {
  createInvoice,
  deleteInvoice,
  emettreInvoice,
  replaceInvoiceLines,
  setInvoiceStatut,
  setInvoiceTotaux,
  updateInvoice,
  type InvoiceInput,
  type InvoiceLineInput,
} from "../../lib/repo";
import type {
  Invoice,
  InvoiceIssuer,
  InvoiceLine,
  InvoiceParty,
  InvoiceSens,
  InvoiceSeries,
  InvoiceType,
} from "../../lib/types";
import { formatDate, localeTag, t } from "../../lib/i18n";

/** Une ligne en cours d'édition : la quantité reste du TEXTE tant qu'on tape. */
interface LigneEditee {
  description: string;
  unite: string | null;
  quantiteTexte: string;
  prix_unitaire_cents: number | null;
  taux_tva_e4: number;
  remise_cents: number | null;
}

const LIGNE_VIDE: LigneEditee = {
  description: "",
  unite: null,
  quantiteTexte: "1",
  prix_unitaire_cents: null,
  taux_tva_e4: 0,
  remise_cents: null,
};

/** Texte de quantité → échelle 10⁻⁸. Une saisie invalide vaut 1, jamais 0. */
const quantiteE8De = (texte: string) => parseQuantiteE8(texte) ?? 100_000_000;

const enLigneInput = (l: LigneEditee, position: number): InvoiceLineInput => {
  const quantite_e8 = quantiteE8De(l.quantiteTexte);
  const prix_unitaire_cents = l.prix_unitaire_cents ?? 0;
  const remise_cents = l.remise_cents ?? 0;
  return {
    position,
    description: l.description,
    unite: l.unite,
    quantite_e8,
    prix_unitaire_cents,
    taux_tva_e4: l.taux_tva_e4,
    remise_cents,
    total_ht_cents: totalLigneHtCents({ quantite_e8, prix_unitaire_cents, remise_cents }),
  };
};

export default function FormulaireFacture({
  facture,
  lignesExistantes,
  toutesFactures,
  tiers,
  series,
  emetteur,
  sens,
  devise,
  aujourdhui,
  onFerme,
  onChange,
}: {
  /** `null` = création. */
  facture: Invoice | null;
  lignesExistantes: readonly InvoiceLine[];
  /** Sert à savoir si un devis a DÉJÀ produit sa facture. */
  toutesFactures: readonly Invoice[];
  tiers: readonly InvoiceParty[];
  series: readonly InvoiceSeries[];
  emetteur: InvoiceIssuer | null;
  sens: InvoiceSens;
  devise: string;
  aujourdhui: string;
  onFerme: () => void;
  onChange: () => Promise<void> | void;
}) {
  const lectureSeule = facture !== null && facture.statut !== "brouillon";
  const franchise = emetteur?.regime === "franchise_en_base";

  const [type, setType] = useState<InvoiceType>(facture?.type ?? "facture");
  const [serieId, setSerieId] = useState<number | null>(
    facture?.serie_id ?? series.find((s) => s.code === "F")?.id ?? series[0]?.id ?? null,
  );
  const [partyId, setPartyId] = useState<number | null>(facture?.party_id ?? null);
  const [objet, setObjet] = useState(facture?.objet ?? "");
  const [dateEmission, setDateEmission] = useState(facture?.date_emission ?? aujourdhui);
  const [dateEcheance, setDateEcheance] = useState(facture?.date_echeance ?? "");
  const [conditions, setConditions] = useState(facture?.conditions_paiement ?? "");
  const [note, setNote] = useState(facture?.note ?? "");
  const [mentions, setMentions] = useState(
    facture?.mentions ?? (franchise ? MENTION_FRANCHISE : (emetteur?.mentions_defaut ?? "")),
  );
  const [lignes, setLignes] = useState<LigneEditee[]>(() =>
    lignesExistantes.length > 0
      ? [...lignesExistantes]
          .sort((a, b) => a.position - b.position)
          .map((l) => ({
            description: l.description,
            unite: l.unite,
            quantiteTexte: String(l.quantite_e8 / 100_000_000),
            prix_unitaire_cents: l.prix_unitaire_cents,
            taux_tva_e4: l.taux_tva_e4,
            remise_cents: l.remise_cents || null,
          }))
      : [{ ...LIGNE_VIDE }],
  );
  const [confirmeEmission, setConfirmeEmission] = useState(false);
  const [apercu, setApercu] = useState(false);
  const [enCours, setEnCours] = useState(false);

  /** ⭐ Recalculés à CHAQUE frappe, par les fonctions pures. */
  const totaux = useMemo(
    () =>
      totauxFacture(
        lignes.map((l, i) => ({ ...enLigneInput(l, i), id: i, invoice_id: 0, created_at: "" })),
        { franchiseEnBase: franchise },
      ),
    [lignes, franchise],
  );

  const serie = series.find((s) => s.id === serieId) ?? null;

  const empechements = empechementsEmission({
    statut: facture?.statut ?? "brouillon",
    serieId,
    partyId,
    nbLignes: lignes.filter((l) => l.description.trim() !== "").length,
    dateEmission: dateEmission || null,
    totalTtcCents: totaux.totalTtcCents,
    type,
  });

  const majLigne = (i: number, patch: Partial<LigneEditee>) =>
    setLignes((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const entree = (): InvoiceInput => ({
    type,
    sens,
    serie_id: serieId,
    party_id: partyId,
    date_emission: dateEmission || null,
    date_echeance: dateEcheance || null,
    conditions_paiement: conditions || null,
    devise,
    taux_change_e8: null,
    mentions: mentions || null,
    objet: objet || null,
    note: note || null,
    avoir_de_id: facture?.avoir_de_id ?? null,
    devis_origine_id: facture?.devis_origine_id ?? null,
  });

  /** Enregistre l'en-tête, les lignes et les totaux. Rend l'id du document. */
  const enregistrer = async (): Promise<number> => {
    const id = facture ? facture.id : await createInvoice(entree());
    if (facture) await updateInvoice(id, entree());

    const utiles = lignes.filter((l) => l.description.trim() !== "");
    await replaceInvoiceLines(id, utiles.map(enLigneInput));
    await setInvoiceTotaux(id, {
      total_ht_cents: totaux.totalHtCents,
      total_tva_cents: totaux.totalTvaCents,
      total_ttc_cents: totaux.totalTtcCents,
    });
    return id;
  };

  const valider = async () => {
    if (lectureSeule) return onFerme();
    setEnCours(true);
    try {
      await enregistrer();
      await onChange();
      onFerme();
    } finally {
      setEnCours(false);
    }
  };

  /**
   * ⭐ L'émission — le seul moment où un numéro s'attribue.
   *
   * L'écran de confirmation MONTRE le numéro qui va être posé et rappelle
   * qu'une facture émise ne se modifie plus. Ce n'est pas une politesse : c'est
   * le dernier instant où le geste est réversible.
   */
  const emettre = async () => {
    if (!serie || empechements.length > 0) return;
    setEnCours(true);
    try {
      const id = await enregistrer();
      const { numero, serie: compteur } = numeroSuivant(serie, dateEmission);
      await emettreInvoice(
        id,
        numero,
        serie.id,
        { prochain: compteur.prochain, annee_courante: compteur.annee_courante ?? 0 },
        // Instantané de l'émetteur : c'est lui qui rend le document
        // reproductible des années plus tard, sans stocker un octet de PDF.
        emetteur ? JSON.stringify(emetteur) : null,
        mentions || null,
      );
      await onChange();
      onFerme();
    } finally {
      setEnCours(false);
    }
  };

  /**
   * ⭐ Facturer un devis accepté : on CRÉE une facture, le devis reste.
   *
   * ⚠️ La facture naît en BROUILLON. C'est volontaire : l'échéance et la date
   * se relisent avant d'attribuer un numéro, et le numéro ne se rend jamais.
   */
  const facturerLeDevis = async () => {
    if (!facture) return;
    const serieF = series.find((s) => s.code === "F") ?? series[0];
    const prep = factureDepuisDevis(
      facture,
      lignesExistantes,
      serieF?.id ?? null,
      aujourdhui,
    );
    if (!prep) return;

    setEnCours(true);
    try {
      const id = await createInvoice(prep.entree);
      await replaceInvoiceLines(id, prep.lignes);
      await setInvoiceTotaux(id, {
        total_ht_cents: facture.total_ht_cents,
        total_tva_cents: facture.total_tva_cents,
        total_ttc_cents: facture.total_ttc_cents,
      });
      await onChange();
      onFerme();
    } finally {
      setEnCours(false);
    }
  };

  const dejaFacture = facture && facture.type === "devis"
    ? factureDuDevis(facture.id, toutesFactures)
    : null;

  const supprimer = async () => {
    if (!facture) return;
    const fait = await deleteInvoice(facture.id);
    if (!fait) return; // le dépôt refuse tout ce qui n'est pas un brouillon
    await onChange();
    onFerme();
  };

  /** ⚠️ Annuler une facture émise se fait par AVOIR, pas en la supprimant. */
  const annuler = async () => {
    if (!facture) return;
    await setInvoiceStatut(facture.id, "annulee");
    await onChange();
    onFerme();
  };

  const titre = facture
    ? lectureSeule
      ? `${facture.numero ?? t("Document")}`
      : t("Modifier le brouillon")
    : sens === "achat"
      ? t("Saisir un achat")
      : t("Nouveau document");

  if (apercu)
    return (
      <ApercuFacture
        facture={{
          ...(facture ?? ({} as Invoice)),
          ...entree(),
          numero: facture?.numero ?? null,
          total_ht_cents: totaux.totalHtCents,
          total_tva_cents: totaux.totalTvaCents,
          total_ttc_cents: totaux.totalTtcCents,
        }}
        lignes={lignes
          .filter((l) => l.description.trim() !== "")
          .map((l, i) => ({
            ...enLigneInput(l, i),
            id: i,
            invoice_id: facture?.id ?? 0,
            created_at: "",
          }))}
        destinataire={tiers.find((x) => x.id === partyId) ?? null}
        emetteur={emetteur}
        onFerme={() => setApercu(false)}
      />
    );

  if (confirmeEmission && serie)
    return (
      <ConfirmationEmission
        numero={numeroSuivant(serie, dateEmission).numero}
        totalTtcCents={totaux.totalTtcCents}
        devise={devise}
        enCours={enCours}
        onAnnuler={() => setConfirmeEmission(false)}
        onEmettre={emettre}
      />
    );

  return (
    <Dialogue titre={titre} onFerme={onFerme}>
      <div className="flex flex-col gap-3">
        {lectureSeule && <BandeauLectureSeule facture={facture} />}

        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label={t("Client")}>
            <select
              className={inputCls}
              disabled={lectureSeule}
              value={partyId ?? ""}
              onChange={(e) => setPartyId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{t("— choisir —")}</option>
              {tiers
                .filter((x) => x.archived === 0)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nom}
                  </option>
                ))}
            </select>
          </Champ>

          <Champ label={t("Type")}>
            <select
              className={inputCls}
              disabled={lectureSeule}
              value={type}
              onChange={(e) => setType(e.target.value as InvoiceType)}
            >
              <option value="facture">{t("Facture")}</option>
              <option value="devis">{t("Devis")}</option>
              <option value="avoir">{t("Avoir")}</option>
            </select>
          </Champ>
        </div>

        <Champ label={t("Objet")}>
          <input
            className={inputCls}
            disabled={lectureSeule}
            value={objet}
            placeholder={t("Prestation de conseil — septembre")}
            onChange={(e) => setObjet(e.target.value)}
          />
        </Champ>

        <div className="grid gap-3 sm:grid-cols-3">
          <Champ label={t("Série")}>
            <select
              className={inputCls}
              disabled={lectureSeule}
              value={serieId ?? ""}
              onChange={(e) => setSerieId(e.target.value ? Number(e.target.value) : null)}
            >
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.libelle ?? s.code}
                </option>
              ))}
            </select>
          </Champ>
          <Champ label={t("Date d'émission")}>
            <input
              type="date"
              className={inputCls}
              disabled={lectureSeule}
              value={dateEmission}
              onChange={(e) => setDateEmission(e.target.value)}
            />
          </Champ>
          <Champ label={t("Échéance")}>
            <input
              type="date"
              className={inputCls}
              disabled={lectureSeule}
              value={dateEcheance}
              onChange={(e) => setDateEcheance(e.target.value)}
            />
          </Champ>
        </div>

        {/* ── Les lignes ────────────────────────────────────────────────── */}
        <div>
          <span className={labelCls}>{t("Lignes")}</span>
          <div className="flex flex-col gap-2">
            {lignes.map((l, i) => (
              <LigneFormulaire
                key={i}
                ligne={l}
                franchise={franchise}
                lectureSeule={lectureSeule}
                devise={devise}
                premiere={i === 0}
                seule={lignes.length === 1}
                onChange={(patch) => majLigne(i, patch)}
                onMonter={i === 0 ? null : () => setLignes((ls) => echanger(ls, i, i - 1))}
                onDescendre={
                  i === lignes.length - 1 ? null : () => setLignes((ls) => echanger(ls, i, i + 1))
                }
                onSupprimer={() => setLignes((ls) => ls.filter((_, k) => k !== i))}
              />
            ))}
          </div>
          {!lectureSeule && (
            <div className="mt-2">
              <BoutonDiscret onClick={() => setLignes((ls) => [...ls, { ...LIGNE_VIDE }])}>
                <span className="flex items-center gap-1.5">
                  <IconPlus className="h-3.5 w-3.5" />
                  {t("Ajouter une ligne")}
                </span>
              </BoutonDiscret>
            </div>
          )}
        </div>

        {/* ── Les totaux, calculés par les fonctions pures ───────────────── */}
        <Totaux totaux={totaux} devise={devise} franchise={franchise} />

        <Champ label={t("Mentions")}>
          <textarea
            className={`${inputCls} min-h-[64px] font-body`}
            disabled={lectureSeule}
            value={mentions}
            onChange={(e) => setMentions(e.target.value)}
          />
        </Champ>

        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label={t("Conditions de paiement")}>
            <input
              className={inputCls}
              disabled={lectureSeule}
              value={conditions}
              placeholder={t("30 jours")}
              onChange={(e) => setConditions(e.target.value)}
            />
          </Champ>
          <Champ label={t("Note interne")}>
            <input
              className={inputCls}
              disabled={lectureSeule}
              value={note}
              placeholder={t("Jamais imprimée")}
              onChange={(e) => setNote(e.target.value)}
            />
          </Champ>
        </div>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
          {facture && facture.statut === "brouillon" && (
            <BoutonDiscret onClick={supprimer} danger tip={t("Un brouillon se supprime librement")}>
              <span className="flex items-center gap-1.5">
                <IconTrash className="h-3.5 w-3.5" />
                {t("Supprimer")}
              </span>
            </BoutonDiscret>
          )}
          {/* ⚠️ Proposé UNE SEULE FOIS : facturer deux fois le même devis est
              une erreur discrète — les deux factures sont valides prises
              séparément, et le client reçoit deux demandes de paiement. */}
          {lectureSeule && facture?.type === "devis" && facture.statut !== "annulee" && (
            dejaFacture ? (
              <span className="text-[11px] text-text-dim">
                {t("Déjà facturé :")} {dejaFacture.numero ?? t("Brouillon")}
              </span>
            ) : (
              <BoutonDiscret
                onClick={() => void facturerLeDevis()}
                tip={t("Crée une facture depuis ce devis. Le devis est conservé.")}
              >
                {t("Facturer ce devis")}
              </BoutonDiscret>
            )
          )}

          {lectureSeule && facture?.statut !== "annulee" && (
            <BoutonDiscret
              onClick={annuler}
              danger
              tip={t("Marque le document annulé. Émets un avoir pour la contrepartie comptable.")}
            >
              {t("Annuler le document")}
            </BoutonDiscret>
          )}

          {/* ⭐ Disponible sur un BROUILLON aussi : c'est avant l'émission
              qu'on veut relire un document, pas après. */}
          <BoutonDiscret onClick={() => setApercu(true)} tip={t("Voir le document tel qu'il sera imprimé")}>
            {t("Aperçu")}
          </BoutonDiscret>

          <button
            type="button"
            onClick={onFerme}
            className="pill border border-border bg-surface-2 px-4 py-2 text-sm text-text"
          >
            {lectureSeule ? t("Fermer") : t("Annuler")}
          </button>

          {!lectureSeule && (
            <>
              <button
                type="button"
                onClick={valider}
                disabled={enCours}
                className="pill border border-border bg-surface-2 px-4 py-2 text-sm text-text disabled:opacity-50"
              >
                {t("Enregistrer le brouillon")}
              </button>
              {/* ⚠️ Bulle portée par un <span> : un bouton `disabled` ne reçoit
                  pas le survol, or c'est justement quand il est grisé qu'il faut
                  expliquer pourquoi. */}
              <span data-tip={empechements.map((e) => t(e.message)).join(" ") || undefined}>
                <button
                  type="button"
                  onClick={() => setConfirmeEmission(true)}
                  disabled={empechements.length > 0 || enCours}
                  className="pill bg-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {t("Émettre")}
                </button>
              </span>
            </>
          )}
        </div>
      </div>
    </Dialogue>
  );
}

function echanger<T>(liste: T[], a: number, b: number): T[] {
  const copie = [...liste];
  [copie[a], copie[b]] = [copie[b], copie[a]];
  return copie;
}

function BandeauLectureSeule({ facture }: { facture: Invoice | null }) {
  return (
    <div className="rounded-[10px] border border-border bg-overlay px-3 py-2 text-xs text-text-dim">
      <span className="flex items-center gap-1.5 font-medium text-text">
        <IconAlert className="h-3.5 w-3.5 shrink-0" />
        {t("Ce document est émis : il ne se modifie plus.")}
      </span>
      <p className="mt-1">
        {t(
          "Son numéro est parti chez ton client. Pour l'annuler, émets un avoir — le document reste, sa contrepartie s'ajoute.",
        )}
        {facture?.date_emission && ` · ${t("Émis le")} ${formatDate(facture.date_emission)}`}
      </p>
    </div>
  );
}

function LigneFormulaire({
  ligne,
  franchise,
  lectureSeule,
  devise,
  premiere,
  seule,
  onChange,
  onMonter,
  onDescendre,
  onSupprimer,
}: {
  ligne: LigneEditee;
  franchise: boolean;
  lectureSeule: boolean;
  devise: string;
  premiere: boolean;
  seule: boolean;
  onChange: (patch: Partial<LigneEditee>) => void;
  onMonter: (() => void) | null;
  onDescendre: (() => void) | null;
  onSupprimer: () => void;
}) {
  const totalHt = totalLigneHtCents({
    quantite_e8: quantiteE8De(ligne.quantiteTexte),
    prix_unitaire_cents: ligne.prix_unitaire_cents ?? 0,
    remise_cents: ligne.remise_cents ?? 0,
  });

  return (
    <div className="rounded-[10px] border border-border p-2.5">
      <input
        className={`${inputCls} font-body`}
        disabled={lectureSeule}
        value={ligne.description}
        placeholder={t("Désignation")}
        onChange={(e) => onChange({ description: e.target.value })}
      />
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="min-w-0 basis-[5rem]">
          <span className={labelCls}>{t("Qté")}</span>
          <input
            className={inputCls}
            inputMode="decimal"
            disabled={lectureSeule}
            value={ligne.quantiteTexte}
            onChange={(e) => onChange({ quantiteTexte: e.target.value })}
          />
        </label>

        <div className="min-w-0 basis-[7rem]">
          <ChampMontant
            label={t("Prix unitaire")}
            valeurCents={ligne.prix_unitaire_cents}
            onChange={(cents) => onChange({ prix_unitaire_cents: cents })}
          />
        </div>

        {/* ⚠️ En franchise en base, le taux n'est pas « neutralisé » : il ne
            s'applique pas. Le champ disparaît plutôt que d'afficher un 0 %
            qui laisserait croire à un choix. */}
        {!franchise && (
          <label className="min-w-0 basis-[6rem]">
            <span className={labelCls}>{t("TVA")}</span>
            <select
              className={inputCls}
              disabled={lectureSeule}
              value={ligne.taux_tva_e4}
              onChange={(e) => onChange({ taux_tva_e4: Number(e.target.value) })}
            >
              {TAUX_TVA_USUELS.map((taux) => (
                <option key={taux} value={taux}>
                  {formaterTaux(taux, localeTag())}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Montant cents={totalHt} devise={devise} className="text-sm" />
          {!lectureSeule && (
            <>
              {onMonter && (
                <BoutonDiscret onClick={onMonter} tip={t("Monter cette ligne")}>
                  ↑
                </BoutonDiscret>
              )}
              {onDescendre && (
                <BoutonDiscret onClick={onDescendre} tip={t("Descendre cette ligne")}>
                  ↓
                </BoutonDiscret>
              )}
              {!(premiere && seule) && (
                <BoutonDiscret onClick={onSupprimer} danger tip={t("Retirer cette ligne")}>
                  <IconTrash className="h-3.5 w-3.5" />
                </BoutonDiscret>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Totaux({
  totaux,
  devise,
  franchise,
}: {
  totaux: ReturnType<typeof totauxFacture>;
  devise: string;
  franchise: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-border bg-overlay px-3 py-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-dim">{t("Total HT")}</span>
        <Montant cents={totaux.totalHtCents} devise={devise} />
      </div>

      {/* ⭐ La ventilation PAR TAUX, pas un total de TVA : c'est ce que la loi
          exige sur le document, et c'est aussi la seule forme qui se vérifie. */}
      {!franchise &&
        totaux.ventilation
          .filter((v) => v.tauxE4 > 0)
          .map((v) => (
            <div key={v.tauxE4} className="flex items-center justify-between text-xs">
              <span className="text-text-dim">
                {t("TVA")} {formaterTaux(v.tauxE4, localeTag())} {t("sur")}{" "}
                <Montant cents={v.baseHtCents} devise={devise} className="text-xs" />
              </span>
              <Montant cents={v.tvaCents} devise={devise} className="text-xs" />
            </div>
          ))}

      <div className="mt-1 flex items-center justify-between border-t border-border pt-1 text-sm font-semibold">
        <span className="text-text">{t("Total TTC")}</span>
        <Montant cents={totaux.totalTtcCents} devise={devise} className="font-semibold" />
      </div>

      {franchise && (
        <p className="mt-1 text-[11px] text-text-dim">{t(MENTION_FRANCHISE)}</p>
      )}
    </div>
  );
}

/**
 * ⭐ L'écran de confirmation d'émission.
 *
 * Il MONTRE le numéro qui va être attribué. C'est le dernier instant où le
 * geste est réversible : après, le numéro existe, il est parti dans une série
 * qui doit rester continue, et il ne se rend jamais.
 */
function ConfirmationEmission({
  numero,
  totalTtcCents,
  devise,
  enCours,
  onAnnuler,
  onEmettre,
}: {
  numero: string;
  totalTtcCents: number;
  devise: string;
  enCours: boolean;
  onAnnuler: () => void;
  onEmettre: () => void;
}) {
  return (
    <Dialogue titre={t("Émettre ce document")} onFerme={onAnnuler}>
      <div className="flex flex-col gap-3">
        <div className="rounded-[10px] border border-border bg-overlay px-3 py-3 text-center">
          <p className="text-xs text-text-dim">{t("Numéro attribué")}</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-text">{numero}</p>
          <p className="mt-1">
            <Montant cents={totalTtcCents} devise={devise} className="text-sm" />
          </p>
        </div>

        <p className="text-sm text-text-dim">
          {t(
            "Une fois émis, ce document ne se modifie plus et son numéro ne se rend pas — une série de numéros doit rester continue. Pour l'annuler ensuite, tu émettras un avoir.",
          )}
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onAnnuler}
            className="pill border border-border bg-surface-2 px-4 py-2 text-sm text-text"
          >
            {t("Revenir")}
          </button>
          <button
            type="button"
            onClick={onEmettre}
            disabled={enCours}
            className="pill bg-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {t("Émettre")}
          </button>
        </div>
      </div>
    </Dialogue>
  );
}
