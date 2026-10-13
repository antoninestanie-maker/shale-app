import { aveugler, chiffrerLigne, dechiffrerLigne, type SousCles } from "./crypto";
import {
  appliquerLigne,
  ecrireMeta,
  enApplication,
  lireEtat,
  lireLigne,
  lireMeta,
  lireOutbox,
  memeVersion,
  noterEtat,
  ParentManquant,
  purgerOutbox,
  serialiser,
  supprimerLigne,
  type BaseLocale,
  type Ligne,
} from "./local";
import { aTraiter, type ChangementEnAttente } from "./outbox";
import { decider } from "./resolution";
import { TABLES_SYNC } from "./scope";
import type { LigneAEnvoyer, LigneDistante, Transport } from "./transport";

/**
 * Le moteur : envoyer ce qui attend, récupérer ce qui a changé, l'appliquer.
 *
 * ORDRE IMPOSÉ — envoi PUIS réception. L'inverse ferait appliquer une ligne
 * distante par-dessus une modification locale non encore partie, qui serait
 * alors perdue au lieu de gagner le conflit.
 *
 * Rien ici n'est sur le chemin critique d'une écriture utilisateur : l'app écrit
 * dans SQLite et rend la main ; ce moteur passe après, quand il peut.
 */

/** Au-delà, un lot risque de dépasser les limites de taille de requête. */
const TAILLE_LOT = 50;
const TAILLE_PAGE = 200;

/**
 * Pages tirées au plus dans un cycle — 5 000 lignes.
 *
 * ⚠️ Il en fallait une BORNE, mais surtout il fallait une BOUCLE : un seul
 * appel par cycle signifiait 200 lignes toutes les 90 secondes. Une base de
 * 5 000 lignes — quelques mois d'usage — aurait mis près de 40 minutes à
 * descendre sur un appareil neuf, l'app affichant pendant tout ce temps un état
 * « synchronisé » parfaitement sincère et parfaitement trompeur. Invisible en
 * test : le montage à deux appareils n'échange que quelques dizaines de lignes.
 */
const PAGES_MAX = 25;

export interface Contexte {
  db: BaseLocale;
  transport: Transport;
  cles: SousCles;
  userId: string;
  deviceId: string;
}

export interface Resultat {
  envoyees: number;
  recues: number;
  appliquees: number;
  /**
   * Orphelines en attente à la fin du cycle : reçues, mais leur parent n'est
   * pas (encore) sur cet appareil. Elles ne retiennent plus le curseur — voir
   * « Orphelines » plus bas.
   */
  enQuarantaine: number;
  ignorees: number;
  /**
   * Lignes que la clé actuelle n'ouvre pas — résidu d'une republication après
   * réinitialisation du mot de passe. Comptées à part des « ignorées » : une
   * ligne ignorée est un non-événement, une ligne illisible est une donnée
   * perdue, et les confondre masquerait la seconde derrière la première.
   */
  illisibles: number;
  /** Vrai si le plafond de pages a coupé court : il reste à tirer au prochain cycle. */
  resteATirer: boolean;
}

/** Clé sous laquelle voyage l'identifiant d'un réglage. */
const PREFIXE_SETTING = "st:";

// ─── Aveuglement des noms de tables ──────────────────────────────────────────

/**
 * Le serveur ne voit que des HMAC ; il faut donc pouvoir refaire le chemin
 * inverse à la réception. C'est possible parce que l'ensemble des tables est
 * FINI et connu : on calcule les 19 empreintes une fois et on garde le
 * dictionnaire. Un HMAC reste irréversible pour qui n'a pas la clé.
 */
async function dictionnaireTables(cles: SousCles): Promise<{
  versTag: Map<string, string>;
  versTable: Map<string, string>;
}> {
  const versTag = new Map<string, string>();
  const versTable = new Map<string, string>();
  for (const table of TABLES_SYNC) {
    const tag = await aveugler(cles.cleUid, "table", table);
    versTag.set(table, tag);
    versTable.set(tag, table);
  }
  return { versTag, versTable };
}

// ─── Envoi ───────────────────────────────────────────────────────────────────

