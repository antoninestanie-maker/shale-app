# Dette côté site — ce que l'app promet et que le site ne dit pas encore

> ## ⚠️ 2026-09-18 — les `PASSATION-*.md` cités plus bas n'existent plus
>
> Les vingt-trois documents de chantier ont été repliés dans **`PASSATION.md`**,
> le fichier unique de l'app ; son § 16 donne le tableau de correspondance, et
> `git show c312ce0:<nom>.md` les rend tels qu'ils étaient. Les phrases
> ci-dessous n'ont pas été réécrites une par une : elles restent justes sur le
> fond, seule leur référence se traduit.

> **Ce fichier a déménagé le 2026-09-04.** Il vivait dans
> `~/Desktop/Shale-chantiers/`, dossier non versionné qui disparaîtra au premier
> ménage ; la dette, elle, survit aux worktrees. Il est désormais **dans le dépôt**,
> et c'est ici qu'on l'ouvre : `Shale/DETTE-SITE.md`.
>
> **Toute session qui fait promettre à l'app quelque chose que le site ne dit pas
> ajoute son entrée ici** — voir `DOCUMENTATION.md`.

## Profils de licence sur devis (2026-09-13)

**Rien à répercuter aujourd'hui, et c'est vérifié.** Le chantier ne crée ni
offre, ni prix, ni module, ni promesse publique : aucun profil n'est émis, et
l'app n'annonce nulle part la personnalisation sur devis. `SPECS` de
`vitrine/src/lib/modules.ts` reste exact.

▶️ **Le jour où l'offre sur devis sera vendue** (page « Sur devis », formulaire —
hors périmètre du chantier), le site devra dire exactement ce que l'app sait
faire, et pas plus : masquer des modules, en imposer l'ordre, renommer les
**libellés de modules et de catégories** (en français, en anglais ou les deux),
poser un nom de marque. **Pas** de champs personnalisés, pas de connecteurs, pas
de renommage des autres textes, pas de réglages imposés — rien de cela n'existe
(`CLAUDE.md`, 2026-09-13, « Ce qui n'est PAS fait »).

---

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

▶️ ~~**Commencer par recompter**~~ — **RECOMPTÉ le 2026-09-07**, pendant le
checkup général. Le chiffre, mesuré dans `shale-site/vitrine/src` (branche
`sync-chiffree`, `756feb7`) et pas déduit d'un document :

| Mesure | Valeur |
|---|---|
| Occurrences de « douze » / « 12 modules » / « SUR 12 » dans `vitrine/src` | **37** |
| Entrées de `vitrine/src/lib/modules.ts` | **12** |
| Le module **Calendrier** y figure-t-il ? | **NON** — absent de la liste |

Les douze noms présents : Aujourd'hui, Tâches, Timer, Objectifs, Performance,
Finance, Notes, Journal, Savoir, Trading, Market-Brain, Position. Il manque
**Calendrier**, qui s'insère entre Tâches et Timer.

⚠️ **Les 37 occurrences ne sont PAS toutes à corriger** : au moins deux parlent
d'autre chose (« douze semaines glissantes » pour les habitudes, « les douze
autres » dans un article de blog). C'est exactement le faux positif contre lequel
cette entrée mettait en garde — le recomptage le confirme au lieu de le supposer.

⚠️ **Et le site ignore aussi les CARTES MENTALES** (2026-09-07) — voir l'entrée
G.1. Ce n'est pas un module, donc le compte ne bouge pas, mais la description
des Notes et du Savoir est incomplète.

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

---

## Calendrier V2 (2026-09-05/06) — ce que l'app sait faire de plus

*Rien ici n'oblige à toucher au dépôt du site : la refonte est menée par Antonin
et le compte de modules ne bouge pas (toujours **treize**). Ce sont des
promesses que l'app tient désormais et que la vitrine ne mentionne pas.*

| L'app fait maintenant | Ce que le site pourrait dire |
|---|---|
| Un rendez-vous se pose **à la minute** ; le clic et le glissement dans la grille se calent au quart d'heure | Rien aujourd'hui ne décrit la granularité du calendrier. À citer seulement si une page détaille le module |
| Un événement peut durer **plusieurs jours** (séjour, séminaire, vacances) et s'affiche en bande continue | C'est la fonctionnalité la plus « visible » du lot — la seule qui mérite peut-être une capture |
| Une **tâche reçoit une date et un créneau** depuis le module Tâches, et apparaît au calendrier | Si le site décrit les tâches comme « sans date », la phrase est **périmée** |
| La récurrence d'un événement accepte des **jours choisis**, avec le même vocabulaire que les tâches | Détail d'interface, sans doute pas pour la vitrine |

