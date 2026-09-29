// ─────────────────────────────────────────────────────────────────────────────
// Les états communs d'une action d'IA : en cours, et chaque échec.
//
// UN composant pour toutes les fonctions (cahier des charges, phase B.5) : le
// brief, la capture, les notes… affichent la même chose pour la même panne.
// Le texte vient de `lib/ia/messages.ts` ; ici, seulement la mise en forme et
// le geste proposé (réessayer, Réglages, Shale Pro).
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { t } from "../../lib/i18n";
import { messageIa } from "../../lib/ia/messages";
import type { CodeIa } from "../../lib/ia/runAi";
import UpgradeModal from "../UpgradeModal";
import { IconeIa } from "./IconeIa";

export type EtatAppelIa =
  | { etat: "repos" }
  | { etat: "chargement" }
  | { etat: "erreur"; code: CodeIa; resetsAt?: string | null };

export function EtatIa({
  etat,
  enEssai = false,
  onReessayer,
  onOuvrirReglages,
}: {
  etat: EtatAppelIa;
  enEssai?: boolean;
  onReessayer?: () => void;
  onOuvrirReglages?: () => void;
}) {
  const [pro, setPro] = useState(false);

  if (etat.etat === "repos") return null;

  if (etat.etat === "chargement")
    return (
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-text-dim">
        <IconeIa className="h-4 w-4 animate-pulse" />
        {t("L'IA rédige…")}
      </p>
    );

  const m = messageIa(etat.code, etat.resetsAt, enEssai);
  return (
    <div role="alert" className="rounded-[10px] border border-border bg-surface-2 px-3.5 py-3 text-sm text-text">
      <p className="leading-relaxed">{m.texte}</p>
      {m.geste === "reessayer" && onReessayer && (
        <button type="button" onClick={onReessayer} className="mt-2 text-sm font-medium text-blue hover:underline">
          {t("Réessayer")}
        </button>
      )}
      {m.geste === "reglages" && onOuvrirReglages && (
        <button type="button" onClick={onOuvrirReglages} className="mt-2 text-sm font-medium text-blue hover:underline">
          {t("Ouvrir les Réglages")}
        </button>
      )}
      {m.geste === "pro" && (
        <>
          <button type="button" onClick={() => setPro(true)} className="mt-2 text-sm font-medium text-blue hover:underline">
            {t("Découvrir Shale Pro")}
          </button>
          {pro && <UpgradeModal offre="pro" onClose={() => setPro(false)} />}
        </>
      )}
    </div>
  );
}