/** Identifiant global d'une ligne, quelle que soit la forme de sa table. */
function uidDeLigne(table: string, ligne: Ligne): string | null {
  if (table === "settings") {
    const cle = ligne.key;
    return typeof cle === "string" ? PREFIXE_SETTING + cle : null;
  }
  return typeof ligne.uid === "string" ? ligne.uid : null;
}

async function preparerEnvoi(
  ctx: Contexte,
  versTag: Map<string, string>,
  c: ChangementEnAttente,
): Promise<LigneAEnvoyer | null> {
  const tableTag = versTag.get(c.table);
  if (!tableTag) return null;

  if (c.op === "delete") {
    if (!c.uid) return null;
    const rowTag = await aveugler(ctx.cles.cleUid, "uid", c.uid);
    // ⚠️ Une pierre tombale porte une charge, minuscule mais indispensable :
    // `row_tag` est un HMAC, donc irréversible. Sans l'identifiant chiffré à
    // l'intérieur, l'appareil qui la reçoit ne saurait pas QUELLE ligne
    // effacer chez lui.
    const meta = { userId: ctx.userId, table: tableTag, uid: rowTag, ts: c.ts };
    return {
      table_tag: tableTag,
      row_tag: rowTag,
      client_ts: c.ts,
      device_id: ctx.deviceId,
      deleted: true,
      payload: await chiffrerLigne(ctx.cles.cleLignes, { uid: c.uid }, meta),
    };
  }

  if (c.rowId == null) return null;
  const ligne = await lireLigne(ctx.db, c.table, c.rowId);
  // La ligne a disparu depuis que l'entrée a été écrite : il n'y a rien à
  // envoyer, et le trigger de suppression a déjà posé la pierre tombale.
  if (!ligne) return null;

  const uid = uidDeLigne(c.table, ligne);
  if (!uid) return null;

  const rowTag = await aveugler(ctx.cles.cleUid, "uid", uid);
  const meta = { userId: ctx.userId, table: tableTag, uid: rowTag, ts: c.ts };
  const charge = await serialiser(ctx.db, c.table, ligne);

  return {
    table_tag: tableTag,
    row_tag: rowTag,
    client_ts: c.ts,
    device_id: ctx.deviceId,
    deleted: false,
    payload: await chiffrerLigne(ctx.cles.cleLignes, charge, meta),
  };
}

