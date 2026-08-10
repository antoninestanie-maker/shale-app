// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RequeteRefusee, ServeurOccupe } from "./http";
import { demarrerPlanificateur, type Planificateur } from "./planificateur";

/**
 * Étape 7 — quand synchroniser, et surtout : sans jamais empiler les cycles.
 *
 * Seul fichier de tests à réclamer un DOM (`window`, `document`, `navigator`) :
 * le planificateur s'accroche à de vrais événements du navigateur, et vérifier
 * qu'il s'y accroche VRAIMENT — puis qu'il s'en détache à l'arrêt — vaut mieux
 * que de lui injecter des événements fictifs qu'il serait seul à connaître.
 */

let plan: Planificateur | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  plan?.arreter();
  plan = null;
  vi.useRealTimers();
});

/** Laisse tourner les promesses en attente sans avancer l'horloge. */
const vider = () => vi.advanceTimersByTimeAsync(0);

describe("rythme normal", () => {
  it("synchronise dès le démarrage", async () => {
    const lancer = vi.fn().mockResolvedValue(undefined);
    plan = demarrerPlanificateur(lancer);
    await vider();
    expect(lancer).toHaveBeenCalledTimes(1);
  });

  it("reprend à l'intervalle prévu", async () => {
    const lancer = vi.fn().mockResolvedValue(undefined);
    plan = demarrerPlanificateur(lancer, { intervalleMs: 1000 });
    await vider();

    await vi.advanceTimersByTimeAsync(1000);
    expect(lancer).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3000);
    expect(lancer).toHaveBeenCalledTimes(5);
  });

  it("ne laisse plus rien passer après l'arrêt", async () => {
    // Une minuterie oubliée continuerait de synchroniser après la déconnexion
    // de l'utilisateur — donc de parler au serveur en son nom.
    const lancer = vi.fn().mockResolvedValue(undefined);
    plan = demarrerPlanificateur(lancer, { intervalleMs: 1000 });
    await vider();
    plan.arreter();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(lancer).toHaveBeenCalledTimes(1);
  });
});

describe("jamais deux cycles à la fois", () => {
  it("un déclenchement pendant un cycle se GREFFE dessus", async () => {
    // Deux cycles concurrents videraient la même file et enverraient deux fois
    // les mêmes lignes.
    let libere: () => void = () => {};
    const lancer = vi.fn(() => new Promise<void>((r) => (libere = r)));
    plan = demarrerPlanificateur(lancer, { intervalleMs: 10_000 });
    await vider();
    expect(lancer).toHaveBeenCalledTimes(1);

    void plan.maintenant();
    void plan.maintenant();
    void plan.maintenant();
    await vider();
    expect(lancer).toHaveBeenCalledTimes(1);

    libere();
    await vider();
    expect(lancer).toHaveBeenCalledTimes(1);
  });

  it("l'appelant de `maintenant()` attend bien la fin du cycle", async () => {
    let libere: () => void = () => {};
    let fini = false;
    plan = demarrerPlanificateur(() => new Promise<void>((r) => (libere = r)), {
      intervalleMs: 10_000,
    });
    await vider();

    void plan.maintenant().then(() => (fini = true));
    await vider();
    expect(fini).toBe(false);

    libere();
    await vider();
    expect(fini).toBe(true);
  });
});

describe("échecs et recul progressif", () => {
  it("double l'attente à chaque échec, sans dépasser le plafond", async () => {
    // Sans recul, un serveur en panne recevrait une tentative par seconde de la
    // part de chaque client — exactement ce qu'il ne faut pas faire à un service
    // déjà en difficulté.
    const lancer = vi.fn().mockRejectedValue(new Error("réseau"));
    plan = demarrerPlanificateur(lancer, { reculInitialMs: 100, reculMaxMs: 400 });
    await vider();
    expect(lancer).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100); // 1er recul
    expect(lancer).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(200); // ×2
    expect(lancer).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(400); // ×2, plafonné
    expect(lancer).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(400); // reste au plafond
    expect(lancer).toHaveBeenCalledTimes(5);
  });

  it("un succès efface l'ardoise", async () => {
    const lancer = vi
      .fn()
      .mockRejectedValueOnce(new Error("réseau"))
      .mockRejectedValueOnce(new Error("réseau"))
      .mockResolvedValue(undefined);
    plan = demarrerPlanificateur(lancer, { intervalleMs: 5000, reculInitialMs: 100 });
    await vider();

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    expect(lancer).toHaveBeenCalledTimes(3); // celui-ci réussit
    expect(plan.etat()).toBe("repos");

    // Le suivant repart à l'intervalle NORMAL, pas au recul accumulé.
    await vi.advanceTimersByTimeAsync(5000);
    expect(lancer).toHaveBeenCalledTimes(4);
  });

  it("un échec n'est pas remonté à l'appelant", async () => {
    // Un réseau coupé est un état normal d'une app offline-first. Le faire
    // éclater à chaque tentative noierait la console et n'aiderait personne :
    // l'état est lisible, l'UI décide quoi en dire.
    plan = demarrerPlanificateur(() => Promise.reject(new Error("réseau")), {
      reculInitialMs: 10_000,
    });
    await vider();
    await expect(plan.maintenant()).resolves.toBeUndefined();
    expect(plan.etat()).toBe("echec");
  });
});

