// ─────────────────────────────────────────────────────────────────────────────
// Le compteur des Réglages : « X actions restantes, réinitialisation le … ».
//
// Lu dans `ai_usage` (migration 008), dont la RLS ne rend au compte que SA
// ligne. Le quota ne vient pas du serveur : il dépend de l'offre, que l'app
// connaît déjà (Pro 400 par mois, essai Pro 60 pour tout l'essai — valeurs
// gardées égales à celles du serveur par `contrat.test.ts`).
// Après chaque appel, la réponse de `ai` porte le vrai reste (`usage`) : il
// remplace ce calcul jusqu'au prochain rechargement.
// ─────────────────────────────────────────────────────────────────────────────

import { periodeIa, QUOTA_ESSAI, QUOTA_PRO, reinitialisationIa } from "./contrats";
import type { UsageIa } from "./runAi";

/** Diffusé par `useIa` après chaque réponse : le compteur affiché suit. */
export const EVENEMENT_USAGE_IA = "shale:ia-usage";

export interface DepsCompteur {
  url: string;
  cleAnon: string;
  jeton(): Promise<string>;
  fetch?: typeof fetch;
}

/** Le reste pour la période en cours, ou `null` si la lecture échoue. */
export async function lireCompteur(
  enEssai: boolean,
  finEssai: string | null | undefined,
  deps: DepsCompteur,
  maintenant = new Date(),
): Promise<UsageIa | null> {
  const periode = periodeIa(enEssai, maintenant);
  const quota = enEssai ? QUOTA_ESSAI : QUOTA_PRO;
  const resetsAt = reinitialisationIa(enEssai, finEssai, maintenant);
  try {
    const jeton = await deps.jeton();
    const r = await (deps.fetch ?? fetch)(
      `${deps.url}/rest/v1/ai_usage?select=actions_used&period=eq.${encodeURIComponent(periode)}`,
      { headers: { apikey: deps.cleAnon, authorization: `Bearer ${jeton}` } },
    );
    if (!r.ok) return null;
    const lignes = (await r.json()) as Array<{ actions_used?: number }>;
    const utilisees = Number(lignes[0]?.actions_used ?? 0);
    return { actionsLeft: Math.max(0, quota - utilisees), resetsAt };
  } catch {
    return null;
  }
}
