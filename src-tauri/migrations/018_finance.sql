-- Finance — trésorerie personnelle pour un revenu irrégulier.
--
-- LA THÈSE. Le journal de trading raisonne en R, qui est une abstraction. La vie
-- se paye en euros. Ce module fait le pont, et son chiffre roi est le RUNWAY :
-- combien de mois je tiens si mes revenus s'arrêtent demain.
--
-- CE QUE CE N'EST PAS. Un gestionnaire de budget. On ne saisit pas de tickets de
-- caisse, il n'y a pas de table de transactions, et rien n'est catégorisé après
-- coup. Le modèle est fait de SNAPSHOTS : l'utilisateur relève ses soldes une
-- fois par mois (deux minutes) et déclare ses flux récurrents une fois pour
-- toutes. Cela suffit à produire patrimoine net, burn, runway et projection.
--
-- AUCUNE AGRÉGATION BANCAIRE. Ni Powens, ni Bridge, ni Plaid, ni DSP2 : un
-- agrégateur exige un backend qui voit les données EN CLAIR, ce qui est
-- incompatible avec le modèle local-first chiffré de bout en bout de Shale.
-- Saisie manuelle, et c'est tout.
--
-- ⚠️ TOUS LES MONTANTS SONT DES ENTIERS SIGNÉS, EN CENTIMES. Aucun `REAL` dans
-- ce fichier, aucune exception. Un flottant binaire ne peut pas représenter
-- 0,10 € exactement ; additionner douze loyers en `REAL` produit des centimes
-- fantômes, et un runway faux au troisième chiffre est un runway faux. Les
-- quantités de titres et les taux de change, qui ne sont pas des centimes,
-- utilisent une échelle fixe de 10⁻⁸ (`_e8`) — également entière.
-- `INTEGER` en SQLite est un 64 bits signé : ±92 milliards à l'échelle 10⁻⁸,
-- ±92 000 milliards d'euros en centimes. Aucun risque de débordement.
--
-- CES DONNÉES SONT LES PLUS SENSIBLES DE L'APP. Le chiffrement de bout en bout
-- de la synchronisation n'est pas un détail de conformité ici, c'est l'argument
-- central : le patrimoine complet d'un utilisateur transite vers Supabase, qui
-- ne doit jamais pouvoir le lire. Les cinq tables de données sont donc
-- synchronisées ; les deux caches de marché ne le sont pas (voir plus bas).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Les comptes
-- ─────────────────────────────────────────────────────────────────────────────
-- `is_liquid` décide de ce qui entre dans le RUNWAY, et c'est le réglage le plus
-- structurant du module : un PEA bloqué et un livret A ne se valent pas quand il
-- s'agit de payer un loyer le mois prochain. Il est donc distinct du `kind` —
-- un compte d'investissement peut être déclaré liquide si l'utilisateur estime
-- pouvoir le vendre, et un livret peut ne pas l'être s'il le considère intouchable.
CREATE TABLE finance_accounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  uid         TEXT,
  label       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('courant','epargne','investissement','trading','credit','especes')),
  currency    TEXT NOT NULL DEFAULT 'EUR',   -- ISO 4217
  institution TEXT,                          -- établissement, purement informatif
  is_liquid   INTEGER NOT NULL DEFAULT 1 CHECK (is_liquid IN (0,1)),
  archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_finance_accounts_actifs ON finance_accounts(archived, position);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Les relevés de solde — l'historique du patrimoine
-- ─────────────────────────────────────────────────────────────────────────────
-- `amount_cents` est SIGNÉ sans contrainte : un compte de crédit porte un solde
-- négatif, et c'est exactement ce qu'on veut voir soustrait du patrimoine net.
--
-- ⚠️ TABLE À CLÉ NATURELLE. « le compte X au 2026-08-25 » désigne le même fait
-- sur tous les appareils : son `uid` est donc DÉRIVÉ de (compte, date), jamais
-- aléatoire (voir migration 015, § « deux familles de tables »). Avec un uid
-- aléatoire, deux Mac relevant le même solde le même jour créeraient deux lignes
-- serveur pour un seul fait, qui se disputeraient indéfiniment sans converger.
-- La contrainte d'unicité locale et l'uid dérivé disent la même chose, chacun de
-- son côté de la synchronisation.
CREATE TABLE finance_balances (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  uid          TEXT,
  account_id   INTEGER NOT NULL,
  date         TEXT NOT NULL,          -- YYYY-MM-DD (local, comme partout dans l'app)
  amount_cents INTEGER NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, date),
  FOREIGN KEY (account_id) REFERENCES finance_accounts(id)
);

