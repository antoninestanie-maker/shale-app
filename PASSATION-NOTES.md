# Passation — chantier H, « le contenu d'une note se retrouve dans une autre »

*2026-09-05 23:00 → 2026-09-06 13:00. Branche `chantier/notes-contenu`, fusionnée
en avance rapide sur `mobile-ios` : `324a222` → **`95f0e00`**, poussée.*

---

## 1. L'état, en un écran

| | |
|---|---|
| Le bogue | **corrigé**, et les neuf scénarios sont au vert **vus à l'écran** |
| Les dégâts | ⭐ **aucun** — constat au § 4, comparaison uid par uid |
| Commits | `42a515d` (la cause + le filet) · `95b1db3` (l'enregistrement à la fermeture) · `95f0e00` (les fiches d'objets) |
| Ligne de base | **570 / 570** front (553 + 17 neufs), **129** Rust, les trois cibles, `tsc`, `test:types`, `i18n:check`, `i18n:durs`, `vite build` — tout vert |
| ⛔ **Build natif** | **PAS FAIT, et c'est voulu** — voir § 5 |
| ⛔ **Synchro iPhone** | **PAS VÉRIFIÉE** — voir § 6 |
| Sauvegarde | `shale-backups/avant-correctif-notes-20260905-2107/`, deux copies `.backup`, `integrity_check` ok |

---

## 2. Ce que c'était

**Pas l'enregistrement.** Il a toujours visé la bonne note ; il y écrivait un
texte qui n'était pas le sien.

`NotesView` passait `corpsFrais ?? selected.body` à l'éditeur. `corpsFrais`
arrive **en différé** et n'était **jamais remis à zéro au changement de note**.
`RichNoteEditor` remplit son `contenteditable` dans un effet qui ne dépend que de
`[noteId]` : au basculement il recevait la **nouvelle identité** et l'**ancien
corps**, et restait ensuite sourd à l'arrivée du bon.

**Aucun minutage.** Dès la deuxième note ouverte, l'éditeur montrait le texte de
la précédente. La frappe rendait l'écrasement définitif.

Le détail complet, les contre-épreuves et le raisonnement sont dans `CLAUDE.md`,
section datée du 2026-09-05/06. Le piège réutilisable est dans `PIEGES.md`
§ 6.5 (la prop différée) et § 6.6 (la doc qui décrit le voisin).

---

## 3. Les neuf scénarios, après correctif

Tous rejoués **à l'écran**, en mode démo, sur le port 5203.

| # | Scénario | Avant | Après |
|---|---|---|---|
| 1 | Taper, changer de note avant 700 ms | ✅ passait déjà | ✅ `RAPIDE-A` dans A seule |
| 2 | Fermer l'éditeur (téléphone) | ✅ passait déjà | ✅ toujours juste |
| 3 | Fermer l'app entièrement | ⚠️ non tranché | ⚠️ **partiel** — voir ci-dessous |
| 4 | Créer une note pendant l'édition | ❌ affichait le corps d'une autre | ✅ note vide, texte d'invite |
| 5 | Supprimer pendant l'édition | ✅ passait déjà | ✅ pas de résurrection |
| 6 | Ouvrir A, ouvrir B, sans rien taper | ❌ B montrait A | ✅ B montre B |
| 7 | Rouvrir depuis la liste filtrée | ❌ | ✅ |
| 8 | Ouvrir depuis la palette ⌘K | ❌ | ✅ |
| 9 | Ouvrir en cliquant une mention `@` | ❌ | ✅ |

⚠️ **Le n°3 reste partiel, et je l'écris plutôt que de conclure.** Ce qui est
vérifié : le flush part au démontage du module et écrit dans la bonne note
(texte tapé → changement de module immédiat → retour : le texte est là). Ce qui
ne l'est pas : le vrai « quitter l'app en moins de 700 ms ». En mode démo les
données vivent en mémoire et meurent avec la page — fermer l'onglet efface aussi
le témoin. Il faudrait l'app native sur la vraie base.

### ⚠️ Le premier correctif était faux

Il mettait « l'utilisateur a-t-il tapé » dans le calcul de la graine, si bien que
la clé de rechargement **revenait en arrière** à la première frappe : le DOM était
resemé avec le texte d'avant, et la lettre partait en base **en disparaissant de
l'écran**. **Les tests étaient verts.** C'est la recherche de `MARQUE-SETUP` dans
l'app qui l'a montré.

▶️ C'est la démonstration du § 7.1 de `PIEGES.md` : *aucun test de ce dépôt ne
prouve une interface.*

---

## 4. Le constat des dégâts — ⭐ aucun

Fait **en lecture seule sur les copies**, jamais sur la base vivante.

Comparaison **uid par uid** (jamais par `id`, qui est local) contre la sauvegarde
automatique du **2026-08-30**, antérieure au chantier C qui a introduit le bogue :

| | |
|---|---|
| Notes inchangées **à l'octet près** | 6 |
| Notes enrichies | 2 — « Amélioration Shale » (18 778 → 19 881) et « Amélioration site » (181 → 250) |
| « Nouvelle note » vides supprimées | 9 |
| Notes créées depuis | 5 |
| Une note contenant le corps d'une **autre** | **0** |
| Index FTS5 `notes_fts` | **intègre** |
| Lignes en attente dans l'outbox | **0** |

