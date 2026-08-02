# Second Brain — V2 "Jarvis"

## Vision
Transformer le dashboard V1 en assistant personnel type Jarvis : interface HUD futuriste,
pilotage vocal conversationnel, et modules couvrant toute la boucle de productivité
(capture → focus → exécution → journal → revue → stats).

## Décisions actées (2026-07-09)
- **Cerveau vocal : 100% local.** (Révisé le 2026-07-09 : l'option Claude API
  est abandonnée — rien ne quitte le Mac.) Whisper local (STT) → routeur
  d'intentions français (grammaire riche : tâches, objectifs, métriques, stats,
  navigation, aide, small talk) → TTS local (voix macOS). Pas de clé API.
- **Design : "Jarvis × Moov AI".** On garde la palette (#0e7df0 / #3cd9b0 / #0c0c0c)
  et les fonts (Outfit 800 + DM Sans), on ajoute les codes HUD : verre dépoli, glow,
  anneaux animés, coins tactiques, fond en grille, scanlines subtiles, fonte mono
  (JetBrains Mono) pour les chiffres et micro-labels, horloge live, écran de boot.
- **Modules : les 4 packs.** Capture & raccourcis, Focus & flow, Notes & journal,
  Pack trading.

## Architecture transverse
- **Registre d'actions** (`src/lib/actions.ts`) : catalogue unique d'actions nommées
  avec paramètres (ex. `task.add`, `task.complete`, `focus.start`, `note.create`,
  `trade.log`, `nav.goto`). Consommé par : palette ⌘K, raccourcis clavier,
  quick capture globale, et le routeur vocal (local + tools Claude).
- **Réglages** (`settings` table clé/valeur) : clé API, voix, préférences.
- Le mode démo navigateur reste maintenu pour tout nouveau module.

## Phases de build
- ✅ **A — Fondation visuelle Jarvis** : tokens HUD, verre dépoli, fond grille+scan,
  DisciplineRing façon arc reactor, sidebar HUD, horloge, écran de boot,
  barre de titre overlay.
- ✅ **B — Capture & raccourcis** : registre d'actions, palette ⌘K, ⌥Espace
  quick capture globale, icône tray (fermer = cacher), liens rapides.
- ✅ **C — Vocal Jarvis** : ⌥J push-to-talk global, micro natif (cpal),
  whisper.cpp local (modèle small q5 ~190 Mo, téléchargeable dans Réglages),
  routeur d'intentions FR 100% local (pas d'API), TTS voix macOS (Thomas),
  dock Jarvis permanent (orbe animé + conversation + saisie texte).
  Wake word ("Jarvis") en amélioration ultérieure.
- ✅ **D — Focus & flow** : `focus_sessions`, Pomodoro lié aux tâches (▶, palette,
  voix), overlay plein écran + chip, notifications + annonce vocale,
  focus par tag dans Performance, reprise après redémarrage.
- ✅ **E — Notes & journal** : notes markdown + [[liens]] + backlinks + FTS5,
  journal quotidien (humeur/énergie), habit tracker grille 12 semaines,
  revue hebdomadaire générant une note pré-remplie de stats.
- ✅ **F — Pack trading** : `trades` (instrument, direction, setup, R, screenshot
  via dialog + asset protocol), winrate/R total/R moyen, stats par setup,
  bump auto de la métrique "trades", intents vocaux (logger un trade, winrate).
- **G — Polish (reste à faire)** : icône app custom, sons UI discrets,
  export/backup, wake word.

## Modèle de données — ajouts prévus
```sql
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE notes (id, title, body, created_at, updated_at);         -- + FTS5
CREATE TABLE note_tags (note_id, tag);
CREATE TABLE journal_entries (id, date UNIQUE, mood INT, energy INT, body);
CREATE TABLE habits (id, name, color, archived);
CREATE TABLE habit_checks (habit_id, date, UNIQUE(habit_id, date));
CREATE TABLE focus_sessions (id, task_id, started_at, ended_at, kind);
CREATE TABLE trades (id, date, instrument, direction, setup, risk_r, result_r,
                     outcome, screenshot_path, notes);
CREATE TABLE quick_links (id, label, url, icon, position);
```

## Vocal — détail technique
- STT : `whisper-rs` (bindings whisper.cpp), modèle `small` multilingue quantisé
  (~500 Mo, téléchargé au premier lancement dans Application Support).
- Micro : capture côté Rust (cpal), 16 kHz mono.
- Intentions locales (regex/grammaire FR) : ajouter/cocher/supprimer tâche, streak,
  navigation, timer, métrique +1, note rapide. Latence < 1 s.
- Fallback Claude : `claude-sonnet-5` avec tools (lecture/écriture app),
  system prompt "Jarvis français, concis". Streaming de la réponse.
- TTS : `say` macOS (voix française) pour commencer ; Piper en option ensuite.
