// La grille et un panneau qui n'existe plus — voir l'en-tête de `grille.ts`.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  AIR_BARRE,
  ancreTient,
  colonneCss,
  dispositionIntacte,
  enteteSerre,
  masquesConnus,
  ordreAujourdhuiAuTelephone,
  ordreEffectif,
  placerApres,
  reserveDEntete,
} from "./grille";

// Les panneaux d'Aujourd'hui tels que le code les rend après le 2026-10-11 :
// la jauge `energy` n'en fait plus partie.
const PRESENTS = ["perf", "discipline", "tasks", "timer", "calendar", "habitudes", "goals", "quicklinks"];

describe("ordreEffectif — un ordre enregistré qui porte encore `energy`", () => {
  // `order.today` tel qu'une version d'avant l'a écrit, jauge déplacée en tête.
  const ENREGISTRE = ["energy", "perf", "tasks", "discipline", "timer", "calendar", "habitudes", "goals", "quicklinks"];

  it("ne rend aucune place à la jauge", () => {
    expect(ordreEffectif(ENREGISTRE, PRESENTS)).not.toContain("energy");
  });

  it("⭐ garde l'ordre choisi pour tout le reste, sans trou ni doublon", () => {
    expect(ordreEffectif(ENREGISTRE, PRESENTS)).toEqual(ENREGISTRE.filter((id) => id !== "energy"));
  });

  it("vaut aussi quand la jauge était la seule chose enregistrée", () => {
    expect(ordreEffectif(["energy"], PRESENTS)).toEqual(PRESENTS);
  });

  it("vaut pour les Réglages, dont la section portait `settings-energy`", () => {
    const presents = ["settings-apparence", "settings-shortcuts"];
    expect(ordreEffectif(["settings-shortcuts", "settings-energy", "settings-apparence"], presents)).toEqual([
      "settings-shortcuts",
      "settings-apparence",
    ]);
  });

  it("sans ordre enregistré, c'est l'ordre du code", () => {
    expect(ordreEffectif([], PRESENTS)).toEqual(PRESENTS);
  });

  it("un panneau arrivé depuis l'enregistrement se range à la fin", () => {
    expect(ordreEffectif(["tasks", "perf"], ["perf", "tasks", "goals"])).toEqual(["tasks", "perf", "goals"]);
  });
});

describe("masquesConnus — `hidden.today` qui porte encore `energy`", () => {
  it("⭐ aucune pastille « + Énergie » : une carte disparue ne se rallume pas", () => {
    expect(masquesConnus(["energy"], PRESENTS)).toEqual([]);
  });

  it("les autres panneaux masqués restent proposés, dans leur ordre", () => {
    expect(masquesConnus(["goals", "energy", "timer"], PRESENTS)).toEqual(["goals", "timer"]);
  });

  it("un panneau masqué puis sorti de la grille (module coupé) n'est pas proposé non plus", () => {
    expect(masquesConnus(["position"], PRESENTS)).toEqual([]);
  });
});

// ── Les deux colonnes d'Aujourd'hui (ancres) ────────────────────────────────

const PANNEAUX = [
  { id: "perf", largeurParDefaut: 12 },
  { id: "discipline", largeurParDefaut: 4 },
  { id: "tasks", largeurParDefaut: 8 },
  { id: "timer", largeurParDefaut: 4 },
  { id: "calendar", largeurParDefaut: 8 },
];
const ORDRE = PANNEAUX.map((p) => p.id);

describe("dispositionIntacte — les ancres ne valent que tant qu'on n'a rien rangé soi-même", () => {
  it("intacte sans rien d'enregistré", () => {
    expect(dispositionIntacte(ORDRE, PANNEAUX, {})).toBe(true);
  });

  it("⭐ un panneau déplacé à la main rend la grille libre", () => {
    const deplace = ["perf", "tasks", "discipline", "timer", "calendar"];
    expect(dispositionIntacte(deplace, PANNEAUX, {})).toBe(false);
  });

  it("⭐ une largeur changée aussi ; revenue à sa valeur par défaut, non", () => {
    expect(dispositionIntacte(ORDRE, PANNEAUX, { timer: { w: 6 } })).toBe(false);
    expect(dispositionIntacte(ORDRE, PANNEAUX, { timer: { w: 4 } })).toBe(true);
  });

  it("une hauteur épinglée ne compte pas : elle ne change personne de colonne", () => {
    const hauteur = { tasks: { w: 8, h: 480 } };
    expect(dispositionIntacte(ORDRE, PANNEAUX, hauteur)).toBe(true);
  });

  it("la taille enregistrée d'un panneau disparu (la jauge) ne compte pas", () => {
    expect(dispositionIntacte(ORDRE, PANNEAUX, { energy: { w: 6 } })).toBe(true);
  });

  it("l'ordre enregistré d'avant, jauge comprise, reste intact une fois la jauge ôtée", () => {
    const avant = ["perf", "discipline", "tasks", "energy", "calendar", "timer"];
    const presents = ["perf", "discipline", "tasks", "calendar", "timer"];
    const panneaux = presents.map((id) => ({ id, largeurParDefaut: 4 }));
    expect(dispositionIntacte(ordreEffectif(avant, presents), panneaux, {})).toBe(true);
  });
});

