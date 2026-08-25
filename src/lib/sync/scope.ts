/**
 * Ce qui est synchronisé, et ce qui ne l'est pas.
 *
 * SOURCE UNIQUE — aucun autre fichier ne doit décider de la portée de la
 * synchronisation. C'est du RÉGLAGE, pas du schéma : ces listes se modifient
 * sans migration, contrairement aux triggers de la migration 016.
 *
 * La règle est : **toute l'application se synchronise**. Les rares exclusions
 * ci-dessous ne sont pas des choix de périmètre — ce sont des impossibilités
 * techniques ou des données qui décrivent la MACHINE plutôt que l'utilisateur.
 */

/**
 * Toutes les tables de données, dans l'ordre où elles doivent être ENVOYÉES et
 * APPLIQUÉES : les parents avant leurs enfants.
 *
 * L'ordre compte. Appliquer « l'habitude X cochée le 2 août » avant l'habitude X
 * elle-même laisserait la coche orpheline. Le moteur sait mettre une ligne en
 * quarantaine et la rejouer, mais autant ne pas provoquer le cas.
 */
export const TABLES_SYNC = [
  // Racines (aucune dépendance)
  "settings",
  "tags",
  "quick_links",
  "habits",
  "custom_metrics",
  "goals",
  "notes",
  "journal_entries",
  "trades",
  "knowledge_topics",
  "position_size_calculations",
  "finance_accounts",
  "finance_categories",
  // Dépendent d'une racine
  "tasks", // → goals
  "focus_sessions", // → tasks
  "knowledge_entries", // → knowledge_topics
  "live_positions", // → position_size_calculations, trades
  "finance_recurring", // → finance_accounts, finance_categories
  // Feuilles à clé naturelle (dépendent de leur parent pour leur propre uid)
  "task_completions", // → tasks
  "habit_checks", // → habits
  "metric_entries", // → custom_metrics
  "finance_balances", // → finance_accounts
  "finance_holdings", // → finance_accounts
] as const;

export type TableSync = (typeof TABLES_SYNC)[number];

const ENSEMBLE_TABLES: ReadonlySet<string> = new Set(TABLES_SYNC);

export function estTableSync(nom: string): nom is TableSync {
  return ENSEMBLE_TABLES.has(nom);
}

/**
 * Tables volontairement absentes de la liste ci-dessus, avec la raison.
 * Documentaire — sert aussi de garde-fou : un test vérifie que toute table de
 * la base est soit synchronisée, soit listée ici. Une table ajoutée plus tard
 * sans décision explicite fait donc échouer les tests, au lieu de disparaître
 * silencieusement de la sauvegarde cloud.
 */
export const TABLES_HORS_SYNC: Readonly<Record<string, string>> = {
  notes_fts:
    "Index FTS5 dérivé de `notes`, reconstruit par ses propres triggers sur chaque appareil. Le transporter n'aurait aucun sens et corromprait l'index.",
  notes_fts_data: "Stockage interne de FTS5.",
  notes_fts_idx: "Stockage interne de FTS5.",
  notes_fts_docsize: "Stockage interne de FTS5.",
  notes_fts_config: "Stockage interne de FTS5.",
  benchmark_results:
    "Module retiré le 2026-08-25, remplacé par Finance (migration 019). La table n'existe plus : cette entrée est documentaire, et elle explique aussi pourquoi les lignes déjà envoyées vers Supabase ne peuvent pas revenir — sans son nom dans TABLES_SYNC, le moteur ne sait plus calculer son empreinte, ni pour émettre ni pour recevoir.",
  goal_progress_log:
    "Instantané quotidien de progression, ré-écrit à chaque lancement par snapshotGoals(). L'historique se reconstitue seul et n'a de sens que localement.",
  market_briefings:
    "Briefings régénérables, purgés à 7 jours, avec de gros payloads JSON. Les régénérer coûte moins cher que les transporter.",
  finance_quotes_cache:
    "Donnée publique reconstructible, pas de valeur privée : le cours d'une action n'est le secret de personne, et le redemander à Yahoo coûte moins cher que de le chiffrer et le transporter. ⚠️ La LISTE des symboles suivis, elle, est privée — elle vit dans `finance_holdings`, qui est synchronisé. Ne jamais déplacer d'information utilisateur ici.",
  finance_fx_cache:
    "Donnée publique reconstructible, pas de valeur privée : même raisonnement que `finance_quotes_cache`, pour les taux de change.",
  sync_outbox: "Plomberie de la synchronisation.",
  sync_state: "Plomberie de la synchronisation.",
  sync_meta: "Plomberie de la synchronisation.",
  _sqlx_migrations: "État interne du moteur de migrations.",
  sqlite_sequence: "Compteurs internes de SQLite (AUTOINCREMENT).",
};

