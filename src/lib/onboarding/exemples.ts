import { t } from "../i18n";

/**
 * ⭐ Le contenu de départ — un parcours, pas un jeu de données factices.
 *
 * LA THÈSE. Une app vide au premier lancement demande à l'utilisateur de
 * construire lui-même ce qu'il n'a pas encore compris. Une app encombrée lui
 * demande de faire le ménage avant de commencer. Ce qui suit tient entre les
 * deux : **cinq objets, quatre modules, deux arêtes**, tous racontant la même
 * chose — la revue de fin de journée.
 *
 * ─── POURQUOI CES QUATRE MODULES ────────────────────────────────────────────
 *
 * Le cahier des charges en autorise quatre au maximum. Ceux-ci :
 *
 *   • **Savoir** — un sujet et sa fiche : la méthode, écrite une fois.
 *   • **Notes** — le modèle qu'on remplit chaque soir. Il CITE la fiche.
 *   • **Tâches** — ce qui déclenche le geste, tous les jours.
 *   • **Journal** — l'habitude de régularité du coucher.
 *
 * Et surtout ceux qu'on ne touche PAS, exprès :
 *
 *   • le **Calendrier** ne possède aucune donnée : il RASSEMBLE. La tâche
 *     récurrente et l'habitude y apparaissent d'elles-mêmes, sans qu'on lui
 *     ajoute quoi que ce soit. Il est donc démontré GRATUITEMENT, ce qui est le
 *     meilleur usage possible d'un budget de quatre modules ;
 *   • les **Objectifs** sont déjà remplis par l'accueil lui-même (le curseur de
 *     clôture y crée l'objectif de l'utilisateur). Y ajouter un exemple
 *     donnerait deux objectifs au premier lancement, dont un faux.
 *
 * ─── CE QUE LES DEUX ARÊTES DÉMONTRENT ──────────────────────────────────────
 *
 * La note cite la fiche par une mention `@` : backlink des deux côtés, et les
 * deux objets restent DEUX objets — c'est précisément ce que les liaisons
 * apportent et qu'une fusion détruirait. La tâche, elle, est rattachée à la
 * note à la main : deux origines d'arête différentes, visibles au même endroit.
 *
 * ⚠️ CE FICHIER NE TOUCHE PAS À LA BASE. Il décrit ce qu'il faut créer ;
 * `semer.ts` le crée. La séparation permet de tester le contenu — et surtout
 * les règles qui le gouvernent — sans SQLite.
 */

// ─── La règle du marqueur ────────────────────────────────────────────────────

/**
 * ⭐⭐ UN EXEMPLE CESSE D'EN ÊTRE UN DÈS QU'ON Y TOUCHE.
 *
 * Décidé avec Antonin le 2026-09-10. Toute écriture de l'utilisateur sur une
 * ligne d'exemple — cocher, renommer, écrire dedans — remet `is_example` à 0 :
 * la ligne redevient une donnée ordinaire, elle compte dans les statistiques,
 * et le bouton « supprimer les exemples » ne l'emportera plus.
 *
 * Le motif est un défaut mesurable de l'alternative : un exemple marqué à vie
 * serait exclu des compteurs à vie. Cocher la tâche « revue de fin de journée »
 * ne ferait alors PAS bouger l'anneau de discipline, sans que rien ne
 * l'explique — l'app aurait l'air cassée au premier geste utile qu'on lui
 * demande.
 *
 * ⚠️ Corollaire à ne pas perdre : le bouton de suppression ne détruit donc
 * jamais ce que l'utilisateur s'est approprié. Son libellé annonce un COMPTE
 * (« supprimer les 4 exemples »), et ce compte diminue tout seul.
 */
export const RAISON_ADOPTION =
  "toute écriture de l'utilisateur retire le marqueur d'exemple";

/**
 * Les tables dont les lignes sont COMPTÉES et supprimées sans condition.
 *
 * ⚠️ `knowledge_topics` porte aussi la colonne (migration 024) mais n'est pas
 * ici : un sujet est un CONTENANT. Il ne se compte pas dans « supprimer les 4
 * exemples », et il ne part que s'il est resté vide.
 */
export const TABLES_EXEMPLES = ["tasks", "habits", "notes", "knowledge_entries"] as const;
export type TableExemple = (typeof TABLES_EXEMPLES)[number];

// ─── Le contenu ──────────────────────────────────────────────────────────────

