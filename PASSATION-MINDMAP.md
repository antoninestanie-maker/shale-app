# Passation — cartes mentales dans les Notes et le Savoir

*Chantier du 2026-09-06 (audit) et 2026-09-07 (livraison). Branche
`chantier/mindmap`, posée sur `mobile-ios` à `cc74ca0`.*

> **Ce qui a changé pour Antonin, en une phrase** : une note — dans les Notes
> comme dans le Savoir — peut contenir une **carte mentale** qui se construit au
> clavier, dont les nœuds **citent** ses autres objets, et qui s'exporte en PNG
> ou en SVG, le tout **hors connexion**.

---

## 1. L'état à la clôture

| | |
|---|---|
| Branche | `chantier/mindmap`, 5 commits, **non fusionnée** sur `mobile-ios` |
| Base | `mobile-ios` à `cc74ca0` |
| Migration | **aucune** — pas de 022, pas de table neuve |
| Modules | **treize**, inchangé |
| Tests front | **665 / 665** (608 avant, +57) |
| Tests Rust | **133** (129 avant, +4) |
| Dépendances npm | **aucune ajoutée** |
| App macOS | ⭐ **reconstruite et installée le 2026-09-07 à 03:39** — binaire `e0966e0b…`, copie prouvée par sha256. ⛔ La fenêtre de trousseau attend un clic d'Antonin |
| Verrou BUILD NATIF | pris à 03:36, **libéré à 03:45** |

### La ligne de base — jouée en entier le 2026-09-07 à 03 h 30

```
npx tsc --noEmit                              ✅
npm run test:types                            ✅
npm run i18n:check                            ✅ 0 manquante (1 586 entrées)
npm run i18n:durs                             ✅ 0 sûrement française
npm test                                      ✅ 665 / 665, 46 fichiers
npx vite build                                ✅
cargo check --all-targets                     ✅
cargo test --lib                              ✅ 133
cargo check --target aarch64-apple-ios-sim    ✅
cargo check --target aarch64-apple-ios        ✅
```

⚠️ **Le mode démo était démonté avant de la jouer** (§ 1.2 ter de `PIEGES.md`) :
`grep -r AUDIT-TEMP src/` rend 0 et `git diff --exit-code src/lib/auth/` passe.

---

## 2. Les cinq commits, et pourquoi ils sont découpés ainsi

| | Commit | Ce qu'il pose | Vérifié isolément |
|---|---|---|---|
| A | `b9a78b0` | `lib/carte.ts` — le moteur PUR + 57 tests | ✅ tsc + 57 tests |
| B | `d42d24c` | `carteDom.ts`, `fichiers.ts`, l'éditeur, l'icône, le CSS, l'i18n, la commande Rust | ✅ tsc + i18n + tests |
| C | `a4f1246` | le branchement dans les deux éditeurs, `useLiens`, `KnowledgeView` | ✅ tsc + 665 tests |
| D | `4d528b4` | l'extrait de recherche des notes en texte brut | ✅ (dans la ligne de base finale) |
| E | *(celui-ci)* | la documentation | — |

**Chaque commit A→C a été vérifié SEUL**, la suite du travail mise de côté au
`git stash`. Ce n'est pas de la coquetterie : A est du code mort tant que B
n'existe pas, et le seul moyen de savoir qu'il compile et passe ses tests est de
le regarder sans le reste.

---

## 3. Ce qui a été VU à l'écran, point par point

*Tout ce qui suit a été fait en **mode démo navigateur**, jamais sur la vraie
base d'Antonin (§ 8.4 de `PIEGES.md`).*

