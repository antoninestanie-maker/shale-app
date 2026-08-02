#!/bin/bash
# Double-clique ce fichier pour ouvrir l'app Shale (mode développement).
# La fenêtre de l'app s'ouvre et se met à jour AUTOMATIQUEMENT à chaque modification.
# Garde cette fenêtre Terminal ouverte ; ferme-la pour fermer l'app.

cd "$(dirname "$0")" || exit 1
export PATH="$HOME/.cargo/bin:$PATH"   # rend Rust/cargo accessible

# Installe les dépendances au premier lancement si besoin.
if [ ! -d node_modules ]; then
  echo "Première installation des dépendances… (~1 min)"
  npm install || { echo "Échec de l'installation."; read -r; exit 1; }
fi

echo ""
echo "───────────────────────────────────────────────"
echo "  Ouverture de l'app Shale…"
echo "  ⚠️ Le TOUT PREMIER lancement compile le cœur Rust"
echo "     (quelques minutes). Les suivants sont rapides."
echo "  La fenêtre de l'app s'ouvrira toute seule."
echo "  Elle se met à jour à chaque modification du code."
echo "───────────────────────────────────────────────"
echo ""

npm run tauri dev
