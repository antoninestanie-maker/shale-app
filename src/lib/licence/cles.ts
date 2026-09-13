// ─────────────────────────────────────────────────────────────────────────────
// Clés publiques qui font foi pour un profil de licence.
//
// La clé PRIVÉE correspondante ne vit pas dans ce dépôt, ni dans aucun dépôt :
// `~/Desktop/Shale-projet/administratif/licence-profils/` (voir le LISEZ-MOI
// de ce dossier et `tools/licence-profil.mjs`). Qui la détient peut émettre un
// profil pour n'importe quel compte.
//
// ⚠️ Cette constante est COMPILÉE dans le binaire : ajouter une clé exige un
// build ; retirer l'ancienne n'est sûr qu'une fois expirés tous les profils
// qu'elle a signés.
// ─────────────────────────────────────────────────────────────────────────────
import type { ClePubliqueJwk } from "./signature";

export const CLES_PRODUCTION: readonly ClePubliqueJwk[] = [
  // Clé n° 1, générée le 2026-09-13.
  {
    kty: "EC",
    crv: "P-256",
    x: "81XnA1xd_yv97kJZlX5qoH_SEQ3xlC6eLYohzkZKXVk",
    y: "UDWUoTU2inIe5sV-63DTZykggsv_pM3EPQ5Zbf1iLeA",
  },
];

/**
 * Clé du mode démo : ÉPHÉMÈRE, tirée au lancement de la preview navigateur et
 * jamais écrite nulle part. Elle n'est acceptée qu'en mode démo (ni Tauri, ni
 * authentification configurée) — voir `clesAcceptees()` dans `useProfil.tsx`.
 * Aucune clé privée de démo n'est donc commitée, et le binaire natif n'accepte
 * qu'une clé : la vraie.
 */
let cleDemo: ClePubliqueJwk | null = null;

export function poserCleDemo(cle: ClePubliqueJwk | null): void {
  cleDemo = cle;
}

export function lireCleDemo(): ClePubliqueJwk | null {
  return cleDemo;
}
