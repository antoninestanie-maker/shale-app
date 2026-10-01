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

/** Un élément extrait d'un texte ou d'un fichier (#5). */
export interface ElementExtrait {
  type: "tache" | "evenement" | "note" | "achat";
  titre: string;
  date: string | null;
  heure: string | null;
  priorite: PrioriteIa | null;
  etiquette: string | null;
  texte: string | null;
  achat: {
    fournisseur: string;
    numero: string | null;
    date: string | null;
    echeance: string | null;
    ht: number | null;
    tva: number | null;
    ttc: number | null;
    devise: "EUR" | "USD" | "GBP" | "CHF" | "CAD" | "JPY";
  } | null;
  confiance: "haute" | "moyenne" | "basse";
}

/** Charge du calendrier transmise aux fonctions qui datent (#11, #12, #13). */
export type ChargeJour = { jour: string; elements: number };

/** Ce que l'app dit d'un objectif aux fonctions #11 et #12. */
export interface ObjectifPourIa {
  titre: string;
  description: string | null;
  echeance: string | null;
  horizon: "short" | "medium" | "long";
}

/** Une tâche proposée pour un objectif (#12, #13) : `etape` est l'id d'une étape fournie. */
export interface TacheProposee {
  titre: string;
  priorite: PrioriteIa;
  date: string | null;
  etape: string | null;
}

export type RaisonPeril = "depassee" | "trop-peu-de-jours" | "rythme-insuffisant";

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
  extraire: {
    payload: { lang: LangIa; jour: string; texte: string; etiquettes: string[] };
    sortie: { elements: ElementExtrait[] };
  };
  extraire_fichier: {
    payload: {
      lang: LangIa;
      jour: string;
      fichier: { media_type: "application/pdf" | "image/png" | "image/jpeg" | "image/webp"; data: string };
      contexte: string;
      etiquettes: string[];
    };
    sortie: { elements: ElementExtrait[] };
  };
  vider_tete: {
    payload: { lang: LangIa; jour: string; texte: string; etiquettes: string[] };
    sortie: { taches: Array<{ titre: string; priorite: PrioriteIa; etiquette: string | null; date: string | null }> };
  };
  decouper: {
    payload: {
      lang: LangIa;
      jour: string;
      tache: { titre: string; priorite: PrioriteIa; echeance: string | null; etiquette: string | null; objectif: string | null };
    };
    sortie: { etapes: Array<{ titre: string; priorite: PrioriteIa; date: string | null }> };
  };
  estimer: {
    payload: {
      lang: LangIa;
      tache: { titre: string; etiquette: string | null };
      comparables: Array<{ id: string; titre: string; etiquette: string | null; minutes: number; recurrente: boolean }>;
    };
    sortie: { retenus: string[]; justification: string };
  };
  decomposer_objectif: {
    payload: { lang: LangIa; jour: string; objectif: ObjectifPourIa; existantes: Array<{ titre: string }>; charge: ChargeJour[] };
    sortie: { etapes: Array<{ titre: string; priorite: PrioriteIa; echeance: string | null }> };
  };
  etapes_objectif: {
    payload: {
      lang: LangIa;
      jour: string;
      objectif: ObjectifPourIa;
      etapes: Array<{ id: string; titre: string; echeance: string | null }>;
      taches: Array<{ titre: string; date: string | null; faite: boolean }>;
      charge: ChargeJour[];
    };
    sortie: { taches: TacheProposee[] };
  };
  objectif_peril: {
    payload: {
      lang: LangIa;
      jour: string;
      objectif: {
        titre: string;
        echeance: string;
        joursRestants: number;
        progression: number;
        declaratif: boolean;
        raison: RaisonPeril;
        racine: string | null;
      };
      etapesRestantes: Array<{ id: string; titre: string; echeance: string | null }>;
      tachesRestantes: Array<{ titre: string; date: string | null }>;
      rythme: { tachesFaites14j: number; joursActifs14j: number };
      charge: ChargeJour[];
    };
    sortie: { explication: string; plan: TacheProposee[] };
  };
}

export type FonctionIa = keyof ContratsIa;
export type PayloadDe<F extends FonctionIa> = ContratsIa[F]["payload"];
export type SortieDe<F extends FonctionIa> = ContratsIa[F]["sortie"];

export const FAMILLE_DE: Readonly<Record<FonctionIa, FamilleIa>> = {
  resumer: "notes",
  brief: "brief",
  cloture: "brief",
  extraire: "capture",
  extraire_fichier: "capture",
  vider_tete: "capture",
  decouper: "taches",
  estimer: "taches",
  decomposer_objectif: "taches",
  etapes_objectif: "taches",
  objectif_peril: "taches",
};

