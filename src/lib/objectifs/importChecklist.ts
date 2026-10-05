import type { Priority } from "../types";
import type { EtapePlan, PlanObjectif, TachePlan } from "./carte";

/**
 * ⭐ IMPORTER UNE CHECKLIST — n'importe quelle IA écrit, Shale lit.
 *
 * Antonin, 2026-10-05 : un utilisateur doit pouvoir demander une checklist à
 * une IA et l'intégrer directement dans l'app. Le format est du Markdown
 * ordinaire — celui que toute IA produit sans effort, et qu'un humain relit :
 *
 *     # Préparer mon déménagement          ← l'objectif (une seule fois)
 *     ## Trouver le logement               ← une étape
 *     - [ ] Lister les quartiers @2026-10-20 !haute   ← une tâche
 *     ### Visites                          ← une sous-étape (sous un ##)
 *     - [ ] Prendre trois rendez-vous
 *
 * ⚠️ Ce module est PUR : il rend un `PlanObjectif`, le même que celui d'une
 * carte mentale, donc `creerObjectifDepuisPlan` l'écrit sans rien savoir de
 * son origine. Une seule moitié impure pour deux entrées.
 *
 * ⚠️ Il TOLÈRE plutôt qu'il ne refuse : une IA qui oublie le `#`, qui numérote
 * (`1.`), qui entoure le tout d'un bloc de code, ou qui indente ses puces,
 * produit encore une checklist utilisable. Ce qui ne ressemble à rien est
 * compté dans `ignores`, jamais avalé en silence.
 */

const PRIORITES: Record<string, Priority> = {
  haute: "high",
  "élevée": "high",
  elevee: "high",
  high: "high",
  moyenne: "medium",
  medium: "medium",
  faible: "low",
  basse: "low",
  low: "low",
};

/** Une tâche lue, avant d'entrer dans le plan. */
export function lireTache(brut: string): TachePlan | null {
  let texte = brut.trim();
  let echeance: string | undefined;
  let priorite: Priority | undefined;

  // `@2026-10-20`, `(2026-10-20)` ou `[2026-10-20]`, n'importe où dans la ligne.
  const date = /(?:@|\(|\[)\s*(\d{4}-\d{2}-\d{2})\s*\)?\]?/.exec(texte);
  if (date && valide(date[1])) {
    echeance = date[1];
    texte = texte.replace(date[0], " ");
  }

  const prio = /!\s*([A-Za-zÀ-ÿ]+)/.exec(texte);
  if (prio && PRIORITES[prio[1].toLowerCase()]) {
    priorite = PRIORITES[prio[1].toLowerCase()];
    texte = texte.replace(prio[0], " ");
  }

  texte = texte
    .replace(/\*\*|__/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s,;:–—-]+$/g, "")
    .trim();
  if (!texte) return null;
  return { titre: texte, ...(echeance ? { echeance } : {}), ...(priorite ? { priorite } : {}) };
}

/** `2026-02-31` n'existe pas : on ne l'écrit pas, on laisse la tâche sans date. */
function valide(iso: string): boolean {
  const [a, m, j] = iso.split("-").map(Number);
  const d = new Date(a, m - 1, j);
  return d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === j;
}

function etapeVide(titre: string): EtapePlan {
  return { titre, phase: false, sousEtapes: [], taches: [], ressources: [] };
}

/**
 * Lit un texte collé et rend le plan, ou `null` s'il n'y a rien d'exploitable
 * (ni titre, ni étape, ni tâche).
 */
