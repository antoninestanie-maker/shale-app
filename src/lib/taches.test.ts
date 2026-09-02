import { describe, expect, it } from "vitest";

import {
  aUnCreneau,
  demandeUneDecision,
  estDatee,
  estEnRetard,
  estRecurrente,
  replanifier,
  reporter,
  SEUIL_REPORT,
} from "./taches";
import type { Task } from "./types";

/** Socle du 2026-09-02 — les deux familles de tâches, et le report. */

const tache = (p: Partial<Task> = {}): Task => ({
  id: 1,
  label: "écrire",
  tag: null,
  priority: "medium",
  recurrence: "none",
  goal_id: null,
  created_at: "2026-09-01 09:00:00",
  due_date: null,
  start_at: null,
  end_at: null,
  postponed_count: 0,
  postponed_from: null,
  ...p,
});

// ─────────────────────────────────────────────────────────────────────────────

describe("les deux familles ne se mélangent pas", () => {
  it("une tâche datée est datée", () => {
    expect(estDatee(tache({ due_date: "2026-09-05" }))).toBe(true);
    expect(estRecurrente(tache({ due_date: "2026-09-05" }))).toBe(false);
  });

  it("une tâche récurrente n'est jamais « datée », même si une date traîne", () => {
    // La récurrence l'emporte : c'est elle qui décide si l'occurrence se
    // calcule. Une date résiduelle, laissée par une ancienne saisie, ne doit pas
    // faire entrer l'habitude dans le circuit du report.
    const t = tache({ recurrence: "daily", due_date: "2026-09-05" });
    expect(estRecurrente(t)).toBe(true);
    expect(estDatee(t)).toBe(false);
  });

  it("une tâche sans date n'est ni l'un ni l'autre", () => {
    expect(estDatee(tache())).toBe(false);
    expect(estRecurrente(tache())).toBe(false);
  });

  it("distingue un créneau d'un simple jour", () => {
    expect(aUnCreneau(tache({ due_date: "2026-09-05" }))).toBe(false);
    expect(aUnCreneau(tache({ due_date: "2026-09-05", start_at: "14:00" }))).toBe(true);
  });
});

describe("le retard", () => {
  it("une tâche datée d'hier et non cochée est en retard", () => {
    expect(estEnRetard(tache({ due_date: "2026-09-01" }), "2026-09-02", false)).toBe(true);
  });

  it("cochée, elle ne l'est plus", () => {
    expect(estEnRetard(tache({ due_date: "2026-09-01" }), "2026-09-02", true)).toBe(false);
  });

  it("due aujourd'hui, elle n'est pas encore en retard", () => {
    expect(estEnRetard(tache({ due_date: "2026-09-02" }), "2026-09-02", false)).toBe(false);
  });

  it("⚠️ une occurrence d'habitude manquée n'est PAS en retard", () => {
    // Elle est manquée, ce qui n'est pas la même chose. Voir `reporter`.
    expect(estEnRetard(tache({ recurrence: "daily", due_date: "2026-09-01" }), "2026-09-02", false)).toBe(false);
  });
});

describe("le report", () => {
  it("fait glisser une tâche en retard au jour suivant", () => {
    const r = reporter(tache({ due_date: "2026-09-01" }), "2026-09-02", false);
    expect(r).toEqual({ due_date: "2026-09-02", postponed_count: 1, postponed_from: "2026-09-01" });
  });

  it("garde la date d'ORIGINE, pas la précédente", () => {
    // C'est ce qui permet de dire « prévue le 3, repoussée 5 fois » au lieu du
    // seul compteur, qui ne dit pas depuis quand.
    const r = reporter(
      tache({ due_date: "2026-09-04", postponed_count: 1, postponed_from: "2026-09-03" }),
      "2026-09-05",
      false,
    );
    expect(r?.postponed_from).toBe("2026-09-03");
    expect(r?.postponed_count).toBe(2);
  });

  it("⚠️ ne reporte JAMAIS une tâche récurrente", () => {
    // Reporter une habitude quotidienne en ferait deux le lendemain, puis trois
    // le surlendemain : l'app transformerait un jour de repos en dette.
    expect(reporter(tache({ recurrence: "daily", due_date: "2026-09-01" }), "2026-09-02", false)).toBeNull();
  });

  it("ne reporte pas ce qui n'est pas en retard", () => {
    expect(reporter(tache({ due_date: "2026-09-05" }), "2026-09-02", false)).toBeNull();
    expect(reporter(tache({ due_date: "2026-09-01" }), "2026-09-02", true)).toBeNull();
  });

  it("⭐ s'arrête au seuil et rend la main : la décision revient à l'utilisateur", () => {
    const auSeuil = tache({ due_date: "2026-09-01", postponed_count: SEUIL_REPORT, postponed_from: "2026-08-30" });
    expect(demandeUneDecision(auSeuil)).toBe(true);
    expect(reporter(auSeuil, "2026-09-02", false)).toBeNull();
  });

  it("le seuil vaut 2 : deux glissements passent, le troisième demande une décision", () => {
    // Décision d'Antonin, 2026-09-02. Le test la fige pour que personne ne la
    // change par inadvertance en croyant ajuster une constante anodine.
    expect(SEUIL_REPORT).toBe(2);
    expect(demandeUneDecision(tache({ postponed_count: 1 }))).toBe(false);
    expect(demandeUneDecision(tache({ postponed_count: 2 }))).toBe(true);
  });
});

describe("replanifier n'est pas glisser", () => {
  it("remet le compteur à zéro", () => {
    // Une tâche qu'on choisit de déplacer au 12 n'a pas « été repoussée six
    // fois » : elle est prévue le 12. Garder le compteur ferait réapparaître
    // l'avertissement dès le lendemain, et l'app punirait un geste qu'elle
    // vient de demander.
    expect(replanifier("2026-09-12")).toEqual({
      due_date: "2026-09-12",
      postponed_count: 0,
      postponed_from: "2026-09-12",
    });
  });
});
