# Passation — chantier C, liaisons, backlinks et objets

*2026-09-02. Écrit pour une session sans contexte, et pour le chantier D
(parité iPhone).*

---

## 1. L'état

| | |
|---|---|
| Worktree | `~/Desktop/Shale-chantiers/liaisons` |
| Branche | `chantier/liaisons`, rebasée après la fusion du calendrier |
| Modules touchés | Notes, Savoir (2 onglets), palette ⌘K, éditeur riche |
| Compte de modules | **inchangé, treize** — les objets sont un ONGLET du Savoir |
| Tests ajoutés | **33** (18 mentions, 15 recherche) |
| Vérifié à l'écran | ✅ mode démo, français **et** anglais |

### Ligne de base

```
npx tsc --noEmit                            ✅
npm run test:types                          ✅
npm run i18n:check                          ✅ 0 manquante (1543 entrées)
npm run i18n:durs                           ✅ 0 chaîne sûrement française
npm test                                    ⚠️ 547 / 549 — les deux mêmes qu'avant (§ 4)
npx vite build                              ✅
cargo check / test / ios-sim                ✅ (Rust non modifié par ce chantier)
```

---

## 2. Ce qui est PROUVÉ

### Par des tests
- Une mention **se relit telle qu'elle s'écrit** et survit à l'aller-retour.
- **Renommer la cible réécrit le texte affiché, l'identité ne bouge pas.**
- Une cible **supprimée** laisse le jeton en place, marqué mort.
- Deux mentions du même objet **ne font qu'une arête**.
- Le texte du jeton est récupéré même si un gras a été appliqué par-dessus.
- `@` n'ouvre pas sur une adresse e-mail, accepte trois mots, se referme sur une
  phrase.
- Le classement de recherche est **stable** (deux recherches identiques rendent
  le même ordre), le titre bat le corps, et **on ne se cite pas soi-même**.

### À l'écran, de bout en bout
Dans une fiche d'objet : `@plan de risque` → sélecteur → Entrée → jeton posé →
**clic sur le jeton → le module Notes s'ouvre SUR la bonne note** → son panneau
« Mentionné dans » affiche « OBJETS → Silver Bullet ».
Et ⌘K « silver » → « ALLER À · Silver Bullet · OBJET » → Entrée → le Savoir
s'ouvre **sur l'onglet Objets, sur la bonne fiche**.

Vérifié aussi : l'onglet Objets, ses quatre types livrés avec leurs compteurs,
la fiche d'objet et ses champs typés, le panneau de liens, l'éditeur de type —
en français et en anglais.

---

## 3. ⚠️ Ce qui n'est PAS prouvé

- ⚠️ **Rien n'a été vu sur iPhone ni sur le simulateur.**
- ⚠️ **Le sélecteur `@` au clavier tactile n'a pas été essayé.** Il se replie
  vers le haut quand il déborderait du bas de la fenêtre — écrit pour ça, jamais
  vérifié sous un clavier logiciel. **C'est un sujet du chantier D.**
- **Les mentions dans l'éditeur de blocs du Savoir (`NoteComposer`) ne sont PAS
  branchées.** Seuls `RichNoteEditor` (Notes, fiches d'objets) les porte. Le
  Savoir utilise un autre éditeur ; l'y ajouter est un travail à part entière,
  et il n'a pas été fait. **À dire tel quel : le panneau de backlinks apparaît
  sur une note et sur un objet, pas encore sur une fiche du Savoir.**
- **Aucun rebuild natif** : l'app installée d'Antonin date du **2026-08-28** et
  ne connaît ni la migration 020, ni le calendrier, ni les liaisons.
- **Le comportement sur une grosse base réelle** : la recherche a été éprouvée
  sur les données de démonstration, pas sur des milliers de notes.

---

## 4. ⚠️ Les deux tests rouges ne viennent toujours pas d'ici

`auth/activation.sql.test.ts`, sur l'essai gratuit — antérieurs au socle,
vérifiés sur la branche intacte. Décision attendue d'Antonin :
`DETTE-SITE-CALENDRIER.md` § A.1.

---

## 5. Où vit quoi

| Fichier | Rôle |
|---|---|
| `src/lib/mentions.ts` | le jeton : écriture, relecture, rafraîchissement — **testable** |
| `src/lib/mentionsDom.ts` | curseur et insertion — la part qui exige le DOM |
| `src/lib/recherche.ts` | LE moteur de classement, ⌘K et `@` |
| `src/lib/naviguer.ts` | ouvrir un objet depuis n'importe où, malgré le `lazy` |
| `src/lib/repo.ts` | `rechercherPartout`, `titresDesMentions` |
| `src/components/liens/MentionPicker.tsx` | le sélecteur `@` |
| `src/components/liens/PanneauLiens.tsx` | « Mentionné dans » + rattachement manuel |
| `src/components/liens/GalerieObjets.tsx` | l'onglet Objets, la fiche |
| `src/components/liens/EditeurType.tsx` | l'éditeur de type |
| `src/components/liens/useLiens.ts` | le crochet que les trois écrans partagent |

---

## 6. Pour le chantier D

- **Le sélecteur `@` doit tenir AU-DESSUS du clavier logiciel.** Il se replie
  déjà vers le haut quand il déborderait — à vérifier réellement sur l'appareil.
- **Les cibles tactiles du chantier n'ont pas été mesurées** : les lignes du
  sélecteur, les pastilles de type et les puces du panneau de liens sont
  probablement **sous 44 pt**.
- **Le jeton de mention est en `white-space: nowrap`** : un titre long ne se
  coupe pas, il pousse la ligne. Sur un écran de 6 pouces, cela peut déborder —
  à regarder.
- `EditeurType` utilise `max-h-[85vh]` **déjà multiplié par `--zoom-inv`**.

---

## 7. Ce qu'Antonin peut constater lui-même

⚠️ **Rien tant que l'app n'est pas reconstruite** : elle date du 2026-08-28.

Ensuite, dans **Savoir**, deux onglets apparaissent : **Fiches** et **Objets**.

- **Objets** montre quatre types livrés — Personne, Ressource, Projet, Setup de
  trading — avec le nombre de fiches de chacun. Le bouton **+ Type** en crée
  d'autres ; la petite roue crantée sur un type l'ouvre pour le modifier. **Un
  type livré se modifie et se supprime comme les autres.**
- Une fiche montre ses champs (texte, nombre, date, lien, choix), un corps riche
  et, en bas, **« Mentionné dans »**.
- ⭐ **Dans une note ou une fiche d'objet, tape `@`** : une liste apparaît, tous
  modules confondus. Choisis, et le nom s'insère en pastille bleue. **Clique la
  pastille : l'app ouvre l'élément cité, où qu'il soit.**
- Sur l'élément cité, le panneau **« Mentionné dans »** dit qui parle de lui.
  Le bouton **Lier** rattache à la main ce qui n'a été écrit nulle part.
- ⭐ **⌘K trouve désormais des CHOSES**, pas seulement des actions : tape trois
  lettres, la section **« aller à »** propose notes, fiches, objets, objectifs,
  tâches et événements.

⚠️ **Deux limites à connaître** : renommer un élément met à jour ses mentions
partout (c'est voulu) ; supprimer un élément laisse la pastille en place, barrée
et grise, plutôt que de réécrire ta phrase à ta place.
⚠️ **Les mentions ne sont pas encore dans l'éditeur des fiches du Savoir**, qui
utilise un autre éditeur (§ 3).
