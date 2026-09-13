// Fabriques partagées des tests de profil de licence.
import { genererPaire, signerLigne, type ClePubliqueJwk, type LigneProfil } from "./signature";

export const COMPTE = "11111111-1111-1111-1111-111111111111";
export const AUTRE_COMPTE = "22222222-2222-2222-2222-222222222222";
export const JOUR = 24 * 60 * 60 * 1000;

/** Horloge FIXE des tests de résolution — relative à rien de réel. */
export const MAINTENANT = Date.parse("2030-01-15T12:00:00.000Z");

export const PAYLOAD_COMPLET = {
  modules: { hidden: ["trading", "market"], order: ["notes", "tasks"] },
  labels: { "Tâches": "Missions", "Savoir": { fr: "Base documentaire", en: "Knowledge base" } },
  branding: { display_name: "Atelier Conseil" },
};

export interface Banc {
  cle: ClePubliqueJwk;
  signer: (partiel?: Partial<Omit<LigneProfil, "signature">>) => Promise<LigneProfil>;
}

export async function banc(): Promise<Banc> {
  const { privee, publique } = await genererPaire();
  return {
    cle: publique,
    signer: (partiel = {}) =>
      signerLigne(
        {
          uid: COMPTE,
          tier: "shale_trade",
          profile_version: 1,
          issued_at: new Date(MAINTENANT - 10 * JOUR).toISOString(),
          expires_at: new Date(MAINTENANT + 300 * JOUR).toISOString(),
          payload: JSON.stringify(PAYLOAD_COMPLET),
          ...partiel,
        },
        privee,
      ),
  };
}
