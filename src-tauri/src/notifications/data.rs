//! Lecture de `shale.db` pour alimenter les règles. **Ce module n'émet que des
//! `SELECT`** — le front reste le seul écrivain de la base.
//!
//! ⚠️ La connexion n'est PAS ouverte avec `read_only(true)`, et c'est délibéré :
//! `shale.db` est en mode **WAL**, or une connexion en lecture seule ne peut pas
//! créer le fichier `-shm` dont la lecture d'une base WAL a besoin. Tant que le
//! front n'a pas ouvert la base, un `read_only(true)` échoue donc sur
//! `SQLITE_CANTOPEN (14)` — vérifié sur la base réelle — c'est-à-dire précisément
//! dans le cas qui nous intéresse : l'évaluation périodique sans fenêtre ouverte.
//! L'interdiction d'écrire est donc tenue par la discipline (aucune requête autre
//! que `SELECT` ici), pas par le mode d'ouverture. `create_if_missing(false)`
//! garantit au moins qu'on ne fabriquera jamais une base fantôme.
//!
//! Le WAL permet par ailleurs à ce lecteur de cohabiter avec les écritures du
//! front sans les bloquer, et la connexion est refermée à chaque évaluation.
//!
//! Une table manquante ou une requête en échec dégrade la donnée concernée
//! (liste vide, `None`) au lieu de faire échouer toute l'évaluation : une règle
//! sans donnée reste simplement muette.

use std::path::Path;

use chrono::{NaiveDate, NaiveDateTime};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode};
use sqlx::{Connection, SqliteConnection};

use super::model::{CalendarItem, Completion, Habit, HabitCheck, Snapshot, Task};

/// Clé de la table `settings` écrite par le front à l'ouverture d'une fiche du Savoir.
pub const KNOWLEDGE_LAST_VIEWED: &str = "knowledge.last_viewed_at";

/// Profondeur d'historique chargée pour les habitudes. Large devant les besoins
/// des règles (séries en cours), assez court pour rester à quelques kilo-octets.
const HISTORY_DAYS: i64 = 90;

