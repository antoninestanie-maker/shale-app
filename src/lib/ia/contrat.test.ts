// ─────────────────────────────────────────────────────────────────────────────
// Le contrat app ↔ fonction `ai` : ce que l'app croit du serveur doit être
// VRAI du serveur. Les deux côtés ont leur copie (l'app ne peut pas importer le
// dépôt du site à l'exécution) ; ce test lit les deux et exige qu'elles
// coïncident — sinon une réponse valide pour le serveur serait rejetée ici, ou
// un compteur affiché mentirait.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";

import schemaServeur from "../../../../shale-site/supabase/functions/ai/coeur/schema.ts?raw";
import { FONCTIONS } from "../../../../shale-site/supabase/functions/ai/coeur/fonctions.ts";
import { LIMITES } from "../../../../shale-site/supabase/functions/ai/coeur/limites.ts";
import schemaApp from "./schema.ts?raw";
import { FAMILLE_DE, periodeIa, QUOTA_ESSAI, QUOTA_PRO, reinitialisationIa, SORTIES, type FonctionIa } from "./contrats";

const FONCTIONS_APP = Object.keys(SORTIES) as FonctionIa[];

describe("contrat app ↔ serveur", () => {
  it("le validateur est le MÊME fichier des deux côtés, octet pour octet", () => {
    expect(schemaApp).toBe(schemaServeur);
  });

  it("chaque fonction de l'app existe sur le serveur, avec le même schéma de sortie", () => {
    for (const f of FONCTIONS_APP) {
      expect(FONCTIONS[f], f).toBeDefined();
      expect(SORTIES[f], f).toEqual(FONCTIONS[f].sortie);
    }
  });

  it("chaque fonction de l'app a sa famille", () => {
    for (const f of FONCTIONS_APP) expect(FAMILLE_DE[f], f).toBeTruthy();
  });

  it("les quotas affichés sont ceux que le serveur applique", () => {
    expect(QUOTA_PRO).toBe(LIMITES.quotaPro);
    expect(QUOTA_ESSAI).toBe(LIMITES.quotaEssai);
  });

  it("période et réinitialisation se calculent comme sur le serveur", () => {
    const m = new Date("2026-12-31T23:30:00Z");
    expect(periodeIa(false, m)).toBe("2026-12");
    expect(periodeIa(true, m)).toBe("essai");
    expect(reinitialisationIa(false, null, m)).toBe("2027-01-01T00:00:00.000Z");
    expect(reinitialisationIa(true, "2027-01-03T10:00:00+01:00", m)).toBe("2027-01-03T09:00:00.000Z");
  });
});
