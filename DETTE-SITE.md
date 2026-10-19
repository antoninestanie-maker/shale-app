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

### T.5 — 2026-10-01 : les notes (phase F)
Dans une note : résumer, réécrire (plus clair, plus court, ton professionnel, avec
avant/après et annulation), suggérer des liens vers ses propres objets, développer
des puces, traduire dans une nouvelle note, faire une carte mentale modifiable.
⚠️ Dans les Notes seulement — pas (encore) dans les fiches du Savoir.

### T.6 — 2026-10-01 : la revue hebdomadaire (phase G), et PAS de Finance
Chaque semaine, dans Performance : ce qui a tenu, ce qui a glissé, trois
ajustements à transformer en tâches. Générée à la demande (un rappel le dimanche
soir, réglable). Le Journal n'y entre que sur accord explicite, et seulement par
ses notes d'humeur et d'énergie.
⚠️ **Ne rien écrire sur le runway, les scénarios « et si… » ni les factures** :
Finance est mise de côté dans l'app (2026-10-01), ces fonctions d'IA n'existent pas.

### T.7 — 2026-10-01 : ⛔ les changements du site, À VALIDER (phase H) — RIEN N'EST APPLIQUÉ

Le site est en liste d'attente (`LISTE_ATTENTE = true`) : les tarifs sont cachés,
mais la confidentialité, les questions et l'accueil sont publics. Deux lots.

