# Shale

App de productivité et de trading, **hors-ligne d'abord** : toutes les données
vivent dans un seul fichier SQLite sur la machine. macOS (Tauri v2 · Rust ·
React 19 · TypeScript · Tailwind v4) et iOS.

## Pour une session qui commence — l'ordre de lecture

| | | |
|---|---|---|
| 1 | **`PASSATION.md`** | ▶️ **COMMENCER ICI — LE FICHIER UNIQUE DE L'APP.** Il se suffit : ce qu'est Shale, comment elle est faite, où elle en est, ce qui reste, qui décide |
| 2 | **`DOCUMENTATION.md`** | ⭐ **la règle d'écriture, systématique à chaque session** — où va quoi, quand écrire, la liste de contrôle |
| 3 | **`PIEGES.md`** | le carnet des erreurs qui se répètent — à lire avant, à compléter pendant |
| 4 | **`CLAUDE.md`** | la référence permanente : les décisions et leur **pourquoi**, par ordre chronologique. C'est lui qui fait foi sur une intention |
| 5 | `MOBILE.md` · `DESIGN.md` · `DETTE-SITE.md` | iOS · le système visuel · ce que le site doit rattraper |
| 6 | `AMELIORATIONS-UI.md` · `RECETTE-*.md` | le catalogue UI non fait · les procédures d'acceptation |

> ⚠️ **Le 2026-09-18, les vingt-trois `PASSATION-*.md`, `AUDIT-*.md` et autres
> documents de chantier ont été repliés dans `PASSATION.md`** — § 16 dit
> lesquels et où leur contenu est parti. Git les conserve.

> **Écrire fait partie du travail.** Une session qui a modifié le projet et n'a
> rien consigné n'a pas fini — voir `DOCUMENTATION.md`.

## Commandes

```
npm run dev                                   # front seul, navigateur
npm run tauri dev                             # ⚠️ pilote la VRAIE base — voir PASSATION.md § 13.2
npm test                                      # 1206 tests (2026-09-18)
npm run i18n:check && npm run i18n:durs       # traductions
```