⚠️ **Ce que le site ne doit PAS promettre** : l'import/export ICS (écarté par
Antonin), et une fin de série (« se répète jusqu'au … »), qui n'existe pas.

⚠️ **Aucune capture d'écran du site ne montre le calendrier à ce jour.** Si
Antonin en ajoute, prendre le module APRÈS le rebuild natif : celui installé sur
sa machine ne connaît pas encore ce chantier.

---

## Chantier « cartes mentales » (2026-09-07)

**Une seule entrée, et elle est petite** — mais elle existe, ce qui n'était pas
acquis : la carte est un bloc DANS une note, pas un module. Le compte de modules
reste à **treize**, donc rien à corriger de ce côté.

### G.1 ⚠️ L'app sait faire des cartes mentales, le site ne le dit nulle part

**Ce qui a changé dans l'app.** Les Notes ET le Savoir peuvent contenir une carte
mentale éditable au clavier, hors connexion, exportable en PNG et en SVG, dont
les nœuds peuvent citer n'importe quel objet de l'app (note, fiche, tâche,
objectif, événement, personne, ressource, projet, setup de trading) — et une
citation crée un vrai backlink.

**Où ça va, côté site.** La page qui décrit les Notes et le Savoir
(`shale-site/`, section fonctionnalités). **La table de correspondance app→site
est dans `CLAUDE.md`**, section « Règle : l'app et le site ne divergent jamais ».

**Ce qu'il doit dire — et surtout ce qu'il ne doit PAS dire :**

- ✅ « une carte mentale se construit entièrement au clavier, dans une note » ;
- ✅ « ses nœuds citent tes autres objets, et la fiche citée sait qu'on parle
  d'elle » ;
- ✅ « elle s'exporte en PNG et en SVG » ;
- ✅ « tout fonctionne hors connexion » — c'est vérifié, réseau coupé, pas déduit ;
- ❌ **ne pas écrire « nouveau module »** : ce n'en est pas un ;
- ❌ **ne pas promettre l'usage au doigt** : le portage tactile n'est pas fait
  (voir `MOBILE.md`). Sur iPhone la carte s'ouvre et s'affiche, elle ne se
  construit pas confortablement au doigt.

**⚠️ Mise à jour du 2026-09-08 — la formulation « au clavier » est devenue trop
étroite.** Depuis le 2026-09-07 la carte se construit **entièrement à la souris**
aussi : une barre d'outils à icônes ET légendes, pensée « pour quelqu'un qui ne
s'en est jamais servi » (demande d'Antonin). Le site devrait donc écrire
**« au clavier ou à la souris, comme tu veux »** plutôt que « entièrement au
clavier », qui vend moins que ce que l'app fait. Le ❌ sur le doigt, lui, tient
toujours.

**Priorité : basse.** Antonin mène sa refonte visuelle ; cette entrée attend
qu'elle soit finie. Elle ne contredit rien de ce que le site affirme
aujourd'hui — elle ajoute quelque chose qu'il ignore.

---

# ⚠️ Finance sait désormais FACTURER — la fiche du site est devenue incomplète

**Inscrit le 2026-09-10, le jour même du chantier**, comme la règle l'exige.

## Ce qui a changé dans l'app

Finance a gagné une **section Facturation** (migration 023) : émettre une
facture légalement valable, suivre ce qui a été réellement encaissé, relancer ce
qui traîne, exporter pour le comptable. **Aucun module ajouté — le compte reste
à TREIZE**, et la barre latérale n'a pas bougé d'un pixel.

## Ce que le site dit aujourd'hui, et qui est devenu trop étroit

`shale-site/vitrine/src/lib/modules.ts`, fiche **Finance** :

- `desc` — « Tu relèves tes soldes une fois par mois […] De là sortent ton
  patrimoine net, ton burn mensuel et ton runway. **Ce n'est pas un gestionnaire
  de budget** ». Toujours vrai, mais la phrase décrit maintenant **la moitié** du
  module : elle ne dit rien de la facturation.
- `points[]` — les quatre puces parlent du runway, de l'absence d'agrégation
  bancaire, du choix du liquide et du pont trading. **Aucune ne mentionne les
  factures.**
- `widget` — `kind: "runway"` avec trois lignes (liquidités, charges, part
  couverte par le trading). Il pourrait porter une quatrième ligne « encours
  client », qui est maintenant un vrai chiffre de l'écran.
- `specLabel`/`specValue` — « Montants · centimes entiers · chiffrés de bout en
  bout ». Toujours exact.

## Ce qu'il faudrait écrire — et surtout ce qu'il ne faut PAS écrire