CREATE INDEX idx_finance_balances_date ON finance_balances(date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Les catégories de flux
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ uid DÉRIVÉ DU NOM, comme les tags (migration 015). Ce n'est pas un détail :
-- les catégories par défaut sont insérées à la création de la base, donc SUR
-- CHAQUE APPAREIL. Avec des uid aléatoires, le second Mac synchronisé se
-- retrouverait avec deux jeux complets de catégories identiques. En dérivant du
-- nom, les deux appareils calculent le même uid sans s'être parlé.
--
-- Pas de contrainte d'unicité sur `name`, volontairement : renommer une
-- catégorie ne change PAS son uid (le trigger ne se déclenche que sur un uid
-- nul), et rien n'empêche donc qu'un autre appareil crée plus tard une catégorie
-- portant le nom libéré. Deux catégories homonymes sont une gêne cosmétique ;
-- une contrainte violée à l'application d'une ligne distante casserait la
-- synchronisation.
CREATE TABLE finance_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('entree','sortie')),
  color      TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_finance_categories_nom ON finance_categories(name);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Les flux récurrents — ce qui produit le burn
-- ─────────────────────────────────────────────────────────────────────────────
-- `amount_cents` est ici POSITIF par construction ; c'est `direction` qui porte
-- le sens. Un montant signé aurait rendu possible « une sortie de −900 € », dont
-- personne ne sait dire si elle est une entrée.
--
-- `day_of_period` se lit selon la fréquence : jour du mois (1–31) pour mensuel,
-- trimestriel et annuel ; jour de la semaine (1 = lundi … 7 = dimanche) pour
-- hebdo. Nullable : un flux dont la date exacte est inconnue compte quand même
-- dans le burn, qui est une moyenne mensuelle — seule la projection au jour près
-- s'en sert.
--
-- `active_to` nul = toujours actif. C'est ce qui permet de garder l'historique
-- d'un abonnement résilié sans fausser le burn d'aujourd'hui.
CREATE TABLE finance_recurring (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  uid          TEXT,
  label        TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  direction    TEXT NOT NULL CHECK (direction IN ('entree','sortie')),
  frequency    TEXT NOT NULL CHECK (frequency IN ('hebdo','mensuel','trimestriel','annuel')),
  day_of_period INTEGER,
  category_id  INTEGER,
  account_id   INTEGER,                -- compte de rattachement, facultatif
  active_from  TEXT NOT NULL,          -- YYYY-MM-DD
  active_to    TEXT,                   -- YYYY-MM-DD, NULL = toujours actif
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES finance_categories(id),
  FOREIGN KEY (account_id)  REFERENCES finance_accounts(id)
);

