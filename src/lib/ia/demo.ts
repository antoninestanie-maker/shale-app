// ─────────────────────────────────────────────────────────────────────────────
// Les réponses factices du mode démo (hors Tauri) : chaque fonction d'IA reste
// jouable sans backend, sans un seul appel réseau.
//
// ⚠️ `t()` est appelé À L'APPEL, jamais au chargement du module : les graines de
// `lib/demo.ts` sont traduites à l'import et restent figées dans la langue de
// démarrage — ici, la réponse suit la langue du moment.
//
// Chaque réponse doit passer le schéma de sortie de sa fonction
// (`contrats.ts`) : `demo.test.ts` le vérifie pour toutes.
// ─────────────────────────────────────────────────────────────────────────────

import { t } from "../i18n";
import type { ContratsIa, FonctionIa, PayloadDe, SortieDe } from "./contrats";

/** Le délai d'une vraie réponse, à peu près : l'état « l'IA rédige » se voit. */
export const DELAI_DEMO_MS = 900;

type Factices = { [F in FonctionIa]: (payload: PayloadDe<F>) => SortieDe<F> };

const FACTICES: Factices = {
  resumer: (p) => ({
    resume: p.texte.trim()
      ? t("Cette note parle de « {titre} ». Elle pose le contexte, liste ce qui reste à trancher et se termine sur une prochaine étape.", {
          titre: p.titre || t("Sans titre"),
        })
      : t("La note est vide : il n'y a rien à résumer."),
    points: p.texte.trim()
      ? [
          t("Le contexte est posé en quelques lignes."),
          t("Deux points restent ouverts."),
          t("La prochaine étape est datée."),
        ]
      : [],
  }),
};

export function reponseDemo<F extends FonctionIa>(feature: F, payload: PayloadDe<F>): ContratsIa[F]["sortie"] {
  return (FACTICES[feature] as (p: PayloadDe<F>) => SortieDe<F>)(payload);
}
