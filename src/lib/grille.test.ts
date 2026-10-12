// La grille et un panneau qui n'existe plus — voir l'en-tête de `grille.ts`.
import { describe, expect, it } from "vitest";

import {
  ancreTient,
  colonneCss,
  dispositionIntacte,
  masquesConnus,
  ordreAujourdhuiAuTelephone,
  ordreEffectif,
  placerApres,
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
