import { useEffect, useState } from "react";

import { formatHeure, localeTag } from "../lib/i18n";
/** Horloge HUD live (intégrée en bas de la sidebar). */
export default function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const pad = (n: number) => String(n).padStart(2, "0");
  // ⭐ L'heure telle que la LANGUE l'écrit (audit du 2026-10-20, constat 41) :
  // « 04:58 » en français, « 4:58 AM » en anglais — le Calendrier et
  // Aujourd'hui parlent déjà ainsi, l'horloge était restée en 24 h. Les
  // secondes s'intercalent avant le « AM / PM ».
  const [, heures, suffixe] = /^([\d:.]+)(.*)$/.exec(formatHeure(`${pad(now.getHours())}:${pad(now.getMinutes())}`)) ?? [
    "",
    `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    "",
  ];

  return (
    <div>
      <p className="font-mono text-base font-semibold tracking-widest text-text">
        {heures}
        <span className="text-text-dim">:{pad(now.getSeconds())}</span>
        {suffixe && <span className="text-xs tracking-normal">{suffixe}</span>}
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
