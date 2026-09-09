-- ─────────────────────────────────────────────────────────────────────────────
-- 023 — La facturation entre dans Finance
-- ─────────────────────────────────────────────────────────────────────────────
--
-- LA THÈSE. Finance répondait à « combien de mois je tiens ». Il lui manquait la
-- moitié amont de la question : d'où vient l'argent, et QUAND il arrive. Un
-- indépendant au revenu irrégulier ne vit pas d'un salaire mensualisé, il vit de
-- factures qu'il émet, qui sont payées en retard, en plusieurs fois, parfois
-- jamais. Cette migration installe de quoi émettre une facture légalement
-- valable, saisir ce qui a réellement été encaissé, et faire réagir le runway.
--
-- ⚠️⚠️ LA RÈGLE QUI GOUVERNE TOUT LE CHANTIER — le solde composé.
--
--     solde d'un compte = dernier relevé saisi
--                       + encaissements datés STRICTEMENT APRÈS ce relevé
--
-- Finance est un module de SNAPSHOTS : le solde n'est pas calculé, il est relevé
-- à la main. Un encaissement du 15 février s'ajoute au relevé du 1er février.
-- Le jour où l'utilisateur relève son solde au 1er mars, cet encaissement est
-- devenu ANTÉRIEUR au relevé : la banque l'a déjà compté dans le chiffre
-- affiché. Il est donc ABSORBÉ, et cesse d'être ajouté.
--
-- Sans cette fenêtre temporelle, l'utilisateur compte deux fois le même euro et
-- RIEN NE LE LUI SIGNALE — exactement le faux chiffre que la doctrine du module
-- interdit. La composition se fait AU CALCUL, dans les fonctions pures de
-- `src/lib/finance/`, et un test rejoue la séquence complète.
--
-- ⚠️ `finance_balances` N'EST JAMAIS ÉCRITE PAR LA FACTURATION. Aucun
-- encaissement ne crée, ne modifie ni ne supprime une ligne de relevé. Si un
-- jour une requête de ce chantier écrit dans `finance_balances`, elle est
-- fausse, quelle que soit sa raison apparente.
--
-- CE QUE CE N'EST PAS. Pas de comptabilité en partie double — ceci est un outil
-- de trésorerie. Pas d'envoi d'e-mail, pas de relance automatique : l'app
-- n'envoie rien à personne. Pas de connexion à une plateforme de
-- dématérialisation (PDP) : préparé, pas branché.
--
-- AUCUN MODULE N'EST AJOUTÉ. Le compte reste à TREIZE. La facturation est une
-- SECTION de `FinanceView`, pas une entrée de `Sidebar.tsx`.
--
-- ⚠️ TOUS LES MONTANTS SONT DES ENTIERS SIGNÉS, EN CENTIMES, comme dans toute la
-- migration 018. Aucun `REAL` dans ce fichier, aucune exception. Les quantités
-- et les taux de change sont à l'échelle 10⁻⁸ (`_e8`), les taux de TVA à
-- l'échelle 10⁻⁴ (`_e4` : 2000 = 20,00 %). Un flottant binaire ne représente pas
-- 0,10 € exactement, et une facture fausse au centime est une facture fausse.
--
-- LE PATRON SUIVI est celui de `018_finance.sql`, repris par la 020 : colonne
-- `uid` + index unique, trigger d'identité de la bonne famille (015), triggers
-- d'outbox (016), et une ligne dans `TABLES_SYNC` (`src/lib/sync/scope.ts`).
--
-- ⚠️ LES SIX TABLES SONT SYNCHRONISÉES, aucune hors-sync. Une facture est une
-- donnée utilisateur privée ; il n'y a pas de cache légitime ici. Une table
-- absente de `scope.ts` ne serait JAMAIS sauvegardée, et l'utilisateur ne le
-- découvrirait qu'en perdant sa machine.
--
-- ⚠️ AUCUNE RECRÉATION DE TABLE DANS CE FICHIER, et aucune migration déjà jouée
-- n'est réécrite (009, 015, 016, 018, 020, 021, 022).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Les tiers — clients et fournisseurs
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ uid ALÉATOIRE, et c'est une décision, pas un défaut. Le nom d'un client est
-- MODIFIABLE — une société change de dénomination, on corrige une faute de
-- frappe — donc il ne peut pas servir de clé. Un uid dérivé du nom ferait
-- changer l'identité du tiers au premier renommage, et l'autre appareil verrait
-- apparaître un second client là où il n'y en a qu'un.
--
-- `role` : un même tiers peut être client ET fournisseur (on lui vend et on lui
-- achète). Trois valeurs plutôt que deux booléens, pour que l'interface puisse
-- filtrer sur une colonne.
--
-- ⚠️ `archived` PLUTÔT QUE SUPPRIMER. Une facture émise porte le nom de son
-- client ; supprimer le tiers laisserait la facture pointer vers rien, et
-- `PRAGMA foreign_keys` n'étant pas activé par tauri-plugin-sql, SQLite ne dirait
-- rien. C'est la couche TypeScript qui refuse la suppression d'un tiers facturé
-- et propose l'archivage — même règle que les comptes de la migration 018.
CREATE TABLE invoice_parties (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  uid          TEXT,
  nom          TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client','fournisseur','les_deux')),
  adresse      TEXT,
  code_postal  TEXT,
  ville        TEXT,
  pays         TEXT,
  siren        TEXT,
  siret        TEXT,
  tva_intra    TEXT,                          -- n° de TVA intracommunautaire
  email        TEXT,
  telephone    TEXT,
  devise       TEXT NOT NULL DEFAULT 'EUR',   -- ISO 4217, devise par défaut de ce tiers
  notes        TEXT,
  archived     INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_invoice_parties_actifs ON invoice_parties(archived, nom);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Les séries — les compteurs de numérotation
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ uid DÉRIVÉ : `is:<code>`. La série « F » désigne LE MÊME FAIT sur tous les
-- appareils — c'est le compteur des factures de vente, il n'y en a qu'un. Avec
-- un uid aléatoire, deux Mac créeraient deux compteurs concurrents portant le
-- même code, et l'utilisateur verrait sa numérotation se dédoubler sans
-- comprendre pourquoi. Même raisonnement que `finance_categories` (018).
--
-- Conséquence à assumer dans l'interface, exactement comme le SYMBOLE d'une
-- position (018, § 5) : LE CODE N'EST PAS MODIFIABLE. Le corriger se fait en
-- supprimant la série et en la recréant.
--
-- `format` : gabarit du numéro. `{code}` `{AAAA}` (année sur 4) `{AA}` (sur 2)
-- `{MM}` (mois) `{NNNN}` (compteur, zéros à gauche selon le nombre de N).
--
-- ⚠️⚠️ `prochain` EST UN COMPTEUR, ET LE LWW L'ÉCRASE — IL NE L'ADDITIONNE PAS.
-- Deux appareils hors-ligne qui émettent chacun une facture attribueront donc le
-- MÊME numéro, et la synchronisation en gardera un seul compteur. Ce n'est pas
-- un défaut qu'on peut corriger ici : c'est la conséquence inévitable d'un
-- compteur répliqué sans serveur d'arbitrage.
--
-- La réponse n'est PAS de renuméroter — un numéro déjà envoyé à un client ne
-- peut pas changer dans le dos de l'utilisateur, et le renuméroter en silence
-- serait un faux en écriture. La réponse est de DÉTECTER et d'ALERTER :
-- `src/lib/finance/facturation/collisions.ts`, qui produit un diagnostic que
-- l'interface affiche. L'utilisateur tranche, jamais l'app.
--
-- ⚠️ C'est aussi pourquoi IL N'Y A AUCUN INDEX UNIQUE SUR LE NUMÉRO (§ 3). Une
-- contrainte violée à l'application d'une ligne distante ferait échouer
-- l'écriture, donc s'arrêter la synchronisation — la doctrine explicite de la
-- migration 018 (§ 3, `finance_categories`). Mieux vaut deux numéros identiques
-- signalés à l'écran qu'une synchronisation morte.
CREATE TABLE invoice_series (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  uid                     TEXT,
  code                    TEXT NOT NULL,      -- 'F', 'AV', 'D'
  libelle                 TEXT,               -- libellé affiché, LUI modifiable
  format                  TEXT NOT NULL DEFAULT '{code}-{AAAA}-{NNNN}',
  prochain                INTEGER NOT NULL DEFAULT 1 CHECK (prochain >= 1),
  annee_courante          INTEGER,            -- année du dernier numéro attribué
  remise_a_zero_annuelle  INTEGER NOT NULL DEFAULT 1 CHECK (remise_a_zero_annuelle IN (0,1)),
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Les factures, avoirs, devis et achats
-- ─────────────────────────────────────────────────────────────────────────────
-- Une seule table pour les quatre, parce que ce sont les mêmes CHAMPS avec des
-- règles différentes. Deux tables auraient dupliqué les lignes, les paiements,
-- les totaux et les index pour la seule satisfaction de séparer ce que `type` et
-- `sens` séparent déjà.
--
--   • `type = 'facture'` — le cas nominal.
--   • `type = 'avoir'`   — l'annulation. `avoir_de_id` pointe la facture annulée.
--   • `type = 'devis'`   — pas de numérotation légale contraignante, sa propre
--                          série. Accepté, il CRÉE une facture (`devis_origine_id`)
--                          et n'est pas transformé : le devis est conservé.
--   • `sens = 'achat'`   — une facture reçue d'un fournisseur. Pas de PDF, pas de
--                          numérotation, pas de mentions : saisie seule.
--
-- ⚠️ `en_retard` N'EST PAS UN STATUT STOCKÉ. Il se CALCULE : émise, échéance
-- dépassée, reste dû > 0. Un statut stocké deviendrait faux au passage de
-- minuit, sans que personne n'écrive quoi que ce soit — le pire mode de panne,
-- parce qu'il n'a pas de coupable. `statuts.ts` le dérive à la lecture.
--
-- ⚠️ `numero` EST NULL TANT QUE LA FACTURE EST UN BROUILLON. Le numéro
-- s'attribue AU MOMENT DE L'ÉMISSION, une seule fois, et n'est JAMAIS RENDU :
-- une série de numéros doit être continue et sans trou, et un numéro repris
-- après annulation désignerait deux documents.
--
-- `taux_change_e8` est NULLABLE et FIGÉ À L'ÉMISSION quand la devise diffère de
-- la devise de référence. Il n'est jamais recalculé au vol : sinon le montant
-- d'une facture d'il y a six mois changerait tout seul entre deux ouvertures de
-- l'app. Le cache `finance_fx_cache` ne garde qu'un taux COURANT par paire,
-- écrasé à chaque rafraîchissement — il ne peut donc pas servir de source
-- historique, seulement à PROPOSER une valeur au moment de la saisie.
--
-- `mentions` est STOCKÉ sur la facture, pas dérivé de l'émetteur à la lecture.
-- Les mentions par défaut de l'émetteur peuvent changer (changement de régime de
-- TVA, par exemple) ; une facture déjà envoyée à un client ne doit pas voir son
-- texte légal se réécrire rétroactivement.
--
-- ⭐ `emetteur_fige` — MÊME RAISON, POUSSÉE JUSQU'AU BOUT. Le prompt du chantier
-- laissait ouvert « stocker le PDF ou le régénérer ». On régénère : un blob
-- binaire par facture gonflerait chaque sauvegarde chiffrée pour un document
-- entièrement reconstructible (même doctrine que `market_briefings`, écarté de
-- la synchronisation pour cette raison exacte). Mais régénérer n'est honnête que
-- si TOUT ce dont le document dépend est figé — or l'identité de l'émetteur, qui
-- vit dans une table à ligne unique (§ 6), change avec le temps : nouvelle
-- adresse, nouveau régime de TVA, capital modifié. Reconstruire un PDF de 2026
-- avec l'adresse de 2028 produirait un document qui ne correspond plus à celui
-- que le client a reçu.
--
-- `emetteur_fige` est donc un instantané JSON de `invoice_issuer`, écrit AU
-- MOMENT DE L'ÉMISSION et jamais retouché. Quelques centaines d'octets de texte
-- par facture, contre plusieurs centaines de kilo-octets pour un PDF — et le
-- document redevient reproductible à l'identique, des années plus tard.
-- NULL tant que la facture est un brouillon, et pour tout ce qui est en `achat`.
CREATE TABLE invoices (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  uid               TEXT,
  type              TEXT NOT NULL DEFAULT 'facture' CHECK (type IN ('facture','avoir','devis')),
  sens              TEXT NOT NULL DEFAULT 'vente'   CHECK (sens IN ('vente','achat')),
  statut            TEXT NOT NULL DEFAULT 'brouillon'
                      CHECK (statut IN ('brouillon','emise','partiellement_encaissee','encaissee','annulee')),
  numero            TEXT,                    -- NULL tant que brouillon. Voir ci-dessus.
  serie_id          INTEGER,
  party_id          INTEGER,
  date_emission     TEXT,                    -- 'YYYY-MM-DD', local. NULL tant que brouillon.
  date_echeance     TEXT,                    -- 'YYYY-MM-DD', local
  conditions_paiement TEXT,
  devise            TEXT NOT NULL DEFAULT 'EUR',  -- ISO 4217
  taux_change_e8    INTEGER,                 -- figé à l'émission si devise ≠ devise de référence
  total_ht_cents    INTEGER NOT NULL DEFAULT 0,
  total_tva_cents   INTEGER NOT NULL DEFAULT 0,
  total_ttc_cents   INTEGER NOT NULL DEFAULT 0,
  mentions          TEXT,                    -- texte légal, figé (voir ci-dessus)
  emetteur_fige     TEXT,                    -- JSON, instantané de invoice_issuer à l'émission
  objet             TEXT,                    -- objet du document, affiché en tête
  note              TEXT,                    -- note interne, jamais imprimée
  avoir_de_id       INTEGER,                 -- pour un avoir : la facture annulée
  devis_origine_id  INTEGER,                 -- pour une facture issue d'un devis accepté
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (serie_id)         REFERENCES invoice_series(id),
  FOREIGN KEY (party_id)         REFERENCES invoice_parties(id),
  FOREIGN KEY (avoir_de_id)      REFERENCES invoices(id),
  FOREIGN KEY (devis_origine_id) REFERENCES invoices(id)
);

-- La liste et les relances interrogent « ce qui est émis et échu » à chaque
-- ouverture de la section.
CREATE INDEX idx_invoices_echeance ON invoices(statut, date_echeance);
CREATE INDEX idx_invoices_party    ON invoices(party_id);
CREATE INDEX idx_invoices_serie    ON invoices(serie_id);

-- ⚠️ PAS D'INDEX UNIQUE SUR (serie_id, numero). Volontaire, et expliqué au § 2 :
-- une contrainte violée à l'application d'une ligne distante arrêterait la
-- synchronisation. La détection des doublons est faite par `collisions.ts`, qui
-- alerte au lieu de bloquer. Cet index-ci n'est là que pour la RECHERCHE.
CREATE INDEX idx_invoices_numero ON invoices(numero);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Les lignes
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ uid ALÉATOIRE, et surtout PAS `il:<facture>:<position>`. La position change
-- dès qu'on réordonne les lignes ; un uid qui bouge n'est plus une identité — le
-- serveur verrait une ligne disparaître et une autre naître à chaque
-- glisser-déposer, et l'autre appareil accumulerait les doublons.
--
-- `quantite_e8` : échelle 10⁻⁸, comme les quantités de titres (018). Elle permet
-- « 7,5 heures » comme « 0,25 jour » sans jamais passer par un flottant.
--
-- `taux_tva_e4` : 2000 = 20,00 %. Zéro en franchise en base — ce qui est le cas
-- NOMINAL ici, pas le cas limite (voir § 6).
--
-- ⚠️⚠️ IL N'Y A PAS DE COLONNE `total_tva_cents` SUR LA LIGNE, et c'est une
-- décision fiscale, pas un oubli. En France, LA TVA S'ARRONDIT PAR TAUX, JAMAIS
-- PAR LIGNE : on somme les bases HT de toutes les lignes à 20 %, on applique 20 %
-- une fois, on arrondit une fois. Stocker une TVA par ligne produirait une
-- colonne dont la somme ne vaut pas la TVA de la facture — un chiffre faux, posé
-- en base, que quelqu'un finirait par additionner de bonne foi.
--
-- `total_ht_cents`, lui, est exact au niveau de la ligne (quantité × prix −
-- remise) : il est donc stocké. C'est `totaux.ts` qui fait foi pour le reste,
-- et les totaux de `invoices` sont sa sortie — jamais une somme de colonnes de
-- lignes.
CREATE TABLE invoice_lines (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  uid                 TEXT,
  invoice_id          INTEGER NOT NULL,
  position            INTEGER NOT NULL DEFAULT 0,
  description         TEXT NOT NULL DEFAULT '',
  unite               TEXT,                  -- 'h', 'j', 'u'… purement informatif
  quantite_e8         INTEGER NOT NULL DEFAULT 100000000,   -- 1,00000000
  prix_unitaire_cents INTEGER NOT NULL DEFAULT 0,
  taux_tva_e4         INTEGER NOT NULL DEFAULT 0,
  remise_cents        INTEGER NOT NULL DEFAULT 0,
  total_ht_cents      INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

CREATE INDEX idx_invoice_lines_facture ON invoice_lines(invoice_id, position);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) ⭐ Les encaissements et décaissements — le point de contact avec le runway
-- ─────────────────────────────────────────────────────────────────────────────
-- C'est la table la plus dangereuse du fichier, parce que c'est la seule dont le
-- contenu se mélange à des chiffres qui existaient avant elle.
--
-- ⚠️ RELIRE LA RÈGLE DU SOLDE COMPOSÉ EN TÊTE DE CE FICHIER. Un paiement ne
-- s'ajoute au solde d'un compte que s'il est daté STRICTEMENT APRÈS le dernier
-- relevé de ce compte. Passé le relevé suivant, il est absorbé et disparaît du
-- calcul. La composition se fait dans `patrimoine.ts` — jamais en base.
--
-- ⚠️ `account_id` EST NULLABLE, et un paiement sans compte N'ENTRE NULLE PART.
-- Ce n'est pas une approximation : l'utilisateur n'a pas dit où l'argent est
-- arrivé, donc on ne sait pas quel solde il augmente. Le répartir « au hasard »
-- ou l'affecter au premier compte liquide produirait un patrimoine faux. Il
-- compte pour le suivi de la facture (reste dû, statut), pas pour la trésorerie.
--
-- `montant_cents` est SIGNÉ. Positif = encaissement sur une vente, ou
-- décaissement sur un achat (c'est le `sens` de la facture qui donne la
-- direction). Négatif = un remboursement, un chèque impayé, une régularisation —
-- des choses qui arrivent, et qu'on doit pouvoir saisir sans inventer une
-- seconde table.
--
-- `taux_change_e8` est FIGÉ À LA DATE DE L'ENCAISSEMENT, jamais recalculé : un
-- montant encaissé qui change tout seul entre deux ouvertures de l'app est
-- exactement le genre de faux chiffre que ce module refuse.
--
-- Plusieurs paiements par facture : acompte, puis solde. C'est le cas normal.
CREATE TABLE invoice_payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  uid            TEXT,
  invoice_id     INTEGER NOT NULL,
  date           TEXT NOT NULL,             -- 'YYYY-MM-DD', local
  montant_cents  INTEGER NOT NULL,          -- signé, voir ci-dessus
  devise         TEXT NOT NULL DEFAULT 'EUR',
  taux_change_e8 INTEGER,                   -- figé à la date du paiement
  account_id     INTEGER,                   -- NULL = n'entre dans aucun solde
  moyen          TEXT,                      -- 'virement', 'especes', 'cb'… libre
  note           TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (account_id) REFERENCES finance_accounts(id)
);

