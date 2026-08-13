import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { synchroniser, type Contexte } from "./engine";
import { deuxAppareils, UTILISATEUR, type Appareil, type ServeurSimule } from "./engine.testutil";
import { deriverSousCles, genererDek, type SousCles } from "./crypto";
import { toutRemettreEnFile } from "./local";
import { TABLES_SYNC } from "./scope";

/**
 * Étape 5 — le moteur, de bout en bout.
 *
 * Deux appareils réels (deux bases SQLite montées par les 16 migrations), un
 * serveur simulé qui applique la même règle que le trigger Postgres, et la
 * vraie couche de chiffrement. Rien n'est simulé à part le réseau.
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

/** Aligne les deux appareils : chacun envoie puis reçoit, deux fois. */
async function converger() {
  await sync(a);
  await sync(b);
  await sync(a);
  await sync(b);
}

// ─────────────────────────────────────────────────────────────────────────────

describe("propagation d'une création", () => {
  it("une tâche saisie sur A apparaît sur B", async () => {
    a.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES ('acheter du pain', 'high', 'none')");
    await converger();

    const chezB = b.lire<{ label: string; priority: string }>("SELECT label, priority FROM tasks");
    expect(chezB).toHaveLength(1);
    expect(chezB[0].label).toBe("acheter du pain");
    expect(chezB[0].priority).toBe("high");
  });

  it("les accents et le contenu riche traversent intacts", async () => {
    const corps = "<p>Été 2026 — préférée, ça, où… 📈</p>";
    a.ecrire("INSERT INTO notes (title, body) VALUES (?, ?)", "Réflexion", corps);
    await converger();
    expect(b.lire<{ body: string }>("SELECT body FROM notes")[0].body).toBe(corps);
  });

  it("le serveur ne détient QUE de l'opaque", async () => {
    a.ecrire("INSERT INTO tags (name, color) VALUES ('silver-bullet', '#fff')");
    a.ecrire("INSERT INTO notes (title, body) VALUES ('Plan secret', 'contenu confidentiel')");
    await sync(a);

    const tout = JSON.stringify(serveur.contenu.map((l) => ({ ...l, payload: [...(l.payload ?? [])] })));
    for (const fuite of ["silver-bullet", "Plan secret", "confidentiel", "notes", "tags", "tg:"]) {
      expect(tout).not.toContain(fuite);
    }
  });
});

describe("clés étrangères traduites", () => {
  it("une tâche reste rattachée au BON objectif malgré des numéros locaux différents", async () => {
    // Le cœur du problème : sur B, les numéros locaux sont décalés. Sans
    // traduction, la tâche se rattacherait à un objectif AU HASARD — sans
    // erreur, juste des données fausses.
    for (let i = 0; i < 5; i++) {
      b.ecrire("INSERT INTO goals (title, scope) VALUES (?, 'short')", `bourrage ${i}`);
    }
    const objectifId = a.ecrire("INSERT INTO goals (title, scope) VALUES ('Passer prop firm', 'long')")
      .lastInsertRowid;
    a.ecrire("INSERT INTO tasks (label, priority, recurrence, goal_id) VALUES ('backtester', 'medium', 'none', ?)", objectifId);

    await converger();

    const chezB = b.lire<{ label: string; titre: string }>(
      "SELECT t.label AS label, g.title AS titre FROM tasks t JOIN goals g ON g.id = t.goal_id",
    );
    expect(chezB).toHaveLength(1);
    expect(chezB[0].titre).toBe("Passer prop firm");
    // Et les numéros locaux diffèrent bel et bien : la traduction a servi.
    const idA = a.lire<{ id: number }>("SELECT id FROM goals WHERE title = 'Passer prop firm'")[0].id;
    const idB = b.lire<{ id: number }>("SELECT id FROM goals WHERE title = 'Passer prop firm'")[0].id;
    expect(idA).not.toBe(idB);
  });

  it("un enfant reçu avant son parent est mis en quarantaine, puis appliqué", async () => {
    const objectifId = a.ecrire("INSERT INTO goals (title, scope) VALUES ('Racine', 'long')").lastInsertRowid;
    a.ecrire("INSERT INTO goals (title, scope, parent_goal_id) VALUES ('Branche', 'short', ?)", objectifId);
    await converger();

    const chezB = b.lire<{ enfant: string; parent: string }>(
      "SELECT e.title AS enfant, p.title AS parent FROM goals e JOIN goals p ON p.id = e.parent_goal_id",
    );
    expect(chezB).toEqual([{ enfant: "Branche", parent: "Racine" }]);
  });

  it("une coche d'habitude retrouve son habitude", async () => {
    for (let i = 0; i < 3; i++) b.ecrire("INSERT INTO habits (name) VALUES (?)", `bourrage ${i}`);
    const habitId = a.ecrire("INSERT INTO habits (name, color) VALUES ('sport', '#0f0')").lastInsertRowid;
    a.ecrire("INSERT INTO habit_checks (habit_id, date) VALUES (?, '2026-08-02')", habitId);

    await converger();

    const chezB = b.lire<{ nom: string; date: string }>(
      "SELECT h.name AS nom, c.date AS date FROM habit_checks c JOIN habits h ON h.id = c.habit_id",
    );
    expect(chezB).toEqual([{ nom: "sport", date: "2026-08-02" }]);
  });
});

