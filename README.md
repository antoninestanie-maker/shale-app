# Shale

App de productivité et de trading, **hors-ligne d'abord** : toutes les données
vivent dans un seul fichier SQLite sur la machine. macOS (Tauri v2 · Rust ·
React 19 · TypeScript · Tailwind v4) et iOS.

## Pour une session qui commence — l'ordre de lecture

| | | |
|---|---|---|
| 1 | **`PASSATION.md`** | ▶️ **COMMENCER ICI** — où en est le projet, ce qui reste, qui décide |
| 2 | **`DOCUMENTATION.md`** | ⭐ **la règle d'écriture, systématique à chaque session** — où va quoi, quand écrire, la liste de contrôle |
| 3 | **`PIEGES.md`** | le carnet des erreurs qui se répètent — à lire avant, à compléter pendant |
| 4 | **`CLAUDE.md`** | la référence permanente : les décisions et leur pourquoi. C'est lui qui fait foi |
| 5 | **`BILAN-CALENDRIER-LIAISONS.md`** | ce qui a été livré du 2026-09-02 au 2026-09-04 |
| 6 | `MOBILE.md` · `DESIGN.md` · `DETTE-SITE.md` | iOS · le système visuel · ce que le site doit rattraper |

> **Écrire fait partie du travail.** Une session qui a modifié le projet et n'a
> rien consigné n'a pas fini — voir `DOCUMENTATION.md`.

## Commandes

```
npm run dev                                   # front seul, navigateur
npm run tauri dev                             # ⚠️ pilote la VRAIE base — voir CLAUDE.md
npm test                                      # 553 tests
npm run i18n:check && npm run i18n:durs       # traductions
```