CREATE INDEX idx_invoice_payments_facture ON invoice_payments(invoice_id);
-- Le solde composé balaie « les paiements d'un compte postérieurs à une date » à
-- chaque calcul de patrimoine, c'est-à-dire à chaque ouverture du module et pour
-- chacun des treize points de la courbe. Sans cet index, chaque point relirait
-- toute la table.
CREATE INDEX idx_invoice_payments_compte  ON invoice_payments(account_id, date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) L'identité de l'émetteur
-- ─────────────────────────────────────────────────────────────────────────────
-- UNE SEULE LIGNE, uid DÉRIVÉ `ii:default`. C'est ce qui garantit que les deux
-- appareils décrivent LE MÊME émetteur : avec un uid aléatoire, chacun aurait
-- créé sa fiche à la première ouverture et l'utilisateur se retrouverait avec
-- deux identités concurrentes, dont une seule imprimée sur ses factures.
--
-- Avec un uid fixe, c'est le LWW qui départage : la dernière modification gagne,
-- ce qui est exactement le comportement voulu pour une fiche d'identité.
--
-- POURQUOI UNE TABLE ET PAS `settings`. Le réflexe du dépôt est de réutiliser la
-- table clé-valeur (`finance.devise`, `finance.risk_per_r_cents`), et c'est le
-- bon réflexe pour un scalaire. Ici il y a un LOGO — une image en data URI, donc
-- plusieurs dizaines de kilo-octets de texte. `settings` est relue en entier à
-- chaque démarrage et à chaque synchronisation ; y loger une image ferait payer
-- ce poids à toute l'application, pour une donnée que seule la facturation lit.
--
-- ⚠️ `regime` VAUT `franchise_en_base` PAR DÉFAUT, et ce n'est pas un choix
-- neutre : c'est le régime de l'utilisateur de cette app (auto-entreprise,
-- août 2026). La franchise en base est donc le cas NOMINAL — TVA à zéro et
-- mention « TVA non applicable, art. 293 B du CGI » obligatoire sur chaque
-- document. L'assujettissement est le cas que l'on prévoit, pas celui que l'on
-- suppose.
--
-- `indemnite_forfaitaire_cents` : 40 € (4000 centimes), montant légal de
-- l'indemnité forfaitaire de recouvrement, obligatoire entre professionnels.
CREATE TABLE invoice_issuer (
  id                          INTEGER PRIMARY KEY AUTOINCREMENT,
  uid                         TEXT,
  denomination                TEXT NOT NULL DEFAULT '',
  forme_juridique             TEXT,
  capital_cents               INTEGER,
  adresse                     TEXT,
  code_postal                 TEXT,
  ville                       TEXT,
  pays                        TEXT NOT NULL DEFAULT 'France',
  siren                       TEXT,
  siret                       TEXT,
  rcs                         TEXT,
  ape                         TEXT,
  tva_intra                   TEXT,
  iban                        TEXT,
  bic                         TEXT,
  logo                        TEXT,          -- data URI. Voir ci-dessus.
  regime                      TEXT NOT NULL DEFAULT 'franchise_en_base'
                                CHECK (regime IN ('franchise_en_base','assujetti')),
  mentions_defaut             TEXT,
  penalites_retard            TEXT,
  indemnite_forfaitaire_cents INTEGER NOT NULL DEFAULT 4000,
  created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) Identité globale (patron de la migration 015)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX idx_invoice_parties_uid  ON invoice_parties(uid);