describe("hors ligne, puis reconnexion", () => {
  it("les modifications s'accumulent et partent toutes au retour du réseau", async () => {
    serveur.horsLigne = true;
    for (let i = 0; i < 25; i++) {
      a.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES (?, 'medium', 'none')", `tâche ${i}`);
    }
    await expect(sync(a)).rejects.toThrow(/réseau/);

    // Rien n'est perdu : tout attend dans la file.
    expect(a.lire<{ n: number }>("SELECT COUNT(*) AS n FROM sync_outbox")[0].n).toBeGreaterThan(0);

    serveur.horsLigne = false;
    await converger();

    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM tasks")[0].n).toBe(25);
    expect(a.lire<{ n: number }>("SELECT COUNT(*) AS n FROM sync_outbox")[0].n).toBe(0);
  });

  it("vingt modifications d'une note ne font qu'un seul envoi", async () => {
    const id = a.ecrire("INSERT INTO notes (title, body) VALUES ('journal', 'v0')").lastInsertRowid;
    serveur.horsLigne = true;
    for (let i = 1; i <= 20; i++) a.ecrire("UPDATE notes SET body = ? WHERE id = ?", `v${i}`, id);
    serveur.horsLigne = false;

    await converger();

    expect(serveur.contenu).toHaveLength(1);
    expect(b.lire<{ body: string }>("SELECT body FROM notes")[0].body).toBe("v20");
  });

  it("une ligne créée PUIS supprimée hors ligne ne parvient jamais au serveur", async () => {
    serveur.horsLigne = true;
    const id = a.ecrire("INSERT INTO notes (title, body) VALUES ('brouillon', 'x')").lastInsertRowid;
    a.ecrire("DELETE FROM notes WHERE id = ?", id);
    serveur.horsLigne = false;

    await converger();

    // Une pierre tombale part (le serveur ne sait pas que la ligne n'a jamais
    // existé chez lui), mais aucun contenu n'a été exposé, et B ne crée rien.
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM notes")[0].n).toBe(0);
    expect(serveur.contenu.every((l) => l.deleted)).toBe(true);
  });
});