/**
 * ⭐ REFONTE DU 2026-10-05 (Antonin) : le contenu de départ ne raconte plus « la
 * revue de fin de journée », il EXPLIQUE L'APP. Chaque exemple porte « Exemple ·
 * » dans son nom et dit ce qu'il est (« ceci est un objectif… »), avec peu de
 * choses : deux tâches, un objectif et ses deux étapes, deux notes, une
 * habitude, et trois sujets du Savoir dont un mode d'emploi réel.
 *
 * Aucune tâche en retard, aucune échéance proche de la limite : la tâche datée
 * tombe dans cinq jours, la répétée n'a pas de date.
 */

export interface FicheExemple {
  titre: string;
  /** HTML riche, tel que l'éditeur du Savoir l'enregistre. */
  corps: string;
}

export interface SujetExemple {
  nom: string;
  couleur: string;
  fiches: FicheExemple[];
}

export interface NoteExemple {
  titre: string;
  /**
   * Le corps EN DEUX MORCEAUX : le jeton de mention vers la fiche se glisse
   * entre les deux, une fois l'uid de la fiche connu.
   *
   * ⚠️ Une mention ne peut pas être écrite d'avance : son identité est l'`uid`
   * de sa cible, qui n'existe qu'après création. Prétendre le contraire — un
   * gabarit avec un uid inventé — produirait une arête qui ne résout rien et un
   * jeton affiché « élément supprimé » dès le premier lancement.
   */
  avant: string;
  apres: string;
  /** La fiche citée : [indice du sujet, indice de la fiche dans ce sujet]. */
  cite: [number, number];
}

export interface TacheExemple {
  label: string;
  /** « daily » : jamais en retard (une occurrence manquée est manquée, pas en retard). */
  recurrence: "daily" | "none";
  priority: "low" | "medium" | "high";
  tag: string | null;
  /** Échéance dans N jours (`none` seulement) ; sinon pas de date. */
  echeanceDans: number | null;
  /** Rattachée à la première étape de l'objectif d'exemple. */
  auJalon: boolean;
  /** Reliée à la première note d'exemple (arête manuelle). */
  vers: "note" | null;
}

export interface EtapeExemple {
  titre: string;
  description: string;
  priority: "low" | "medium" | "high";
}

export interface ObjectifExemple {
  titre: string;
  description: string;
  etapes: EtapeExemple[];
}

export interface HabitudeExemple {
  nom: string;
  couleur: string;
}

export interface ContenuExemples {
  sujets: SujetExemple[];
  notes: NoteExemple[];
  taches: TacheExemple[];
  objectif: ObjectifExemple;
  habitude: HabitudeExemple;
}

/**
 * Le contenu, construit À L'APPEL.
 *
 * ⚠️ Une FONCTION, jamais une constante de module — PIEGES § 5.2 : un objet
 * calculé à l'import figerait ces textes dans la langue de démarrage.
 *
 * ⚠️ Ces textes-ci partent en BASE, pas à l'écran : ils sont traduits au moment
 * de la création et ne changent plus ensuite, comme n'importe quelle donnée
 * saisie.
 */
