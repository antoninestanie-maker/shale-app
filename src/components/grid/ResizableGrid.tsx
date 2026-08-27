/**
 * Grille redimensionnable ET réordonnable, réutilisable pour toutes les vues.
 *
 * Modèle « masonry » robuste :
 * - Colonnes fixes (12). La **largeur** d'un panneau = un nombre entier de colonnes,
 *   avec un plancher exprimé EN PIXELS (`MIN_PANEL_PX`) traduit en colonnes selon la
 *   largeur réelle de la grille → responsive sans breakpoint de viewport.
 * - Rangées de 1px + placement dense (`grid-auto-flow: row dense`) → le navigateur réagence
 *   sans jamais de chevauchement ni de sortie de cadre (structurel, sans bug de position).
 * - **Hauteur par défaut = hauteur réelle du contenu**, suivie par un `ResizeObserver`
 *   (mesure jamais suspendue : l'empreinte de grille suit le contenu même pendant un resize).
 *
 * Redimensionnement STRUCTUREL (et non cosmétique) :
 * - la carte fait exactement la taille de son empreinte (`min-height` ET `max-height`
 *   à 100 %, cf. `.rgrid-fill` dans index.css) et devient une colonne flex ;
 * - le widget déclare la région qui encaisse la variation : `.panel-grow`,
 *   `.panel-scroll` (liste défilante) ou `.panel-chart` (graphique extensible) ;
 * - la présence d'une `.panel-scroll` est **auto-détectée** et autorise alors le
 *   panneau à descendre SOUS la hauteur de son contenu (sinon plancher = contenu,
 *   pour ne jamais tronquer) ;
 * - contraintes disponibles : `minW`/`maxW` (colonnes), `minH`/`maxH` (px), plus un
 *   plafond implicite à 90 % de la hauteur visible, recalculé au redimensionnement
 *   de fenêtre et à la rotation.
 *
 * Fluidité (façon Apple) :
 * - Le panneau saisi **suit le curseur en temps réel** (transform imperatif hors React,
 *   1 rAF par frame) et revient à son slot par une **animation ressort** au relâchement.
 * - Les autres panneaux glissent en live par **FLIP** (mesure → inversion → lecture) avec
 *   une courbe ressort physique (`linear()` échantillonné ; repli cubic-bezier).
 * - Hit-test du drag sur les **positions finales de layout** (jamais sur des rects en cours
 *   d'animation) → pas d'oscillation ; auto-scroll doux près des bords du conteneur.
 *
 * Interactions (poignées révélées au survol, inertes au repos) :
 * - Coin haut-droit : barre « verre » unique — ⟲ réinitialiser (si modifié),
 *   ⠿ déplacer (réordonnancement live), ✕ masquer.
 * - Coin bas-droit : **redimensionner** (largeur par colonnes, hauteur par pas de 24px,
 *   aperçu live animé, dépassement élastique aux deux bornes ;
 *   double-clic = désépingler la hauteur).
 * - Coin bas-gauche : ↗ **ouvrir la vue complète** (si `onOpen`).
 *
 * Persistance par grille : `layout.<gridId>` (tailles) et `order.<gridId>` (ordre).
 */
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { getSetting, setSetting } from "../../lib/repo";

import { t } from "../../lib/i18n";
const COLUMNS = 12;
const COL_GAP = 16;
const V_SPACE = 16;
const HEIGHT_STEP = 24;
const MIN_PX = 96;
/**
 * Largeur plancher d'un panneau, en PIXELS réels. Traduite en nombre de colonnes
 * selon la largeur courante de la grille : sur une fenêtre étroite, un widget de
 * 4/12 colonnes deviendrait illisible (contenu tassé, chevauchements) — il passe
 * automatiquement à un span plus large. C'est ce qui rend la grille responsive
 * sans dépendre de breakpoints de viewport.
 */
const MIN_PANEL_PX = 248;
const SCROLL_EDGE = 72; // zone d'auto-scroll près des bords du conteneur
const SCROLL_MAX = 14; // px/frame max
const REORDER_COOLDOWN_MS = 130; // laisse le FLIP se poser avant le swap suivant

/** Arrondi au multiple de 8 supérieur (rythme vertical commun à toute l'app). */
const ceil8 = (v: number) => Math.ceil(v / 8) * 8;

/**
 * Courbe ressort physique échantillonnée en easing CSS `linear(...)`.
 * x(0)=1, v(0)=0 (masse-ressort amorti) ; durée = temps pour |x| < 0.1 %.
 */
function springEasing(stiffness: number, damping: number, mass = 1) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const settle = -Math.log(0.001) / (Math.min(zeta, 1) * w0);
  const N = 80;
  const pts: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * settle;
    let x: number;
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      x = Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    } else {
      x = Math.exp(-w0 * t) * (1 + w0 * t);
    }
    pts.push((1 - x).toFixed(4));
  }
  return { easing: `linear(${pts.join(",")})`, duration: Math.round(settle * 1000) };
}

const SUPPORTS_LINEAR =
  typeof CSS !== "undefined" && CSS.supports?.("transition-timing-function", "linear(0, 1)");
/** Glissement FLIP des voisins : vif, dépassement quasi nul. */
const FLIP_SPRING = SUPPORTS_LINEAR
  ? springEasing(560, 38)
  : { easing: "cubic-bezier(0.32, 0.72, 0, 1)", duration: 320 };
