// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLangPref } from "../lib/i18n";
import FiletErreur from "./FiletErreur";

// Le filet se vérifie dans un vrai DOM : ce qu'on veut prouver, c'est qu'une
// exception de rendu laisse un message et un bouton À L'ÉCRAN, et que les
// voisins du module planté restent montés.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let conteneur: HTMLElement;
let racine: Root;

beforeEach(() => {
  // happy-dom annonce un navigateur anglais : on fige le français, langue des clés.
  setLangPref("fr");
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
  // React et le filet journalisent l'erreur attrapée : attendu, donc muet ici.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
  vi.restoreAllMocks();
});

let doitPlanter = true;
function ModuleFragile() {
  if (doitPlanter) throw new Error("données inattendues");
  return createElement("p", null, "module rétabli");
}

function rendre(portee: "module" | "app") {
  act(() =>
    racine.render(
      createElement(
        "div",
        null,
        createElement("nav", null, "barre latérale"),
        createElement(FiletErreur, { portee, children: createElement(ModuleFragile) }),
      ),
    ),
  );
}

describe("FiletErreur", () => {
  it("un module qui plante affiche son erreur sans emporter ses voisins", () => {
    doitPlanter = true;
    rendre("module");
    expect(conteneur.querySelector("[role=alert]")).not.toBeNull();
    expect(conteneur.textContent).toContain("données inattendues");
    expect(conteneur.textContent).toContain("Ce module a rencontré un problème");
    expect(conteneur.textContent).toContain("barre latérale");
  });

  it("« Réessayer » remonte le module, qui s'affiche s'il ne plante plus", () => {
    doitPlanter = true;
    rendre("module");
    doitPlanter = false;
    const bouton = conteneur.querySelector("button");
    expect(bouton?.textContent).toBe("Réessayer");
    act(() => bouton!.click());
    expect(conteneur.querySelector("[role=alert]")).toBeNull();
    expect(conteneur.textContent).toContain("module rétabli");
  });

  it("à la racine, il propose de recharger la fenêtre", () => {
    doitPlanter = true;
    rendre("app");
    expect(conteneur.textContent).toContain("Shale a rencontré un problème.");
    expect(conteneur.querySelector("button")?.textContent).toBe("Recharger Shale");
  });

  it("sans erreur, il est transparent", () => {
    doitPlanter = false;
    rendre("module");
    expect(conteneur.querySelector("[role=alert]")).toBeNull();
    expect(conteneur.textContent).toContain("module rétabli");
  });
});
