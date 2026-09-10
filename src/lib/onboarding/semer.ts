import { t } from "../i18n";
import { jetonMention } from "../mentions";
import { plainText } from "../richtext";
import {
  addHabit,
  createGoal,
  createKnowledgeEntry,
  createLink,
  createNote,
  createSujet,
  createTask,
  getSetting,
  marquerExemple,
  setSetting,
  synchroniserMentions,
  uidDe,
} from "../repo";
import { contenuExemples } from "./exemples";
import {
  CLE_ACCUEIL_FAIT,
  CLE_EXEMPLES_CREES,
  CLES_HORAIRES,
  ecrireReglages,
  type ReglagesHoraires,
} from "./reglages";

/**
 * Ce que l'accueil ÉCRIT — la seule partie du chantier qui touche à la base.
 *
 * ⚠️ Séparé de `exemples.ts` (le contenu) et de `grille.ts` (le calcul) pour
 * que ceux-là restent testables sans SQLite. Ici, tout passe par `repo.ts`,
 * donc tout marche aussi en mode démo : c'est ce qui permet de vérifier
 * l'accueil dans le navigateur sans piloter la vraie base d'Antonin.
 */

/** Horodatage local 'YYYY-MM-DD HH:MM:SS', le format de tout le dépôt. */
function maintenant(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

// ─── Le drapeau « accueil terminé » ──────────────────────────────────────────

/**
 * ⚠️ Repli LOCAL du drapeau, et il a deux emplois bien distincts :
 *
 *   ① la base n'est pas disponible (preview navigateur sans Tauri, ou lecture
 *      qui échoue) — mieux vaut ne pas rejouer l'accueil que de le rejouer ;
 *   ② ⭐ la MIGRATION des utilisateurs existants. `shale.onboarded` est la clé
 *      de l'ancien accueil (trois écrans marketing, purement décoratifs).
 *      Quiconque a déjà lancé l'app la porte à "1" dans son localStorage. Sans
 *      la reprendre, le passage à un drapeau en base rejouerait le nouvel
 *      accueil chez TOUS les utilisateurs existants, au prochain lancement.
 */
const CLE_LOCALE = "shale.onboarded";

function drapeauLocal(): boolean {
  try {
    return localStorage.getItem(CLE_LOCALE) === "1";
  } catch {
    return false;
  }
}

function poserDrapeauLocal(): void {
  try {
    localStorage.setItem(CLE_LOCALE, "1");
  } catch {
    /* stockage indisponible : le drapeau en base fait foi de toute façon */
  }
}

function retirerDrapeauLocal(): void {
  try {
    localStorage.removeItem(CLE_LOCALE);
  } catch {
    /* idem */
  }
}

/**
 * ⭐ L'accueil doit-il se jouer ?
 *
 * Le drapeau qui FAIT FOI vit dans `settings`, donc dans la couche de
 * synchronisation : un second Mac ou l'iPhone ne rejoue pas un accueil déjà
 * fait. Le repli local ne sert qu'aux deux cas ci-dessus.
 *
 * ⚠️ L'APPELANT DOIT AVOIR ATTENDU LE PREMIER CYCLE DE SYNCHRONISATION quand
 * un compte est connecté — voir `Accueil.tsx`. Sur un appareil neuf, la base
 * est vide AVANT le premier échange : décider ici sans attendre ferait
 * apparaître l'accueil deux secondes puis disparaître, ce qui est pire que les
 * deux comportements possibles.
 */
export async function accueilNecessaire(): Promise<boolean> {
  let enBase: string | null = null;
  try {
    enBase = await getSetting(CLE_ACCUEIL_FAIT);
  } catch {
    // Base illisible : on ne rejoue pas un accueil peut-être déjà fait.
    return !drapeauLocal();
  }
  if (enBase) {
    poserDrapeauLocal(); // le local rattrape la base, pour le prochain démarrage
    return false;
  }
  if (drapeauLocal()) {
    // ⭐ Utilisateur d'avant ce chantier : on reprend son drapeau plutôt que de
    // lui rejouer un accueil. Il pourra le lancer depuis les Réglages s'il veut
    // le voir. Écrit en base, donc propagé à ses autres appareils.
    await setSetting(CLE_ACCUEIL_FAIT, maintenant());
    return false;
  }
  return true;
}

/** Marque l'accueil comme terminé — que l'utilisateur l'ait suivi ou passé. */
export async function marquerAccueilFait(): Promise<void> {
  poserDrapeauLocal();
  await setSetting(CLE_ACCUEIL_FAIT, maintenant());
}

/**
 * Rejeu depuis les Réglages.
 *
 * ⚠️ N'EFFACE QUE LES QUATRE CLÉS HORAIRES et le drapeau. Ni l'objectif créé la
 * première fois, ni les exemples, ni la moindre donnée produite depuis : le
 * rejeu écrase des RÉGLAGES, il ne remet pas l'app à neuf. Et il ne touche pas
 * à `exemples.crees_at`, sans quoi rejouer l'accueil régénérerait un contenu de
 * départ que l'utilisateur a peut-être supprimé exprès.
 */
export async function rejouerAccueil(): Promise<void> {
  for (const cle of CLES_HORAIRES) await setSetting(cle, "");
  await setSetting(CLE_ACCUEIL_FAIT, "");
  retirerDrapeauLocal();
}

// ─── Ce que les réponses écrivent ────────────────────────────────────────────

/** Range les heures déclarées. Appelé aussi quand l'accueil est passé. */
export async function enregistrerReglages(r: ReglagesHoraires): Promise<void> {
  const ecritures = ecrireReglages(r);
  for (const [cle, valeur] of Object.entries(ecritures)) await setSetting(cle, valeur);
}

/** Toutes les clés de réglage de l'app, relues en une fois. */
export async function lireToutesLesCles(): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const cle of [...CLES_HORAIRES]) out[cle] = await getSetting(cle);
  return out;
}

