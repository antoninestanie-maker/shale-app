// La barre du bas se choisit (2026-10-13). La règle est pure : ce fichier la
// tient ; ce que l'écran en fait se vérifie à l'écran (`PASSATION.md`).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ajouterOnglet,
  barrePleine,
  deplacerOnglet,
  estBarreParDefaut,
  lireOnglets,
  MAX_ONGLETS,
  ONGLETS_DEFAUT,
  ongletsAffiches,
  ongletsDisponibles,
  retirerOnglet,
} from "./onglets";
import { defaultUiConfig, mergeConfig, MODULE_IDS } from "./uiConfig";

const MODULES = ["today", "tasks", "calendar", "timer", "goals", "notes", "journal"] as const;
const tout = () => true;

describe("lireOnglets — ce que rend un réglage enregistré", () => {
  it("⭐ un réglage d'avant (sans le champ) garde la barre d'origine", () => {
    expect(lireOnglets(undefined, MODULES)).toEqual(["today", "tasks", "notes", "journal"]);
    expect(lireOnglets(null, MODULES)).toEqual([...ONGLETS_DEFAUT]);
    expect(lireOnglets("today", MODULES)).toEqual([...ONGLETS_DEFAUT]);
  });

  it("garde l'ordre choisi", () => {
    expect(lireOnglets(["journal", "today", "goals"], MODULES)).toEqual(["journal", "today", "goals"]);
  });

  it("jette un module inconnu, un doublon, et ce qui n'est pas un identifiant", () => {
    expect(lireOnglets(["today", "benchmark", "today", 7, null, "notes"], MODULES)).toEqual([
      "today",
      "notes",
    ]);
  });

  it("ne dépasse jamais quatre onglets", () => {
    const lus = lireOnglets([...MODULES], MODULES);
    expect(lus).toHaveLength(MAX_ONGLETS);
    expect(lus).toEqual(["today", "tasks", "calendar", "timer"]);
  });

  it("une liste vide, ou vidée de tout ce qu'elle portait, retombe sur le défaut", () => {
    expect(lireOnglets([], MODULES)).toEqual([...ONGLETS_DEFAUT]);
    expect(lireOnglets(["benchmark", "energy"], MODULES)).toEqual([...ONGLETS_DEFAUT]);
  });

  it("rend une copie : modifier le résultat ne touche pas au défaut", () => {
    const lus = lireOnglets(undefined, MODULES);
    lus.pop();
    expect(ONGLETS_DEFAUT).toHaveLength(4);
  });
});

describe("ongletsAffiches / ongletsDisponibles — ce que ce compte voit", () => {
  it("un onglet dont le module n'existe pas pour ce compte disparaît, les autres restent en ordre", () => {
    const sansJournal = (id: string) => id !== "journal";
    expect(ongletsAffiches(["today", "journal", "notes"], sansJournal)).toEqual(["today", "notes"]);
  });

  it("propose à l'ajout ce qui n'est pas déjà dans la barre, dans l'ordre des modules", () => {
    expect(ongletsDisponibles(["today", "notes"], MODULES, tout)).toEqual([
      "tasks",
      "calendar",
      "timer",
      "goals",
      "journal",
    ]);
  });

  it("ne propose pas un module absent pour ce compte", () => {
    const sansTimer = (id: string) => id !== "timer";
    expect(ongletsDisponibles(["today"], MODULES, sansTimer)).not.toContain("timer");
  });
});

