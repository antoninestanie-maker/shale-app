// ─────────────────────────────────────────────────────────────────────────────
// `useIa()` — ce qu'un écran utilise pour appeler l'IA.
//
//   const ia = useIa();
//   if (!ia.visible) return null;                 // iOS, ou pas de Shale Pro sur un écran qui ne vend pas
//   const r = await ia.run("resumer", payload);   // typé par fonction
//
// Avant d'appeler le réseau, trois portes locales : le droit (`aIa`), l'IA
// allumée ET consentie, la famille de la fonction allumée. Elles ne protègent
// rien — le serveur fait foi — mais elles évitent d'envoyer quoi que ce soit
// tant que l'utilisateur n'a pas dit oui.
//
// ⚠️ iOS : les écrans d'IA sont HORS PÉRIMÈTRE de la V1 (cahier des charges
// § 9.5). `visible` est faux sur iPhone, et un bouton d'IA grisé « réservé à
// Pro » y serait en plus un appel à l'achat (règle 3.1.3(f), `lib/boutique.ts`).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useSession } from "../../components/auth/AuthGate";
import { SUPABASE_ANON_KEY } from "../auth/config";
import { useEntitlements } from "../entitlements";
import { MANAGED_ENDPOINT } from "../llm/provider";
import { IS_IOS } from "../platform";
import { isTauri } from "../repo";
import { FAMILLE_DE, type FonctionIa, type PayloadDe, type SortieDe } from "./contrats";
import { EVENEMENT_USAGE_IA } from "./compteur";
import { EVENEMENT_PREFS_IA, iaAutorisee, lirePrefsIa, PREFS_IA_DEFAUT, type PrefsIa } from "./reglages";
import { runAi, type ResultatIa, type UsageIa } from "./runAi";

/** Les réglages de l'IA, relus à chaque changement (ici ou sur un autre écran). */
export function usePrefsIa(): PrefsIa | null {
  const [prefs, setPrefs] = useState<PrefsIa | null>(null);
  useEffect(() => {
    let vivant = true;
    const relire = () => {
      lirePrefsIa()
        .then((p) => vivant && setPrefs(p))
        .catch(() => vivant && setPrefs(PREFS_IA_DEFAUT));
    };
    relire();
    window.addEventListener(EVENEMENT_PREFS_IA, relire);
    return () => {
      vivant = false;
      window.removeEventListener(EVENEMENT_PREFS_IA, relire);
    };
  }, []);
  return prefs;
}

/**
 * Un écran peut-il PROPOSER une action d'IA ? Shale Pro (ou son essai), hors
 * iOS. Pour les menus : une entrée d'IA n'y apparaît que si c'est vrai — elle
 * n'est jamais grisée « réservée à Pro » (ce serait une publicité à chaque clic).
 */
export function useIaPossible(): boolean {
  const { aIa } = useEntitlements();
  return !IS_IOS && aIa;
}

export interface Ia {
  /** L'écran peut-il montrer une action d'IA ? Faux sur iOS (V1). */
  visible: boolean;
  /** Le compte a-t-il Shale Pro (ou un essai Pro en cours) ? */
  aLeDroit: boolean;
  prefs: PrefsIa | null;
  run<F extends FonctionIa>(feature: F, payload: PayloadDe<F>): Promise<ResultatIa<SortieDe<F>>>;
}

export function useIa(): Ia {
  const { jetonFrais } = useSession();
  const { aIa } = useEntitlements();
  const prefs = usePrefsIa();

  const run = useCallback(
    async <F extends FonctionIa>(feature: F, payload: PayloadDe<F>): Promise<ResultatIa<SortieDe<F>>> => {
      if (!aIa) return { ok: false, code: "not_pro" };
      // Relu au moment du clic, pas celui du rendu : un réglage changé sur un
      // autre écran vaut tout de suite.
      const p = await lirePrefsIa().catch(() => PREFS_IA_DEFAUT);
      if (!iaAutorisee(p, FAMILLE_DE[feature])) return { ok: false, code: "disabled" };
      const r = await runAi(feature, payload, {
        demo: !isTauri,
        endpoint: MANAGED_ENDPOINT,
        cleAnon: SUPABASE_ANON_KEY,
        jeton: jetonFrais,
      });
      const usage: UsageIa | null = r.ok
        ? r.usage
        : typeof r.actionsLeft === "number"
          ? { actionsLeft: r.actionsLeft, resetsAt: r.resetsAt ?? null }
          : null;
      if (usage) window.dispatchEvent(new CustomEvent<UsageIa>(EVENEMENT_USAGE_IA, { detail: usage }));
      return r;
    },
    [aIa, jetonFrais],
  );

  return { visible: !IS_IOS, aLeDroit: aIa, prefs, run };
}
