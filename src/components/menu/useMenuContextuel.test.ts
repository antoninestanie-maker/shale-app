import { describe, expect, it } from "vitest";
import { sansPoint, sansSouris, type GesteMenu } from "./useMenuContextuel";

/**
 * ⭐ CES DEUX FONCTIONS EXISTENT SÉPARÉMENT À CAUSE D'UN DÉFAUT MESURÉ.
 *
 * Le 2026-09-21, en pilotant le navigateur : un clic droit de SOURIS, dans
 * Chromium, arrive avec `detail: 0`. La première version en concluait « venu du
 * clavier » et ancrait le menu sur la LIGNE au lieu du curseur — pour TOUS les
 * clics droits. Le menu s'ouvrait, il était joli, il était au mauvais endroit.
 *
 * Les valeurs ci-dessous ne sont pas inventées : ce sont celles relevées sur
 * l'événement réel (`isTrusted: true`).
 */

const souris: GesteMenu = { clientX: 404, clientY: 179, button: 2, detail: 0 };
const clavierFirefox: GesteMenu = { clientX: 0, clientY: 0, button: 0, detail: 0 };
const clavierChromium: GesteMenu = { clientX: 316, clientY: 240, button: 0, detail: 0 };
const bouton: GesteMenu = { clientX: 517, clientY: 235, button: 0, detail: 1 };

describe("① où poser le menu — on ne se fie QU'AUX COORDONNÉES", () => {
  it("⭐ un vrai clic droit de souris a un POINT, malgré son detail à 0", () => {
    // LE défaut du 2026-09-21. Si ce test redevient rouge, tous les clics
    // droits de l'app se sont remis à s'ancrer sur la ligne.
    expect(sansPoint(souris)).toBe(false);
  });

  it("Maj+F10 façon Firefox n'a pas de point", () => {
    expect(sansPoint(clavierFirefox)).toBe(true);
  });

  it("Maj+F10 façon Chromium EN A un — et on le suit", () => {
    // Chromium place le point sur l'élément focalisé : l'ancrer là donne le
    // même résultat visuel qu'un ancrage sur l'élément, sans rien deviner.
    expect(sansPoint(clavierChromium)).toBe(false);
  });

  it("un clic sur le bouton « ⋯ » a un point", () => {
    expect(sansPoint(bouton)).toBe(false);
  });
});

describe("② faut-il surligner la première entrée — on regarde LE BOUTON", () => {
  it("une souris ne surligne rien : le curseur dit déjà où on est", () => {
    expect(sansSouris(souris)).toBe(false);
  });

  it("un clic gauche sur « ⋯ » non plus", () => {
    expect(sansSouris(bouton)).toBe(false);
  });

  it("le clavier, si — sur les deux plateformes", () => {
    expect(sansSouris(clavierFirefox)).toBe(true);
    expect(sansSouris(clavierChromium)).toBe(true);
  });
});

describe("les deux règles ne répondent pas la même chose", () => {
  it("⭐ et c'est tout l'intérêt de les avoir séparées", () => {
    // Sur Chromium au clavier : pas de surlignage sans la règle ②, et un menu
    // mal placé si l'on avait gardé une seule règle pour les deux questions.
    expect(sansPoint(clavierChromium)).toBe(false);
    expect(sansSouris(clavierChromium)).toBe(true);
    // Sur la souris, l'inverse exact de ce que l'ancienne règle unique disait.
    expect(sansPoint(souris)).toBe(false);
    expect(sansSouris(souris)).toBe(false);
  });
});
