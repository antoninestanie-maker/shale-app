import { beforeAll, describe, expect, it, vi } from "vitest";

type Module = typeof import("./saisieRapide");
type Logic = typeof import("../logic");

/**
 * La lecture d'une date dans la phrase d'ajout rapide (2026-10-11).
 *
 * ⚠️ Le MÊME module, rejoué sous les deux langues : le vocabulaire, les noms de
 * jours et de mois et l'ORDRE jour/mois changent avec la langue de l'app. La
 * langue se fixe à l'import du module d'i18n (PIEGES § 14.2) : on pose le
 * navigateur AVANT d'importer, une fois par langue.
 */
async function sous(langue: "fr-FR" | "en-US"): Promise<{ m: Module; l: Logic }> {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: langue, languages: [langue] });
  return { m: await import("./saisieRapide"), l: await import("../logic") };
}

/** Un dimanche — vérifié dans le premier test, pas supposé. */
const AUJ = "2026-10-11";

describe("en français", () => {
  let m: Module;
  let l: Logic;
  beforeAll(async () => {
    ({ m, l } = await sous("fr-FR"));
  });
  const jour = (phrase: string, auj = AUJ) => m.lireDate(phrase, auj)?.jour ?? null;
  const titre = (phrase: string, auj = AUJ) => m.lireDate(phrase, auj)?.titre ?? null;

  it("le jour de référence est bien un dimanche", () => {
    expect(l.weekdayOf(AUJ)).toBe(0);
  });

  it("⭐ le cas du crible : « Relancer le devis jeudi »", () => {
    const lue = m.lireDate("Relancer le devis jeudi", AUJ)!;
    expect(lue.jour).toBe(l.addDays(AUJ, 4));
    expect(l.weekdayOf(lue.jour)).toBe(4);
    expect(lue.titre).toBe("Relancer le devis");
    expect(lue.mots).toBe("jeudi");
  });

  it("aujourd'hui, ce soir, demain, après-demain", () => {
    expect(jour("Appeler Paul aujourd'hui")).toBe(AUJ);
    expect(jour("Appeler Paul aujourd’hui")).toBe(AUJ); // apostrophe typographique
    expect(jour("Appeler Paul ce soir")).toBe(AUJ);
    expect(jour("Appeler Paul demain")).toBe(l.addDays(AUJ, 1));
    expect(jour("Appeler Paul après-demain")).toBe(l.addDays(AUJ, 2));
    expect(jour("Appeler Paul apres demain")).toBe(l.addDays(AUJ, 2));
    expect(titre("Appeler Paul après-demain")).toBe("Appeler Paul");
  });

  it("« demain » n'est pas dans « lendemain », ni « mardi » dans « Mardigras »", () => {
    expect(m.lireDate("Préparer le lendemain", AUJ)).toBeNull();
    expect(m.lireDate("Commander pour Mardigras", AUJ)).toBeNull();
  });

  it("un jour de la semaine, avec ou sans « prochain », « ce », « pour », « avant »", () => {
    const lundi = l.addDays(AUJ, 1);
    expect(jour("Envoyer la facture lundi")).toBe(lundi);
    expect(jour("Envoyer la facture lundi prochain")).toBe(lundi);
    expect(jour("Envoyer la facture ce lundi")).toBe(lundi);
    expect(titre("Envoyer la facture pour lundi")).toBe("Envoyer la facture");
    expect(titre("Rendre le dossier avant vendredi")).toBe("Rendre le dossier");
    expect(jour("Rendre le dossier avant vendredi")).toBe(l.addDays(AUJ, 5));
    expect(titre("Envoyer la facture lundi prochain")).toBe("Envoyer la facture");
  });

  it("⭐ un jour de la semaine désigne sa PROCHAINE occurrence — jamais aujourd'hui", () => {
    // Un dimanche, « dimanche » est dans sept jours.
    expect(jour("Ranger le bureau dimanche")).toBe(l.addDays(AUJ, 7));
    // Et un jeudi, « jeudi » aussi.
    const unJeudi = l.addDays(AUJ, 4);
    expect(jour("Relancer le devis jeudi", unJeudi)).toBe(l.addDays(unJeudi, 7));
  });

  it("la majuscule et l'accent ne changent rien", () => {
    expect(jour("Relancer le devis JEUDI")).toBe(l.addDays(AUJ, 4));
    expect(jour("Appeler Paul Après-Demain")).toBe(l.addDays(AUJ, 2));
  });

  it("« dans 3 jours », « dans une semaine », « dans quinze jours »", () => {
    expect(jour("Relancer dans 3 jours")).toBe(l.addDays(AUJ, 3));
    expect(jour("Relancer dans une semaine")).toBe(l.addDays(AUJ, 7));
    expect(jour("Relancer dans 2 semaines")).toBe(l.addDays(AUJ, 14));
    expect(jour("Relancer dans quinze jours")).toBe(l.addDays(AUJ, 15));
    expect(titre("Relancer dans 3 jours")).toBe("Relancer");
  });

  it("⭐ une date en chiffres : le JOUR d'abord", () => {
    expect(jour("Payer l'URSSAF 15/10")).toBe("2026-10-15");
    expect(jour("Payer l'URSSAF le 15/10")).toBe("2026-10-15");
    expect(titre("Payer l'URSSAF le 15/10")).toBe("Payer l'URSSAF");
    expect(jour("Payer l'URSSAF 15/10/2027")).toBe("2027-10-15");
    // Un mois 15 n'existe pas : on ne devine pas l'ordre inverse.
    expect(m.lireDate("Payer l'URSSAF 10/15", AUJ)).toBeNull();
  });

  it("une date en chiffres déjà passée cette année tombe l'an prochain", () => {
    expect(jour("Déclarer la TVA 15/01")).toBe("2027-01-15");
    // Aujourd'hui même reste aujourd'hui.
    expect(jour("Déclarer la TVA 11/10")).toBe(AUJ);
    // Une année écrite se respecte, même passée.
    expect(jour("Retrouver la facture du 15/01/2026")).toBe("2026-01-15");
  });

  it("seule la barre oblique fait une date en chiffres", () => {
    expect(m.lireDate("Lire les pages 10-15", AUJ)).toBeNull();
    expect(m.lireDate("Installer la version 1.2", AUJ)).toBeNull();
  });

  it("« le 15 » : le prochain 15, aujourd'hui compris", () => {
    expect(jour("Payer le loyer le 15")).toBe("2026-10-15");
    expect(jour("Payer le loyer le 11")).toBe(AUJ);
    expect(jour("Payer le loyer le 5")).toBe("2026-11-05");
    expect(jour("Payer le loyer le 1er")).toBe("2026-11-01");
    expect(titre("Payer le loyer le 15")).toBe("Payer le loyer");
    // Le 31 n'existe pas en novembre : le prochain 31 est en décembre.
    expect(jour("Clôturer le 31", "2026-11-02")).toBe("2026-12-31");
  });

  it("⚠️ « le 20 heures », « le 2e », « le 15 % » ne sont pas des dates ; un nombre nu non plus", () => {
    expect(m.lireDate("Regarder le 20 heures", AUJ)).toBeNull();
    expect(m.lireDate("Regarder le 20h", AUJ)).toBeNull();
    expect(m.lireDate("Relire le 2e chapitre", AUJ)).toBeNull();
    expect(m.lireDate("Vérifier le 15 % de remise", AUJ)).toBeNull();
    expect(m.lireDate("Lire 15 pages", AUJ)).toBeNull();
    expect(m.lireDate("Acheter 3 cahiers", AUJ)).toBeNull();
  });

  it("un jour et un mois en toutes lettres — le nom vient d'Intl", () => {
    expect(jour("Envoyer les vœux le 15 novembre")).toBe("2026-11-15");
    expect(titre("Envoyer les vœux le 15 novembre")).toBe("Envoyer les vœux");
    expect(jour("Envoyer les vœux 3 janvier")).toBe("2027-01-03");
    expect(jour("Envoyer les vœux 1er février 2028")).toBe("2028-02-01");
    expect(jour("Rendre le mémoire le 15 déc.")).toBe("2026-12-15");
    expect(jour("Fêter le 14 août")).toBe("2027-08-14");
  });

  it("⚠️ un jour qui n'existe pas n'est pas lu — il ne roule pas", () => {
    expect(m.lireDate("Clôturer 31/02", AUJ)).toBeNull();
    expect(m.lireDate("Clôturer le 30 février", AUJ)).toBeNull();
    expect(m.lireDate("Clôturer le 45", AUJ)).toBeNull();
  });

  it("⭐ plusieurs dates : la DERNIÈRE de la phrase l'emporte", () => {
    const lue = m.lireDate("Préparer la réunion de lundi demain", AUJ)!;
    expect(lue.jour).toBe(l.addDays(AUJ, 1));
    expect(lue.titre).toBe("Préparer la réunion de lundi");
    // Un titre de livre suivi d'une vraie date reste entier.
    expect(titre("Lire Vendredi ou la vie sauvage demain")).toBe("Lire Vendredi ou la vie sauvage");
  });

  it("« jeudi 15/10 » : les chiffres font foi, et le jour part avec eux", () => {
    const lue = m.lireDate("Appeler Paul jeudi 15/10", AUJ)!;
    expect(lue.jour).toBe("2026-10-15");
    expect(lue.titre).toBe("Appeler Paul");
  });

  it("la date en tête, au milieu, entre parenthèses, après une virgule", () => {
    expect(titre("Jeudi : relancer le devis")).toBe("Relancer le devis");
    expect(titre("demain appeler Paul")).toBe("Appeler Paul");
    expect(titre("Appeler Paul demain, puis Marie")).toBe("Appeler Paul, puis Marie");
    expect(titre("Relancer le devis (jeudi)")).toBe("Relancer le devis");
    expect(titre("Relancer le devis, jeudi")).toBe("Relancer le devis");
    // ⚠️ Le reste du titre n'est pas retouché : l'espace avant « : » reste.
    expect(titre("Paul : relancer le devis jeudi")).toBe("Paul : relancer le devis");
  });

  it("⚠️ une phrase qui n'est QUE une date n'est pas lue : il n'y aurait plus de titre", () => {
    expect(m.lireDate("demain", AUJ)).toBeNull();
    expect(m.lireDate("  Jeudi prochain ", AUJ)).toBeNull();
  });

  it("⚠️ le français ne lit pas l'anglais : « Black Friday » reste un titre", () => {
    expect(m.lireDate("Préparer le Black Friday", AUJ)).toBeNull();
    expect(m.lireDate("Call Paul tomorrow", AUJ)).toBeNull();
  });

  it("rien à lire : null, et une phrase vide aussi", () => {
    expect(m.lireDate("Relancer le devis Lebrun", AUJ)).toBeNull();
    expect(m.lireDate("", AUJ)).toBeNull();
    expect(m.lireDate("   ", AUJ)).toBeNull();
  });

  describe("resoudreSaisie — ce que la ligne va créer", () => {
    const base = { choisie: null, ecartee: null };

    it("la date lue quitte le titre", () => {
      expect(m.resoudreSaisie({ ...base, texte: "Relancer le devis jeudi" }, AUJ)).toEqual({
        titre: "Relancer le devis",
        jour: l.addDays(AUJ, 4),
        origine: "lue",
        mots: "jeudi",
      });
    });

    it("⭐ pastille retirée : le titre reste ENTIER, et la tâche n'a pas de date", () => {
      const r = m.resoudreSaisie({ ...base, texte: "Lire Vendredi ou la vie sauvage", ecartee: "Vendredi" }, AUJ);
      expect(r).toEqual({ titre: "Lire Vendredi ou la vie sauvage", jour: null, origine: null, mots: null });
    });

    it("une AUTRE date tapée après l'écart est proposée de nouveau", () => {
      const r = m.resoudreSaisie({ ...base, texte: "Lire Vendredi ou la vie sauvage demain", ecartee: "Vendredi" }, AUJ);
      expect(r.jour).toBe(l.addDays(AUJ, 1));
      expect(r.titre).toBe("Lire Vendredi ou la vie sauvage");
    });

    it("une date choisie au calendrier l'emporte, et ne touche pas au titre", () => {
      const r = m.resoudreSaisie({ texte: "Relancer le devis jeudi", choisie: "2026-10-20", ecartee: null }, AUJ);
      expect(r).toEqual({ titre: "Relancer le devis jeudi", jour: "2026-10-20", origine: "choisie", mots: null });
    });

    it("sans date : rien dans Tâches, aujourd'hui dans la carte d'Aujourd'hui", () => {
      expect(m.resoudreSaisie({ ...base, texte: " Appeler Paul " }, AUJ)).toEqual({
        titre: "Appeler Paul",
        jour: null,
        origine: null,
        mots: null,
      });
      expect(m.resoudreSaisie({ ...base, texte: "Appeler Paul" }, AUJ, AUJ)).toEqual({
        titre: "Appeler Paul",
        jour: AUJ,
        origine: "defaut",
        mots: null,
      });
    });

    it("dans Aujourd'hui, une date lue l'emporte sur la date par défaut ; écartée, on y revient", () => {
      expect(m.resoudreSaisie({ ...base, texte: "Appeler Paul demain" }, AUJ, AUJ).jour).toBe(l.addDays(AUJ, 1));
      const r = m.resoudreSaisie({ ...base, texte: "Appeler Paul demain", ecartee: "demain" }, AUJ, AUJ);
      expect(r).toEqual({ titre: "Appeler Paul demain", jour: AUJ, origine: "defaut", mots: null });
    });
  });
});

