# Dette côté site — ce que l'app promet et que le site ne dit pas encore

> **Ce fichier a déménagé le 2026-09-04.** Il vivait dans
> `~/Desktop/Shale-chantiers/`, dossier non versionné qui disparaîtra au premier
> ménage ; la dette, elle, survit aux worktrees. Il est désormais **dans le dépôt**,
> et c'est ici qu'on l'ouvre : `Shale/DETTE-SITE.md`.
>
> **Toute session qui fait promettre à l'app quelque chose que le site ne dit pas
> ajoute son entrée ici** — voir `DOCUMENTATION.md`.

## Chantiers Calendrier & Liaisons (2026-09-02)

Le site est **hors périmètre** de ces quatre chantiers : Antonin mène sa refonte
visuelle de son côté. La règle du projet — *l'app et le site ne divergent
jamais* — n'est donc pas annulée, elle est **différée et tracée ici**.

**Chaque entrée dit** : ce qui a changé dans l'app, le fichier exact du site à
modifier, et ce qu'il doit dire. La table de correspondance app→site est dans
`CLAUDE.md`, section « Règle : l'app et le site ne divergent jamais ».

---

## Chantier A — socle de données (2026-09-02)

### A.1 ✅ RÉSOLU le 2026-09-02 — la divergence app↔site est refermée

> **Décision d'Antonin, 2026-09-02 : l'essai gratuit reste POSSIBLE pour Shale,
> mais il n'est pas OBLIGATOIRE.**
>
> Ce que l'instruction a révélé : le « pas obligatoire » **existait déjà** côté
> site — `create-checkout/index.ts` accepte un drapeau `sansEssai` pour
> s'abonner directement, et n'accorde `trial_period_days` qu'à la première
> souscription. **Aucun fichier du site n'a eu besoin d'être touché.**
>
> Ce qui restait était dans l'APP : les deux tests décrivaient encore le monde
> d'avant le 2026-08-31, où l'inscription ouvrait sept jours d'essai sans carte.
> Leur INTENTION était juste — « un essai en cours ne donne pas l'activation » —
> c'est leur mise en place qui était périmée. Ils posent désormais l'essai
> explicitement, comme le fait le webhook Stripe.
>
> ⚠️ **Ce qu'il ne fallait surtout pas faire** : « réparer » les tests en
> rouvrant l'essai sans carte. Cela aurait contredit les CGV en ligne, qui
> promettent une carte à la souscription et un premier prélèvement au 8ᵉ jour.
>
> **Ligne de base : 550 tests sur 550**, entièrement verte pour la première fois
> depuis le 2026-08-31. ⚠️ *Chiffre daté : la référence est passée à **553 sur
> 553** le 2026-09-04, avec les trois tests du correctif de sauvegarde
> (`67ce66e`).*

<details>
<summary>Le constat d'origine, gardé pour mémoire</summary>

### ⚠️ Une divergence app↔site EXISTE DÉJÀ, et elle est rouge

**Ce n'est pas une dette créée par ce chantier : c'est une dette découverte.**

