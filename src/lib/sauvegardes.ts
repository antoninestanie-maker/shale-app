import { todayStr } from "./logic";
import { getSetting, isTauri, setSetting } from "./repo";

/**
 * Sauvegardes locales — la protection qui couvre le plus de cas.
 *
 * ─── POURQUOI ELLES PRIMENT SUR LE CLOUD ───────────────────────────────────
 * La base locale est en CLAIR : une copie datée se rouvre avec n'importe quel
 * outil SQLite, sans mot de passe, sans clé, sans réseau, sans Shale. C'est la
 * seule forme de sauvegarde qui survit à TOUT — mot de passe oublié, trousseau
 * vidé, compte supprimé, projet Supabase fermé.
 *
 * Et surtout, elle couvre le cas que le cloud ne couvre PAS : la suppression.
 * La synchronisation propage fidèlement un effacement — c'est son travail. Une
 * note jetée par erreur disparaît partout, et aucun appareil ne la ramènera.
 * Seule une copie antérieure le peut.
 *
 * Ce qu'elles ne couvrent pas : la perte du disque. Le dossier est ouvrable en
 * un clic depuis Réglages précisément pour qu'une copie parte ailleurs.
 */

/** Une sauvegarde sur le disque, telle que le Rust la décrit. */
export interface Sauvegarde {
  nom: string;
  octets: number;
  /** `YYYY-MM-DD HH:MM`, heure locale. */
  quand: string;
  /** `auto`, `avant-republication`, `avant-restauration`, `manuelle`… */
  motif: string;
}

/** Dernière sauvegarde automatique — propre à l'appareil, donc hors sync. */
const CLE_DERNIERE = "backup.last_at";

async function invoquer<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export async function creer(motif: string): Promise<string | null> {
  if (!isTauri) return null;
  return invoquer<string>("sauvegarde_creer", { motif });
}

export async function lister(): Promise<Sauvegarde[]> {
  if (!isTauri) return [];
  try {
    return await invoquer<Sauvegarde[]>("sauvegarde_lister");
  } catch {
    return [];
  }
}

export async function dossier(): Promise<string | null> {
  if (!isTauri) return null;
  try {
    return await invoquer<string>("sauvegarde_dossier");
  } catch {
    return null;
  }
}

/**
 * Programme une restauration. Elle N'EST PAS appliquée tout de suite.
 *
 * ⚠️ La base est ouverte : l'écraser maintenant corromprait le journal WAL. Le
 * Rust dépose le fichier à côté et le met en place au démarrage suivant, avant
 * que quoi que ce soit ne l'ouvre. L'appelant DOIT donc dire à l'utilisateur de
 * redémarrer — sinon il croira que rien ne s'est passé.
 */
export async function programmerRestauration(nom: string): Promise<void> {
  await invoquer("sauvegarde_programmer_restauration", { nom });
}

/**
 * Sauvegarde automatique, au plus une par jour.
 *
 * Au LANCEMENT, et non à la fermeture : une app qu'on force à quitter, qui
 * plante, ou dont la machine s'éteint ne sauvegarderait jamais. Au lancement,
 * la copie porte sur l'état laissé par la session précédente — exactement ce
 * qu'on veut pouvoir retrouver.
 *
 * Silencieuse : un échec ne doit jamais empêcher l'app de démarrer.
 */
export async function sauvegardeQuotidienne(): Promise<void> {
  if (!isTauri) return;
  try {
    // ⚠️ `todayStr()` (heure LOCALE) et jamais `toISOString().slice(0, 10)`.
    // Cette clé ne s'affiche nulle part — le nom du fichier est horodaté par le
    // Rust avec `chrono::Local` —, elle sert uniquement de verrou « une par
    // jour ». Mais en UTC la journée du verrou n'est pas celle de
    // l'utilisateur, et DEUX jours locaux peuvent tomber dans le MÊME jour
    // UTC : le second lancement est alors pris pour un doublon et la sauvegarde
    // est SAUTÉE. Rien n'est écrasé, c'est une copie qui n'existe pas.
    // À Paris la fenêtre est étroite (00 h–02 h). À Auckland (UTC+12/+13) elle
    // couvre l'après-midi et le soir : un lancement le soir puis un lancement le
    // lendemain matin ne produisent qu'UNE copie pour deux journées de travail.
    const aujourdhui = todayStr();
    if ((await getSetting(CLE_DERNIERE)) === aujourdhui) return;
    await creer("auto");
    await setSetting(CLE_DERNIERE, aujourdhui);
  } catch {
    /* disque plein, permissions : rien à faire de plus qu'attendre demain */
  }
}

/** Taille lisible — les octets bruts ne disent rien à personne. */
export function taille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} ko`;
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}
