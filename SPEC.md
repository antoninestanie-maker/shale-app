# Second Brain — Dashboard personnel (V1)

## Objectif
App Mac installable, type "second cerveau" pour la productivité quotidienne : tâches, objectifs, suivi de performance. 100% locale, aucune donnée envoyée en ligne.

## Stack technique
- **Tauri v2** (Rust + webview système, léger, natif Mac)
- **Frontend** : React + Vite + TailwindCSS
- **Stockage** : SQLite local (via `tauri-plugin-sql`), fichier stocké dans le dossier Application Support de l'app
- **Graphiques** : Recharts

## Design system (cohérent avec les projets Moov AI / atn.fx existants)
- Fonts : Outfit (800, titres/chiffres) + DM Sans (body)
- Couleurs :
  - `--bg`: #0c0c0c
  - `--surface`: #141414
  - `--surface-2`: #1a1a1a
  - `--text`: #f4efe5
  - `--text-dim`: #8a8a85
  - `--blue`: #0e7df0
  - `--green`: #3cd9b0
  - `--border`: rgba(255,255,255,0.07)
- Coins arrondis 16px sur les cards, 100px sur les pills/badges
- Élément signature : "Discipline Ring" — anneau de progression circulaire combinant % de tâches du jour complétées + streak, affiché en hero du dashboard

## Scope V1 (socle)

### 1. Vue "Aujourd'hui" (dashboard principal)
- Discipline Ring (voir ci-dessus)
- Streak (jours consécutifs avec ≥80% des tâches faites)
- Liste des tâches du jour (checkbox, tag/catégorie, ajout rapide)
- Aperçu des objectifs en cours (barres de progression)
- Mini graphique des 7 derniers jours (% complétion quotidien)

### 2. Module Tâches
- CRUD complet (créer, éditer, supprimer, cocher)
- Catégories/tags personnalisables (couleur par tag)
- Tâches récurrentes (quotidien, jours spécifiques de la semaine)
- Priorité (haute/moyenne/basse)
- Vue "toutes les tâches" avec filtres (par tag, par statut, par date)

### 3. Module Objectifs
- Hiérarchie : Long terme → Moyen terme → Court terme
- Champs : titre, description, deadline, % de progression (manuel ou calculé depuis sous-objectifs/tâches liées)
- Lien optionnel objectif ↔ tâches
- Vue Kanban ou liste (à trancher ensemble)

### 4. Module Performance
- Graphique de complétion des tâches (jour / semaine / mois) — barres
- Historique des streaks
- Graphique de progression par objectif dans le temps
- Métriques custom (l'utilisateur peut ajouter un compteur : ex. "heures de backtesting", "trades pris", "reels publiés")

## Modèle de données (SQLite)

```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  tag TEXT,
  priority TEXT CHECK(priority IN ('low','medium','high')) DEFAULT 'medium',
  recurrence TEXT, -- 'daily', 'weekdays', 'none', ou JSON de jours
  goal_id INTEGER, -- lien optionnel vers objectifs
  created_at TEXT,
  FOREIGN KEY (goal_id) REFERENCES goals(id)
);

CREATE TABLE task_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  done BOOLEAN DEFAULT 0,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  scope TEXT CHECK(scope IN ('short','medium','long')),
  parent_goal_id INTEGER, -- hiérarchie
  deadline TEXT,
  progress_pct INTEGER DEFAULT 0,
  manual_progress BOOLEAN DEFAULT 1,
  FOREIGN KEY (parent_goal_id) REFERENCES goals(id)
);

CREATE TABLE custom_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT
);

CREATE TABLE metric_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  value REAL,
  FOREIGN KEY (metric_id) REFERENCES custom_metrics(id)
);
```

## Roadmap (après la V1)
- Base de connaissances (notes liées, tags, recherche full-text)
- Journal quotidien (réflexion, humeur, énergie)
- Habit tracker visuel (grille type contributions GitHub)
- Section liens/ressources rapides
- Export/import des données (backup manuel)
- Raccourci clavier global pour ouvrir une "quick capture" (ajouter une tâche/note sans ouvrir l'app en entier)

## Étapes de build recommandées pour Claude Code
1. `npm create tauri-app@latest` → template React + TypeScript
2. Installer Tailwind, configurer les tokens du design system ci-dessus
3. Configurer `tauri-plugin-sql` + créer les migrations SQLite ci-dessus
4. Construire la vue "Aujourd'hui" en premier (c'est l'écran vu à chaque ouverture)
5. Construire le module Tâches (CRUD + récurrence)
6. Construire le module Objectifs (hiérarchie + progression)
7. Construire le module Performance (graphiques Recharts)
8. `npm run tauri build` → génère le `.app` installable dans `src-tauri/target/release/bundle/macos/`

## Notes de contexte utilisateur
- Utilisateur le plus productif le soir, tendance à procrastiner → l'app doit réduire la friction de démarrage de session (vue "Aujourd'hui" doit être immédiate, pas de clics inutiles)
- Contexte : trading (BTS CRCI en apprentissage, transition vers trading full-time en septembre) + création de contenu (atn.fx, ChartCore.fx, Moov AI)
- Cohérence de marque : réutiliser exactement la palette et les fonts déjà utilisées pour Moov AI