describe("réseau", () => {
  const forcerEnLigne = (valeur: boolean) =>
    Object.defineProperty(navigator, "onLine", { value: valeur, configurable: true });

  afterEach(() => forcerEnLigne(true));

  it("n'essaie même pas quand le système dit « hors ligne »", async () => {
    forcerEnLigne(false);
    const lancer = vi.fn().mockResolvedValue(undefined);
    plan = demarrerPlanificateur(lancer);
    await vider();
    expect(lancer).not.toHaveBeenCalled();
    expect(plan.etat()).toBe("horsLigne");
  });

  it("repart IMMÉDIATEMENT au retour du réseau, sans attendre le recul", async () => {
    forcerEnLigne(false);
    const lancer = vi.fn().mockResolvedValue(undefined);
    plan = demarrerPlanificateur(lancer, { intervalleMs: 60_000, reculInitialMs: 60_000 });
    await vider();
    expect(lancer).not.toHaveBeenCalled();

    forcerEnLigne(true);
    window.dispatchEvent(new Event("online"));
    await vider();
    expect(lancer).toHaveBeenCalledTimes(1);
  });

  it("synchronise au retour au premier plan", async () => {
    const lancer = vi.fn().mockResolvedValue(undefined);
    plan = demarrerPlanificateur(lancer, { intervalleMs: 60_000 });
    await vider();
    expect(lancer).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("focus"));
    await vider();
    expect(lancer).toHaveBeenCalledTimes(2);
  });
});

describe("ce que le serveur demande", () => {
  it("respecte un Retry-After plus long que son propre recul", async () => {
    // ⚠️ Repasser avant l'heure dite sur un 429 relance le compteur du
    // serveur : un ralentissement passager devient un blocage durable.
    const lancer = vi.fn().mockRejectedValue(new ServeurOccupe(429, 30_000));
    plan = demarrerPlanificateur(lancer, { reculInitialMs: 1000, intervalleMs: 60_000 });
    await vider();
    expect(lancer).toHaveBeenCalledTimes(1);

    // Le recul propre serait de 1 s : il ne doit RIEN déclencher.
    await vi.advanceTimersByTimeAsync(5000);
    expect(lancer).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(26_000);
    expect(lancer).toHaveBeenCalledTimes(2);
  });

  it("part au plafond sur une erreur qui ne guérira pas toute seule", async () => {
    // Schéma jamais joué, politique RLS qui refuse : marteler toutes les
    // 5 secondes pendant des heures n'apporte rien. Mais on n'abandonne PAS —
    // le jour où le schéma est joué, ça doit repartir sans relancer l'app.
    const lancer = vi.fn().mockRejectedValue(new RequeteRefusee(404, "does not exist"));
    plan = demarrerPlanificateur(lancer, { reculInitialMs: 1000, reculMaxMs: 60_000 });
    await vider();
    expect(lancer).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(lancer).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(31_000);
    expect(lancer).toHaveBeenCalledTimes(2);
  });

  it("un échec ordinaire garde le recul exponentiel", async () => {
    const lancer = vi.fn().mockRejectedValue(new Error("réseau"));
    plan = demarrerPlanificateur(lancer, { reculInitialMs: 1000, reculMaxMs: 60_000 });
    await vider();

    await vi.advanceTimersByTimeAsync(1000);
    expect(lancer).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(lancer).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(4000);
    expect(lancer).toHaveBeenCalledTimes(4);
  });
});
