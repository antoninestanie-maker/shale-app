// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { deposerMotDePasse, EVENEMENT_SECRET, retirerMotDePasse, viderSas } from "./sas";

/**
 * Le sas — par où le mot de passe passe du login à la clé.
 *
 * Peu de code, mais trois propriétés dont l'échec serait grave et silencieux :
 * un mot de passe qui traîne en mémoire, un secret qui fuite dans un événement,
 * ou un dépôt que personne ne remarque.
 */

afterEach(() => viderSas());

describe("dépôt et retrait", () => {
  it("rend ce qui a été déposé", () => {
    deposerMotDePasse("correct horse");
    expect(retirerMotDePasse()).toBe("correct horse");
  });

  it("le retrait est DESTRUCTIF", () => {
    // La propriété qui compte : après lecture, il n'y a plus rien à voler.
    deposerMotDePasse("secret");
    retirerMotDePasse();
    expect(retirerMotDePasse()).toBeNull();
  });

  it("rend null quand rien n'a été déposé", () => {
    expect(retirerMotDePasse()).toBeNull();
  });

  it("un second dépôt remplace le premier", () => {
    // Cas réel : changement de mot de passe avant que le premier ait été lu.
    deposerMotDePasse("ancien");
    deposerMotDePasse("nouveau");
    expect(retirerMotDePasse()).toBe("nouveau");
  });

  it("la déconnexion efface tout", () => {
    deposerMotDePasse("secret");
    viderSas();
    expect(retirerMotDePasse()).toBeNull();
  });
});

describe("signal", () => {
  it("prévient qu'un secret attend", () => {
    // Nécessaire en plus de la variable : un changement de mot de passe survient
    // alors que la synchronisation tourne déjà, bien après son montage.
    const ecoute = vi.fn();
    window.addEventListener(EVENEMENT_SECRET, ecoute);
    deposerMotDePasse("secret");
    window.removeEventListener(EVENEMENT_SECRET, ecoute);
    expect(ecoute).toHaveBeenCalledTimes(1);
  });

  it("ne TRANSPORTE PAS le secret dans l'événement", () => {
    // Un mot de passe dans `CustomEvent.detail` serait lisible par n'importe
    // quel autre écouteur de la page. L'événement dit qu'il y a quelque chose
    // à retirer, pas ce que c'est.
    let vu: unknown = "pas appelé";
    const ecoute = (e: Event) => {
      vu = (e as CustomEvent).detail;
    };
    window.addEventListener(EVENEMENT_SECRET, ecoute);
    deposerMotDePasse("mon-mot-de-passe");
    window.removeEventListener(EVENEMENT_SECRET, ecoute);

    expect(vu).toBeNull();
    expect(JSON.stringify(vu ?? "")).not.toContain("mon-mot-de-passe");
  });
});