async function envoyer(ctx: Contexte, versTag: Map<string, string>): Promise<number> {
  const entrees = await lireOutbox(ctx.db);
  const { aPousser, aPurger } = aTraiter(entrees);

  // Les écritures hors périmètre (réglages propres à l'appareil) ne partiront
  // jamais : les garder ferait enfler la file indéfiniment et mentirait à
  // l'indicateur d'état.
  if (aPurger.length) await purgerOutbox(ctx.db, aPurger);

  let envoyees = 0;
  for (let i = 0; i < aPousser.length; i += TAILLE_LOT) {
    const lot = aPousser.slice(i, i + TAILLE_LOT);

    // ── Une ligne serveur ne peut apparaître QU'UNE FOIS par envoi ──────────
    // `insert … on conflict do update` refuse d'affecter deux fois la même
    // ligne dans une seule commande : Postgres lève `21000` et **rejette tout
    // le lot**. `Prefer: resolution=merge-duplicates` n'y peut rien, il arbitre
    // entre le lot et la table, pas à l'intérieur du lot.
    //
    // Deux entrées de la file peuvent viser la même ligne serveur, parce que
    // `regrouper()` (voir `outbox.ts`) clé les suppressions par `uid` et les
    // créations par `rowid`. Supprimer puis recréer une ligne à uid
    // DÉTERMINISTE — `habit_checks` (`hc:<habitude>:<date>`) et
    // `metric_entries`, les deux seules — produit donc deux entités portant le
    // même uid, donc le même `row_tag`.
    //
    // On ne peut PAS régler ça dans `regrouper()` : l'uid d'une création y est
    // souvent `null` (voir le piège des triggers, `outbox.ts`), donc l'identité
    // logique n'y est pas toujours connue. Elle ne l'est qu'ICI, une fois le
    // `row_tag` calculé — c'est-à-dire à l'endroit exact où le serveur, lui,
    // tranchera. C'est donc ici que le dédoublonnage a sa place.
    //
    // Le vainqueur est le plus récent, à la même règle que le last-write-wins
    // du serveur : `client_ts`, puis l'ordre d'écriture local. Le perdant est
    // purgé avec le lot — il est superseded, pas perdu.
    const parLigneServeur = new Map<string, { ligne: LigneAEnvoyer; c: ChangementEnAttente }>();
    for (const c of lot) {
      const prete = await preparerEnvoi(ctx, versTag, c);
      // Rien à envoyer (ligne disparue, table inconnue) : l'entrée est quand
      // même purgée, sinon elle resterait bloquée en tête de file pour toujours.
      if (!prete) continue;

      const cle = `${prete.table_tag}|${prete.row_tag}`;
      const ancien = parLigneServeur.get(cle);
      if (
        !ancien ||
        prete.client_ts > ancien.ligne.client_ts ||
        (prete.client_ts === ancien.ligne.client_ts && c.jusquA > ancien.c.jusquA)
      ) {
        parLigneServeur.set(cle, { ligne: prete, c });
      }
    }

    const lignes = [...parLigneServeur.values()].map((v) => v.ligne);
    const retenus = [...parLigneServeur.values()].map((v) => v.c);

    // ⚠️ L'ordre compte : on n'efface la file QU'APRÈS un envoi accepté. Si le
    // réseau tombe ici, tout repart au prochain passage — le serveur ignorera
    // les doublons, son last-write-wins les reconnaît comme non plus récents.
    if (lignes.length) await ctx.transport.pousser(lignes);
    await purgerOutbox(ctx.db, lot);

    // Note OPTIMISTE : on enregistre ce qu'on vient d'envoyer comme étant ce que
    // le serveur détient. Il a pu le REFUSER (un autre appareil avait plus
    // récent) — auquel cas la version qu'on tirera ensuite ne correspondra pas
    // à cette note, et sera donc appliquée. L'erreur se corrige d'elle-même.
    for (const c of retenus) {
      await noterEtat(ctx.db, c.table, c.uid ?? "", c.ts, ctx.deviceId, null, c.op === "delete");
    }
    envoyees += lignes.length;
  }

  if (envoyees) await ecrireMeta(ctx.db, "last_push_at", new Date().toISOString());
  return envoyees;
}

// ─── Réception ───────────────────────────────────────────────────────────────

interface ARejouer {
  ligne: LigneDistante;
  table: string;
  uid: string;
  charge: Ligne;
}

/**
 * Applique une ligne reçue, ou la met de côté si son parent manque.
 * Renvoie `true` si elle a été traitée, `false` si elle attend.
 */
async function appliquerReçue(ctx: Contexte, item: ARejouer): Promise<boolean> {
  try {
    if (item.ligne.deleted) await supprimerLigne(ctx.db, item.table, item.uid);
    else await appliquerLigne(ctx.db, item.table, item.uid, item.charge);
  } catch (e) {
    if (e instanceof ParentManquant) return false;
    throw e;
  }
  await noterEtat(
    ctx.db,
    item.table,
    item.uid,
    item.ligne.client_ts,
    item.ligne.device_id,
    item.ligne.server_seq,
    item.ligne.deleted,
  );
  return true;
}

interface Tri {
  aAppliquer: ARejouer[];
  ignorees: number;
  illisibles: number;
}