CREATE UNIQUE INDEX idx_invoice_series_uid   ON invoice_series(uid);
CREATE UNIQUE INDEX idx_invoices_uid         ON invoices(uid);
CREATE UNIQUE INDEX idx_invoice_lines_uid    ON invoice_lines(uid);
CREATE UNIQUE INDEX idx_invoice_payments_uid ON invoice_payments(uid);
CREATE UNIQUE INDEX idx_invoice_issuer_uid   ON invoice_issuer(uid);

-- Identité arbitraire : uid aléatoire (UUID v4).
CREATE TRIGGER invoice_parties_uid AFTER INSERT ON invoice_parties WHEN NEW.uid IS NULL BEGIN
  UPDATE invoice_parties SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER invoices_uid AFTER INSERT ON invoices WHEN NEW.uid IS NULL BEGIN
  UPDATE invoices SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER invoice_lines_uid AFTER INSERT ON invoice_lines WHEN NEW.uid IS NULL BEGIN
  UPDATE invoice_lines SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER invoice_payments_uid AFTER INSERT ON invoice_payments WHEN NEW.uid IS NULL BEGIN
  UPDATE invoice_payments SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;

-- Clés naturelles : uid DÉRIVÉ, donc identique sur tous les appareils sans
-- qu'ils aient à se parler.
CREATE TRIGGER invoice_series_uid AFTER INSERT ON invoice_series WHEN NEW.uid IS NULL BEGIN
  UPDATE invoice_series SET uid = 'is:' || NEW.code WHERE id = NEW.id;
