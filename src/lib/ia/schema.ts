// ─────────────────────────────────────────────────────────────────────────────
// Un sous-ensemble de JSON Schema, écrit à la main (aucune dépendance), qui sert
// deux fois :
//   · `valider`  — contrôle un payload entrant et une sortie de modèle ;
//   · `versApi`  — produit le schéma envoyé au modèle (`output_config.format`).
//
// L'API accepte `enum`, `format`, `anyOf`, `additionalProperties: false`, mais
// PAS les bornes (`maxLength`, `maxItems`, `minimum`, `maximum`) : `versApi` les
// retire, et c'est `valider` qui les fait respecter ici, après coup. Une sortie
// qui déborde est donc rejetée, pas tronquée en silence.
//
// Politique : REJETER, jamais corriger. `market/llm.ts::validate` (Market Brain)
// ramène un champ faux à une valeur par défaut ; ici, une sortie invalide
// déclenche une relance puis `bad_output` — rien d'invalide n'atteint l'app.
// ─────────────────────────────────────────────────────────────────────────────

export type Schema =
  | { type: "string"; maxLength?: number; enum?: readonly string[]; format?: "date" | "uri" }
  | { type: "number" | "integer"; minimum?: number; maximum?: number }
  | { type: "boolean" }
  | { type: "null" }
  | { type: "array"; items: Schema; maxItems?: number }
  | {
      type: "object";
      properties: Readonly<Record<string, Schema>>;
      required: readonly string[];
      additionalProperties: false;
    }
  | { anyOf: readonly Schema[] };

const MAX_ERREURS = 10;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function dateValide(s: string): boolean {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Les écarts entre `valeur` et `schema`, au plus dix. Liste vide = conforme. */
export function valider(schema: Schema, valeur: unknown, chemin = "$"): string[] {
  const erreurs: string[] = [];
  parcourir(schema, valeur, chemin, erreurs);
  return erreurs.slice(0, MAX_ERREURS);
}

function parcourir(schema: Schema, v: unknown, chemin: string, erreurs: string[]): void {
  if (erreurs.length >= MAX_ERREURS) return;

  if ("anyOf" in schema) {
    const ok = schema.anyOf.some((s) => valider(s, v, chemin).length === 0);
    if (!ok) erreurs.push(`${chemin} : aucune forme admise`);
    return;
  }

  switch (schema.type) {
    case "string":
      if (typeof v !== "string") return void erreurs.push(`${chemin} : texte attendu`);
      if (schema.maxLength !== undefined && v.length > schema.maxLength)
        erreurs.push(`${chemin} : plus de ${schema.maxLength} caractères`);
      if (schema.enum && !schema.enum.includes(v)) erreurs.push(`${chemin} : valeur hors liste`);
      if (schema.format === "date" && !dateValide(v)) erreurs.push(`${chemin} : date AAAA-MM-JJ attendue`);
      if (schema.format === "uri" && !/^https?:\/\/\S+$/i.test(v)) erreurs.push(`${chemin} : lien http(s) attendu`);
      return;

    case "number":
    case "integer":
      if (typeof v !== "number" || !Number.isFinite(v)) return void erreurs.push(`${chemin} : nombre attendu`);
      if (schema.type === "integer" && !Number.isInteger(v)) erreurs.push(`${chemin} : entier attendu`);
      if (schema.minimum !== undefined && v < schema.minimum) erreurs.push(`${chemin} : sous ${schema.minimum}`);
      if (schema.maximum !== undefined && v > schema.maximum) erreurs.push(`${chemin} : au-dessus de ${schema.maximum}`);
      return;

    case "boolean":
      if (typeof v !== "boolean") erreurs.push(`${chemin} : booléen attendu`);
      return;

    case "null":
      if (v !== null) erreurs.push(`${chemin} : null attendu`);
      return;

    case "array":
      if (!Array.isArray(v)) return void erreurs.push(`${chemin} : liste attendue`);
      if (schema.maxItems !== undefined && v.length > schema.maxItems)
        erreurs.push(`${chemin} : plus de ${schema.maxItems} éléments`);
      v.forEach((e, i) => parcourir(schema.items, e, `${chemin}[${i}]`, erreurs));
      return;

    case "object": {
      if (!estObjet(v)) return void erreurs.push(`${chemin} : objet attendu`);
      for (const cle of schema.required)
        if (!(cle in v)) erreurs.push(`${chemin}.${cle} : manquant`);
      for (const [cle, val] of Object.entries(v)) {
        const sous = schema.properties[cle];
        if (!sous) erreurs.push(`${chemin}.${cle} : champ inconnu`);
        else parcourir(sous, val, `${chemin}.${cle}`, erreurs);
      }
      return;
    }
  }
}

/** Le schéma tel que l'API l'accepte : sans les bornes qu'elle refuse. */
export function versApi(schema: Schema): unknown {
  if ("anyOf" in schema) return { anyOf: schema.anyOf.map(versApi) };
  switch (schema.type) {
    case "string": {
      const r: Record<string, unknown> = { type: "string" };
      if (schema.enum) r.enum = [...schema.enum];
      if (schema.format) r.format = schema.format;
      return r;
    }
    case "number":
    case "integer":
    case "boolean":
    case "null":
      return { type: schema.type };
    case "array":
      return { type: "array", items: versApi(schema.items) };
    case "object":
      return {
        type: "object",
        properties: Object.fromEntries(Object.entries(schema.properties).map(([k, s]) => [k, versApi(s)])),
        required: [...schema.required],
        additionalProperties: false,
      };
  }
}
