import { defineConfig } from "vitest/config";

// Configuration SÉPARÉE de `vite.config.ts` : la config de build de l'app ne doit
// pas dépendre du runner de tests (ni l'inverse). Aucun plugin React/Tailwind ici
// — tout ce qui est testé est du TypeScript pur, sans DOM ni JSX.
//
// `environment: "node"` suffit : Node 22 expose `globalThis.crypto` (WebCrypto),
// donc AES-GCM se teste tel qu'il tournera dans la webview, et `node:sqlite` est
// intégré, donc l'outbox et le moteur LWW se testent sur une vraie base SQLite
// en mémoire — sans dépendance native ni Tauri.
//
// Pas de `globals: true` : les tests importent explicitement `describe`/`it`/
// `expect` depuis "vitest", ce qui les rend typables par le `tsc` du build sans
// toucher au tsconfig de l'app.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Le schéma Supabase vit dans l'AUTRE dépôt (`~/Desktop/shale-site`), et les
    // tests le lisent tel quel plutôt que d'en garder une copie ici : une copie
    // divergerait, et c'est précisément le fichier qu'on ne peut pas se
    // permettre de valider dans une version qui n'est pas celle exécutée.
    server: { fs: { allow: [".."] } },
  },
});
