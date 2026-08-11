// Info-bulles « Hover Hints » — système global, style Apple (help tags macOS).
//
// Principe : UNE seule bulle vit dans le DOM (montée une fois dans App), et
// l'app entière la déclenche en posant des attributs sur n'importe quel
// élément — aucun wrapper, aucun state local, aucun re-render par bouton :
//
//   <button data-tip="Régénérer le briefing">…</button>
//   <button data-tip="Flash" data-tip-sub="Lecture intra-séance" data-tip-kbd="⌘F">…</button>
//   <a data-tip="Notes" data-tip-side="right">…</a>
//
// Attributs reconnus :
//   data-tip      — libellé (obligatoire ; vide = pas de bulle)
//   data-tip-sub  — 2ᵉ ligne explicative (optionnelle)
//   data-tip-kbd  — raccourci clavier affiché en pastille (optionnel)
//   data-tip-side — côté préféré : top | bottom | left | right (défaut : top)
//
// Comportements « natifs » reproduits :
//   - délai à froid (on n'interrompt pas un geste), quasi nul à chaud
//     (une fois la 1ʳᵉ bulle vue, les suivantes suivent le curseur) ;
//   - disparition immédiate au clic, au scroll, à la frappe, à la sortie ;
//   - apparition au focus clavier (accessibilité) ;
//   - retournement automatique quand la bulle ne tient pas du côté demandé,
//     puis calage dans la fenêtre : jamais de débordement.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
// Densité : `getBoundingClientRect` renvoie des px écran, un `position: fixed`
// sous un <html> zoomé raisonne en px locaux — on divise au moment d'écrire.
import { zoomFactor } from "../lib/uiConfig";

type Side = "top" | "bottom" | "left" | "right";

interface TipData {
  el: HTMLElement;
  label: string;
  sub: string | null;
  kbd: string | null;
  side: Side;
}

const COLD_DELAY = 400; // 1ᵉʳ survol : laisse l'utilisateur agir sans être interrompu
const WARM_DELAY = 60; // survol enchaîné : la bulle « suit » d'un élément à l'autre
const WARM_WINDOW = 550; // fenêtre pendant laquelle on reste « chaud » après une fermeture
const OUT_MS = 110; // durée de la disparition (doit rester ≤ la transition CSS)
const IN_MS = 240; // durée de l'entrée (doit rester ≥ la transition CSS)
const GAP = 8; // distance bulle ↔ élément
const EDGE = 8; // marge minimale avec le bord de la fenêtre

const SIDES: Side[] = ["top", "bottom", "right", "left"];

