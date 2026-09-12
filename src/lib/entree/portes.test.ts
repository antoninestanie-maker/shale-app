import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ⭐ TOUTES LES PORTES QUI ENTRENT DANS L'APP DOIVENT ÊTRE HABILLÉES.
 *
 * Il y a plusieurs murs devant Shale — connexion, chargement, abonnement — et
 * chacun débouche sur la même porte. La transition d'entrée doit partir de
 * TOUS, et chaque mur doit relever la position de sa marque, sinon la
 * traversée repart du centre de l'écran : le saut que le FLIP existe pour
 * éviter.
 *
 * Ce fichier existe parce que deux portes ont été oubliées, le 2026-09-12, et
 * qu'aucun test ne les a vues :
 *   - la CRÉATION DE COMPTE ne mesurait pas la marque. C'est pourtant la toute
 *     première entrée de quelqu'un dans Shale ;
 *   - `noSub → ready` (« je m'abonne, je revérifie ») ne déclenchait rien du
 *     tout — et c'était une RÉGRESSION, `BootScreen` couvrait ce passage avant
 *     d'être supprimé.
 *
 * Le jour où un état d'authentification s'ajoute, c'est ce test qui le dira.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const lire = (p: string) => readFileSync(resolve(RACINE, p), "utf-8");

const useAuth = lire("src/lib/auth/useAuth.ts");
const authGate = lire("src/components/auth/AuthGate.tsx");

/** Les états déclarés par `AuthStatus`, lus à la source. */
function statuts(): string[] {
  const m = /export type AuthStatus =([^;]+);/.exec(useAuth);
  expect(m, "AuthStatus introuvable").not.toBeNull();
  return [...m![1].matchAll(/"(\w+)"/g)].map((x) => x[1]);
}

/** Les états depuis lesquels `AuthGate` accepte de démarrer la transition. */
function statutsDeDepart(): string[] {
  const m = /if \(avant !== ([^)]+)\) return;/.exec(authGate);
  expect(m, "le garde de démarrage a changé de forme").not.toBeNull();
  return [...m![1].matchAll(/"(\w+)"/g)].map((x) => x[1]);
}

describe("les portes d'entrée dans Shale", () => {
  it("l'état d'authentification n'a pas changé sans qu'on s'en aperçoive", () => {
    // Si cette liste bouge, les deux tests suivants doivent être relus.
    expect(statuts().sort()).toEqual(
      ["loading", "noSub", "offlineGrace", "ready", "signedOut"].sort(),
    );
  });

  it("la transition démarre depuis CHAQUE état verrouillé", () => {
    const deverrouilles = ["ready", "offlineGrace"];
    const verrouilles = statuts().filter((s) => !deverrouilles.includes(s));
    expect(statutsDeDepart().sort()).toEqual(verrouilles.sort());
  });

  it.each([
    ["l'écran de connexion", "src/components/auth/LoginScreen.tsx"],
    ["le mur de l'abonnement", "src/components/auth/SubscriptionRequired.tsx"],
    ["le Splash de chargement", "src/components/auth/AuthGate.tsx"],
  ])("%s relève la position de sa marque", (_nom, chemin) => {
    const source = lire(chemin);
    expect(source).toContain("mesurerMarque(");
    // Une mesure sans marque à mesurer ne sert à rien.
    expect(source).toContain("ShaleMark");
  });

  it("⚠️ la création de compte mesure AVANT de partir, comme la connexion", () => {
    const source = lire("src/components/auth/LoginScreen.tsx");
    const iMesure = source.indexOf("mesurerMarque(");
    const iSignUp = source.indexOf("await onSignUp(");
    const iSignIn = source.indexOf("await onSignIn(");
    expect(iMesure).toBeGreaterThan(-1);
    // La mesure doit précéder les DEUX départs, pas seulement la connexion.
    expect(iMesure, "mesure après onSignUp").toBeLessThan(iSignUp);
    expect(iMesure, "mesure après onSignIn").toBeLessThan(iSignIn);
  });
});
