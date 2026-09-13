// ─────────────────────────────────────────────────────────────────────────────
// Concordance : l'outil d'émission et l'app signent les MÊMES octets.
//
// `tools/licence-profil.mjs` recopie `messageSigne()` (il tourne sous Node, hors
// du bundle). Ce test l'EXÉCUTE pour de vrai, avec une clé jetable, et vérifie
// sa sortie avec le code de l'app. Si l'un des deux change seul, chaque profil
// émis serait refusé par l'app — en silence, puisque la dégradation l'est.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { COMPTE } from "./licence.testutil";
import { resoudreProfil } from "./resoudre";
import { signatureValide, type ClePubliqueJwk, type LigneProfil } from "./signature";

const OUTIL = resolve(__dirname, "../../../tools/licence-profil.mjs");
const dossier = mkdtempSync(join(tmpdir(), "licence-"));
afterAll(() => rmSync(dossier, { recursive: true, force: true }));

const outil = (...args: string[]) =>
  execFileSync(process.execPath, [OUTIL, ...args], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });

describe("tools/licence-profil.mjs", () => {
  it("émet un profil que l'app vérifie et applique", () => {
    const publique = JSON.parse(outil("cles", join(dossier, "cles"))) as ClePubliqueJwk;
    const payload = join(dossier, "payload.json");
    writeFileSync(
      payload,
      JSON.stringify({ modules: { hidden: ["trading"] }, labels: { "Tâches": "Missions d'audit" } }, null, 2),
    );
    const ligne = JSON.parse(
      outil(
        "emettre",
        "--cle", join(dossier, "cles", "cle-privee.jwk"),
        "--compte", COMPTE,
        "--palier", "shale_trade",
        "--version", "3",
        "--expire", "2099-12-31",
        "--payload", payload,
        "--json",
      ),
    ) as LigneProfil;

    return signatureValide(ligne, [publique]).then((ok) => {
      expect(ok).toBe(true);
      const p = resoudreProfil({
        ligne,
        signatureOk: ok,
        userId: COMPTE,
        tier: "shale_trade",
        maintenant: Date.now(),
      });
      expect(p).toMatchObject({ actif: true, version: 3 });
      expect(p.libelles["Tâches"]).toBe("Missions d'audit");
    });
  });

  it("le SQL produit échappe le payload (apostrophes comprises)", () => {
    const sql = outil(
      "emettre",
      "--cle", join(dossier, "cles", "cle-privee.jwk"),
      "--compte", COMPTE,
      "--palier", "shale",
      "--version", "1",
      "--expire", "2099-12-31",
      "--payload", join(dossier, "payload.json"),
    );
    expect(sql).toContain("insert into public.license_profiles");
    expect(sql).toContain("on conflict (user_id) do update");
    expect(sql).toMatch(/\$p\$\{[\s\S]*Missions d'audit[\s\S]*\}\$p\$/);
  });

  it("refuse d'écraser une clé existante, et les paramètres invalides", () => {
    expect(() => outil("cles", join(dossier, "cles"))).toThrow();
    expect(readFileSync(join(dossier, "cles", "cle-privee.jwk"), "utf-8")).toContain('"d"');
    expect(() =>
      outil("emettre", "--cle", join(dossier, "cles", "cle-privee.jwk"), "--compte", COMPTE,
        "--palier", "shale_business", "--version", "1", "--expire", "2099-12-31",
        "--payload", join(dossier, "payload.json")),
    ).toThrow();
  });
});