/** Ouvre les lignes reçues et écarte celles qui n'ont rien à apporter. */
async function trier(
  ctx: Contexte,
  versTable: Map<string, string>,
  entreesEnAttente: Map<string, { ts: string; device: string }>,
  lignes: LigneDistante[],
): Promise<Tri> {
  const aAppliquer: ARejouer[] = [];
  let ignorees = 0;
  let illisibles = 0;

  for (const ligne of lignes) {
    const table = versTable.get(ligne.table_tag);
    // Table inconnue : écrite par une version plus récente de l'app. On ne sait
    // pas quoi en faire, mais on avance quand même le curseur — se bloquer
    // dessus arrêterait toute synchronisation.
    if (!table || !ligne.payload) {
      ignorees++;
      continue;
    }

    const meta = {
      userId: ctx.userId,
      table: ligne.table_tag,
      uid: ligne.row_tag,
      ts: ligne.client_ts,
    };
    // ⚠️ Une ligne INDÉCHIFFRABLE ne doit pas faire échouer le cycle entier.
    // Le cas se produit après une republication : les lignes scellées par
    // l'ancienne clé restent chez le serveur le temps d'être effacées. Sans
    // cette tolérance, le moteur relèverait une erreur à chaque tentative et
    // ne repartirait JAMAIS — un blocage définitif au lieu d'un résidu.
    //
    // On les compte comme ignorées et on laisse le curseur les dépasser : on
    // n'a pas la clé, on ne l'aura pas, il n'y a rien à en tirer. Les données
    // locales, elles, sont intactes.
    let charge: Ligne;
    try {
      charge = (await dechiffrerLigne(ctx.cles.cleLignes, ligne.payload, meta)) as Ligne;
    } catch {
      illisibles++;
      continue;
    }

    const uid = typeof charge.uid === "string" ? charge.uid : uidDeLigne(table, charge);
    if (!uid) {
      ignorees++;
      continue;
    }

    // Déjà connue DANS CETTE VERSION : re-tirer une page entière (curseur remis
    // à zéro, nouvel appareil) ne réécrit alors rien inutilement.
    //
    // ⚠️ La comparaison porte sur le COUPLE (horodatage, auteur). Sur le seul
    // horodatage, deux appareils qui écrivent dans la MÊME MILLISECONDE
    // divergent définitivement : le perdant de l'arbitrage reçoit la version du
    // gagnant, y reconnaît « son » horodatage, et garde la sienne. Bogue
    // reproduit en test, cf. migration 017.
    const connue = await lireEtat(ctx.db, table, uid);
    if (memeVersion(connue, ligne.client_ts, ligne.device_id)) {
      ignorees++;
      continue;
    }

    // La seule chose qui puisse battre une ligne distante : une modification
    // locale plus récente, pas encore partie. Voir `resolution.ts`.
    const enAttente = entreesEnAttente.get(`${table}|${uid}`) ?? null;
    if (decider({ ts: ligne.client_ts, device: ligne.device_id }, enAttente) === "ignorer") {
      ignorees++;
      continue;
    }

    aAppliquer.push({ ligne, table, uid, charge });
  }

  return { aAppliquer, ignorees, illisibles };
}

/**
 * Applique un lot, puis rejoue ce qui attendait.
 *
 * Un parent peut arriver après son enfant — dans la même page, ou dans une page
 * suivante du même cycle. On rejoue donc l'attente entière tant que ça
 * progresse ; ce qui reste attendra.
 */
async function appliquerLot(
  ctx: Contexte,
  lot: ARejouer[],
  attente: ARejouer[],
): Promise<{ appliquees: number; attente: ARejouer[] }> {
  let appliquees = 0;
  let reste = attente;

  await enApplication(ctx.db, async () => {
    const neuves: ARejouer[] = [];
    for (const item of lot) {
      if (await appliquerReçue(ctx, item)) appliquees++;
      else neuves.push(item);
    }
    reste = [...reste, ...neuves];

    // Rien d'appliqué : aucun parent n'a pu apparaître, inutile de rejouer.
    let progresse = appliquees > 0;
    while (reste.length && progresse) {
      const encore: ARejouer[] = [];
      progresse = false;
      for (const item of reste) {
        if (await appliquerReçue(ctx, item)) {
          appliquees++;
          progresse = true;
        } else encore.push(item);
      }
      reste = encore;
    }
  });

  return { appliquees, attente: reste };
}

// ─── Orphelines ──────────────────────────────────────────────────────────────

