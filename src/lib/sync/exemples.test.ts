import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { synchroniser, type Contexte } from "./engine";
import { deuxAppareils, UTILISATEUR, type Appareil, type ServeurSimule } from "./engine.testutil";
import type { SousCles } from "./crypto";
import {
  CLE_ACCUEIL_FAIT,
  CLE_EXEMPLES_CREES,
} from "../onboarding/reglages";
import { settingSynchronisable } from "./scope";

/**
 * ⭐ Chantier L (2026-09-10) — les points 3 et 4 de la recette d'acceptation.
 *
 * ─── CE QUE CE FICHIER PROUVE, ET CE QU'IL NE PROUVE PAS ────────────────────
 *
 * IL PROUVE, sur DEUX VRAIES BASES SQLite, la vraie couche de chiffrement, et
 * seul le réseau simulé :
 *
 *   • le drapeau « accueil terminé » traverse, donc un second appareil ne
 *     rejoue pas l'accueil (point 3) ;
 *   • le drapeau des exemples traverse, donc le contenu de départ n'est pas
 *     régénéré ni dupliqué (point 3) ;
 *   • supprimer les exemples sur A les fait disparaître sur B (point 4), et
 *     ce SANS une ligne de code de synchronisation propre aux exemples — les
 *     pierres tombales de la migration 016 suffisent ;
 *   • l'ADOPTION traverse : un exemple modifié sur A cesse d'être un exemple
 *     sur B aussi, sinon le bouton de suppression de B l'emporterait.
 *
 * ⚠️ IL NE PROUVE RIEN SUR DEUX VRAIES MACHINES. Le simulateur iPhone est
 * déconnecté depuis le 2026-09-02 et seul Antonin peut le rouvrir ; aucun
 * second Mac n'a été monté. Ce qui est prouvé ici, c'est le MÉCANISME, pas le
 * trajet réel — et c'est la seule chose qu'un test de ce dépôt puisse prouver.
 */

let banc: Awaited<ReturnType<typeof deuxAppareils>>;
let a: Appareil;
let b: Appareil;
let serveur: ServeurSimule;
let cles: SousCles;

beforeEach(async () => {
  banc = await deuxAppareils();
  ({ a, b, serveur, cles } = banc);
});
afterEach(() => banc.fermer());

function ctx(app: Appareil): Contexte {
  return { db: app.db, transport: serveur, cles, userId: UTILISATEUR, deviceId: app.nom };
}
const sync = (app: Appareil) => synchroniser(ctx(app));

async function converger() {
  await sync(a);
  await sync(b);
  await sync(a);
  await sync(b);
}

/** Le parcours d'exemple, réduit à ce que la synchronisation doit porter. */
function semer(app: Appareil) {
  app.ecrire(
    "INSERT INTO knowledge_topics (name, color, position, is_example, created_at, updated_at) VALUES ('Méthode', '#8e8bff', 0, 1, '2026-09-10 02:00:00', '2026-09-10 02:00:00')",
  );
  app.ecrire(
    "INSERT INTO tasks (label, priority, recurrence, is_example) VALUES ('revue de fin de journée', 'medium', 'daily', 1)",
  );
  app.ecrire("INSERT INTO habits (name, color, is_example) VALUES ('coucher régulier', '#8e8bff', 1)");
  app.ecrire("INSERT INTO notes (title, body, is_example) VALUES ('ma revue', '<p>x</p>', 1)");
  app.ecrire(
    "INSERT INTO knowledge_entries (kind, title, body, text, is_example, created_at, updated_at) VALUES ('note', 'la revue', '<p>y</p>', 'y', 1, '2026-09-10 02:00:00', '2026-09-10 02:00:00')",
  );
}

