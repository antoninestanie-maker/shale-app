import { describe, expect, it } from "vitest";

import { baseNeuve } from "../sync/schema.testutil";

/**
 * ⭐ CE QUI EST SAISI EST-IL CE QUI EST RELU — sur le VRAI schéma.
 *
 * ⚠️ Ce fichier existe pour un critère d'acceptation que le mode démo ne peut
 * PAS prouver : « un événement se crée à 14:37 et se retrouve à 14:37 après
 * redémarrage ». `demo.ts` garde ses événements dans un tableau en mémoire —
 * un rechargement les efface. Le seul redémarrage vérifiable sans piloter la
 * base réelle d'Antonin est celui-ci : une base SQLite neuve, montée par les
 * VRAIES migrations (`schema.testutil` les lit dans `src-tauri/migrations/`,
 * il ne les recopie pas), écrite puis relue.
 *
 * Ce que ce fichier ne prouve pas : que l'app INSTALLÉE affiche bien 14:37.
 * Cela se voit à l'écran, et c'est écrit comme tel dans la passation.
 */
describe("ce que la base garde d'un événement", () => {
  it("⭐ rend 14:37 exactement, sans arrondi ni fuseau", () => {
    const db = baseNeuve();
    try {
      db.exec(
        `INSERT INTO calendar_events (title, date, start_at, end_at, all_day, color, recurrence)
         VALUES ('rendez-vous', '2026-09-09', '14:37', '15:37', 0, 'blue', 'none')`,
      );
      const ligne = db
        .prepare("SELECT date, start_at, end_at FROM calendar_events WHERE title = 'rendez-vous'")
        .get() as { date: string; start_at: string; end_at: string };
      // ⚠️ L'égalité de CHAÎNES est le sujet : un stockage en horodatage UTC
      // rendrait « 12:37 » ou « 2026-09-09T14:37:00Z » ici, et l'app afficherait
      // une heure fausse chez tout utilisateur qui n'est pas à Paris en hiver.
      expect(ligne.start_at).toBe("14:37");
      expect(ligne.end_at).toBe("15:37");
      expect(ligne.date).toBe("2026-09-09");
    } finally {
      db.close();
    }
  });

  it("garde la borne de fin d'un séjour, et la laisse nulle sinon", () => {
    const db = baseNeuve();
    try {
      db.exec(
        `INSERT INTO calendar_events (title, date, end_date, all_day, recurrence)
           VALUES ('séjour', '2026-09-04', '2026-09-06', 1, 'none'),
                  ('ponctuel', '2026-09-04', NULL, 1, 'none')`,
      );
      const lignes = db
        .prepare("SELECT title, end_date FROM calendar_events ORDER BY title")
        .all() as { title: string; end_date: string | null }[];
      expect(lignes).toEqual([
        { title: "ponctuel", end_date: null },
        { title: "séjour", end_date: "2026-09-06" },
      ]);
    } finally {
      db.close();
    }
  });

  it("⚠️ n'INTERDIT PAS une borne incohérente — c'est le TypeScript qui la range", () => {
    // Une contrainte `CHECK (end_date >= date)` arrêterait la synchronisation à
    // l'arrivée d'une ligne écrite par une autre version de l'app (PIEGES
    // § 3.4). Le schéma accepte donc la ligne ; `bornesDe()` l'absorbe.
    const db = baseNeuve();
    try {
      expect(() =>
        db.exec(
          `INSERT INTO calendar_events (title, date, end_date, recurrence)
           VALUES ('à l''envers', '2026-09-10', '2026-09-01', 'none')`,
        ),
      ).not.toThrow();
    } finally {
      db.close();
    }
  });

  it("une tâche garde sa date et son créneau", () => {
    const db = baseNeuve();
    try {
      db.exec(
        `INSERT INTO tasks (label, priority, recurrence, created_at, due_date, start_at, end_at)
         VALUES ('appeler le comptable', 'medium', 'none', '2026-09-06 12:00:00',
                 '2026-09-09', '11:45', '12:45')`,
      );
      const t = db
        .prepare("SELECT due_date, start_at, end_at, postponed_count FROM tasks WHERE label LIKE 'appeler%'")
        .get() as { due_date: string; start_at: string; end_at: string; postponed_count: number };
      expect(t).toEqual({
        due_date: "2026-09-09",
        start_at: "11:45",
        end_at: "12:45",
        postponed_count: 0,
      });
    } finally {
      db.close();
    }
  });
});