function isSide(v: string | null | undefined): v is Side {
  return v === "top" || v === "bottom" || v === "left" || v === "right";
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export default function TooltipLayer() {
  const [tip, setTip] = useState<TipData | null>(null);
  const [side, setSide] = useState<Side>("top");
  const [shown, setShown] = useState(false); // déclenche la transition d'entrée
  /** Animation terminée : on rend la bulle au rendu normal (texte net). */
  const [settled, setSettled] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);
  const lastHideAt = useRef(0);
  const anchorRef = useRef<HTMLElement | null>(null);
  /** Miroir de `tip` : les écouteurs (attachés une fois) lisent l'état courant
   *  sans se ré-attacher à chaque ouverture. */
  const tipRef = useRef<TipData | null>(null);
  tipRef.current = tip;

  const close = useCallback((immediate = false) => {
    window.clearTimeout(showTimer.current);
    anchorRef.current = null;
    if (tipRef.current) lastHideAt.current = Date.now();
    setSettled(false); // la sortie redevient une animation
    setShown(false); // → transition de sortie (opacité + zoom)
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setTip(null), immediate ? 0 : OUT_MS);
  }, []);

  /** Programme l'ouverture pour un élément porteur de `data-tip`. */
  const open = useCallback(
    (el: HTMLElement) => {
      const label = el.getAttribute("data-tip")?.trim();
      if (!label) return;
      window.clearTimeout(hideTimer.current);
      anchorRef.current = el;
      const attrSide = el.getAttribute("data-tip-side");
      const next: TipData = {
        el,
        label,
        sub: el.getAttribute("data-tip-sub")?.trim() || null,
        kbd: el.getAttribute("data-tip-kbd")?.trim() || null,
        side: isSide(attrSide) ? attrSide : "top",
      };
      const warm = Date.now() - lastHideAt.current < WARM_WINDOW;
      window.clearTimeout(showTimer.current);
      showTimer.current = window.setTimeout(
        () => {
          // l'élément peut avoir disparu (navigation) pendant le délai
          if (anchorRef.current !== el || !el.isConnected) return;
          setShown(false);
          setTip(next);
        },
        warm ? WARM_DELAY : COLD_DELAY,
      );
    },
    [],
  );

  // — Délégation globale : un seul jeu d'écouteurs pour toute l'application —
  useEffect(() => {
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return; // pas de survol au doigt
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.("[data-tip]") as HTMLElement | null;
      if (el === anchorRef.current) return;
      if (!el) {
        if (anchorRef.current) close();
        else window.clearTimeout(showTimer.current);
        return;
      }
      open(el);
    };

    // Focus clavier : la bulle sert aussi d'aide à la navigation au clavier.
    const onFocus = (e: FocusEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(
        "[data-tip]",
      ) as HTMLElement | null;
      if (!el) return;
      if (el.matches(":focus-visible")) open(el);
    };
    const onBlur = () => anchorRef.current && close();

    // Tout geste « sérieux » referme immédiatement (comportement macOS).
    const onDismiss = () => {
      window.clearTimeout(showTimer.current);
      anchorRef.current = null;
      if (tipRef.current) close(true);
    };

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointerdown", onDismiss, true);
    document.addEventListener("keydown", onDismiss, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("focusout", onBlur, true);
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("blur", onDismiss);
    return () => {
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointerdown", onDismiss, true);
      document.removeEventListener("keydown", onDismiss, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", onBlur, true);
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("blur", onDismiss);
      window.clearTimeout(showTimer.current);
      window.clearTimeout(hideTimer.current);
    };
  }, [close, open]);

  // — Placement : mesuré AVANT la peinture, donc sans saccade ni saut —
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!tip || !wrap) return;
    if (!tip.el.isConnected) {
      setTip(null);
      return;
    }
    const z = zoomFactor();
    const a = tip.el.getBoundingClientRect();
    const b = wrap.getBoundingClientRect(); // taille naturelle (le scale vit sur l'enfant)
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const fits: Record<Side, boolean> = {
      top: a.top - GAP - b.height >= EDGE,
      bottom: a.bottom + GAP + b.height <= vh - EDGE,
      left: a.left - GAP - b.width >= EDGE,
      right: a.right + GAP + b.width <= vw - EDGE,
    };
    const placed = fits[tip.side] ? tip.side : (SIDES.find((s) => fits[s]) ?? tip.side);

    let x: number;
    let y: number;
    if (placed === "top" || placed === "bottom") {
      x = a.left + a.width / 2 - b.width / 2;
      y = placed === "top" ? a.top - GAP - b.height : a.bottom + GAP;
    } else {
      x = placed === "left" ? a.left - GAP - b.width : a.right + GAP;
      y = a.top + a.height / 2 - b.height / 2;
    }
    x = clamp(x, EDGE, Math.max(EDGE, vw - EDGE - b.width));
    y = clamp(y, EDGE, Math.max(EDGE, vh - EDGE - b.height));

    // NETTETÉ. Le centrage (`- b.width / 2`) et la densité tombent presque
    // toujours sur une fraction de pixel : une bulle posée à 412,5 px est
    // rasterisée à cheval sur deux pixels physiques et son texte paraît flou —
    // d'où des bulles nettes et d'autres non, selon l'onglet survolé.
    // On cale donc la position finale sur la grille de pixels PHYSIQUES (on
    // raisonne encore en px écran ici), avant de repasser en px locaux : après
    // multiplication par le zoom puis par la densité de l'écran, l'origine de
    // la bulle retombe sur un pixel entier.
    const dpr = window.devicePixelRatio || 1;
    const snap = (v: number) => Math.round(v * dpr) / dpr;
    // `translate` 2D et non `translate3d` : pas de calque GPU permanent, donc
    // pas de texte rasterisé une fois pour toutes puis remis à l'échelle.
    wrap.style.transform = `translate(${snap(x) / z}px, ${snap(y) / z}px)`;
    setSide(placed);

    // Une frame plus tard : on lance l'animation d'entrée (fondu + léger zoom),
    // puis, une fois posée, on repasse la bulle en rendu normal (`is-settled`) :
    // tant qu'elle est promue en calque, le texte reste légèrement adouci.
    setSettled(false);
    let t = 0;
    const raf = requestAnimationFrame(() => {
      setShown(true);
      // le compteur part de l'animation RÉELLE : si la frame tarde (fenêtre en
      // arrière-plan), on ne coupe pas l'entrée avant qu'elle ait commencé.
      t = window.setTimeout(() => setSettled(true), IN_MS);
    });
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [tip]);

  if (!tip) return null;

  return (
    <div ref={wrapRef} className="tip-wrap" data-side={side} role="tooltip" aria-hidden>
      <div className={`tip${shown ? " is-in" : ""}${settled ? " is-settled" : ""}`}>
        <span className="tip-row">
          <span className="tip-label">{tip.label}</span>
          {tip.kbd && <kbd className="tip-kbd">{tip.kbd}</kbd>}
        </span>
        {tip.sub && <span className="tip-sub">{tip.sub}</span>}
      </div>
    </div>
  );
}
