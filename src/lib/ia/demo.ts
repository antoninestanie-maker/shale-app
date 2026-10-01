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
  decouper: (p) => {
    // Étalées jusqu'à l'échéance quand il y en a une, comme le demande le prompt.
    const dates = [p.jour, lendemainDe(p.jour), lendemainDe(lendemainDe(p.jour))].map((d) =>
      p.tache.echeance ? (d <= p.tache.echeance ? d : p.tache.echeance) : null,
    );
    return {
      etapes: [
        { titre: t("Lister ce qui est déjà prêt et ce qui manque"), priorite: p.tache.priorite, date: dates[0] },
        { titre: t("Préparer la première version en 45 minutes"), priorite: p.tache.priorite, date: dates[1] },
        { titre: t("Relire, corriger et envoyer"), priorite: p.tache.priorite, date: dates[2] },
      ],
    };
  },
  estimer: (p) => ({
    // La démo retient les trois premiers : la fourchette affichée reste calculée par l'app.
    retenus: p.comparables.slice(0, 3).map((c) => c.id),
    justification: t("Démonstration : ces tâches passées portent la même étiquette et un travail de même ampleur."),
  }),
  decomposer_objectif: (p) => {
    // Une échéance déjà passée ne borne plus rien (même règle que le serveur).
    const fin = p.objectif.echeance && p.objectif.echeance >= p.jour ? p.objectif.echeance : null;
    const date = (jours: number) => {
      const d = new Date(`${p.jour}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + jours);
      const iso = d.toISOString().slice(0, 10);
      return fin && iso > fin ? fin : iso;
    };
    return {
      etapes: [
        { titre: t("Périmètre défini et validé"), priorite: "high" as const, echeance: date(7) },
        { titre: t("Première version livrée"), priorite: "medium" as const, echeance: date(21) },
        { titre: t("Retours intégrés, version finale"), priorite: "medium" as const, echeance: date(35) },
      ],
    };
  },
  etapes_objectif: (p) => ({
    taches: [
      { titre: t("Bloquer une heure pour faire le point"), priorite: "high" as const, date: p.jour, etape: null },
      { titre: t("Préparer la prochaine étape"), priorite: "medium" as const, date: lendemainDe(p.jour), etape: p.etapes[0]?.id ?? null },
      {
        titre: t("Demander un retour à une personne concernée"),
        priorite: "low" as const,
        date: lendemainDe(lendemainDe(p.jour)),
        etape: p.etapes[1]?.id ?? p.etapes[0]?.id ?? null,
      },
    ].map((x) =>
      p.objectif.echeance && p.objectif.echeance >= p.jour && x.date > p.objectif.echeance ? { ...x, date: p.objectif.echeance } : x,
    ),
  }),
  objectif_peril: (p) => {
    // En démo, un objectif dépassé reçoit des dates dans les jours qui suivent.
    const borne = (d: string) => (p.objectif.echeance >= p.jour && d > p.objectif.echeance ? p.objectif.echeance : d);
    return {
      explication:
        p.objectif.joursRestants < 0
          ? t("Démonstration : l'échéance est passée et l'objectif est à {pct} %. Au rythme des quatorze derniers jours (tâches faites : {f}), il faut soit décaler l'échéance, soit réduire le périmètre.", {
              pct: p.objectif.progression,
              f: p.rythme.tachesFaites14j,
            })
          : t("Démonstration : l'échéance approche (jours restants : {j}) et l'objectif est à {pct} %. Au rythme des quatorze derniers jours (tâches faites : {f}), le compte ne tombe pas : il faut concentrer l'effort sur l'essentiel.", {
              j: p.objectif.joursRestants,
              pct: p.objectif.progression,
              f: p.rythme.tachesFaites14j,
            }),
      plan: [
        { titre: t("Choisir les deux étapes qui comptent vraiment"), priorite: "high" as const, date: p.jour, etape: null },
        { titre: t("Avancer la première étape restante"), priorite: "high" as const, date: borne(lendemainDe(p.jour)), etape: p.etapesRestantes[0]?.id ?? null },
        { titre: t("Décider : décaler l'échéance ou réduire le périmètre"), priorite: "medium" as const, date: borne(lendemainDe(lendemainDe(p.jour))), etape: null },
      ],
    };
  },
  reecrire: (p) => {
    // La démo ne « réécrit » pas : elle montre le parcours avant / après sur
    // le texte fourni, raccourci à ses premières lignes pour « plus court ».
    const lignes = p.texte.split("\n").filter((l) => l.trim());
    const gardees = p.ton === "court" ? lignes.slice(0, Math.max(1, Math.ceil(lignes.length / 2))) : lignes;
    return { texte: gardees.map((l) => (/^(#|-)/.test(l) ? l : `${l} ${t("(reformulé)")}`)).join("\n") };
  },
  developper: (p) => ({
    texte: p.puces
      .split("\n")
      .map((l) => l.replace(/^[-#\s]+/, "").trim())
      .filter(Boolean)
      .map((puce) => `## ${puce}\n${t("Démonstration : ici, l'IA rédige deux à cinq phrases qui développent cette puce, sans rien ajouter qui n'y figure pas.")}`)
      .join("\n"),
  }),
  traduire: (p) => ({
    titre: `${p.titre} (${p.cible.toUpperCase()})`,
    texte: p.texte
      .split("\n")
      .map((l) => {
        const m = /^(##?\s|-\s)?(.*)$/.exec(l)!;
        return `${m[1] ?? ""}[${p.cible}] ${m[2]}`;
      })
      .join("\n"),
  }),
  liens: (p) => {
    // La démo propose le premier candidat dont un mot du titre figure dans la note.
    const bas = p.texte.toLowerCase();
    const out: Array<{ passage: string; id: string }> = [];
    for (const c of p.candidats) {
      const mot = c.titre.split(/\s+/).find((m) => m.length >= 4 && bas.includes(m.toLowerCase()));
      if (!mot) continue;
      const i = bas.indexOf(mot.toLowerCase());
      out.push({ passage: p.texte.slice(i, i + mot.length), id: c.id });
      if (out.length >= 3) break;
    }
    return { liens: out };
  },
  carte: (p) => {
    const lignes = p.texte.split("\n").map((l) => l.replace(/^[-#\s]+/, "").trim()).filter(Boolean);
    const court = (s: string) => s.split(/\s+/).slice(0, 5).join(" ").slice(0, 80);
    return {
      racine: court(p.titre || lignes[0] || t("Note")),
      branches: lignes.slice(0, 5).map((l, i) => ({
        texte: court(l),
        enfants: i === 0 ? [{ texte: t("Détail"), enfants: [{ texte: t("Précision") }] }] : [],
      })),
    };
  },
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
