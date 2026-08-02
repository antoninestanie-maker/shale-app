import { useEffect, useState } from "react";

import { t } from "../lib/i18n";
/** Écran de démarrage HUD : logo + ligne de chargement, ~1.2 s puis fondu. */
export default function BootScreen() {
  const [phase, setPhase] = useState<"on" | "fading" | "gone">("on");

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("fading"), 1150);
    const t2 = window.setTimeout(() => setPhase("gone"), 1600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg transition-opacity duration-500 ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      <p className="font-display text-4xl font-extrabold tracking-wide text-text">
        SHALE
      </p>
      <p className="hud-label mt-3">{t("initialisation des systèmes")}</p>
      <div className="mt-5 h-px w-56 overflow-hidden bg-border">
        <div className="animate-boot-line h-full bg-blue shadow-[0_0_12px_color-mix(in_srgb,var(--color-blue)_80%,transparent)]" />
      </div>
    </div>
  );
}
