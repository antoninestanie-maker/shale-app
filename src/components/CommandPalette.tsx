import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../lib/i18n";
import {
  searchActions,
  type ActionContext,
  type AppAction,
} from "../lib/actions";

interface Props {
  ctx: ActionContext;
  /** Faux ⇒ les actions réservées à Shale Trade sortent de la liste. */
  hasTrading?: boolean;
}

/** Palette de commandes ⌘K : recherche d'actions, argument optionnel, toast. */
export default function CommandPalette({ ctx, hasTrading = true }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [argAction, setArgAction] = useState<AppAction | null>(null);
  const [arg, setArg] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = searchActions(query, hasTrading);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelected(0);
    setArgAction(null);
    setArg("");
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const runAction = useCallback(
    async (action: AppAction, argValue?: string) => {
      if (action.input && argValue === undefined) {
        setArgAction(action);
        setArg("");
        return;
      }
      close();
      const feedback = await action.run(ctx, argValue);
      if (typeof feedback === "string") showToast(feedback);
    },
    [ctx, close, showToast],
  );

  // ⌘K / Ctrl+K pour ouvrir, ou événement UI (tray, voix plus tard)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("sb:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("sb:open-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, argAction]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (argAction) setArgAction(null);
      else close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (argAction) {
        runAction(argAction, arg);
      } else if (results[selected]) {
        runAction(results[selected]);
      }
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 pt-28"
          onClick={close}
        >
          <div
            className="card w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onListKey}
          >
            {!argAction ? (
              <>
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <span className="font-mono text-sm text-blue">⌘</span>
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("Que veux-tu faire ?")}
                    className="w-full bg-transparent text-sm text-text placeholder:text-text-dim focus:outline-none"
                  />
                  <kbd className="hud-label">esc</kbd>
                </div>
                <ul className="max-h-80 overflow-y-auto p-2">
                  {results.length === 0 && (
                    <li className="px-3 py-6 text-center text-sm text-text-dim">
                      {t("Aucune action ne correspond.")}
                    </li>
                  )}
                  {results.map((action, i) => (
                    <li key={action.id}>
                      <button
                        type="button"
                        onClick={() => runAction(action)}
                        onMouseEnter={() => setSelected(i)}
                        className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors ${
                          i === selected
                            ? "bg-surface-2 text-text"
                            : "text-text-dim"
                        }`}
                      >
                        <span>
                          {t(action.title)}
                          {action.input && (
                            <span className="ml-1.5 text-text-dim">…</span>
                          )}
                        </span>
                        <span className="hud-label">{t(`${action.category}|palette`)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-4 border-t border-border px-4 py-2">
                  <span className="hud-label">{t("↑↓ naviguer")}</span>
                  <span className="hud-label">{t("⏎ exécuter")}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="shrink-0 text-sm text-text">
                  {argAction.title}
                </span>
                <input
                  ref={inputRef}
                  value={arg}
                  onChange={(e) => setArg(e.target.value)}
                  placeholder={argAction.input ? t(argAction.input.placeholder) : undefined}
                  className="w-full bg-transparent text-sm text-text placeholder:text-text-dim focus:outline-none"
                />
                <kbd className="hud-label">⏎</kbd>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="animate-fade-up fixed bottom-6 right-6 z-[70]">
          <div className="card px-4 py-3 text-sm text-text">
            {toast}
          </div>
        </div>
      )}
    </>
  );
}