/**
 * ⭐ L'objectif issu du curseur — le SEUL chiffre de gain de toute l'app, et il
 * vient de l'utilisateur.
 *
 * ⚠️ SANS ÉCHÉANCE, délibérément. Un objectif hebdomadaire n'a pas de date de
 * fin, et surtout : `objectifsEnPeril()` ne signale que ce qui a une échéance
 * (`lib/calendrier/peril.ts`). Lui en donner une ferait apparaître, une semaine
 * après l'installation, une alerte « objectif en péril » sur la toute première
 * chose que l'utilisateur ait dite à l'app.
 *
 * ⚠️ `manual_progress: 1` : personne ne peut mesurer « des heures récupérées »
 * à partir des tâches cochées. Le déclarer manuel est la seule lecture honnête ;
 * le laisser en mesuré afficherait 0 % pour toujours.
 */
export async function creerObjectifDuCurseur(heures: number): Promise<void> {
  if (heures <= 0) return;
  await createGoal({
    title: t("Récupérer {n} h par semaine", { n: heures }),
    description: null,
    scope: "medium",
    category: t("Temps"),
    parent_goal_id: null,
    deadline: null,
    progress_pct: 0,
    manual_progress: 1,
  });
}

/** La première tâche, saisie sur le dernier écran. Une étape, pas un écran de fin. */
export async function creerPremiereTache(label: string): Promise<void> {
  const propre = label.trim();
  if (!propre) return;
  await createTask({
    label: propre,
    tag: null,
    priority: "medium",
    recurrence: "none",
    goal_id: null,
  });
}

// ─── Le contenu de départ ────────────────────────────────────────────────────

/**
 * Les exemples ont-ils DÉJÀ été créés pour ce compte ?
 *
 * ⚠️ Le drapeau vit dans `settings`, donc il se synchronise. C'est toute la
 * différence avec une génération locale par appareil : les `uid` divergeraient,
 * on aurait deux jeux d'exemples, et supprimer ceux d'un appareil laisserait
 * ceux de l'autre. Le drapeau reste posé même après suppression — un contenu
 * de départ ne revient pas.
 */