| Critère d'acceptation | État | Comment |
|---|---|---|
| 1. Une carte s'insère depuis les **Notes** | ✅ **vu** | bouton « Carte mentale » de la barre d'outils |
| 1 bis. …et depuis le **Savoir** | ✅ **vu** | entrée « Carte mentale » du menu « Insérer », à côté de « Croquis » |
| 2. Elle se construit au clavier | ✅ **vu** | Tab (enfant), Entrée (frère), frappe directe, Échap |
| 3. Elle se replie | ✅ **vu** | Espace ; la pastille annonce « 2 » nœuds cachés |
| 3 bis. Elle s'annule et se rétablit | ✅ **vu** | ⌘Z replie/déplie, ⌘⇧Z refait |
| 3 ter. Un nœud se déplace au glissement | ✅ **vu** | « Stop toujours posé » reparenté sous « 1 % par trade » |
| 4. Elle se rouvre au double-clic, à l'identique | ✅ **vu** | même agencement, mêmes couleurs |
| 5. Un nœud `@` pointe un objet réel | ✅ **vu** | « @plan de » → Note, Tâche, Savoir dans le sélecteur |
| 5 bis. Il **survit au renommage** de sa cible | ✅ **vu** | « Plan de risque » → « Plan de risque V2 », `uid` inchangé |
| 5 ter. Il **survit à la suppression**, marqué mort | ✅ **vu** | bordure en tiret, texte barré, `"mort": true` |
| 5 quater. Il **ouvre** sa cible au clic | ✅ **vu** | bouton du pied ; l'éditeur se referme pour qu'on voie où l'on arrive |
| ⭐ Le **backlink** existe côté cible | ✅ **vu** | « Mentionné dans → Notes → Idées de reels » |
| ⭐ …y compris depuis le **Savoir** | ✅ **vu** | « Mentionné dans → Fiches du Savoir → Après une perte : le protocole » |
| 6. L'export PNG est lisible | ✅ **vu** | fond blanc opaque, 556 × 184 à ×2, affiché à l'écran |
| 6 bis. L'export SVG part | ✅ **vu** | blob, nom de fichier correct |
| 6 ter. Lisible **dans les deux thèmes** | ✅ **vu** | l'export est aplati, donc indépendant du thème ; le bloc dans la note suit le thème (vérifié en clair ET en sombre) |
| 7. Tout cela **réseau coupé** | ✅ **vu** | voir § 4 |
| 8. Ligne de base au vert | ✅ | § 1 |
| 9. Documentation à jour | ✅ | § 7 du prompt, table d'aiguillage de `DOCUMENTATION.md` |
| ⭐ Le texte d'un nœud est trouvé par ⌘K | ✅ **vu** | « zoolographie » → la note, extrait lisible |
| L'app en **anglais** | ✅ **vu** | « Mind map », « Fit to view », « Enter sibling · Tab child · … » |

### Ce qui n'a PAS été vu

- **La vraie base d'Antonin** — jamais ouverte, conformément au § 8.4.
- **Le simulateur iOS**, l'iPhone réel, le geste au doigt : voir `MOBILE.md`.
- **La WKWebView.** Toutes les mesures d'image et de SVG tournent en Chromium.
  Le rendu SVG en WKWebView n'est pas vérifié — c'est le premier point à
  regarder après le build natif.

---

## 4. ⭐ Le hors connexion — prouvé, pas déduit

C'est le seul critère qu'Antonin avait formulé, et il a été vérifié en coupant
le réseau **à l'intérieur de l'app**, pas en débranchant le Wi-Fi :

```js
window.fetch = () => { throw new Error("RÉSEAU COUPÉ"); };
XMLHttpRequest.prototype.open = () => { throw new Error("RÉSEAU COUPÉ"); };
window.WebSocket = () => { throw new Error("RÉSEAU COUPÉ"); };
Object.defineProperty(navigator, "onLine", { get: () => false });
```

Puis : ouverture d'une carte, choix d'un nœud-référence dans le sélecteur `@`,
ajout d'un nœud au clavier, export PNG **et** export SVG.

**Résultat : tout fonctionne, et le compteur de requêtes tentées reste à ZÉRO.**
`navigator.onLine === false`, PNG de 18 306 octets produit, SVG produit.

⚠️ **Pourquoi cette méthode plutôt que couper le Wi-Fi** : elle *enregistre* ce
qui aurait été demandé. Couper le réseau prouve seulement que rien n'a échoué —
ce qui est aussi ce qu'on observe quand une requête part et qu'on ignore son
échec. Ici, le contrôle peut rendre « non » (§ 7 de `PIEGES.md`).

---

## 5. Les décisions, et où elles sont écrites

Le *pourquoi* de chaque choix est dans **`CLAUDE.md`**, section datée
« Cartes mentales dans les Notes et le Savoir (2026-09-07) ». En résumé :

1. **Une carte est un bloc dans une note**, pas un objet — donc pas de 14ᵉ
   module, pas de migration, rien à ajouter dans `sync/scope.ts`.
