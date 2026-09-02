import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { synchroniser, type Contexte } from "./engine";
import { deuxAppareils, UTILISATEUR, type Appareil, type ServeurSimule } from "./engine.testutil";
import type { SousCles } from "./crypto";
import { uidArete } from "../liens";

/**
 * Socle du 2026-09-02 — les liaisons traversent la synchronisation.
 *
 * C'est LE test du chantier. Une arête pointe des `uid` et non des `id`
 * (migration 020, § 5) précisément pour survivre au passage sur un second
 * appareil ; tant que ce trajet n'est pas fait pour de vrai, cette affirmation
 * n'est qu'une intention. Deux vraies bases SQLite, la vraie couche de
 * chiffrement, seul le réseau est simulé.
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

/** Crée une note et une tâche sur `app`, puis l'arête qui les relie. */
function noteMentionnantUneTache(app: Appareil, titre = "plan de la semaine") {
  app.ecrire("INSERT INTO notes (title, body) VALUES (?, '<p>voir @tâche</p>')", titre);
  app.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES ('relire le plan', 'medium', 'none')");
  const noteUid = (app.lire<{ uid: string }>("SELECT uid FROM notes WHERE title = ?", titre)[0]).uid;
  const tacheUid = (app.lire<{ uid: string }>("SELECT uid FROM tasks WHERE label = 'relire le plan'")[0]).uid;
  app.ecrire(
    "INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid, origin) VALUES ('note', ?, 'task', ?, 'mention')",
    noteUid,
    tacheUid,
  );
  return { noteUid, tacheUid };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("une arête survit à l'aller-retour", () => {
  it("⭐ ses DEUX extrémités arrivent intactes sur le second appareil", async () => {
    const { noteUid, tacheUid } = noteMentionnantUneTache(a);
    await converger();

    const chezB = b.lire<{ from_kind: string; from_uid: string; to_kind: string; to_uid: string; origin: string }>(
      "SELECT from_kind, from_uid, to_kind, to_uid, origin FROM object_links",
    );
    expect(chezB).toHaveLength(1);
    expect(chezB[0]).toEqual({
      from_kind: "note",
      from_uid: noteUid,
      to_kind: "task",
      to_uid: tacheUid,
      origin: "mention",
    });
  });

  it("⚠️ et elles pointent bien vers les lignes de B, dont les numéros locaux diffèrent", async () => {
    // On décale volontairement les `id` de B : sans cela, le test passerait même
    // si les arêtes voyageaient avec des numéros locaux — le pire des cas, car
    // il ne se voit jamais sur la machine où l'on développe.
    b.ecrire("INSERT INTO notes (title, body) VALUES ('brouillon local', '')");
    b.ecrire("INSERT INTO notes (title, body) VALUES ('autre brouillon', '')");
    b.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES ('tâche locale', 'low', 'none')");

    noteMentionnantUneTache(a);
    await converger();

    const arete = b.lire<{ from_uid: string; to_uid: string }>("SELECT from_uid, to_uid FROM object_links")[0];
    const note = b.lire<{ id: number; title: string }>("SELECT id, title FROM notes WHERE uid = ?", arete.from_uid)[0];
    const tache = b.lire<{ id: number; label: string }>("SELECT id, label FROM tasks WHERE uid = ?", arete.to_uid)[0];

    expect(note.title).toBe("plan de la semaine");
    expect(tache.label).toBe("relire le plan");
    // La preuve que les numéros ne sont pas comparables d'un appareil à l'autre.
    const noteChezA = a.lire<{ id: number }>("SELECT id FROM notes WHERE title = 'plan de la semaine'")[0];
    expect(note.id).not.toBe(noteChezA.id);
  });

  it("l'arête garde la MÊME identité des deux côtés", async () => {
    const { noteUid, tacheUid } = noteMentionnantUneTache(a);
    await converger();

    const attendu = uidArete({ kind: "note", uid: noteUid }, { kind: "task", uid: tacheUid });
    expect((b.lire<{ uid: string }>("SELECT uid FROM object_links")[0]).uid).toBe(attendu);
    expect((a.lire<{ uid: string }>("SELECT uid FROM object_links")[0]).uid).toBe(attendu);
  });
});

describe("la même mention tapée des deux côtés ne fait qu'une arête", () => {
  it("⭐ l'uid dérivé fait converger, là où un uid aléatoire aurait divergé", async () => {
    // Deux appareils qui écrivent la même mention, chacun de son côté, hors
    // ligne. Avec un uid aléatoire, on obtiendrait deux lignes serveur pour un
    // seul fait, qui se battraient sans jamais converger.
    a.ecrire("INSERT INTO notes (title, body) VALUES ('idée', '')");
    a.ecrire("INSERT INTO goals (title, scope) VALUES ('passer full-time', 'long')");
    await converger();

    const noteUid = (a.lire<{ uid: string }>("SELECT uid FROM notes")[0]).uid;
    const goalUid = (a.lire<{ uid: string }>("SELECT uid FROM goals")[0]).uid;
    const lien = "INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid, origin) VALUES ('note', ?, 'goal', ?, ?)";
    a.ecrire(lien, noteUid, goalUid, "mention");
    b.ecrire(lien, noteUid, goalUid, "manual");

    await converger();

    expect(a.lire("SELECT id FROM object_links")).toHaveLength(1);
    expect(b.lire("SELECT id FROM object_links")).toHaveLength(1);
    // Et les deux appareils gardent LA MÊME — c'est ce que « converger » veut
    // dire. Lequel des deux `origin` gagne n'a pas d'importance : l'arête
    // existe, et c'est tout ce que l'utilisateur voit.
    expect((a.lire<{ origin: string }>("SELECT origin FROM object_links")[0]).origin).toBe(
      (b.lire<{ origin: string }>("SELECT origin FROM object_links")[0]).origin,
    );
  });
});

describe("une cible supprimée n'abandonne pas de backlink fantôme", () => {
  it("⭐ supprimer la note sur A retire l'arête sur B aussi", async () => {
    noteMentionnantUneTache(a);
    await converger();
    expect(b.lire("SELECT id FROM object_links")).toHaveLength(1);

    a.ecrire("DELETE FROM notes WHERE title = 'plan de la semaine'");
    // La cascade a joué localement, tout de suite.
    expect(a.lire("SELECT id FROM object_links")).toHaveLength(0);

    await converger();

    // Et B a fait le même ménage, sans que l'arête ne « ressuscite » au cycle
    // suivant — le mode d'échec classique d'une suppression mal journalisée.
    expect(b.lire("SELECT id FROM notes")).toHaveLength(0);
    expect(b.lire("SELECT id FROM object_links")).toHaveLength(0);
    await converger();
    expect(b.lire("SELECT id FROM object_links")).toHaveLength(0);
  });
});

describe("une arête arrivée avant sa cible", () => {
  it("⚠️ est CONSERVÉE, pas mise en quarantaine ni perdue", async () => {
    // `object_links` ne déclare aucune clé étrangère (ses extrémités sont
    // polymorphes), donc le moteur ne peut pas la mettre en quarantaine comme il
    // le fait pour une tâche dont l'objectif n'est pas encore arrivé. L'arête
    // s'écrit telle quelle et devient visible quand sa cible arrive — c'est la
    // lecture qui la masque entre-temps (`aretesResolues`).
    a.ecrire("INSERT INTO notes (title, body) VALUES ('seule', '')");
    const noteUid = (a.lire<{ uid: string }>("SELECT uid FROM notes")[0]).uid;
    a.ecrire(
      "INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid) VALUES ('note', ?, 'object', 'uid-qui-n-existe-pas')",
      noteUid,
    );

    await converger();

    const chezB = b.lire<{ to_uid: string }>("SELECT to_uid FROM object_links");
    expect(chezB).toHaveLength(1);
    expect(chezB[0].to_uid).toBe("uid-qui-n-existe-pas");
  });
});

describe("le garde-fou du moteur", () => {
  it("⭐ une colonne de DONNÉE finissant par `_uid` n'est plus vidée en route", async () => {
    // Régression. `appliquerLigne` écartait TOUTE colonne finissant par `_uid`,
    // en supposant qu'aucune table ne stockerait jamais un uid comme donnée.
    // `object_links` fait exactement cela : ses arêtes arrivaient avec les deux
    // extrémités VIDÉES — sans erreur, sans alerte, juste un lien qui ne pointe
    // plus nulle part. Le tri se fait désormais sur les clés DÉCLARÉES.
    noteMentionnantUneTache(a);
    await converger();

    const arete = b.lire<{ from_uid: string | null; to_uid: string | null }>(
      "SELECT from_uid, to_uid FROM object_links",
    )[0];
    expect(arete.from_uid).toBeTruthy();
    expect(arete.to_uid).toBeTruthy();
  });

  it("les clés étrangères VRAIES continuent d'être traduites", async () => {
    // Le miroir du test précédent : la correction ne devait rien changer aux
    // tables existantes. Un objet et son type traversent, et l'objet reste
    // rattaché au BON type malgré des numéros locaux différents.
    b.ecrire("INSERT INTO object_types (name) VALUES ('Décalage local')");
    const typeId = (a.lire<{ id: number }>("SELECT id FROM object_types WHERE name = 'Projet'")[0]).id;
    a.ecrire("INSERT INTO objects (type_id, title) VALUES (?, 'Refonte du site')", typeId);

    await converger();

    const chezB = b.lire<{ nom: string }>(
      "SELECT t.name AS nom FROM objects o JOIN object_types t ON t.id = o.type_id WHERE o.title = 'Refonte du site'",
    );
    expect(chezB[0]?.nom).toBe("Projet");
  });
});