export function contenuExemples(): ContenuExemples {
  return {
    sujets: [
      {
        nom: t("Comment marche Shale"),
        couleur: "#4d8dff",
        fiches: [
          {
            titre: t("Les modules en une minute"),
            corps: [
              `<p>${t("Shale rassemble ce que tu fais, ce que tu vises et ce que tu retiens. Chaque module a un rôle :")}</p>`,
              "<ul>",
              `<li><strong>${t("Aujourd'hui")}</strong> : ${t("ce qui t'attend maintenant.")}</li>`,
              `<li><strong>${t("Tâches")}</strong> : ${t("tout ce que tu dois faire, rangé par moment. Une tâche peut se répéter.")}</li>`,
              `<li><strong>${t("Calendrier")}</strong> : ${t("il ne stocke rien, il rassemble tes tâches, tes créneaux et tes habitudes.")}</li>`,
              `<li><strong>${t("Timer")}</strong> : ${t("des sessions de concentration, avec un chrono.")}</li>`,
              `<li><strong>${t("Objectifs")}</strong> : ${t("un cap, découpé en étapes et en tâches ; l'avancement se calcule tout seul.")}</li>`,
              `<li><strong>${t("Performance")}</strong> : ${t("tes statistiques de la semaine.")}</li>`,
              `<li><strong>${t("Notes")}</strong> : ${t("du texte libre ; tape @ pour citer une tâche, un objectif ou une fiche.")}</li>`,
              `<li><strong>${t("Journal")}</strong> : ${t("tes habitudes, une case par jour à cocher.")}</li>`,
              `<li><strong>${t("Savoir")}</strong> : ${t("ce que tu veux garder, rangé par sujet. Cette fiche en fait partie.")}</li>`,
              "</ul>",
              `<p>${t("Rien n'est obligatoire : commence par les Tâches, et ajoute un module quand tu en as besoin.")}</p>`,
            ].join(""),
          },
          {
            titre: t("Tâche, objectif, étape : qui contient quoi"),
            corps: [
              `<p>${t("Trois niveaux, du plus large au plus petit :")}</p>`,
              "<ol>",
              `<li><strong>${t("Objectif")}</strong> : ${t("ce que tu veux atteindre, par exemple « Publier mon site ».")}</li>`,
              `<li><strong>${t("Étape")}</strong> : ${t("un morceau de l'objectif, par exemple « Écrire les textes ». Sa priorité — faible, moyenne ou élevée — dit par où commencer. Une étape qui en regroupe d'autres s'appelle une phase.")}</li>`,
              `<li><strong>${t("Tâche")}</strong> : ${t("un geste concret qu'on coche, par exemple « Rédiger la page d'accueil ». Elle se rattache à une étape.")}</li>`,
              "</ol>",
              `<p>${t("Quand tu coches les tâches, l'étape avance ; quand les étapes avancent, l'objectif avance. Tu n'as jamais à saisir un pourcentage.")}</p>`,
            ].join(""),
          },
        ],
      },
      {
        nom: t("Deep Work"),
        couleur: "#41c9e2",
        fiches: [
          {
            titre: t("Travailler en profondeur : mode d'emploi"),
            corps: [
              `<p>${t("Le travail en profondeur, c'est une période sans interruption sur une seule chose exigeante. Mode d'emploi :")}</p>`,
              "<ol>",
              `<li>${t("Choisis un seul sujet et écris-le en une phrase avant de commencer.")}</li>`,
              `<li>${t("Réserve un bloc de 60 à 90 minutes, à un moment où tu as de l'énergie.")}</li>`,
              `<li>${t("Coupe les notifications et ferme tout ce qui ne sert pas ce sujet.")}</li>`,
              `<li>${t("Lance le Timer de Shale : le chrono t'évite de surveiller l'heure.")}</li>`,
              `<li>${t("À la fin, écris deux lignes : ce qui a avancé, et par où reprendre.")}</li>`,
              "</ol>",
              `<p>${t("Un ou deux blocs par jour, c'est déjà beaucoup. Mieux vaut un bloc tenu que quatre prévus.")}</p>`,
            ].join(""),
          },
        ],
      },
      {
        nom: t("Mindset"),
        couleur: "#8e8bff",
        fiches: [
          {
            titre: t("La revue de fin de journée"),
            corps: [
              `<p>${t("Cinq minutes, le soir, toujours au même moment. Trois questions, dans cet ordre :")}</p>`,
              "<ol>",
              `<li>${t("Qu'est-ce qui a avancé aujourd'hui ?")}</li>`,
              `<li>${t("Qu'est-ce qui a coincé, et pourquoi ?")}</li>`,
              `<li>${t("Quelle est la première chose à faire demain ?")}</li>`,
              "</ol>",
              `<p>${t("La troisième question est celle qui compte : c'est elle qui fait que le lendemain commence sans hésiter.")}</p>`,
              `<p>${t("Faire la revue au même moment chaque soir la rend automatique.")}</p>`,
            ].join(""),
          },
        ],
      },
    ],
    notes: [
      {
        titre: t("Exemple · ceci est une note"),
        avant: `<p>${t("Une note, c'est du texte libre : une idée, un compte rendu, une liste. Tape @ pour citer une tâche, un objectif ou une fiche du Savoir — le lien se voit des deux côtés. Ici, la fiche citée est :")} `,
        apres: [
          "</p>",
          `<p>${t("La tâche « Exemple · tâche répétée chaque jour » est reliée à cette note : ouvre-la pour voir le lien.")}</p>`,
          `<p>${t("Tu peux tout effacer et écrire ta propre note.")}</p>`,
        ].join(""),
        cite: [0, 0],
      },
      {
        titre: t("Modèle · ma revue du soir"),
        avant: `<p>${t("Le modèle que je recopie chaque soir. La méthode est ici :")} `,
        apres: [
          "</p>",
          `<p><strong>${t("Ce qui a avancé")}</strong></p><p><br></p>`,
          `<p><strong>${t("Ce qui a coincé")}</strong></p><p><br></p>`,
          `<p><strong>${t("La première chose de demain")}</strong></p><p><br></p>`,
        ].join(""),
        cite: [2, 0],
      },
    ],
    taches: [
      {
        label: t("Exemple · tâche répétée chaque jour"),
        recurrence: "daily",
        priority: "medium",
        tag: null,
        echeanceDans: null,
        auJalon: false,
        vers: "note",
      },
      {
        label: t("Exemple · ceci est une tâche, rattachée à une étape"),
        recurrence: "none",
        priority: "medium",
        tag: null,
        echeanceDans: 5,
        auJalon: true,
        vers: null,
      },
    ],
    objectif: {
      titre: t("Exemple · ceci est un objectif"),
      description: t("Un objectif est un cap. Il se découpe en étapes, et chaque étape en tâches : l'avancement se calcule tout seul quand tu coches les tâches. Supprime-le quand tu as compris."),
      etapes: [
        {
          titre: t("Exemple · ceci est une étape"),
          description: t("Une étape est un morceau de l'objectif. Sa priorité (faible, moyenne, élevée) dit par où commencer."),
          priority: "high",
        },
        {
          titre: t("Exemple · une seconde étape"),
          description: t("Une étape avance quand ses tâches sont cochées."),
          priority: "low",
        },
      ],
    },
    habitude: {
      // ⚠️ AUCUNE heure ni durée dans ce nom (PIEGES § 4.4).
      nom: t("Exemple · habitude à cocher chaque jour"),
      couleur: "#8e8bff",
    },
  };
}

