/**
 * Ce que l'éditeur de texte riche doit AFFICHER, et quand le (re)poser.
 *
 * ⚠️ POURQUOI CE MODULE EXISTE — le bogue du 2026-09-05.
 *
 * `RichNoteEditor` est un `contenteditable` : son contenu vit dans le DOM, pas
 * dans React. Il faut donc l'y écrire à la main, une fois par note. La question
 * « QUEL texte, et pour QUELLE note » se décidait jusqu'ici à l'intérieur d'un
 * `useEffect` — c'est-à-dire au seul endroit du code qu'aucun test de ce dépôt
 * ne peut atteindre, puisqu'ils tournent en `environment: "node"`.
 *
 * Elle s'y décidait mal. `NotesView` passait `corpsFrais ?? selected.body`, où
 * `corpsFrais` est le corps aux mentions rafraîchies, qui arrive EN DIFFÉRÉ et
 * n'était jamais remis à zéro au changement de note. À l'instant précis où
 * l'éditeur changeait de note, il recevait donc la nouvelle identité et
 * l'ANCIEN corps — et il écrivait le corps de la note A dans l'éditeur de la
 * note B. La première frappe rendait l'écrasement définitif.
 *
 * La décision est donc sortie du DOM et posée ici, en fonction pure. C'est le
 * même partage que `mentions.ts` / `mentionsDom.ts` : la logique d'un côté, le
 * contact avec le `document` de l'autre, court exprès.
 *
 * ⭐ L'INVARIANT QUE CE MODULE TIENT, ET QUI EST TOUT LE CORRECTIF :
 *    le HTML rendu appartient TOUJOURS à l'identifiant rendu.
 *    Jamais le corps d'une note dans la graine d'une autre.
 */

/**
 * Un corps rafraîchi, avec l'identité de la note dont il provient.
 *
 * ⚠️ C'est le fait de PORTER son identité qui répare le bogue. Un `string` nu
 * ne peut pas dire à quelle note il appartient — et c'est exactement ce qui a
 * permis au corps de A d'être servi pour B sans que rien ne s'en aperçoive.
 */
export interface CorpsRafraichi {
  id: number;
  html: string;
}

/**
 * Ce que l'éditeur doit poser dans le DOM.
 *
 * `cle` change UNIQUEMENT quand il faut réécrire le DOM. Elle ne bouge pas
 * quand l'utilisateur tape : réécrire le HTML pendant la frappe replacerait le
 * curseur au début de la note à chaque lettre.
 */
export interface Graine {
  cle: string;
  html: string;
}

/**
 * Quelle graine poser pour la note `id` ?
 *
 * @param id          la note actuellement affichée
 * @param corpsBrut   son corps tel qu'il sort de la base
 * @param frais       le corps aux mentions rafraîchies, s'il est déjà arrivé
 *
 * Deux cas :
 *
 *  1. le corps rafraîchi est arrivé ET il appartient bien à cette note
 *     → on pose le rafraîchi ;
 *  2. sinon → on pose le corps brut, qui est toujours le bon, jamais celui
 *     d'une autre note.
 *
 * ⚠️ Cette fonction ne dit QUE « quoi afficher ». Elle ne dit pas « faut-il le
 * reposer dans le DOM » — c'est `doitResemer`, et les mélanger coûte cher : la
 * clé se mettrait à revenir en arrière, et le DOM serait resemé par-dessus la
 * frappe de l'utilisateur.
 */
export function graineDeNote(
  id: number,
  corpsBrut: string,
  frais: CorpsRafraichi | null,
): Graine {
  if (frais && frais.id === id) {
    return { cle: `${id}:frais`, html: frais.html };
  }
  return { cle: `${id}:brut`, html: corpsBrut };
}

/**
 * Faut-il REPOSER la graine dans le DOM ?
 *
 * ⚠️ CETTE FONCTION EXISTE PARCE QUE J'AI RATÉ LE PREMIER ESSAI, et le défaut
 * ne s'est vu qu'à l'écran. J'avais mis « l'utilisateur a-t-il tapé ? » dans le
 * calcul de la graine elle-même : dès la première frappe, la clé repassait de
 * `frais` à `brut`, donc elle CHANGEAIT, donc le DOM était resemé — avec le
 * corps d'avant la frappe. Résultat : la lettre partait bien en base, et
 * disparaissait de l'écran. Un test de logique ne pouvait pas l'attraper, il
 * fallait regarder.
 *
 * La leçon tient en une phrase : **une clé de rechargement ne doit jamais
 * revenir en arrière.** « Quel contenu » et « faut-il le reposer » sont deux
 * questions distinctes, et elles sont désormais deux fonctions distinctes.
 */
export function doitResemer(etat: {
  /** la note affichée maintenant */
  idAffiche: number;
  /** la note dont le DOM porte le texte — `null` si rien n'a encore été posé */
  idDuDom: number | null;
  /** la graine qu'on voudrait poser */
  cle: string;
  /** celle qui a été posée en dernier */
  clePosee: string | null;
  /** l'utilisateur a-t-il tapé dans la note actuellement dans le DOM ? */
  aTape: boolean;
}): boolean {
  // On change de note : on repose TOUJOURS, même si l'utilisateur tapait.
  // Ce qu'il a tapé appartient à l'autre note et a déjà été mis en file.
  if (etat.idAffiche !== etat.idDuDom) return true;
  // Même note, même graine : il n'y a rien à faire.
  if (etat.cle === etat.clePosee) return false;
  // Même note, graine plus fraîche : on ne la pose que si l'utilisateur n'a
  // pas commencé à écrire — sinon on lui reprendrait ses mots et son curseur.
  return !etat.aTape;
}

/**
 * Le filet de sécurité : cette écriture vise-t-elle bien la note affichée ?
 *
 * ⚠️ CE FILET NE GARDE PAS LA MÊME CHOSE QUE LE CORRECTIF, et c'est voulu.
 * Dans le bogue du 2026-09-05, l'enregistrement visait la BONNE note — il y
 * écrivait simplement un texte qui n'était pas le sien. Comparer deux
 * identifiants de note n'aurait donc rien attrapé.
 *
 * Ce qu'on compare ici, c'est l'identité de la note dont le texte PROVIENT
 * (celle depuis laquelle le DOM a été semé) avec celle de la note affichée.
 * C'est cette paire-là qui divergeait, et c'est elle qui doit être gardée.
 *
 * ⚠️ ON REFUSE, ON NE CORRIGE PAS. Réorienter l'écriture « vers la bonne
 * note » masquerait le prochain défaut du même genre : on verrait une app qui
 * marche, au-dessus d'un code qui ment.
 */
export function ecritureAcceptable(
  idAffiche: number | null,
  idSourceDuTexte: number,
): boolean {
  return idAffiche !== null && idAffiche === idSourceDuTexte;
}

/**
 * Le message d'incident, quand une écriture est refusée.
 *
 * Volontairement en anglais et non traduit : il part dans la console de
 * développement, il ne s'affiche jamais à l'utilisateur, et une chaîne passée
 * à `t()` serait réclamée par `i18n:check` pour rien.
 */
export function messageEcritureRefusee(
  idAffiche: number | null,
  idSourceDuTexte: number,
): string {
  return (
    `Shale/notes: refused a write whose text came from note ${idSourceDuTexte} ` +
    `while note ${idAffiche ?? "none"} is displayed. Nothing was saved. ` +
    `This is the guard for the 2026-09-05 cross-note bug — please report it.`
  );
}
