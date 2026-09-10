import { describe, expect, it } from "vitest";

import {
  CLE_ACCUEIL_FAIT,
  CLE_CONTRAINTS,
  CLE_COUCHER,
  CLE_EXEMPLES_CREES,
  CLE_LEVER,
  CLE_TRAVAIL,
  CLES_HORAIRES,
  ecrireReglages,
  estHeure,
  lireReglages,
  minutesDeHeure,
  REGLAGES_PAR_DEFAUT,
  repliDuTravail,
  type ReglagesHoraires,
} from "./reglages";
import { REPLI_DEBUT, REPLI_FIN } from "../calendrier/disponibilite";
import { settingSynchronisable } from "../sync/scope";

/** Chantier L — les réponses de l'accueil et leur rangement. */

describe("⭐ les clés de l'accueil sont SYNCHRONISÉES sans rien inscrire nulle part", () => {
  it("aucune n'est exclue par `sync/scope.ts`", () => {
    const toutes = [
      CLE_ACCUEIL_FAIT,
      CLE_LEVER,
      CLE_COUCHER,
      CLE_TRAVAIL,
      CLE_CONTRAINTS,
      CLE_EXEMPLES_CREES,
    ];
    for (const cle of toutes) expect(settingSynchronisable(cle)).toBe(true);
  });

  it("aucune ne commence par `sync.` ni ne ressemble à un secret", () => {
    // Le drapeau doit vivre dans la couche de sync : une clé attrapée par le
    // filtre anti-secret resterait sur la machine, et le second appareil
    // rejouerait l'accueil sans que rien ne le dise.
    for (const cle of [CLE_ACCUEIL_FAIT, CLE_EXEMPLES_CREES]) {
      expect(cle.startsWith("sync.")).toBe(false);
      expect(/key|token|secret|password|apikey/i.test(cle)).toBe(false);
    }
  });

  it("le rejeu n'écrase QUE les quatre clés horaires", () => {
    expect([...CLES_HORAIRES].sort()).toEqual(
      [CLE_LEVER, CLE_COUCHER, CLE_TRAVAIL, CLE_CONTRAINTS].sort(),
    );
    // Ni le drapeau des exemples, ni quoi que ce soit d'autre : rejouer
    // l'accueil ne doit pas régénérer du contenu de départ déjà supprimé.
    expect(CLES_HORAIRES).not.toContain(CLE_EXEMPLES_CREES);
  });
});

