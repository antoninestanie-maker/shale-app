// Déclarations minimales pour les TESTS de la couche de sync uniquement.
//
// Pourquoi ne pas installer `@types/node` ? Parce que TypeScript inclut
// automatiquement TOUS les paquets `@types` présents, donc les globales Node
// (`process`, `Buffer`…) deviendraient typées dans le code de l'APP, où elles
// n'existent pas à l'exécution — exactement le genre d'erreur qu'on veut que le
// compilateur continue d'attraper. Le projet a d'ailleurs déjà fait ce choix :
// `vite.config.ts` utilise `@ts-expect-error process is a nodejs global`.
//
// On déclare donc à la main le strict nécessaire, et rien d'autre.

/** Contenu brut d'un fichier .sql importé (`?raw` — géré par Vite/vitest). */
declare module "*.sql?raw" {
  const contenu: string;
  export default contenu;
}

/**
 * SQLite intégré à Node 22 — permet de tester les migrations et le journal de
 * changements sur une VRAIE base, sans dépendance native ni Tauri.
 * Surface volontairement réduite à ce que les tests utilisent.
 */
declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(chemin: string);
    exec(sql: string): void;
    prepare(sql: string): {
      all(...params: unknown[]): Record<string, unknown>[];
      get(...params: unknown[]): Record<string, unknown> | undefined;
      run(...params: unknown[]): { changes: number; lastInsertRowid: number };
    };
    close(): void;
  }
}
