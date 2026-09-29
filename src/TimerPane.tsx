import { useCallback, useEffect, useState } from "react";
import EcranTimer, { ActionFenetre } from "./components/timer/EcranTimer";
import TooltipLayer from "./components/Tooltip";
import { IconExpand, IconPin } from "./components/icons";
import {
  ecouterEtat,
  envoyerCommande,
  fermerCetteFenetre,
  restantDepuisEtat,
  type EtatTimerPartage,
} from "./lib/timerFenetre";

import { t } from "./lib/i18n";

function estTauri(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

async function fenetreCourante() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

/**
 * La fenêtre séparée du Timer (étiquette Tauri `timer`, ou `/?pane=timer` dans
 * le navigateur) : l'horloge à volets seule, qu'on pose sur un autre écran et
 * qu'on peut passer en plein écran là-bas.
 *
 * ⚠️ Elle n'ouvre PAS la base et n'a pas de session à elle : elle affiche ce
 * que la fenêtre principale lui diffuse et lui renvoie les gestes (voir
 * `lib/timerFenetre.ts`). Montée hors d'`AuthGate` pour cette raison — il n'y a
 * rien à protéger ici que l'app, authentifiée, ne contrôle déjà.
 */
export default function TimerPane() {
  /** `null` : l'app n'a pas encore répondu. */
  const [etat, setEtat] = useState<EtatTimerPartage | null>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const [pleinEcran, setPleinEcran] = useState(false);
  const [auPremierPlan, setAuPremierPlan] = useState(false);

  // L'état arrive de l'app ; on le demande dès que l'écoute est branchée.
  useEffect(() => {
    document.title = `${t("Timer")} — Shale`;
    return ecouterEtat(setEtat, () => envoyerCommande("etat"));
  }, []);

  // Filet : tant qu'aucune réponse n'est venue (app en train de recharger), on
  // redemande. S'arrête au premier état reçu.
  const recu = etat !== null;
  useEffect(() => {
    if (recu) return;
    const id = window.setInterval(() => envoyerCommande("etat"), 1500);
    return () => window.clearInterval(id);
  }, [recu]);

  // Le décompte, recalculé ICI depuis l'instant de fin : quatre fois par
  // seconde, pour que le volet bascule au plus près du changement de seconde.
  const tourne = !!etat?.session && etat.finMs !== null;
  useEffect(() => {
    if (!tourne) return;
    setMaintenant(Date.now());
    const id = window.setInterval(() => setMaintenant(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [tourne]);

  // Plus de séance : on le dit, puis la fenêtre se ferme d'elle-même.
  const termine = etat !== null && etat.session === null;
  useEffect(() => {
    if (!termine) return;
    const id = window.setTimeout(() => void fermerCetteFenetre().catch(() => {}), 2500);
    return () => window.clearTimeout(id);
  }, [termine]);

  // Plein écran et premier plan : on lit l'état réel de la fenêtre, on ne le
  // devine pas (le bouton vert de macOS peut aussi le changer).
  useEffect(() => {
    if (!estTauri()) {
      const surChangement = () => setPleinEcran(!!document.fullscreenElement);
      document.addEventListener("fullscreenchange", surChangement);
      return () => document.removeEventListener("fullscreenchange", surChangement);
    }
    let fini = false;
    let debrancher: (() => void) | undefined;
    void (async () => {
      const w = await fenetreCourante();
      const relire = async () => {
        const [plein, dessus] = await Promise.all([w.isFullscreen(), w.isAlwaysOnTop()]);
        if (!fini) {
          setPleinEcran(plein);
          setAuPremierPlan(dessus);
        }
      };
      await relire();
      const u = await w.onResized(() => void relire());
      if (fini) u();
      else debrancher = u;
    })().catch(() => {});
    return () => {
      fini = true;
      debrancher?.();
    };
  }, []);

  const basculerPleinEcran = useCallback(async () => {
    try {
      if (estTauri()) {
        const w = await fenetreCourante();
        const deja = await w.isFullscreen();
        await w.setFullscreen(!deja);
        setPleinEcran(!deja);
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.error("timer : plein écran impossible", e);
    }
  }, []);

  const basculerPremierPlan = useCallback(async () => {
    try {
      const w = await fenetreCourante();
      const suivant = !(await w.isAlwaysOnTop());
      await w.setAlwaysOnTop(suivant);
      setAuPremierPlan(suivant);
    } catch (e) {
      console.error("timer : premier plan impossible", e);
    }
  }, []);

  // « F » bascule le plein écran (Espace et Échap sont gérés par l'écran).
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        void basculerPleinEcran();
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [basculerPleinEcran]);

  const session = etat?.session ?? null;
  const enPause = !!etat && etat.restantFigeSec !== null;

  const basculerPause = useCallback(
    () => envoyerCommande(enPause ? "reprendre" : "pause"),
    [enPause],
  );
  const sortir = useCallback(() => {
    if (pleinEcran) void basculerPleinEcran();
  }, [pleinEcran, basculerPleinEcran]);

  return (
    <div className="h-screen overflow-hidden bg-bg text-text">
      {!etat || !session ? (
        <div
          className="flex h-full items-center justify-center px-6"
          {...(estTauri() ? { "data-tauri-drag-region": "deep" } : {})}
        >
          <p className="hud-label">
            {termine ? t("Session terminée") : t("En attente du chrono…")}
          </p>
        </div>
      ) : (
        <EcranTimer
          seance={session}
          restantSec={restantDepuisEtat(etat, maintenant)}
          enPause={enPause}
          onBasculerPause={basculerPause}
          onTerminer={() => envoyerCommande("terminer")}
          onEchap={sortir}
          // Les pastilles de macOS disparaissent en plein écran.
          retraitPastilles={estTauri() && !pleinEcran}
          poignee={estTauri()}
          actions={
            <>
              <ActionFenetre
                onClick={() => envoyerCommande("montrer-app")}
                label={t("Revenir à Shale")}
                tipSub={t("Ramène la fenêtre principale devant. Le chrono reste ici.")}
              >
                <span className="hidden sm:inline">{t("Revenir à Shale")}</span>
                <span className="sm:hidden">Shale</span>
              </ActionFenetre>
              {estTauri() && (
                <ActionFenetre
                  onClick={() => void basculerPremierPlan()}
                  label={
                    auPremierPlan ? t("Ne plus garder au premier plan") : t("Garder au premier plan")
                  }
                  tipSub={t("La fenêtre reste visible par-dessus les autres applications.")}
                  actif={auPremierPlan}
                >
                  <IconPin className="h-3.5 w-3.5" />
                </ActionFenetre>
              )}
              <ActionFenetre
                onClick={() => void basculerPleinEcran()}
                label={pleinEcran ? t("Quitter le plein écran") : t("Plein écran")}
                tipSub={t("Raccourci : F")}
                actif={pleinEcran}
              >
                <IconExpand className="h-3.5 w-3.5" />
              </ActionFenetre>
            </>
          }
        />
      )}
      <TooltipLayer />
    </div>
  );
}