END;
CREATE TRIGGER invoice_issuer_uid AFTER INSERT ON invoice_issuer WHEN NEW.uid IS NULL BEGIN
  UPDATE invoice_issuer SET uid = 'ii:default' WHERE id = NEW.id;
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) ⭐ Cascades de suppression
-- ─────────────────────────────────────────────────────────────────────────────
-- `PRAGMA foreign_keys` n'est PAS activé par tauri-plugin-sql (cf. `repo.ts`,
-- § suppressions) : SQLite ne cascade rien tout seul, et les `FOREIGN KEY`
-- déclarées ci-dessus sont documentaires. Supprimer une facture sans ses lignes
-- laisserait des orphelines qui continueraient d'exister — et de se
-- synchroniser — sans plus rien désigner.
--
-- ⚠️ VOLONTAIREMENT PAS GARDÉS PAR `applying`, exactement comme
-- `knowledge_topics_links_del` (migration 022, § 4) : quand l'autre appareil
-- nous envoie la suppression de la facture, la cascade doit se produire ICI
-- AUSSI. Ce sont les triggers d'OUTBOX qui sont gardés, et eux seuls.
--
-- Conséquence bénigne à connaître : hors application, ces DELETE déclenchent les
-- triggers d'outbox des enfants, donc leurs pierres tombales voyagent. Pendant
-- une application, ces mêmes triggers sont gardés et rien ne repart. Les deux
-- comportements sont ceux qu'on veut.
CREATE TRIGGER invoices_enfants_del AFTER DELETE ON invoices BEGIN
  DELETE FROM invoice_lines    WHERE invoice_id = OLD.id;
  DELETE FROM invoice_payments WHERE invoice_id = OLD.id;
