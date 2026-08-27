import Database from "@tauri-apps/plugin-sql";

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

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:shale.db");
  }
  return db;
}
