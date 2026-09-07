import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { synchroniser, type Contexte } from "./engine";
import { deuxAppareils, UTILISATEUR, type Appareil, type ServeurSimule } from "./engine.testutil";
import type { SousCles } from "./crypto";
import {
  ajouterEnfant,
  ajouterFrere,
  blocCarte,
  cartesDuHtml,
  carteVide,
  ecrireCarte,
  poserReference,
  refsDesCartes,
  renommer,
  rendreSvg,
  type Carte,
} from "../carte";
import { uidArete } from "../liens";

/**
 * ⭐ Les cartes mentales traversent la synchronisation — chantier du 2026-09-07.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE, alors que « rien n'a été ajouté au schéma ».
 * C'est précisément la raison. La décision du chantier tient en une phrase :
 * « la carte voyage dans le corps de la note, donc dans la sauvegarde chiffrée,
 * GRATUITEMENT ». Tant que le trajet n'est pas fait pour de vrai, cette phrase
 * n'est qu'une intention — et le § 2 de `PIEGES.md` est sans ambiguïté : une
 * faute de synchronisation ne se voit JAMAIS sur l'appareil où l'on développe,
 * elle se voit sur le second, plus tard, sous forme de données fausses.
 *
 * Ce qui rend le trajet non évident malgré l'absence de schéma neuf :
 *   • le graphe est du JSON **dans un attribut HTML**, donc plein de `&quot;` ;
 *   • le corps porte en plus un `<svg>` entier ;
 *   • et une référence de nœud doit produire une arête qui, elle, a bien un
 *     schéma à traverser.
 *
 * Deux vraies bases SQLite, la vraie couche de chiffrement, seul le réseau est
 * simulé.
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

/** Une carte de travail : une racine et deux branches, dont une avec des accents. */
function carteEssai(): Carte {
  let c = carteVide("Plan de trading");
  const un = ajouterEnfant(c, "r");
  c = renommer(un.carte, un.neuf, "Règles d'entrée « strictes »");
  const deux = ajouterFrere(c, un.neuf);
  c = renommer(deux.carte, deux.neuf, "Discipline");
  return c;
}

const corpsAvecCarte = (c: Carte) => `<p>ma réflexion</p>${blocCarte(c)}<p>la suite</p>`;

// ─────────────────────────────────────────────────────────────────────────────

describe("une carte mentale survit à l'aller-retour", () => {
  it("⭐ le corps arrive OCTET POUR OCTET identique sur le second appareil", async () => {
    const corps = corpsAvecCarte(carteEssai());
    a.ecrire("INSERT INTO notes (title, body) VALUES ('avec carte', ?)", corps);
    await converger();

    const chezB = b.lire<{ body: string }>("SELECT body FROM notes WHERE title = 'avec carte'");
    expect(chezB).toHaveLength(1);
    expect(chezB[0].body).toBe(corps);
  });

  it("⭐ et le GRAPHE s'y relit — les `&quot;` de l'attribut ont tenu", async () => {
    // C'est le point qui n'allait pas de soi : le JSON d'une carte est écrit
    // dans un attribut HTML, donc chacun de ses guillemets est une entité. Un
    // transport qui « nettoierait » le HTML au passage casserait la carte sans
    // toucher au reste du corps, et rien ne le signalerait.
    const avant = carteEssai();
    a.ecrire("INSERT INTO notes (title, body) VALUES ('avec carte', ?)", corpsAvecCarte(avant));
    await converger();

    const corpsB = b.lire<{ body: string }>("SELECT body FROM notes WHERE title = 'avec carte'")[0].body;
    const cartes = cartesDuHtml(corpsB);
    expect(cartes).toHaveLength(1);
    expect(ecrireCarte(cartes[0])).toBe(ecrireCarte(avant));
  });

  it("⭐ elle se REDESSINE à l'identique de l'autre côté", async () => {
    // Le rendu est déterministe par construction (`agencer` est pur), mais c'est
    // ici qu'on vérifie que la donnée arrivée est bien celle qui le nourrit.
    const avant = carteEssai();
    a.ecrire("INSERT INTO notes (title, body) VALUES ('avec carte', ?)", corpsAvecCarte(avant));
    await converger();

    const corpsB = b.lire<{ body: string }>("SELECT body FROM notes WHERE title = 'avec carte'")[0].body;
    expect(rendreSvg(cartesDuHtml(corpsB)[0], { mode: "theme" })).toBe(
      rendreSvg(avant, { mode: "theme" }),
    );
  });

  it("les accents et les guillemets français d'un nœud arrivent intacts", async () => {
    const corps = corpsAvecCarte(carteEssai());
    a.ecrire("INSERT INTO notes (title, body) VALUES ('avec carte', ?)", corps);
    await converger();

    const carteB = cartesDuHtml(
      b.lire<{ body: string }>("SELECT body FROM notes WHERE title = 'avec carte'")[0].body,
    )[0];
    expect(carteB.noeuds.map((n) => n.texte)).toContain("Règles d'entrée « strictes »");
  });

  it("une carte de soixante nœuds passe aussi — c'est le poids qui était en question", async () => {
    let c = carteVide("Racine");
    let dernier = "r";
    for (let i = 0; i < 59; i++) {
      const r = i % 4 === 0 ? ajouterEnfant(c, dernier) : ajouterFrere(c, dernier);
      c = renommer(r.carte, r.neuf, `Nœud ${i} — texte de longueur ordinaire`);
      dernier = r.neuf;
    }
    const corps = corpsAvecCarte(c);
    a.ecrire("INSERT INTO notes (title, body) VALUES ('grosse carte', ?)", corps);
    await converger();

    const corpsB = b.lire<{ body: string }>("SELECT body FROM notes WHERE title = 'grosse carte'")[0].body;
    expect(corpsB).toBe(corps);
    expect(cartesDuHtml(corpsB)[0].noeuds).toHaveLength(60);
  });
});

