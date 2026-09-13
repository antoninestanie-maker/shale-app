// ─────────────────────────────────────────────────────────────────────────────
// Du profil stocké au profil APPLIQUÉ — logique pure, sans React ni base.
//
// Trois règles de préséance, et ce fichier ne sait en violer aucune :
//
//   1. Le PALIER fait foi sur ce qui est accessible. Ce fichier ne produit ni
//      `tier`, ni `hasTrading`, ni aucun droit : il ne rend que des masques,
//      un ordre et des libellés. Un profil ne peut donc rien déverrouiller —
//      l'impossibilité est dans le TYPE, pas dans une vérification.
//   2. Le profil ne peut que restreindre l'affichage, réordonner, renommer.
//   3. Absent, expiré, mal signé, illisible, émis pour un autre compte ou un
//      autre palier → profil INACTIF, c'est-à-dire le palier nu. Aucun cas ne
//      lève, aucun ne produit d'écran d'erreur. Le motif est conservé pour le
//      diagnostic (Réglages en mode démo, tests), jamais affiché comme une
//      alerte.
// ─────────────────────────────────────────────────────────────────────────────
import { MODULES_PROFIL, MODULE_NON_MASQUABLE, type ModuleProfil } from "./catalogue";
import { lirePayload, type LibelleClient } from "./payload";
import type { LigneProfil } from "./signature";

export type MotifProfil =
  | "actif"
  | "absent"
  | "autre-compte"
  | "signature"
  | "illisible"
  | "autre-palier"
  | "pas-encore-valide"
  | "expire";

export interface ProfilEffectif {
  actif: boolean;
  motif: MotifProfil;
  version: number | null;
  /** ISO — fin de validité du profil actif. */
  expireLe: string | null;
  masques: ReadonlySet<ModuleProfil>;
  /** Modules à placer en tête, dans cet ordre. Les autres suivent, inchangés. */
  ordre: readonly ModuleProfil[];
  libelles: Readonly<Record<string, LibelleClient>>;
  reglages: Readonly<Record<string, unknown>>;
  nomAffiche: string | null;
}

export function profilInactif(motif: Exclude<MotifProfil, "actif">): ProfilEffectif {
  return {
    actif: false,
    motif,
    version: null,
    expireLe: null,
    masques: new Set(),
    ordre: [],
    libelles: {},
    reglages: {},
    nomAffiche: null,
  };
}

/**
 * Tolérance d'horloge sur la date d'émission. Un poste en retard de quelques
 * minutes sur le serveur ne doit pas rejeter un profil qui vient d'être émis.
 * ⚠️ Aucune tolérance sur l'EXPIRATION : la prolonger, c'est prolonger un
 * contrat.
 */
export const TOLERANCE_EMISSION_MS = 5 * 60 * 1000;

export interface EntreeResolution {
  ligne: LigneProfil | null;
  /** Verdict de `signatureValide`, calculé en amont (c'est asynchrone). */
  signatureOk: boolean;
  /** Compte connecté. `null` = pas de compte : aucun profil ne s'applique. */
  userId: string | null;
  /** Palier EFFECTIF du compte, tel que le rend `entitlementsOf`. */
  tier: string;
  maintenant: number;
}

