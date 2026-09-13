// ─────────────────────────────────────────────────────────────────────────────
// Le profil de licence du compte connecté : cache local, puis serveur.
//
// Ce composant ne DÉCIDE rien : il tient la ligne stockée et le verdict de sa
// signature. La décision (appliquer ou non, et quoi) est prise par
// `resolveEntitlements()` — un seul point d'entrée, pur, testé.
//
// Cycle de vie :
//   1. au montage, lecture du CACHE (table `license_profile`) → l'app s'ouvre
//      avec son profil même hors ligne, et sans attendre le réseau ;
//   2. dès que la session est en ligne, téléchargement → le cache est
//      remplacé, effacé, ou laissé tel quel (`decisionApresTelechargement`) ;
//   3. retour au premier plan (au plus toutes les 10 min) et toutes les 6 h :
//      nouveau téléchargement ;
//   4. un minuteur réveille la résolution À L'INSTANT où le profil expire :
//      l'app repasse au palier nu sans attendre un redémarrage.
//
// ⚠️ Monté par `AuthGate` et non importé par lui : ce fichier reçoit la session
// en props. `entitlements.ts` importe déjà `AuthGate` ; faire importer
// `AuthGate` ici fermerait un cycle d'imports.
// ─────────────────────────────────────────────────────────────────────────────
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AUTH_CONFIGURED } from "../auth/config";
import { effacerProfilLicence, ecrireProfilLicence, isTauri, lireProfilLicence } from "../repo";
import { CLES_PRODUCTION, lireCleDemo } from "./cles";
import { TOLERANCE_EMISSION_MS } from "./resoudre";
import { signatureValide, type ClePubliqueJwk, type LigneProfil } from "./signature";
import { decisionApresTelechargement, telechargerProfil } from "./transport";

export interface EtatProfil {
  ligne: LigneProfil | null;
  signatureOk: boolean;
  /** Horloge de la résolution — ne bouge qu'aux échéances du profil. */
  maintenant: number;
}

const ETAT_VIDE: EtatProfil = { ligne: null, signatureOk: false, maintenant: Date.now() };

const Contexte = createContext<EtatProfil | null>(null);

/** État du profil. Sans fournisseur (écrans d'avant connexion) : aucun profil. */
export function useEtatProfil(): EtatProfil {
  return useContext(Contexte) ?? ETAT_VIDE;
}

/**
 * Clés qui font foi. La clé éphémère du mode démo n'entre que dans la preview
 * navigateur SANS authentification : jamais dans le binaire natif, jamais face
 * au vrai backend.
 */
export function clesAcceptees(): readonly ClePubliqueJwk[] {
  const demo = !isTauri && !AUTH_CONFIGURED ? lireCleDemo() : null;
  return demo ? [...CLES_PRODUCTION, demo] : CLES_PRODUCTION;
}

const INTERVALLE_MS = 6 * 60 * 60 * 1000;
const PREMIER_PLAN_MIN_MS = 10 * 60 * 1000;
/** `setTimeout` déborde au-delà de 2³¹ − 1 ms (~24,8 jours) et part aussitôt. */
const TIMEOUT_MAX = 2 ** 31 - 1;

interface Props {
  userId: string | null;
  jetonFrais: () => Promise<string>;
  /** Vrai seulement quand le serveur a validé la session (`ready`). */
  enLigne: boolean;
  children: ReactNode;
}

export function ProfilProvider({ userId, jetonFrais, enLigne, children }: Props) {
  const [ligne, setLigne] = useState<LigneProfil | null>(null);
  const [signatureOk, setSignatureOk] = useState(false);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const dernierTelechargement = useRef(0);
  const jetonRef = useRef(jetonFrais);
  jetonRef.current = jetonFrais;

  const poser = useCallback((l: LigneProfil | null, ok: boolean) => {
    setLigne(l);
    setSignatureOk(ok);
    setMaintenant(Date.now());
  }, []);

  // ① Le cache.
  useEffect(() => {
    let annule = false;
    if (!userId) {
      poser(null, false);
      return;
    }
    void (async () => {
      const l = await lireProfilLicence(userId).catch(() => null);
      const ok = l ? await signatureValide(l, clesAcceptees()) : false;
      if (!annule) poser(l, ok);
    })();
    return () => {
      annule = true;
    };
  }, [userId, poser]);

  // ② Le serveur.
  const telecharger = useCallback(async () => {
    if (!userId || !enLigne || !AUTH_CONFIGURED) return;
    dernierTelechargement.current = Date.now();
    let jeton: string;
    try {
      jeton = await jetonRef.current();
    } catch {
      return; // pas de jeton : rien n'est su, rien ne change
    }
    const r = await telechargerProfil(jeton, userId);
    const ok = r.type === "profil" ? await signatureValide(r.ligne, clesAcceptees()) : false;
    const d = decisionApresTelechargement(r, ok, userId);
    if (d.action === "remplacer") {
      await ecrireProfilLicence(d.ligne).catch(() => {});
      poser(d.ligne, true);
    } else if (d.action === "effacer") {
      await effacerProfilLicence(userId).catch(() => {});
      poser(null, false);
    }
  }, [userId, enLigne, poser]);

  // ③ Quand retélécharger.
  useEffect(() => {
    if (!userId || !enLigne) return;
    void telecharger();
    const intervalle = window.setInterval(() => void telecharger(), INTERVALLE_MS);
    const auPremierPlan = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - dernierTelechargement.current < PREMIER_PLAN_MIN_MS) return;
      void telecharger();
    };
    document.addEventListener("visibilitychange", auPremierPlan);
    return () => {
      window.clearInterval(intervalle);
      document.removeEventListener("visibilitychange", auPremierPlan);
    };
  }, [userId, enLigne, telecharger]);

  // ④ Réveiller la résolution aux échéances du profil — et seulement là.
  // Un battement à la minute re-rendrait toute l'app soixante fois par heure
  // pour un changement qui arrive une fois par contrat.
  useEffect(() => {
    if (!ligne) return;
    const echeances = [Date.parse(ligne.expires_at), Date.parse(ligne.issued_at) - TOLERANCE_EMISSION_MS]
      .filter((t) => Number.isFinite(t) && t > Date.now());
    if (!echeances.length) return;
    const delai = Math.min(Math.min(...echeances) - Date.now() + 50, TIMEOUT_MAX);
    const id = window.setTimeout(() => setMaintenant(Date.now()), delai);
    return () => window.clearTimeout(id);
  }, [ligne, maintenant]);

  return (
    <Contexte.Provider value={{ ligne, signatureOk, maintenant }}>{children}</Contexte.Provider>
  );
}
