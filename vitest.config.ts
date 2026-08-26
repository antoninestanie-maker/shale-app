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

    // ── Délais ────────────────────────────────────────────────────────────────
    // Trois fichiers (`auth/activation.sql`, `auth/admin.sql`, `sync/supabase`)
    // montent une instance Postgres COMPLÈTE dans leur `beforeAll` — PGlite, plus
    // le rejeu de `schema.sql`, `admin.sql` et `activation.sql` lus dans l'autre
    // dépôt. C'est lent par nature : 10 à 30 s selon la charge.
    //
    // Les valeurs par défaut de vitest (5 s pour un test, 10 s pour un hook) sont
    // calibrées pour du test unitaire pur. Ici elles produisaient des échecs
    // INTERMITTENTS — « Hook timed out in 10000ms » — qui n'avaient rien à voir
    // avec le code testé : le hook perdait simplement la course au processeur
    // contre les 24 autres fichiers de la suite.
    //
    // ⚠️ Un échec intermittent est pire qu'un échec franc : il apprend à ne plus
    // lire la sortie des tests. Constaté pendant le chantier adaptatif du
    // 2026-08-26 — la suite échouait 0, 1, 2 ou 4 fois selon la passe, avec le
    // MÊME code, ce qui a coûté quatre exécutions A/B pour établir qu'aucune
    // régression n'était en cause.
    //
    // 60 s reste assez court pour dénoncer un vrai blocage, et assez long pour
    // qu'une machine chargée ne fasse pas échouer un test qui passe.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
