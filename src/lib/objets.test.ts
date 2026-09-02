import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";

import {
  champsDuType,
  fusionnerValeurs,
  nouvelIdDeChamp,
  valeursAffichables,
  valeursDeLObjet,
  valeursOrphelines,
  validerObjet,
  validerType,
} from "./objets";
import { baseNeuve } from "./sync/schema.testutil";
import type { ObjectField } from "./types";

/** Socle du 2026-09-02 — types d'objets personnalisés (migration 020). */

const champ = (id: string, name: string, type: ObjectField["type"], required: 0 | 1 = 0, options?: string[]): ObjectField =>
  options ? { id, name, type, required, options } : { id, name, type, required };

// ─────────────────────────────────────────────────────────────────────────────

describe("les quatre types livrés", () => {
  let db: DatabaseSync;
  beforeEach(() => {
    db = baseNeuve();
  });
  afterEach(() => db.close());

  it("sont là, avec des champs lisibles — pas des coquilles vides", () => {
    const types = db
      .prepare("SELECT name, fields, builtin FROM object_types ORDER BY position")
      .all() as { name: string; fields: string; builtin: number }[];

    expect(types.map((t) => t.name)).toEqual(["Personne", "Ressource", "Projet", "Setup de trading"]);
    for (const t of types) {
      expect(t.builtin).toBe(1);
      // Le vrai contrôle : le JSON écrit dans la migration se relit par le
      // parseur de l'app. Une virgule de trop y serait invisible jusqu'à
      // l'ouverture du module, en production.
      expect(champsDuType(t.fields).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("⭐ leur uid est DÉRIVÉ du nom, donc identique sur les deux appareils", () => {
    // Ces lignes naissent à la création de la base, donc sur CHAQUE appareil.
    // Avec un uid aléatoire, le second appareil synchronisé se retrouverait avec
    // deux « Personne », et personne pour dire laquelle est la bonne.
    const uids = (db.prepare("SELECT uid FROM object_types ORDER BY position").all() as { uid: string }[]).map(
      (r) => r.uid,
    );
    expect(uids).toEqual(["ot:Personne", "ot:Ressource", "ot:Projet", "ot:Setup de trading"]);
  });

  it("⚠️ restent supprimables — `builtin` dit d'où ils viennent, il ne verrouille rien", () => {
    expect(() => db.prepare("DELETE FROM object_types WHERE name = 'Personne'").run()).not.toThrow();
    expect(db.prepare("SELECT COUNT(*) AS n FROM object_types").get()).toEqual({ n: 3 });
  });

  it("supprimer un type emporte ses objets, et leurs arêtes", () => {
    // Sans cette cascade, les fiches resteraient en base sans type, donc sans
    // champs et sans écran : invisibles, mais toujours là.
    const typeId = (db.prepare("SELECT id FROM object_types WHERE name = 'Projet'").get() as { id: number }).id;
    db.prepare("INSERT INTO objects (type_id, title) VALUES (?, 'Refonte du site')").run(typeId);
    const objUid = (db.prepare("SELECT uid FROM objects").get() as { uid: string }).uid;
    db.prepare(
      "INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid) VALUES ('note', 'n1', 'object', ?)",
    ).run(objUid);

    db.prepare("DELETE FROM object_types WHERE id = ?").run(typeId);

    expect(db.prepare("SELECT COUNT(*) AS n FROM objects").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM object_links").get()).toEqual({ n: 0 });
  });
});

describe("lecture tolérante du JSON", () => {
  it("un JSON illisible rend une liste vide, il ne fait pas planter l'écran", () => {
    // Cette colonne peut arriver d'un appareil qui tourne une autre version de
    // l'app. Une exception ici ferait perdre l'écran entier plutôt qu'un champ.
    expect(champsDuType("{pas du json")).toEqual([]);
    expect(champsDuType(null)).toEqual([]);
    expect(valeursDeLObjet("[1,2,3]")).toEqual({});
  });

  it("écarte les champs mal formés sans perdre les bons", () => {
    const champs = champsDuType(
      JSON.stringify([
        { id: "f1", name: "Rôle", type: "text", required: 0 },
        { id: "f2", name: "Cassé", type: "type-inconnu" },
        { name: "Sans id", type: "text" },
        { id: "f4", name: "Statut", type: "choice", required: 1, options: ["A", "B"] },
      ]),
    );
    expect(champs.map((c) => c.id)).toEqual(["f1", "f4"]);
    expect(champs[1].options).toEqual(["A", "B"]);
  });
});

describe("identité des champs", () => {
  it("⚠️ ne recycle JAMAIS l'identifiant d'un champ supprimé", () => {
    // Le recycler ressusciterait, dans le nouveau champ, les valeurs de
    // l'ancien : ajouter « Téléphone » après avoir supprimé « Rôle »
    // afficherait « Développeur » comme numéro, sur toutes les fiches.
    const restants = [champ("f1", "Nom", "text")];
    const valeursExistantes = ["f1", "f2", "f3"]; // f2 et f3 ont existé
    expect(nouvelIdDeChamp(restants, valeursExistantes)).toBe("f4");
  });

  it("part de f1 sur un type neuf", () => {
    expect(nouvelIdDeChamp([])).toBe("f1");
  });
});

describe("validation d'un type", () => {
  it("refuse un type sans nom et un champ sans nom", () => {
    expect(validerType("", [])).toHaveLength(1);
    expect(validerType("Client", [champ("f1", "  ", "text")])).toHaveLength(1);
  });

  it("refuse un choix sans option — il ne serait jamais remplissable", () => {
    expect(validerType("Client", [champ("f1", "Statut", "choice")])).toHaveLength(1);
  });

  it("refuse deux champs homonymes", () => {
    // Les valeurs sont rangées par `id`, donc rien ne serait perdu — mais
    // l'utilisateur ne saurait plus lequel des deux il remplit.
    const erreurs = validerType("Client", [champ("f1", "Nom", "text"), champ("f2", "Nom", "text")]);
    expect(erreurs).toHaveLength(1);
  });

  it("accepte un type correct", () => {
    expect(validerType("Client", [champ("f1", "Nom", "text"), champ("f2", "Depuis", "date")])).toEqual([]);
  });
});

describe("validation d'un objet", () => {
  const champs = [
    champ("f1", "Nom", "text", 1),
    champ("f2", "Depuis", "date"),
    champ("f3", "Note", "number"),
    champ("f4", "Statut", "choice", 0, ["Actif", "Inactif"]),
  ];

  it("réclame les champs obligatoires", () => {
    expect(validerObjet(champs, {})).toEqual(["Le champ « Nom » est obligatoire."]);
  });

  it("refuse une date qui n'en est pas une, et un choix hors liste", () => {
    const erreurs = validerObjet(champs, { f1: "Anne", f2: "hier", f4: "Peut-être" });
    expect(erreurs).toHaveLength(2);
  });

  it("accepte un objet correct", () => {
    expect(validerObjet(champs, { f1: "Anne", f2: "2026-04-12", f3: 3, f4: "Actif" })).toEqual([]);
  });

  it("⚠️ une valeur orpheline n'est JAMAIS une erreur", () => {
    // Sinon la fiche deviendrait impossible à enregistrer le jour où l'on
    // retire un champ du type — et la seule issue serait de perdre la donnée.
    expect(validerObjet(champs, { f1: "Anne", f99: "valeur d'un champ retiré" })).toEqual([]);
  });
});

describe("⭐ retirer un champ ne détruit rien", () => {
  const avant = [champ("f1", "Nom", "text"), champ("f2", "Rôle", "text")];
  const apres = [champ("f1", "Nom", "text")];
  const valeurs = { f1: "Anne", f2: "Développeuse" };

  it("nomme ce qui va cesser d'être affiché", () => {
    // Une donnée qui disparaît de l'écran sans que personne ne l'ait annoncé est
    // indiscernable d'une donnée perdue.
    expect(valeursOrphelines(apres, valeurs)).toEqual(["f2"]);
    expect(valeursOrphelines(avant, valeurs)).toEqual([]);
  });

  it("n'affiche que ce que le type déclare encore", () => {
    expect(valeursAffichables(apres, valeurs)).toEqual({ f1: "Anne" });
  });

  it("⭐ conserve la valeur en base, et la rend au retour du champ", () => {
    // Le cœur de la promesse. Un `JSON.stringify` du formulaire aurait effacé
    // « Développeuse » à la première sauvegarde, sans un mot.
    const saisiesApresRetrait = { f1: "Anne-Sophie" };
    const enregistre = fusionnerValeurs(valeurs, saisiesApresRetrait);

    expect(enregistre).toEqual({ f1: "Anne-Sophie", f2: "Développeuse" });
    // Le champ revient : la valeur est là, intacte.
    expect(valeursAffichables(avant, enregistre)).toEqual({ f1: "Anne-Sophie", f2: "Développeuse" });
  });
});