**Lot A — à faire AVANT de déployer la fonction `ai` (pages publiques aujourd'hui).**

> **Point du 2026-10-01 au soir.** Migration 010 jouée ; fonction `ai` toujours non
> déployée (geste d'Antonin). Lot A **non appliqué** : `chantier/accueil-epure` (site,
> non fusionnée) modifie les deux mêmes fichiers (`legal.json`, `Questions.astro`) —
> l'appliquer APRÈS sa fusion. La vraie borne n'est pas le déploiement (tout est
> éteint, rien ne part chez Google) mais **l'allumage de la première fonction dans
> `ai_config`** : pas d'`enabled = true` tant que le Lot A n'est pas en ligne.
>
> **Relevé le 2026-10-02 (ai.google.dev/gemini-api/terms).** Services payants : Google
> n'utilise ni les prompts ni les réponses pour améliorer ses produits, MAIS les garde
> « a limited period of time » (durée non chiffrée) pour détecter les abus. La phrase
> A2 dit « ni conservé par nous » — exact pour Shale ; à compléter d'un mot sur Google
> (« notre fournisseur peut le garder brièvement pour détecter les abus ») plutôt que
> de laisser croire que rien n'est gardé nulle part. Même remarque pour l'écran de
> consentement de l'app. Pour un développeur de l'EEE, ces conditions « payantes »
> valent aussi sur le palier gratuit — la facturation reste nécessaire pour les quotas.

| # | Fichier | Aujourd'hui | Proposé | Pourquoi |
|---|---|---|---|---|
| A1 | `lib/legal.json` → Confidentialité, « Sous-traitants » (tableau) | cinq prestataires | + une ligne : « Fonctions d'IA (Shale Pro, sur activation) — Google (API Gemini) — États-Unis » | Google devient sous-traitant dès le premier appel (RGPD art. 28). |
| A2 | même page, « Le principe » | « Vos données d'usage vivent sur votre Mac. Ce qui est synchronisé entre vos appareils est chiffré chez vous, et nous ne pouvons pas le lire. » | garder, et ajouter un paragraphe : « Exception, et seulement si vous l'activez : les fonctions d'IA de Shale Pro envoient le texte concerné (la note à résumer, le document à lire…) à nos serveurs puis à notre fournisseur de modèle, le temps de la réponse. Ce texte n'est ni conservé par nous, ni utilisé pour entraîner un modèle. L'application montre ce qui part avant chaque envoi. » | La phrase actuelle reste vraie de la SYNCHRO ; elle devient trompeuse si elle est la seule. |
| A3 | même page, « Transferts hors Union européenne » | cite Stripe, Resend, Vercel | + Google, pour les fonctions d'IA | cohérence avec A1. |
| A4 | `views/refonte/Questions.astro`, « Mes données partent-elles quelque part ? » | « … Nous stockons donc des données que nous ne pouvons pas lire. » | + une phrase : « Seule exception : les fonctions d'IA de Shale Pro, éteintes par défaut. Quand vous en lancez une, le texte concerné part le temps de la réponse, sans être conservé. » | même raison. |
| A5 | `views/compte/Accueil.astro` | « … seule une copie chiffrée part pour la synchronisation. » | « … une copie chiffrée part pour la synchronisation. » (retirer « seule ») | « seule » devient faux pour un Pro qui a allumé l'IA. |
| A6 | `content.json` | version des textes légaux 1.3 · 30.09.2026 | 1.4 · date du jour de publication | la confidentialité change. |

Les phrases « le serveur ne peut pas lire vos données » qui parlent
EXPLICITEMENT de la copie de synchronisation (Accueil l. 114, Modules l. 169,
Notes de version, Tarifs l. 132) restent vraies : **non touchées**.

**Lot B — à faire AVANT de rouvrir les tarifs (`LISTE_ATTENTE = false`).**

| # | Fichier | Aujourd'hui | Proposé |
|---|---|---|---|
| B1 | `views/refonte/Tarifs.astro` l. 32 | « La première formule contient l'application entière. Pro n'ajoute pas de fonctions : il ajoute le support prioritaire et l'accès anticipé aux nouveautés. … » | Pro ajoute désormais les fonctions d'IA : la phrase est FAUSSE. Texte à écrire avec Antonin (règle « chercher avant d'écrire du texte de vente »). |
| B2 | même fichier, carte Pro | « Le même produit, avec une ligne directe et les nouveautés en premier. » · « deux différences — pas une de plus » · deux puces | trois différences : + « Fonctions d'IA : 400 actions par mois » avec la liste réelle (brief, capture, découper/estimer, objectifs, notes, revue). |
| B3 | même fichier, carte Business | — | dire que Business n'inclut PAS l'IA (décision Q2 du 2026-09-29). |
| B4 | « Shale, c'est tout le produit. » (titre) et « INCLUS, SANS EXCEPTION » | — | à relire : ils promettent que la première formule contient tout. |
| B5 | pages Fonctions (décider / avancer / penser) | pas d'IA | une mention sobre par page, quand la fonction est réellement allumée — pas avant. |
| B6 | CGV | — | l'IA : quota en actions, pas de garantie de résultat, fournisseur tiers. |

⚠️ Abonnés Pro existants : la promesse « Pro n'ajoute pas de fonctions » leur a
été faite. L'IA est un ajout, pas un retrait — mais B1 doit être corrigé le jour
même où l'IA s'ouvre. ⚠️ Le chantier `accueil-epure` (autre session, non fusionné)
réécrit l'accueil : appliquer ce lot PAR-DESSUS, pas avant.

## U. L'app iPhone et l'App Store (2026-10-06) — RIEN N'EST APPLIQUÉ

Venu du chantier `ios-soumission` (`MOBILE.md` § 28).

| # | Sujet | À faire sur le site | Quand |
|---|---|---|---|
| U1 | L'app iPhone ouvre `…/legal#confidentialite` depuis Réglages (Apple exige ce lien dans l'app, règle 5.1.1(i)) | La page a le menu du site, qui mène aux tarifs. Une version **sans menu ni lien d'achat** de la page légale serait plus sûre face à la règle « aucun appel à acheter ». ⚠️ Si l'adresse change, `PAGE_CONFIDENTIALITE` (`src/lib/auth/config.ts`) est **compilée dans l'app** | avant la soumission, de préférence |
| U2 | La même adresse sert d'« URL de la politique de confidentialité » dans la fiche App Store | Vérifier que la politique dit ce que la fiche déclare : e-mail, identifiant de compte, contenu synchronisé **chiffré de bout en bout** ; aucun suivi. Jamais « 100 % local » | avant la soumission |
| U3 | « URL d'assistance » de la fiche | Il faut une page ou une adresse de contact qui ne soit pas la page des tarifs | avant la soumission |
| U4 | Annoncer l'app iPhone | Le site dit « macOS aujourd'hui ; Windows et iOS ensuite ». **Ne rien changer avant que l'app soit réellement publiée.** Ensuite : `SPECS` (plateformes), FAQ, et un lien vers l'App Store | après l'acceptation d'Apple |
| U5 | iOS minimum | L'app iPhone demande **iOS 17** (`MOBILE.md` § 28.2) : à écrire là où le site donnera les prérequis | avec U4 |

## X — Aujourd'hui : habitudes à tenir à la place du graphique 7 jours (app, 2026-10-07)

Les quatre captures `shots/v2/*aujourdhui.webp` montrent encore la carte « 7 derniers jours ». À refaire à la prochaine série de captures ; aucun texte du site ne cite ce graphique (vérifié par `grep` dans `vitrine/src`).

## Y — Objectifs : liste → page d'un objectif, et le fil (app, 2026-10-08)

La vue Objectifs a encore changé : plus de maître-détail. Une liste pleine largeur (chaque objectif avec son fil couché), puis la page d'un objectif avec le fil le long de la feuille de route — la même grammaire que le fil de l'accueil du site. `shots/v2/*objectifs.webp` montre toujours l'ancienne vue (entrée M) : à refaire à la prochaine série de captures. À dire sur le site, si Antonin le veut : « le fil de l'accueil, c'est celui de vos objectifs ». Aucun texte du site ne décrit la disposition de la vue (rien à corriger d'urgence).

