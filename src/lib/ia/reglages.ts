// ─────────────────────────────────────────────────────────────────────────────
// Les réglages de l'IA : l'interrupteur général (ÉTEINT par défaut), le
// consentement, et un interrupteur par famille.
//
// Rangés dans la table `settings` comme les autres réglages, donc SYNCHRONISÉS
// (chiffrés) d'un appareil à l'autre : c'est l'utilisateur qui a consenti, pas
// sa machine. Clés :
//   ia.active       "1" | "0"
//   ia.consentement "<version>|<date ISO>" — la version du texte accepté
//   ia.familles     JSON { brief: true, capture: false, … } — absent = allumée
//
// ⚠️ Le consentement porte une VERSION. Si le texte de l'écran de consentement
// change sur le fond, on monte `VERSION_CONSENTEMENT` : les consentements
// antérieurs ne valent plus, l'IA se comporte comme éteinte, et l'écran se
// représente à la prochaine activation.
// ─────────────────────────────────────────────────────────────────────────────

import { getSetting, setSetting } from "../repo";
import { FAMILLES, type FamilleIa } from "./contrats";

export const VERSION_CONSENTEMENT = "v1";

const CLE_ACTIVE = "ia.active";
const CLE_CONSENTEMENT = "ia.consentement";
const CLE_FAMILLES = "ia.familles";

/** Diffusé à chaque écriture : les écrans ouverts relisent. */
export const EVENEMENT_PREFS_IA = "shale:ia-prefs";

export interface PrefsIa {
  active: boolean;
  /** Date du consentement à la version EN COURS, sinon `null`. */
  consentiLe: string | null;
  familles: Readonly<Record<FamilleIa, boolean>>;
}

export const PREFS_IA_DEFAUT: PrefsIa = {
  active: false,
  consentiLe: null,
  familles: Object.fromEntries(FAMILLES.map((f) => [f, true])) as Record<FamilleIa, boolean>,
};

/** Lecture pure, depuis les trois valeurs brutes. Tout ce qui est illisible
 *  retombe sur le plus prudent : éteint, sans consentement. */
export function prefsDepuis(active: string | null, consentement: string | null, familles: string | null): PrefsIa {
  let consentiLe: string | null = null;
  if (consentement) {
    const [version, date] = consentement.split("|");
    if (version === VERSION_CONSENTEMENT && date) consentiLe = date;
  }
  const f: Record<FamilleIa, boolean> = { ...PREFS_IA_DEFAUT.familles };
  if (familles) {
    try {
      const brut: unknown = JSON.parse(familles);
      if (typeof brut === "object" && brut !== null)
        for (const nom of FAMILLES) {
          const v = (brut as Record<string, unknown>)[nom];
          if (typeof v === "boolean") f[nom] = v;
        }
    } catch {
      /* illisible : les défauts */
    }
  }
  return { active: active === "1", consentiLe, familles: f };
}

/** L'IA peut-elle servir cette famille ? Active, consentie, famille allumée. */
export function iaAutorisee(p: PrefsIa, famille: FamilleIa): boolean {
  return p.active && p.consentiLe !== null && p.familles[famille];
}

export async function lirePrefsIa(): Promise<PrefsIa> {
  const [a, c, f] = await Promise.all([getSetting(CLE_ACTIVE), getSetting(CLE_CONSENTEMENT), getSetting(CLE_FAMILLES)]);
  return prefsDepuis(a, c, f);
}

function prevenir(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENEMENT_PREFS_IA));
}

/** Activer = consentir à la version en cours ET allumer, d'un seul geste. */
export async function activerIa(maintenant = new Date()): Promise<void> {
  await setSetting(CLE_CONSENTEMENT, `${VERSION_CONSENTEMENT}|${maintenant.toISOString()}`);
  await setSetting(CLE_ACTIVE, "1");
  prevenir();
}

/** Rallumer, le consentement en cours étant valable (même version). */
export async function rallumerIa(): Promise<void> {
  await setSetting(CLE_ACTIVE, "1");
  prevenir();
}

/** Éteindre garde le consentement : le rallumer ne redemande rien tant que le
 *  texte n'a pas changé. */
export async function desactiverIa(): Promise<void> {
  await setSetting(CLE_ACTIVE, "0");
  prevenir();
}

export async function reglerFamille(p: PrefsIa, famille: FamilleIa, allumee: boolean): Promise<void> {
  await setSetting(CLE_FAMILLES, JSON.stringify({ ...p.familles, [famille]: allumee }));
  prevenir();
}