`Shale/src/lib/auth/activation.sql.test.ts` lit le SQL **du dépôt du site**
(`shale-site/supabase/migrations/003_activation.sql`) plutôt que d'en garder une
copie — précisément pour que les deux ne divergent pas. Le site a changé le
**2026-08-31** (Stripe en LIVE, le paiement devient le mur d'entrée, le mur
d'activation manuelle retiré). Le test de l'app, lui, décrit toujours l'ancien
comportement.

**Deux tests échouent donc sur `mobile-ios`**, et ils échouaient déjà avant ce
chantier — vérifié en les rejouant sur la branche intacte, pas supposé :

- `la vue lue par l'app > n'active PAS un compte au seul motif que son essai
  gratuit court` — attend `status: "trialing"`, obtient `status: "none"` ;
- `la vue lue par l'app > garde l'essai et l'activation indépendants — un essai
  expiré n'éteint pas l'activation`.

**Ce qu'il faut décider** — et c'est une question de produit, pas de code :
l'essai gratuit de 7 jours existe-t-il encore maintenant que le paiement est le
mur ? Selon la réponse, c'est le **test** qui doit suivre la nouvelle réalité,
ou le **SQL du site** qui a perdu une intention.

**⛔ Aucun des quatre chantiers ne tranche cela.** Il faut le dire à Antonin,
parce que B, C et D vont tous voir ces deux tests rouges et pourraient croire
qu'ils viennent de les casser.

</details>

### A.2 Rien d'autre à recopier pour le socle

Le chantier A ne pose **aucune interface** : il n'ajoute ni module, ni nom, ni
promesse, ni écran. Rien de sa migration n'a de miroir côté vitrine — la
synchronisation transporte des blobs chiffrés, le serveur ne connaît pas le
schéma.

---

## Chantier B — le calendrier (2026-09-02)

### B.1 ⭐ Le compte de modules passe de DOUZE à TREIZE

Le module **Calendrier** est arrivé, en 3ᵉ position de la catégorie
Productivité (entre Tâches et Timer). `ITEMS` de `src/components/Sidebar.tsx`
fait autorité sur ce compte.

⚠️ **La consigne de départ annonçait « 8 endroits dans l'app, écrit en toutes
lettres ». C'était faux, et vérifié dans l'arbre :** le `grep` rendait bien 8
résultats, mais **sept parlaient de douze *mois*, douze *loyers*, douze *mots***.
**Aucun texte AFFICHÉ dans l'app n'annonce le nombre de modules.** Seuls des
commentaires de code le mentionnaient — ils sont corrigés
(`Sidebar.tsx`, `MobileNav.tsx`).

**Côté site, en revanche, le compte est affiché.** À vérifier un par un lors de
la refonte — cette liste vient du document de cadrage, elle n'a **pas** été
recomptée dans le dépôt du site (hors périmètre) :

| Fichier du site | Ce qu'il devra dire |
|---|---|
| `content.json` | « douze modules » → « treize modules » |
| `lib/i18n/en.ts` | « twelve » → « thirteen » |
| les vues de `/compte` | le décompte affiché à l'abonné |
| `Demo.astro` | « APERÇU · 3 MODULES SUR 12 » → « … SUR 13 » |

▶️ **Commencer par recompter** : `grep -rn "douze\|twelve\|SUR 12\|12 modules"`
dans `shale-site`, en écartant les faux positifs comme l'a fait l'app.

### B.2 Un module de plus à présenter

Le site décrit les modules un par un. Le Calendrier devra y figurer, avec ce
qu'il apporte réellement — et **rien de plus** :

- mois, semaine, jour, avec le glisser-déposer pour poser une tâche à une heure ;
- la détection de journée surchargée, dont la capacité est **apprise des
  sessions de concentration** (et le dit quand elle ne l'est pas encore) ;
- le report des tâches non faites, qui **s'arrête au bout de deux glissements**
  et demande une décision ;
- les créneaux libres proposés, tirés des heures réellement tenues ;
- l'alerte « objectif en péril », qui croise le temps restant et le travail
  restant.

⚠️ **Ne pas promettre de rappels ponctuels sur iPhone.** La règle de
notification existe et fonctionne sur le bureau ; sur iOS, app fermée, elle
n'est pas ponctuelle (voir la passation du chantier B, § 3).

⚠️ **Ne pas promettre d'import de calendrier externe** (Apple, Google, `.ics`) :
c'est explicitement hors périmètre.

---

## Chantier C — liaisons, backlinks et objets (2026-09-02)

### C.1 ⭐ Le compte de modules NE BOUGE PAS

Les objets personnalisés vivent dans un **onglet du module Savoir**, pas dans un
14ᵉ module — décision d'Antonin. **Le site reste donc à treize modules** après la
correction du chantier B ; il n'y a rien de plus à recompter.

### C.2 Deux promesses nouvelles à décrire, si le site parle des modules

Le module **Savoir** ne fait plus seulement des fiches. À reformuler côté
vitrine, quand la refonte y arrivera :

- **les mentions `@`** — citer une note, une fiche, un objectif, une tâche, un
  événement ou un objet depuis n'importe quel texte, et arriver dessus d'un clic ;
- **les backlinks** — chaque élément affiche qui parle de lui ;
- **les objets personnalisés** — quatre types livrés (Personne, Ressource,
  Projet, Setup de trading) **et la création libre** ;
- **⌘K trouve des choses**, plus seulement des actions.

⚠️ **Ce qu'il ne faut PAS promettre**, parce que ce n'est pas vrai :
- les mentions ne sont **pas encore** dans l'éditeur des fiches du Savoir
  (`NoteComposer`) — seulement dans les Notes et les fiches d'objets ;
- **rien n'a été vu sur iPhone** : le sélecteur `@` au clavier tactile est un
  sujet du chantier D, pas une fonctionnalité vérifiée.

### C.3 Aucun fichier du site n'a été touché

Comme pour A et B. La règle « l'app et le site ne divergent jamais » reste
**différée et tracée ici**, le temps de la refonte visuelle d'Antonin.

---

## Chantier D — parité iPhone (2026-09-02)

### D.1 Rien à recopier, mais une promesse à NE PAS faire

Le chantier n'ajoute ni module, ni nom, ni écran : il adapte au téléphone ce que
B et C ont posé. **Le compte de modules reste à treize.**

⚠️ **Ce que le site ne doit PAS promettre**, parce que ce n'est pas vérifié :

- **rien n'a été vu sur un iPhone réel** — uniquement sur le simulateur ;
- **le geste au doigt n'a pas été éprouvé à la main** : l'injection tactile du
  simulateur ne reproduit ni l'inertie, ni la paume, ni la latence ;
- **le dépôt réel d'une notification de calendrier sur iOS n'a pas été observé**.
  Les tests prouvent que le plan contient la bonne échéance à la bonne heure ;
  ils ne prouvent pas qu'iOS l'a acceptée.

### D.2 Si le site montre des captures d'écran mobiles

Le calendrier n'a **pas la même forme** sur téléphone : ni vue mois, ni vue
semaine, mais une **vue agenda** (liste chronologique). Une capture de la vue
semaine présentée comme l'écran mobile serait fausse.