/**
 * Clés de `settings` qui décrivent la MACHINE et non l'utilisateur, donc jamais
 * envoyées. Tout le reste part — y compris les réglages ajoutés à l'avenir.
 *
 * ⚠️ Posture inversée par rapport à un refus par défaut : ici, un nouveau
 * réglage est synchronisé SANS action de personne. C'est le comportement voulu
 * (« absolument toute l'app »), au prix de cette liste à tenir à jour.
 *
 * Une entrée `"x."` exclut tout ce qui commence par `x.` ; une entrée sans
 * point final ne vaut que pour la clé exacte.
 */
export const SETTINGS_EXCLUS: readonly string[] = [
  // Géométrie : dépend de la taille de l'écran. Synchroniser la disposition
  // d'un 27 pouces vers un portable (ou un téléphone) dégraderait l'affichage
  // au lieu de l'harmoniser.
  "layout.", // tailles/positions des widgets, par vue
  "hidden.", // widgets masqués, par vue
  "sidebar.collapsed", // catégories repliées
  "ui.config", // ⚠️ contient AUSSI l'ordre et les libellés des modules, qui
  // mériteraient de suivre. C'est un seul blob JSON : le découper est un
  // chantier à part. Exclu en bloc plutôt que de synchroniser une taille de
  // fenêtre par erreur.

  // Mesures propres à l'appareil. Le LWW ÉCRASE, il n'additionne pas :
  // synchroniser le temps d'écran ferait perdre celui de l'autre machine et
  // afficherait une jauge d'énergie fausse. Mieux vaut une jauge par appareil,
  // juste, qu'une jauge unique, fausse.
  "screen_min_",

  // Secrets. Ils vivent au trousseau macOS depuis le 2026-08-02
  // (`src/lib/llm/secrets.ts`) ; les synchroniser les réécrirait en clair dans
  // le SQLite de chaque appareil — exactement ce qu'on venait de corriger.
  "market.gemini_key",
  "market.groq_key",

  // Sert au moteur de notifications Rust, local par nature : cet appareil-ci
  // a-t-il consulté le Savoir récemment.
  "knowledge.last_viewed_at",

  // Plomberie de la synchronisation elle-même, y compris le REPLI de stockage
  // de la clé de données quand le trousseau ne répond pas.
  // ⚠️ Sans cette ligne, `sync.dek` partirait dans le cloud — chiffrée avec
  // elle-même. Le filtre anti-secret ci-dessous ne l'attrapait pas : « dek »
  // n'est ni `key`, ni `token`, ni `secret`.
  "sync.",

  // Horodatage de la dernière sauvegarde locale : propre à cet appareil-ci.
  // Le synchroniser ferait croire aux autres qu'ils ont déjà sauvegardé.
  "backup.",
];

/** Vrai si cette clé de réglage doit rester sur la machine. */
export function settingExclu(cle: string): boolean {
  return SETTINGS_EXCLUS.some((motif) =>
    motif.endsWith(".") || motif.endsWith("_") ? cle.startsWith(motif) : cle === motif,
  );
}

/**
 * Filet de sécurité contre un secret ajouté un jour sans y penser. Un réglage
 * dont la clé ressemble à un identifiant de connexion ne part pas, même s'il
 * n'a pas été inscrit ci-dessus.
 *
 * Ce n'est pas de la paranoïa gratuite : la liste ci-dessus fonctionne par
 * refus explicite, donc l'oubli est le mode d'échec par défaut, et il est
 * silencieux.
 */
const MOTIFS_SECRET = /(^|[._-])(key|secret|token|password|apikey)([._-]|$)/i;

export function ressembleAUnSecret(cle: string): boolean {
  return MOTIFS_SECRET.test(cle);
}

/** Décision finale pour une clé de réglage. */
export function settingSynchronisable(cle: string): boolean {
  return !settingExclu(cle) && !ressembleAUnSecret(cle);
}