describe("ancreTient", () => {
  const base = { intacte: true, plancher: 4, colonnes: 12 };

  it("une carte étroite et une carte large tiennent côte à côte : ancrées toutes les deux", () => {
    expect(ancreTient({ ...base, largeur: 4, largeurParDefaut: 4 })).toBe(true);
    expect(ancreTient({ ...base, largeur: 8, largeurParDefaut: 8 })).toBe(true);
  });

  it("jamais quand la disposition a été touchée", () => {
    expect(ancreTient({ ...base, intacte: false, largeur: 4, largeurParDefaut: 4 })).toBe(false);
  });

  it("un bandeau pleine largeur n'a rien à côté de lui : pas d'ancre", () => {
    expect(ancreTient({ ...base, largeur: 12, largeurParDefaut: 12 })).toBe(false);
  });

  it("⭐ fenêtre étroite : la carte large lâche son ancre dès qu'un voisin ne tient plus à côté", () => {
    // Plancher remonté à 6 colonnes : une carte de 8 n'a plus de voisin possible.
    expect(ancreTient({ ...base, plancher: 6, largeur: 8, largeurParDefaut: 8 })).toBe(false);
    // … et la carte étroite, élargie d'office à 6, n'est plus à sa largeur.
    expect(ancreTient({ ...base, plancher: 6, largeur: 6, largeurParDefaut: 4 })).toBe(false);
  });

  it("téléphone : tout est pleine largeur, rien n'est ancré", () => {
    expect(ancreTient({ ...base, plancher: 12, largeur: 12, largeurParDefaut: 4 })).toBe(false);
    expect(ancreTient({ ...base, plancher: 12, largeur: 12, largeurParDefaut: 8 })).toBe(false);
  });

  it("pendant qu'on l'élargit, le panneau n'est plus ancré", () => {
    expect(ancreTient({ ...base, largeur: 5, largeurParDefaut: 4 })).toBe(false);
  });
});

describe("colonneCss", () => {
  it("libre, accrochée à gauche, accrochée à droite", () => {
    expect(colonneCss(4, null)).toBe("span 4");
    expect(colonneCss(4, "debut")).toBe("1 / span 4");
    expect(colonneCss(8, "fin")).toBe("span 8 / -1");
  });
});

// ── Aujourd'hui au téléphone (2026-10-12, crible du labo, constat 14) ─────────
describe("ordreAujourdhuiAuTelephone — les habitudes juste sous les tâches", () => {
  it("⭐ l'ordre du code : « habitudes » passe de la sixième place à celle qui suit « tasks »", () => {
    expect(ordreAujourdhuiAuTelephone(PRESENTS)).toEqual([
      "perf",
      "discipline",
      "tasks",
      "habitudes",
      "timer",
      "calendar",
      "goals",
      "quicklinks",
    ]);
  });

  it("rien d'autre ne change de place, et rien n'est perdu ni doublé", () => {
    const rendu = ordreAujourdhuiAuTelephone(PRESENTS);
    expect([...rendu].sort()).toEqual([...PRESENTS].sort());
    expect(rendu.filter((id) => id !== "habitudes")).toEqual(PRESENTS.filter((id) => id !== "habitudes"));
  });

  it("vaut aussi pour un ordre enregistré en glissant les cartes au bureau", () => {
    const glisse = ["goals", "habitudes", "perf", "calendar", "tasks", "timer", "discipline", "quicklinks"];
    const rendu = ordreAujourdhuiAuTelephone(glisse);
    expect(rendu.indexOf("habitudes")).toBe(rendu.indexOf("tasks") + 1);
  });

  it("déjà à sa place : l'ordre est rendu tel quel", () => {
    const deja = ["perf", "tasks", "habitudes", "timer"];
    expect(ordreAujourdhuiAuTelephone(deja)).toEqual(deja);
  });

  it("carte des tâches masquée dans Personnaliser : les habitudes restent où elles sont", () => {
    const sansTaches = PRESENTS.filter((id) => id !== "tasks");
    expect(ordreAujourdhuiAuTelephone(sansTaches)).toEqual(sansTaches);
  });

  it("carte des habitudes masquée : rien ne bouge, et rien n'est inventé", () => {
    const sansHabitudes = PRESENTS.filter((id) => id !== "habitudes");
    expect(ordreAujourdhuiAuTelephone(sansHabitudes)).toEqual(sansHabitudes);
  });

  it("ne modifie pas le tableau reçu (c'est l'ordre du bureau, il doit rester intact)", () => {
    const copie = [...PRESENTS];
    ordreAujourdhuiAuTelephone(PRESENTS);
    expect(PRESENTS).toEqual(copie);
  });
});

