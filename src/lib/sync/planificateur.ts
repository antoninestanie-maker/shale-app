/**
 * Quand synchroniser.
 *
 * Aucune de ces occasions n'est sur le chemin d'une action utilisateur : l'app
 * écrit dans SQLite et rend la main immédiatement, ce module passe après.
 *
 * ─── POURQUOI PAS DE SONDE RÉSEAU DÉDIÉE ───────────────────────────────────
 * `navigator.onLine` ment : il dit « en ligne » dès qu'une interface existe,
 * portail captif d'hôtel compris. On pourrait ajouter une requête de test, mais
 * ce serait un aller-retour de plus pour apprendre ce que la synchronisation
 * elle-même nous dira dans la foulée. On s'en sert donc uniquement comme signal
 * NÉGATIF — quand il dit « hors ligne », il a raison, et on s'épargne une
 * tentative vouée à l'échec. Le reste du temps, la tentative EST la sonde.
 */

export interface OptionsPlanificateur {
  /** Rythme de fond quand tout va bien. */
  intervalleMs?: number;
  /** Premier délai après un échec ; il double ensuite. */
  reculInitialMs?: number;
  /** Plafond du recul : au-delà, on n'attend pas davantage. */
  reculMaxMs?: number;
}

const DEFAUTS: Required<OptionsPlanificateur> = {
  intervalleMs: 90_000,
  reculInitialMs: 5_000,
  reculMaxMs: 300_000,
};

export type Etat = "repos" | "enCours" | "horsLigne" | "echec";

export interface Planificateur {
  /** Déclenche maintenant (bouton « synchroniser », retour au premier plan…). */
  maintenant(): Promise<void>;
  etat(): Etat;
  arreter(): void;
}

/**
 * Fabrique un planificateur autour d'une fonction de synchronisation.
 *
 * `lancer` ne doit JAMAIS être appelée en parallèle d'elle-même : deux cycles
 * concurrents videraient la même file d'attente et enverraient deux fois les
 * mêmes lignes. Le verrou ci-dessous est la seule garantie — et il suffit,
 * JavaScript étant mono-thread.
 */
export function demarrerPlanificateur(
  lancer: () => Promise<void>,
  options: OptionsPlanificateur = {},
): Planificateur {
  const opts = { ...DEFAUTS, ...options };

  let etat: Etat = "repos";
  let enCours: Promise<void> | null = null;
  let recul = opts.reculInitialMs;
  let minuterie: ReturnType<typeof setTimeout> | null = null;
  let arrete = false;

  const enLigne = (): boolean =>
    typeof navigator === "undefined" || navigator.onLine !== false;

  function programmer(delai: number): void {
    if (arrete) return;
    if (minuterie) clearTimeout(minuterie);
    minuterie = setTimeout(() => void cycle(), delai);
  }

  async function cycle(): Promise<void> {
    if (arrete) return;

    // Un cycle déjà en cours : on se greffe dessus plutôt que d'en lancer un
    // second. L'appelant attend donc bien « la » synchronisation, pas une autre.
    if (enCours) return enCours;

    if (!enLigne()) {
      etat = "horsLigne";
      programmer(opts.reculInitialMs);
      return;
    }

    etat = "enCours";
    enCours = (async () => {
      try {
        await lancer();
        etat = "repos";
        recul = opts.reculInitialMs; // le succès efface l'ardoise
        programmer(opts.intervalleMs);
      } catch {
        // L'échec n'est pas remonté : un réseau coupé est un état normal d'une
        // app offline-first, pas une erreur à faire éclater dans la console à
        // chaque tentative. L'état est lisible par l'UI, qui décide quoi en dire.
        etat = enLigne() ? "echec" : "horsLigne";
        programmer(recul);
        recul = Math.min(recul * 2, opts.reculMaxMs);
      } finally {
        enCours = null;
      }
    })();

    return enCours;
  }

  // ─── Occasions de synchroniser ─────────────────────────────────────────────
  const surReconnexion = () => {
    recul = opts.reculInitialMs; // le réseau revient : on ne fait pas attendre
    void cycle();
  };
  const surRetourAuPremierPlan = () => {
    if (typeof document === "undefined" || !document.hidden) void cycle();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", surReconnexion);
    window.addEventListener("focus", surRetourAuPremierPlan);
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", surRetourAuPremierPlan);
  }

  void cycle(); // au démarrage : rattraper ce qui attend depuis la dernière fois

  return {
    maintenant: () => cycle(),
    etat: () => etat,
    arreter() {
      arrete = true;
      if (minuterie) clearTimeout(minuterie);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", surReconnexion);
        window.removeEventListener("focus", surRetourAuPremierPlan);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", surRetourAuPremierPlan);
      }
    },
  };
}
