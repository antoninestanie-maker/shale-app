// Centre de notifications in-app : cloche + badge non-lus + panneau déroulant.
//
// Le panneau est rendu en PORTAL sur `document.body`, en `position: fixed` :
// la sidebar est un contexte d'empilement (`relative z-10`) et la zone de
// contenu est son frère de même z-index — un panneau posé dedans passerait
// donc SOUS le contenu. Même raison que la bulle d'aide (`Tooltip.tsx`) et la
// bulle de mise en forme des notes.
//
// ⚠️ Densité : `getBoundingClientRect` renvoie des pixels écran alors qu'un
// `position: fixed` sous un `<html>` zoomé raisonne en pixels locaux — d'où la
// division par `zoomFactor()` au moment d'écrire la position.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconBell, IconTrash, IconX } from "./icons";
import type { View } from "./Sidebar";
import { formatWhen, useNotifications, type NotifEntry } from "../lib/notifications";
import { zoomFactor } from "../lib/uiConfig";

import { t } from "../lib/i18n";
/** Vues qu'une notification a le droit d'ouvrir (le `target` vient du Rust). */
const TARGETS: View[] = ["today", "journal", "knowledge", "tasks", "goals"];

const isTarget = (t: string | null): t is View =>
  t !== null && (TARGETS as string[]).includes(t);

interface Props {
  onNavigate: (view: View) => void;
}

export default function NotificationBell({ onNavigate }: Props) {
  const notifs = useNotifications();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const z = zoomFactor();
    const r = el.getBoundingClientRect();
    setPos({ top: (r.bottom + 8) / z, left: (r.left - 6) / z });
  }, []);

  const toggle = () => {
    if (!open) {
      place();
      // Le journal a pu bouger pendant que le panneau était fermé (planificateur,
      // autre fenêtre) : on resynchronise à l'ouverture.
      notifs.refresh();
    }
    setOpen((o) => !o);
  };

  // Fermeture : Échap, clic à l'extérieur, redimensionnement de la fenêtre.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const openEntry = (n: NotifEntry) => {
    if (!n.read) notifs.markRead(n.id);
    if (isTarget(n.target)) onNavigate(n.target);
    setOpen(false);
  };

  const badge = notifs.unread > 9 ? "9+" : String(notifs.unread);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          notifs.unread > 0
            ? `Notifications, ${notifs.unread} non lue${notifs.unread > 1 ? "s" : ""}`
            : "Notifications"
        }
        data-tip="Notifications"
        data-tip-sub={t("Rappels d'habitudes, savoir délaissé, série en danger")}
        data-tip-side="right"
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-field)] transition-colors duration-150 ${
          open ? "bg-overlay-2 text-text" : "text-text-dim hover:bg-overlay hover:text-text"
        }`}
      >
        <IconBell className="h-[17px] w-[17px]" />
        {notifs.unread > 0 && (
          <span className="pill absolute -right-0.5 -top-0.5 min-w-[15px] bg-blue px-1 text-[10px] font-semibold leading-[15px] text-white">
            {badge}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("Centre de notifications")}
            style={{ top: pos.top, left: pos.left }}
            className="animate-fade-up card-solid fixed z-[55] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[var(--radius-card)] border border-border p-0 shadow-lg"
          >
            <div className="rgrid-head flex items-center gap-2 border-b border-border px-4 py-3">
              <h2 className="hud-label min-w-0 flex-1 truncate">notifications</h2>
              {notifs.unread > 0 && (
                <button
                  type="button"
                  onClick={() => notifs.markAllRead()}
                  className="shrink-0 text-[11px] font-medium text-blue hover:underline"
                >
                  {t("Tout marquer lu")}
                </button>
              )}
              {notifs.list.length > 0 && (
                <button
                  type="button"
                  onClick={() => notifs.clear()}
                  aria-label="Effacer l'historique"
                  data-tip="Effacer l'historique"
                  data-tip-sub={t("Les rappels déjà envoyés aujourd'hui pourront repartir")}
                  className="shrink-0 rounded-[var(--radius-field)] p-1 text-text-dim transition-colors hover:bg-overlay hover:text-text"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {notifs.list.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-text-dim">
                {t("Aucune notification.")}
                <br />
                <span className="text-[12px]">
                  {t("Les rappels apparaîtront ici, même si tu as coupé les bannières macOS.")}
                </span>
              </p>
            ) : (
              <div className="panel-scroll max-h-[min(60vh,420px)] overflow-y-auto">
                {notifs.list.map((n) => (
                  <div key={n.id} className="group/notif relative border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openEntry(n)}
                      className="flex w-full items-start gap-2.5 px-4 py-3 pr-9 text-left transition-colors hover:bg-overlay"
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          n.read ? "bg-transparent" : "bg-blue"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span
                            className={`min-w-0 flex-1 truncate text-[13px] ${
                              n.read ? "text-text-dim" : "font-semibold text-text"
                            }`}
                          >
                            {n.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-text-dim">
                            {formatWhen(n.created_at)}
                          </span>
                        </span>
                        {/* `whitespace-pre-line` : une notification de synthèse
                            met une règle par ligne. */}
                        <span className="clamp-3 mt-0.5 block whitespace-pre-line text-[12px] leading-snug text-text-dim">
                          {n.body}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => notifs.remove(n.id)}
                      aria-label={t("Supprimer cette notification")}
                      className="absolute right-2 top-2.5 rounded-[var(--radius-field)] p-1 text-text-dim opacity-0 transition-opacity hover:bg-overlay hover:text-text focus-visible:opacity-100 group-hover/notif:opacity-100"
                    >
                      <IconX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
