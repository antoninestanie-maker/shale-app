import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sauvegarde quotidienne — la « journée » du verrou doit être la journée LOCALE.
 *
 * `sauvegardeQuotidienne()` ne fait qu'une chose : comparer le jour courant à
 * celui de la dernière copie, et s'arrêter s'ils sont égaux. Tout tient donc
 * dans la définition de « jour ». En UTC, deux jours locaux distincts peuvent
 * porter la MÊME date — et la seconde sauvegarde est alors sautée en silence.
 * Le défaut est invisible à Paris hors de la tranche 00 h–02 h ; il devient
 * quotidien à Auckland. D'où les deux fuseaux testés ici.
 *
 * ⚠️ `process.env.TZ` est relu par Node à chaque création de `Date` : le poser
 * en cours de test suffit, mais il faut le RENDRE en sortant, sinon les autres
 * fichiers de la suite héritent du fuseau néo-zélandais.
 */

const reglages = new Map<string, string>();
let copies = 0;

vi.mock("./repo", () => ({
  isTauri: true,
  getSetting: async (cle: string) => reglages.get(cle) ?? null,
  setSetting: async (cle: string, valeur: string) => {
    reglages.set(cle, valeur);
  },
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: async () => {
    copies += 1;
    return `copie-${copies}.db`;
  },
}));

const TZ_ORIGINE = process.env.TZ;

/** Un lancement de l'app : fuseau de l'utilisateur, instant absolu, appel. */
async function lancement(tz: string, instantUTC: string) {
  process.env.TZ = tz;
  vi.setSystemTime(new Date(instantUTC));
  const { sauvegardeQuotidienne } = await import("./sauvegardes");
  await sauvegardeQuotidienne();
}

beforeEach(() => {
  reglages.clear();
  copies = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  process.env.TZ = TZ_ORIGINE;
});

afterAll(() => {
  process.env.TZ = TZ_ORIGINE;
});

describe("sauvegarde quotidienne — le jour est celui de l'utilisateur", () => {
  it("copie deux fois quand deux jours LOCAUX tombent dans le même jour UTC", async () => {
    // Auckland, UTC+12 en septembre. Les deux instants sont le 5 septembre en
    // UTC ; localement ce sont le 5 au soir et le 6 au matin.
    await lancement("Pacific/Auckland", "2026-09-05T09:00:00Z"); // 5 sept, 21 h
    await lancement("Pacific/Auckland", "2026-09-05T23:00:00Z"); // 6 sept, 11 h
    expect(copies).toBe(2);
  });

  it("ne copie qu'une fois quand un même jour LOCAL couvre deux jours UTC", async () => {
    // Toujours Auckland : le 6 septembre local commence le 5 à 12 h UTC et
    // finit le 6 à 12 h UTC. Le verrou doit tenir d'un bout à l'autre.
    await lancement("Pacific/Auckland", "2026-09-05T23:00:00Z"); // 6 sept, 11 h
    await lancement("Pacific/Auckland", "2026-09-06T06:00:00Z"); // 6 sept, 18 h
    expect(copies).toBe(1);
  });

  it("tient la tranche 00 h–02 h à Paris, où l'UTC est encore la veille", async () => {
    await lancement("Europe/Paris", "2026-09-04T22:30:00Z"); // 5 sept, 00 h 30
    await lancement("Europe/Paris", "2026-09-05T10:00:00Z"); // 5 sept, 12 h
    expect(copies).toBe(1);
    expect(reglages.get("backup.last_at")).toBe("2026-09-05");
  });
});