2. **Le rendu est un `<svg>` en clair, pas une image** — décision *mesurée* :
   22 ko contre 114 ko en WebP et 347 ko en PNG brut, et dans les Notes le
   raster coûtait 143 ko d'index FTS **en plus**.
3. **À l'écran le thème, à l'export des couleurs aplaties** — comme le croquis.
4. **Quatre couleurs de branche**, le rouge jamais d'office (rouge et vert sont
   sémantiques dans ce design system).
5. **Le sélecteur `@` de la carte est autonome** — c'est ce qui le fait marcher
   dans le Savoir, qui n'a pas de mentions.
6. **Les arêtes de carte réutilisent l'origine `'mention'`** et sont réconciliées
   dans la MÊME passe que les jetons `@`.

Les six erreurs que je me suis prises dans la figure sont dans **`PIEGES.md`**,
nouveau **chapitre 9**.

---

## 6. ⛔ Ce qui attend une action

### 6.1 ~~⛔ La branche n'est PAS fusionnée~~ — **FAIT le 2026-09-07 à 03:35**

`chantier/mindmap` → `mobile-ios` en fast-forward (`24a4954`), poussé sur
`origin`. Puis construite et installée à 03:39.

### 6.2 ⭐ LE BUILD EST FAIT — et il portait bien les DEUX chantiers

Fait le **2026-09-07 à 03:39**, en 5 min 03, code de sortie 0. Un seul build
pour la roulette d'heure ET les cartes mentales, comme il le fallait : chaque
reconstruction coûte à Antonin une fenêtre de trousseau que lui seul peut fermer.

**La chaîne de preuve, dans l'ordre où elle a été établie :**

| Étape | Mesure |
|---|---|
| Sauvegarde cohérente AVANT | `shale-backups/avant-cartes-mentales-20260907-0332/`, `integrity_check` **ok** |
| Empreinte horodatée de l'app à remplacer | `8d03ecf0…`, mtime **2026-09-06 18:47:30** |
| Horodatage : commit → dist → binaire | 03:32:10 → 03:33:50 → 03:39:18 |
| Témoins DANS `dist/` (cartes) | `data-mindmap` **2**, `Shale/carte: could not refresh` **1**, `carte-bloc` **5** |
| Témoin DANS `dist/` (roulette) | `roulette` **10** — le build porte bien l'autre chantier |
| Contre-épreuve | `rafraichirBlocs` (nom de fonction) → **0**, comme le § 7.5 bis l'annonce |
| Les deux empreintes DIFFÉRAIENT avant la copie | `8d03ecf0…` ≠ `e0966e0b…` — donc la comparaison d'après a du sens |
| Après `ditto` | installée = source = `e0966e0b…` |
| Témoin RUST sur le binaire INSTALLÉ | `ecrire_fichier` **1**, `ALTER TABLE … end_date` **1** |
| Chaîne du FRONT dans le binaire | **0** — le front est compressé, exactement comme le § 7.5 bis ② le décrit |
| Base après lancement | `integrity_check` **ok**, version **21**, **13 notes / 45 889 octets** — inchangée |

⚠️ **Une erreur commise pendant l'installation, et consignée** : le contrôle
« l'app est-elle lancée ? » utilisait `pgrep -x Shale`, qui ne peut PAS matcher —
le processus s'appelle `shale`. Une instance tournait, et le `rm -rf` a eu lieu
sur un bundle en cours d'exécution. Sans conséquence (macOS garde les inodes, la
base est identique avant/après), mais c'était de la chance. Entrée `PIEGES.md`
§ 9.8, et le carnet de coordination porte la correction datée.

⚠️ **Une différence connue entre le dépôt et le bundle installé** : la fonction
`octetsDeDataUrl` de `carteDom.ts`, morte, a été retirée du dépôt APRÈS le début
du build. Le bundle installé la contient encore. **Aucun effet** — elle n'était
appelée nulle part — mais il faut le savoir plutôt que de s'étonner d'un diff.

### 6.2 bis ⛔ CE QUI RESTE, ET C'EST UN GESTE HUMAIN

