// ─────────────────────────────────────────────────────────────────────────────
// Persistance de la session — ce qui survit à la fermeture de l'app.
//
// AVANT (jusqu'au 2026-08-12), `useAuth` écrivait la session ENTIÈRE dans
// `localStorage`, en clair, sous `shale.session` — et la relisait au démarrage
// en lui faisant confiance. Deux défauts, dont un exploitable :
//
//   1. `localStorage` est celui du moteur de rendu. Un objet JSON écrit à la
//      main depuis la console suffisait à faire croire à l'app qu'une session
//      existait, et elle s'ouvrait en entier (voir `useAuth.ts`, la validation
//      serveur ajoutée le même jour) ;
//   2. l'`access_token` y dormait pour rien. Il vit UNE HEURE : au prochain
//      démarrage il est presque toujours périmé, donc jamais réutilisable.
//
// ── CE QU'ON RANGE, ET OÙ ───────────────────────────────────────────────────
//
//   `refresh_token`  → TROUSSEAU SYSTÈME (Keychain / Credential Manager), via
//                      les commandes `secret_*` de `src-tauri/src/secrets.rs`.
//                      C'est le seul secret durable : qui le détient peut
//                      obtenir des jetons d'accès jusqu'à sa révocation.
//
//   `access_token`   → NULLE PART. Éphémère par construction ; on le redemande
//                      au démarrage, ce qui a l'avantage de VALIDER la session
//                      auprès du serveur au passage.
//
//   identité + date  → stockage clair (`localStorage`). Ce ne sont pas des
//   de vérification    secrets : un identifiant de compte et un horodatage. Les
//                      mettre au trousseau gaspillerait la place qui y est
//                      comptée (voir ci-dessous) sans rien protéger.
//
// ── POURQUOI PAS TOUT AU TROUSSEAU ──────────────────────────────────────────
// Parce que Windows a une limite dure. `src-tauri/src/secrets.rs` (branche
// `windows-build`) la documente : `CredWrite` plafonne le blob d'un identifiant
// à **2560 octets**, stockés en UTF-16 — soit ~1280 caractères utiles. Une
// session Supabase complète en JSON en fait ~1300 : on serait pile sur la
// limite, avec un échec silencieux le jour où Supabase allonge ses jetons. Un
// `refresh_token` seul fait une cinquantaine de caractères.
//
// ── MODÈLE DE MENACE ASSUMÉ ─────────────────────────────────────────────────
// Le trousseau protège contre la fuite PASSIVE : sauvegarde Time Machine,
// synchronisation iCloud du dossier de données, exfiltration d'un fichier, copie
// d'un disque. Il ne protège PAS contre un processus local tournant sous le même
// compte utilisateur : celui-là peut se faire passer pour l'app et demander
// l'entrée. C'est une limite du modèle desktop, pas un défaut d'implémentation —
// et c'est le même compromis que `lib/llm/secrets.ts` a déjà retenu pour les
// clés d'API.
//
// Quand le trousseau est indisponible (machine verrouillée, preview navigateur,
// configuration non standard), on retombe sur `localStorage` : une session en
// clair vaut mieux qu'une app inutilisable, et c'est exactement le repli déjà
// choisi pour les clés d'API. `stockageSecurise()` dit lequel des deux a servi,
// pour que l'interface puisse être honnête si on décide un jour de l'afficher.
// ─────────────────────────────────────────────────────────────────────────────

import { isTauri } from "../repo";
import type { Session } from "./supabase";

/** Clés de rangement. Distinctes de l'ancienne `shale.session`, effacée au passage. */
const CLE_REFRESH = "auth.refresh_token";
const CLE_META = "shale.auth.meta";
const CLE_LEGACY = "shale.session";

/** Ce qui accompagne le jeton, et qui n'a rien de secret. */
export interface MetaSession {
  userId: string;
  email: string;
  /** Dernière fois que le SERVEUR a confirmé cette session (epoch ms). */
  lastVerifiedAt: number;
  /**
   * Le serveur a-t-il confirmé que ce compte est ACTIVÉ ?
   *
   * ⚠️ C'est ce champ qui empêche le mode hors ligne de contourner
   * l'activation. Sans lui : on s'inscrit, on se voit refuser l'entrée, on
   * coupe le réseau, et le délai de grâce ouvre l'app pendant trente jours à
   * un compte qui n'a jamais eu le droit d'entrer.
   *
   * Absent (`undefined`) sur une méta écrite avant le 2026-08-13, et lu comme
   * « non activé » : la première ouverture après mise à jour redemandera donc
   * une connexion en ligne à qui était hors ligne. Un aller-retour réseau
   * contre un trou dans le mur, c'est le bon échange.
   */
  activated?: boolean;
}

let trousseauOk: boolean | null = null;

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/** Le trousseau système répond-il ? Faux hors Tauri. Constaté une fois par session. */
export async function trousseauDisponible(): Promise<boolean> {
  if (!isTauri) return false;
  if (trousseauOk !== null) return trousseauOk;
  try {
    trousseauOk = await invokeTauri<boolean>("secret_available");
  } catch {
    trousseauOk = false;
  }
  return trousseauOk;
}