- ✅ « émets une facture, un devis ou un avoir, et suis ce qui est réellement
  entré en banque » ;
- ✅ « **deux runways côte à côte** : avec l'argent que tu as, et si tes clients
  payent à l'échéance » — c'est l'argument le plus concret du chantier ;
- ✅ « les encours par ancienneté : à échoir, 30, 60, plus de 60 jours » ;
- ✅ « export comptable en CSV, une ligne par facture ou par ligne de facture » ;
- ✅ « PDF avec **XML Factur-X** (profil BASIC) en pièce jointe » ;

- ❌ **NE JAMAIS ÉCRIRE « conforme à la facturation électronique 2026 » ni
  « PDF/A-3 »**. Ce qui est produit est un **PDF valide portant un XML
  conforme**, pas un PDF/A-3 certifié, et aucune plateforme de dématérialisation
  n'est branchée. La réserve est écrite dans `facturx.ts` et affichée dans
  l'app ; le site ne doit pas promettre plus que l'app n'assume. C'est le point
  le plus risqué de cette entrée : une promesse de conformité engage
  commercialement, et un utilisateur qui se voit rejeter une facture parce qu'il
  a cru le site aurait raison de se plaindre ;
- ❌ ne pas écrire « nouveau module » ni toucher au compte de modules : **TREIZE
  reste TREIZE**, et ce nombre est écrit en toutes lettres à une dizaine
  d'endroits du site (`content.json`, `Demo.astro`, `lib/i18n/en.ts`) ;
- ❌ ne pas promettre de relance automatique par e-mail : **l'app n'envoie rien
  à personne**, et c'est une décision, pas un manque.

## Ce qui n'a RIEN à changer, vérifié

- **`Demo.astro`** — la démo jouable ne rend que `today`, `position` et
  `journal`. Finance n'y est qu'un libellé de barre latérale.