describe("les gestes de Personnaliser", () => {
  const barre = ["today", "tasks", "notes"];

  it("ajouter pose l'onglet en dernier, juste avant « Plus »", () => {
    expect(ajouterOnglet(barre, "goals")).toEqual(["today", "tasks", "notes", "goals"]);
  });

  it("⭐ une barre pleine n'accepte rien de plus", () => {
    const pleine = ajouterOnglet(barre, "goals");
    expect(barrePleine(pleine)).toBe(true);
    expect(ajouterOnglet(pleine, "timer")).toEqual(pleine);
  });

  it("un module déjà dans la barre n'y entre pas deux fois", () => {
    expect(ajouterOnglet(barre, "tasks")).toEqual(barre);
  });

  it("retirer enlève l'onglet et resserre les autres", () => {
    expect(retirerOnglet(barre, "tasks")).toEqual(["today", "notes"]);
  });

  it("⭐ le dernier onglet ne se retire pas : « Plus » ne reste jamais seul", () => {
    expect(retirerOnglet(["notes"], "notes")).toEqual(["notes"]);
  });

  it("déplacer échange avec le voisin, et ne sort pas de la barre", () => {
    expect(deplacerOnglet(barre, "notes", -1)).toEqual(["today", "notes", "tasks"]);
    expect(deplacerOnglet(barre, "today", 1)).toEqual(["tasks", "today", "notes"]);
    expect(deplacerOnglet(barre, "today", -1)).toEqual(barre);
    expect(deplacerOnglet(barre, "notes", 1)).toEqual(barre);
    expect(deplacerOnglet(barre, "goals", 1)).toEqual(barre);
  });

  it("aucun geste ne modifie la liste qu'on lui passe", () => {
    const avant = [...barre];
    ajouterOnglet(barre, "goals");
    retirerOnglet(barre, "tasks");
    deplacerOnglet(barre, "notes", -1);
    expect(barre).toEqual(avant);
  });

  it("« Par défaut » ne s'offre que si la barre a changé", () => {
    expect(estBarreParDefaut([...ONGLETS_DEFAUT])).toBe(true);
    expect(estBarreParDefaut(["tasks", "today", "notes", "journal"])).toBe(false);
    expect(estBarreParDefaut(["today", "tasks", "notes"])).toBe(false);
  });
});

describe("ui.config — le champ `onglets`", () => {
  it("le défaut est la barre d'origine, et ce sont de vrais modules", () => {
    const d = defaultUiConfig();
    expect(d.onglets).toEqual(["today", "tasks", "notes", "journal"]);
    for (const id of d.onglets) expect(MODULE_IDS).toContain(id);
  });

  it("⭐ un réglage enregistré avant le 2026-10-13 se charge avec la barre d'origine", () => {
    const c = mergeConfig({ zoom: 110, brandTitle: "Shale" });
    expect(c.onglets).toEqual(["today", "tasks", "notes", "journal"]);
    expect(c.zoom).toBe(110);
  });

  it("garde la barre choisie, et la borne à de vrais modules", () => {
    const c = mergeConfig({ onglets: ["goals", "today", "energie", "calendar"] });
    expect(c.onglets).toEqual(["goals", "today", "calendar"]);
  });

  it("« Réinitialiser » (le défaut entier) rend la barre d'origine", () => {
    expect(mergeConfig(defaultUiConfig()).onglets).toEqual([...ONGLETS_DEFAUT]);
  });
});

// Test de SOURCE : la barre ne doit plus porter sa liste en dur, et les deux
// écrans doivent poser la même question (« ce module peut-il être un onglet ? »).
describe("les deux écrans lisent la même règle", () => {
  const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), "utf8");
  const nav = lire("../components/MobileNav.tsx");
  const admin = lire("../views/AdminView.tsx");

  it("la barre lit le réglage, plus une liste écrite en dur", () => {
    expect(nav).toMatch(/ongletsAffiches\(config\.onglets/);
    expect(nav).not.toMatch(/const ONGLETS\b/);
  });

  it("Personnaliser et la barre passent par `ongletPossible`", () => {
    expect(nav).toMatch(/export function ongletPossible/);
    expect(nav).toMatch(/ongletPossible\(id, hasTrading, profil\)/);
    expect(admin).toMatch(/ongletPossible\(id, hasTrading, profil\)/);
  });

  it("un module verrouillé n'est jamais un onglet : la règle exige « ouvert »", () => {
    expect(nav).toMatch(/presenceModule\(id, hasTrading\) === "ouvert"/);
  });
});
