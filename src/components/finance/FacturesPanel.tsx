// La liste des documents de facturation — le point d'entrée de la section.
//
// ⚠️⚠️ LE RETARD NE SE DIT PAS QU'EN COULEUR. Un retard porte une ICÔNE et un
// LIBELLÉ, en plus de sa teinte. Environ 8 % des hommes distinguent mal le rouge
// du vert, et une liste où « en retard » n'est qu'une nuance de rouge est une
// liste qu'ils lisent faux — sur le chiffre qui décide s'il faut relancer un
// client. La couleur est un renfort, jamais le porteur de l'information.
//
// ⚠️ AUCUN CALCUL ICI. Tout vient de `lib/finance/facturation/`, testé. Le
// reste dû, le retard, les totaux : ce composant les affiche, il ne les
// invente pas.
import { useMemo, useState } from "react";

import { IconAlert, IconCheckCircle, IconPencil, IconPlus, IconSend } from "../icons";
import { BoutonDiscret, Montant } from "./champs";
import { collisionsNumeros, compteursEnRetard } from "../../lib/finance/facturation/collisions";
import { etatFacture, type EtatFacture } from "../../lib/finance/facturation/statuts";
import type {
  Invoice,
  InvoiceParty,
  InvoicePayment,
  InvoiceSens,
  InvoiceSeries,
  InvoiceStatut,
} from "../../lib/types";
import { formatDate, t, tp } from "../../lib/i18n";

/** Filtres de la liste. `tous` n'est pas une valeur stockée, c'est l'absence de filtre. */
type FiltreStatut = "tous" | "a-encaisser" | "en-retard" | "brouillon" | "encaissee";

/**
 * ⚠️ Le vocabulaire suit le SENS. « À encaisser » et « Encaissées » sur des
 * factures fournisseur se lisent à l'envers : c'est moi qui paie. Vu à l'écran
 * sur le panneau Achats, où les cinq filtres parlaient de vente.
 *
 * Table de VALEURS françaises, traduites à l'affichage — jamais de `t()` dans
 * une constante de module.
 */
const FILTRES: { id: FiltreStatut; vente: string; achat: string }[] = [
  { id: "tous", vente: "Tous", achat: "Tous" },
  { id: "a-encaisser", vente: "À encaisser", achat: "À payer" },
  { id: "en-retard", vente: "En retard", achat: "En retard" },
  { id: "brouillon", vente: "Brouillons", achat: "Brouillons" },
  { id: "encaissee", vente: "Encaissées", achat: "Payées" },
];

/** Idem pour les statuts affichés : « Encaissée » devient « Payée » à l'achat. */
const STATUT_ACHAT: Partial<Record<InvoiceStatut, string>> = {
  partiellement_encaissee: "Partiellement payée",
  encaissee: "Payée",
};

/**
 * Libellé d'un statut. ⚠️ Table de VALEURS françaises traduites à l'affichage —
 * jamais de `t()` dans une constante de module, qui serait figée à l'import
 * dans la langue de départ.
 */
const STATUTS: Record<InvoiceStatut, string> = {
  brouillon: "Brouillon",
  emise: "Émise",
  partiellement_encaissee: "Partiellement encaissée",
  encaissee: "Encaissée",
  annulee: "Annulée",
};

export interface FactureAffichee {
  facture: Invoice;
  etat: EtatFacture;
  tiers: InvoiceParty | null;
}

