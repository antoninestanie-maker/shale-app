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
import PointAction from "./PointAction";
import { useActions } from "../lib/pointAction/contexte";
import type { ActionRequise } from "../lib/pointAction/regle";
import { ouvrirParId } from "../lib/naviguer";
import { joursDeRetard } from "../lib/objectifs/retard";
import { todayStr } from "../lib/logic";

import { t, tp } from "../lib/i18n";
/** Vues qu'une notification a le droit d'ouvrir (le `target` vient du Rust). */
const TARGETS: View[] = ["today", "journal", "knowledge", "tasks", "goals"];

const isTarget = (t: string | null): t is View =>
  t !== null && (TARGETS as string[]).includes(t);

interface Props {
  onNavigate: (view: View) => void;
}

/**
 * Ce que dit une action requise, en quelques mots — le même vocabulaire que
 * l'écran qui la porte (« en retard de 3 j », « repoussée 2 fois »…).
 */
function motDAction(a: ActionRequise): string {
  switch (a.genre) {
    case "tache-a-decider":
      return tp(a.reports ?? 0, "repoussée {n} fois", "repoussée {n} fois");
    case "tache-en-retard":
      return t("en retard de {n} j", { n: joursDeRetard(a.echeance, todayStr()) });
    case "objectif-depasse":
      return tp(-(a.joursRestants ?? 0), "échéance dépassée d'{n} jour", "échéance dépassée de {n} jours");
    case "objectif-en-peril":
      return t("en péril");
  }
}

export default function NotificationBell({ onNavigate }: Props) {
  const notifs = useNotifications();
  // ⭐ Les actions requises (2026-10-20) : LUES, jamais recalculées. Elles ne
  // sont pas des entrées du journal : elles disparaissent d'ici dès qu'on a
  // agi sur l'élément, comme le point de la ligne et le nombre du module.
  const { liste: actions } = useActions();
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
      // ⚠️ Une couche AU-DESSUS a déjà traité la touche : elle l'a marquée.
      // Sans ce garde, un seul Échap ferme DEUX étages d'un coup — et si
      // l'étage du dessous est un formulaire, la saisie part avec.
      // Convention posée par KnowledgeView le 2026-08-26, généralisée ici
      // le 2026-08-28 après l'avoir reproduite : ⌘K par-dessus une tâche.
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
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

  const ouvrirAction = (a: ActionRequise) => {
    onNavigate(a.module);
    ouvrirParId(a.kind, a.id);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={[
          notifs.unread > 0
            ? tp(notifs.unread, "Notifications, {n} non lue", "Notifications, {n} non lues")
            : "Notifications",
          actions.length > 0 ? tp(actions.length, "{n} action requise", "{n} actions requises") : "",
        ]
          .filter(Boolean)
          .join(", ")}
        data-tip="Notifications"
        data-tip-sub={t("Rappels d'habitudes, savoir délaissé, série en danger")}
        data-tip-side="right"
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-field)] transition-colors duration-150 ${
          open ? "bg-overlay-2 text-text" : "text-text-dim hover:bg-overlay hover:text-text"
        }`}
      >
        <IconBell className="h-[17px] w-[17px]" />
        {/* Grammaire des couleurs (2026-10-20) : une action requise allume le
            point rouge ; une notification non lue n'est qu'une INFORMATION,
            son compte est neutre (gris), et il cède la place au point. */}
        {actions.length > 0 ? (
          <PointAction className="absolute right-0.5 top-0.5" />
        ) : (
          notifs.unread > 0 && (
            <span className="pill absolute -right-0.5 -top-0.5 min-w-[15px] border border-border-strong bg-surface-2 px-1 text-[10px] font-semibold leading-[14px] text-text">
              {badge}
            </span>
          )
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("Centre de notifications")}
            style={{ top: pos.top, left: pos.left }}
            className="animate-fade-up card-solid fixed z-[55] flex w-[340px] max-w-[calc((100vw-2rem)*var(--zoom-inv))] flex-col overflow-hidden rounded-[var(--radius-card)] border border-border p-0 shadow-lg"
          >
            <div className="rgrid-head flex items-center gap-2 border-b border-border px-4 py-3">
              <h2 className="hud-label min-w-0 flex-1 truncate">notifications</h2>
              {notifs.unread > 0 && (
                <button
                  type="button"
                  onClick={() => notifs.markAllRead()}
                  className="shrink-0 text-[11px] font-medium text-accent hover:underline"
                >
                  {t("Tout marquer lu")}
                </button>
              )}
              {notifs.list.length > 0 && (
                <button
                  type="button"
                  onClick={() => notifs.clear()}
                  aria-label={t("Effacer l'historique")}
                  data-tip={t("Effacer l'historique")}
                  data-tip-sub={t("Les rappels déjà envoyés aujourd'hui pourront repartir")}
                  className="shrink-0 rounded-[var(--radius-field)] p-1 text-text-dim transition-colors hover:bg-overlay hover:text-text"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {actions.length > 0 && (
              <div className="border-b border-border">
                <p className="hud-label px-4 pb-1 pt-3">{t("À faire")}</p>
                <ul className="panel-scroll overflow-y-auto pb-1.5" style={{ maxHeight: "min(calc(30vh * var(--zoom-inv, 1)), 200px)" }}>
                  {actions.map((a) => (
                    <li key={a.cle}>
                      <button
                        type="button"
                        onClick={() => ouvrirAction(a)}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-overlay"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-text">{a.titre}</span>
                          <span className="block truncate text-[11px] text-text-dim">
                            {/* Une étape dit de quel objectif elle est : seule, elle ne
                                portait que sa date (constat 27, 2026-10-20). */}
                            {a.racine
                              ? t("Étape de « {objectif} »", { objectif: a.racine.titre })
                              : t(a.module === "tasks" ? "Tâches" : "Objectifs")}{" "}
                            · {motDAction(a)}
                          </span>
                        </span>
                        <PointAction />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {notifs.list.length === 0 && actions.length > 0 ? null : notifs.list.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-text-dim">
                {t("Aucune notification.")}
                <br />
                <span className="text-[12px]">
                  {t("Les rappels apparaîtront ici, même si tu as coupé les bannières du système.")}
                </span>
              </p>
            ) : (
              <div className="panel-scroll overflow-y-auto"
                style={{ maxHeight: "min(calc(60vh * var(--zoom-inv, 1)), 420px)" }}>
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
                          n.read ? "bg-transparent" : "bg-text-dim"
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
                      className="absolute right-2 top-2.5 rounded-[var(--radius-field)] p-1 text-text-dim opacity-0 transition-opacity hover:bg-overlay hover:text-text focus-visible:opacity-100 group-hover/notif:opacity-100 [@media(pointer:coarse)]:opacity-100"
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
