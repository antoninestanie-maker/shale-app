import { useCallback, useEffect, useRef, useState } from "react";
import { createTask, isTauri } from "./lib/repo";

import { t } from "./lib/i18n";
/**
 * Fenêtre de quick capture globale (⌥Espace) : une barre flottante type
 * Spotlight. Entrée → tâche créée + fenêtre masquée. Échap → masquée.
 */
export default function CapturePane() {
  const [draft, setDraft] = useState("");
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hide = useCallback(async () => {
    setDraft("");
    if (isTauri) {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().hide();
    }
  }, []);

  useEffect(() => {
    // fond transparent pour la fenêtre sans décoration
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    inputRef.current?.focus();
    const onFocus = () => inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("keydown", onKey);
    };
  }, [hide]);

  const submit = async () => {
    const label = draft.trim();
    if (!label) return;
    await createTask({
      label,
      tag: null,
      priority: "medium",
      recurrence: "none",
      goal_id: null,
    });
    if (isTauri) {
      const { emit } = await import("@tauri-apps/api/event");
      await emit("sb:data-changed");
    }
    setDraft("");
    setFlash(true);
    window.setTimeout(() => setFlash(false), 600);
    window.setTimeout(() => hide(), 350);
  };

  return (
    <div className="flex h-screen items-center justify-center p-4">
      <div
        className={`card w-full max-w-xl px-5 py-4 transition-shadow ${
          flash ? "glow-green" : "glow-blue"
        }`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex items-center gap-3">
            <span className="animate-pulse-dot h-2 w-2 shrink-0 rounded-full bg-green" />
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("Capture une tâche…")}
              className="w-full bg-transparent text-base text-text placeholder:text-text-dim focus:outline-none"
            />
          </div>
        </form>
        <div className="mt-2.5 flex items-center gap-4">
          <span className="hud-label">{t("⏎ ajouter")}</span>
          <span className="hud-label">{t("échap fermer")}</span>
          <span className="hud-label ml-auto">shale</span>
        </div>
      </div>
    </div>
  );
}
