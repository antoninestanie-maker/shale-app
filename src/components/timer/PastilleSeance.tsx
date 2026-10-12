/**
 * ⭐ LA PASTILLE DE SÉANCE — ce qui reste à l'écran pendant qu'une séance
 * tourne et qu'on travaille ailleurs dans l'app. En haut au bureau, en bas au
 * téléphone (au-dessus de la barre d'onglets).
 *
 * CE QUI A CHANGÉ LE 2026-10-12, sur trois phrases d'Antonin :
 *   • « le timer est en plein écran si on clique dessus, ce n'est pas bon » :
 *     un clic ouvre la page Timer. Le plein écran ne s'ouvre plus que par un
 *     geste qui porte ce nom ;
 *   • « on ne peut pas la fermer directement d'un clic droit » : le clic droit
 *     ouvre le menu de l'app (Pause / Reprendre, Terminer la session, Ouvrir
 *     le Timer, Plein écran) ;
 *   • lancer un focus n'ouvre plus le plein écran : la pastille est donc CE
 *     QUI DIT que la séance est partie. Elle entre en glissant (`pastille.css`).
 *
 * ⚠️ RÈGLE 17 — rien n'existe seulement au clic droit. Les quatre gestes sont
 * dans le « ⋯ », visible en permanence, atteignable à la souris, au clavier
 * (Tab, puis Entrée ; Maj+F10 sur la pastille) et au doigt. Pause / Reprendre,
 * le plus fréquent, a en plus son bouton.
 *
 * ⚠️ RÈGLE 18 — un geste, une fonction : `gestes` ci-dessous sert au bouton,
 * au clic sur la pastille ET aux entrées du menu (`catalogue/seance.tsx`).
 *
 * ⚠️ Ce n'est plus UN bouton mais un groupe de trois : un bouton dans un bouton
 * n'est pas du HTML valide, et le clic sur « ⋯ » aurait aussi ouvert le Timer.
 *
 * ⚠️ Au téléphone, chaque cible fait 44 pt et la pastille garde 44 pt de haut :
 * la réserve `--reserve-seance` (`FocusOverlay`) compte dessus.
 */

import { t } from "../../lib/i18n";
import { allerVers } from "../../lib/naviguer";
import type { FocusController } from "../../lib/useFocus";
import { IconPause, IconPlay } from "../icons";
import MenuContextuel, { BoutonMenu } from "../menu/MenuContextuel";
import { useMenuContextuel } from "../menu/useMenuContextuel";
import { entreesSeance, type GestesSeance } from "../menu/catalogue/seance";
import "./pastille.css";

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Le menu n'a qu'une cible possible : la séance en cours. */
const CIBLE = "seance" as const;

export default function PastilleSeance({ focus, enBas }: { focus: FocusController; enBas: boolean }) {
  const { session, remainingSec, paused, pause, resume, stop, setOverlayOpen } = focus;
  const menu = useMenuContextuel<typeof CIBLE>();
  if (!session) return null;

  const gestes: GestesSeance = {
    basculerPause: paused ? resume : pause,
    terminer: () => stop(),
    ouvrirTimer: () => allerVers("timer"),
    pleinEcran: () => setOverlayOpen(true),
  };

  const estUnePause = session.kind === "break";
  const accent = estUnePause ? "var(--color-success)" : "var(--color-blue)";
  // « Pause » est écrit tel quel par `useFocus` : une valeur, pas un texte affiché.
  const nom = estUnePause ? t("pause") : session.label;
  const actions = t("Actions sur la session");

  return (
    <>
      <div
        role="group"
        aria-label={t("Session en cours")}
        data-bord={enBas ? "bas" : "haut"}
        // Au téléphone, pas de marge verticale : les trois cibles font déjà
        // 44 pt, et la pastille doit rester à la hauteur que `--reserve-seance`
        // lui réserve (`RESERVE_SEANCE`, `FocusOverlay`).
        // ⚠️ NETTETÉ (2026-10-12) — centrée par des MARGES (`inset-x-0 mx-auto
        // w-fit`), jamais par `left-1/2 -translate-x-1/2`. Une pastille fixe
        // est un calque à part ; décalée par un `translate`, WebKit ne la cale
        // plus sur les pixels : à 110 % elle tombait à x = 657,75 et tout son
        // texte était flou (vu par Antonin). `translate-none` écarte aussi le
        // soulèvement de 2 px des cartes au survol, qui la remettrait à cheval.
        // PIEGES § 41 ; `nettete.source.test.ts` refuse le retour du motif.
        className={`pastille-seance card fixed inset-x-0 z-40 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] translate-none items-center gap-0.5 px-1 ${
          enBas ? "py-0" : "top-4 py-1"
        }`}
        style={enBas ? { bottom: "calc(env(safe-area-inset-bottom) + 4.75rem)" } : undefined}
        onContextMenu={(e) => menu.ouvrirAuPoint(e, CIBLE)}
        onKeyDown={(e) => void menu.ouvrirAuClavier(e, CIBLE)}
      >
        <button
          type="button"
          onClick={gestes.ouvrirTimer}
          aria-label={`${t("Ouvrir le Timer")} — ${fmt(remainingSec)}, ${paused ? `${t("en pause")}, ` : ""}${nom}`}
          data-tip={t("Ouvrir le Timer")}
          className="cible-tactile-ligne flex min-w-0 items-center gap-3 rounded-[10px] px-3 py-1 text-left transition-colors hover:bg-overlay"
        >
          <span
            className={paused ? "h-2 w-2 shrink-0 rounded-full" : "animate-pulse-dot h-2 w-2 shrink-0 rounded-full"}
            style={{ backgroundColor: paused ? "var(--color-yellow)" : accent }}
          />
          {/* `tabular-nums` : les chiffres gardent leur largeur, la pastille ne
              tremble pas d'un pixel à chaque seconde. */}
          <span className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${paused ? "text-text-dim" : "text-text"}`}>
            {fmt(remainingSec)}
          </span>
          {/* ⚠️ « en pause » AVANT le nom, et jamais coupé : écrit à la suite
              d'un nom long, il partait dans les points de suspension (vu à
              l'écran le 2026-10-12). Une pause… mise en pause ne répète pas
              « pause » : l'état suffit. */}
          {paused && <span className="shrink-0 text-xs font-medium text-text">{t("en pause")}</span>}
          {!(paused && estUnePause) && (
            <span className="max-w-44 min-w-0 truncate text-xs text-text-dim">{nom}</span>
          )}
        </button>
        <button
          type="button"
          onClick={gestes.basculerPause}
          aria-label={paused ? t("Reprendre") : t("Pause")}
          data-tip={paused ? t("Reprendre") : t("Mettre en pause")}
          className="cible-tactile flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-dim transition-colors hover:bg-overlay hover:text-text"
        >
          {paused ? <IconPlay className="h-3.5 w-3.5" /> : <IconPause className="h-3.5 w-3.5" />}
        </button>
        <BoutonMenu
          visible
          onOuvrir={(e) => menu.ouvrirSousLeBouton(e, CIBLE)}
          ouvert={menu.ouvert}
          libelle={actions}
        />
      </div>
      <MenuContextuel etat={menu} libelle={actions} entrees={entreesSeance(paused, gestes)} />
    </>
  );
}