describe("⭐ un skip complet laisse l'app EXACTEMENT comme avant le chantier", () => {
  it("le repli par défaut est celui que `disponibilite.ts` codait en dur", () => {
    const r = repliDuTravail(REGLAGES_PAR_DEFAUT);
    expect(r.debut).toBe(REPLI_DEBUT);
    expect(r.fin).toBe(REPLI_FIN);
    expect(r.jours).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("les heures", () => {
  it("reconnaît une heure valide et refuse le reste", () => {
    for (const bonne of ["00:00", "09:30", "23:59"]) expect(estHeure(bonne)).toBe(true);
    for (const mauvaise of ["24:00", "9:30", "23:60", "", "midi", null, 900])
      expect(estHeure(mauvaise)).toBe(false);
  });

  it("convertit en minutes depuis minuit", () => {
    expect(minutesDeHeure("00:00")).toBe(0);
    expect(minutesDeHeure("09:30")).toBe(570);
    expect(minutesDeHeure("23:59")).toBe(1439);
    expect(minutesDeHeure("pas une heure")).toBeNull();
  });
});

describe("relire ce qui a été écrit", () => {
  const complets: ReglagesHoraires = {
    lever: "06:30",
    coucher: "22:45",
    travail: { jours: [2, 4], debut: "10:00", fin: "16:00" },
    contraints: [{ label: "Trajet", jours: [2], debut: "09:00", fin: "10:00" }],
  };

  it("l'aller-retour est fidèle", () => {
    expect(lireReglages(ecrireReglages(complets))).toEqual(complets);
  });

  it("des réglages vides rendent les valeurs par défaut", () => {
    expect(lireReglages({})).toEqual(REGLAGES_PAR_DEFAUT);
  });
});

describe("⚠️ une valeur illisible retombe sur son défaut, CHAMP PAR CHAMP", () => {
  // Ces lignes arrivent aussi par synchronisation, écrites par une version de
  // l'app qu'on ne connaît pas. Faire tomber tout le bloc pour un trajet mal
  // formé donnerait une grille fausse sans rien dire.

  it("un JSON cassé sur les trajets ne fait pas perdre l'heure de coucher", () => {
    const lu = lireReglages({
      [CLE_COUCHER]: "01:15",
      [CLE_CONTRAINTS]: "{ pas du json",
    });
    expect(lu.coucher).toBe("01:15");
    expect(lu.contraints).toEqual([]);
    expect(lu.lever).toBe(REGLAGES_PAR_DEFAUT.lever);
  });

  it("une heure hors bornes est refusée, pas rognée", () => {
    expect(lireReglages({ [CLE_LEVER]: "27:00" }).lever).toBe(REGLAGES_PAR_DEFAUT.lever);
  });

  it("une plage de travail incomplète retombe sur le repli", () => {
    const lu = lireReglages({ [CLE_TRAVAIL]: JSON.stringify({ jours: [1], debut: "09:00" }) });
    expect(lu.travail).toEqual(REGLAGES_PAR_DEFAUT.travail);
  });

  it("des jours hors de 0–6 sont écartés, les autres survivent", () => {
    const lu = lireReglages({
      [CLE_TRAVAIL]: JSON.stringify({ jours: [1, 9, 3, -2, 3], debut: "08:00", fin: "12:00" }),
    });
    expect(lu.travail.jours).toEqual([1, 3]); // dédoublonnés et triés
  });

  it("un trajet sans libellé est conservé : c'est le créneau qui compte", () => {
    const lu = lireReglages({
      [CLE_CONTRAINTS]: JSON.stringify([{ jours: [1], debut: "08:00", fin: "09:00" }]),
    });
    expect(lu.contraints).toEqual([{ label: "", jours: [1], debut: "08:00", fin: "09:00" }]);
  });

  it("un trajet mal formé est écarté SANS emporter les autres", () => {
    const lu = lireReglages({
      [CLE_CONTRAINTS]: JSON.stringify([
        { label: "Bon", jours: [1], debut: "08:00", fin: "09:00" },
        { label: "Cassé", jours: [1], debut: "pas une heure", fin: "09:00" },
        { label: "Bon aussi", jours: [5], debut: "18:00", fin: "19:00" },
      ]),
    });
    expect(lu.contraints.map((c) => c.label)).toEqual(["Bon", "Bon aussi"]);
  });
});

describe("le repli dérivé des heures déclarées", () => {
  const avec = (debut: string, fin: string, jours = [1, 2, 3, 4, 5]) =>
    repliDuTravail({ ...REGLAGES_PAR_DEFAUT, travail: { jours, debut, fin } });

  it("arrondit vers l'EXTÉRIEUR : 09:30 – 17:30 rend 9 → 18", () => {
    // Arrondir vers l'intérieur retirerait deux heures qu'on vient de déclarer
    // travailler, et les créneaux proposés cesseraient de couvrir le début et
    // la fin des journées.
    expect(avec("09:30", "17:30")).toMatchObject({ debut: 9, fin: 18 });
  });

  it("des heures pleines ne bougent pas", () => {
    expect(avec("08:00", "16:00")).toMatchObject({ debut: 8, fin: 16 });
  });

  it("⚠️ une plage qui franchit minuit se borne à 24 h plutôt que de rendre le vide", () => {
    // `fin < debut` rendrait une fenêtre vide, donc AUCUN créneau proposé —
    // l'app cesserait silencieusement de servir un travailleur de nuit.
    expect(avec("22:00", "06:00")).toMatchObject({ debut: 22, fin: 24 });
    expect(avec("09:00", "09:00")).toMatchObject({ debut: 9, fin: 24 });
  });

  it("les jours sont triés et repris tels quels", () => {
    expect(avec("09:00", "18:00", [6, 0, 3]).jours).toEqual([0, 3, 6]);
  });
});