describe("in English", () => {
  let m: Module;
  let l: Logic;
  beforeAll(async () => {
    ({ m, l } = await sous("en-US"));
  });
  const jour = (phrase: string, auj = AUJ) => m.lireDate(phrase, auj)?.jour ?? null;
  const titre = (phrase: string, auj = AUJ) => m.lireDate(phrase, auj)?.titre ?? null;

  it("⭐ le cas du crible : « Call Paul next thursday »", () => {
    const lue = m.lireDate("Call Paul next thursday", AUJ)!;
    expect(lue.jour).toBe(l.addDays(AUJ, 4));
    expect(l.weekdayOf(lue.jour)).toBe(4);
    expect(lue.titre).toBe("Call Paul");
    expect(lue.mots).toBe("next thursday");
  });

  it("today, tonight, tomorrow, the day after tomorrow", () => {
    expect(jour("Call Paul today")).toBe(AUJ);
    expect(jour("Call Paul tonight")).toBe(AUJ);
    expect(jour("Call Paul tomorrow")).toBe(l.addDays(AUJ, 1));
    expect(jour("Call Paul the day after tomorrow")).toBe(l.addDays(AUJ, 2));
    expect(titre("Call Paul the day after tomorrow")).toBe("Call Paul");
  });

  it("thursday, on thursday, by thursday, this thursday — the next one, never today", () => {
    const jeudi = l.addDays(AUJ, 4);
    expect(jour("Send the quote Thursday")).toBe(jeudi);
    expect(titre("Send the quote on Thursday")).toBe("Send the quote");
    expect(titre("Send the quote by next Thursday")).toBe("Send the quote");
    expect(jour("Send the quote this thursday")).toBe(jeudi);
    expect(jour("Tidy the desk sunday")).toBe(l.addDays(AUJ, 7));
  });

  it("in 3 days, in a week", () => {
    expect(jour("Follow up in 3 days")).toBe(l.addDays(AUJ, 3));
    expect(jour("Follow up in a week")).toBe(l.addDays(AUJ, 7));
    expect(jour("Follow up in two weeks")).toBe(l.addDays(AUJ, 14));
    expect(titre("Follow up in 3 days")).toBe("Follow up");
  });

  it("⭐ une date en chiffres : le MOIS d'abord", () => {
    expect(jour("Pay taxes 10/15")).toBe("2026-10-15");
    expect(titre("Pay taxes on 10/15")).toBe("Pay taxes");
    expect(jour("Pay taxes 1/15")).toBe("2027-01-15");
    // Un mois 15 n'existe pas : l'ordre français n'est pas deviné.
    expect(m.lireDate("Pay taxes 15/10", AUJ)).toBeNull();
  });

  it("the 15th, October 15, 15 Oct", () => {
    expect(jour("Pay rent on the 15th")).toBe("2026-10-15");
    expect(jour("Pay rent on the 1st")).toBe("2026-11-01");
    expect(jour("Send wishes November 15")).toBe("2026-11-15");
    expect(jour("Send wishes Nov 15, 2027")).toBe("2027-11-15");
    expect(jour("Send wishes 15 Nov")).toBe("2026-11-15");
    expect(titre("Send wishes on the 3rd of January")).toBe("Send wishes");
    expect(jour("Send wishes on the 3rd of January")).toBe("2027-01-03");
  });

  it("⚠️ l'anglais ne lit pas le français, ni un nombre nu, ni « 2nd draft »", () => {
    expect(m.lireDate("Relancer le devis jeudi", AUJ)).toBeNull();
    expect(m.lireDate("Read 15 pages", AUJ)).toBeNull();
    expect(m.lireDate("Finish 2nd draft", AUJ)).toBeNull();
    expect(m.lireDate("Book for tomorrowland", AUJ)).toBeNull();
  });

  it("la pastille retirée laisse le titre entier", () => {
    const r = m.resoudreSaisie({ texte: "Read Friday Night Lights", choisie: null, ecartee: "Friday" }, AUJ);
    expect(r).toEqual({ titre: "Read Friday Night Lights", jour: null, origine: null, mots: null });
  });
});