const compterExemples = (app: Appareil): number => {
  let n = 0;
  for (const table of ["tasks", "habits", "notes", "knowledge_entries"]) {
    n += app.lire<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE is_example = 1`)[0].n;
  }
  return n;
};

/** La suppression telle que `repo.supprimerExemples()` la fait. */
function supprimerExemples(app: Appareil) {
  app.ecrire(
    "DELETE FROM task_completions WHERE task_id IN (SELECT id FROM tasks WHERE is_example = 1)",
  );
  app.ecrire(
    "DELETE FROM habit_checks WHERE habit_id IN (SELECT id FROM habits WHERE is_example = 1)",
  );
  for (const table of ["tasks", "habits", "notes", "knowledge_entries"]) {
    app.ecrire(`DELETE FROM ${table} WHERE is_example = 1`);
  }
  // ⭐ Le sujet, SOUS CONDITION : seulement s'il est resté vide.
  app.ecrire(
    `DELETE FROM knowledge_topics
      WHERE is_example = 1
        AND NOT EXISTS (SELECT 1 FROM knowledge_entries WHERE topic_id = knowledge_topics.id)`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe("⭐ point 3 — le second appareil ne rejoue rien", () => {
  it("le drapeau « accueil terminé » traverse", async () => {
    // Le drapeau vit dans `settings`, qui est synchronisé PAR DÉFAUT : c'est
    // toute la raison pour laquelle ce chantier n'a pas touché `scope.ts`.
    expect(settingSynchronisable(CLE_ACCUEIL_FAIT)).toBe(true);
    a.ecrire("INSERT INTO settings (key, value) VALUES (?, '2026-09-10 02:00:00')", CLE_ACCUEIL_FAIT);

    await converger();

    const vu = b.lire<{ value: string }>("SELECT value FROM settings WHERE key = ?", CLE_ACCUEIL_FAIT);
    expect(vu).toHaveLength(1);
    expect(vu[0].value).toBe("2026-09-10 02:00:00");
  });

  it("le drapeau des exemples traverse : rien n'est régénéré ni dupliqué", async () => {
    expect(settingSynchronisable(CLE_EXEMPLES_CREES)).toBe(true);
    semer(a);
    a.ecrire("INSERT INTO settings (key, value) VALUES (?, '2026-09-10 02:00:00')", CLE_EXEMPLES_CREES);

    await converger();

    // B voit le drapeau, donc `exemplesDejaCrees()` y répond vrai et
    // `semerExemples()` sort immédiatement : pas de second jeu d'exemples.
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM settings WHERE key = ?", CLE_EXEMPLES_CREES)[0].n).toBe(1);
    // Et il voit les quatre objets, une fois chacun.
    expect(compterExemples(b)).toBe(4);
  });

  it("le marqueur arrive INTACT, pas remis à zéro par le trajet", async () => {
    // ⚠️ Ce test-ci n'est pas une redite : une colonne peut traverser en
    // perdant sa valeur (c'est exactement ce qui est arrivé à `from_uid` /
    // `to_uid` de `object_links`, PIEGES § 2.1). Un exemple arrivé à 0 sur B
    // s'y afficherait sans badge et compterait dans ses statistiques.
    semer(a);
    await converger();
    for (const table of ["tasks", "habits", "notes", "knowledge_entries"]) {
      const lignes = b.lire<{ is_example: number }>(`SELECT is_example FROM ${table}`);
      expect(lignes).toHaveLength(1);
      expect(lignes[0].is_example).toBe(1);
    }
  });
});

describe("⭐ point 4 — supprimer les exemples sur A les retire de B", () => {
  it("les quatre objets disparaissent après synchronisation", async () => {
    semer(a);
    await converger();
    expect(compterExemples(b)).toBe(4);

    supprimerExemples(a);
    await converger();

    expect(compterExemples(a)).toBe(0);
    expect(compterExemples(b)).toBe(0);
    // Et vraiment supprimés, pas seulement démarqués.
    for (const table of ["tasks", "habits", "notes", "knowledge_entries"]) {
      expect(b.lire<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0].n).toBe(0);
    }
  });

  it("⚠️ elle n'emporte QUE les exemples : les données de l'utilisateur restent", async () => {
    semer(a);
    a.ecrire("INSERT INTO notes (title, body) VALUES ('ma vraie note', '<p>à moi</p>')");
    a.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES ('vrai travail', 'high', 'none')");
    await converger();

    supprimerExemples(a);
    await converger();

    expect(b.lire<{ title: string }>("SELECT title FROM notes").map((n) => n.title)).toEqual([
      "ma vraie note",
    ]);
    expect(b.lire<{ label: string }>("SELECT label FROM tasks").map((t) => t.label)).toEqual([
      "vrai travail",
    ]);
  });

  it("⭐ un exemple ADOPTÉ sur A n'est plus supprimable, ni sur A ni sur B", async () => {
    semer(a);
    await converger();

    // L'utilisateur coche la tâche d'exemple : `repo.adopter()` retire le
    // marqueur. Sans propagation, le bouton de suppression de B emporterait une
    // tâche que l'utilisateur s'est appropriée sur A.
    a.ecrire("UPDATE tasks SET is_example = 0 WHERE is_example = 1");
    await converger();
    expect(b.lire<{ is_example: number }>("SELECT is_example FROM tasks")[0].is_example).toBe(0);

    supprimerExemples(b);
    await converger();

    expect(a.lire<{ label: string }>("SELECT label FROM tasks").map((t) => t.label)).toEqual([
      "revue de fin de journée",
    ]);
    expect(compterExemples(a)).toBe(0);
  });
});

describe("les arêtes du parcours", () => {
  it("⭐ la mention note → fiche traverse, et la cascade la retire des DEUX côtés", async () => {
    semer(a);
    const noteUid = a.lire<{ uid: string }>("SELECT uid FROM notes")[0].uid;
    const ficheUid = a.lire<{ uid: string }>("SELECT uid FROM knowledge_entries")[0].uid;
    a.ecrire(
      "INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid, origin) VALUES ('note', ?, 'knowledge', ?, 'mention')",
      noteUid,
      ficheUid,
    );

    await converger();
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM object_links")[0].n).toBe(1);

    supprimerExemples(a);
    await converger();

    // ⚠️ Les triggers de cascade de la migration 020 ne sont PAS gardés par
    // `applying` : les deux appareils font le même ménage, sans se renvoyer
    // l'écho. C'est ce qui fait qu'aucun backlink fantôme ne survit ici.
    expect(a.lire<{ n: number }>("SELECT COUNT(*) AS n FROM object_links")[0].n).toBe(0);
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM object_links")[0].n).toBe(0);
  });
});

describe("⭐ le SUJET du Savoir est un contenant, pas un objet du parcours", () => {
  it("resté vide, il part avec les exemples — sur les deux appareils", async () => {
    semer(a);
    await converger();
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM knowledge_topics")[0].n).toBe(1);

    supprimerExemples(a);
    await converger();

    // Vu à l'écran le 2026-09-10 : sans cette suppression, un carton vide
    // « Méthode » restait dans la grille du Savoir APRÈS le clic sur
    // « supprimer les exemples ». Un bouton qui tient sa promesse à 4/5 se lit
    // comme un défaut.
    expect(a.lire<{ n: number }>("SELECT COUNT(*) AS n FROM knowledge_topics")[0].n).toBe(0);
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM knowledge_topics")[0].n).toBe(0);
  });

  it("⚠️ CONTRE-ÉPREUVE — une fiche de l'utilisateur rangée dedans le fait SURVIVRE", async () => {
    semer(a);
    const sujetId = a.lire<{ id: number }>("SELECT id FROM knowledge_topics")[0].id;
    // L'utilisateur range sa propre fiche dans le sujet livré.
    a.ecrire(
      `INSERT INTO knowledge_entries (topic_id, kind, title, body, text, created_at, updated_at)
       VALUES (?, 'note', 'ma fiche à moi', '<p>z</p>', 'z', '2026-09-10 03:00:00', '2026-09-10 03:00:00')`,
      sujetId,
    );
    await converger();

    supprimerExemples(a);
    await converger();

    // Le contenant reste avec ce qu'il contient. C'est toute la raison pour
    // laquelle il n'est pas supprimé comme les quatre autres.
    expect(a.lire<{ name: string }>("SELECT name FROM knowledge_topics").map((s) => s.name)).toEqual([
      "Méthode",
    ]);
    expect(b.lire<{ title: string }>("SELECT title FROM knowledge_entries").map((e) => e.title)).toEqual([
      "ma fiche à moi",
    ]);
  });
});