END;

-- ⚠️ Un compte Finance supprimé ne doit PAS emporter les paiements qui le
-- citaient : le paiement a bien eu lieu, c'est seulement le compte crédité qu'on
-- ne connaît plus. On le DÉTACHE — même règle que « supprimer un type détype ses
-- sujets » (022, § 5) et que `finance_recurring.account_id` remis à NULL par
-- `deleteFinanceAccount`. Détaché, le paiement cesse d'entrer dans le solde
-- composé (§ 5) et continue de compter pour le reste dû de sa facture.
CREATE TRIGGER finance_accounts_paiements_detache AFTER DELETE ON finance_accounts BEGIN
  UPDATE invoice_payments SET account_id = NULL WHERE account_id = OLD.id;
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9) Les deux séries livrées
-- ─────────────────────────────────────────────────────────────────────────────
-- Une section de facturation sans compteur est inutilisable : la première
-- émission échouerait, ou inventerait une série en silence. Ces deux-là couvrent
-- le cas nominal et restent modifiables (sauf leur `code`, § 2) et supprimables.
--
-- Leur uid est posé par le trigger du § 7, dérivé du code : identique sur tous
-- les appareils, donc jamais dupliqué à la synchronisation. C'est exactement le
-- raisonnement des sept catégories par défaut de la migration 018.
--
-- ⚠️ Pas de série de devis livrée. Un devis est facultatif dans la vie d'un
-- indépendant, et une série vide qui n'a jamais servi est du bruit dans une
-- liste. Elle se crée à la volée le jour où l'on fait son premier devis.
INSERT INTO invoice_series (code, libelle, format, prochain, remise_a_zero_annuelle) VALUES
  ('F',  'Factures', '{code}-{AAAA}-{NNNN}', 1, 1),
  ('AV', 'Avoirs',   '{code}-{AAAA}-{NNNN}', 1, 1);

