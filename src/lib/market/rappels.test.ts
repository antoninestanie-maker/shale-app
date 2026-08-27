import { describe, expect, it } from "vitest";
import { creneauxBriefing } from "./rappels";
import { TRIGGER_HOUR } from "./agent";

/** L'heure de Paris qu'affiche l'appareil à `hour`:`minute` de son heure murale. */
function relueAParis(hour: number, minute: number, jour = new Date()): string {
  const local = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), hour, minute);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(local);
}

describe("créneaux du briefing de marché", () => {
  it("rend un créneau par session, avec des clés stables", () => {
    const c = creneauxBriefing();
    expect(c.map((s) => s.key)).toEqual([
      "market_briefing:pre_london",
      "market_briefing:pre_ny",
    ]);
    expect(new Set(c.map((s) => s.key)).size).toBe(c.length);
  });

  /**
   * LE test du module, et il vaut dans n'importe quel fuseau : on repart de
   * l'heure murale rendue, on la relit à Paris, et on doit retomber sur les
   * heures de déclenchement de Market Brain. Un test qui affirmerait « 8 h et
   * 14 h » ne prouverait rien — il passerait pour une mauvaise raison sur une
   * machine réglée à Paris, qui est justement celle où il tourne.
   */
  it("l'heure murale rendue vaut, relue à Paris, l'heure de déclenchement PILE", () => {
    for (const s of creneauxBriefing()) {
      const session = s.key.split(":")[1] as keyof typeof TRIGGER_HOUR;
      expect(relueAParis(s.hour, s.minute)).toBe(`${String(TRIGGER_HOUR[session]).padStart(2, "0")}:00`);
    }
  });

  /**
   * ⚠️ Les MINUTES, et pas seulement les heures. La première version de ce
   * test n'assertait que l'heure, et laissait donc passer un créneau à 8 h 01 —
   * c'est exactement ce qu'on a fini par lire dans le magasin d'iOS : le
   * décalage était calculé contre un « maintenant » qui portait encore ses
   * secondes, et l'arrondi basculait d'une minute. Une seconde d'horloge n'a
   * rien à faire dans un décalage de fuseau, qui est un multiple de 15 minutes.
   */
  it("ne dérive pas d'une minute selon la seconde à laquelle on l'appelle", () => {
    const jour = new Date();
    const aLaSeconde = (seconde: number, ms: number) =>
      creneauxBriefing(
        new Date(
          jour.getFullYear(),
          jour.getMonth(),
          jour.getDate(),
          jour.getHours(),
          jour.getMinutes(),
          seconde,
          ms,
        ),
      ).map((s) => `${s.hour}:${s.minute}`);

    // Référence à la seconde 0 — et on n'affirme PAS « minute = 0 » : un fuseau
    // décalé d'une demi-heure de Paris (Inde, Népal) donnerait 30 ou 45, ce qui
    // serait juste. Ce qui doit être vrai partout, c'est que la seconde à
    // laquelle on interroge l'horloge ne change RIEN.
    const attendu = aLaSeconde(0, 0);
    for (let seconde = 1; seconde < 60; seconde += 7) {
      expect(aLaSeconde(seconde, 500)).toEqual(attendu);
    }
  });

  it("reste dans les bornes que le Rust accepte", () => {
    for (const s of creneauxBriefing()) {
      expect(s.hour).toBeGreaterThanOrEqual(0);
      expect(s.hour).toBeLessThan(24);
      expect(s.minute).toBeGreaterThanOrEqual(0);
      expect(s.minute).toBeLessThan(60);
      expect(s.title).not.toBe("");
      expect(s.body).not.toBe("");
    }
  });
});
