import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Serveur des CAPTURES du site (shale-site/vitrine/tools/shoot-v2.mjs), port 5199.
// Dans un worktree, `node_modules` est un lien vers celui du dépôt principal :
// sans `fs.allow`, vite refuse d'en servir les polices, et les captures sortent
// dans la police du système sans que rien ne le signale.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5199,
    strictPort: true,
    host: "127.0.0.1",
    fs: { allow: [".", "/Users/antonin/Desktop/Shale-projet/Shale/node_modules"] },
  },
});
