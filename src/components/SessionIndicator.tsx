/**
 * Indicateur de session de trading active (Sydney / Tokyo / Londres / New York),
 * calculé sur le fuseau local de l'appareil et rafraîchi en continu.
 * - 1 session : pastille violette + nom.
 * - Chevauchement (ex. Londres/New York) : les deux noms + double pastille.
 * - Marché fermé (week-end) : pastille grise + heure de reprise locale.
 *
 * Les libellés de session sont stockés en français dans `SESSIONS` (ce sont les
 * clés de traduction) et traduits ici, à l'affichage.
 */
import { useMarketClock } from "../lib/market/clock";
import { t } from "../lib/i18n";

export default function SessionIndicator({ compact = false }: { compact?: boolean }) {
  const clock = useMarketClock();

  const base =
    "pill inline-flex max-w-full items-center gap-1.5 border px-2.5 py-1 text-[11px] font-medium transition-colors duration-500";

  if (!clock.forexOpen) {
    return (
      <span
        className={`${base} border-border bg-surface-2 text-text-dim`}
        title={t("Forex et indices fermés le week-end — {reopen} (heure locale). Le BTC reste ouvert 24/7.", {
          reopen: clock.reopenLabel ?? "",
        })}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-dim/60" />
        <span className="truncate">
          {t("marché fermé")}
          {!compact && clock.reopenLabel ? ` · ${clock.reopenLabel}` : ""}
        </span>
      </span>
    );
  }

  if (clock.activeSessions.length === 0) {
    return (
      <span
        className={`${base} border-border bg-surface-2 text-text-dim`}
        data-tip={t("Marché ouvert, entre deux sessions majeures (rollover).")}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-dim/60" />
        {t("entre sessions")}
      </span>
    );
  }

  const names = clock.activeSessions.map((s) => t(s.label)).join(" + ");
  const overlap = clock.activeSessions.length > 1;
  return (
    <span
      className={`${base} border-violet/30 bg-violet/10 text-violet`}
      title={
        overlap
          ? t("Chevauchement de sessions : {names} — liquidité maximale.", { names })
          : t("Session {names} active (heures locales des places converties à ton fuseau).", {
              names,
            })
      }
    >
      <span className="flex shrink-0 items-center gap-0.5">
        {clock.activeSessions.map((s) => (
          <span key={s.id} className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-violet" />
        ))}
      </span>
      <span className="truncate">{compact ? names : t("session {names}", { names })}</span>
    </span>
  );
}