⚠️ **Un faux positif à connaître pour la prochaine fois.** Mon premier contrôle a
signalé « Amélioration site » comme *remplacée*, parce qu'il cherchait l'ancien
corps **en préfixe** du nouveau. La modification était une insertion **au
milieu** (« Chargement de la 3d+vrai mac et vrai iPhone »). Un contrôle par
préfixe ne prouve pas un remplacement : il faut lire les deux textes.

▶️ **Rien n'a été perdu, et rien n'a été réparé** : aucune note d'Antonin n'a été
modifiée par ce chantier. Le bogue a vécu quatre jours sur son Mac (rebuild du
2026-09-04 11:51) sans mordre, parce qu'il faut **taper par-dessus** la note mal
affichée pour que l'écrasement devienne réel. Il a donc vu le symptôme
d'affichage, pas une perte.

**Référence de l'étape zéro, retrouvée à l'identique en fin de chantier :**
13 notes · 45 835 octets de corps · 188 octets de titres · 0 note sans uid.

---

## 5. ⛔ Le build natif n'est pas fait — décision d'Antonin

**L'app installée d'Antonin n'a donc PAS le correctif.** Elle date du
2026-09-04 11:51 et porte encore le bogue.

C'est **délibéré**. La session voisine [G-calendrier-v2] avait aussi besoin d'un
build ; deux builds séparés, c'est deux fois la fenêtre de trousseau que macOS
ouvre dès que le binaire change (`PIEGES.md` § 8.3), et **aucune session ne peut
cliquer à la place d'Antonin**. Il a tranché : **un seul build, quand le chantier
calendrier sera fini**, qui portera les deux.

▶️ **Pour la session qui fera ce build** : verrou `PRISE · BUILD NATIF` dans
`~/Desktop/Shale-chantiers/COORDINATION.md` d'abord, et `PIEGES.md` § 7.5 bis —
`tauri build` fige le front à la première seconde puis compile le Rust pendant
des minutes. Revérifier l'invariant **juste avant la copie**, prouver le
**contenu** de `dist/assets/*.js`, comparer les `sha256` avant/après `ditto`.
Le motif qui tranche pour ce chantier-ci :

```
grep -c "graineDeNote" dist/assets/*.js     # doit être ≥ 1
```

⚠️ **Et prévenir Antonin** que macOS redemandera l'autorisation du trousseau.

---

## 6. ⛔ La synchro iPhone n'est pas vérifiée

La Phase 4 du prompt demandait de rejouer `RECETTE-SYNC.md` **sur deux
appareils** après le correctif. **Je ne l'ai pas fait, et je n'ai pas pu.**

- Le correctif n'est **sur aucun appareil** : pas de build natif (§ 5), et le
  simulateur n'a pas été réinstallé.
- La session du simulateur est **déconnectée** depuis le 2026-09-02
  (`PASSATION.md` § 5.1) : **seul un geste humain d'Antonin la rouvre**, une
  session Claude ne saisit pas d'identifiants.
- **Rien n'a jamais été vu sur un iPhone RÉEL.** Tout ce qui dit « iPhone » dans
  les passations veut dire *simulateur*.

**Ce qui peut être dit sans appareil, et qui est vérifié :**

- L'outbox de la base d'Antonin est **vide** : rien n'attend d'être envoyé, donc
  le symptôme « des notes n'arrivent jamais sur l'iPhone » n'est pas un blocage
  d'outbox au moment du constat.
- Les deux symptômes de synchro rapportés — « une modification revient en
  arrière », « des notes n'arrivent jamais » — sont des **conséquences attendues**
  des deux défauts corrigés : le last-write-wins propage fidèlement un
  écrasement local, et une frappe perdue à la fermeture ressemble exactement à
  un retour en arrière.

▶️ **La Phase 4 reste donc ouverte.** Elle ne peut commencer qu'après le build,
et elle demande à Antonin de reconnecter le simulateur une fois. Les points 2 à 5
du prompt (les deux horloges, la résolution de l'outbox en `uid`, le volume d'une
note lourde en data URL, les tombstones) **n'ont pas été instruits**.

---

## 7. Ce qui reste ouvert

| Sujet | État | Qui |
|---|---|---|
| **Build natif** | attend la fin du chantier calendrier — décision d'Antonin | la session qui fusionne en dernier |
| **Phase 4, synchro iPhone** | pas commencée ; demande le build **et** un geste d'Antonin sur le simulateur | Antonin, puis une session |
| **Scénario 3** (quitter l'app en < 700 ms) | non reproductible en démo ; à jouer sur l'app native après le build | — |
| **Fiches d'objets** | correctif **raisonné, pas observé** — le mode démo ne fournit aucun objet | à revoir si Antonin crée des objets |
| `richtext.ts` | toujours **sans test** — il touche au `document`. La *décision* en a été extraite (`graineEditeur.ts`), le rendu non | — |