describe("conflits", () => {
  it("la modification la plus récente l'emporte, des deux côtés", async () => {
    a.ecrire("INSERT INTO notes (title, body) VALUES ('partagée', 'origine')");
    await converger();

    // Les deux appareils modifient la même note sans se voir.
    serveur.horsLigne = true;
    a.ecrire("UPDATE notes SET body = 'version de A' WHERE title = 'partagée'");
    await new Promise((r) => setTimeout(r, 5)); // B écrit après A
    b.ecrire("UPDATE notes SET body = 'version de B' WHERE title = 'partagée'");
    serveur.horsLigne = false;

    await converger();

    const corpsA = a.lire<{ body: string }>("SELECT body FROM notes")[0].body;
    const corpsB = b.lire<{ body: string }>("SELECT body FROM notes")[0].body;
    // La propriété qui compte : ils sont D'ACCORD, et c'est la plus récente.
    expect(corpsA).toBe(corpsB);
    expect(corpsA).toBe("version de B");
  });

  it("une saisie locale toute fraîche n'est pas écrasée par une ligne distante plus ancienne", async () => {
    a.ecrire("INSERT INTO notes (title, body) VALUES ('partagée', 'origine')");
    await converger();

    // B écrit et envoie ; A écrit APRÈS mais n'a pas encore synchronisé.
    b.ecrire("UPDATE notes SET body = 'version de B' WHERE title = 'partagée'");
    await sync(b);
    await new Promise((r) => setTimeout(r, 5));
    a.ecrire("UPDATE notes SET body = 'version de A, plus récente' WHERE title = 'partagée'");

    // A reçoit la version de B pendant que la sienne attend : elle ne doit pas
    // écraser une saisie que l'utilisateur vient de faire.
    await sync(a);
    expect(a.lire<{ body: string }>("SELECT body FROM notes")[0].body).toBe("version de A, plus récente");

    await converger();
    expect(b.lire<{ body: string }>("SELECT body FROM notes")[0].body).toBe("version de A, plus récente");
  });

  it("convergent même si les deux écritures tombent dans la MÊME MILLISECONDE", async () => {
    // RÉGRESSION. C'est le cas qui a fait diverger le moteur définitivement :
    // quand les horodatages sont égaux, l'arbitrage se joue sur l'appareil, et
    // le perdant reconnaissait « son » horodatage dans la version du gagnant.
    // Il concluait « je la connais déjà » et gardait la sienne — pour toujours.
    //
    // L'égalité est FORCÉE ici plutôt que laissée au hasard de l'ordonnanceur :
    // sans cela, le test cesserait un jour de couvrir ce cas sans prévenir.
    a.ecrire("INSERT INTO notes (title, body) VALUES ('duel', 'origine')");
    await converger();

    serveur.horsLigne = true;
    a.ecrire("UPDATE notes SET body = 'version de A' WHERE title = 'duel'");
    b.ecrire("UPDATE notes SET body = 'version de B' WHERE title = 'duel'");
    // ⚠️ L'instant forcé se calcule à partir de l'horloge, il n'est SURTOUT pas
    // écrit en dur : une date figée finit par passer dans le passé, les deux
    // envois sont alors rejetés comme périmés, et le test cesse silencieusement
    // de couvrir quoi que ce soit. (Constaté : une date du 2 août est devenue
    // caduque le 3.)
    const memeInstant = new Date(Date.now() + 60_000).toISOString();
    a.ecrire("UPDATE sync_outbox SET ts = ?", memeInstant);
    b.ecrire("UPDATE sync_outbox SET ts = ?", memeInstant);
    serveur.horsLigne = false;

    await converger();

    const corpsA = a.lire<{ body: string }>("SELECT body FROM notes")[0].body;
    const corpsB = b.lire<{ body: string }>("SELECT body FROM notes")[0].body;
    expect(corpsA).toBe(corpsB);
    // Départage par appareil : « appareil-B » > « appareil-A ».
    expect(corpsA).toBe("version de B");
  });

  it("les deux appareils convergent quel que soit l'ordre de synchronisation", async () => {
    a.ecrire("INSERT INTO trades (date, instrument, direction, result_r) VALUES ('2026-08-02', 'NQ', 'long', 1)");
    await converger();

    serveur.horsLigne = true;
    a.ecrire("UPDATE trades SET result_r = 2.5, notes = 'depuis A'");
    b.ecrire("UPDATE trades SET result_r = -1, notes = 'depuis B'");
    serveur.horsLigne = false;

    // B envoie en premier, puis A. L'ordre ne doit pas décider du vainqueur.
    await sync(b);
    await sync(a);
    await sync(b);
    await sync(a);

    const chezA = a.lire<{ result_r: number; notes: string }>("SELECT result_r, notes FROM trades")[0];
    const chezB = b.lire<{ result_r: number; notes: string }>("SELECT result_r, notes FROM trades")[0];
    expect(chezA).toEqual(chezB);
  });
});