export function resoudreProfil(e: EntreeResolution): ProfilEffectif {
  const l = e.ligne;
  if (!l) return profilInactif("absent");
  if (!e.userId || l.uid !== e.userId) return profilInactif("autre-compte");
  // La signature AVANT toute lecture : on n'interprète pas un contenu dont on
  // ne connaît pas l'auteur, même pour en tirer une date.
  if (!e.signatureOk) return profilInactif("signature");

  const emis = Date.parse(l.issued_at);
  const expire = Date.parse(l.expires_at);
  if (!Number.isFinite(emis) || !Number.isFinite(expire)) return profilInactif("illisible");

  const payload = lirePayload(l.payload);
  if (!payload) return profilInactif("illisible");

  // Le palier fait foi : un profil émis pour une offre n'habille pas une autre.
  // Ce n'est pas qu'une précaution — un compte rétrogradé garde son cache
  // jusqu'à l'expiration, et ce cache ne doit pas continuer de décrire l'offre
  // qu'il n'a plus.
  if (l.tier !== e.tier) return profilInactif("autre-palier");
  if (emis > e.maintenant + TOLERANCE_EMISSION_MS) return profilInactif("pas-encore-valide");
  if (expire <= e.maintenant) return profilInactif("expire");

  const masques = new Set<ModuleProfil>();
  if (payload.modules.visible) {
    const blanche = new Set(payload.modules.visible);
    for (const m of MODULES_PROFIL) if (!blanche.has(m)) masques.add(m);
  }
  for (const m of payload.modules.hidden) masques.add(m);
  masques.delete(MODULE_NON_MASQUABLE);

  return {
    actif: true,
    motif: "actif",
    version: l.profile_version,
    expireLe: l.expires_at,
    masques,
    ordre: payload.modules.order.filter((m) => !masques.has(m)),
    libelles: payload.labels,
    reglages: payload.settings,
    nomAffiche: payload.branding.display_name,
  };
}

// ── Application ─────────────────────────────────────────────────────────────

/** Le module est-il affiché ? Toujours vrai pour ce qui n'est pas un module. */
export function moduleVisible(p: ProfilEffectif, id: string): boolean {
  return !p.masques.has(id as ModuleProfil);
}

/**
 * Libellé imposé par le profil pour une clé, dans la langue affichée — ou
 * `null`, et l'appelant garde son libellé habituel.
 *
 * Un libellé à une seule langue ne s'impose QUE dans cette langue : un client
 * qui a écrit « Réservations » n'a rien dit de l'app anglaise, et y afficher du
 * français serait exactement le défaut que `i18n:durs` traque partout ailleurs.
 */
export function libelleProfil(
  p: ProfilEffectif,
  cle: string,
  lang: "fr" | "en",
): string | null {
  if (!p.actif) return null;
  const l = p.libelles[cle];
  if (l === undefined) return null;
  if (typeof l === "string") return l;
  return l[lang] ?? null;
}

interface ModuleAffiche {
  id: string;
  visible: boolean;
  label?: string;
}

/**
 * Applique le profil à la liste des modules de Personnaliser.
 *
 * - un module masqué par le profil est RETIRÉ de la liste, pas passé à
 *   `visible: false` : sinon Personnaliser le montrerait avec un œil barré, et
 *   un clic le rendrait visible — l'utilisateur déferait la licence ;
 * - l'ordre du profil passe EN TÊTE ; l'utilisateur garde la main sur l'ordre
 *   de ce qui reste (décision du 2026-09-13) ;
 * - un libellé imposé REMPLACE le libellé personnalisé.
 *
 * `libelleDe` rend la clé i18n d'un module (sa phrase française) : ce fichier
 * ne connaît pas `Sidebar`.
 */
export function appliquerAuxModules<T extends ModuleAffiche>(
  modules: readonly T[],
  p: ProfilEffectif,
  lang: "fr" | "en",
  libelleDe: (id: string) => string | undefined,
): T[] {
  if (!p.actif) return [...modules];
  const restants = modules.filter((m) => moduleVisible(p, m.id));
  const rang = new Map(p.ordre.map((id, i) => [id as string, i]));
  const tete = restants
    .filter((m) => rang.has(m.id))
    .sort((a, b) => rang.get(a.id)! - rang.get(b.id)!);
  const queue = restants.filter((m) => !rang.has(m.id));
  return [...tete, ...queue].map((m) => {
    const cle = libelleDe(m.id);
    const impose = cle ? libelleProfil(p, cle, lang) : null;
    return impose ? { ...m, label: impose } : m;
  });
}