export function lireChecklist(texte: string): PlanObjectif | null {
  const plan: PlanObjectif = {
    titre: "",
    etapes: [],
    taches: [],
    ressources: [],
    ignores: 0,
    laisses: [],
    habitudes: [],
  };

  let etape: EtapePlan | null = null;
  let sous: EtapePlan | null = null;
  let premiereNue: string | null = null;

  const deposer = (t: TachePlan) => {
    (sous ?? etape)?.taches.push(t);
    if (!sous && !etape) plan.taches.push(t);
  };

  for (const brut of texte.split(/\r?\n/)) {
    const ligne = brut.replace(/\t/g, "  ");
    const nue = ligne.trim();
    if (!nue || /^```/.test(nue) || /^[-*_]{3,}$/.test(nue)) continue;

    const titre = /^(#{1,6})\s+(.*?)\s*#*$/.exec(nue);
    if (titre) {
      const niveau = titre[1].length;
      const nom = titre[2].replace(/\*\*|__/g, "").trim();
      if (!nom) continue;
      if (niveau === 1) {
        if (!plan.titre) plan.titre = nom;
        else {
          // Un second `#` : l'IA a écrit deux objectifs. On le range en étape
          // plutôt que de le perdre.
          etape = etapeVide(nom);
          sous = null;
          plan.etapes.push(etape);
        }
      } else if (niveau === 2 || !etape) {
        etape = etapeVide(nom);
        sous = null;
        plan.etapes.push(etape);
      } else if (niveau === 3) {
        sous = etapeVide(nom);
        etape.sousEtapes.push(sous);
        etape.phase = true;
      } else {
        // `####` et au-delà : la feuille de route n'a que trois niveaux. Le
        // titre devient une tâche de la sous-étape courante — rien n'est perdu.
        deposer({ titre: nom });
      }
      continue;
    }

    const puce = /^(?:[-*+•]|\d+[.)])\s+(?:\[[ xX]?\]\s*)?(.*)$/.exec(nue);
    if (puce) {
      const tache = lireTache(puce[1]);
      if (tache) deposer(tache);
      else plan.ignores++;
      continue;
    }

    // Une ligne de texte sans marque : du bavardage de l'IA — sauf si aucun
    // `#` n'arrive, auquel cas la première fera le titre (voir plus bas).
    if (premiereNue === null) premiereNue = nue.replace(/\*\*|__/g, "").replace(/[:：]\s*$/, "").trim();
    plan.ignores++;
  }

  if (!plan.titre && premiereNue) {
    plan.titre = premiereNue;
    plan.ignores--;
  }

  const vide = !plan.titre && plan.etapes.length === 0 && plan.taches.length === 0;
  return vide ? null : plan;
}

/**
 * ⭐ LA CONSIGNE À COLLER DANS L'IA (ChatGPT, Claude, Gemini…).
 *
 * Une phrase de contexte, le format, un exemple minuscule — rien de plus : plus
 * la consigne est longue, plus l'IA l'illustre au lieu de la suivre. `sujet`
 * est ce que la personne veut planifier ; sans lui, la consigne se termine par
 * une invitation à le préciser.
 */
export function consigneIa(sujet: string, langue: "fr" | "en"): string {
  const s = sujet.trim();
  if (langue === "en") {
    return [
      "Write me a checklist for the following goal, in this exact Markdown format and nothing else (no introduction, no conclusion):",
      "",
      "# Goal title",
      "## Step (3 to 6 steps, in order)",
      "- [ ] A concrete task, doable in one sitting @YYYY-MM-DD !high",
      "### Sub-step (optional, only under a step)",
      "- [ ] Another task",
      "",
      "Rules: one # title only; dates are optional and written @YYYY-MM-DD; priority is optional and is !high, !medium or !low; no more than 8 tasks per step.",
      "",
      s ? `The goal: ${s}` : "The goal: (describe here what you want to plan)",
    ].join("\n");
  }
  return [
    "Écris-moi une checklist pour l'objectif ci-dessous, exactement dans ce format Markdown et rien d'autre (ni introduction, ni conclusion) :",
    "",
    "# Titre de l'objectif",
    "## Une étape (de 3 à 6 étapes, dans l'ordre)",
    "- [ ] Une tâche concrète, faisable d'une traite @AAAA-MM-JJ !haute",
    "### Une sous-étape (facultative, seulement sous une étape)",
    "- [ ] Une autre tâche",
    "",
    "Règles : un seul # de titre ; les dates sont facultatives et s'écrivent @AAAA-MM-JJ ; la priorité est facultative et vaut !haute, !moyenne ou !faible ; pas plus de 8 tâches par étape.",
    "",
    s ? `L'objectif : ${s}` : "L'objectif : (décris ici ce que tu veux planifier)",
  ].join("\n");
}