-- L'émetteur, lui, naît VIDE — une ligne unique, à remplir par l'utilisateur.
-- La créer ici plutôt que de la faire apparaître au premier enregistrement évite
-- que deux appareils la créent chacun de leur côté ; leur uid dérivé les ferait
-- de toute façon converger, mais autant ne pas provoquer le cas.
INSERT INTO invoice_issuer (denomination) VALUES ('');

-- ─────────────────────────────────────────────────────────────────────────────
-- 10) Journalisation pour la synchronisation (patron de la migration 016)
-- ─────────────────────────────────────────────────────────────────────────────
-- Trois triggers par table. `WHEN (SELECT v FROM sync_meta WHERE k = 'applying')
-- = '0'` : rien n'est journalisé pendant qu'on applique des changements VENUS du
-- cloud, sinon chaque synchronisation en déclencherait une autre, indéfiniment.
--
-- Rappel du piège de 016 : `NEW.uid` peut être NULL dans le trigger de CRÉATION
-- (SQLite ne garantit aucun ordre entre deux `AFTER INSERT` sur la même table).
-- C'est sans gravité — le `row_id` suffit à relire la ligne, et l'écriture de
-- l'uid déclenche le trigger de modification, qui ré-enregistre l'entrée
-- complète. Ne rien bâtir sur la présence de `uid` pour un 'upsert'.