/**
 * Une orpheline est une ligne reçue dont le parent n'est pas sur cet appareil.
 *
 * ⚠️ DÉCISION RETOURNÉE le 2026-10-13. Jusque-là, le curseur ne dépassait
 * jamais une orpheline (« sinon elle ne reviendrait plus »), et la pagination
 * s'arrêtait sur elle. Deux cas rendaient cet arrêt DÉFINITIF, sans erreur ni
 * alerte :
 *
 *   · le parent n'a jamais été envoyé (incident réel : une habitude créée avant
 *     les triggers d'outbox, jamais modifiée depuis ; ses coches, elles,
 *     étaient parties) ;
 *   · le parent existe, mais à plus d'une page de son enfant (il a été modifié
 *     depuis, donc renuméroté plus loin par le serveur).
 *
 * L'appareil relisait alors les 200 mêmes lignes à chaque cycle et ne voyait
 * plus rien de ce qui suivait : six semaines de tâches manquantes sur un
 * iPhone, sous un indicateur « synchronisé ».
 *
 * Désormais le curseur avance TOUJOURS. Ce qui garantit qu'une orpheline
 * revienne, c'est son numéro de séquence, noté dans `sync_meta.orphelines` :
 *
 *   · dans le cycle, elle reste en mémoire et se rejoue après chaque page ;
 *   · entre deux cycles, elle est redemandée au serveur PAR SON NUMÉRO dès
 *     qu'une ligne a été appliquée (un parent ne peut arriver que par là).
 *     Sans rien de reçu, elle ne coûte aucune requête ;
 *   · si le serveur ne la rend plus sous ce numéro, c'est qu'elle a été
 *     modifiée ou supprimée : sa nouvelle version passe par le curseur comme
 *     n'importe quelle ligne, et l'ancien numéro est oublié.
 *
 * ⚠️ Le numéro est écrit AVANT que le curseur ne dépasse la ligne. Dans l'autre
 * ordre, une app tuée entre les deux écritures perdrait l'orpheline pour de
 * bon.
 *
 * ⚠️ « Il faut relire » est noté lui aussi (`orphelines_a_relire`), dès qu'une
 * ligne est appliquée alors que des orphelines attendent. Si la relecture
 * échoue (réseau coupé, app tuée), le cycle suivant la refait même s'il ne
 * reçoit rien : sans cette note, le parent arrivé resterait sans son enfant
 * jusqu'à la prochaine ligne reçue, quelle qu'elle soit.
 */
const CLE_ORPHELINES = "orphelines";
const CLE_A_RELIRE = "orphelines_a_relire";

async function lireOrphelines(db: BaseLocale): Promise<number[]> {
  const brut = await lireMeta(db, CLE_ORPHELINES);
  if (!brut) return [];
  try {
    const liste: unknown = JSON.parse(brut);
    if (!Array.isArray(liste)) return [];
    return liste.filter((n): n is number => Number.isInteger(n) && n > 0);
  } catch {
    // Illisible : on repart d'une liste vide plutôt que d'arrêter le cycle. Ce
    // qu'elle retenait est perdu pour cet appareil — pas pour le serveur.
    return [];
  }
}

function enTexte(seqs: Iterable<number>): string {
  return JSON.stringify([...new Set(seqs)].sort((x, y) => x - y));
}

// ─── Orchestration ───────────────────────────────────────────────────────────

/**
 * Un cycle complet. À appeler au démarrage, au retour du réseau, au retour au
 * premier plan et périodiquement — jamais depuis une action utilisateur.
 */
