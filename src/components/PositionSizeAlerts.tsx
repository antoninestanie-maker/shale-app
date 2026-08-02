import type { SizingResult } from "../lib/sizing";
import { IconAlert } from "./icons";

interface Props {
  result: SizingResult;
}

/** Alertes visuelles du calculateur : erreur bloquante (rouge) ou warnings (jaune). */
export default function PositionSizeAlerts({ result }: Props) {
  if (result.error) {
    return (
      <div className="pill flex items-start gap-2 border border-red/40 bg-red/10 px-3.5 py-2.5 text-sm text-red">
        <IconAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{result.error}</span>
      </div>
    );
  }
  if (result.warnings.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {result.warnings.map((w, i) => {
        // Le warning de risque élevé est le plus critique → rouge, les autres jaunes.
        const critical = result.highRisk && i === 0;
        const tone = critical
          ? "border-red/40 bg-red/10 text-red"
          : "border-yellow/40 bg-yellow/10 text-yellow";
        return (
          <li
            key={i}
            className={`pill flex items-start gap-2 border px-3.5 py-2 text-xs ${tone}`}
          >
            <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{w}</span>
          </li>
        );
      })}
    </ul>
  );
}
