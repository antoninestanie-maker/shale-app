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

export interface SujetExemple {
  nom: string;
  couleur: string;
}

export interface FicheExemple {
  titre: string;
  /** HTML riche, tel que l'éditeur du Savoir l'enregistre. */
  corps: string;
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
}

export interface TacheExemple {
  label: string;
  /**
   * ⭐ RÉCURRENTE, jamais datée. Deux raisons qui vont dans le même sens :
   *
   *   • une tâche récurrente n'a pas de date, donc ses occurrences manquées ne
   *     sont pas « en retard », elles sont manquées (`lib/taches.ts`). Un
   *     exemple ne peut donc jamais afficher de retard, ce que le cahier des
   *     charges interdit ;
   *   • `planificationDeSaisie()` refuse tout créneau à une récurrence, et
   *     c'est la règle du dépôt : on ne la contourne pas pour un exemple.
   */
  recurrence: "daily";
  priority: "low" | "medium" | "high";
  tag: string | null;
}

export interface HabitudeExemple {
  nom: string;
  couleur: string;
}

export interface ContenuExemples {
  sujet: SujetExemple;
  fiche: FicheExemple;
  note: NoteExemple;
  tache: TacheExemple;
  habitude: HabitudeExemple;
}

/**
 * Le contenu, construit À L'APPEL.
 *
 * ⚠️ Une FONCTION, jamais une constante de module — PIEGES § 5.2 : un objet
 * calculé à l'import figerait ces textes dans la langue de démarrage, et le
 * contenu de départ d'un utilisateur anglophone serait en français.
 *
 * ⚠️ Ces textes-ci partent en BASE, pas à l'écran : ils sont traduits au moment
 * de la création et ne changent plus ensuite, comme n'importe quelle donnée
 * saisie. Basculer l'app en anglais après coup ne les réécrit pas — et ne doit
 * pas : ce sont les notes de l'utilisateur, pas de l'interface.
 */
export function contenuExemples(): ContenuExemples {
  return {
    sujet: {
      nom: t("Méthode"),
      couleur: "#8e8bff",
    },
    fiche: {
      titre: t("La revue de fin de journée"),
      corps: [
        `<p>${t("Cinq minutes, le soir, toujours au même moment. Trois questions, dans cet ordre :")}</p>`,
        "<ol>",
        `<li>${t("Qu'est-ce qui a avancé aujourd'hui ?")}</li>`,
        `<li>${t("Qu'est-ce qui a coincé, et pourquoi ?")}</li>`,
        `<li>${t("Quelle est la première chose à faire demain ?")}</li>`,
        "</ol>",
        `<p>${t("La troisième question est celle qui compte : c'est elle qui fait que le lendemain commence sans hésiter.")}</p>`,
        `<p>${t("Faire la revue au même moment chaque soir la rend automatique. C'est aussi pour cela que l'habitude porte sur la RÉGULARITÉ de l'heure de coucher, et sur rien d'autre : une heure de coucher stable est ce qui rend le soir prévisible, donc utilisable.")}</p>`,
      ].join(""),
    },
    note: {
      titre: t("Ma revue du soir — modèle"),
      avant: `<p>${t("Le modèle que je recopie chaque soir. La méthode est ici :")} `,
      apres: [
        "</p>",
        `<p><strong>${t("Ce qui a avancé")}</strong></p><p><br></p>`,
        `<p><strong>${t("Ce qui a coincé")}</strong></p><p><br></p>`,
        `<p><strong>${t("La première chose de demain")}</strong></p><p><br></p>`,
      ].join(""),
    },
    tache: {
      label: t("Revue de fin de journée"),
      recurrence: "daily",
      priority: "medium",
      tag: null,
    },
    habitude: {
      // ⚠️ AUCUNE heure dans ce nom, et aucune durée. Une heure écrite en dur
      // ('23:00') serait juste en français et fausse en anglais (PIEGES § 4.4),
      // puisqu'elle partirait en base telle quelle. Et une durée de sommeil
      // inviterait à être réduite, là qu'une régularité invite à être tenue.
      nom: t("Me coucher à heure régulière"),
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
