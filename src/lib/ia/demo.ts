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

import { t, tp } from "../i18n";
import type { ContratsIa, FonctionIa, PayloadDe, SortieDe } from "./contrats";

/** Le délai d'une vraie réponse, à peu près : l'état « l'IA rédige » se voit. */
export const DELAI_DEMO_MS = 900;

type Factices = { [F in FonctionIa]: (payload: PayloadDe<F>) => SortieDe<F> };

function lendemainDe(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Une adresse de démonstration sur le site du premier flux du sujet. */
function lienDemo(flux: string[], i: number): string {
  try {
    return `${new URL(flux[0]).origin}/`;
  } catch {
    return `https://www.shaleapp.com/#demo-${i}`;
  }
}

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
  brief: (p) => ({
    sujets: p.sujets.map((s, i) => ({
      nom: s.nom,
      points: s.flux.length
        ? [
            { texte: t("Démonstration : ici, un fait tiré d'un article de tes sources, en une ou deux phrases."), lien: lienDemo(s.flux, i) },
            { texte: t("Démonstration : chaque point renvoie à l'article dont il vient."), lien: lienDemo(s.flux, i) },
            { texte: t("Démonstration : aucune source n'est inventée, le serveur le vérifie."), lien: lienDemo(s.flux, i) },
          ]
        : [],
    })),
    journee: p.journee.surcharge
      ? t("Ta journée est chargée : {n} tâches prévues. Commence par « {p} », et choisis ce qui peut attendre.", {
          n: p.journee.tachesPrevues,
          p: p.journee.priorites[0]?.titre ?? t("ta priorité"),
        })
      : p.journee.priorites.length
        ? t("Journée tenable. Ta priorité : « {p} ».", { p: p.journee.priorites[0].titre })
        : t("Rien d'inscrit aujourd'hui : une journée libre à organiser."),
  }),
  cloture: (p) => ({
    bilan: `${tp(p.faites.length, "{n} tâche faite aujourd'hui.", "{n} tâches faites aujourd'hui.")} ${tp(
      p.restantes.length,
      "{n} tâche reste.",
      "{n} tâches restent.",
    )}`,
    propositions: p.restantes.map((r) =>
      r.priorite !== "high" && r.reports >= 3
        ? { id: r.id, action: "supprimer" as const, date: null, raison: t("Reportée plusieurs fois : peut-être plus d'actualité.") }
        : r.priorite === "high"
          ? { id: r.id, action: "demain" as const, date: null, raison: t("Prioritaire : à reprendre dès demain.") }
          : { id: r.id, action: "date" as const, date: lendemainDe(lendemainDe(p.jour)), raison: t("Peut attendre deux jours.") },
    ),
  }),
  extraire: (p) => ({ elements: elementsDemo(p.jour, p.texte.trim().length > 0) }),
  extraire_fichier: (p) => ({ elements: elementsDemo(p.jour, true) }),
  vider_tete: (p) => ({
    taches: p.texte.trim()
      ? [
          { titre: t("Appeler le comptable"), priorite: "high" as const, etiquette: p.etiquettes[0] ?? null, date: lendemainDe(p.jour) },
          { titre: t("Préparer la réunion de lundi"), priorite: "medium" as const, etiquette: null, date: null },
          { titre: t("Trier les photos de vacances"), priorite: "low" as const, etiquette: null, date: null },
        ]
      : [],
  }),
};

/** Un e-mail type : une tâche, un rendez-vous, une facture (dont le TTC ne
 *  colle pas — la démo montre l'avertissement du contrôle local). */
function elementsDemo(jour: string, plein: boolean): ContratsIa["extraire"]["sortie"]["elements"] {
  if (!plein) return [];
  return [
    { type: "tache", titre: t("Renvoyer le contrat signé"), date: lendemainDe(jour), heure: null, priorite: "high", etiquette: null, texte: null, achat: null, confiance: "haute" },
    { type: "evenement", titre: t("Point avec l'agence"), date: lendemainDe(lendemainDe(jour)), heure: "10:30", priorite: null, etiquette: null, texte: null, achat: null, confiance: "moyenne" },
    {
      type: "achat",
      titre: t("Facture hébergement"),
      date: jour,
      heure: null,
      priorite: null,
      etiquette: null,
      texte: null,
      achat: { fournisseur: "Hébergeur Démo", numero: "F-2026-0412", date: jour, echeance: null, ht: 20, tva: 4, ttc: 24.5, devise: "EUR" },
      confiance: "haute",
    },
  ];
}

export function reponseDemo<F extends FonctionIa>(feature: F, payload: PayloadDe<F>): ContratsIa[F]["sortie"] {
  return (FACTICES[feature] as (p: PayloadDe<F>) => SortieDe<F>)(payload);
}
