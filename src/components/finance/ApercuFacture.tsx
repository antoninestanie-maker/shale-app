// L'aperçu avant émission.
//
// ⭐ L'APERÇU EST LE PDF LUI-MÊME, pas une reconstitution HTML.
//
// Le cahier des charges demandait « le même code que le PDF, pas deux mises en
// page à maintenir ». On aurait pu partager un composant de mise en page entre
// un rendu HTML et un rendu pdf-lib : les deux auraient divergé au premier
// ajustement, et personne ne s'en serait aperçu avant qu'un client reçoive un
// document différent de celui qu'on avait relu.
//
// Ici il n'y a qu'un seul rendu. On produit les octets et on les AFFICHE. La
// divergence n'est pas improbable : elle est inexprimable.
//
// ⚠️ L'objet URL est révoqué au démontage. Sans ça, chaque ouverture de
// l'aperçu laisse un blob de plusieurs dizaines de ko en mémoire jusqu'au
// rechargement de la fenêtre.
import { useEffect, useState } from "react";

import { IconAlert, IconSave } from "../icons";
import { Dialogue } from "./ComptesPanel";
import { BoutonDiscret } from "./champs";
import { documentImprimable } from "../../lib/finance/facturation/document";
import { pdfDuDocument } from "../../lib/finance/facturation/pdf";
import { enregistrerBinaire } from "../../lib/fichiers";
import type {
  Invoice,
  InvoiceIssuer,
  InvoiceLine,
  InvoiceParty,
} from "../../lib/types";
import { localeTag, t } from "../../lib/i18n";

export default function ApercuFacture({
  facture,
  lignes,
  destinataire,
  emetteur,
  onFerme,
}: {
  facture: Invoice;
  lignes: readonly InvoiceLine[];
  destinataire: InvoiceParty | null;
  emetteur: InvoiceIssuer | null;
  onFerme: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState<string | null>(null);

  // Ce que le document A LE DROIT de ne pas porter — calculé par la couche
  // pure, donc testé. L'afficher AVANT l'émission est le seul moment utile.
  const manques = documentImprimable(
    facture,
    lignes,
    destinataire,
    emetteur,
    localeTag(),
  ).manques;

  useEffect(() => {
    let annule = false;
    let objet: string | null = null;

    void (async () => {
      try {
        const bytes = await pdfDuDocument(facture, lignes, destinataire, emetteur, localeTag());
        if (annule) return;
        // ⚠️ `slice()` : `bytes` est une vue sur un buffer que pdf-lib peut
        // réutiliser. Sans copie, l'aperçu peut afficher des octets réécrits.
        objet = URL.createObjectURL(
          new Blob([bytes.slice()], { type: "application/pdf" }),
        );
        setUrl(objet);
      } catch (e) {
        if (!annule) setErreur(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      annule = true;
      if (objet) URL.revokeObjectURL(objet);
    };
  }, [facture, lignes, destinataire, emetteur]);

  const telecharger = async () => {
    try {
      const bytes = await pdfDuDocument(facture, lignes, destinataire, emetteur, localeTag());
      const nom = `${facture.numero ?? facture.type}.pdf`.replace(/[/\\:]/g, "-");
      // ⚠️ `false` = l'utilisateur a fermé le dialogue. Ce n'est pas une
      // erreur, et il ne faut PAS annoncer un export qui n'a pas eu lieu.
      if (await enregistrerBinaire(nom, bytes, "pdf")) setEnregistre(nom);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialogue titre={t("Aperçu du document")} onFerme={onFerme}>
      <div className="flex flex-col gap-3">
        {/* ⚠️ Signalé, pas bloquant : mieux vaut une facture émise avec un
            avertissement qu'une facture irrégulière émise en silence. */}
        {manques.length > 0 && (
          <div className="rounded-[10px] border border-yellow/40 bg-overlay px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-yellow">
              <IconAlert className="h-3.5 w-3.5 shrink-0" />
              {t("Ce document est incomplet au regard de la loi.")}
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {manques.map((m) => (
                <li key={m} className="text-[11px] text-text-dim">
                  {t(m)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {erreur ? (
          <p className="rounded-[10px] border border-red/40 px-3 py-2 text-xs text-red">
            {t("L'aperçu n'a pas pu être produit.")} {erreur}
          </p>
        ) : url === null ? (
          <p className="py-12 text-center text-sm text-text-dim">{t("Chargement…")}</p>
        ) : (
          <iframe
            src={url}
            title={t("Aperçu du document")}
            className="h-[calc(55vh*var(--zoom-inv))] w-full rounded-[10px] border border-border bg-white"
          />
        )}

        <p className="text-[11px] text-text-dim">
          {t(
            "Le XML Factur-X (profil BASIC) est joint au PDF. C'est un PDF valide portant un XML conforme — pas un PDF/A-3 certifié : la conformité finale se jouera au branchement d'une plateforme agréée.",
          )}
        </p>

        {enregistre && (
          <p className="truncate text-[11px] text-green" title={enregistre}>
            {t("Enregistré :")} {enregistre}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <BoutonDiscret onClick={() => void telecharger()} tip={t("Enregistrer le PDF sur le disque")}>
            <span className="flex items-center gap-1.5">
              <IconSave className="h-3.5 w-3.5" />
              {t("Enregistrer le PDF")}
            </span>
          </BoutonDiscret>
          <button
            type="button"
            onClick={onFerme}
            className="pill border border-border bg-surface-2 px-4 py-2 text-sm text-text"
          >
            {t("Fermer")}
          </button>
        </div>
      </div>
    </Dialogue>
  );
}
