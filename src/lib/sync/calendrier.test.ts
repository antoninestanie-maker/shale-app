import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { synchroniser, type Contexte } from "./engine";
import { deuxAppareils, UTILISATEUR, type Appareil, type ServeurSimule } from "./engine.testutil";
import type { SousCles } from "./crypto";

/**
 * ⭐ LE CALENDRIER TRAVERSE LA SYNCHRONISATION — et personne ne l'avait vérifié.
 *
 * ⚠️ POURQUOI CE FICHIER EXISTE. `calendar_events` est arrivée avec la migration
 * 020 le 2026-09-02 et n'a JAMAIS été éprouvée sur le banc à deux appareils :
 * aucun test de `sync/` ne la mentionnait. La colonne `end_date` de la 021 s'y
 * est ajoutée le 2026-09-06 sans plus de preuve. Or le § 2 de `PIEGES.md` est
 * catégorique : « une faute de synchronisation ne se voit JAMAIS sur l'appareil
 * où l'on développe — elle se voit sur le second, plus tard, sous la forme de
 * données FAUSSES, pas d'une erreur ». Et le chantier A l'a payé une fois :
 * `local.ts` vidait les deux extrémités de chaque arête reçue, en silence, et
 * seul le banc l'a montré.
 *
 * Deux vraies bases SQLite montées par les vraies migrations, la vraie couche
 * de chiffrement. Seul le réseau est simulé.
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

interface LigneEvenement {
  title: string;
  date: string;
  end_date: string | null;
  start_at: string | null;
  end_at: string | null;
  all_day: number;
  color: string | null;
  recurrence: string;
}

const CHAMPS = "title, date, end_date, start_at, end_at, all_day, color, recurrence";

// ─────────────────────────────────────────────────────────────────────────────

describe("un événement survit à l'aller-retour", () => {
  it("⭐ arrive avec CHAQUE colonne intacte, `end_date` comprise", async () => {
    a.ecrire(
      `INSERT INTO calendar_events (title, date, end_date, start_at, end_at, all_day, color, recurrence)
       VALUES ('séminaire', '2026-09-04', '2026-09-06', '14:37', '15:37', 0, 'yellow', 'none')`,
    );
    await converger();

    const chezB = b.lire<LigneEvenement>(`SELECT ${CHAMPS} FROM calendar_events`);
    expect(chezB).toHaveLength(1);
    // ⚠️ L'égalité champ par champ, et pas seulement sur `end_date` : c'est le
    // trajet ENTIER qu'on éprouve. Une colonne écartée en route ne lève aucune
    // erreur — elle arrive vide (cf. le bogue de `local.ts`, PIEGES § 2.1).
    expect(chezB[0]).toEqual({
      title: "séminaire",
      date: "2026-09-04",
      end_date: "2026-09-06",
      start_at: "14:37",
      end_at: "15:37",
      all_day: 0,
      color: "yellow",
      recurrence: "none",
    });
  });

  it("⚠️ 14:37 reste 14:37 — aucun fuseau ne s'invite dans le voyage", async () => {
    // Les heures sont stockées en LOCAL ('HH:MM'), le seul UTC de l'app étant
    // l'horodatage de l'outbox. Une conversion en route décalerait tous les
    // rendez-vous d'un utilisateur qui n'est pas à Paris en hiver — et rien ne
    // le signalerait.
    a.ecrire(
      `INSERT INTO calendar_events (title, date, start_at, end_at, recurrence)
       VALUES ('point hebdo', '2026-09-09', '14:37', '15:37', 'none')`,
    );
    await converger();
    const chezB = b.lire<LigneEvenement>(`SELECT ${CHAMPS} FROM calendar_events`)[0];
    expect(chezB.start_at).toBe("14:37");
    expect(chezB.end_at).toBe("15:37");
    expect(chezB.date).toBe("2026-09-09");
  });

  it("`end_date` NULLE reste nulle, elle ne devient pas la date de départ", async () => {
    // La convention de la 021 est « NULL = tient sur une journée ». Si le voyage
    // la remplissait, `estMultiJours()` continuerait de rendre faux (fin <=
    // début) — le défaut serait donc INVISIBLE ici et se révélerait le jour où
    // quelqu'un comparerait les deux colonnes.
    a.ecrire(
      "INSERT INTO calendar_events (title, date, all_day, recurrence) VALUES ('anniversaire', '2026-09-12', 1, 'none')",
    );
    await converger();
    expect(b.lire<LigneEvenement>(`SELECT ${CHAMPS} FROM calendar_events`)[0].end_date).toBeNull();
  });

  it("une récurrence en JOURS CHOISIS traverse sans se faire relire de travers", async () => {
    // `recurrence` voyage comme du JSON dans une colonne TEXT. Un ré-encodage en
    // route (guillemets, espaces) casserait `occurrenceLe()` en silence : la
    // série cesserait simplement d'apparaître au calendrier.
    a.ecrire(
      "INSERT INTO calendar_events (title, date, start_at, recurrence) VALUES ('standup', '2026-09-07', '10:15', '[2,4]')",
    );
    await converger();
    expect(b.lire<LigneEvenement>(`SELECT ${CHAMPS} FROM calendar_events`)[0].recurrence).toBe("[2,4]");
  });
});

describe("une modification et une suppression traversent aussi", () => {
  it("allonger un séjour sur A l'allonge sur B", async () => {
    a.ecrire(
      "INSERT INTO calendar_events (title, date, end_date, all_day, recurrence) VALUES ('vacances', '2026-08-01', '2026-08-05', 1, 'none')",
    );
    await converger();
    a.ecrire("UPDATE calendar_events SET end_date = '2026-08-12' WHERE title = 'vacances'");
    await converger();
    expect(b.lire<LigneEvenement>(`SELECT ${CHAMPS} FROM calendar_events`)[0].end_date).toBe("2026-08-12");
  });

  it("supprimer sur A supprime sur B, sans ressusciter au cycle suivant", async () => {
    a.ecrire(
      "INSERT INTO calendar_events (title, date, recurrence) VALUES ('rendez-vous annulé', '2026-09-15', 'none')",
    );
    await converger();
    expect(b.lire(`SELECT ${CHAMPS} FROM calendar_events`)).toHaveLength(1);

    a.ecrire("DELETE FROM calendar_events WHERE title = 'rendez-vous annulé'");
    await converger();
    expect(b.lire(`SELECT ${CHAMPS} FROM calendar_events`)).toHaveLength(0);
    // Un second tour : une pierre tombale mal tenue ferait revenir la ligne
    // depuis l'appareil qui ne l'a pas encore vue partir.
    await converger();
    expect(b.lire(`SELECT ${CHAMPS} FROM calendar_events`)).toHaveLength(0);
  });
});

describe("une tâche DATÉE traverse avec son créneau", () => {
  it("⭐ `due_date`, `start_at` et `end_at` arrivent ensemble", async () => {
    // Ce sont les colonnes que le formulaire de tâche a appris à écrire le
    // 2026-09-06. Elles n'avaient jamais voyagé non plus.
    a.ecrire(
      `INSERT INTO tasks (label, priority, recurrence, due_date, start_at, end_at)
       VALUES ('appeler le comptable', 'medium', 'none', '2026-09-09', '11:45', '12:45')`,
    );
    await converger();
    const chezB = b.lire<{ due_date: string; start_at: string; end_at: string; postponed_count: number }>(
      "SELECT due_date, start_at, end_at, postponed_count FROM tasks WHERE label = 'appeler le comptable'",
    );
    expect(chezB[0]).toEqual({
      due_date: "2026-09-09",
      start_at: "11:45",
      end_at: "12:45",
      postponed_count: 0,
    });
  });

  it("le compteur de report voyage, sinon la tâche se ferait reporter deux fois", async () => {
    a.ecrire(
      `INSERT INTO tasks (label, priority, recurrence, due_date, postponed_count, postponed_from)
       VALUES ('rédiger le plan', 'high', 'none', '2026-09-06', 2, '2026-09-01')`,
    );
    await converger();
    const chezB = b.lire<{ postponed_count: number; postponed_from: string }>(
      "SELECT postponed_count, postponed_from FROM tasks WHERE label = 'rédiger le plan'",
    );
    expect(chezB[0]).toEqual({ postponed_count: 2, postponed_from: "2026-09-01" });
  });
});