/** Retour au slot du panneau relâché : léger dépassement (rebond discret). */
const DROP_SPRING = SUPPORTS_LINEAR
  ? springEasing(420, 30)
  : { easing: "cubic-bezier(0.32, 0.72, 0, 1)", duration: 380 };

export interface PanelSize {
  w: number;
  h?: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface GridCtx {
  columns: number;
  colGap: number;
  /** Largeur mesurée de la grille (px) — sert au plancher de largeur responsive. */
  gridWidth: number;
  /** Hauteur de la zone visible (px), suivie au redimensionnement / rotation. */
  viewportH: number;
  gridRef: React.RefObject<HTMLDivElement | null>;
  overrides: Record<string, PanelSize>;
  draggingId: string | null;
  captureFlip: (excludeId?: string | null) => void;
  saveOverride: (id: string, size: PanelSize) => void;
  clearOverride: (id: string) => void;
  startMove: (id: string, e: React.PointerEvent) => void;
  hidePanel: (id: string) => void;
}

/** Libellé de repli quand un panneau n'a pas de prop `title` : "timer-goal" → "Goal". */
function prettify(id: string): string {
  const tail = id.replace(/^[a-z0-9]+-/i, "").replace(/-/g, " ");
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}

const Ctx = createContext<GridCtx | null>(null);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface DragState {
  id: string;
  el: HTMLElement;
  pointer: { x: number; y: number }; // dernière position client
  startLocal: { x: number; y: number }; // pointeur au départ, coords locales grille
  startSlot: { left: number; top: number }; // slot d'origine, coords locales grille
  curSlot: { left: number; top: number }; // slot courant (mis à jour après chaque réagencement)
}

export function ResizableGrid({
  gridId,
  children,
  columns = COLUMNS,
  className = "",
}: {
  gridId: string;
  children: ReactNode;
  columns?: number;
  className?: string;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [overrides, setOverrides] = useState<Record<string, PanelSize>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Largeur réelle de la grille : chaque panneau en déduit son plancher de
  // largeur en colonnes (responsive sans breakpoint de viewport).
  const [gridWidth, setGridWidth] = useState(0);
  // Hauteur visible : borne haute des panneaux. Suivie au redimensionnement de
  // fenêtre ET à la rotation, sinon une taille enregistrée sur un grand écran
  // ferait "disparaître" le widget après passage sur un écran plus petit.
  const [viewportH, setViewportH] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 900,
  );
  const sizeKey = `layout.${gridId}`;
  const orderKey = `order.${gridId}`;
  const hiddenKey = `hidden.${gridId}`;

  const items = useMemo(() => {
    const list: ReactElement<{ id: string; title?: string }>[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child) && (child.props as { id?: string }).id) {
        list.push(child as ReactElement<{ id: string; title?: string }>);
      }
    });
    return list;
  }, [children]);
  const jsxIds = items.map((c) => c.props.id);
  const jsxKey = jsxIds.join("|");

  const effectiveOrder = useMemo(() => {
    const known = new Set(jsxIds);
    const kept = order.filter((id) => known.has(id));
    const seen = new Set(kept);
    return [...kept, ...jsxIds.filter((id) => !seen.has(id))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, jsxKey]);
  const effectiveOrderRef = useRef(effectiveOrder);
  effectiveOrderRef.current = effectiveOrder;

  // — Positions finales de layout (coords locales grille, sans transform) : hit-test du drag —
  const slotRects = useRef<Map<string, Rect>>(new Map());
  const dragRef = useRef<DragState | null>(null);

  // — Animation FLIP : mémorise la position AVANT le changement, rejoue le glissement APRÈS —
  const firstRects = useRef<Map<string, { left: number; top: number }>>(new Map());
  const flipPending = useRef(false);
  const flipExclude = useRef<string | null>(null);

  const captureFlip = useCallback((excludeId?: string | null) => {
    const grid = gridRef.current;
    if (!grid) return;
    const m = new Map<string, { left: number; top: number }>();
    for (const el of Array.from(grid.children)) {
      const id = (el as HTMLElement).dataset.pid;
      if (!id) continue;
      const r = el.getBoundingClientRect();
      m.set(id, { left: r.left, top: r.top });
    }
    firstRects.current = m;
    flipPending.current = true;
    flipExclude.current = excludeId ?? null;
  }, []);

  useLayoutEffect(() => {
    if (!flipPending.current) return;
    flipPending.current = false;
    const grid = gridRef.current;
    if (!grid) return;
    const exclude = flipExclude.current;
    flipExclude.current = null;
    const kids = (Array.from(grid.children) as HTMLElement[]).filter((el) => el.dataset.pid);

    // 1. Écriture : neutralise transitions et transforms (y compris le panneau saisi,
    //    pour mesurer son slot réel) — tout se passe avant le paint, aucun flicker.
    const prevDragTransform = new Map<string, string>();
    for (const el of kids) {
      const id = el.dataset.pid!;
      if (id === exclude) prevDragTransform.set(id, el.style.transform);
      el.style.transition = "none";
      el.style.transform = "";
    }

    // 2. Lecture groupée : positions finales (et mise à jour des slots pour le hit-test).
    const gr = grid.getBoundingClientRect();
    const last = new Map<string, { left: number; top: number }>();
    for (const el of kids) {
      const id = el.dataset.pid!;
      const r = el.getBoundingClientRect();
      last.set(id, { left: r.left, top: r.top });
      slotRects.current.set(id, {
        left: r.left - gr.left,
        top: r.top - gr.top,
        width: r.width,
        height: r.height,
      });
    }
    for (const id of Array.from(slotRects.current.keys())) {
      if (!last.has(id)) slotRects.current.delete(id);
    }

    // 3. Écriture : inversion (position d'avant) pour les voisins ; le panneau saisi
    //    reprend sa position sous le curseur, recalculée pour son nouveau slot.
    const d = dragRef.current;
    for (const el of kids) {
      const id = el.dataset.pid!;
      if (id === exclude) {
        const slot = slotRects.current.get(id);
        if (d && d.id === id && slot) {
          d.curSlot = { left: slot.left, top: slot.top };
          const px = d.pointer.x - gr.left;
          const py = d.pointer.y - gr.top;
          const dx = px - d.startLocal.x + (d.startSlot.left - d.curSlot.left);
          const dy = py - d.startLocal.y + (d.startSlot.top - d.curSlot.top);
          el.style.transform = `translate(${dx}px, ${dy}px)`;
        } else {
          el.style.transform = prevDragTransform.get(id) ?? "";
        }
        continue;
      }
      const f = firstRects.current.get(id);
      const l = last.get(id);
      if (!f || !l) continue;
      const dx = f.left - l.left;
      const dy = f.top - l.top;
      if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      }
    }

    // 4. Un seul reflow forcé, puis rejeu du glissement (ressort).
    void grid.offsetHeight;
    for (const el of kids) {
      const id = el.dataset.pid!;
      if (id === exclude) continue;
      if (!el.style.transform) continue;
      el.style.transition = `transform ${FLIP_SPRING.duration}ms ${FLIP_SPRING.easing}`;
      el.style.transform = "";
    }
  });

  useEffect(() => {
    let alive = true;
    getSetting(sizeKey)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const parsed = JSON.parse(raw) as Record<string, PanelSize>;
          const clean: Record<string, PanelSize> = {};
          for (const [id, s] of Object.entries(parsed)) {
            if (s && Number.isFinite(s.w) && s.w >= 1) {
              clean[id] = {
                w: Math.round(s.w),
                ...(Number.isFinite(s.h) && (s.h as number) > 0
                  ? { h: Math.round(s.h as number) }
                  : {}),
              };
            }
          }
          setOverrides(clean);
        } catch {
          /* JSON corrompu : tailles par défaut */
        }
      })
      .catch(() => {});
    getSetting(orderKey)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
            setOrder(parsed as string[]);
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    getSetting(hiddenKey)
      .then((raw) => {
        if (!alive || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
            setHidden(parsed as string[]);
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [sizeKey, orderKey, hiddenKey]);

  // Mesure de la grille (largeur) — plancher de largeur responsive des panneaux.
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const read = () => setGridWidth((prev) => (Math.abs(prev - el.clientWidth) > 0.5 ? el.clientWidth : prev));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Hauteur visible — re-borne les panneaux au redimensionnement / à la rotation.
  useEffect(() => {
    const onResize = () =>
      setViewportH((prev) => (Math.abs(prev - window.innerHeight) > 1 ? window.innerHeight : prev));
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  const persistSizes = useCallback(
    (next: Record<string, PanelSize>) => {
      setSetting(sizeKey, JSON.stringify(next)).catch(() => {});
    },
    [sizeKey],
  );

  const saveOverride = useCallback(
    (id: string, size: PanelSize) => {
      captureFlip();
      setOverrides((prev) => {
        const next = { ...prev, [id]: size };
        persistSizes(next);
        return next;
      });
    },
    [persistSizes, captureFlip],
  );

  const clearOverride = useCallback(
    (id: string) => {
      captureFlip();
      setOverrides((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        persistSizes(next);
        return next;
      });
    },
    [persistSizes, captureFlip],
  );

  const hidePanel = useCallback(
    (id: string) => {
      captureFlip();
      setHidden((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        setSetting(hiddenKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [captureFlip, hiddenKey],
  );

  const restorePanel = useCallback(
    (id: string) => {
      captureFlip();
      setHidden((prev) => {
        const next = prev.filter((x) => x !== id);
        setSetting(hiddenKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [captureFlip, hiddenKey],
  );

  /** Slots recalculés au début d'un drag (au repos, les transforms sont vides). */
  const refreshSlots = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const gr = grid.getBoundingClientRect();
    slotRects.current.clear();
    for (const el of Array.from(grid.children) as HTMLElement[]) {
      const id = el.dataset.pid;
      if (!id) continue;
      const r = el.getBoundingClientRect();
      slotRects.current.set(id, {
        left: r.left - gr.left,
        top: r.top - gr.top,
        width: r.width,
        height: r.height,
      });
    }
  }, []);

  const startMove = useCallback(
    (id: string, e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const grid = gridRef.current;
      if (!grid) return;
      const el = grid.querySelector<HTMLElement>(`[data-pid="${CSS.escape(id)}"]`);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();

      setDraggingId(id);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
      el.style.transition = "none";
      el.style.zIndex = "50";
      el.style.willChange = "transform";
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* pointer non capturable : sans conséquence */
      }

      refreshSlots();
      const gr0 = grid.getBoundingClientRect();
      const slot0 = slotRects.current.get(id) ?? { left: 0, top: 0, width: 0, height: 0 };
      const st: DragState = {
        id,
        el,
        pointer: { x: e.clientX, y: e.clientY },
        startLocal: { x: e.clientX - gr0.left, y: e.clientY - gr0.top },
        startSlot: { left: slot0.left, top: slot0.top },
        curSlot: { left: slot0.left, top: slot0.top },
      };
      dragRef.current = st;

      let working = [...effectiveOrderRef.current];
      if (!working.includes(id)) working = [...working, id];

      // Conteneur scrollable le plus proche (auto-scroll près des bords).
      let scroller: HTMLElement | null = grid.parentElement;
      while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) {
        scroller = scroller.parentElement;
      }

      let lastReorder = 0;
      // Suivi 1:1 du curseur + hit-test : exécutés à chaque pointermove (les navigateurs
      // coalescent déjà à la fréquence d'affichage) pour ne jamais rater un drag rapide.
      const update = () => {
        const gr = grid.getBoundingClientRect();
        const px = st.pointer.x - gr.left;
        const py = st.pointer.y - gr.top;
        const dx = px - st.startLocal.x + (st.startSlot.left - st.curSlot.left);
        const dy = py - st.startLocal.y + (st.startSlot.top - st.curSlot.top);
        st.el.style.transform = `translate(${dx}px, ${dy}px)`;

        // Hit-test sur les positions finales (stable pendant les FLIP).
        const now = performance.now();
        if (now - lastReorder < REORDER_COOLDOWN_MS) return;
        for (const [pid, r] of slotRects.current) {
          if (pid === id) continue;
          if (px >= r.left && px <= r.left + r.width && py >= r.top && py <= r.top + r.height) {
            const from = working.indexOf(id);
            const to = working.indexOf(pid);
            if (from !== -1 && to !== -1 && from !== to) {
              lastReorder = now;
              captureFlip(id);
              working = arrayMove(working, from, to);
              setOrder(working);
            }
            break;
          }
        }
      };
      update();

      // rAF : uniquement l'auto-scroll près des bords (le suivi est piloté par les events).
      let raf = 0;
      const frame = () => {
        raf = requestAnimationFrame(frame);
        if (!scroller) return;
        const sr = scroller.getBoundingClientRect();
        let delta = 0;
        if (st.pointer.y < sr.top + SCROLL_EDGE) {
          delta = -SCROLL_MAX * clamp((sr.top + SCROLL_EDGE - st.pointer.y) / SCROLL_EDGE, 0, 1);
        } else if (st.pointer.y > sr.bottom - SCROLL_EDGE) {
          delta = SCROLL_MAX * clamp((st.pointer.y - (sr.bottom - SCROLL_EDGE)) / SCROLL_EDGE, 0, 1);
        }
        if (delta !== 0) {
          scroller.scrollTop += delta;
          update(); // le layout a bougé sous le curseur
        }
      };
      raf = requestAnimationFrame(frame);

      const onMove = (ev: PointerEvent) => {
        st.pointer = { x: ev.clientX, y: ev.clientY };
        update();
      };
      const finish = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        dragRef.current = null;
        setDraggingId(null);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        setSetting(orderKey, JSON.stringify(working)).catch(() => {});

        // Retour au slot : ressort avec léger dépassement, z-index gardé en vol.
        const cur = el.style.transform;
        el.style.transform = "";
        el.style.willChange = "";
        if (cur && cur !== "none") {
          const anim = el.animate([{ transform: cur }, { transform: "none" }], {
            duration: DROP_SPRING.duration,
            easing: DROP_SPRING.easing,
          });
          anim.onfinish = anim.oncancel = () => {
            el.style.zIndex = "";
          };
        } else {
          el.style.zIndex = "";
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [orderKey, captureFlip, refreshSlots],
  );

  const ctx = useMemo<GridCtx>(
    () => ({
      columns,
      colGap: COL_GAP,
      gridWidth,
      viewportH,
      gridRef,
      overrides,
      draggingId,
      captureFlip,
      saveOverride,
      clearOverride,
      startMove,
      hidePanel,
    }),
    [
      columns,
      gridWidth,
      viewportH,
      overrides,
      draggingId,
      captureFlip,
      saveOverride,
      clearOverride,
      startMove,
      hidePanel,
    ],
  );

  const byId = new Map(items.map((c) => [c.props.id, c]));
  const hiddenKnown = hidden.filter((id) => byId.has(id));

  return (
    <Ctx.Provider value={ctx}>
      <div
        ref={gridRef}
        className={className}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridAutoRows: "1px",
          gridAutoFlow: "row dense",
          columnGap: COL_GAP,
          rowGap: 0,
          alignItems: "start",
        }}
      >
        {effectiveOrder
          .filter((id) => !hidden.includes(id))
          .map((id) => {
            const child = byId.get(id);
            return child ? cloneElement(child, { key: id }) : null;
          })}
      </div>

      {/* Panneaux masqués : un clic pour les remettre dans la grille */}
      {hiddenKnown.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="hud-label mr-1">{t("masqués")}</span>
          {hiddenKnown.map((id) => {
            const child = byId.get(id)!;
            const label = child.props.title ?? prettify(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => restorePanel(id)}
                data-tip={t("Réafficher ce panneau")}
                data-tip-sub={t("Le panneau reprend sa place et sa taille dans la grille.")}
                className="pill inline-flex items-center gap-1 border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-text-dim transition-colors hover:border-blue/50 hover:text-text"
              >
                <span className="text-blue">+</span> {label}
              </button>
            );
          })}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function ResizablePanel({
  id,
  defaultW = 12,
  minW = 2,
  maxW,
  minH,
  maxH,
  onOpen,
  children,
}: {
  id: string;
  /** Libellé humain du panneau (rangée « masqués ») ; repli : id embelli. */
  title?: string;
  defaultW?: number;
  /** Largeur minimale VOULUE (colonnes). Le moteur peut la remonter si la
      fenêtre est étroite (plancher `MIN_PANEL_PX` en pixels réels). */
  minW?: number;
  /** Largeur maximale (colonnes) — utile pour un widget qui n'a rien à gagner
      à s'étendre (jauge, anneau). */
  maxW?: number;
  /** Hauteur minimale absolue (px) — plancher quand le contenu peut défiler. */
  minH?: number;
  /** Hauteur maximale (px) : au-delà, la région `.panel-scroll` défile. */
  maxH?: number;
  /** Ouvre la vue complète associée au widget (poignée ↗ discrète au survol). */
  onOpen?: () => void;
  children: ReactNode;
}) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error(t("ResizablePanel doit être dans <ResizableGrid>"));
  const {
    columns,
    colGap,
    gridWidth,
    viewportH,
    gridRef,
    overrides,
    draggingId,
    captureFlip,
    saveOverride,
    clearOverride,
    startMove,
    hidePanel,
  } = ctx;

  const override = overrides[id];
  const isDragging = draggingId === id;
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // — CONTRAINTE DE LARGEUR —
  // Un span en colonnes n'a de sens qu'à largeur de grille donnée : sur une
  // fenêtre étroite, 4/12 colonnes peuvent ne faire que 120px et le contenu se
  // tasse. On convertit donc un plancher EN PIXELS en nombre de colonnes.
  const colStride = gridWidth > 0 ? (gridWidth - (columns - 1) * colGap) / columns + colGap : 0;
  const minColsPx =
    colStride > 0 ? clamp(Math.ceil((MIN_PANEL_PX + colGap) / colStride), 1, columns) : 1;
  // — LE PLANCHER SE HISSE À LA RANGÉE ENTIÈRE —
  // Dès que le plancher dépasse la MOITIÉ des colonnes, deux panneaux ne
  // peuvent plus tenir côte à côte : la grille est déjà, mécaniquement, une
  // pile verticale. Laisser le plancher à 9/12 ne produit alors qu'un bord
  // droit en dents de scie. Mesuré sur iPhone 17 : grille de 338 px, plancher
  // calculé à 9 colonnes, DISCIPLINE s'arrêtait 88 px avant le bord de l'écran
  // alors qu'il était seul sur sa rangée.
  //
  // C'est de l'arithmétique sur la largeur MESURÉE, pas un breakpoint : la
  // règle vaut aussi pour une fenêtre de Mac réduite, et elle ne touche AUCUNE
  // donnée — le clamp vit au rendu, `persistSizes` n'écrit que sur action de
  // l'utilisateur (DESIGN.md, « la grille n'a PAS besoin de migration »).
  const minCols = minColsPx * 2 > columns ? columns : minColsPx;
  const effMinW = clamp(Math.max(minW, minCols), 1, columns);
  const effMaxW = clamp(maxW ?? columns, effMinW, columns);

  const w = clamp(override?.w ?? defaultW, effMinW, effMaxW);
  const pinnedH = override?.h;
  // autoH = hauteur NATURELLE du contenu. La carte étant étirée en permanence
  // pour remplir son empreinte (bords alignés, gouttières uniformes), on mesure
  // en désactivant l'étirement LE TEMPS DE LA LECTURE (synchronement, avant tout
  // paint : invisible), via offsetHeight (hauteur de layout, insensible aux
  // transforms du drag). Aucune boucle possible : la mesure n'est jamais polluée
  // par la hauteur imposée.
  const [autoH, setAutoH] = useState(200);
  const autoHRef = useRef(200);
  const [preview, setPreview] = useState<PanelSize | null>(null);
  const [resizing, setResizing] = useState(false);
  // Le widget déclare-t-il une région qui sait défiler (`.panel-scroll`) ?
  // Si oui, RÉDUIRE le panneau sous la hauteur de son contenu est légitime :
  // la région défile et la structure interne change réellement. Sinon on
  // garde le plancher anti-troncature (jamais de contenu coupé).
  const [scrollable, setScrollable] = useState(false);
  const scrollableRef = useRef(false);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const detect = () => {
      const has = !!el.querySelector(".panel-scroll");
      scrollableRef.current = has;
      setScrollable((prev) => (prev === has ? prev : has));
    };
    const measure = () => {
      detect();
      const card = el.firstElementChild as HTMLElement | null;
      let natural: number;
      if (card) {
        // La carte étant étirée en permanence pour remplir son empreinte, on
        // désactive l'étirement LE TEMPS DE LA LECTURE (synchronement, avant
        // tout paint : invisible). offsetHeight = hauteur de layout, insensible
        // aux transforms du drag. Aucune boucle possible : la mesure n'est
        // jamais polluée par la hauteur imposée.
        const wasFill = el.classList.contains("rgrid-fill");
        if (wasFill) el.classList.remove("rgrid-fill");
        natural = card.offsetHeight;
        if (wasFill) el.classList.add("rgrid-fill");
      } else {
        natural = el.offsetHeight;
      }
      const hh = Math.max(1, Math.round(natural));
      autoHRef.current = hh;
      setAutoH((prev) => (Math.abs(prev - hh) > 1 ? hh : prev));
    };
    // ⚠️ Observer le wrap et la carte NE SUFFIT PAS : tous deux sont bornés à
    // la hauteur de l'empreinte (`.rgrid-fill`), donc ils ne changent JAMAIS
    // de taille quand le contenu grandit — le ResizeObserver ne se déclenchait
    // pas et la hauteur naturelle restait périmée (contenu tronqué après un
    // re-agencement, ex. une rangée de boutons qui passe sur 2 lignes).
    // On observe donc aussi les enfants directs de la carte, seuls libres de
    // varier, et on ré-attache l'observation quand la structure change.
    const ro = new ResizeObserver(measure);
    const attach = () => {
      ro.disconnect();
      ro.observe(el);
      const card = el.firstElementChild;
      if (card) {
        ro.observe(card);
        for (const kid of Array.from(card.children)) ro.observe(kid);
      }
    };
    measure();
    attach();
    // Le contenu d'un widget peut aussi changer de structure sans changer de
    // taille (onglet, état vide → liste) : on re-détecte la région défilante
    // et on remet l'observation à jour.
    // ⚠️ `measure()` retire/remet lui-même la classe `rgrid-fill` sur `el` :
    // sans ce filtre, la mutation qu'il provoque relance la mesure → boucle
    // infinie (renderer figé). On ignore donc les mutations de classe portant
    // sur le wrap lui-même.
    const mo = new MutationObserver((records) => {
      const selfOnly = records.every(
        (r) => r.target === el && r.type === "attributes" && r.attributeName === "class",
      );
      if (selfOnly) return;
      attach();
      measure();
    });
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  const onResizePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    const wrap = wrapRef.current;
    if (!grid || !wrap) return;

    const gridW = grid.getBoundingClientRect().width;
    const colStride = (gridW - (columns - 1) * colGap) / columns + colGap;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = w;
    const keepH = pinnedH; // une hauteur épinglée survit à un drag purement horizontal
    const startPx = wrap.getBoundingClientRect().height;
    let moved = false;
    let lastEv: PointerEvent = e.nativeEvent;
    let applied: PanelSize | null = null;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* sans conséquence */
    }

    // Conteneur défilant (zone visible) → borne haute : un widget ne peut pas
    // dépasser la hauteur d'un écran (sinon il « disparaît » plus bas).
    let scroller: HTMLElement | null = grid.parentElement;
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) {
      scroller = scroller.parentElement;
    }

    // — PLANCHER —
    // Widget SANS région défilante : jamais sous la hauteur de son contenu
    // (aucun contenu tronqué). Widget AVEC `.panel-scroll` : on peut descendre
    // jusqu'au plancher absolu, la région interne prend le relais en défilant
    // — c'est ce qui rend le redimensionnement réellement structurel.
    const naturalMinH = () =>
      Math.ceil((autoHRef.current + V_SPACE) / HEIGHT_STEP) * HEIGHT_STEP;
    const floorOf = () => {
      const hard = Math.max(MIN_PX, minH ?? 0);
      return scrollableRef.current
        ? Math.ceil(hard / HEIGHT_STEP) * HEIGHT_STEP
        : Math.max(Math.ceil(hard / HEIGHT_STEP) * HEIGHT_STEP, naturalMinH());
    };
    // — PLAFOND — ~92% de la zone visible, borné par `maxH` s'il est fourni,
    // mais jamais sous le plancher (sinon la contrainte devient contradictoire).
    const ceilOf = () => {
      const vp = scroller ? scroller.clientHeight : window.innerHeight;
      const viewCap = Math.floor((vp * 0.92) / HEIGHT_STEP) * HEIGHT_STEP;
      return Math.max(floorOf(), Math.min(maxH ?? Number.POSITIVE_INFINITY, viewCap));
    };

    // `commit=true` → valeur ENREGISTRÉE (bornée au plafond).
    // `commit=false` → valeur AFFICHÉE : au-delà du plafond, dépassement élastique
    //   (résistance 0.18) pour qu'on VOIE le widget résister, puis retour au max
    //   au relâchement (React réapplique la valeur bornée → effet ressort via FLIP).
    const compute = (ev: PointerEvent, commit: boolean): PanelSize => {
      const dw = Math.round((ev.clientX - startX) / colStride);
      const nextW = clamp(startW + dw, effMinW, effMaxW);
      const dy = ev.clientY - startY;
      const floorH = floorOf();
      if (Math.abs(dy) >= 12) {
        const raw = Math.round((startPx + dy) / HEIGHT_STEP) * HEIGHT_STEP;
        const mx = ceilOf();
        let h: number;
        // Dépassement ÉLASTIQUE aux deux bornes tant qu'on tire (résistance 0.18) :
        // on VOIT le widget résister, puis la valeur enregistrée est bornée.
        if (!commit && raw > mx) h = Math.round(mx + (raw - mx) * 0.18);
        else if (!commit && raw < floorH) h = Math.round(floorH - (floorH - raw) * 0.18);
        else h = clamp(raw, floorH, mx);
        return { w: nextW, h };
      }
      // Drag horizontal : garde la hauteur épinglée, mais jamais sous le contenu re-agencé.
      return keepH !== undefined ? { w: nextW, h: clamp(keepH, floorH, ceilOf()) } : { w: nextW };
    };

    const onMove = (ev: PointerEvent) => {
      lastEv = ev;
      if (!moved) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
        moved = true;
        setResizing(true);
        document.body.style.userSelect = "none";
        document.body.style.cursor = "nwse-resize";
      }
      const next = compute(ev, false);
      if (applied && applied.w === next.w && applied.h === next.h) return;
      applied = next;
      captureFlip(id); // les voisins glissent au fil des crans
      setPreview(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setResizing(false);
      if (moved) {
        // saveOverride capture le FLIP (positions avec dépassement encore affiché) →
        // le retour à la taille max glisse (ressort) au lieu de sauter.
        saveOverride(id, compute(lastEv, true));
        setPreview(null);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const resetSize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPreview(null);
    clearOverride(id);
  };

  /** Double-clic sur la poignée : désépingle la hauteur (revient au contenu). */
  const unpinHeight = () => {
    if (pinnedH === undefined) return;
    setPreview(null);
    saveOverride(id, { w });
  };

  const effW = clamp(preview?.w ?? w, effMinW, effMaxW);
  const effPinned = preview ? preview.h : pinnedH;
  const isPinned = effPinned !== undefined;

  // — BORNES DE HAUTEUR AU RENDU (mêmes règles que pendant le drag) —
  // Hauteur naturelle du contenu, arrondie à la grille de base 8px : rythme
  // vertical commun entre panneaux.
  const naturalFootprint = ceil8(autoH + V_SPACE);
  // Plancher : contenu entier si le widget ne sait pas défiler, plancher absolu
  // sinon (la région `.panel-scroll` absorbe la différence).
  const hardMin = ceil8(Math.max(MIN_PX, minH ?? 0));
  const floorFootprint = scrollable ? hardMin : Math.max(hardMin, naturalFootprint);
  // Plafond : ~une hauteur d'écran, borné par `maxH`, jamais sous le plancher.
  // Appliqué AU RENDU → même une taille enregistrée démesurée (ancien override,
  // écran plus grand) est ramenée dans le cadre au chargement, et re-bornée si
  // la fenêtre est redimensionnée / l'écran tourné (`viewportH`).
  const ceilFootprint = Math.max(
    floorFootprint,
    Math.min(maxH ?? Number.POSITIVE_INFINITY, Math.floor((viewportH * 0.9) / 8) * 8),
  );
  const wantH = isPinned
    ? Math.max(Math.round(effPinned as number), scrollable ? hardMin : floorFootprint)
    : naturalFootprint;
  // preview = dépassement élastique autorisé (effet ressort) ; sinon on borne.
  const footprint = Math.max(8, preview ? wantH : clamp(wantH, floorFootprint, ceilFootprint));
  const lifted = isDragging || resizing;
  // Le panneau est-il volontairement plus grand que son contenu ? (mode « remplir »)
  const stretched = footprint > naturalFootprint + 1;

  // Poignées : invisibles ET inertes au repos (`pointer-events-none`) — sinon
  // elles interceptent les clics destinés au contenu de la carte, sur toute la
  // largeur du coin haut-droit.
  const handleBtn =
    "flex h-6 w-6 items-center justify-center rounded-[8px] text-text-dim transition-colors duration-150 hover:bg-overlay-2 hover:text-text [touch-action:none] [user-select:none]";

  return (
    <div
      ref={wrapRef}
      data-pid={id}
      data-cols={effW}
      data-stretched={stretched ? "" : undefined}
      className="group/panel relative min-w-0"
      style={{
        gridColumn: `span ${effW}`,
        gridRow: `span ${footprint}`,
        // Place réservée à la barre de poignées au survol (cf. `.rgrid-head`) :
        // 3 poignées (avec ⟲ réinitialiser) si le panneau a été redimensionné,
        // 2 sinon. Les en-têtes marqués `.rgrid-head` décalent alors leurs
        // contrôles pour ne jamais passer sous la barre.
        ["--rgrid-handle-w" as string]: override ? "5.25rem" : "4rem",
        // La carte remplit TOUJOURS son empreinte (min-height via .rgrid-fill) :
        // bords alignés sur la grille 8px et gouttière verticale constante (16px),
        // identique à la gouttière horizontale.
        height: footprint,
        // Jamais de débordement sur un voisin ; le drag garde overflow visible
        // pour l'ombre/l'échelle du panneau soulevé.
        overflow: isDragging ? "visible" : "clip",
        paddingBottom: V_SPACE,
        boxSizing: "border-box",
      }}
    >
      <div
        ref={contentRef}
        className="rgrid-content rgrid-fill h-full min-w-0"
        style={{
          // flow-root : empêche les marges internes de « fuir » hors du wrapper
          // (sinon la mesure de hauteur est fausse → chevauchements).
          display: "flow-root",
          borderRadius: "var(--radius-card)", // l'ombre de levée suit le rayon de la carte
          transformOrigin: "center",
          transform: isDragging ? "scale(1.02)" : resizing ? "scale(1.006)" : undefined,
          boxShadow: lifted ? "var(--lift-shadow)" : undefined,
          transition:
            "transform var(--dur-base) var(--ease-out-quint), box-shadow var(--dur-base) ease",
        }}
      >
        {children}
      </div>

      {/* Barre de poignées (coin haut-droit) — un seul objet « verre », révélé au
          survol. `pointer-events-none` au repos : aucune zone morte invisible
          au-dessus du contenu de la carte. */}
      <div
        className="pointer-events-none absolute right-1.5 top-1.5 z-20 flex items-center gap-0.5 rounded-[11px] border border-border p-0.5 opacity-0 shadow-sm transition-opacity duration-150 group-hover/panel:pointer-events-auto group-hover/panel:opacity-100"
        style={{
          background: "var(--glass-bg)",
          backdropFilter: "var(--glass-blur)",
          WebkitBackdropFilter: "var(--glass-blur)",
        }}
      >
        {/* Réinitialiser — seulement si le panneau a été modifié */}
        {override && (
          <button
            type="button"
            data-tip={t("Réinitialiser la taille")}
            data-tip-sub={t("Rend au panneau sa largeur et sa hauteur d’origine.")}
            aria-label={t("Réinitialiser la taille du panneau")}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={resetSize}
            className={handleBtn}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 12a8 8 0 1 1 2.3 5.6M4 12v-4M4 12h4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* Déplacer */}
        <div
          role="button"
          tabIndex={-1}
          aria-label={t("Déplacer le panneau")}
          data-tip={t("Déplacer")}
          data-tip-sub={t("Glisser pour réordonner les panneaux de la vue.")}
          onPointerDown={(e) => startMove(id, e)}
          className={`${handleBtn} cursor-grab active:cursor-grabbing`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <circle cx="3.5" cy="2.5" r="1" />
            <circle cx="8.5" cy="2.5" r="1" />
            <circle cx="3.5" cy="6" r="1" />
            <circle cx="8.5" cy="6" r="1" />
            <circle cx="3.5" cy="9.5" r="1" />
            <circle cx="8.5" cy="9.5" r="1" />
          </svg>
        </div>

        {/* Masquer — réaffichable via la rangée « masqués » */}
        <button
          type="button"
          data-tip={t("Masquer le panneau")}
          data-tip-sub={t("Il réapparaît en pastille sous la grille, pour le restaurer d’un clic.")}
          aria-label={t("Masquer le panneau")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => hidePanel(id)}
          className={handleBtn}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 5l14 14M19 5L5 19"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Ouvrir la vue complète (coin bas-gauche) — discret, au survol */}
      {onOpen && (
        <button
          type="button"
          data-tip={t("Ouvrir la vue complète")}
          data-tip-sub={t("Affiche ce module en pleine page, avec tous ses réglages.")}
          aria-label={t("Ouvrir la vue complète")}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onOpen}
          className={`pointer-events-none absolute left-1.5 z-20 rounded-[9px] border border-border p-1 text-text-dim opacity-0 shadow-sm transition-opacity duration-150 hover:text-text group-hover/panel:pointer-events-auto group-hover/panel:opacity-100`}
          style={{
            bottom: V_SPACE + 6,
            background: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M7 17 17 7M9 7h8v8"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* Redimensionner (coin bas-droit) — double-clic : hauteur automatique */}
      <div
        role="separator"
        aria-label="Redimensionner en glissant"
        data-tip="Redimensionner"
        data-tip-sub={t("Glisser pour ajuster · double-clic : revenir à la hauteur automatique.")}
        data-tip-side="left"
        onPointerDown={onResizePointerDown}
        onDoubleClick={unpinHeight}
        // ⚠️ `hidden` sous pointeur grossier : redimensionner par colonnes et
        // par pas de 24 px est un geste de curseur. Au doigt, la poignée fait
        // 7×7 — sous la cible tactile minimale — et son `pointer-down` volerait
        // le défilement de la vue. La condition interroge le MATÉRIEL de
        // pointage (`pointer: coarse`), pas la largeur : un Mac en fenêtre
        // étroite garde sa poignée, un iPad la perd. Cf. DESIGN.md, « cibles
        // tactiles », et MOBILE.md § 5.2.
        className="pointer-events-none absolute z-20 flex h-7 w-7 cursor-nwse-resize items-end justify-end p-1.5 opacity-0 transition-opacity duration-150 group-hover/panel:pointer-events-auto group-hover/panel:opacity-100 [touch-action:none] [user-select:none] [@media(pointer:coarse)]:hidden"
        style={{ right: 0, bottom: V_SPACE }}
      >
        <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden>
          <path
            d="M10 4.5 L10 10 L4.5 10 M10 8 L8 10 M10 1 L1 10"
            fill="none"
            stroke="var(--color-text-dim)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
