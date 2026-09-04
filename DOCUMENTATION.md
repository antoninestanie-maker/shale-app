# ⭐ Documenter — la règle, et elle n'a pas d'exception

*Ouvert le 2026-09-04, à la demande d'Antonin.*

> **La documentation n'est pas la dernière étape d'un chantier : elle en fait
> partie au même titre que le code et les tests.**
>
> **Une session qui a modifié le projet et n'a rien écrit n'a pas fini son
> travail** — même si tout compile, même si tout est vert, même si c'est
> poussé.

## Pourquoi cette page existe

Antonin n'est pas développeur et n'ouvre jamais le Terminal. **Il ne relira pas
le code pour retrouver une décision.** La seule mémoire du projet est ce qui est
écrit dans ces `.md` — le reste disparaît avec la fenêtre de contexte de la
session qui l'a fait.

Et il n'y a pas qu'une session : plusieurs travaillent en parallèle, dans des
worktrees séparés, sans se voir. Ce qu'une session ne consigne pas, **la
suivante le repaiera** — c'est déjà arrivé plusieurs fois, chaque fois pour le
même prix : une demi-journée.

---

## 1. Où va quoi — la table d'aiguillage

Cinq destinations, et une seule est correcte pour un fait donné. Se tromper de
fichier revient presque à ne rien écrire : personne n'ira chercher là.

| Ce qu'on vient de produire | Destination | Forme |
|---|---|---|
| **Une décision** et son *pourquoi* (« on a choisi X plutôt que Y, parce que ») | `CLAUDE.md`, en **section datée à la fin** | prose, au passé, avec les ⚠️ des pièges de conception |
| **Une erreur qui peut se reproduire** (environnement, API qui ment, test qui échoue pour une raison qui n'est pas la sienne) | `PIEGES.md` | les 4 lignes du format : symptôme · cause · parade · comment on l'a payée |
| **L'état d'un chantier** : ce qui est prouvé, ce qui ne l'est pas, ce qui reste | `PASSATION-<chantier>.md` | tableau d'état + ligne de base des commandes |
| **Où en est le projet, en entier** | `PASSATION.md` — c'est le « COMMENCER ICI » | mis à jour, pas empilé |
| **Ce qui a changé dans l'app et devra être répercuté sur le site** | `DETTE-SITE.md` | app → fichier exact du site → ce qu'il doit dire |

Trois fichiers thématiques prennent le relais quand le sujet est le leur :
`MOBILE.md` (iOS), `DESIGN.md` (le système visuel), `AMELIORATIONS-UI.md` (le
chiffrage UI). Un sujet iOS s'écrit **dans `MOBILE.md`**, pas dans une section
datée de `CLAUDE.md`.

### La règle qui départage `CLAUDE.md` et `PIEGES.md`
`CLAUDE.md` porte **ce qu'on a décidé**. `PIEGES.md` porte **ce qu'on s'est pris
dans la figure**. Une même journée alimente souvent les deux, et ce n'est pas un
doublon : la décision se relit pour comprendre, le piège se relit pour ne pas
retomber.

---

## 2. Quand écrire — trois moments, pas un

**① Au moment où l'erreur mord.** Pas à la fin du chantier, pas « si on y
pense ». Une erreur trouvée deux fois par deux sessions différentes est une
erreur payée deux fois. Écrire cinq lignes dans `PIEGES.md` coûte deux minutes ;
la retrouver coûte une demi-journée.

**② Au moment où la décision se prend.** Le *pourquoi* d'un choix s'évapore en
quelques heures. Reconstitué le lendemain, il est faux : on documente la raison
qu'on aurait aimé avoir, pas celle qu'on a eue.

**③ Avant de rendre la main.** La passation se met à jour même si le chantier
n'est pas fini — surtout s'il n'est pas fini. « Je reprendrai demain » n'existe
pas : demain, c'est une autre session, sans aucun contexte.

---

## 3. La liste de contrôle — à parcourir avant de dire « c'est fini »

Six questions. Chacune se répond par oui ou par un fichier à ouvrir.

1. **Ai-je pris une décision que personne ne pourrait deviner en lisant le
   code ?** → section datée de `CLAUDE.md`.
2. **Me suis-je fait avoir par quoi que ce soit ?** → `PIEGES.md`, même si c'est
   petit, même si c'est bête, **surtout si c'est bête**.
3. **L'état du projet a-t-il changé ?** (branche, base de données, app
   installée, ligne de base des tests) → `PASSATION.md`.
4. **Ai-je rendu périmée une phrase écrite ailleurs ?** → la corriger **en la
   datant**, jamais en l'effaçant (§ 4).
5. **L'app promet-elle maintenant quelque chose que le site ne dit pas ?** →
   `DETTE-SITE.md`.
6. **Le message de commit raconte-t-il ce qui s'est passé ?** → c'est la
   documentation qu'on lit en premier dans six mois (§ 5).

---

## 4. ⚠️ On corrige en datant, on n'efface pas

Une affirmation devenue fausse **ne se supprime pas** : on la marque périmée, on
écrit ce qui est vrai, et on dit depuis quand. Deux raisons, toutes les deux
vérifiées à nos dépens :

- Une phrase effacée laisse **une session future la réécrire à l'identique**,
  parce que rien ne dit qu'on y a déjà pensé.
- Ces documents sont lus par des sessions qui n'ont **aucun** contexte. « C'était
  vrai jusqu'au 31 août » est une information ; le silence n'en est pas une.

Même chose pour `PIEGES.md` : **ne jamais retirer une entrée parce que
« maintenant on le sait »**. La prochaine session ne le saura pas.

---

## 5. Le message de commit fait partie de la documentation

C'est le seul document qu'on lit **avec le diff sous les yeux**. Il dit ce qui
s'est passé, pas ce qui a été tapé : le symptôme, ce qu'on croyait, ce que
c'était vraiment. Un commit qui dit « fix » ou « améliorations » perd
l'information au moment exact où elle était disponible.

---

## 6. Ce qu'il ne faut PAS documenter

Ne pas noyer les documents utiles :

- **Ce que le code dit déjà mieux.** Une liste de fonctions n'est pas de la
  documentation, c'est une copie qui divergera.
- **Le déroulé d'une session.** Personne ne relira « puis j'ai lancé les tests ».
  Ce qui compte est le résultat et le pourquoi.
- **Un bogue corrigé une fois pour toutes, sans piège résiduel.** Le test qui le
  tient suffit.
- **Une passation périmée dupliquée en trois exemplaires.** On met à jour, on
  n'empile pas.

---

## 7. Comment on sait que la règle a été tenue

Depuis le dépôt, la trace est vérifiable en une commande :

```
git log --format='%h %ad %s' --date=short --name-only -8
```

Une série de commits qui ne touche **jamais** un `.md` est le signe qu'une
session a travaillé sans rien consigner. C'est un sujet à soulever, pas un
détail de style.

---

## 8. L'ordre de lecture, pour une session qui commence

1. `PASSATION.md` — où on en est
2. `PIEGES.md` — ce qu'il ne faut pas refaire
3. `CLAUDE.md` — la référence, et ce qui fait foi
4. **cette page** — comment laisser le projet dans le même état pour la suivante

*Les fichiers de cette page sont dans `~/Desktop/Shale-projet/Shale/`.*
