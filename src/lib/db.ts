import Database from "@tauri-apps/plugin-sql";

// Le fichier est créé dans ~/Library/Application Support/com.atnfx.shale/
// Les migrations (src-tauri/migrations/) sont appliquées automatiquement au premier load.
let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:shale.db");
  }
  return db;
}
