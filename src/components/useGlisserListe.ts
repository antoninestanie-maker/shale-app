// ─────────────────────────────────────────────────────────────────────────────
// Ranger une courte liste verticale en glissant ses lignes — après un MAINTIEN.
//
// 2026-10-13, pour « barre du bas » de Personnaliser (Antonin : « ajoute le
// glisser au doigt pour ranger les onglets. Avec un maintien d'abord. »).
//
// Le geste, dans l'ordre :
//   1. on pose le doigt sur une ligne et on ne bouge pas (`MAINTIEN_MS`) ;
//      bouger avant, c'est faire défiler la page : on rend la main ;
//   2. la ligne se soulève ; elle suit le doigt, ses voisines s'écartent ;
//   3. on lâche : l'ordre est écrit. Lâcher sur place n'écrit rien.
//
// Ce qu'il DÉCIDE (le rang d'arrivée, qui s'écarte) est dans `lib/onglets.ts`,
// testé. Ici il n'y a que les écouteurs — et aucun test ne prouve un geste
// (`PIEGES.md` § 7.1) : il se vérifie au doigt.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as PointeurReact } from "react";

import { ecartDeLigne, JEU_DU_MAINTIEN, MAINTIEN_MS, rangDArrivee } from "../lib/onglets";
import { zoomFactor } from "../lib/uiConfig";

interface Glisse<T> {
  id: T;
  depart: number;
  rang: number;
  /** Déplacement de la ligne, en pixels LOCAUX (déjà divisé par le zoom). */
  dy: number;
  /** Distance entre deux lignes, en pixels locaux. */
  pas: number;
}

/** Ce qui ne doit pas démarrer un glissement : les contrôles de la ligne. */
const CONTROLES = "button, a, input, select, textarea, [role=button]";

