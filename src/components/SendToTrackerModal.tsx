// Mini-popup de confirmation avant envoi d'une position au tracker live.
// Affiché seulement si le mode fast-track est désactivé (Réglages → tracker).
// Le TP reste éditable ici (dernier ajustement avant envoi), le R:R se met à
// jour en direct. "Ne plus demander" bascule en fast-track pour la suite.
import { useEffect, useMemo, useState } from "react";
import { fmtRR, theoreticalRR } from "../lib/liveTracker";
import { fmtLots, fmtMoney } from "../lib/sizing";
import { IconSend, IconX } from "./icons";

import { t } from "../lib/i18n";
export interface TrackerDraft {
  pair: string;
  direction: "long" | "short";
  entry_price: number;
  stop_loss_price: number;
  take_profit_price: number | null;
  lots: number | null;
  risk_percent: number | null;
  risk_amount: number | null;
  sizing_calc_id: number | null;
}

interface Props {
  draft: TrackerDraft;
  currency: string;
  onClose: () => void;
  onSend: (draft: TrackerDraft, rememberFastTrack: boolean) => Promise<void>;
}

const fieldCls =
  "w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text placeholder:font-body placeholder:text-text-dim focus:border-blue focus:outline-none";

export default function SendToTrackerModal({
  draft,
  currency,
  onClose,
  onSend,
}: Props) {
  const [tp, setTp] = useState(
    draft.take_profit_price != null ? String(draft.take_profit_price) : "",
  );
  const [remember, setRemember] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tpNum = useMemo(() => {
    const n = parseFloat(tp.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [tp]);

  const rr = theoreticalRR(
    draft.entry_price,
    draft.stop_loss_price,
    tpNum,
    draft.direction,
  );
  const tpIncoherent = tpNum != null && rr == null;

  const send = async () => {
    if (sending) return;
    setSending(true);
    await onSend({ ...draft, take_profit_price: tpNum }, remember);
  };

  const row = (label: string, value: React.ReactNode) => (
    <div className="pill bg-surface-2 px-3 py-2">
      <p className="hud-label">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-text">{value}</p>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-sm bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-text">Envoyer au tracker</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-dim hover:text-text"
            aria-label={t("Fermer")}
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-base font-bold text-text">
            {draft.pair}
          </span>
          <span
            className={`pill border px-2 py-0.5 text-[10px] font-bold uppercase ${
              draft.direction === "long"
                ? "border-green/40 text-green"
                : "border-red/40 text-red"
            }`}
          >
            {draft.direction}
          </span>
          <span className="ml-auto pill border border-blue/40 bg-blue/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-blue">
            R:R {fmtRR(rr)}
          </span>
        </div>

        <div className="auto-tiles mt-4 gap-2.5">
          {row(t("entrée"), draft.entry_price)}
          {row("stop-loss", draft.stop_loss_price)}
          {row(
            "taille",
            draft.lots != null ? `${fmtLots(draft.lots)} lots` : "—",
          )}
          {row(
            "risque",
            draft.risk_amount != null
              ? `${fmtMoney(draft.risk_amount, currency)}${
                  draft.risk_percent != null ? ` (${draft.risk_percent}%)` : ""
                }`
              : "—",
          )}
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-medium text-text-dim">
            Take Profit initial (optionnel)
          </p>
          <input
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            inputMode="decimal"
            placeholder="ex. 1.0910"
            autoFocus
            className={fieldCls}
          />
          {tpIncoherent && (
            <p className="mt-1.5 text-xs text-yellow">
              TP incohérent avec un {draft.direction} — le R:R ne sera pas
              calculé.
            </p>
          )}
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-text-dim">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="accent-[var(--color-blue)]"
          />
          {t("Ne plus demander — envoyer directement (mode fast-track)")}
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="pill px-4 py-2 text-sm font-medium text-text-dim hover:text-text"
          >
            {t("Annuler")}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="pill inline-flex items-center gap-2 bg-blue px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <IconSend className="h-4 w-4" /> Envoyer au tracker
          </button>
        </div>
      </div>
    </div>
  );
}