export default function FacturesPanel({
  factures,
  paiements,
  tiers,
  series,
  aujourdhui,
  devise,
  sens,
  onNouveau,
  onOuvrir,
  onEncaisser,
}: {
  factures: readonly Invoice[];
  paiements: readonly InvoicePayment[];
  tiers: readonly InvoiceParty[];
  series: readonly InvoiceSeries[];
  aujourdhui: string;
  devise: string;
  sens: InvoiceSens;
  onNouveau: () => void;
  onOuvrir: (f: Invoice) => void;
  onEncaisser: (f: Invoice) => void;
}) {
  const [filtre, setFiltre] = useState<FiltreStatut>("tous");
  const [partyId, setPartyId] = useState<number | "tous">("tous");

  const parTiers = useMemo(() => new Map(tiers.map((x) => [x.id, x])), [tiers]);

  const lignes = useMemo(() => {
    const index = new Map<number, InvoicePayment[]>();
    for (const p of paiements) {
      const l = index.get(p.invoice_id);
      if (l) l.push(p);
      else index.set(p.invoice_id, [p]);
    }
    return factures
      .filter((f) => f.sens === sens)
      .map((facture) => ({
        facture,
        etat: etatFacture(facture, index.get(facture.id) ?? [], aujourdhui),
        tiers: facture.party_id === null ? null : (parTiers.get(facture.party_id) ?? null),
      }));
  }, [factures, paiements, parTiers, sens, aujourdhui]);

  const visibles = useMemo(
    () =>
      lignes.filter(({ facture, etat }) => {
        if (partyId !== "tous" && facture.party_id !== partyId) return false;
        switch (filtre) {
          case "a-encaisser":
            return etat.aEchoir || etat.enRetard;
          case "en-retard":
            return etat.enRetard;
          case "brouillon":
            return facture.statut === "brouillon";
          case "encaissee":
            return etat.statut === "encaissee";
          default:
            return true;
        }
      }),
    [lignes, filtre, partyId],
  );

  // ⚠️ Les collisions sont un DIAGNOSTIC, jamais une correction : un numéro déjà
  // envoyé à un client ne se réécrit pas dans son dos.
  const collisions = useMemo(() => collisionsNumeros(factures), [factures]);

  /**
   * ⭐ La série croit être plus bas qu'elle ne l'est réellement — trace typique
   * d'un compteur écrasé par le last-write-wins. Émettre maintenant produirait
   * un numéro DÉJÀ UTILISÉ, donc une collision de plus.
   *
   * Le signaler AVANT l'émission vaut mieux que de la constater après : c'est
   * le seul moment où le geste est encore réversible.
   */
  const compteurs = useMemo(
    () => (sens === "vente" ? compteursEnRetard(series, factures) : []),
    [series, factures, sens],
  );

  const clients = useMemo(
    () => tiers.filter((x) => x.role !== (sens === "vente" ? "fournisseur" : "client")),
    [tiers, sens],
  );

  return (
    <section className="card flex flex-col p-5">
      <header className="rgrid-head flex flex-wrap items-center justify-between gap-2">
        <h2 className="hud-label min-w-0 truncate">
          {sens === "vente" ? t("Factures") : t("Achats")}
        </h2>
        <BoutonDiscret
          onClick={onNouveau}
          tip={sens === "vente" ? t("Créer un brouillon de facture") : t("Saisir un achat")}
        >
          <span className="flex items-center gap-1.5">
            <IconPlus className="h-3.5 w-3.5" />
            {t("Nouveau")}
          </span>
        </BoutonDiscret>
      </header>

      {collisions.length > 0 && <AlerteCollisions collisions={collisions} />}
      {compteurs.length > 0 && <AlerteCompteurs compteurs={compteurs} series={series} />}

      {/* ⚠️ `flex-wrap` : sans lui, les filtres sortent du panneau en fenêtre
          étroite, où l'`overflow-x: clip` du wrap les rend INCLIQUABLES. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {FILTRES.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltre(f.id)}
            className={`cible-tactile-ligne rounded-pill border px-2.5 py-1 text-xs transition-colors ${
              filtre === f.id
                ? "border-blue bg-overlay-2 text-text"
                : "border-border text-text-dim hover:bg-overlay hover:text-text"
            }`}
          >
            {t(sens === "vente" ? f.vente : f.achat)}
          </button>
        ))}

        {clients.length > 0 && (
          <select
            className="cible-tactile-ligne ml-auto min-w-0 rounded-[10px] border border-border bg-surface-2 px-2 py-1 text-xs text-text"
            value={partyId}
            onChange={(e) =>
              setPartyId(e.target.value === "tous" ? "tous" : Number(e.target.value))
            }
          >
            <option value="tous">
              {sens === "vente" ? t("Tous les clients") : t("Tous les fournisseurs")}
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* `.panel-scroll` : c'est cette région qui encaisse la variation de
          hauteur quand on redimensionne le panneau. */}
      <div className="panel-scroll mt-3 min-h-0 flex-1 overflow-y-auto">
        {visibles.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-dim">
            {lignes.length === 0
              ? t("Aucun document pour l'instant.")
              : t("Aucun document ne correspond à ce filtre.")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {visibles.map((l) => (
              <LigneFacture
                key={l.facture.id}
                {...l}
                devise={devise}
                onOuvrir={() => onOuvrir(l.facture)}
                onEncaisser={() => onEncaisser(l.facture)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function LigneFacture({
  facture,
  etat,
  tiers,
  devise,
  onOuvrir,
  onEncaisser,
}: FactureAffichee & {
  devise: string;
  onOuvrir: () => void;
  onEncaisser: () => void;
}) {
  const brouillon = facture.statut === "brouillon";

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] border border-border px-3 py-2 transition-colors hover:bg-overlay">
      <div className="flex min-w-0 flex-1 basis-[13rem] flex-col">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate truncate-souris font-mono text-sm text-text" title={facture.numero ?? undefined}>
            {facture.numero ?? t("Brouillon")}
          </span>
          <EtiquetteEtat facture={facture} etat={etat} />
        </div>
        <span className="truncate truncate-souris text-xs text-text-dim" title={facture.objet ?? undefined}>
          {[tiers?.nom, facture.objet].filter(Boolean).join(" · ") || t("Sans objet")}
        </span>
      </div>

      <div className="flex shrink-0 flex-col items-end">
        <Montant cents={facture.total_ttc_cents} devise={facture.devise || devise} />
        {etat.resteDuCents !== 0 && etat.resteDuCents !== facture.total_ttc_cents && (
          <span className="text-[11px] text-text-dim">
            {t("reste")} <Montant cents={etat.resteDuCents} devise={facture.devise || devise} />
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <BoutonDiscret onClick={onOuvrir} tip={brouillon ? t("Modifier") : t("Ouvrir")}>
          <IconPencil className="h-3.5 w-3.5" />
        </BoutonDiscret>
        {!brouillon && etat.resteDuCents !== 0 && facture.type !== "devis" && (
          <BoutonDiscret
            onClick={onEncaisser}
            tip={
              facture.sens === "achat"
                ? t("Enregistrer un décaissement")
                : t("Enregistrer un encaissement")
            }
          >
            <IconSend className="h-3.5 w-3.5" />
          </BoutonDiscret>
        )}
      </div>
    </li>
  );
}

/**
 * ⭐ L'état d'un document : ICÔNE + LIBELLÉ + couleur, dans cet ordre
 * d'importance. Retirer la couleur doit laisser l'information intacte.
 */
function EtiquetteEtat({ facture, etat }: { facture: Invoice; etat: EtatFacture }) {
  const achat = facture.sens === "achat";
  if (facture.type === "devis")
    return <Puce teinte="text-text-dim">{t("Devis")}</Puce>;

  if (etat.enRetard)
    return (
      <Puce teinte="text-red">
        <IconAlert className="h-3 w-3" />
        {tp(etat.joursRetard, "En retard d'{n} jour", "En retard de {n} jours")}
      </Puce>
    );

  if (etat.statut === "encaissee")
    return (
      <Puce teinte="text-green">
        <IconCheckCircle className="h-3 w-3" />
        {achat ? t("Payée") : t("Encaissée")}
      </Puce>
    );

  const libelle = (achat ? STATUT_ACHAT[etat.statut] : null) ?? STATUTS[etat.statut];
  return <Puce teinte="text-text-dim">{t(libelle)}</Puce>;
}

function Puce({ teinte, children }: { teinte: string; children: React.ReactNode }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border border-border px-1.5 py-0.5 text-[10px] ${teinte}`}
    >
      {children}
    </span>
  );
}

/**
 * Deux appareils hors ligne peuvent produire le même numéro : le compteur est
 * répliqué et le last-write-wins l'écrase au lieu de l'additionner.
 *
 * ⚠️ ON ALERTE, ON NE RENUMÉROTE PAS. Un numéro déjà envoyé à un client est la
 * référence commune de deux comptabilités ; le changer sans le dire ferait
 * diverger la facture de celle que le client a classée.
 */
function AlerteCollisions({
  collisions,
}: {
  collisions: ReturnType<typeof collisionsNumeros>;
}) {
  return (
    <div className="mt-3 rounded-[10px] border border-yellow/40 bg-overlay px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-yellow">
        <IconAlert className="h-3.5 w-3.5 shrink-0" />
        {tp(
          collisions.length,
          "{n} numéro est porté par deux documents",
          "{n} numéros sont portés par plusieurs documents",
        )}
      </p>
      <p className="mt-1 text-[11px] text-text-dim">
        {t(
          "Rien n'a été renuméroté : un numéro déjà envoyé à un client ne peut pas changer sans que tu le décides.",
        )}
      </p>
      <ul className="mt-1.5 flex flex-col gap-0.5">
        {collisions.slice(0, 3).map((c) => (
          <li key={c.numero} className="font-mono text-[11px] text-text-dim">
            {c.numero} —{" "}
            {t("le plus ancien date du")} {formatDate(c.gardeeSuggeree.date_emission ?? c.gardeeSuggeree.created_at)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * ⚠️ On SIGNALE, on ne recale pas. Recaler un compteur ferait sauter des
 * numéros, donc des trous dans une série qui doit rester continue — l'autre
 * moitié du même interdit que « ne jamais renuméroter ».
 */
function AlerteCompteurs({
  compteurs,
  series,
}: {
  compteurs: ReturnType<typeof compteursEnRetard>;
  series: readonly InvoiceSeries[];
}) {
  return (
    <div className="mt-3 rounded-[10px] border border-yellow/40 bg-overlay px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-yellow">
        <IconAlert className="h-3.5 w-3.5 shrink-0" />
        {t("Un compteur de série est en retard sur les numéros déjà émis.")}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {compteurs.map((c) => {
          const serie = series.find((s) => s.id === c.serieId);
          return (
            <li key={c.serieId} className="text-[11px] text-text-dim">
              {serie?.libelle ?? serie?.code ?? c.serieId} —{" "}
              {t("prochain numéro {p}, alors que {o} est déjà utilisé", {
                p: c.prochain,
                o: c.observe,
              })}
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-[11px] text-text-dim">
        {t(
          "Émettre maintenant produirait un doublon. Corrige le compteur de la série avant d'émettre.",
        )}
      </p>
    </div>
  );
}
