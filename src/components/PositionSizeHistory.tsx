import { theoreticalRR } from "../lib/liveTracker";
import { fmtLots, fmtMoney, fmtPips } from "../lib/sizing";
import type { PositionSizeCalc } from "../lib/types";

import { localeTag, t } from "../lib/i18n";
interface Props {
  calcs: PositionSizeCalc[];
  onToggleUsed: (calc: PositionSizeCalc) => void;
  onDelete: (id: number) => void;
  onReuse: (calc: PositionSizeCalc) => void;
  /** Envoie la position au tracker live (workflow "Trader"). */
  onTrade: (calc: PositionSizeCalc) => void;
}

function frDateTime(s: string): string {
  // "YYYY-MM-DD HH:MM:SS" (local) → "12 juil. 09:12"
  const [datePart, timePart] = s.split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString(localeTag(), {
    day: "2-digit",
    month: "short",
  });
  return `${label} ${timePart?.slice(0, 5) ?? ""}`.trim();
}

/** Historique des calculs de sizing (le plus récent en haut). */
export default function PositionSizeHistory({
  calcs,
  onToggleUsed,
  onDelete,
  onReuse,
  onTrade,
}: Props) {
  if (calcs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-dim">
        {t("Aucun calcul enregistré pour l'instant. Chaque calcul valide est historisé automatiquement.")}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr>
            {[
              "date",
              "paire",
              "sens",
              "risque",
              "SL",
              "R:R",
              "lots",
              "risqué",
              "",
            ].map((h) => (
              <th key={h} className="hud-label pb-2 text-left first:pl-1">
                {h && t(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calcs.map((c) => {
            const rr = theoreticalRR(
              c.entry_price,
              c.stop_loss_price,
              c.take_profit_price,
              c.direction,
            );
            return (
              <tr key={c.id} className="group border-t border-border">
                <td className="py-2.5 pl-1 font-mono text-xs text-text-dim">
                  {frDateTime(c.created_at)}
                </td>
                <td className="py-2.5 font-mono text-sm font-semibold text-text">
                  {c.pair}
                </td>
                <td className="py-2.5">
                  <span
                    className={`pill border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      c.direction === "long"
                        ? "border-green/40 text-green"
                        : "border-red/40 text-red"
                    }`}
                  >
                    {c.direction}
                  </span>
                </td>
                <td className="py-2.5 font-mono text-xs text-text-dim">
                  {c.risk_percent}%
                </td>
                <td className="py-2.5 font-mono text-xs text-text-dim">
                  {fmtPips(c.sl_distance_pips)} pips
                </td>
                <td className="py-2.5 font-mono text-xs text-text-dim">
                  {rr != null ? `1:${rr}` : "—"}
                </td>
                <td className="py-2.5 font-mono text-sm font-bold text-text">
                  {fmtLots(c.position_size_lots)}
                </td>
                <td className="py-2.5 font-mono text-xs text-text-dim">
                  {fmtMoney(c.risk_amount_usd)}
                </td>
                <td className="py-2.5 pr-1">
                  <div className="flex items-center justify-end gap-1">
                    {/* Bouton « tradé » (look d'origine) : porte en plus la fonction
                        d'envoi au tracker. Pas encore tradé → un clic envoie au
                        tracker live ET marque « tradé ». Déjà tradé → un clic retire
                        la marque. */}
                    <button
                      type="button"
                      onClick={() =>
                        c.used_for_trade ? onToggleUsed(c) : onTrade(c)
                      }
                      data-tip={c.used_for_trade ? t("Marqué comme tradé") : t("Trader ce calcul")}
                      data-tip-sub={
                        c.used_for_trade
                          ? t("Position déjà envoyée au tracker — cliquer pour retirer la marque.")
                          : t("Envoie la position au tracker live et la marque comme tradée.")
                      }
                      className={`pill inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-semibold uppercase transition-colors ${
                        c.used_for_trade
                          ? "border-blue/50 bg-blue/15 text-blue"
                          : "border-border text-text-dim hover:border-blue/40 hover:text-blue"
                      }`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${c.used_for_trade ? "bg-current" : "border border-current"}`}
                      />{" "}
                      {t("tradé")}
                    </button>
                    <button
                      type="button"
                      onClick={() => onReuse(c)}
                      data-tip={t("Recharger ce calcul")}
                      data-tip-sub={t("Repose ses valeurs dans le calculateur pour l’ajuster.")}
                      className="rounded-md p-1.5 text-text-dim opacity-0 transition-opacity hover:bg-surface hover:text-text group-hover:opacity-100"
                      aria-label={t("Recharger ce calcul")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      className="rounded-md p-1.5 text-text-dim opacity-0 transition-opacity hover:bg-surface hover:text-red group-hover:opacity-100"
                      aria-label={t("Supprimer")}
                      data-tip={t("Supprimer de l’historique")}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
