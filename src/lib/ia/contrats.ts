// ─────────────────────────────────────────────────────────────────────────────
// Le contrat entre l'app et la fonction `ai` (dépôt du site,
// `supabase/functions/ai/`).
//
// Pour chaque fonction d'IA : ce que l'app envoie (payload), ce qu'elle reçoit
// (sortie), et sa famille (l'interrupteur des Réglages qui la commande).
//
// ⚠️ Le serveur a SA copie de ces schémas (`coeur/fonctions.ts`) et c'est elle
// qui fait foi. `contrat.test.ts` compare les deux : un schéma qui diverge fait
// échouer la suite de l'app, avant qu'une réponse valide pour le serveur soit
// rejetée ici (ou l'inverse).
//
// AJOUTER UNE FONCTION — côté app : son entrée dans `ContratsIa`, `SORTIES`,
// `FAMILLE_DE`, et sa réponse factice dans `demo.ts`.
// ─────────────────────────────────────────────────────────────────────────────

import type { Schema } from "./schema";

export type LangIa = "fr" | "en";

/** Les familles, telles que les Réglages les montrent (une case chacune). */
export const FAMILLES = ["brief", "capture", "taches", "notes", "revue", "finance"] as const;
export type FamilleIa = (typeof FAMILLES)[number];

/** Payload et sortie de chaque fonction servie. */
export interface JourneeBrief {
  evenements: Array<{ titre: string; heure: string | null }>;
  priorites: Array<{ titre: string }>;
  tachesPrevues: number;
  surcharge: boolean;
}

export type PrioriteIa = "low" | "medium" | "high";
export type ActionCloture = "demain" | "date" | "plus_tard" | "supprimer";

export interface ContratsIa {
  resumer: {
    payload: { lang: LangIa; titre: string; texte: string };
    sortie: { resume: string; points: string[] };
  };
  brief: {
    payload: {
      lang: LangIa;
      jour: string;
      regenerer: boolean;
      sujets: Array<{ nom: string; flux: string[] }>;
      journee: JourneeBrief;
    };
    sortie: {
      sujets: Array<{ nom: string; points: Array<{ texte: string; lien: string }> }>;
      journee: string;
    };
  };
  cloture: {
    payload: {
      lang: LangIa;
      jour: string;
      faites: Array<{ titre: string }>;
      restantes: Array<{ id: string; titre: string; priorite: PrioriteIa; echeance: string | null; reports: number }>;
    };
    sortie: {
      bilan: string;
      propositions: Array<{ id: string; action: ActionCloture; date: string | null; raison: string }>;
    };
  };
}

export type FonctionIa = keyof ContratsIa;
export type PayloadDe<F extends FonctionIa> = ContratsIa[F]["payload"];
export type SortieDe<F extends FonctionIa> = ContratsIa[F]["sortie"];

export const FAMILLE_DE: Readonly<Record<FonctionIa, FamilleIa>> = {
  resumer: "notes",
  brief: "brief",
  cloture: "brief",
};

const DATE: Schema = { type: "string", format: "date" };

/** Les schémas de sortie — revalidés ici, même si le serveur l'a fait. */
export const SORTIES: Readonly<Record<FonctionIa, Schema>> = {
  resumer: {
    type: "object",
    properties: {
      resume: { type: "string", maxLength: 1200 },
      points: { type: "array", items: { type: "string", maxLength: 300 }, maxItems: 7 },
    },
    required: ["resume", "points"],
    additionalProperties: false,
  },
  brief: {
    type: "object",
    properties: {
      sujets: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            nom: { type: "string", maxLength: 60 },
            points: {
              type: "array",
              maxItems: 5,
              items: {
                type: "object",
                properties: { texte: { type: "string", maxLength: 300 }, lien: { type: "string", format: "uri" } },
                required: ["texte", "lien"],
                additionalProperties: false,
              },
            },
          },
          required: ["nom", "points"],
          additionalProperties: false,
        },
      },
      journee: { type: "string", maxLength: 600 },
    },
    required: ["sujets", "journee"],
    additionalProperties: false,
  },
  cloture: {
    type: "object",
    properties: {
      bilan: { type: "string", maxLength: 600 },
      propositions: {
        type: "array",
        maxItems: 30,
        items: {
          type: "object",
          properties: {
            id: { type: "string", maxLength: 40 },
            action: { type: "string", enum: ["demain", "date", "plus_tard", "supprimer"] },
            date: { anyOf: [DATE, { type: "null" }] },
            raison: { type: "string", maxLength: 200 },
          },
          required: ["id", "action", "date", "raison"],
          additionalProperties: false,
        },
      },
    },
    required: ["bilan", "propositions"],
    additionalProperties: false,
  },
};

// ── Quotas (copie de `coeur/limites.ts`, gardée par `contrat.test.ts`) ──────
export const QUOTA_PRO = 400;
export const QUOTA_ESSAI = 60;

/** Période du compteur : `essai`, ou le mois UTC `YYYY-MM`. */
export function periodeIa(enEssai: boolean, maintenant: Date): string {
  return enEssai ? "essai" : maintenant.toISOString().slice(0, 7);
}

/** Le 1er du mois suivant (UTC), ou la fin de l'essai. */
export function reinitialisationIa(enEssai: boolean, finEssai: string | null | undefined, maintenant: Date): string | null {
  if (enEssai) {
    const fin = finEssai ? new Date(finEssai) : null;
    return fin && !Number.isNaN(fin.getTime()) ? fin.toISOString() : null;
  }
  return new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() + 1, 1)).toISOString();
}