CREATE INDEX idx_finance_recurring_actifs ON finance_recurring(active_from, active_to);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) Les positions détenues
-- ─────────────────────────────────────────────────────────────────────────────
-- `quantity_e8` : quantité à l'échelle 10⁻⁸, entière. C'est la crypto qui impose
-- cette précision (0,00000001 BTC est une quantité légitime) ; les actions s'y
-- logent sans peine.
--
-- ⚠️ TABLE À CLÉ NATURELLE, comme les relevés : « BTC sur le compte X » désigne
-- la même position partout, donc uid dérivé de (compte, symbole). Conséquence à
-- assumer dans l'interface : le SYMBOLE N'EST PAS MODIFIABLE. Le corriger se
-- fait en supprimant la ligne et en la recréant — sans quoi l'uid dériverait
-- d'un symbole qui n'est plus le sien.
CREATE TABLE finance_holdings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uid             TEXT,
  account_id      INTEGER NOT NULL,
  symbol          TEXT NOT NULL,       -- 'AAPL', 'BTCUSDT', 'CW8.PA'…
  quantity_e8     INTEGER NOT NULL,
  cost_basis_cents INTEGER,            -- prix de revient total, NULL si inconnu
  source          TEXT NOT NULL DEFAULT 'manuel' CHECK (source IN ('yahoo','binance','manuel')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, symbol),
  FOREIGN KEY (account_id) REFERENCES finance_accounts(id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Les deux caches de marché — HORS SYNCHRONISATION
-- ─────────────────────────────────────────────────────────────────────────────
-- Donnée PUBLIQUE et reconstructible : le cours de l'or n'est le secret de
-- personne, et le renvoyer chiffré d'un Mac à l'autre coûterait plus cher que de
-- le redemander à Yahoo. Ces deux tables n'ont donc ni `uid`, ni triggers
-- d'outbox, et sont déclarées dans `TABLES_HORS_SYNC` (src/lib/sync/scope.ts).
--
-- ⚠️ Elles ne portent AUCUNE valeur privée, et c'est une propriété à préserver :
-- la liste des symboles suivis, elle, est privée — elle vit dans
-- `finance_holdings`, qui est synchronisé. Ne jamais déplacer d'information
-- utilisateur ici pour « gagner du temps ».
--
-- `price_e8` / `rate_e8` : même échelle entière que les quantités. Un prix en
-- `REAL` réintroduirait par la bande le flottant que tout ce fichier évite.
CREATE TABLE finance_quotes_cache (
  symbol     TEXT PRIMARY KEY,
  price_e8   INTEGER NOT NULL,
  currency   TEXT NOT NULL,
  source     TEXT NOT NULL CHECK (source IN ('yahoo','binance')),
  fetched_at TEXT NOT NULL            -- ISO UTC
);

-- Taux de change vers la devise d'affichage. `base` → `quote`, ex. USD → EUR.
CREATE TABLE finance_fx_cache (
  base       TEXT NOT NULL,
  quote      TEXT NOT NULL,
  rate_e8    INTEGER NOT NULL,
  fetched_at TEXT NOT NULL,           -- ISO UTC
  PRIMARY KEY (base, quote)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) Catégories par défaut
-- ─────────────────────────────────────────────────────────────────────────────
-- Un module financier vide est inutilisable. Ces sept catégories couvrent
-- l'essentiel d'un indépendant et restent éditables et supprimables.
-- Leur uid est posé par le trigger de la section 8, dérivé du nom : identique
-- sur tous les appareils, donc jamais dupliqué à la synchronisation.
INSERT INTO finance_categories (name, kind, position) VALUES
  ('Revenus',       'entree', 1),
  ('Trading',       'entree', 2),
  ('Logement',      'sortie', 3),
  ('Charges',       'sortie', 4),
  ('Abonnements',   'sortie', 5),
  ('Vie courante',  'sortie', 6),
  ('Impôts',        'sortie', 7);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) Identité globale (patron de la migration 015)
-- ─────────────────────────────────────────────────────────────────────────────
-- Les catégories par défaut viennent d'être insérées SANS uid (la table n'avait
-- pas encore son trigger) : on les rattrape ici, avec la même dérivation que
-- celle que le trigger appliquera ensuite.
UPDATE finance_categories SET uid = 'fc:' || name WHERE uid IS NULL;

CREATE UNIQUE INDEX idx_finance_accounts_uid   ON finance_accounts(uid);
CREATE UNIQUE INDEX idx_finance_categories_uid ON finance_categories(uid);
CREATE UNIQUE INDEX idx_finance_balances_uid   ON finance_balances(uid);
CREATE UNIQUE INDEX idx_finance_recurring_uid  ON finance_recurring(uid);
CREATE UNIQUE INDEX idx_finance_holdings_uid   ON finance_holdings(uid);

-- Identité arbitraire : uid aléatoire (UUID v4).
CREATE TRIGGER finance_accounts_uid AFTER INSERT ON finance_accounts WHEN NEW.uid IS NULL BEGIN
  UPDATE finance_accounts SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER finance_recurring_uid AFTER INSERT ON finance_recurring WHEN NEW.uid IS NULL BEGIN
  UPDATE finance_recurring SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;