export function useGlisserListe<T>(ids: readonly T[], onRanger: (id: T, rang: number) => void) {
  const [glisse, setGlisse] = useState<Glisse<T> | null>(null);
  /** Ce qu'il faut défaire si le composant part au milieu d'un geste. */
  const detacherRef = useRef<(() => void) | null>(null);
  useEffect(() => () => detacherRef.current?.(), []);

  /** Le conteneur des lignes : à poser sur l'élément qui les porte. */
  const refListe = useRef<HTMLDivElement>(null);
  /** Une ligne est-elle en main ? Lu par l'écouteur ci-dessous, hors de React. */
  const enMainRef = useRef(false);

  /**
   * ⚠️ Une fois la ligne en main, le doigt ne doit plus faire défiler la page.
   * `touch-action` ne peut pas le dire : il est lu au MOMENT du toucher, et à ce
   * moment-là on ne sait pas encore si ce sera un maintien. Refuser le
   * `touchmove` le peut — le défilement n'a pas commencé, puisque le doigt n'a
   * pas bougé pendant le maintien.
   *
   * Deux conditions, et aucune n'est décorative :
   * - `passive: false` : un écouteur passif n'a pas le droit de refuser ;
   * - posé AU MONTAGE, pas au début du geste. WebKit décide au toucher s'il
   *   doit attendre le JavaScript avant de défiler, d'après les écouteurs qui
   *   existent déjà sous le doigt ; un écouteur ajouté après arrive trop tard.
   *   Sur la liste seule, pas sur le document : ailleurs, le défilement ne
   *   passe par aucun script.
   */
  useEffect(() => {
    const liste = refListe.current;
    if (!liste) return;
    const retenir = (ev: TouchEvent) => {
      if (enMainRef.current && ev.cancelable) ev.preventDefault();
    };
    liste.addEventListener("touchmove", retenir, { passive: false });
    return () => liste.removeEventListener("touchmove", retenir);
  }, []);

  /**
   * ⚠️ Les écouteurs sont posés DANS le `pointerdown`, pas dans un effet : un
   * effet n'existe qu'après le rendu, et un geste rapide serait déjà fini
   * (`GrilleHoraire.tsx`, constaté à l'écran le 2026-09-02).
   */
  const saisir = useCallback(
    (id: T) => (e: PointeurReact<HTMLElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if ((e.target as HTMLElement).closest(CONTROLES)) return;
      const depart = ids.indexOf(id);
      const ligne = e.currentTarget;
      const liste = ligne.parentElement;
      if (depart < 0 || ids.length < 2 || !liste) return;
      detacherRef.current?.();

      const pointeur = e.pointerId;
      const origine = { x: e.clientX, y: e.clientY };
      let etat: Glisse<T> | null = null;

      const minuterie = window.setTimeout(() => {
        // Le pas se mesure À L'ARMEMENT, sur les lignes réelles : il suit la
        // densité, la taille de texte du système et la hauteur au doigt.
        const lignes = Array.from(liste.querySelectorAll<HTMLElement>("[data-ligne-glisse]"));
        const zoom = zoomFactor();
        const pas =
          lignes.length > 1
            ? (lignes[1].getBoundingClientRect().top - lignes[0].getBoundingClientRect().top) / zoom
            : 0;
        if (!(pas > 0)) return detacher();
        etat = { id, depart, rang: depart, dy: 0, pas };
        enMainRef.current = true;
        setGlisse(etat);
        try {
          ligne.setPointerCapture(pointeur);
        } catch {
          /* pointeur déjà relâché : le `pointerup` de la fenêtre fera le ménage */
        }
        vibrer();
      }, MAINTIEN_MS);

      const bouger = (ev: PointerEvent) => {
        if (ev.pointerId !== pointeur) return;
        if (!etat) {
          // Bougé avant la fin du maintien : c'est un défilement.
          if (Math.hypot(ev.clientX - origine.x, ev.clientY - origine.y) > JEU_DU_MAINTIEN) detacher();
          return;
        }
        const { pas } = etat;
        const brut = (ev.clientY - origine.y) / zoomFactor();
        // La ligne ne quitte pas la liste : « Plus », dessous, ne bouge jamais.
        const dy = Math.min((ids.length - 1 - depart) * pas, Math.max(-depart * pas, brut));
        etat = { ...etat, dy, rang: rangDArrivee(depart, dy, pas, ids.length) };
        setGlisse(etat);
      };

      function detacher() {
        window.clearTimeout(minuterie);
        window.removeEventListener("pointermove", bouger);
        window.removeEventListener("pointerup", lacher);
        window.removeEventListener("pointercancel", abandonner);
        detacherRef.current = null;
        enMainRef.current = false;
        etat = null;
        setGlisse(null);
      }

      function lacher(ev: PointerEvent) {
        if (ev.pointerId !== pointeur) return;
        const fin = etat;
        detacher();
        if (fin && fin.rang !== fin.depart) onRanger(fin.id, fin.rang);
      }

      /** Le système a repris le geste (appel entrant, défilement) : rien n'est écrit. */
      function abandonner(ev: PointerEvent) {
        if (ev.pointerId === pointeur) detacher();
      }

      window.addEventListener("pointermove", bouger);
      window.addEventListener("pointerup", lacher);
      window.addEventListener("pointercancel", abandonner);
      detacherRef.current = detacher;
    },
    [ids, onRanger],
  );

  /** Le style d'une ligne pendant le geste. Hors geste : rien, aucune transition. */
  const styleDe = (id: T): CSSProperties | undefined => {
    if (!glisse) return undefined;
    if (id === glisse.id) {
      return {
        transform: `translateY(${glisse.dy}px) scale(1.02)`,
        zIndex: 2,
        position: "relative",
        boxShadow: "var(--lift-shadow)",
      };
    }
    const ecart = ecartDeLigne(ids.indexOf(id), glisse.depart, glisse.rang);
    return {
      transform: ecart ? `translateY(${ecart * glisse.pas}px)` : undefined,
      transition: "transform var(--dur-fast) var(--ease-out-quint)",
    };
  };

  return { refListe, saisir, styleDe, enMain: glisse?.id ?? null };
}

/**
 * Retour haptique à l'armement. ⚠️ `navigator.vibrate` n'existe ni sur iOS
 * Safari ni en WKWebView (`PIEGES.md` § 7.4 ter) : c'est la ligne soulevée qui
 * dit qu'elle est en main, la vibration n'est qu'un renfort là où elle existe.
 */
function vibrer(): void {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* un appareil sans vibreur n'est pas une erreur */
  }
}