- **Le compte de modules** — inchangé.
- **`SPECS`** (plateformes, stockage, hors-ligne, clés d'API, langue, licence) —
  la facturation ne change aucune de ces promesses. Elle fonctionne **hors
  ligne** comme le reste : le PDF est produit localement, aucun appel réseau.

**Priorité : moyenne.** Plus haute que l'entrée « cartes mentales » : la
facturation est un argument de vente pour la cible exacte du produit —
l'indépendant au revenu irrégulier — et le site n'en dit rien. Mais elle attend
la refonte visuelle en cours, et **rien de ce que le site affirme aujourd'hui
n'est faux** : il est seulement incomplet.
## Chantier « premier démarrage » (2026-09-10)

Le site reste **hors périmètre** (refonte visuelle d'Antonin en cours). Rien
n'a été touché dans `shale-site`.

### L.1 — L'app a un accueil qui la CONFIGURE, le site n'en dit rien

**Dans l'app.** Au premier lancement, trois questions (lever/coucher, jours et
horaires de travail, blocs contraints), puis une grille de 168 cases — une par
heure de la semaine — puis un curseur « combien d'heures veux-tu récupérer par
semaine ? » qui crée un objectif. Les réponses règlent réellement les créneaux
libres proposés par le calendrier et la détection de journée surchargée.

**Côté site.** `vitrine/src/lib/modules.ts` → `SPECS`, et `content.json`
(`features`). C'est un argument de vente qui n'existait pas : *l'app est réglée
sur ta semaine avant que tu aies cliqué sur quoi que ce soit.*

⚠️ **Ce que le site ne doit SURTOUT pas écrire** — ce sont les interdits du
cahier des charges, et ils valent pour la page de vente autant que pour l'app :

- aucune estimation de « temps perdu sans Shale », aucun coefficient, aucune
  projection de gain calculée. **Le seul chiffre de gain vient de
  l'utilisateur** (le curseur) ;
- aucune formulation en perte : « il te reste 32 h libres », **jamais** « tu
  perds 14 h » ;
- rien qui suggère de dormir moins. Le sommeil est un bloc incompressible ;
  ce qui se travaille est la **régularité** de l'heure de coucher, jamais sa
  durée.

### L.2 — L'app n'est plus vide au premier lancement

**Dans l'app.** Un parcours d'exemple est créé une fois par compte : un sujet et
une fiche dans le **Savoir**, une note dans **Notes** qui cite la fiche, une
tâche quotidienne dans **Tâches**, une habitude dans **Journal**. Les objets
portent un badge « exemple », un bouton unique les retire, et ils n'alimentent
aucune statistique.

**Côté site.** Rien d'obligatoire. Mais la **démo jouable** de `Demo.astro`
montre une app peuplée : si elle doit un jour ressembler à ce que voit un
nouveau client, c'est ce parcours-là qu'elle montre, pas les données de
démonstration actuelles.

### L.3 — Aucun changement de promesse

Le compte de modules reste **treize**. Plateformes, stockage, hors-ligne, clés
d'API, sauvegarde, langue, licence, gating : **inchangés**. Rien à corriger dans
`SPECS` sur ces lignes.

---

## M — Feuille de route des objectifs (app, 2026-09-16, migration 026)

### M.1 — Textes du site : ✅ FAIT le 2026-09-16
`vitrine/src/views/refonte/Fonctionsavancer.astro` et `Modules.astro` disent
désormais ce que fait l'app : un objectif se découpe en **jalons** puis en
sous-objectifs, et son avancement **se déduit** de ce qui est fait (tâches
cochées, rendez-vous tenus, nombres atteints). Traductions anglaises ajoutées.
Commit du dépôt site : « Objectifs : le site décrit la feuille de route ».

⚠️ `vitrine/src/lib/modules.ts` n'existe plus (refonte du site) : l'audit de ce
chantier le citait encore. La description vit dans les vues `refonte/`.

### M.2 — ✅ RÉSOLU le 2026-09-26 (site `88db7c1`)
Le générateur existe : `shale-site/vitrine/tools/shoot-v2.mjs` régénère les 26
captures `v2` (dix modules × deux thèmes, trois écrans iPhone × deux thèmes)
depuis l'app en mode démo (§ 13.2 de PASSATION, dans une copie jetable). La
capture d'Objectifs montre la feuille de route. Ce qui suit est l'état d'avant.

### M.2 (historique) — la capture montrait l'ANCIENNE vue
`vitrine/public/shots/v2/dark-objectifs.webp` (1800 × 1125) date d'avant le
chantier : ni jalons, ni cibles chiffrées, ni la phrase qui dit d'où vient le
pourcentage. **Il n'existe aucun générateur pour cette famille `v2`** —
`tools/shoot.mjs` produit les familles `card-*`, `step-*` et `full-*` de la
version précédente du site, avec sa propre mise en scène (libellés publiables,
horloge figée au mercredi matin). Refaire la capture demande donc de reconstituer
cette mise en scène pour le nouveau format, ou d'accepter une image qui ne
ressemble pas aux neuf autres.

**Ce qu'il faudrait** : une passe « captures v2 » qui les régénère TOUTES d'un
coup, avec le même cadrage et la même mise en scène — c'est un chantier de site,
pas une retouche.

### M.3 — Aucun changement de promesse
Le compte de modules reste **treize**. Plateformes, stockage, hors-ligne, clés
d'API, sauvegarde, langue, licence, gating : inchangés.

## N — Champ de date à la Apple + tâche depuis l'objectif (app, 2026-09-18)

### N.1 — Aucune promesse ne change, vérifié
Le compte de modules reste **treize**. Aucun nom de module, aucune entrée de
barre latérale, aucune ligne de `SPECS` (plateformes, stockage, hors-ligne, clés
d'API, sauvegarde, langue, licence, gating), aucun raccourci clavier : rien de ce
que le site annonce n'est touché. Aucun token de design nouveau, donc rien à
répercuter dans `vitrine/src/styles/global.css`.

C'est un chantier d'**interface**, et l'interface n'est décrite par le site que
par ses captures.

### N.2 — ⛔ RESTE : toute capture montrant un formulaire montre l'ANCIEN champ
Les treize `<input type="date">` de l'app ont disparu au profit d'un champ maison
(bouton + calendrier en portail). Partout où une capture du site montre un
formulaire daté — tâche, événement, facture, flux, filtre d'échéance — elle
montre encore le rectangle gris natif.

⚠️ **C'est la MÊME dette que § M.2, pas une nouvelle** : il n'existe aucun
générateur pour la famille `v2`, et la réponse reste une passe « captures v2 »
qui les régénère toutes d'un coup, avec le même cadrage. Rien ne se retouche
image par image sans faire dépareiller les autres.

### N.3 — Ce qu'on POURRAIT dire, et qui n'a pas été écrit
Le site ne parle nulle part de la saisie d'une date, et il n'y a pas de raison
de commencer : « nos champs de date sont jolis » n'est pas un argument, et
l'annoncer obligerait à le montrer — donc à refaire les captures d'abord. À
rouvrir seulement si la passe « captures v2 » a lieu.

## O — Feuille de route lisible + carte mentale des objectifs (app, 2026-09-20)

Le chantier a changé le **vocabulaire** de la feuille de route (« jalon » →
« phase »), ajouté un en-tête et un bouton « Carte » à chaque objectif, mis
l'échéance d'une étape sur place, garni la fenêtre de création (« Par quoi
commencer »), et branché la carte mentale **dans les deux sens**.

### O.1 — ⛔ RESTE : le mot « jalon » sur le site, s'il y est
À vérifier dans `vitrine/src/lib/modules.ts` et `content.json` : si la fiche du
module Objectifs ou une FAQ emploie « jalon », le mot ne correspond plus à ce que
l'app affiche. **Un mot, pas une capture** : c'est la seule partie de cette dette
qui se corrige en cinq minutes.

```
grep -rn "jalon" ~/Desktop/Shale-projet/shale-site/vitrine/src | cat
```

### O.2 — ⛔ RESTE : la fiche du module Objectifs ne parle pas de carte mentale
`modules.ly.ts`/`modules.ts` décrit Objectifs par « objectifs décomposés en
sous-objectifs ; l'avancement se lit sur ce qui est fait ». C'est toujours vrai,
et **incomplet depuis ce chantier** : un objectif se regarde aussi en carte
mentale, et une carte mentale devient un objectif. C'est une capacité vendable —
la seule du chantier qui mérite d'être annoncée.

⚠️ **Mais l'annoncer oblige à la montrer**, donc à produire une capture de la
carte d'un objectif. Même verrou que §§ M.2 et N.2 : pas de générateur pour la
famille `v2`. **Ne rien écrire avant la passe « captures v2 ».**

### O.3 — La MÊME dette de captures, une troisième fois
`shots/v2/dark-objectifs.webp` montre toujours la vue d'avant la feuille de
route (§ M.2), et toute capture de formulaire montre l'ancien champ de date
(§ N.2). Ce chantier ajoute un en-tête et un bouton à la vue Objectifs : la
capture est donc périmée **pour la troisième raison**, ce qui ne change rien à la
réponse — une passe unique qui régénère la famille `v2` avec le même cadrage.

### O.4 — Ce qui n'a RIEN à changer, vérifié
Aucun module ajouté ou retiré (**treize**, toujours), aucun renommage dans
`Sidebar.tsx`, aucun raccourci clavier nouveau, aucun token de design, aucune
promesse de `SPECS` touchée (plateformes, stockage, hors-ligne, clés d'API,
sauvegarde, langue, licence). `Demo.astro` ne joue ni Objectifs ni Notes : sa
barre latérale et son compte « 3 MODULES SUR 12 » ne bougent pas.

---

## Q — Design system V7 « Ink & Azure » (app, entrée datée du 2026-09-20, livrée le 2026-09-22)

L'app a quitté la palette V6 : accent bleu de Shazam `#0088ff` (clair `#0060dc`),
dégradé de marque bleu → cyan (`#0088ff → #00c2ff`), fonds `#07080b` / `#f5f6f8`,
signaux plus saturés. Détail : `DESIGN.md`. **Le site ne suit pas, et c'est
volontaire pour ce chantier** : Antonin mène lui-même la refonte du site.

1. **`shale-site/vitrine`** a son propre système de tokens — accent cyan
   `oklch(0.72 0.13 225)` en sombre / `oklch(0.528 0.15 235)` en clair, fonds de
   la V6. Il ne suit pas la V7. Le dégradé bleu → cyan de la V7 s'y adapterait
   naturellement (le cyan du site en est très proche de l'arrêt final).
   → fichier : `vitrine/src/styles/global.css` (tokens `accent`, fonds).
2. **La démo jouable** (`vitrine/src/components/Demo.astro`) reproduit l'UI de
   l'app : elle montre l'ancienne palette (accent `#4d8dff`, bouton plein sans
   dégradé, anneau bleu → vert) tant que le site n'est pas aligné.
3. **L'icône du bundle macOS et les icônes iOS** portent l'accent cyan du site
   (`MOBILE.md` § 21.2) et les fonds V6. Après la V7, l'icône du Dock est cyan et
   l'app est azur. Les régénérer est un chantier à part : `tauri icon` ne touche
   pas le catalogue iOS (`MOBILE.md` § 21.3, `PIEGES.md` § 11.2).
   `icone-ios.test.ts` tolère désormais 8 unités par canal entre l'icône et les
   jetons (l'écart V6/V7 est de 1 à 6) : un nouveau glissement de la palette le
   fera tomber, comme il doit.
4. `CLAUDE.md` disait que la parité de marque exigerait **un token de marque
   dédié**. La V7 ne le crée pas : elle fait de `--color-blue` le bleu de marque
   de l'app, et laisse au chantier « site + icônes » le soin d'aligner l'autre
   côté.
5. *(2026-09-23)* **Le réussi est à l'encre dans l'app** (plus de vert pour
   « fait », « gain », « gagnant », « en direct »). La démo jouable du site
   montre encore des coches et des gains verts. À aligner avec le reste de
   cette entrée : `DESIGN.md` § « Le réussi à l'encre » dit quelle forme va
   à quel endroit.

## R — Menus contextuels et « Supprimés récemment » (app, 2026-09-23)

L'app a désormais un menu au clic droit (et un bouton « ⋯ ») sur chaque objet,
et une corbeille : ce qu'on supprime reste **30 jours** dans « Supprimés
récemment », avec « Annuler » juste après le geste.

### R.1 — Rien de FAUX sur le site, vérifié

Recherche faite dans `shale-site` (branche `sync-chiffree`) : aucune page ne dit
qu'une suppression est définitive, ni ne parle de clic droit. La seule phrase
qui touche au sujet — la FAQ de la maquette « Tout est stocké localement…
un fichier que tu peux ouvrir, sauvegarder ou supprimer » — parle du FICHIER de
base, et reste vraie.

### R.2 — ⛔ PROPOSÉ, pas écrit : une ligne sur la corbeille

Antonin décide (règle « chercher avant d'écrire du texte de vente »). Si une
ligne doit s'ajouter, l'endroit naturel est la FAQ « Mes données… », et la
formulation la plus sûre reste descriptive, sans superlatif :
« Supprimé par erreur ? Tout ce que tu supprimes attend 30 jours dans
Supprimés récemment. »
Pourquoi pas plus : c'est une attente de base (Notes, Fichiers, Photos le
font), pas un argument ; la vendre comme une fonctionnalité sonnerait faux.

### R.3 — La démo jouable

`vitrine/src/components/Demo.astro` n'a ni menu contextuel ni corbeille. Rien à
faire tant qu'elle ne montre pas de suppression.


## S — Cartes déplaçables et typées, carte d'objectif éditable (app, 2026-09-29)

L'app sait maintenant, et le site ne le dit nulle part :
- **déplacer un nœud à la main** sur une carte mentale (il ne bouge plus tout
  seul) ; « Réorganiser » remet tout en ordre ;
- **transformer un nœud en vraie tâche, étape ou habitude** — l'objet naît dans
  Tâches, dans la feuille de route ou dans le Journal ; son état (coche, échéance,
  série, %) se lit sur la carte ;
- **modifier un objectif depuis sa carte** : ajouter, renommer, cocher,
  supprimer — la feuille de route suit.

À répercuter : la page Notes/Savoir (section cartes mentales) et la page
Objectifs du site ; la capture `shots/v2/dark-objectifs.webp` était déjà
périmée (entrée M), elle l'est davantage.

✅ **La vue Objectifs a changé (phase D, 2026-09-29) — les captures peuvent être
régénérées maintenant** : maître-détail (la liste des objectifs, chacun avec sa
prochaine action ; la fiche de l'objectif choisi avec sa feuille de route), une
icône par niveau (dossier pour la phase, cible pour le sous-objectif), l'habitude
qui compte une étape nommée dans sa ligne. À montrer sur le site : « chaque
objectif dit quoi faire ensuite ». Captures de référence prises en démo (sombre
et clair, bureau et 390 pt) dans le brouillon de la session — à refaire par le
générateur `shots/v2` (entrée M.2), pas à recopier.
## U — Timer : horloge à volets et fenêtre séparée (app, 2026-09-29)

Sur `chantier/timer-flip`, **pas encore dans l'app installée**. Une séance
lancée s'affiche en horloge à volets (cartes MM / SS), et peut partir dans sa
propre fenêtre, à poser sur un autre écran et à passer en plein écran là-bas.

### U.1 — Rien de FAUX sur le site, vérifié

Lu dans `shale-site` le 2026-09-29 (sans rien y toucher — le dépôt était sur la
branche d'une autre session) : « Plein écran sans distraction : le compte à
rebours, rien d'autre. » et « Préréglages ou durée sur mesure, et un mode plein
écran » restent vrais. Les captures `shots/v2/dark-timer.webp` et
`light-timer.webp` montrent le **lanceur**, pas une séance en cours : l'anneau
disparu n'y figure pas.

### U.2 — ⛔ PROPOSÉ, pas écrit : la fenêtre séparée

Antonin décide (règle « chercher avant d'écrire du texte de vente »). Si une
ligne doit s'ajouter, c'est dans la liste du Timer de `Fonctionsavancer.astro`,
descriptive : « Le chrono dans sa propre fenêtre, à poser sur un second écran. »
À n'écrire **qu'après** le build natif qui l'installe.

### U.3 — ✅ Capture FAITE le 2026-09-30 au soir — ⛔ pas branchée

*`shoot-v2.mjs` lance une séance en dernier et écrit `dark-timer-seance.webp`
et `light-timer-seance.webp` (horloge à volets 24 | 56, Pause, Terminer, Plein
écran, Fenêtre séparée). En ligne à leur adresse, mais **aucune page ne les
affiche** : `timer.webp` reste le lanceur, que la fiche du module décrit
(« TIMER · 25 · 5 », `Modules.astro`). Où la montrer est une décision de page,
à prendre avec Antonin. Ce qui suit est le constat d'origine.*

L'horloge à volets est la partie la plus montrable du module, et aucune capture
du site ne montre une séance lancée. À ajouter au générateur de captures v2
quand l'app installée la porte.

## V — Vue Tâches rangée par moment ; suppressions en cascade (app, 2026-09-30)

### V.1 — Rien de FAUX sur le site, vérifié

`Fonctionsdecider.astro`, section « 02 Tâches » : « Tâches, récurrences et
étiquettes », « Chaque tâche peut être rattachée à un objectif », « Ce qui est
coché part tout seul dans le journal » — tout reste vrai.

### V.2 — ✅ FAIT le 2026-09-30 au soir (avec W.1, site `7be4f7d`)

*`dark-taches.webp` et `light-taches.webp` montrent la vue rangée par moment
(En retard / Aujourd'hui / Faites). Ce qui suit est le constat d'origine.*

`public/shots/v2/dark-taches.webp` et `light-taches.webp` montrent l'ancienne
liste plate (filtres de statut, point de priorité, panneau des tags). À
régénérer avec le générateur de captures v2 quand l'app installée porte la vue.

### V.3 — ⛔ PROPOSÉ, pas écrit : une puce

« Rangées par moment : en retard, aujourd'hui, à venir » — à trancher par
Antonin (règle : chercher avant d'écrire du texte de vente).

## W — Le trading mis de côté (app ET site, 2026-09-30)

L'app n'affiche plus rien de trading (`TRADING_ACTIF = false`, `CLAUDE.md`
section du 2026-09-30). Le site a été nettoyé le même jour (branche
`chantier/sans-trading-site` du dépôt du site) : encadré de fin des articles,
exemple « 50 backtests » de Fonctionnalités → Avancer, 113 traductions
orphelines, table de relabellisation de `shoot-v2.mjs`. Ce qui reste :

### W.1 — ✅ FAIT le 2026-09-30 au soir (site `7be4f7d`, en ligne)

*Patch démo autorisé par Antonin pour la session ; retiré ensuite (`grep -r
AUDIT-TEMP src/` = 0, `git diff --exit-code src/lib/auth/` passe). Les 26
captures refaites depuis mobile-ios `b35974d` — la démo d'un indépendant — et
**regardées une par une**, avec les deux nouvelles de U.3 : 28 images, clair
et sombre, bureau et iPhone, aucun mot de trading, aucun mur de connexion,
aucun « mode démo ». Sur www.shaleapp.com, les images servies sont identiques
octet pour octet (condensat comparé). Détail : JOURNAL du site, 2026-09-30
(soir). Ce qui suit est le constat tel qu'il avait été écrit.*

Accueil, Fonctionnalités, Modules : « Passer trader full-time », « Revue des
trades de la veille », tag « Trading », Notes ouvert sur « Setup cassure H4 »,
lien rapide TradingView… C'est aujourd'hui **la trace de trading la plus
visible du site**. La démo de l'app est prête (un indépendant) et
`shoot-v2.mjs` est à jour ; il ne manque que la génération, qui demande l'app
en mode démo — **refusé par le mode automatique** (`PIEGES.md` § 26.2 et
§ 28.3). Geste : une session autorisée lance l'app en démo sur :5199 et
`node tools/shoot-v2.mjs`. Profiter du même passage pour V.2 (vue Tâches) et
U.3 (Timer).

### W.2 — ✅ FAIT le 2026-09-30 (validé par Antonin) : l'avertissement des mentions légales

*Écrit et mis en ligne le soir même, avec une correction d'exactitude en plus
(« exclusivement sur les valeurs saisies » était faux pour Finance) et la
version affichée montée à 1.3 — détail dans le JOURNAL du site. Ce qui suit est
la proposition telle qu'elle avait été faite.*

`legal.json` / `legal.en.json`, mentions légales, section « Avertissement sur
les marchés financiers » : « logiciel de préparation, de calcul et de
journalisation », « Les décisions de marché… », « Le trading comporte un risque
de perte en capital ». Non touché : c'est un texte juridique protecteur, et
Finance affiche encore des positions et des cours (Yahoo, Binance) — « pas un
conseil en investissement » reste utile. Proposition à trancher par Antonin :
garder la section, retitrer « Avertissement sur les placements financiers »,
remplacer « décisions de marché » par « décisions d'investissement » et « Le
trading comporte » par « Investir comporte ». ⚠️ La session `precommande`
modifie `legal.json` le même jour (liste d'attente) : faire la retouche après
sa fusion.

### W.3 — Phrases trading qui survivent ailleurs que dans les pages

- `SHALE.md` (racine du projet) : « app de bureau de productivité et de
  trading » — corrigé en datant, le 2026-09-30.
- `public/shots/full-marketbrain.png`, `full-position.png`, `card-position.png`
  : plus liés par aucune page publiée (seuls des articles en brouillon citent
  `card-position.png`), mais toujours servis à leur adresse. Laissés en place
  avec les brouillons — c'est « mis de côté », pas supprimé.
- Les trois articles en brouillon parlent de trading ; les republier demandera
  de les relire.

## T — L'IA de Shale Pro (app, chantier `ia-pro` ouvert le 2026-09-29)

⛔ **Rien à publier tant que l'IA n'est pas livrée dans l'app** (règle : une
promesse n'arrive sur le site qu'après la fonction). Ce qui devra changer, à la
phase H du chantier, **chaque phrase soumise à Antonin avant d'être écrite** :

- `vitrine/src/views/refonte/Tarifs.astro:32` dit aujourd'hui « Pro n'ajoute pas
  de fonctions : il ajoute le support prioritaire et l'accès anticipé ». Faux dès
  la livraison : l'IA devient la première fonction propre à Pro.
- **Business n'a PAS l'IA** (Antonin, 2026-09-29 : « pas de business pour
  l'instant, à corriger sur le site »). La carte Business de Tarifs et
  `Business.astro` doivent le dire sans ambiguïté — Business coûte plus cher que
  Pro, un visiteur supposera l'inverse.
- Les phrases sur le chiffrement de bout en bout (`Tarifs.astro:56`,
  `Business.astro:86`, `Questions.astro:29`) restent vraies pour la
  synchronisation, mais une mention honnête doit s'ajouter : les fonctions d'IA
  envoient le texte concerné au fournisseur de modèle le temps de la réponse,
  sans stockage par Shale.
- CGV et politique de confidentialité : Anthropic comme sous-traitant (geste
  d'Antonin, § 10 du cahier des charges).
- ⚠️ Le cahier des charges cite `SPECS` et `content.json` : `SPECS` n'existe plus
  dans le site ; les textes vivent dans le dictionnaire i18n et
  `views/refonte/*.astro`.

### T.1 — Ce que la phase C ajoute (2026-09-30), toujours ⛔ rien à publier avant livraison
- Le brief du matin (sujets choisis, sources RSS, « ta journée ») et la clôture
  du soir (bilan + reports à valider) : à décrire tels quels, avec la limite de
  cinq sujets et le lien de chaque source.
- Le quota en ACTIONS (400 par mois, 60 pendant l'essai), jamais en jetons.

### T.2 — 2026-10-01 : le fournisseur est Google (Gemini), plus Anthropic
Partout où le § T parlait d'Anthropic, lire **Google**. Politique de
confidentialité : Google comme sous-traitant (API Gemini, palier payant). ⚠️ Le
site est en LISTE D'ATTENTE depuis le 2026-09-30 : toute mention de l'IA dans Pro
se rend sous `LISTE_ATTENTE` comme le reste de la vente.

### T.3 — 2026-10-01 : la capture (phase D)
Coller un e-mail, déposer un PDF ou la photo d'un reçu : l'IA propose tâches,
rendez-vous, notes et achats (facture d'achat en brouillon, montants à vérifier) ;
« Vide ta tête » transforme du vrac en tâches. Tout se valide avant d'être écrit.

### T.4 — 2026-10-01 : tâches et objectifs (phase E)
Découper une tâche floue en étapes ; estimer une durée à partir de son propre
historique Timer (la fourchette est calculée par l'app, pas par l'IA) ; décomposer
un objectif en sous-objectifs ; proposer ses prochaines tâches, datées selon le
calendrier ; expliquer un objectif en péril et proposer un plan de rattrapage.
⚠️ Ne pas promettre « l'IA estime tes tâches » sans dire qu'il faut un historique
Timer (trois tâches comparables au moins).
