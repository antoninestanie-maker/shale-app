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
        heure: null,
        origine: "lue",
        mots: "jeudi",
      });
    });

    it("⭐ pastille retirée : le titre reste ENTIER, et la tâche n'a pas de date", () => {
      const r = m.resoudreSaisie({ ...base, texte: "Lire Vendredi ou la vie sauvage", ecartee: "Vendredi" }, AUJ);
      expect(r).toEqual({ titre: "Lire Vendredi ou la vie sauvage", jour: null, heure: null, origine: null, mots: null });
    });

    it("une AUTRE date tapée après l'écart est proposée de nouveau", () => {
      const r = m.resoudreSaisie({ ...base, texte: "Lire Vendredi ou la vie sauvage demain", ecartee: "Vendredi" }, AUJ);
      expect(r.jour).toBe(l.addDays(AUJ, 1));
      expect(r.titre).toBe("Lire Vendredi ou la vie sauvage");
    });

    it("une date choisie au calendrier l'emporte, et ne touche pas au titre", () => {
      const r = m.resoudreSaisie({ texte: "Relancer le devis jeudi", choisie: "2026-10-20", ecartee: null }, AUJ);
      expect(r).toEqual({ titre: "Relancer le devis jeudi", jour: "2026-10-20", heure: null, origine: "choisie", mots: null });
    });

    it("sans date : rien dans Tâches, aujourd'hui dans la carte d'Aujourd'hui", () => {
      expect(m.resoudreSaisie({ ...base, texte: " Appeler Paul " }, AUJ)).toEqual({
        titre: "Appeler Paul",
        jour: null,
        heure: null,
        origine: null,
        mots: null,
      });
      expect(m.resoudreSaisie({ ...base, texte: "Appeler Paul" }, AUJ, AUJ)).toEqual({
        titre: "Appeler Paul",
        jour: AUJ,
        heure: null,
        origine: "defaut",
        mots: null,
      });
    });

    it("dans Aujourd'hui, une date lue l'emporte sur la date par défaut ; écartée, on y revient", () => {
      expect(m.resoudreSaisie({ ...base, texte: "Appeler Paul demain" }, AUJ, AUJ).jour).toBe(l.addDays(AUJ, 1));
      const r = m.resoudreSaisie({ ...base, texte: "Appeler Paul demain", ecartee: "demain" }, AUJ, AUJ);
      expect(r).toEqual({ titre: "Appeler Paul demain", jour: AUJ, heure: null, origine: "defaut", mots: null });
    });
  });
  /**
   * ⭐ SECONDE PASSE DU LABO (2026-10-12, constat 2). Bruno, un lundi 12 :
   * « Commander le chêne avant jeudi 22 » donnait « Commander le chêne 22 » au
   * jeudi 15 — une semaine trop tôt, sans un mot.
   */
  describe("un jour de la semaine suivi d'un numéro : le numéro fait foi", () => {
    /** Le lundi du crible — vérifié, pas supposé. */
    const LUN = "2026-10-12";
    const JEU22 = "2026-10-22";

    it("les jours de référence : un lundi 12, et le 22 est un jeudi", () => {
      expect(LUN).toBe(l.addDays(AUJ, 1));
      expect(l.weekdayOf(LUN)).toBe(1);
      expect(JEU22).toBe(l.addDays(LUN, 10));
      expect(l.weekdayOf(JEU22)).toBe(4);
    });

    it("⭐ le cas du crible : « Commander le chêne avant jeudi 22 »", () => {
      const lue = m.lireDate("Commander le chêne avant jeudi 22", LUN)!;
      expect(lue.jour).toBe(JEU22);
      expect(lue.titre).toBe("Commander le chêne");
      expect(lue.mots).toBe("avant jeudi 22");
      expect(lue.heure).toBeNull();
    });

    it("« jeudi 22 », « ce jeudi 22 », « jeudi le 22 », « le jeudi 22 octobre », « jeudi 22/10 »", () => {
      for (const mots of ["jeudi 22", "ce jeudi 22", "jeudi le 22", "le jeudi 22", "jeudi 22 octobre", "le jeudi 22 octobre", "jeudi 22/10", "pour jeudi 22", "d'ici jeudi 22", "Jeudi, 22 octobre"]) {
        const lue = m.lireDate(`Commander le chêne ${mots}`, LUN);
        expect(lue?.jour, mots).toBe(JEU22);
        expect(lue?.titre, mots).toBe("Commander le chêne");
      }
    });

    it("⭐ le numéro l'emporte sur le jour, même s'ils se contredisent — et tout le groupe quitte le titre", () => {
      // Le 23 est un vendredi : la pastille écrira « ven. 23 oct. », l'écart se voit.
      const lue = m.lireDate("Voir Paul jeudi 23", LUN)!;
      expect(lue.jour).toBe(l.addDays(JEU22, 1));
      expect(lue.titre).toBe("Voir Paul");
      expect(titre("Voir Paul jeudi 23 octobre", LUN)).toBe("Voir Paul");
      expect(jour("Voir Paul jeudi 23 octobre", LUN)).toBe(l.addDays(JEU22, 1));
      // Le prochain 5 est le mois suivant.
      expect(jour("Voir Paul jeudi 5", LUN)).toBe("2026-11-05");
    });

    it("⚠️ un numéro impossible : on ne lit RIEN, pas même « jeudi »", () => {
      expect(m.lireDate("Commander le chêne avant jeudi 45", LUN)).toBeNull();
      expect(m.lireDate("Commander le chêne jeudi 0", LUN)).toBeNull();
      expect(m.lireDate("Commander le chêne jeudi 30 février", LUN)).toBeNull();
      expect(m.lireDate("Commander le chêne jeudi 32/10", LUN)).toBeNull();
    });

    it("⚠️ un nombre suivi d'un mot est une QUANTITÉ : « jeudi » se lit seul, le nombre reste", () => {
      const jeudi = l.addDays(LUN, 3);
      for (const [phrase, reste] of [
        ["Acheter jeudi 2 baguettes", "Acheter 2 baguettes"],
        ["Courir jeudi 45 minutes", "Courir 45 minutes"],
        ["Courir jeudi 10 km", "Courir 10 km"],
        ["Appeler jeudi 3 clients", "Appeler 3 clients"],
      ]) {
        expect(jour(phrase, LUN), phrase).toBe(jeudi);
        expect(titre(phrase, LUN), phrase).toBe(reste);
      }
    });

    it("suivi d'un mot, le numéro reste une date s'il tombe bien ce jour-là", () => {
      const lue = m.lireDate("Commander le chêne jeudi 22 pour Martin", LUN)!;
      expect(lue.jour).toBe(JEU22);
      expect(lue.titre).toBe("Commander le chêne pour Martin");
    });

    it("la date en tête, suivie de deux points ou d'un tiret", () => {
      expect(m.lireDate("Jeudi 22 : commander le chêne", LUN)).toEqual({
        jour: JEU22,
        heure: null,
        titre: "Commander le chêne",
        mots: "Jeudi 22",
      });
      expect(jour("Jeudi 22 - commander le chêne", LUN)).toBe(JEU22);
      expect(jour("Payer le loyer le 15 : virement")).toBe("2026-10-15");
    });

    it("⚠️ « jeudi 8-10h » est une plage d'heures, pas le 8 du mois", () => {
      const lue = m.lireDate("Réunion jeudi 8-10h", LUN)!;
      expect(lue.jour).toBe(l.addDays(LUN, 3));
      expect(lue.titre).toBe("Réunion 8-10h");
      expect(lue.heure).toBeNull();
    });

    it("⚠️ une phrase qui n'est que la date n'est pas lue", () => {
      expect(m.lireDate("avant jeudi 22", LUN)).toBeNull();
    });

    it("« jeudi 14h30 » : 14 n'est pas un jour du mois", () => {
      expect(jour("Appeler Paul jeudi 14h30", LUN)).toBe(l.addDays(LUN, 3));
      expect(jour("Appeler Paul jeudi 14 h", LUN)).toBe(l.addDays(LUN, 3));
      expect(jour("Appeler Paul jeudi 14:30", LUN)).toBe(l.addDays(LUN, 3));
    });
  });

  describe("les petits mots qui précèdent la date partent avec elle", () => {
    it("pour, avant, d'ici, le, ce", () => {
      for (const phrase of [
        "Envoyer le devis pour vendredi",
        "Envoyer le devis avant vendredi",
        "Envoyer le devis d'ici vendredi",
        "Envoyer le devis d’ici à vendredi",
        "Envoyer le devis le vendredi",
        "Envoyer le devis ce vendredi",
        "Envoyer le devis pour ce vendredi",
        "Envoyer le devis avant le 16",
        "Envoyer le devis pour le 16 octobre",
        "Envoyer le devis d'ici le 16/10",
        "Envoyer le devis avant demain",
      ]) {
        expect(titre(phrase), phrase).toBe("Envoyer le devis");
      }
    });

    it("⚠️ faux amis : sans date collée, « avant », « le », « ce », « pour » restent — le titre est ENTIER", () => {
      for (const phrase of [
        "Payer avant le contrôle",
        "Chapitre 22",
        "Lire le chapitre 22",
        "Lire ce chapitre",
        "Relire le contrat pour Paul",
        "Passer le 22e niveau",
      ]) {
        expect(m.lireDate(phrase, AUJ), phrase).toBeNull();
      }
    });

    it("un vrai jour plus loin ne mange pas le « le » d'un autre mot", () => {
      expect(titre("Lire le chapitre 22 jeudi")).toBe("Lire le chapitre 22");
      expect(titre("Payer avant le contrôle de jeudi")).toBe("Payer avant le contrôle de");
    });

    it("⭐ « Lire Vendredi ou la vie sauvage » : la pastille retirée, le titre reste entier", () => {
      const r = m.resoudreSaisie({ texte: "Lire Vendredi ou la vie sauvage", choisie: null, ecartee: "Vendredi" }, AUJ);
      expect(r.titre).toBe("Lire Vendredi ou la vie sauvage");
      expect(r.jour).toBeNull();
    });
  });

  it("« mercredi prochain » un lundi : le mercredi de la semaine en cours (règle inchangée, la pastille le montre)", () => {
    const lundi = l.addDays(AUJ, 1);
    expect(jour("Appeler Paul mercredi prochain", lundi)).toBe(l.addDays(lundi, 2));
    expect(jour("Appeler Paul mercredi", lundi)).toBe(l.addDays(lundi, 2));
  });

  describe("⭐ l'heure accolée à la date", () => {
    const heure = (phrase: string, parDefaut: string | null = null) => m.lireDate(phrase, AUJ, parDefaut)?.heure ?? null;

    it("le cas du crible : « RDV clinique Saint-Jean jeudi 14h30 »", () => {
      const lue = m.lireDate("RDV clinique Saint-Jean jeudi 14h30", AUJ)!;
      expect(lue.jour).toBe(l.addDays(AUJ, 4));
      expect(lue.heure).toBe("14:30");
      expect(lue.titre).toBe("RDV clinique Saint-Jean");
      expect(lue.mots).toBe("jeudi 14h30");
    });

    it("« 14h », « 14h30 », « 14 h 30 », « 14:30 », « à 14h », « midi », avant ou après la date", () => {
      expect(heure("Appeler Paul demain 14h")).toBe("14:00");
      expect(heure("Appeler Paul demain 14h30")).toBe("14:30");
      expect(heure("Appeler Paul demain 14 h 30")).toBe("14:30");
      expect(heure("Appeler Paul demain 14:30")).toBe("14:30");
      expect(heure("Appeler Paul demain à 9h")).toBe("09:00");
      expect(heure("Appeler Paul demain, à 9h05")).toBe("09:05");
      expect(heure("Déjeuner avec Paul jeudi midi")).toBe("12:00");
      expect(heure("Appeler Paul à 10h demain")).toBe("10:00");
      expect(heure("Appeler Paul 14h30 jeudi")).toBe("14:30");
      // ⚠️ Devant la date et sans « à », « 8h » peut être une durée : pas lue.
      expect(heure("Travailler 8h jeudi")).toBeNull();
      expect(titre("Travailler 8h jeudi")).toBe("Travailler 8h");
      expect(heure("Travailler à 8h jeudi")).toBe("08:00");
      expect(heure("Appeler Paul aujourd'hui 18h")).toBe("18:00");
      expect(heure("Appeler Paul le 15 à 14h")).toBe("14:00");
      for (const phrase of ["Appeler Paul demain à 9h", "Appeler Paul à 9h demain", "Appeler Paul demain, à 9h05"]) {
        expect(titre(phrase), phrase).toBe("Appeler Paul");
      }
    });

    it("« jeudi 22 à 9h » : le numéro, puis l'heure", () => {
      const lue = m.lireDate("Voir le notaire jeudi 22 à 9h", "2026-10-12")!;
      expect(lue.jour).toBe("2026-10-22");
      expect(lue.heure).toBe("09:00");
      expect(lue.titre).toBe("Voir le notaire");
    });

    it("⚠️ « 2h », « 1h30 » sont des DURÉES : pas lues sans « à », et elles restent dans le titre", () => {
      expect(heure("Courir jeudi 1h30")).toBeNull();
      expect(titre("Courir jeudi 1h30")).toBe("Courir 1h30");
      expect(heure("Réviser jeudi 2h")).toBeNull();
      expect(heure("Réviser jeudi à 2h")).toBe("02:00");
      // À partir de 7 h, c'est une heure.
      expect(heure("Réviser jeudi 7h")).toBe("07:00");
    });

    it("⚠️ une heure impossible n'est pas une heure : elle reste dans le titre", () => {
      expect(heure("Appeler Paul jeudi 25h")).toBeNull();
      expect(titre("Appeler Paul jeudi 25h")).toBe("Appeler Paul 25h");
      expect(heure("Appeler Paul jeudi 14h75")).toBeNull();
    });

    it("⚠️ une heure qui appartient à un NOM reste dans le titre : « le train de 14h30 », « le 20h »", () => {
      expect(heure("Prendre le train de 14h30 jeudi")).toBeNull();
      expect(titre("Prendre le train de 14h30 jeudi")).toBe("Prendre le train de 14h30");
      expect(heure("Regarder le 20h demain")).toBeNull();
      expect(titre("Regarder le 20h demain")).toBe("Regarder le 20h");
      expect(heure("Préparer la réunion de 14h pour jeudi")).toBeNull();
      // Et une heure LOIN de la date n'est pas lue non plus.
      expect(heure("Appeler Paul à 14h pour le devis de jeudi")).toBeNull();
    });

    it("⚠️ sans date, une heure n'est pas lue : un créneau sans jour ne se pose nulle part", () => {
      expect(m.lireDate("Appeler Paul à 14h", AUJ)).toBeNull();
      expect(m.lireDate("Appeler Paul 14h30", AUJ)).toBeNull();
    });

    it("⭐ sur la carte d'Aujourd'hui (date d'office) : « à 14h » se pose sur ce jour", () => {
      const lue = m.lireDate("Appeler Paul à 14h", AUJ, AUJ)!;
      expect(lue).toEqual({ jour: AUJ, heure: "14:00", titre: "Appeler Paul", mots: "à 14h" });
      expect(titre("Appeler Paul à 14h30 pour le devis")).toBeNull();
      expect(m.lireDate("Appeler Paul à 14h30 pour le devis", AUJ, AUJ)?.titre).toBe("Appeler Paul pour le devis");
      // ⚠️ Sans préposition, ce n'est pas une heure de rendez-vous.
      expect(m.lireDate("Regarder le 20h", AUJ, AUJ)).toBeNull();
      expect(m.lireDate("Prendre le train de 14h30", AUJ, AUJ)).toBeNull();
      expect(m.lireDate("Appeler Paul 14h30", AUJ, AUJ)).toBeNull();
      // Et jamais à côté d'une date qu'on n'a pas su lire.
      expect(m.lireDate("Clôturer le 30 février à 14h", AUJ, AUJ)).toBeNull();
    });

    it("resoudreSaisie porte l'heure ; la pastille retirée, date ET heure restent dans le titre", () => {
      const base = { choisie: null, ecartee: null };
      expect(m.resoudreSaisie({ ...base, texte: "RDV clinique jeudi 14h30" }, AUJ)).toEqual({
        titre: "RDV clinique",
        jour: l.addDays(AUJ, 4),
        heure: "14:30",
        origine: "lue",
        mots: "jeudi 14h30",
      });
      const r = m.resoudreSaisie({ ...base, texte: "RDV clinique jeudi 14h30", ecartee: "jeudi 14h30" }, AUJ);
      expect(r).toEqual({ titre: "RDV clinique jeudi 14h30", jour: null, heure: null, origine: null, mots: null });
      // Sur Aujourd'hui, l'heure seule est une date LUE (retirable), posée sur le jour d'office.
      expect(m.resoudreSaisie({ ...base, texte: "Appeler Paul à 14h" }, AUJ, AUJ)).toEqual({
        titre: "Appeler Paul",
        jour: AUJ,
        heure: "14:00",
        origine: "lue",
        mots: "à 14h",
      });
    });

    it("⭐ planificationRapide : un créneau d'UNE heure, plafonné à 23:59, jamais sans jour", () => {
      expect(m.planificationRapide("2026-10-15", "14:30")).toEqual({ due_date: "2026-10-15", start_at: "14:30", end_at: "15:30" });
      expect(m.planificationRapide("2026-10-15", "23:30")).toEqual({ due_date: "2026-10-15", start_at: "23:30", end_at: "23:59" });
      expect(m.planificationRapide("2026-10-15", null)).toEqual({ due_date: "2026-10-15", start_at: null, end_at: null });
      expect(m.planificationRapide(null, "14:30")).toEqual({ due_date: null, start_at: null, end_at: null });
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
    expect(r).toEqual({ titre: "Read Friday Night Lights", jour: null, heure: null, origine: null, mots: null });
  });
  describe("a weekday followed by a number: the number wins", () => {
    const LUN = "2026-10-12";
    const JEU22 = "2026-10-22";

    it("⭐ « Order the oak before thursday 22 », un lundi 12", () => {
      expect(l.weekdayOf(LUN)).toBe(1);
      expect(l.weekdayOf(JEU22)).toBe(4);
      const lue = m.lireDate("Order the oak before thursday 22", LUN)!;
      expect(lue.jour).toBe(JEU22);
      expect(lue.titre).toBe("Order the oak");
      expect(lue.mots).toBe("before thursday 22");
    });

    it("thursday 22, thursday 22nd, thursday the 22nd, Thursday, October 22, Thursday 22 October, thursday 10/22", () => {
      for (const mots of ["thursday 22", "Thursday 22nd", "thursday the 22nd", "Thursday, October 22", "Thursday, Oct 22nd", "Thursday 22 October", "thursday 10/22", "by Thursday the 22nd", "on Thursday, October 22", "this thursday 22"]) {
        const lue = m.lireDate(`Order the oak ${mots}`, LUN);
        expect(lue?.jour, mots).toBe(JEU22);
        expect(lue?.titre, mots).toBe("Order the oak");
      }
    });

    it("the date first, then a colon", () => {
      expect(titre("Thursday 22: order the oak", LUN)).toBe("Order the oak");
      expect(jour("Thursday 22: order the oak", LUN)).toBe(JEU22);
    });

    it("le numéro l'emporte ; impossible, on ne lit rien", () => {
      expect(jour("See Paul thursday 23", LUN)).toBe(l.addDays(JEU22, 1));
      expect(titre("See Paul Thursday, October 23", LUN)).toBe("See Paul");
      expect(m.lireDate("Order the oak before thursday 45", LUN)).toBeNull();
      expect(m.lireDate("Order the oak thursday February 30", LUN)).toBeNull();
    });

    it("⚠️ une quantité reste dans le titre : « Buy thursday 2 loaves »", () => {
      expect(jour("Buy thursday 2 loaves", LUN)).toBe(l.addDays(LUN, 3));
      expect(titre("Buy thursday 2 loaves", LUN)).toBe("Buy 2 loaves");
      expect(titre("Run thursday 45 minutes", LUN)).toBe("Run 45 minutes");
    });

    it("« next wednesday » un lundi : le mercredi de la semaine en cours (règle inchangée)", () => {
      expect(jour("Call Paul next wednesday", LUN)).toBe(l.addDays(LUN, 2));
    });
  });

  describe("the small words before the date leave with it", () => {
    it("on, by, before, for, this, next, the", () => {
      for (const phrase of [
        "Send the quote on Friday",
        "Send the quote by Friday",
        "Send the quote before Friday",
        "Send the quote for Friday",
        "Send the quote this Friday",
        "Send the quote by this Friday",
        "Send the quote before the 16th",
        "Send the quote by October 16",
        "Send the quote before tomorrow",
      ]) {
        expect(titre(phrase), phrase).toBe("Send the quote");
      }
    });

    it("⚠️ faux amis : le titre reste ENTIER", () => {
      for (const phrase of ["Pay before the audit", "Chapter 22", "Read this chapter", "Wait for the plumber", "Finish this 2nd draft"]) {
        expect(m.lireDate(phrase, AUJ), phrase).toBeNull();
      }
    });
  });

  describe("⭐ the time next to the date", () => {
    const heure = (phrase: string, parDefaut: string | null = null) => m.lireDate(phrase, AUJ, parDefaut)?.heure ?? null;

    it("« Dentist thursday 2:30pm »", () => {
      const lue = m.lireDate("Dentist thursday 2:30pm", AUJ)!;
      expect(lue.jour).toBe(l.addDays(AUJ, 4));
      expect(lue.heure).toBe("14:30");
      expect(lue.titre).toBe("Dentist");
    });

    it("2pm, 2 pm, 2:30pm, 2:30 p.m., at 2pm, 14:30, noon, 12am, 12pm — avant ou après la date", () => {
      expect(heure("Dentist thursday 2pm")).toBe("14:00");
      expect(heure("Dentist thursday 2 pm")).toBe("14:00");
      expect(heure("Dentist thursday 2:30 p.m.")).toBe("14:30");
      expect(heure("Dentist thursday at 2pm")).toBe("14:00");
      expect(heure("Dentist tomorrow 10am")).toBe("10:00");
      expect(heure("Dentist thursday 14:30")).toBe("14:30");
      expect(heure("Lunch thursday noon")).toBe("12:00");
      expect(heure("Lunch thursday at noon")).toBe("12:00");
      expect(heure("Launch thursday 12am")).toBe("00:00");
      expect(heure("Launch thursday 12pm")).toBe("12:00");
      expect(heure("Dentist at 9am tomorrow")).toBe("09:00");
      expect(heure("Dentist Thursday, October 22 at 9am")).toBe("09:00");
      expect(titre("Dentist thursday at 2pm")).toBe("Dentist");
      expect(titre("Dentist at 9am tomorrow")).toBe("Dentist");
    });

    it("⚠️ « thursday 2pm » : 2 n'est pas le 2 du mois", () => {
      expect(jour("Dentist thursday 2pm")).toBe(l.addDays(AUJ, 4));
      expect(jour("Dentist thursday 2 pm")).toBe(l.addDays(AUJ, 4));
    });

    it("⚠️ « at 2:30 » sans am ni pm : matin ou après-midi ? on ne devine pas", () => {
      expect(heure("Dentist thursday at 2:30")).toBeNull();
      expect(titre("Dentist thursday at 2:30")).toBe("Dentist at 2:30");
      expect(heure("Dentist thursday 13pm")).toBeNull();
      expect(heure("Dentist thursday 25:00")).toBeNull();
    });

    it("sans date : pas lue ; sur Today (date d'office), « at 2pm » se pose sur ce jour", () => {
      expect(m.lireDate("Call Paul at 2pm", AUJ)).toBeNull();
      expect(m.lireDate("Call Paul at 2pm", AUJ, AUJ)).toEqual({ jour: AUJ, heure: "14:00", titre: "Call Paul", mots: "at 2pm" });
      expect(m.lireDate("Watch the 6pm news", AUJ, AUJ)).toBeNull();
    });

    it("⚠️ une heure qui appartient à un nom reste dans le titre : « the 6pm train »", () => {
      expect(heure("Catch the 6pm tomorrow")).toBeNull();
      expect(titre("Catch the 6pm tomorrow")).toBe("Catch the 6pm");
      expect(heure("Call Paul 6pm tomorrow")).toBe("18:00");
    });
  });
});
