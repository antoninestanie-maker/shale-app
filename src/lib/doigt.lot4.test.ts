// Lot 4 de l'audit du 20/10 — ce qui ne marchait pas au doigt, au téléphone et
// à la tablette. Les règles pures se testent ici ; ce qui n'est que du JSX se
// tient par la lecture de la source (la suite n'a pas de DOM, voir
// `vitest.config.ts`). La preuve à l'écran est dans WebKit : PASSATION.md.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

import { DUREE_COMMANDES_MS, gesteSurHorloge } from "./timerEcran";
import {
  alertesDeplieesAuTelephone,
  oublierMemoireCalendrier,
  retenirAlertesDepliees,
  retenirVue,
  vueAOuvrir,
} from "./calendrier/memoire";

const lire = (chemin: string) => readFileSync(new URL(chemin, import.meta.url), "utf8");

describe("constat 10 — l'horloge plein écran au doigt", () => {
  it("au doigt, un toucher fait paraître les commandes, un second les efface", () => {
    expect(gesteSurHorloge({ auDoigt: true, double: false, commandesVisibles: false })).toBe("montrer");
    expect(gesteSurHorloge({ auDoigt: true, double: false, commandesVisibles: true })).toBe("cacher");
  });
  it("au doigt, un toucher ne fait plus SORTIR par surprise (c'était le cas sur iOS)", () => {
    for (const commandesVisibles of [true, false]) {
      expect(gesteSurHorloge({ auDoigt: true, double: false, commandesVisibles })).not.toBe("sortir");
      expect(gesteSurHorloge({ auDoigt: true, double: true, commandesVisibles })).not.toBe("sortir");
    }
  });
  it("à la souris, rien ne change : un double-clic sort, un clic ne fait rien", () => {
    expect(gesteSurHorloge({ auDoigt: false, double: true, commandesVisibles: false })).toBe("sortir");
    expect(gesteSurHorloge({ auDoigt: false, double: false, commandesVisibles: false })).toBe(null);
  });
  it("les commandes ne restent que quelques secondes", () => {
    expect(DUREE_COMMANDES_MS).toBeGreaterThanOrEqual(3000);
    expect(DUREE_COMMANDES_MS).toBeLessThanOrEqual(6000);
  });
  it("l'horloge reste épurée au repos (décision du 30/09) et porte Pause + Réduire au doigt", () => {
    const src = lire("../components/timer/EcranTimer.tsx");
    expect(src).not.toMatch(/onClick=\{IS_IOS \? onEchap/);
    expect(src).toMatch(/data-commandes-horloge/);
    expect(src).toMatch(/commandesVisibles \? "opacity-100" : "pointer-events-none opacity-0"/);
    expect(lire("../components/FocusOverlay.tsx")).toMatch(/<EcranTimer\s+epure/);
  });
  it("l'info-bulle du plein écran ne parle plus d'Échap au doigt", () => {
    for (const f of ["../views/TimerView.tsx", "../components/TimerCard.tsx"]) {
      expect(lire(f)).toMatch(/pointeurGrossier\(\) \? t\("Ne laisse que le chrono à l’écran\. Touchez/);
    }
  });
});

describe("constat 17 — le Calendrier au téléphone", () => {
  beforeEach(() => oublierMemoireCalendrier());

  it("s'ouvre sur la semaine (décision du 13/10)", () => {
    expect(vueAOuvrir(true)).toBe("semaine");
    expect(vueAOuvrir(false)).toBe("semaine");
  });
  it("une vue choisie est retenue pour la session : l'agenda n'est plus oublié au retour", () => {
    retenirVue("agenda");
    expect(vueAOuvrir(true)).toBe("agenda");
  });
  it("un mois choisi au bureau rouvre la semaine au téléphone (le mois n'y existe pas)", () => {
    retenirVue("mois");
    expect(vueAOuvrir(true)).toBe("semaine");
    expect(vueAOuvrir(false)).toBe("mois");
  });
  it("les alertes se replient au téléphone, et restent dépliées une fois ouvertes", () => {
    expect(alertesDeplieesAuTelephone()).toBe(false);
    retenirAlertesDepliees(true);
    expect(alertesDeplieesAuTelephone()).toBe(true);
  });
  it("le bouton de vue retient le choix ; le bandeau se replie au téléphone ; la surcharge nomme le jour", () => {
    const src = lire("../views/CalendarView.tsx");
    expect(src).toMatch(/useState<Mode>\(\(\) => vueAOuvrir\(isPhone\)\)/);
    expect(src).toMatch(/setMode\(m\.id\);\s*retenirVue\(m\.id\);/);
    expect(src).toMatch(/<BandeauIntelligence\s+replie=\{isPhone\}/);
    expect(src).toMatch(/const enUneLigne = replie && nombre > 1;/);
    expect(src).toMatch(/t\("Aujourd'hui, journée surchargée\."\)/);
    expect(src).not.toMatch(/t\("Journée surchargée\."\)/);
  });
});

describe("constat 35 — la roulette des heures", () => {
  const src = lire("../components/calendrier/RouletteHeure.tsx");
  it("des crans de 44 px au doigt (28 à la souris) ; le pas reste d'une minute", async () => {
    const { hauteurCran } = await import("../components/calendrier/RouletteHeure");
    expect(hauteurCran(true)).toBe(44);
    expect(hauteurCran(false)).toBe(28);
    expect(src).toMatch(/const MINUTES = Array\.from\(\{ length: 60 \}/);
  });
  it("rien de choisi : aucun cran n'est désigné (plus de « 12 h 00 » affirmé)", () => {
    expect(src).toMatch(/aria-selected=\{!vide && i === index\}/);
    expect(src).toMatch(/\{!vide && \(\s*<div\s+aria-hidden/);
  });
});

describe("constat 38 — Habitudes au doigt", () => {
  const journal = lire("../views/JournalView.tsx");
  it("Entrée sur une pastille de couleur ajoute l'habitude", () => {
    expect(journal).toMatch(/if \(e\.key !== "Enter" \|\| !newHabit\.trim\(\)\) return;[\s\S]{0,120}void handleAddHabit\(c\);/);
  });
  it("les grilles ont leur légende, au Journal et sur Aujourd'hui", () => {
    expect(journal).toMatch(/<GrilleHabitudes[^>]*\blegende\b/);
    expect(journal).toMatch(/<LegendeCarres/);
    const jour = lire("../components/HabitudesDuJour.tsx");
    expect(jour).toMatch(/<GrilleHabitudes[^>]*\blegende\b/);
    expect(jour).toMatch(/<LegendeCarres/);
  });
});

describe("contrôle du 12/10, rang 31 — le toast et la feuille « Plus »", () => {
  it("feuille ouverte, le toast monte en haut de l'écran", () => {
    expect(lire("../components/MobileNav.tsx")).toMatch(/setAttribute\("data-feuille-plus", ""\)/);
    expect(lire("../components/Toast.tsx")).toMatch(/className="toast-pile /);
    expect(lire("../index.css")).toMatch(/html\[data-feuille-plus\] \.toast-pile \{\s*top:[^}]*bottom: auto !important;/);
  });
});