**La fenêtre de trousseau est ouverte** (`SecurityAgent` actif au moment où
j'écris) et attend qu'Antonin clique **« Toujours autoriser »**. macOS la
redemande dès que le binaire change (§ 8.3). **Aucune session ne peut le faire à
sa place** — saisir un mot de passe est interdit. Sans ce clic, la
synchronisation ne retrouve pas son jeton.

⚠️ **Les témoins de build, VÉRIFIÉS SUR UN VRAI `npx vite build` avant d'être
écrits ici** — c'est la moitié de la règle du § 7.5 bis que la session du
chantier Notes avait ratée :

```
grep -o 'data-mindmap' dist/assets/*.js | wc -l                  # mesuré : 2
grep -o 'Shale/carte: could not refresh' dist/assets/*.js | wc -l # mesuré : 1
grep -o 'carte-bloc' dist/assets/*.js dist/assets/*.css | wc -l   # mesuré : 5
```

⚠️ **Attendre « au moins un », jamais un compte exact.** Le découpage en chunks
peut déplacer une occurrence, et un compte trop strict ferait rejeter un bundle
sain — c'est l'erreur du témoin `end_date = 25`, § 7.5 bis.

⭐ **La contre-épreuve, faite en même temps, et c'est elle qui donne sa valeur au
témoin** : les noms de FONCTION rendent bien **zéro**, comme la règle l'annonce.

```
grep -o 'rafraichirBlocs' dist/assets/*.js | wc -l   # mesuré : 0
grep -o 'function agencer' dist/assets/*.js | wc -l  # mesuré : 0
```

Un témoin choisi parmi eux aurait fait conclure à un bundle périmé au moment
exact où l'on s'apprête à écrire dans `/Applications`.

⚠️ **Ces trois témoins sont du FRONT — donc ils rendront ZÉRO sur le binaire
installé**, où le front est compressé (§ 7.5 bis ②). Le seul témoin prouvable
sur l'app elle-même est du Rust :

```
strings /Applications/Shale.app/Contents/MacOS/shale | grep -c ecrire_fichier
```

⚠️ **Celui-là n'est PAS vérifié** : il n'y a pas encore eu de build. C'est une
hypothèse raisonnable (le nom d'une commande `#[tauri::command]` est sérialisé en
clair pour le pont JS↔Rust), pas une mesure. **La vérifier avant de s'en servir.**

⚠️ **Aucune migration n'est en jeu** : la base n'a pas besoin d'être touchée, et
il n'y a donc rien à sauvegarder au-delà de l'hygiène habituelle.

### 6.3 ⚠️ Ce qui reste ouvert, et n'est pas un défaut

- **Le `@` dans le corps de TEXTE du Savoir** n'existe toujours pas, et le
  panneau « Mentionné dans » non plus côté Savoir. Une arête Savoir→Note se voit
  dans la note ; une arête Savoir→Savoir est écrite mais invisible. C'est le
  chantier C côté Savoir, une décision d'Antonin.
- **Le portage tactile** : `MOBILE.md`, section du 2026-09-07.
- **Le site** : `DETTE-SITE.md`, entrée G.1.

---

## 7. Les fichiers, pour la prochaine session

| Fichier | Ce qu'il porte |
|---|---|
| `src/lib/carte.ts` | ⭐ le modèle, l'agencement, le rendu SVG, l'historique, les flèches. **Pur, 57 tests.** C'est ici qu'on travaille |
| `src/lib/carte.test.ts` | dont trois tests qui gardent « une carte ne détruit pas un backlink » |
| `src/lib/carteDom.ts` | l'insertion dans un `contenteditable`, le rafraîchissement des blocs, la rastérisation. **Court exprès, non testable** |
| `src/lib/fichiers.ts` | écrire un fichier : dialogue système + Rust en natif, `<a download>` en démo |
| `src/components/carte/EditeurCarte.tsx` | l'éditeur plein écran. Ne fait que montrer, écouter, transmettre |
| `src/components/liens/useLiens.ts` | ⭐ l'UNION jetons `@` + nœuds de carte, en une passe |
| `src-tauri/src/lib.rs` | `ecrire_fichier` + son décodeur base64 (4 tests) |

⚠️ **La règle qui tient tout** : ce qui peut se décider sans `document` vit dans
`carte.ts`. Le jour où l'on ajoute une fonctionnalité à la carte, elle commence
là — sinon elle n'aura aucun test, et ce chantier a montré que **les six vrais
défauts étaient tous du côté DOM**, aucun dans le modèle.