## Z — Performance : un onglet d'analyse (app, 2026-10-09)

L'onglet Performance a changé de nature : une période unique (7 j · 30 j · 3 mois · 6 mois), chaque chiffre comparé à la période d'avant, la discipline des tâches ET des habitudes en courbe et en carrés, par jour de la semaine, et une carte « À améliorer ». À répercuter : la fiche Performance de `vitrine/src/lib/modules.ts` (si elle cite encore « jour, semaine ou mois » : ce réglage n'existe plus) et les captures `shots/v2/*performance*`. Une phrase possible, à valider par Antonin : « Shale vous dit ce qui décroche, chiffres à l'appui ». Rien d'urgent : aucune promesse du site n'est devenue fausse.

## AA — Retours du tournage en anglais (app, 2026-10-10)

Aucun texte du site à changer (la maxime du bandeau n'y figure pas). Les captures ANGLAISES du Calendrier et d'Aujourd'hui prises avant ce jour montrent « 7 j », « due on 2026-… », « five times » : à refaire au prochain passage de captures.

## AB — Barre latérale réductible, « Aujourd'hui » fixe (app, 2026-10-11)

La démo jouable (`Demo.astro`, `NAV`) et les captures `shots/v2` montrent l'ancienne barre : pas de ligne « Réduire », « Aujourd'hui » dans la liste qui défile, en-tête Calendrier d'Aujourd'hui avec icône. Aucun texte du site ne décrit la barre : rien à corriger en mots. À reprendre au prochain passage de captures.

## AC — Correctifs d'après le labo (app, 2026-10-12)

Le site est en liste d'attente : rien de ceci n'est promis publiquement aujourd'hui, mais les pages et les captures décrivent l'app d'avant.

### `sans-energie`

Le site montre et dit encore la jauge. Rien n'a été touché côté site.

**Captures où la carte « ÉNERGIE RESTANTE 100 % » est visible** (vu sur `dark-aujourdhui.webp`) :
- `vitrine/public/shots/v2/dark-aujourdhui.webp` et `light-aujourdhui.webp` ;
- `vitrine/public/shots/v2/dark-phone-aujourdhui.webp` et `light-phone-aujourdhui.webp` — à vérifier, la jauge est plus bas dans la page au téléphone ;
- les anciennes `vitrine/public/shots/full-today.png`, `card-today.png`, `phone-today.png`, encore citées par deux articles du blog (`trois-taches-par-jour`, `pourquoi-tu-abandonnes-au-neuvieme-jour`, en français et en anglais) — à vérifier ;
- `shots/3d/*-heros-iphone.webp` — à vérifier. `*-heros-mac.webp` montre Objectifs : pas concerné.

Ces captures seront aussi fausses pour une autre raison : Aujourd'hui s'affiche maintenant en deux colonnes continues (Timer, Habitudes et Liens rapides sous Discipline).

**Textes qui citent l'énergie restante** (pages de la refonte, dictionnaire `vitrine/src/lib/i18n/en.ts` à suivre) :
- `views/refonte/Accueil.astro`, temps « 03 Aujourd'hui » : « … ce que le calendrier a déjà bloqué, et l'énergie qu'il reste. »
- `views/refonte/Modules.astro` (deux fois) : « … la discipline tenue, l'énergie restante et l'agenda. »
- `views/refonte/Fonctionsdecider.astro` : « … la discipline tenue, l'énergie restante, les objectifs en cours et l'agenda… » et la puce « L'état du jour en un coup d'œil : discipline, énergie, série en cours ».
- Clés du dictionnaire sans doute orphelines, à contrôler : « Tâches du jour, objectifs, énergie restante. Zéro page blanche. », « L'énergie restante baisse avec les trades pris et les heures d'écran — elle dit quand t'arrêter. », « ÉNERGIE RESTANTE », « Énergie restante ».

**À ne pas toucher sur le site** : tout ce qui parle de l'humeur et de l'énergie du **Journal** (« Humeur et énergie en un clic, deux échelles de 1 à 5 », etc.) reste vrai.

### `taches-jour`

- **Les captures de l'écran Aujourd'hui** deviennent fausses : une ligne « En retard » peut apparaître en tête ; la ligne d'ajout de la carte « Tâches du jour » porte une pastille « aujourd'hui » ; « Objectifs en cours » ne montre plus les étapes ; le « ⋯ » des lignes est visible au repos ; la Discipline ne compte plus les tâches sans date.
- **Les captures de la vue Tâches** aussi : la ligne d'ajout porte un bouton calendrier ; un choix « Par moment / Par objectif » est apparu sous les tags ; les dates des lignes sont soulignées en pointillé.
- **Les captures d'un menu de tâche** (s'il y en a) : « Dater » a changé, « Focus 25 min » est dans Tâches.
- **Aucun texte du site** ne devient faux à ma connaissance. Si une page décrit l'ajout rapide ou le report, elle peut maintenant dire qu'on écrit « jeudi » dans la phrase et qu'on reporte d'un jour en un geste — à chercher et à proposer à Antonin avant d'écrire.

### `etapes-cochables`

- **Captures.** `shots/v2/*objectifs.webp` montre déjà l'ancienne vue (entrées M et Y). Les prochaines captures de la page d'un objectif montreront : une case devant chaque étape vide, « 1 étape sur 3 » sous le pourcentage, et la rangée « Ajouter une étape · Tâche · Rattacher ». Rien à refaire d'urgence.
- **Une phrase à relire** : fiche Objectifs de `vitrine/src/views/refonte/Modules.astro` (et sa traduction, `vitrine/src/lib/i18n/en.ts`) — « Objectifs découpés en phases, dont l'avancement se déduit de ce qui est fait — jamais saisi à la main. » Une étape vide se coche maintenant à la main. Ce n'est pas un pourcentage saisi (c'est une coche, comme une tâche), mais « jamais saisi à la main » était déjà inexact depuis « Suivre à la main ». À reformuler par Antonin s'il le veut ; aucune autre promesse du site ne devient fausse (vérifié par `grep` dans `vitrine/src` : « ce qui est fait », « étape vide », « se coche »).

### `etapes-taches`

Le site emploie « sous-objectif » et *sub-goal*, que l'app n'affiche plus. Rien n'est faux sur ce que l'app FAIT ; ce sont des mots.

- `vitrine/src/views/refonte/Fonctionsavancer.astro`, ligne 50 : « Un objectif se découpe en phases, puis en sous-objectifs. […] » — à dire : « en étapes, et une étape peut en regrouper d'autres ». Sa traduction : `vitrine/src/lib/i18n/en.ts`, ligne 1596 (“into phases, then sub-goals”).
- `vitrine/src/lib/i18n/en.ts` porte trois autres clés avec le mot, que je n'ai retrouvées dans aucune vue de `vitrine/src` (à vérifier avant de les retirer) : « Sous-objectifs imbriqués : l'avancement du parent se calcule tout seul. » (ligne 521), « Objectifs court, moyen et long terme, découpés en sous-objectifs, avec les tâches qui les font avancer. […] » (ligne 1369), « Un objectif porte ses sous-objectifs, ses tâches et son échéance » (ligne 1501).
- « un objectif découpé en phases » (`Accueil.astro` lignes 60 et suivantes, `Modules.astro` ligne 75, métadonnées) : une phase est maintenant une étape qui en contient d'autres ; un objectif se découpe d'abord en ÉTAPES. La phrase n'est pas fausse, elle n'est plus le mot de l'écran.
- **Captures.** Toute capture de la page d'un objectif montre l'ancienne feuille de route : la légende « Phase · Sous-objectif · Tâche », la cible pâle devant les étapes, la rangée « Ajouter une étape · Tâche · Rattacher ». Les prochaines montreront « Phase · Étape · Tâche », un losange, « ＋ Tâche · ＋ Étape · Rattacher », et « En faire une tâche » sur les étapes vides. Même chose pour la fenêtre « Nouvel objectif » (tâches d'abord) et pour le menu « Type » d'une carte mentale.
- La dette notée par le chantier `etapes-cochables` (la fiche Objectifs de `Modules.astro`, « jamais saisi à la main ») reste entière.

### `performance-jour`

- **Captures de Performance périmées** : `vitrine/public/shots/v2/dark-performance.webp` et `light-performance.webp` (utilisées par `Accueil.astro`, `Modules.astro`, `Fonctionsavancer.astro`). Elles ne montrent ni la rangée « Aujourd'hui », ni les deux onglets, ni les dates sous les tuiles ; la tuile s'y appelle encore « Série en cours ». À refaire avec le reste des captures de Performance déjà dues (section Z).
- **Texte déjà faux depuis le 2026-10-09, toujours en ligne** : `vitrine/src/views/refonte/Fonctionsavancer.astro` écrit « par jour, par semaine ou par mois » et « Vue jour, semaine ou mois ». Ce réglage n'existe plus : la période se choisit en 7 j, 30 j, 3 mois ou 6 mois. (La section Z le cherchait dans `modules.ts` ; il est dans ce fichier.)
- **Texte redevenu vrai** : même fichier, « Le total du jour part dans la performance et le journal ». Jusqu'ici le total du jour n'apparaissait dans Performance que le lendemain.
- **Ne rien écrire sur le site à propos de « Par objectif »** tant que c'est un essai.

### `notes-sans-titre`

- Les quatre captures de la vue Notes du site
  (`vitrine/public/shots/v2/dark-notes.webp`, `light-notes.webp`,
  `dark-phone-notes.webp`, `light-phone-notes.webp`) montrent la liste **sans**
  la rangée d'onglets « Toutes les notes / Sans titre ». Sur téléphone, le
  bouton « + » et le champ de recherche sont aussi un peu plus hauts (44 pt). À
  refaire au prochain passage de captures ; rien d'urgent, rien de faux.
- Aucun texte du site ne devient faux : le site ne parle ni de tri des notes ni
  de notes sans titre. Non relu page par page.

### `telephone`

- **Les captures d'iPhone préparées pour l'App Store** (`~/Desktop/Shale-chantiers/captures-ios-20261006/`, et les trois écrans iPhone des captures `v2` du site) montrent l'état d'avant : la feuille « Plus » en lignes pleines avec son pied sous le pli, Aujourd'hui avec 32 px de marge et les habitudes en bas, les boutons de 36 px. À refaire avant la soumission, **après** un build iOS de cette branche.
- **Journal, bureau** : si une capture du site montre les lignes d'habitudes, la flamme n'est plus à la même place (contre les carrés).
- Rien d'autre : aucun texte du site ne décrit ce qui change ici.

## AD — Retours de la seconde passe du labo (app, 2026-10-12)

Rien de neuf pour le site tant que l'horloge reste seule : la remarque du chantier ci-dessous ne vaut que si ses commandes deviennent visibles.

### `retours-passe2`

- Toute capture ou vidéo du site qui montre **le minuteur en plein écran avec l'horloge seule** devient fausse : l'écran porte maintenant le nom de la tâche, « Pause », « Terminer » et « Réduire ». À vérifier dans les captures du Timer et dans le reel qui montre l'horloge à volets. Non recensé page par page.
- Aucun texte du site ne décrit l'ajout rapide au mot près, à ma connaissance : rien d'autre.

## AE — Retours d'Antonin après essai (app, 2026-10-12 soir)

Rien de publié sur le site ce soir. Ce que ces trois chantiers rendent faux ou périmé :

### `perf-epure` — Performance épurée, et les cartes qui ne bougent plus au survol

- **Captures de Performance** (`vitrine/public/shots/v2/dark-performance.webp`, `light-performance.webp`, déjà à refaire depuis les sections Z et `performance-jour`) : elles montrent les quatre tuiles de période et la carte « focus par tag », qui n'existent plus. Les prochaines montreront la rangée « Aujourd'hui » à quatre chiffres, puis « À améliorer », puis les cartes de discipline avec leur moyenne sous le titre.
- **« Par objectif »** : la consigne du 2026-10-11 (« ne rien écrire sur le site tant que c'est un essai ») devient « ne rien écrire du tout » — l'onglet est retiré. Rien n'en parlait.
- **Captures de la vue Timer** : à une largeur de fenêtre moyenne, la carte « Objectif quotidien » a son sélecteur sous le titre, plus à côté.
- Aucun texte du site ne devient faux : il ne cite ni les tuiles, ni le focus par tag.

### `focus-ile` — le focus sans plein écran, la pastille du minuteur, la barre des menus

- Toute capture ou vidéo du site où **la pastille de séance** apparaît montre l'ancienne : un point, le temps, le nom. Elle porte maintenant un bouton pause et un « ⋯ ».
- Tout texte du site qui dit ou laisse entendre que **lancer un focus ouvre le plein écran** devient faux. Le plein écran se demande.
- Une capture d'un **menu de tâche** pendant une séance : l'entrée Focus y est désormais, grisée.
- La **carte Timer d'Aujourd'hui** en séance a trois boutons, plus deux.
- À dire un jour si c'est confirmé après le build : sur Mac, le temps restant est dans la barre des menus. **Ne pas l'écrire avant qu'Antonin l'ait vu.**
- Non recensé page par page.

### `dates-claires` — la pastille « sans date », l'échéance d'un objectif

À vérifier sur le site, non regardé dans ce chantier :
- toute capture de la **page d'un objectif** : l'en-tête a changé (l'échéance n'est plus dans la ligne de petites capitales ; une ligne « Échéance » est apparue sous le titre) ;
- toute capture de la **liste des objectifs** : « J−123 » est devenu « échéance 12 février 2027 » ;
- toute capture de **Tâches** montrant la ligne d'ajout : l'icône de calendrier est devenue la pastille « sans date » ;
- toute capture de l'**accueil**, écran « objectif » : un champ « Son échéance (facultatif) » s'est ajouté ;
- tout texte du site qui dirait que l'accueil ne demande pas de date : je n'en connais pas.

## AF — Démo : les habitudes ne font plus un damier (app, 2026-10-13)

Aucun texte du site ne change. Les **captures** tirées de la démo qui montrent les habitudes sont à refaire au prochain passage : la carte « habitudes — 12 semaines » du Journal (grille et lignes de quatorze jours), et dans Performance la courbe « Discipline — habitudes », ses carrés et le détail par habitude (Méditation 87 %, Sport 43 %, Lecture 60 % un mardi ; avant : 87 / 43 / 50). Non regardé : quelles pages du site portent ces captures aujourd'hui.

**Le soir même** : la démo a huit habitudes au lieu de trois, quatre jours sans rien, et les tâches ont huit semaines d'historique au lieu de douze jours. Sont donc à refaire aussi les captures d'**Aujourd'hui** qui montrent « Habitudes à tenir » (huit lignes, « 2/8 ») et tout **Performance** (discipline des tâches à 79 % sur 30 jours, focus sur toute la période). Si une page du site écrit « trois habitudes » à propos de la démo, elle est fausse — je n'en connais pas.

## AG — La barre du bas se choisit (app iPhone, 2026-10-13)

Rien de publié sur le site. Rien n'y devient faux : la barre d'origine (Aujourd'hui · Tâches · Notes · Journal · Plus) reste le défaut, donc toute capture ou maquette de l'app iPhone reste juste.

- À dire un jour, si la page iPhone existe : la barre du bas se règle dans Personnaliser. **Ne pas l'écrire avant qu'Antonin l'ait essayée sur son téléphone.**
- Non recensé page par page.


## AH — Journal sans humeur ni énergie, Timer à deux visages, Calendrier en semaine au téléphone (app, 2026-10-14)

- **Journal** : l'app ne saisit PLUS l'humeur ni l'énergie du jour. Toute page du site qui promet « humeur, énergie » dans le Journal ment désormais — le Journal, c'est le texte du jour et les habitudes, avec une barre pour choisir le jour. Chercher « humeur », « énergie », « mood », « energy » dans `vitrine/` (pages modules, dictionnaire i18n, captures).
- **Timer** : deux affichages au choix, les volets ou l'anneau. Une fiche qui ne montre que les volets n'est pas fausse, mais incomplète.
- **Calendrier** : la vue Semaine existe et s'ouvre par défaut sur iPhone ; un clic droit (ou un maintien au doigt) ouvre le menu d'un événement. Les captures iPhone qui montrent l'agenda par défaut sont datées.
- **Performance** : les écarts s'écrivent en « % », plus en « pts » — une capture avec « pts » est périmée.

## AI ✅ REPORTÉ SUR LE SITE le 2026-10-20 — Accent V8 « Encre & Braise » (app, 2026-10-19)

L'app quitte le bleu Shazam (`#0088ff` / dégradé vers `#00c2ff`). Règle « l'app et le site ne divergent jamais » : `styles/global.css` doit recopier ces valeurs.

| Rôle | Sombre | Clair |
|---|---|---|
| accent (texte d'action, focus, sélection en 10–20 %, progression) | `#cfa5a7` | `#774e51` |
| accent en aplat portant du blanc | `#73474a` | `#73474a` |
| dégradé de jauge (deux tons voisins, se lit comme un aplat) | `#cfa5a7 → #b09798` | `#774e51 → #8e7274` |
| bouton primaire | fond `#f4f6fa` (encre), texte `#07080b` ; survol encre 86 % vers le fond | fond `#0a0c12`, texte `#ffffff` |
| ombre du bouton primaire | `0 1px 2px rgb(0 0 0/.35)` + reflet interne blanc 25 % | `0 1px 2px rgb(10 12 18/.18)` |
| halo ambiant (haut de fenêtre) | `rgb(220 38 38 / .045)` | `rgb(220 38 38 / .025)` |
| onglet actif / élément choisi | fond accent 10 %, liseré accent 30 % | idem |

Neutres, rouge, ambre, violet, encre du « réussi » : **inchangés**. Le logo garde son cramoisi plein (`#dc2626 → #7f1d1d`). Contrastes : `DESIGN.md`, « Contrastes V8 ».

> ✅ **Recopié dans le site le 2026-10-20**, branche `chantier/logo-shale` du
> dépôt `shale-site` (commit 43e1bc6, avec le nouveau logo) — **pas encore
> fusionnée ni déployée**, en attente de l'accord d'Antonin. Dans
> `vitrine/src/styles/global.css` : `--accent` / `--accent-hi` (le site n'a
> qu'un accent de texte), `--accent-solid`, `--jauge-a` / `--jauge-b`,
> `--cta-bg` / `--cta-fg` / `--cta-hover` / `--cta-shadow`, halos rouges,
> `--active` (10 %) et `--active-line` (30 %). Les neutres du site, propres à
> lui, ne bougent pas. Plus aucun bleu dans le code du site ; il n'en reste que
> dans les captures `shots/v2`, qui montrent l'app d'avant. `npm run check`
> vert sur la branche.

## AJ — « Journal » devient « Habitudes » ; une habitude se renomme et change de couleur (app, 2026-10-20)

- **Le module s'appelle « Habitudes »** (« Habits » en anglais) dans la barre latérale, la barre d'onglets iPhone, la palette ⌘K et la corbeille. Son identifiant (`journal`) ne change pas. Toute page du site qui nomme le module « Journal » est à reprendre. ⚠️ Ne pas confondre avec le « Journal » du blog (`content.json` → `blogTitle`), qui n'est pas le module.
- **Clic droit sur une habitude** : Cocher, **Renommer**, **Couleur ▸**, Supprimer. Une fiche qui décrit les habitudes peut le dire.
- **Douze couleurs d'habitude** au lieu de six, dont le cramoisi du logo (`#dc2626`). Les captures qui montrent la rangée de six pastilles sont datées.
- Le site est sur une refonte (plus de `Demo.astro`) : rien n'a été modifié de ce côté ce jour-là.
## AK — Fond « Net », braise +2, grammaire des couleurs, point d'action (app, 2026-10-20)

Règle « l'app et le site ne divergent jamais » : `vitrine/src/styles/global.css` doit recopier ces valeurs (spécification : `~/Desktop/Shale-projet/marque/COULEURS.md`).

| Rôle | Sombre | Clair |
|---|---|---|
| fond | `#030304` | `#ffffff` |
| carte | `#111215` | `#ffffff` (séparée par le filet) |
| carte 2 / piste | `#1d1e22` | `#eceef1` |
| texte | `#ffffff` | `#000000` |
| texte secondaire | `#a9aeb8` | `#4a4f59` |
| filet | `rgb(160 170 190 / .17)` | `rgb(10 12 18 / .16)` |
| filet appuyé | `rgb(160 170 190 / .26)` | `rgb(10 12 18 / .24)` |
| accent (braise +2) | `#e6a2a6` | `#742f33` |
| accent en aplat portant du blanc | `#742f33` | `#742f33` |
| dégradé de jauge | `#e6a2a6 → #c98d91` | `#742f33 → #93484d` |
| bouton primaire (encre) | fond `#ffffff`, texte `#030304` | fond `#000000`, texte `#ffffff` |
| point d'action | `#ff3b4a` | `#d7192b` |

Inchangés : rouge d'erreur, ambre, halo cramoisi, sélection 10 % / liseré 30 %. La grammaire (une couleur, un sens) vaut aussi pour le site : la braise ne marque jamais une erreur. Le point d'action n'a pas d'usage sur le site (rien n'y attend une action), sauf dans les captures de l'app, à refaire après le build. ⛔ **Pas encore recopié.**
