import { useEffect, useState } from "react";

import { localeTag } from "../lib/i18n";
/** Horloge HUD live (intégrée en bas de la sidebar). */
export default function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div>
      <p className="font-mono text-base font-semibold tracking-widest text-text">
        {pad(now.getHours())}:{pad(now.getMinutes())}
        <span className="text-text-dim">:{pad(now.getSeconds())}</span>
      </p>
      <p className="hud-label mt-0.5">
        {now.toLocaleDateString(localeTag(), {
          weekday: "short",
          day: "2-digit",
          month: "short",
        })}
      </p>
    </div>
  );
}