export async function exemplesDejaCrees(): Promise<boolean> {
  try {
    return !!(await getSetting(CLE_EXEMPLES_CREES));
  } catch {
    // Base illisible : ne rien créer vaut mieux que créer en double.
    return true;
  }
}

/**
 * ⭐ Sème le parcours d'exemple — UNE SEULE FOIS PAR COMPTE.
 *
 * L'ordre n'est pas cosmétique : la fiche du Savoir doit exister AVANT la note,
 * parce que la mention de la note porte l'`uid` de la fiche, et qu'un `uid`
 * n'existe qu'après création (voir `NoteExemple` dans `exemples.ts`).
 *
 * ⚠️ Le drapeau est posé EN DERNIER. Une interruption au milieu laisse un
 * parcours partiel qui sera complété au prochain lancement — deux ou trois
 * objets en double au pire, tous marqués comme exemples, tous supprimables d'un
 * bouton. Le poser en premier laisserait un parcours amputé pour toujours, et
 * c'est ce qui se voit à l'écran.
 */
export async function semerExemples(): Promise<void> {
  if (await exemplesDejaCrees()) return;
  const c = contenuExemples();

  // ① Le sujet du Savoir. Marqué, mais à part : il n'entre pas dans le COMPTE
  // du bouton (un contenant n'est pas un objet du parcours) et il ne se
  // supprime que s'il est RESTÉ VIDE — sinon il emporterait les fiches que
  // l'utilisateur y aurait rangées depuis. Voir `repo.supprimerExemples`.
  const sujetId = await createSujet(c.sujet.nom, c.sujet.couleur);
  await marquerExemple("knowledge_topics", sujetId, true);

  // ② La fiche, dans ce sujet.
  const ficheId = await createKnowledgeEntry({
    topic_id: sujetId,
    kind: "note",
    title: c.fiche.titre,
    body: c.fiche.corps,
    text: plainText(c.fiche.corps),
  });
  await marquerExemple("knowledge_entries", ficheId, true);
  const ficheUid = await uidDe("knowledge", ficheId);

  // ③ La note, qui CITE la fiche. C'est la liaison que le parcours démontre :
  // deux objets qui se répondent sans jamais fusionner.
  const corps = ficheUid
    ? c.note.avant + jetonMention("knowledge", ficheUid, c.fiche.titre) + c.note.apres
    : c.note.avant + c.note.apres;
  const noteId = await createNote(c.note.titre, corps);
  await marquerExemple("notes", noteId, true);
  const noteUid = await uidDe("note", noteId);

  if (noteUid && ficheUid) {
    await synchroniserMentions("note", noteUid, [
      {
        from_kind: "note",
        from_uid: noteUid,
        to_kind: "knowledge",
        to_uid: ficheUid,
        origin: "mention",
      },
    ]);
  }

  // ④ La tâche, rattachée à la note À LA MAIN : une seconde origine d'arête,
  // visible au même endroit que la mention.
  const tacheId = await createTask({
    label: c.tache.label,
    tag: c.tache.tag,
    priority: c.tache.priority,
    recurrence: c.tache.recurrence,
    goal_id: null,
  });
  await marquerExemple("tasks", tacheId, true);
  const tacheUid = await uidDe("task", tacheId);
  if (tacheUid && noteUid) {
    await createLink({
      from_kind: "task",
      from_uid: tacheUid,
      to_kind: "note",
      to_uid: noteUid,
      origin: "manual",
    });
  }

  // ⑤ L'habitude de régularité du coucher.
  const habitudeId = await addHabit(c.habitude.nom, c.habitude.couleur);
  await marquerExemple("habits", habitudeId, true);

  await setSetting(CLE_EXEMPLES_CREES, maintenant());
}