/// Construit l'image des données utilisée par les règles.
/// Échoue seulement si la base est introuvable ou impossible à ouvrir.
pub async fn read_snapshot(db_path: &Path, today: NaiveDate) -> Result<Snapshot, String> {
    if !db_path.exists() {
        return Err(format!("base introuvable : {}", db_path.display()));
    }

    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(false)
        // Le mode journal de la base est déjà WAL : le redéclarer est un no-op
        // et évite qu'une valeur par défaut différente ne le change sous nos pieds.
        .journal_mode(SqliteJournalMode::Wal);

    let mut conn = SqliteConnection::connect_with(&options)
        .await
        .map_err(|e| format!("ouverture de la base : {e}"))?;

    let since = (today - chrono::Duration::days(HISTORY_DAYS))
        .format("%Y-%m-%d")
        .to_string();

    let f_hab = filtre_vivant(&mut conn, "habits", "").await;
    let f_hab_j = filtre_vivant(&mut conn, "habits", "h").await;
    let f_tache = filtre_vivant(&mut conn, "tasks", "").await;
    let f_tache_j = filtre_vivant(&mut conn, "tasks", "t").await;

    let habits = sqlx::query_as::<_, (i64, String)>(&format!("SELECT id, name FROM habits WHERE archived = 0{f_hab}"))
        .fetch_all(&mut conn)
        .await
        .map(|rows| rows.into_iter().map(|(id, name)| Habit { id, name }).collect())
        .unwrap_or_else(|e| {
            eprintln!("notifications : lecture des habitudes ({e})");
            Vec::new()
        });

    // Les cases d'une habitude en corbeille sont écartées PAR ELLE (`LEFT JOIN` :
    // une case orpheline reste lue, comme avant la 027).
    let habit_checks = sqlx::query_as::<_, (i64, String)>(&format!(
        "SELECT c.habit_id, c.date FROM habit_checks c LEFT JOIN habits h ON h.id = c.habit_id \
         WHERE c.date >= ?1{f_hab_j}"
    ))
    .bind(&since)
    .fetch_all(&mut conn)
    .await
    .map(|rows| {
        rows.into_iter()
            .map(|(habit_id, date)| HabitCheck { habit_id, date })
            .collect()
    })
    .unwrap_or_else(|e| {
        eprintln!("notifications : lecture des coches d'habitudes ({e})");
        Vec::new()
    });

    // `recurrence` et `created_at` sont déclarées sans NOT NULL : d'où les
    // `Option`, plutôt qu'un `unwrap` qui ferait tomber toute l'évaluation.
    let tasks = sqlx::query_as::<_, (i64, Option<String>, Option<String>)>(&format!(
        "SELECT id, recurrence, created_at FROM tasks WHERE 1 = 1{f_tache}"
    ))
    .fetch_all(&mut conn)
    .await
    .map(|rows| {
        rows.into_iter()
            .map(|(id, recurrence, created_at)| Task { id, recurrence, created_at })
            .collect()
    })
    .unwrap_or_else(|e| {
        eprintln!("notifications : lecture des tâches ({e})");
        Vec::new()
    });

    let completions = sqlx::query_as::<_, (i64, String, Option<i64>)>(&format!(
        "SELECT c.task_id, c.date, c.done FROM task_completions c LEFT JOIN tasks t ON t.id = c.task_id \
         WHERE c.date >= ?1{f_tache_j}"
    ))
    .bind(&since)
    .fetch_all(&mut conn)
    .await
    .map(|rows| {
        rows.into_iter()
            .map(|(task_id, date, done)| Completion {
                task_id,
                date,
                done: done.unwrap_or(0) != 0,
            })
            .collect()
    })
    .unwrap_or_else(|e| {
        eprintln!("notifications : lecture des complétions ({e})");
        Vec::new()
    });

    let knowledge_last_viewed = read_knowledge_last_viewed(&mut conn).await;
    let calendar = read_calendar(&mut conn, &today.format("%Y-%m-%d").to_string()).await;

    // On referme explicitement : la connexion est éphémère, ouverte le temps
    // d'un tick du planificateur.
    let _ = conn.close().await;

    Ok(Snapshot { habits, habit_checks, tasks, completions, knowledge_last_viewed, calendar })
}

/// Le filtre de la corbeille (migration 027) pour une table — ou RIEN si la
/// table ne porte pas encore la colonne.
///
/// ⚠️⚠️ POURQUOI PAS UN FILTRE EN DUR. Ce lecteur est tolérant par
/// construction : une requête qui ÉCHOUE rend une liste vide. Un
/// `deleted_at IS NULL` posé en aveugle échouerait donc sur une base pas
/// encore migrée (le planificateur peut tourner avant que le front ait joué
/// les migrations) — et éteindrait TOUTES les notifications, sans une erreur
/// visible. Sans la colonne, rien ne peut être en corbeille : ne pas filtrer
/// est alors EXACT, pas une approximation. Voir `PIEGES.md` § 19.
///
/// `alias` : `""` pour la table elle-même, `"h"` pour `h.deleted_at` dans une
/// jointure.
async fn filtre_vivant(conn: &mut SqliteConnection, table: &str, alias: &str) -> String {
    let colonnes = sqlx::query_as::<_, (String,)>(&format!("SELECT name FROM pragma_table_info('{table}')"))
        .fetch_all(&mut *conn)
        .await
        .unwrap_or_default();
    if colonnes.iter().any(|(nom,)| nom == "deleted_at") {
        let prefixe = if alias.is_empty() { String::new() } else { format!("{alias}.") };
        format!(" AND {prefixe}deleted_at IS NULL")
    } else {
        String::new()
    }
}