-- Clés naturelles : uid DÉRIVÉ, donc identique sur tous les appareils sans qu'ils
-- aient à se parler. Le `COALESCE(..., 'orphan-' || id)` couvre le cas d'un
-- parent disparu : mieux vaut un uid laid mais unique qu'un NULL, qui ferait
-- échouer l'index unique — c'est-à-dire l'écriture, donc l'app.
CREATE TRIGGER finance_categories_uid AFTER INSERT ON finance_categories WHEN NEW.uid IS NULL BEGIN
  UPDATE finance_categories SET uid = 'fc:' || NEW.name WHERE id = NEW.id;
END;
CREATE TRIGGER finance_balances_uid AFTER INSERT ON finance_balances WHEN NEW.uid IS NULL BEGIN
  UPDATE finance_balances
     SET uid = 'fb:' || COALESCE((SELECT a.uid FROM finance_accounts a WHERE a.id = NEW.account_id), 'orphan-' || NEW.account_id) || ':' || NEW.date
   WHERE id = NEW.id;
END;
CREATE TRIGGER finance_holdings_uid AFTER INSERT ON finance_holdings WHEN NEW.uid IS NULL BEGIN
  UPDATE finance_holdings
     SET uid = 'fh:' || COALESCE((SELECT a.uid FROM finance_accounts a WHERE a.id = NEW.account_id), 'orphan-' || NEW.account_id) || ':' || NEW.symbol
   WHERE id = NEW.id;
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9) Journalisation pour la synchronisation (patron de la migration 016)
-- ─────────────────────────────────────────────────────────────────────────────
-- Trois triggers par table synchronisée. `WHEN (SELECT v FROM sync_meta WHERE
-- k = 'applying') = '0'` : rien n'est journalisé pendant qu'on applique des
-- changements VENUS du cloud, sinon chaque synchronisation en déclencherait une
-- autre, indéfiniment.
--
-- Rappel du piège de 016 : `NEW.uid` peut être NULL dans le trigger de CRÉATION
-- (SQLite ne garantit aucun ordre entre deux `AFTER INSERT` sur la même table).
-- C'est sans gravité — le `row_id` suffit à relire la ligne, et l'écriture de
-- l'uid déclenche le trigger de modification, qui ré-enregistre l'entrée
-- complète. Ne rien bâtir sur la présence de `uid` pour un 'upsert'.
--
-- Les deux caches (`finance_quotes_cache`, `finance_fx_cache`) n'en ont pas :
-- ils ne se synchronisent pas.

-- finance_accounts
CREATE TRIGGER finance_accounts_out_ins AFTER INSERT ON finance_accounts WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_accounts', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER finance_accounts_out_upd AFTER UPDATE ON finance_accounts WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_accounts', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER finance_accounts_out_del AFTER DELETE ON finance_accounts WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'finance_accounts' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_accounts', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- finance_categories
CREATE TRIGGER finance_categories_out_ins AFTER INSERT ON finance_categories WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_categories', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER finance_categories_out_upd AFTER UPDATE ON finance_categories WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_categories', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER finance_categories_out_del AFTER DELETE ON finance_categories WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'finance_categories' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_categories', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- finance_balances
CREATE TRIGGER finance_balances_out_ins AFTER INSERT ON finance_balances WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_balances', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER finance_balances_out_upd AFTER UPDATE ON finance_balances WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_balances', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER finance_balances_out_del AFTER DELETE ON finance_balances WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'finance_balances' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_balances', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- finance_recurring
CREATE TRIGGER finance_recurring_out_ins AFTER INSERT ON finance_recurring WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_recurring', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER finance_recurring_out_upd AFTER UPDATE ON finance_recurring WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_recurring', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER finance_recurring_out_del AFTER DELETE ON finance_recurring WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'finance_recurring' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_recurring', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- finance_holdings
CREATE TRIGGER finance_holdings_out_ins AFTER INSERT ON finance_holdings WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_holdings', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER finance_holdings_out_upd AFTER UPDATE ON finance_holdings WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_holdings', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER finance_holdings_out_del AFTER DELETE ON finance_holdings WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'finance_holdings' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('finance_holdings', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