/** Le jeton est-il rangé au trousseau, ou en clair ? Pour un affichage honnête. */
export async function stockageSecurise(): Promise<boolean> {
  return trousseauDisponible();
}

// ── Écriture ────────────────────────────────────────────────────────────────

export async function memoriser(
  session: Session,
  lastVerifiedAt: number,
  activated: boolean,
): Promise<void> {
  const meta: MetaSession = {
    userId: session.user.id,
    email: session.user.email,
    lastVerifiedAt,
    activated,
  };
  try {
    localStorage.setItem(CLE_META, JSON.stringify(meta));
    // L'ancienne clé portait la session complète, `access_token` compris. La
    // supprimer ici plutôt que dans une migration dédiée : ce code passe à
    // chaque connexion, donc le nettoyage a lieu même chez qui n'ouvre l'app
    // qu'une fois par mois.
    localStorage.removeItem(CLE_LEGACY);
  } catch {
    /* stockage indisponible : session mémoire uniquement */
  }

  if (await trousseauDisponible()) {
    try {
      await invokeTauri("secret_set", { key: CLE_REFRESH, value: session.refresh_token });
      return;
    } catch {
      /* le trousseau a refusé : on retombe en clair, plutôt que de perdre la session */
    }
  }
  try {
    localStorage.setItem(CLE_REFRESH, session.refresh_token);
  } catch {
    /* rien à faire : la session ne survivra pas à la fermeture */
  }
}

/**
 * Note que le serveur vient de confirmer l'activation du compte.
 *
 * Écrit la MÉTA SEULE, sans repasser par le trousseau : c'est un fait de plus
 * sur une session déjà rangée, pas une nouvelle session. L'ordre importe —
 * `memoriser` est appelée AVANT la vérification (pour ne pas perdre le
 * `refresh_token` que GoTrue vient de faire tourner), donc elle écrit toujours
 * `activated: false` d'abord. Si l'app est tuée entre les deux, ce qui reste
 * sur le disque dit « non activé », et le mode hors ligne refuse. Le sens de
 * l'erreur est le bon.
 */
export function marquerActive(): void {
  try {
    const brut = localStorage.getItem(CLE_META);
    if (!brut) return;
    const m = JSON.parse(brut) as MetaSession;
    localStorage.setItem(CLE_META, JSON.stringify({ ...m, activated: true }));
  } catch {
    /* stockage indisponible : le mode hors ligne redemandera une connexion */
  }
}

// ── Lecture ─────────────────────────────────────────────────────────────────

export function lireMeta(): MetaSession | null {
  try {
    const brut = localStorage.getItem(CLE_META);
    if (!brut) return null;
    const m = JSON.parse(brut) as MetaSession;
    // Une méta bricolée n'ouvre AUCUNE porte à elle seule — sans
    // `refresh_token` valide, aucun appel réseau n'aboutit. On la valide quand
    // même : c'est elle qui porte `lastVerifiedAt`, donc le délai de grâce
    // hors ligne, et un horodatage inventé le prolongerait.
    if (typeof m?.userId !== "string" || typeof m?.lastVerifiedAt !== "number") return null;
    return m;
  } catch {
    return null;
  }
}

export async function lireRefreshToken(): Promise<string | null> {
  if (await trousseauDisponible()) {
    try {
      const v = await invokeTauri<string | null>("secret_get", { key: CLE_REFRESH });
      if (v) return v;
    } catch {
      /* trousseau muet : on tente le repli en clair */
    }
  }
  try {
    return localStorage.getItem(CLE_REFRESH);
  } catch {
    return null;
  }
}

/**
 * Reprend un jeton laissé par une version antérieure.
 *
 * Sans ça, la mise à jour déconnecterait tout le monde d'un coup — sur une app
 * dont le mur d'entrée vient d'être posé, ce serait à la fois brutal et
 * indistinguable d'une panne.
 */
export function refreshTokenHerite(): string | null {
  try {
    const brut = localStorage.getItem(CLE_LEGACY);
    if (!brut) return null;
    const s = JSON.parse(brut) as Partial<Session>;
    return typeof s?.refresh_token === "string" ? s.refresh_token : null;
  } catch {
    return null;
  }
}

// ── Effacement ──────────────────────────────────────────────────────────────

/**
 * Purge tout ce qui permet de rouvrir une session.
 *
 * ⚠️ NE TOUCHE PAS À `shale.db`. Les données de travail appartiennent à
 * l'utilisateur : se déconnecter n'est pas se désinscrire, et une déconnexion
 * qui efface le journal de bord serait une perte irréversible pour un geste
 * qu'on fait parfois par simple prudence.
 */
export async function oublier(): Promise<void> {
  try {
    localStorage.removeItem(CLE_META);
    localStorage.removeItem(CLE_REFRESH);
    localStorage.removeItem(CLE_LEGACY);
  } catch {
    /* rien à nettoyer */
  }
  if (await trousseauDisponible()) {
    try {
      await invokeTauri("secret_delete", { key: CLE_REFRESH });
    } catch {
      /* l'entrée reste : elle sera écrasée à la prochaine connexion */
    }
  }
}