/// Ce qui est daté dans les jours qui viennent : événements, tâches datées,
/// échéances d'objectifs.
///
/// ⚠️ CHAQUE LECTURE EST INDÉPENDANTE ET TOLÉRANTE À L'ÉCHEC. Ces tables sont
/// arrivées avec la migration 020 : sur une base plus ancienne — le temps qu'un
/// second appareil se mette à jour, par exemple — la requête échoue. Elle rend
/// alors une liste vide, la règle reste inerte, et les autres règles continuent
/// de tourner. Un `unwrap` ici éteindrait TOUTES les notifications de l'app
/// pour une table absente.
async fn read_calendar(conn: &mut SqliteConnection, today: &str) -> Vec<CalendarItem> {
    let mut items = Vec::new();
    let f_evt = filtre_vivant(conn, "calendar_events", "").await;
    let f_tache = filtre_vivant(conn, "tasks", "").await;
    let f_obj = filtre_vivant(conn, "goals", "").await;

    // Les événements ponctuels des jours qui viennent. Les récurrents sont
    // volontairement écartés : leur date est celle de la PREMIÈRE occurrence,
    // et projeter une récurrence en SQL demanderait de réécrire ici le moteur
    // qui vit déjà dans `lib/logic.ts`. Une habitude n'a de toute façon pas
    // besoin d'un rappel « imminent » — c'est ce que fait déjà la règle des
    // habitudes.
    let events = sqlx::query_as::<_, (String, String, Option<String>)>(&format!(
        "SELECT title, date, start_at FROM calendar_events \
         WHERE date >= ?1 AND (recurrence IS NULL OR recurrence = 'none') AND all_day = 0{f_evt}"
    ))
    .bind(today)
    .fetch_all(&mut *conn)
    .await
    .unwrap_or_else(|e| {
        eprintln!("notifications : lecture des événements ({e})");
        Vec::new()
    });
    for (title, date, start_at) in events {
        items.push(CalendarItem { title, date, start_at, kind: "event" });
    }

    let dated = sqlx::query_as::<_, (String, String, Option<String>)>(&format!(
        "SELECT label, due_date, start_at FROM tasks \
         WHERE due_date >= ?1 AND (recurrence IS NULL OR recurrence = 'none'){f_tache}"
    ))
    .bind(today)
    .fetch_all(&mut *conn)
    .await
    .unwrap_or_else(|e| {
        eprintln!("notifications : lecture des tâches datées ({e})");
        Vec::new()
    });
    for (title, date, start_at) in dated {
        items.push(CalendarItem { title, date, start_at, kind: "task" });
    }

    // Les échéances d'objectifs n'ont pas d'heure : elles pèsent sur la journée
    // entière, et c'est la veille qu'il faut le savoir, pas quinze minutes avant.
    let deadlines = sqlx::query_as::<_, (String, String)>(&format!(
        "SELECT title, deadline FROM goals WHERE deadline >= ?1{f_obj}"
    ))
    .bind(today)
    .fetch_all(&mut *conn)
    .await
    .unwrap_or_else(|e| {
        eprintln!("notifications : lecture des échéances ({e})");
        Vec::new()
    });
    for (title, date) in deadlines {
        items.push(CalendarItem { title, date, start_at: None, kind: "deadline" });
    }

    items
}

/// Dernière consultation du Savoir. Repli sur la fiche modifiée le plus
/// récemment quand la clé n'existe pas encore (installation antérieure à cette
/// fonctionnalité) : sans ce repli, la règle d'inactivité se déclencherait à tort
/// dès la mise à jour, comme si le Savoir n'avait jamais été ouvert.
async fn read_knowledge_last_viewed(conn: &mut SqliteConnection) -> Option<NaiveDateTime> {
    let stored = sqlx::query_as::<_, (String,)>("SELECT value FROM settings WHERE key = ?1")
        .bind(KNOWLEDGE_LAST_VIEWED)
        .fetch_optional(&mut *conn)
        .await
        .unwrap_or_default()
        .and_then(|(v,)| parse_stamp(&v));

    if stored.is_some() {
        return stored;
    }

    // Une fiche en corbeille n'est plus « la dernière modifiée » : le repli
    // mesure le Savoir que l'utilisateur voit.
    let f_fiche = filtre_vivant(conn, "knowledge_entries", "").await;
    sqlx::query_as::<_, (Option<String>,)>(&format!("SELECT MAX(updated_at) FROM knowledge_entries WHERE 1 = 1{f_fiche}"))
        .fetch_optional(&mut *conn)
        .await
        .unwrap_or_default()
        .and_then(|(v,)| v)
        .and_then(|v| parse_stamp(&v))
}