describe("⭐ un nœud-référence produit une arête qui traverse, elle aussi", () => {
  it("l'arête de la carte arrive sur B et pointe la BONNE ligne, malgré des id différents", async () => {
    // On décale les `id` de B : sans cela le test passerait même si l'arête
    // voyageait avec des numéros locaux — le pire des cas, celui qui ne se voit
    // jamais sur la machine où l'on développe (§ 2 de PIEGES.md).
    b.ecrire("INSERT INTO notes (title, body) VALUES ('brouillon local', '')");
    b.ecrire("INSERT INTO notes (title, body) VALUES ('autre brouillon', '')");

    a.ecrire(
      "INSERT INTO knowledge_topics (name, color, position, created_at) VALUES ('Trading', 'blue', 0, '2026-09-07 10:00:00')",
    );
    const topicId = a.lire<{ id: number }>("SELECT id FROM knowledge_topics")[0].id;
    a.ecrire(
      "INSERT INTO knowledge_entries (topic_id, kind, title, body, text, created_at, updated_at) VALUES (?, 'note', 'Plan de risque', '', '', '2026-09-07 10:00:00', '2026-09-07 10:00:00')",
      topicId,
    );
    const ficheUid = a.lire<{ uid: string }>("SELECT uid FROM knowledge_entries")[0].uid;

    const carte = poserReference(carteEssai(), "n1", { kind: "knowledge", uid: ficheUid }, "Plan de risque");
    a.ecrire("INSERT INTO notes (title, body) VALUES ('avec carte', ?)", corpsAvecCarte(carte));
    const noteUid = a.lire<{ uid: string }>("SELECT uid FROM notes WHERE title = 'avec carte'")[0].uid;

    // C'est ce que `useLiens` écrit après l'enregistrement : l'UNION des jetons
    // `@` et des références de carte, avec l'origine `mention` — la seule que le
    // `CHECK` de la migration 020 accepte.
    a.ecrire(
      "INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid, origin) VALUES ('note', ?, 'knowledge', ?, 'mention')",
      noteUid,
      ficheUid,
    );

    await converger();

    const arete = b.lire<{ from_uid: string; to_uid: string; uid: string; origin: string }>(
      "SELECT from_uid, to_uid, uid, origin FROM object_links",
    );
    expect(arete).toHaveLength(1);
    expect(arete[0].origin).toBe("mention");
    expect(arete[0].uid).toBe(
      uidArete({ kind: "note", uid: noteUid }, { kind: "knowledge", uid: ficheUid }),
    );

    // Les deux extrémités désignent bien les lignes de B, dont les numéros
    // locaux ne sont pas ceux de A.
    const noteB = b.lire<{ id: number; title: string }>("SELECT id, title FROM notes WHERE uid = ?", arete[0].from_uid)[0];
    const ficheB = b.lire<{ title: string }>("SELECT title FROM knowledge_entries WHERE uid = ?", arete[0].to_uid)[0];
    expect(noteB.title).toBe("avec carte");
    expect(ficheB.title).toBe("Plan de risque");
    const noteA = a.lire<{ id: number }>("SELECT id FROM notes WHERE title = 'avec carte'")[0];
    expect(noteB.id).not.toBe(noteA.id);
  });

  it("⭐ et la carte reçue cite bien cet uid — les deux moitiés racontent la même chose", async () => {
    // Le risque, autrement : l'arête arrive et la carte arrive, mais elles
    // désignent deux choses différentes. Personne ne le verrait, puisque chaque
    // moitié est cohérente de son côté.
    a.ecrire(
      "INSERT INTO knowledge_topics (name, color, position, created_at) VALUES ('Trading', 'blue', 0, '2026-09-07 10:00:00')",
    );
    const topicId = a.lire<{ id: number }>("SELECT id FROM knowledge_topics")[0].id;
    a.ecrire(
      "INSERT INTO knowledge_entries (topic_id, kind, title, body, text, created_at, updated_at) VALUES (?, 'note', 'Plan de risque', '', '', '2026-09-07 10:00:00', '2026-09-07 10:00:00')",
      topicId,
    );
    const ficheUid = a.lire<{ uid: string }>("SELECT uid FROM knowledge_entries")[0].uid;
    const carte = poserReference(carteEssai(), "n1", { kind: "knowledge", uid: ficheUid }, "Plan de risque");
    a.ecrire("INSERT INTO notes (title, body) VALUES ('avec carte', ?)", corpsAvecCarte(carte));
    const noteUid = a.lire<{ uid: string }>("SELECT uid FROM notes WHERE title = 'avec carte'")[0].uid;
    a.ecrire(
      "INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid, origin) VALUES ('note', ?, 'knowledge', ?, 'mention')",
      noteUid,
      ficheUid,
    );

    await converger();

    const corpsB = b.lire<{ body: string }>("SELECT body FROM notes WHERE title = 'avec carte'")[0].body;
    const areteB = b.lire<{ to_uid: string }>("SELECT to_uid FROM object_links")[0];
    expect(refsDesCartes(corpsB)).toEqual([{ kind: "knowledge", uid: areteB.to_uid }]);
  });
});
