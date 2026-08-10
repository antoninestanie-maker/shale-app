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
  /** Reçues mais mises de côté : leur parent n'est pas encore arrivé. */
  enQuarantaine: number;
  ignorees: number;
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

    const lignes: LigneAEnvoyer[] = [];
    const retenus: ChangementEnAttente[] = [];
    for (const c of lot) {
      const prete = await preparerEnvoi(ctx, versTag, c);
      // Rien à envoyer (ligne disparue, table inconnue) : l'entrée est quand
      // même purgée, sinon elle resterait bloquée en tête de file pour toujours.
      if (prete) {
        lignes.push(prete);
        retenus.push(c);
      }
    }

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

/** Une page. `pageComplete` dit s'il vaut la peine d'en redemander une autre. */
type Page = Omit<Resultat, "envoyees" | "resteATirer"> & { pageComplete: boolean };

async function recevoirUnePage(
  ctx: Contexte,
  versTable: Map<string, string>,
  entreesEnAttente: Map<string, { ts: string; device: string }>,
): Promise<Page> {
  const curseur = Number((await lireMeta(ctx.db, "cursor")) ?? "0");
  const lignes = await ctx.transport.tirer(curseur, TAILLE_PAGE);
  if (!lignes.length)
    return { recues: 0, appliquees: 0, enQuarantaine: 0, ignorees: 0, pageComplete: false };

  const aAppliquer: ARejouer[] = [];
  let ignorees = 0;

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
    const charge = (await dechiffrerLigne(ctx.cles.cleLignes, ligne.payload, meta)) as Ligne;
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

  let appliquees = 0;
  let quarantaine: ARejouer[] = [];

  await enApplication(ctx.db, async () => {
    for (const item of aAppliquer) {
      if (await appliquerReçue(ctx, item)) appliquees++;
      else quarantaine.push(item);
    }

    // Un parent peut arriver dans la même page, mais après son enfant. On
    // rejoue tant que ça progresse ; ce qui reste attend la prochaine fois.
    let progresse = true;
    while (quarantaine.length && progresse) {
      const reste: ARejouer[] = [];
      progresse = false;
      for (const item of quarantaine) {
        if (await appliquerReçue(ctx, item)) {
          appliquees++;
          progresse = true;
        } else reste.push(item);
      }
      quarantaine = reste;
    }
  });

  // ⚠️ Le curseur ne DÉPASSE PAS une ligne encore en quarantaine, sinon elle ne
  // reviendrait jamais et l'orphelin serait perdu sans bruit.
  const seqMax = Math.max(...lignes.map((l) => l.server_seq));
  const seqBloquant = quarantaine.length ? Math.min(...quarantaine.map((i) => i.ligne.server_seq)) : null;
  await ecrireMeta(ctx.db, "cursor", String(seqBloquant !== null ? seqBloquant - 1 : seqMax));
  await ecrireMeta(ctx.db, "last_pull_at", new Date().toISOString());

  return {
    recues: lignes.length,
    appliquees,
    enQuarantaine: quarantaine.length,
    ignorees,
    // ⚠️ Une quarantaine RETIENT le curseur : redemander une page renverrait
    // exactement les mêmes lignes, indéfiniment. L'orpheline attend le cycle
    // suivant, où son parent aura pu arriver.
    pageComplete: lignes.length === TAILLE_PAGE && seqBloquant === null,
  };
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

  // On tire TANT QUE les pages sont pleines : le serveur en a alors encore, et
  // rendre la main ici ferait attendre 90 secondes pour les 200 suivantes.
  const total = { recues: 0, appliquees: 0, enQuarantaine: 0, ignorees: 0 };
  let resteATirer = false;

  for (let page = 0; ; page++) {
    const r = await recevoirUnePage(ctx, versTable, enAttente);
    total.recues += r.recues;
    total.appliquees += r.appliquees;
    total.enQuarantaine += r.enQuarantaine;
    total.ignorees += r.ignorees;

    if (!r.pageComplete) break;
    if (page + 1 >= PAGES_MAX) {
      // Le curseur a avancé : le prochain cycle reprendra exactement ici.
      resteATirer = true;
      break;
    }
  }

  return { envoyees, ...total, resteATirer };
}