describe("placerApres", () => {
  it("avance un élément placé plus loin, recule un élément placé avant", () => {
    expect(placerApres(["a", "b", "c", "d"], "d", "a")).toEqual(["a", "d", "b", "c"]);
    expect(placerApres(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
  });
  it("un élément ne se place pas après lui-même", () => {
    expect(placerApres(["a", "b"], "a", "a")).toEqual(["a", "b"]);
  });
});

// ── Performance épurée (2026-10-12) : deux panneaux retirés ─────────────────

describe("Performance — une disposition enregistrée qui porte encore `perf-tiles` et `perf-focus`", () => {
  // Les panneaux que le code rend AUJOURD'HUI, lus dans la vue elle-même : le
  // test ne peut pas dériver d'une liste recopiée.
  const source = readFileSync("src/views/PerformanceView.tsx", "utf8");
  // Deux panneaux n'existent que sous condition (Shale Pro, module Trading) :
  // le compte d'ici ne les a pas.
  const presents = [...source.matchAll(/<ResizablePanel id="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((id) => id !== "perf-revue-ia" && id !== "perf-trading");
  // Ce qu'un compte d'avant le 12 octobre a pu enregistrer en rangeant sa grille.
  const AVANT = [
    "perf-tiles",
    "perf-analyse",
    "perf-discipline",
    "perf-habitudes",
    "perf-semaine",
    "perf-focus-temps",
    "perf-streaks",
    "perf-goals",
    "perf-focus",
    "perf-metrics",
  ];

  it("la vue ne rend plus ni les tuiles de période ni « focus par tag »", () => {
    expect(presents).not.toContain("perf-tiles");
    expect(presents).not.toContain("perf-focus");
    // Ce qui reste, d'après Antonin : la discipline, la régularité, les quatre demi-cartes, les métriques.
    for (const id of ["perf-analyse", "perf-discipline", "perf-habitudes", "perf-semaine", "perf-focus-temps", "perf-streaks", "perf-goals", "perf-metrics"]) {
      expect(presents).toContain(id);
    }
  });

  it("⭐ l'ordre enregistré se charge sans trou : les deux absents n'y prennent aucune place", () => {
    const ordre = ordreEffectif(["perf-focus", ...AVANT.filter((id) => id !== "perf-focus").reverse()], presents);
    expect(ordre).not.toContain("perf-tiles");
    expect(ordre).not.toContain("perf-focus");
    expect([...ordre].sort()).toEqual([...presents].sort());
    expect(new Set(ordre).size).toBe(ordre.length);
    // L'ordre choisi pour le reste est gardé : « Métriques » avait été remontée en tête.
    expect(ordre[0]).toBe("perf-metrics");
  });

  it("⭐ masqués avant d'être retirés : aucune pastille « + … » pour les rallumer", () => {
    expect(masquesConnus(["perf-focus", "perf-goals", "perf-tiles"], presents)).toEqual(["perf-goals"]);
  });

  it("leur taille enregistrée ne compte pas comme une disposition touchée", () => {
    const panneaux = presents.map((id) => ({ id, largeurParDefaut: 12 }));
    // L'ordre affiché est celui d'avant, les deux absents ôtés (`ordreEffectif`).
    const ordre = ordreEffectif(AVANT, presents);
    expect(ordre).toEqual(presents);
    expect(dispositionIntacte(ordre, panneaux, { "perf-focus": { w: 6 }, "perf-tiles": { w: 8 } })).toBe(true);
  });
});

// ── La barre de poignées et les en-têtes (2026-10-12) ───────────────────────

describe("reserveDEntete — la place que la barre de poignées recouvre vraiment", () => {
  // Un panneau de 472 px : la barre (82 px) est à 6 px du bord droit et du haut.
  const barre = { haut: 6, bas: 36, gauche: 384, droite: 466 };
  // L'en-tête d'une carte au bord rembourré de 20 px.
  const tete = { haut: 20, bas: 38, gauche: 20, droite: 452 };

  it("⭐ ce que la barre recouvre, plus un peu d'air", () => {
    expect(reserveDEntete(tete, barre, 1)).toBe(452 - 384 + AIR_BARRE);
  });

  it("⭐ un panneau sans carte (« Métriques ») : l'en-tête va jusqu'au bord, la réserve suit", () => {
    // La constante d'avant (84 px) laissait « Ajouter » 4 px sous la barre.
    const r = reserveDEntete({ ...tete, haut: 0, bas: 32, gauche: 0, droite: 472 }, barre, 1);
    expect(r).toBe(472 - 384 + AIR_BARRE);
    expect(472 - r).toBeLessThan(barre.gauche);
  });

  it("⭐ un second en-tête, plus bas dans la carte : rien à réserver", () => {
    expect(reserveDEntete({ ...tete, haut: 180, bas: 198 }, barre, 1)).toBe(0);
    // Juste sous la barre, bord à bord : toujours rien.
    expect(reserveDEntete({ ...tete, haut: 36, bas: 54 }, barre, 1)).toBe(0);
  });

  it("un en-tête qui s'arrête avant la barre (une colonne de gauche) : rien", () => {
    expect(reserveDEntete({ ...tete, droite: 300 }, barre, 1)).toBe(0);
  });

  it("au doigt la barre n'existe pas (rectangle vide) : rien", () => {
    expect(reserveDEntete(tete, { haut: 0, bas: 0, gauche: 0, droite: 0 }, 1)).toBe(0);
  });

  it("⭐ à 110 %, les rectangles sont en px d'écran et la réserve en px locaux", () => {
    const z = 1.1;
    const fois = (b: typeof barre) => ({ haut: b.haut * z, bas: b.bas * z, gauche: b.gauche * z, droite: b.droite * z });
    expect(reserveDEntete(fois(tete), fois(barre), z)).toBe(reserveDEntete(tete, barre, 1));
  });

  it("une échelle illisible vaut 1", () => {
    expect(reserveDEntete(tete, barre, Number.NaN)).toBe(reserveDEntete(tete, barre, 1));
    expect(reserveDEntete(tete, barre, 0)).toBe(reserveDEntete(tete, barre, 1));
  });
});

describe("enteteSerre — la réserve fait-elle grandir l'en-tête ?", () => {
  it("⭐ une ligne de plus : serré, la réserve devient permanente", () => {
    expect(enteteSerre(18, 44)).toBe(true);
  });

  it("même hauteur, à un arrondi près : il a la place, la réserve reste au survol", () => {
    expect(enteteSerre(18, 18)).toBe(false);
    expect(enteteSerre(18.1, 18.4)).toBe(false);
  });
});

describe("la feuille de style et la jauge se tiennent", () => {
  const css = readFileSync("src/index.css", "utf8");
  const jauge = readFileSync("src/components/grid/entetes.ts", "utf8");

  it("⭐ un en-tête serré garde sa réserve SANS survol", () => {
    // La règle qui pose le padding : au survol, au clavier, menu ouvert — et serré.
    const regle = css.match(/([^{}]*)\{\s*padding-right: var\(--rgrid-reserve, var\(--rgrid-handle-w, 5\.25rem\)\);/);
    expect(regle).not.toBeNull();
    const selecteurs = regle![1];
    expect(selecteurs).toMatch(/\.group\\\/panel:hover \.rgrid-head/);
    expect(selecteurs).toMatch(/\.rgrid-head\[data-rgrid-serre\]/);
  });

  it("la jauge pose exactement ce que la feuille lit", () => {
    expect(jauge).toContain('"--rgrid-reserve"');
    expect(jauge).toContain('"data-rgrid-serre"');
  });

  it("⭐ la jauge n'écrit aucune classe : l'observateur du panneau regarde `class`, elle se relancerait", () => {
    expect(jauge).not.toMatch(/classList|className/);
  });
});