/// Accepte les deux formes écrites par le front : `YYYY-MM-DD HH:MM:SS`
/// (`localNow()`) et `YYYY-MM-DD` seul.
fn parse_stamp(raw: &str) -> Option<NaiveDateTime> {
    let raw = raw.trim();
    NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S")
        .ok()
        .or_else(|| {
            NaiveDate::parse_from_str(raw, "%Y-%m-%d")
                .ok()
                .and_then(|d| d.and_hms_opt(0, 0, 0))
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Executor;

    /// Fabrique une base au schéma réel (extrait des migrations 003/005/013),
    /// **en WAL comme la vraie** — sans quoi les tests ne diraient rien du cas
    /// qui compte (cf. l'avertissement en tête de module).
    async fn seed(path: &Path, sql: &str) {
        let options = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal);
        let mut conn = SqliteConnection::connect_with(&options).await.unwrap();
        conn.execute(
            r#"
            CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE habits (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              color TEXT NOT NULL DEFAULT '#3cd9b0',
              archived INTEGER DEFAULT 0
            );
            CREATE TABLE habit_checks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              habit_id INTEGER NOT NULL,
              date TEXT NOT NULL,
              UNIQUE(habit_id, date)
            );
            CREATE TABLE knowledge_entries (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            CREATE TABLE tasks (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              label TEXT NOT NULL,
              recurrence TEXT DEFAULT 'none',
              created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE task_completions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              task_id INTEGER NOT NULL,
              date TEXT NOT NULL,
              done BOOLEAN DEFAULT 0,
              UNIQUE(task_id, date)
            );
            "#,
        )
        .await
        .unwrap();
        if !sql.is_empty() {
            conn.execute(sql).await.unwrap();
        }
        conn.close().await.unwrap();
    }

    fn today() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 7, 27).unwrap()
    }

    #[tokio::test]
    async fn lit_habitudes_actives_et_coches_recentes() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("shale.db");
        seed(
            &path,
            r#"
            INSERT INTO habits (id, name, archived) VALUES (1, 'Sport', 0), (2, 'Lecture', 0), (3, 'Vieille', 1);
            INSERT INTO habit_checks (habit_id, date) VALUES (1, '2026-07-27'), (2, '2020-01-01');
            "#,
        )
        .await;

        let snap = read_snapshot(&path, today()).await.unwrap();
        assert_eq!(snap.habits.len(), 2, "les habitudes archivées sont exclues");
        assert_eq!(snap.habit_checks.len(), 1, "l'historique est borné à 90 jours");

        let pending = snap.habits_pending_on(today());
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].name, "Lecture");
    }

    #[tokio::test]
    async fn lit_la_derniere_consultation_du_savoir() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("shale.db");
        seed(
            &path,
            "INSERT INTO settings (key, value) VALUES ('knowledge.last_viewed_at', '2026-07-24 18:30:00');",
        )
        .await;

        let snap = read_snapshot(&path, today()).await.unwrap();
        assert_eq!(
            snap.knowledge_last_viewed.map(|d| d.to_string()),
            Some("2026-07-24 18:30:00".to_string())
        );
    }

    #[tokio::test]
    async fn repli_sur_la_fiche_la_plus_recente_si_la_cle_manque() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("shale.db");
        seed(
            &path,
            r#"INSERT INTO knowledge_entries (title, created_at, updated_at)
               VALUES ('a', '2026-07-01 08:00:00', '2026-07-20 09:15:00'),
                      ('b', '2026-07-02 08:00:00', '2026-07-22 11:00:00');"#,
        )
        .await;

        let snap = read_snapshot(&path, today()).await.unwrap();
        assert_eq!(
            snap.knowledge_last_viewed.map(|d| d.to_string()),
            Some("2026-07-22 11:00:00".to_string())
        );
    }

    #[tokio::test]
    async fn savoir_vide_laisse_la_regle_inerte() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("shale.db");
        seed(&path, "").await;

        let snap = read_snapshot(&path, today()).await.unwrap();
        assert!(snap.knowledge_last_viewed.is_none());
    }

    /// Régression du piège WAL : la base a été refermée proprement (donc plus de
    /// `-shm` sur le disque, comme app fermée) et doit rester lisible. Avec une
    /// connexion `read_only(true)`, ce test échouait sur `SQLITE_CANTOPEN (14)`.
    #[tokio::test]
    async fn lit_taches_et_completions() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("shale.db");
        seed(
            &path,
            r#"
            INSERT INTO tasks (id, label, recurrence) VALUES (1, 'Sport', 'daily'), (2, 'Courses', 'none');
            INSERT INTO task_completions (task_id, date, done) VALUES (1, '2026-07-26', 1), (2, '2026-07-26', 0);
            "#,
        )
        .await;

        let snap = read_snapshot(&path, today()).await.unwrap();
        assert_eq!(snap.tasks.len(), 2);
        assert_eq!(snap.tasks[0].recurrence.as_deref(), Some("daily"));
        assert_eq!(snap.completions.len(), 2);
        // `done` est un BOOLEAN SQLite, donc un entier : 1 → vrai, 0 → faux.
        assert!(snap.completions.iter().find(|c| c.task_id == 1).unwrap().done);
        assert!(!snap.completions.iter().find(|c| c.task_id == 2).unwrap().done);
    }

    /// ⭐ Corbeille (migration 027) : rien de ce qui est en corbeille ne sonne.
    ///
    /// Le schéma de `seed()` date d'avant la 027 : on lui ajoute ici la colonne
    /// `deleted_at` et les tables du calendrier, comme la 020 et la 027 le font
    /// dans l'app. Chaque famille porte un VIVANT et un JETÉ.
    #[tokio::test]
    async fn la_corbeille_ne_sonne_pas() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("shale.db");
        seed(
            &path,
            r#"
            ALTER TABLE habits ADD COLUMN deleted_at TEXT;
            ALTER TABLE tasks ADD COLUMN deleted_at TEXT;
            ALTER TABLE tasks ADD COLUMN due_date TEXT;
            ALTER TABLE tasks ADD COLUMN start_at TEXT;
            ALTER TABLE knowledge_entries ADD COLUMN deleted_at TEXT;
            CREATE TABLE calendar_events (
              id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, date TEXT NOT NULL,
              start_at TEXT, all_day INTEGER NOT NULL DEFAULT 0, recurrence TEXT NOT NULL DEFAULT 'none',
              deleted_at TEXT
            );
            CREATE TABLE goals (
              id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, deadline TEXT, deleted_at TEXT
            );
            INSERT INTO habits (id, name, deleted_at) VALUES (1, 'vivante', NULL), (2, 'jetée', '2026-07-27T08:00:00.000Z');
            INSERT INTO habit_checks (habit_id, date) VALUES (1, '2026-07-27'), (2, '2026-07-27');
            INSERT INTO tasks (id, label, recurrence, due_date, start_at, deleted_at) VALUES
              (1, 'vivante', 'none', '2026-07-28', '10:00', NULL),
              (2, 'jetée',   'none', '2026-07-28', '10:00', '2026-07-27T08:00:00.000Z');
            INSERT INTO task_completions (task_id, date, done) VALUES (1, '2026-07-26', 1), (2, '2026-07-26', 1);
            INSERT INTO calendar_events (title, date, start_at, deleted_at) VALUES
              ('vivant', '2026-07-28', '09:00', NULL),
              ('jeté',   '2026-07-28', '09:00', '2026-07-27T08:00:00.000Z');
            INSERT INTO goals (title, deadline, deleted_at) VALUES
              ('vivant', '2026-07-30', NULL),
              ('jeté',   '2026-07-30', '2026-07-27T08:00:00.000Z');
            "#,
        )
        .await;

        let snap = read_snapshot(&path, today()).await.unwrap();
        assert_eq!(snap.habits.iter().map(|h| h.id).collect::<Vec<_>>(), vec![1], "habitude jetée");
        assert_eq!(snap.habit_checks.iter().map(|c| c.habit_id).collect::<Vec<_>>(), vec![1], "case d'une habitude jetée");
        assert_eq!(snap.tasks.iter().map(|t| t.id).collect::<Vec<_>>(), vec![1], "tâche jetée");
        assert_eq!(snap.completions.iter().map(|c| c.task_id).collect::<Vec<_>>(), vec![1], "coche d'une tâche jetée");
        let titres: Vec<_> = snap.calendar.iter().map(|c| format!("{}:{}", c.kind, c.title)).collect();
        assert!(titres.iter().all(|t| !t.contains("jet")), "rien de jeté dans le calendrier : {titres:?}");
        assert_eq!(titres.len(), 3, "l'événement, la tâche datée et l'échéance vivants : {titres:?}");
    }

    /// ⭐⭐ Et une base SANS la colonne (antérieure à la 027) continue de sonner.
    ///
    /// Ce lecteur est TOLÉRANT par construction : une requête qui échoue rend
    /// une liste vide. Un filtre `deleted_at IS NULL` posé en aveugle ferait
    /// donc ÉCHOUER la requête sur une base non migrée — et éteindrait toutes
    /// les notifications, sans une erreur visible. Sans colonne, rien ne peut
    /// être en corbeille : ne pas filtrer est alors exact.
    #[tokio::test]
    async fn une_base_sans_corbeille_sonne_toujours() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("shale.db");
        seed(
            &path,
            r#"
            INSERT INTO habits (id, name) VALUES (1, 'Sport');
            INSERT INTO habit_checks (habit_id, date) VALUES (1, '2026-07-27');
            INSERT INTO tasks (id, label, recurrence) VALUES (1, 'Sport', 'daily');
            INSERT INTO task_completions (task_id, date, done) VALUES (1, '2026-07-26', 1);
            "#,
        )
        .await;
        let snap = read_snapshot(&path, today()).await.unwrap();
        assert_eq!(snap.habits.len(), 1);
        assert_eq!(snap.habit_checks.len(), 1);
        assert_eq!(snap.tasks.len(), 1);
        assert_eq!(snap.completions.len(), 1);
    }

    #[tokio::test]
    async fn colonnes_nulles_ne_font_pas_tomber_la_lecture() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("shale.db");
        seed(
            &path,
            r#"
            INSERT INTO tasks (id, label, recurrence, created_at) VALUES (1, 'Sans rien', NULL, NULL);
            INSERT INTO task_completions (task_id, date, done) VALUES (1, '2026-07-26', NULL);
            "#,
        )
        .await;

        let snap = read_snapshot(&path, today()).await.unwrap();
        assert!(snap.tasks[0].recurrence.is_none());
        assert!(snap.tasks[0].created_at.is_none());
        assert!(!snap.completions[0].done, "NULL vaut « pas fait »");
    }

    #[tokio::test]
    async fn base_wal_refermee_reste_lisible() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("shale.db");
        seed(&path, "INSERT INTO habits (id, name) VALUES (1, 'Sport');").await;
        assert!(!dir.path().join("shale.db-shm").exists(), "aucun -shm résiduel");

        let snap = read_snapshot(&path, today()).await.unwrap();
        assert_eq!(snap.habits.len(), 1);
    }

    #[tokio::test]
    async fn base_absente_ne_panique_pas() {
        let dir = tempfile::tempdir().unwrap();
        let err = read_snapshot(&dir.path().join("nulle-part.db"), today())
            .await
            .unwrap_err();
        assert!(err.contains("introuvable"));
    }

    #[tokio::test]
    async fn tables_manquantes_degradent_sans_echouer() {
        // Base valide mais vide de tout schéma : chaque lecture retombe sur du vide.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vide.db");
        let options = SqliteConnectOptions::new()
            .filename(&path)
            .create_if_missing(true);
        SqliteConnection::connect_with(&options)
            .await
            .unwrap()
            .close()
            .await
            .unwrap();

        let snap = read_snapshot(&path, today()).await.unwrap();
        assert!(snap.habits.is_empty());
        assert!(snap.habit_checks.is_empty());
        assert!(snap.knowledge_last_viewed.is_none());
    }

    #[test]
    fn parse_les_deux_formats_de_date() {
        assert!(parse_stamp("2026-07-27 20:00:00").is_some());
        assert!(parse_stamp("2026-07-27").is_some());
        assert!(parse_stamp("n'importe quoi").is_none());
    }
}