-- invoice_parties
CREATE TRIGGER invoice_parties_out_ins AFTER INSERT ON invoice_parties WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_parties', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER invoice_parties_out_upd AFTER UPDATE ON invoice_parties WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_parties', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER invoice_parties_out_del AFTER DELETE ON invoice_parties WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'invoice_parties' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_parties', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- invoice_series
CREATE TRIGGER invoice_series_out_ins AFTER INSERT ON invoice_series WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_series', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER invoice_series_out_upd AFTER UPDATE ON invoice_series WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_series', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER invoice_series_out_del AFTER DELETE ON invoice_series WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'invoice_series' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_series', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- invoices
CREATE TRIGGER invoices_out_ins AFTER INSERT ON invoices WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoices', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER invoices_out_upd AFTER UPDATE ON invoices WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoices', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER invoices_out_del AFTER DELETE ON invoices WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'invoices' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoices', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- invoice_lines
CREATE TRIGGER invoice_lines_out_ins AFTER INSERT ON invoice_lines WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_lines', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER invoice_lines_out_upd AFTER UPDATE ON invoice_lines WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_lines', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER invoice_lines_out_del AFTER DELETE ON invoice_lines WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'invoice_lines' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_lines', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- invoice_payments
CREATE TRIGGER invoice_payments_out_ins AFTER INSERT ON invoice_payments WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_payments', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER invoice_payments_out_upd AFTER UPDATE ON invoice_payments WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_payments', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER invoice_payments_out_del AFTER DELETE ON invoice_payments WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'invoice_payments' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_payments', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- invoice_issuer
CREATE TRIGGER invoice_issuer_out_ins AFTER INSERT ON invoice_issuer WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_issuer', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER invoice_issuer_out_upd AFTER UPDATE ON invoice_issuer WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_issuer', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER invoice_issuer_out_del AFTER DELETE ON invoice_issuer WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'invoice_issuer' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('invoice_issuer', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