describe("suppressions", () => {
  it("une suppression sur A efface la ligne sur B", async () => {
    a.ecrire("INSERT INTO notes (title, body) VALUES ('à jeter', 'x')");
    await converger();
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM notes")[0].n).toBe(1);

    a.ecrire("DELETE FROM notes WHERE title = 'à jeter'");
    await converger();
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM notes")[0].n).toBe(0);
  });

  it("une ligne supprimée ne RESSUSCITE pas à la synchronisation suivante", async () => {
    // Sans pierre tombale, B renverrait sa copie encore vivante et la ligne
    // réapparaîtrait chez A — le grand classique des synchronisations naïves.
    a.ecrire("INSERT INTO habits (name) VALUES ('à supprimer')");
    await converger();

    a.ecrire("DELETE FROM habits WHERE name = 'à supprimer'");
    await converger();
    await converger();
    await converger();

    expect(a.lire<{ n: number }>("SELECT COUNT(*) AS n FROM habits")[0].n).toBe(0);
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM habits")[0].n).toBe(0);
  });
});

describe("économie et absence de boucle", () => {
  it("une synchronisation sans changement n'envoie rien", async () => {
    a.ecrire("INSERT INTO notes (title, body) VALUES ('stable', 'x')");
    await converger();

    const envoisAvant = serveur.envois;
    await sync(a);
    await sync(b);
    expect(serveur.envois).toBe(envoisAvant);
  });

  it("appliquer une ligne reçue ne la renvoie PAS au cloud", async () => {
    // Sans le drapeau anti-boucle, chaque synchronisation en déclencherait une
    // autre, indéfiniment.
    a.ecrire("INSERT INTO notes (title, body) VALUES ('venue de A', 'x')");
    await converger();

    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM sync_outbox")[0].n).toBe(0);
  });

  it("le système se stabilise : deux cycles de plus ne changent rien", async () => {
    a.ecrire("INSERT INTO goals (title, scope) VALUES ('objectif', 'long')");
    b.ecrire("INSERT INTO notes (title, body) VALUES ('note de B', 'y')");
    await converger();

    const etat = () => ({
      a: a.lire("SELECT uid, title FROM goals ORDER BY uid"),
      b: b.lire("SELECT uid, title FROM notes ORDER BY uid"),
      serveur: serveur.contenu.length,
    });
    const avant = JSON.stringify(etat());
    await converger();
    await converger();
    expect(JSON.stringify(etat())).toBe(avant);
  });
});

describe("réglages", () => {
  it("un réglage métier traverse", async () => {
    a.ecrire("INSERT INTO settings (key, value) VALUES ('sizing.capital', '12500')");
    await converger();
    expect(b.lire<{ value: string }>("SELECT value FROM settings WHERE key = 'sizing.capital'")[0].value).toBe(
      "12500",
    );
  });

  it("un réglage propre à l'appareil NE traverse PAS, et n'encombre pas la file", async () => {
    a.ecrire("INSERT INTO settings (key, value) VALUES ('layout.today', '{\"x\":1}')");
    a.ecrire("INSERT INTO settings (key, value) VALUES ('market.groq_key', 'gsk_secret')");
    await converger();

    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM settings")[0].n).toBe(0);
    expect(a.lire<{ n: number }>("SELECT COUNT(*) AS n FROM sync_outbox")[0].n).toBe(0);
    // Et surtout : la clé d'API n'est jamais sortie de la machine.
    expect(JSON.stringify(serveur.contenu)).not.toContain("gsk_secret");
    expect(serveur.contenu).toHaveLength(0);
  });
});

