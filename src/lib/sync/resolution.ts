/**
 * Résolution des conflits — last-write-wins par ligne.
 *
 * Pur, sans base ni réseau : c'est la règle qui décide, seule, si une donnée
 * survit ou disparaît. Elle mérite d'être lisible d'un bloc et prouvable.
 *
 * ─── CE QUE « DERNIER ÉCRIT GAGNE » VEUT DIRE ICI ──────────────────────────
 * On compare des horodatages d'ÉCRITURE (`client_ts`, UTC, milliseconde), pas
 * des dates d'arrivée. Une modification faite hors ligne mardi et envoyée
 * vendredi reste datée de mardi : elle ne doit pas écraser une modification
 * faite mercredi sur un autre appareil sous prétexte qu'elle arrive après.
 *
 * ⚠️ CE QUE CE CHOIX COÛTE, ET QU'IL FAUT ASSUMER. La granularité est LA LIGNE.
 * Si le même trade est modifié sur deux appareils — l'un corrige le résultat en
 * R, l'autre ajoute une note — le perdant perd TOUTE sa version, pas seulement
 * le champ en conflit. C'est le prix de la simplicité, arbitré au lancement du
 * chantier (usage mono-utilisateur multi-appareils, où les modifications
 * simultanées de la même ligne sont rares).
 */

/** Une version d'une ligne, telle qu'elle vient du serveur ou de l'outbox. */
export interface Version {
  /** Horodatage d'écriture, UTC ISO à la milliseconde. Tri lexicographique = tri chronologique. */
  ts: string;
  /** Appareil auteur. Départage les égalités parfaites. */
  device: string;
}

export type Verdict = "distant" | "local" | "identique";

/**
 * Qui gagne ?
 *
 * Le départage par `device` n'a aucun sens métier — il n'a qu'à être STABLE.
 * C'est ce qui compte : deux appareils qui appliquent cette fonction aux mêmes
 * données élisent le même vainqueur et convergent. Sans ce départage, chacun
 * garderait sa version en croyant avoir raison, et ils divergeraient pour
 * toujours. La même comparaison est écrite dans le trigger Postgres
 * (`sync.sql`) : les deux DOIVENT rester d'accord.
 */
export function arbitrer(distant: Version, local: Version): Verdict {
  if (distant.ts !== local.ts) return distant.ts > local.ts ? "distant" : "local";
  if (distant.device !== local.device) return distant.device > local.device ? "distant" : "local";
  return "identique";
}

/** Ce que le moteur doit faire d'une ligne reçue. */
export type Action = "appliquer" | "ignorer";

/**
 * Faut-il appliquer une ligne venue du cloud ?
 *
 * `enAttente` est la version locale NON ENCORE ENVOYÉE (entrée d'outbox), s'il y
 * en a une. C'est la seule chose qui puisse battre une ligne distante :
 *   • pas de modification locale en attente → on applique, sans se poser de
 *     question. La ligne distante est forcément au moins aussi récente que ce
 *     qu'on connaît, puisque le serveur refuse les écritures périmées ;
 *   • une modification locale en attente et PLUS RÉCENTE → on ignore la ligne
 *     distante. Notre envoi l'écrasera, et le serveur l'acceptera puisqu'elle
 *     est plus récente. Écraser notre version maintenant reviendrait à perdre
 *     une saisie que l'utilisateur vient de faire ;
 *   • une modification locale en attente mais PLUS ANCIENNE → on applique la
 *     distante. Notre envoi partira quand même et sera rejeté par le serveur,
 *     ce qui est sans conséquence.
 */
export function decider(distant: Version, enAttente: Version | null): Action {
  if (!enAttente) return "appliquer";
  return arbitrer(distant, enAttente) === "distant" ? "appliquer" : "ignorer";
}

/**
 * Horloge d'écriture, protégée contre une machine mal réglée.
 *
 * LE PROBLÈME. Un appareil dont l'horloge avance de deux ans gagnerait TOUS les
 * conflits, pour toujours — y compris contre des modifications faites après. Et
 * une horloge qui recule (changement d'heure mal géré, resynchronisation NTP,
 * pile morte) produirait des écritures que le serveur refuserait sans que
 * l'utilisateur comprenne pourquoi ses données ne partent plus.
 *
 * LA PARADE. L'horodatage émis ne recule jamais : il est au moins d'une
 * milliseconde supérieur au dernier connu. On ne corrige pas une horloge trop
 * en avance — c'est impossible sans référence — mais on garantit la
 * MONOTONIE, qui suffit à ce que les écritures d'un même appareil restent
 * toujours ordonnées entre elles.
 */
export function horodatageMonotone(maintenant: string, dernierVu: string | null): string {
  if (!dernierVu || maintenant > dernierVu) return maintenant;
  return incrementerMs(dernierVu);
}

/** `…T10:00:00.123Z` → `…T10:00:00.124Z`, en respectant les retenues. */
function incrementerMs(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return new Date(d.getTime() + 1).toISOString().replace(/(\.\d{3})Z$/, "$1Z");
}
