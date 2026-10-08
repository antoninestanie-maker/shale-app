import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { estAdmin, vueReserveeAdmin } from "./admin";
import { ADMIN_EMAILS, AUTH_CONFIGURED } from "./config";

/**
 * La page Admin n'existe que pour le compte d'Antonin (2026-10-07).
 * `App.tsx` et les deux barres sont LUS comme du texte : les importer tirerait
 * React, la base et Tauri dans un test pur.
 */

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("estAdmin", () => {
  it("le binaire distribué a l'auth configurée, et un seul compte admin", () => {
    expect(AUTH_CONFIGURED).toBe(true);
    expect(ADMIN_EMAILS).toEqual(["antonin.estanie@icloud.com"]);
  });

  it("le compte d'Antonin, quelle que soit la casse", () => {
    expect(estAdmin("antonin.estanie@icloud.com")).toBe(true);
    expect(estAdmin(" Antonin.Estanie@iCloud.com ")).toBe(true);
  });

  it("personne d'autre : autre compte, adresse voisine, pas de session", () => {
    expect(estAdmin("quelquun@gmail.com")).toBe(false);
    expect(estAdmin("antonin.estanie@icloud.com.exemple.fr")).toBe(false);
    expect(estAdmin("x-antonin.estanie@icloud.com")).toBe(false);
    expect(estAdmin("")).toBe(false);
    expect(estAdmin(null)).toBe(false);
    expect(estAdmin(undefined)).toBe(false);
  });

  it("sans auth configurée (preview navigateur), la page reste relisible", () => {
    expect(estAdmin(null, false)).toBe(true);
  });
});

describe("la page Admin est fermée par tous ses chemins", () => {
  it("seule la Console est réservée", () => {
    expect(vueReserveeAdmin("console")).toBe(true);
    for (const v of ["today", "tasks", "admin", "settings", "corbeille"])
      expect(vueReserveeAdmin(v)).toBe(false);
  });

  it("App.tsx : navigation, filet de repli et rendu", () => {
    const app = lire("src/App.tsx");
    expect(app).toContain("if (vueReserveeAdmin(v) && !isAdmin) return;");
    expect(app).toContain('if (vueReserveeAdmin(view) && !isAdmin) setView("today");');
    expect(app).toContain('view === "console" && isAdmin ? (');
    expect(app).not.toMatch(/view === "console" \? \(/);
  });

  it("les deux barres filtrent l'entrée sur isAdmin", () => {
    expect(lire("src/components/Sidebar.tsx")).toMatch(/id: "console",\s+label: "Admin",\s+adminSeul: true/);
    for (const f of ["src/components/Sidebar.tsx", "src/components/MobileNav.tsx"])
      expect(lire(f)).toContain("ITEMS_PIED.filter((it) => (isAdmin || !it.adminSeul)");
  });

  it("aucune action de la palette ne mène à la Console", () => {
    expect(lire("src/lib/actions.ts")).not.toMatch(/["']console["']/);
  });
});