export async function synchroniser(ctx: Contexte): Promise<Resultat> {
  const { versTag, versTable } = await dictionnaireTables(ctx.cles);

  const envoyees = await envoyer(ctx, versTag);

  // ⚠️ La photographie des écritures en attente se prend APRÈS l'envoi, jamais
  // avant. Elle sert à protéger une saisie toute fraîche contre une ligne
  // distante plus ancienne — mais une écriture DÉJÀ ENVOYÉE n'est plus en
  // attente, et le serveur a pu la REJETER (un autre appareil avait plus
  // récent). La prendre avant conduisait à ceci, reproduit en test :
  //
  //   A et B modifient la même ligne hors ligne, B l'ayant fait en dernier.
  //   B envoie et gagne. A envoie, le serveur le refuse à juste titre. A tire
  //   alors la version de B, mais sa photographie prétend encore qu'il a une
  //   modification en attente, plus récente que celle de B — donc A l'ignore
  //   et garde la sienne. A affiche « version de A », B affiche « version de
  //   B », et plus aucune synchronisation ne les rapprochera jamais.
  //
  // Après l'envoi, la file ne contient plus que ce qui attend RÉELLEMENT — y
  // compris ce que l'utilisateur vient de saisir pendant que l'envoi courait.
  const entrees = await lireOutbox(ctx.db);
  const enAttente = new Map<string, { ts: string; device: string }>();
  for (const c of aTraiter(entrees).aPousser) {
    if (c.uid) enAttente.set(`${c.table}|${c.uid}`, { ts: c.ts, device: ctx.deviceId });
  }

  const total = { recues: 0, appliquees: 0, ignorees: 0, illisibles: 0 };
  let resteATirer = false;

  // Les orphelines des cycles précédents (leurs numéros), et celles de ce
  // cycle-ci (les lignes elles-mêmes, encore en mémoire).
  let retenues = await lireOrphelines(ctx.db);
  let aRelire = (await lireMeta(ctx.db, CLE_A_RELIRE)) === "1";
  let attente: ARejouer[] = [];
  let ecrit = enTexte(retenues);
  const noter = async () => {
    const texte = enTexte([...retenues, ...attente.map((i) => i.ligne.server_seq)]);
    if (texte === ecrit) return;
    await ecrireMeta(ctx.db, CLE_ORPHELINES, texte);
    ecrit = texte;
  };

  // On tire TANT QUE les pages sont pleines : le serveur en a alors encore, et
  // rendre la main ici ferait attendre 90 secondes pour les 200 suivantes.
  for (let page = 0; ; page++) {
    const curseur = Number((await lireMeta(ctx.db, "cursor")) ?? "0");
    const lignes = await ctx.transport.tirer(curseur, TAILLE_PAGE);
    if (!lignes.length) break;

    const tri = await trier(ctx, versTable, enAttente, lignes);
    const lot = await appliquerLot(ctx, tri.aAppliquer, attente);
    attente = lot.attente;

    total.recues += lignes.length;
    total.appliquees += lot.appliquees;
    total.ignorees += tri.ignorees;
    total.illisibles += tri.illisibles;

    // ⚠️ L'ordre compte : les orphelines d'abord, le curseur ensuite.
    await noter();
    if (retenues.length && lot.appliquees > 0 && !aRelire) {
      await ecrireMeta(ctx.db, CLE_A_RELIRE, "1");
      aRelire = true;
    }
    await ecrireMeta(ctx.db, "cursor", String(Math.max(...lignes.map((l) => l.server_seq))));
    await ecrireMeta(ctx.db, "last_pull_at", new Date().toISOString());

    if (lignes.length < TAILLE_PAGE) break;
    if (page + 1 >= PAGES_MAX) {
      // Le curseur a avancé : le prochain cycle reprendra exactement ici.
      resteATirer = true;
      break;
    }
  }

  // Les orphelines d'avant ce cycle : leur parent n'a pu arriver que si quelque
  // chose a été appliqué — dans ce cycle, ou dans un cycle précédent qui n'a
  // pas pu aller jusqu'ici. Sinon on ne demande rien.
  if (retenues.length && aRelire) {
    const relues = await ctx.transport.tirerParSeq(retenues);
    const tri = await trier(ctx, versTable, enAttente, relues);
    const lot = await appliquerLot(ctx, tri.aAppliquer, attente);
    attente = lot.attente;
    total.appliquees += lot.appliquees;
    // Ce que le serveur n'a pas rendu, ou qui n'avait plus rien à apporter,
    // n'est plus à retenir : la liste se refait depuis ce qui attend encore.
    retenues = [];
    await noter();
  }
  if (aRelire) await ecrireMeta(ctx.db, CLE_A_RELIRE, "0");

  const enQuarantaine = new Set([...retenues, ...attente.map((i) => i.ligne.server_seq)]).size;
  return { envoyees, ...total, enQuarantaine, resteATirer };
}