/**
 * Combien d'objets le contenu de départ crée, tels que le bouton les COMPTE.
 *
 * ⚠️ Le SUJET du Savoir n'entre pas dans ce compte, bien qu'il soit marqué :
 * c'est un contenant, et il n'est retiré que s'il est resté vide. Annoncer
 * « 5 exemples » puis n'en supprimer que 4 — parce que l'utilisateur a rangé
 * une fiche dans le sujet — donnerait un bouton qui mentirait de temps en
 * temps, ce qui est pire que de ne jamais compter le contenant.
 */
export const NOMBRE_EXEMPLES = 4;

// ─── Le filtre, et le seul endroit où il se décide ───────────────────────────

/** Vrai si cette ligne est du contenu de départ que personne n'a encore touché. */
export function estExemple(ligne: { is_example?: number } | null | undefined): boolean {
  return ligne?.is_example === 1;
}

/**
 * ⭐ La même liste, SANS les exemples — à poser sur toute entrée de STATISTIQUE.
 *
 * ⚠️ CE FILTRE NE SE POSE PAS SUR LES LISTES AFFICHÉES. Un exemple doit se
 * voir : c'est là tout son intérêt. Il ne doit pas se COMPTER. La frontière est
 * donc « est-ce que ce tableau alimente un chiffre ? », pas « est-ce que ce
 * tableau contient des tâches ? ».
 *
 * ⚠️⚠️ ET IL EST POSÉ AU FOND, PAS AUX APPELANTS. Les entrées de statistique de
 * `logic.ts` (`dayStat`, `pctOfList`, `effectiveProgress`) le portent
 * elles-mêmes, ce qui met en règle d'un coup `weekStats`, `computeStreak`,
 * `streakHistory` et `aggregateStats` — qui passent tous par elles — ainsi que
 * tout appelant futur. Le poser call site par call site aurait été une règle
 * écrite par ÉNUMÉRATION, et le § 7.2 ter de `PIEGES.md` dit ce qu'il advient
 * de celles-là : elles finissent par avoir un trou de la taille exacte de ce
 * qu'elles prétendaient tenir. Ici, le trou aurait été un anneau de discipline
 * légèrement faux — invisible, indémontrable, et jamais signalé par un test.
 */
export function sansExemples<T extends { is_example?: number }>(
  lignes: readonly T[],
): T[] {
  return lignes.filter((l) => !estExemple(l));
}
