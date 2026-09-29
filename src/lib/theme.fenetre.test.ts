// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Le fond NATIF de la fenêtre — ce qui part vers Tauri, et depuis quelle fenêtre.
 *
 * ⚠️ Cet appel a échoué en silence pendant deux semaines (PIEGES § 26.1) : l'ACL
 * le refusait, et même permis, `@tauri-apps/api` 2.11 envoyait l'argument sous
 * le mauvais nom. On fait donc tourner ici la VRAIE bibliothèque
 * `@tauri-apps/api`, branchée sur un faux pont IPC qui enregistre ce qu'il
 * reçoit : on voit exactement la commande et les arguments qui seraient
 * partis vers le Rust. Le refus de l'ACL, lui, se prouve côté Rust
 * (`src-tauri/tests/permissions_fenetres.rs`).
 */

vi.mock("./repo", () => ({
  isTauri: true,
  getSetting: async () => null,
  setSetting: async () => {},
}));

let estIOS = false;
vi.mock("./platform", () => ({
  get IS_IOS() {
    return estIOS;
  },
}));

import { FONDS, peindreLaFenetre, suivreLApparenceDuSysteme } from "./theme";

interface Appel {
  cmd: string;
  args: Record<string, unknown>;
}
let appels: Appel[] = [];
let refus: unknown = null;

/** Le pont que Tauri injecte dans chaque webview, réduit à ce qu'on lit. */
function ouvrirDans(fenetre: string): void {
  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: fenetre },
      currentWebview: { windowLabel: fenetre, label: fenetre },
    },
    invoke: async (cmd: string, args: Record<string, unknown>) => {
      appels.push({ cmd, args });
      if (refus) throw refus;
      return null;
    },
    transformCallback: () => 0,
  };
}

const fonds = () => appels.filter((a) => a.cmd === "plugin:window|set_background_color");

beforeEach(() => {
  appels = [];
  refus = null;
  estIOS = false;
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("@tauri-apps/api 2.11 — la raison de l'`invoke` direct", () => {
  it("`setBackgroundColor(c)` envoie `{ color }`, que la commande Rust ne lit pas", async () => {
    // La commande Rust (`setter!(set_background_color, Option<Color>)`, tauri
    // 2.11 `window/plugin.rs`) attend un argument `value` ; une clé absente est
    // lue comme `None` (`ipc/command.rs`, `deserialize_option`), et la fenêtre
    // retombe sur le fond du SYSTÈME au lieu de celui du thème.
    //
    // ▶️ Si ce test échoue après une montée de `@tauri-apps/api` (la 2.12.0
    // envoie `{ label, value }`), le bug amont est corrigé : `peindreLaFenetre`
    // peut revenir à `getCurrentWindow().setBackgroundColor(...)`, et ce test
    // peut partir.
    ouvrirDans("main");
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setBackgroundColor(FONDS.light);
    expect(fonds()).toHaveLength(1);
    expect(fonds()[0].args).toEqual({ color: FONDS.light });
    expect(fonds()[0].args).not.toHaveProperty("value");
  });
});

describe("peindreLaFenetre", () => {
  it("dans la fenêtre principale, envoie la couleur sous `value` — le nom que Rust lit", async () => {
    ouvrirDans("main");
    await peindreLaFenetre("light");
    await peindreLaFenetre("dark");
    expect(fonds().map((a) => a.args)).toEqual([
      { value: FONDS.light },
      { value: FONDS.dark },
    ]);
  });

  it("épargne la barre de capture : elle est TRANSPARENTE", async () => {
    ouvrirDans("capture");
    await peindreLaFenetre("light");
    expect(fonds()).toEqual([]);
  });

  it("épargne la fenêtre du Timer : elle a sa couleur dès la création", async () => {
    ouvrirDans("timer");
    await peindreLaFenetre("light");
    expect(fonds()).toEqual([]);
  });

  it("ne demande rien sur iOS, où la commande n'existe pas", async () => {
    ouvrirDans("main");
    estIOS = true;
    await peindreLaFenetre("light");
    expect(appels).toEqual([]);
  });

  it("un refus ne bloque rien, mais ne passe plus en silence", async () => {
    ouvrirDans("main");
    refus = "Command plugin:window|set_background_color not allowed by ACL";
    const console_ = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(peindreLaFenetre("light")).resolves.toBeUndefined();
    expect(console_).toHaveBeenCalledTimes(1);
    expect(String(console_.mock.calls[0][1])).toContain("not allowed by ACL");
  });
});

describe("suivreLApparenceDuSysteme", () => {
  /** Une media query qu'on fait basculer à la main, comme macOS le ferait. */
  function simulerMacOS() {
    const ecouteurs: Array<(e: { matches: boolean }) => void> = [];
    vi.spyOn(window, "matchMedia").mockImplementation(
      () =>
        ({
          matches: false,
          addEventListener: (_: string, f: (e: { matches: boolean }) => void) => ecouteurs.push(f),
        }) as unknown as MediaQueryList,
    );
    return {
      passeEnClair: async () => {
        for (const f of ecouteurs) f({ matches: true });
        await vi.waitFor(() => expect(fonds().length).toBeGreaterThan(0));
      },
      basculeSansEffet: async () => {
        for (const f of ecouteurs) f({ matches: true });
        await new Promise((r) => setTimeout(r, 20));
      },
    };
  }

  it("réglage « Système » : la fenêtre suit macOS pendant que l'app tourne", async () => {
    ouvrirDans("main");
    const macos = simulerMacOS();
    suivreLApparenceDuSysteme();
    await macos.passeEnClair();
    expect(fonds().map((a) => a.args)).toEqual([{ value: FONDS.light }]);
  });

  it("choix explicite (Clair / Sombre) : l'OS n'a plus son mot à dire", async () => {
    ouvrirDans("main");
    document.documentElement.dataset.theme = "dark";
    const macos = simulerMacOS();
    suivreLApparenceDuSysteme();
    await macos.basculeSansEffet();
    expect(fonds()).toEqual([]);
  });
});