describe("volume", () => {
  it("encaisse une fiche du Savoir de plusieurs centaines de ko", async () => {
    const grosse = "<p>note illustrée</p>".repeat(20000);
    a.ecrire(
      "INSERT INTO knowledge_entries (title, body, text, created_at, updated_at) VALUES ('Illustrée', ?, 'note illustrée', '2026-08-02 10:00:00', '2026-08-02 10:00:00')",
      grosse,
    );
    await converger();
    expect(b.lire<{ body: string }>("SELECT body FROM knowledge_entries")[0].body).toBe(grosse);
    // La compression doit avoir massivement réduit le contenu répétitif.
    expect(serveur.contenu[0].payload!.length).toBeLessThan(grosse.length / 20);
  });

  it("passe l'échelle de plusieurs centaines de lignes", async () => {
    for (let i = 0; i < 300; i++) {
      a.ecrire(
        "INSERT INTO trades (date, instrument, direction, result_r) VALUES (?, 'NQ', 'long', ?)",
        `2026-0${(i % 9) + 1}-01`,
        i % 5,
      );
    }
    await converger();
    await converger();
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM trades")[0].n).toBe(300);
  });

  it("un appareil neuf rattrape TOUT en un seul cycle", async () => {
    // ⚠️ Le test ci-dessus passait déjà avant que le moteur sache paginer —
    // parce qu'il appelle `converger()` deux fois, soit quatre cycles. C'est
    // précisément ce qui masquait le défaut : une page de 200 lignes par
    // cycle, et un cycle toutes les 90 secondes. 300 lignes = trois minutes,
    // 5 000 lignes = quarante minutes, l'indicateur affichant tout du long un
    // « synchronisé » sincère et faux. Ici B ne reçoit qu'UN cycle.
    for (let i = 0; i < 450; i++) {
      a.ecrire(
        "INSERT INTO trades (date, instrument, direction, result_r) VALUES (?, 'NQ', 'long', ?)",
        `2026-0${(i % 9) + 1}-01`,
        i % 5,
      );
    }
    await sync(a);

    const r = await sync(b);
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM trades")[0].n).toBe(450);
    // Plus de deux pages : la boucle a bien tourné, sans redemander la dernière.
    expect(r.recues).toBe(450);
    expect(r.resteATirer).toBe(false);
  });

  it("ne redemande pas éternellement une page retenue par la quarantaine", async () => {
    // Le curseur ne dépasse jamais une orpheline. Si la boucle de pagination
    // ignorait ce fait, elle retirerait la même page indéfiniment — un cycle
    // qui ne rend jamais la main, sur une app qui doit rester réactive.
    const racine = a.ecrire("INSERT INTO goals (title, scope) VALUES ('Racine', 'long')").lastInsertRowid;
    a.ecrire("INSERT INTO goals (title, scope, parent_goal_id) VALUES ('Branche', 'short', ?)", racine);
    for (let i = 0; i < 30; i++) {
      a.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES (?, 'low', 'none')", `t${i}`);
    }
    await sync(a);
    const r = await sync(b);
    expect(r.resteATirer).toBe(false);
    expect(r.recues).toBeGreaterThan(0);
  });
});

