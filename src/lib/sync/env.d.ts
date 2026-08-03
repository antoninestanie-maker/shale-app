// Déclarations pour les TESTS de la couche de sync.
//
// ⚠️ `node:sqlite` N'EST PLUS DÉCLARÉ ICI. Il l'était, pour éviter d'installer
// `@types/node` — dont l'inclusion automatique ferait passer `process` et
// `Buffer` pour valides dans le code de l'app, où ils n'existent pas. Mais
// `@types/node` est arrivé en dépendance TRANSITIVE (vite, vitest, happy-dom) :
// la déclaration maison entrait alors en conflit avec la vraie, et c'est la
// vraie qui gagnait.
//
// La parade est ailleurs, et elle est meilleure : `"types": []` dans
// `tsconfig.json` coupe l'inclusion automatique des globales. Les modules Node
// importés NOMMÉMENT continuent de se résoudre, avec leurs vrais types.

/** Contenu brut d'un fichier .sql importé (`?raw` — géré par Vite/vitest). */
declare module "*.sql?raw" {
  const contenu: string;
  export default contenu;
}
