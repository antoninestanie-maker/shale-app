import Database from "@tauri-apps/plugin-sql";
import { ecritureUtilisateur } from "./sync/verrou";

// Le fichier est créé dans le dossier de données de l'app, résolu par Tauri —
// JAMAIS un chemin écrit en dur. Concrètement :
//   macOS   ~/Library/Application Support/com.atnfx.shale/shale.db
//   iOS     <bac à sable>/Library/Application Support/com.atnfx.shale/shale.db
//           (vérifié sur simulateur le 2026-08-27 : les 19 migrations y ont
//            tourné, `_sqlx_migrations` en compte 19)
//
// ⚠️ Sur iOS, ce dossier est SAUVEGARDÉ PAR iCLOUD par défaut : `shale.db`
// partirait en clair chez Apple. Décision à prendre avant publication — poser
// l'attribut « exclure de la sauvegarde », ou l'assumer. Voir `MOBILE.md` § 2.4.
//
// Les migrations (src-tauri/migrations/) sont appliquées automatiquement au premier load.
let db: Database | null = null;
let gardee: Database | null = null;

/**
 * La connexion de TOUTE l'app — sauf de la synchronisation.
 *
 * ⚠️ Ses écritures passent par la porte de `sync/verrou.ts` (2026-10-20,
 * donnees-2) : pendant qu'une page reçue s'applique, les déclencheurs d'outbox
 * se taisent, et une écriture faite à cet instant ne serait jamais envoyée.
 * Elle attend donc la fin de l'application. Les lectures ne sont pas retenues.
 */
export async function getDb(): Promise<Database> {
  if (!gardee) {
    const brute = await getDbBrute();
    gardee = new Proxy(brute, {
      get(cible, cle, recepteur) {
        if (cle === "execute") {
          return (sql: string, params?: unknown[]) =>
            ecritureUtilisateur(() => cible.execute(sql, params));
        }
        const v = Reflect.get(cible, cle, recepteur);
        return typeof v === "function" ? v.bind(cible) : v;
      },
    });
  }
  return gardee;
}

/**
 * La connexion SANS la porte — réservée à la synchronisation (`useSync`), qui
 * ferme la porte elle-même : par `getDb`, elle s'attendrait pour toujours.
 */
export async function getDbBrute(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:shale.db");
  }
  return db;
}