const DATE: Schema = { type: "string", format: "date" };
const PRIORITE: Schema = { type: "string", enum: ["low", "medium", "high"] };
const MONTANT: Schema = { anyOf: [{ type: "number", minimum: 0, maximum: 1_000_000_000 }, { type: "null" }] };

function tachesProposees(maxItems: number): Schema {
  return {
    type: "array",
    maxItems,
    items: {
      type: "object",
      properties: {
        titre: { type: "string", maxLength: 200 },
        priorite: PRIORITE,
        date: { anyOf: [DATE, { type: "null" }] },
        etape: { anyOf: [{ type: "string", maxLength: 40 }, { type: "null" }] },
      },
      required: ["titre", "priorite", "date", "etape"],
      additionalProperties: false,
    },
  };
}

const SORTIE_EXTRAIRE: Schema = {
  type: "object",
  properties: {
    elements: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["tache", "evenement", "note", "achat"] },
          titre: { type: "string", maxLength: 200 },
          date: { anyOf: [DATE, { type: "null" }] },
          heure: { anyOf: [{ type: "string", maxLength: 5 }, { type: "null" }] },
          priorite: { anyOf: [PRIORITE, { type: "null" }] },
          etiquette: { anyOf: [{ type: "string", maxLength: 60 }, { type: "null" }] },
          texte: { anyOf: [{ type: "string", maxLength: 4000 }, { type: "null" }] },
          achat: {
            anyOf: [
              {
                type: "object",
                properties: {
                  fournisseur: { type: "string", maxLength: 120 },
                  numero: { anyOf: [{ type: "string", maxLength: 60 }, { type: "null" }] },
                  date: { anyOf: [DATE, { type: "null" }] },
                  echeance: { anyOf: [DATE, { type: "null" }] },
                  ht: MONTANT,
                  tva: MONTANT,
                  ttc: MONTANT,
                  devise: { type: "string", enum: ["EUR", "USD", "GBP", "CHF", "CAD", "JPY"] },
                },
                required: ["fournisseur", "numero", "date", "echeance", "ht", "tva", "ttc", "devise"],
                additionalProperties: false,
              },
              { type: "null" },
            ],
          },
          confiance: { type: "string", enum: ["haute", "moyenne", "basse"] },
        },
        required: ["type", "titre", "date", "heure", "priorite", "etiquette", "texte", "achat", "confiance"],
        additionalProperties: false,
      },
    },
  },
  required: ["elements"],
  additionalProperties: false,
};

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
  extraire: SORTIE_EXTRAIRE,
  extraire_fichier: SORTIE_EXTRAIRE,
  vider_tete: {
    type: "object",
    properties: {
      taches: {
        type: "array",
        maxItems: 40,
        items: {
          type: "object",
          properties: {
            titre: { type: "string", maxLength: 200 },
            priorite: PRIORITE,
            etiquette: { anyOf: [{ type: "string", maxLength: 60 }, { type: "null" }] },
            date: { anyOf: [DATE, { type: "null" }] },
          },
          required: ["titre", "priorite", "etiquette", "date"],
          additionalProperties: false,
        },
      },
    },
    required: ["taches"],
    additionalProperties: false,
  },
  decouper: {
    type: "object",
    properties: {
      etapes: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          properties: { titre: { type: "string", maxLength: 200 }, priorite: PRIORITE, date: { anyOf: [DATE, { type: "null" }] } },
          required: ["titre", "priorite", "date"],
          additionalProperties: false,
        },
      },
    },
    required: ["etapes"],
    additionalProperties: false,
  },
  estimer: {
    type: "object",
    properties: {
      retenus: { type: "array", maxItems: 30, items: { type: "string", maxLength: 40 } },
      justification: { type: "string", maxLength: 400 },
    },
    required: ["retenus", "justification"],
    additionalProperties: false,
  },
  decomposer_objectif: {
    type: "object",
    properties: {
      etapes: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          properties: { titre: { type: "string", maxLength: 200 }, priorite: PRIORITE, echeance: { anyOf: [DATE, { type: "null" }] } },
          required: ["titre", "priorite", "echeance"],
          additionalProperties: false,
        },
      },
    },
    required: ["etapes"],
    additionalProperties: false,
  },
  etapes_objectif: {
    type: "object",
    properties: { taches: tachesProposees(12) },
    required: ["taches"],
    additionalProperties: false,
  },
  objectif_peril: {
    type: "object",
    properties: { explication: { type: "string", maxLength: 800 }, plan: tachesProposees(8) },
    required: ["explication", "plan"],
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