describe("republication après réinitialisation du mot de passe", () => {
  it("des lignes scellées par une AUTRE clé n'interrompent pas le cycle", async () => {
    // Le scénario : le cloud contient encore des lignes chiffrées avec une clé
    // que plus personne ne possède. Avant, le cycle entier échouait — donc à
    // chaque tentative, pour toujours : un blocage définitif là où il n'y avait
    // qu'un résidu à ignorer.
    //
    // ⚠️ Ce qui les écarte n'est PAS le déchiffrement : le nom de table est
    // aveuglé par une sous-clé de la même DEK, donc une autre clé produit aussi
    // d'autres empreintes de table. Elles sont écartées comme « table inconnue »
    // AVANT toute tentative d'ouverture. Le résultat est le même — passer outre
    // sans casser — mais par un autre chemin que celui qu'on croirait.
    a.ecrire("INSERT INTO notes (title, body) VALUES ('ancienne', 'scellée par la clé perdue')");
    await sync(a);

    const autresCles = await deriverSousCles(genererDek());
    const ctxB: Contexte = {
      db: b.db,
      transport: serveur,
      cles: autresCles,
      userId: UTILISATEUR,
      deviceId: b.nom,
    };

    const r = await synchroniser(ctxB);

    expect(r.ignorees).toBeGreaterThan(0);
    expect(r.appliquees).toBe(0);
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM notes")[0].n).toBe(0);
  });

  it("une charge CORROMPUE est comptée et enjambée, sans faire échouer le cycle", async () => {
    // Ici la table est reconnue (même clé), mais les octets ne s'ouvrent pas :
    // altération en transit, stockage abîmé. C'est le cas que la tolérance
    // ajoutée au moteur couvre réellement.
    a.ecrire("INSERT INTO notes (title, body) VALUES ('abîmée', 'x')");
    a.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES ('intacte', 'medium', 'none')");
    await sync(a);

    // On abîme UNE charge sur le serveur, on laisse l'autre entière.
    const cible = serveur.contenu.find((l) => l.payload && l.payload.length > 40)!;
    cible.payload![cible.payload!.length - 2] ^= 0xff;

    const r = await sync(b);

    expect(r.illisibles).toBe(1);
    // Et surtout : le reste est passé malgré tout.
    expect(r.appliquees).toBeGreaterThan(0);
    expect(b.lire<{ n: number }>("SELECT COUNT(*) AS n FROM tasks")[0].n).toBeGreaterThan(0);
  });

  it("le curseur DÉPASSE les lignes illisibles, il ne s'y bloque pas", async () => {
    // Sans avancée du curseur, le moteur relirait éternellement les mêmes
    // octets qu'il ne peut pas ouvrir, et ne verrait jamais ce qui suit.
    a.ecrire("INSERT INTO notes (title, body) VALUES ('ancienne', 'x')");
    await sync(a);

    const autresCles = await deriverSousCles(genererDek());
    const ctxB: Contexte = {
      db: b.db,
      transport: serveur,
      cles: autresCles,
      userId: UTILISATEUR,
      deviceId: b.nom,
    };
    await synchroniser(ctxB);

    const curseur = Number(b.lire<{ v: string }>("SELECT v FROM sync_meta WHERE k = 'cursor'")[0].v);
    expect(curseur).toBeGreaterThan(0);

    // Et un second passage ne retire plus rien : on est passé outre.
    const r2 = await synchroniser(ctxB);
    expect(r2.recues).toBe(0);
  });

  it("republier remet TOUTES les lignes locales en file", async () => {
    // C'est ce qui permet de reconstruire le cloud à partir de cet appareil.
    a.ecrire("INSERT INTO notes (title, body) VALUES ('n1', 'x')");
    a.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES ('t1', 'medium', 'none')");
    a.ecrire("INSERT INTO habits (name) VALUES ('sport')");
    await converger();
    expect(a.lire<{ n: number }>("SELECT COUNT(*) AS n FROM sync_outbox")[0].n).toBe(0);

    await toutRemettreEnFile(a.db, TABLES_SYNC);

    const enFile = new Set(
      a.lire<{ table_name: string }>("SELECT DISTINCT table_name FROM sync_outbox").map((r) => r.table_name),
    );
    expect(enFile).toContain("notes");
    expect(enFile).toContain("tasks");
    expect(enFile).toContain("habits");
  });

  it("la remise en file ne fausse AUCUNE donnée métier", async () => {
    // Elle écrit `uid = uid` : une mise à jour sans effet, qui ne doit ni
    // toucher `updated_at`, ni réordonner quoi que ce soit.
    a.ecrire(
      "INSERT INTO knowledge_entries (title, body, text, created_at, updated_at) VALUES ('fiche', 'corps', 'corps', '2026-01-01 10:00:00', '2026-01-02 11:00:00')",
    );
    const avant = a.lire<{ title: string; updated_at: string; uid: string }>(
      "SELECT title, updated_at, uid FROM knowledge_entries",
    )[0];

    await toutRemettreEnFile(a.db, TABLES_SYNC);

    const apres = a.lire<{ title: string; updated_at: string; uid: string }>(
      "SELECT title, updated_at, uid FROM knowledge_entries",
    )[0];
    expect(apres).toEqual(avant);
  });

  it("après republication, l'autre appareil retrouve tout", async () => {
    // Le bout du scénario : le cloud vidé, reconstruit depuis A, et B — parti
    // d'une base vide — récupère l'intégralité.
    a.ecrire("INSERT INTO notes (title, body) VALUES ('gardée', 'contenu')");
    a.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES ('gardée aussi', 'high', 'none')");
    await sync(a);

    await serveur.effacerTout();
    expect(serveur.contenu).toHaveLength(0);

    a.ecrire("DELETE FROM sync_state");
    a.ecrire("UPDATE sync_meta SET v = '0' WHERE k = 'cursor'");
    await toutRemettreEnFile(a.db, TABLES_SYNC);
    await converger();

    expect(b.lire<{ title: string }>("SELECT title FROM notes")[0].title).toBe("gardée");
    expect(b.lire<{ label: string }>("SELECT label FROM tasks")[0].label).toBe("gardée aussi");
  });
});
