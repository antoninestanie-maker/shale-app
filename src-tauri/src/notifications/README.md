# Notifications intelligentes

Moteur de rappels **100 % local** : il lit les données de l'app, évalue des règles
à intervalle régulier, et n'envoie **au plus une notification à la fois**. Rien ne
sort de la machine.

Deux surfaces : la notification système macOS, et le centre in-app (cloche de la
barre latérale). Le centre reçoit **toujours** la notification, même bannières
coupées — c'est lui la source de vérité.

## Où vit quoi

| Fichier | Rôle |
|---|---|
| `model.rs` | Types : préférences, journal, `Snapshot`, `Candidate`, `EvalContext` |
| `store.rs` | `notifications.json` — écriture atomique, tolérance à la corruption |
| `data.rs` | Lecture de `shale.db` (habitudes, tâches, dernière consultation du Savoir) |
| `engine.rs` | Contraintes transverses + regroupement. Fonction **pure** |
| `scheduler.rs` | Boucle, rattrapage du réveil machine, déclenchement au focus |
| `emitter.rs` | Envoi système + journal + événement `shale:notification` |
| `task_streak.rs` | Portage Rust de `src/lib/logic.ts` (séries de tâches) |
| `rules/` | Une règle = un fichier |

Côté front : `src/lib/notifications.ts` (façade + hook), `src/components/NotificationBell.tsx`
(centre in-app), section « notifications » de `src/views/SettingsView.tsx`.

## Règles livrées

| id | Ce qu'elle dit | Seuils | Cooldown |
|---|---|---|---|
| `streak_at_risk` | Une série en cours (habitudes **ou** tâches) risque d'être rompue | `hour` (21), `min_streak` (3) | 20 h |
| `habits_pending` | Il reste des habitudes à cocher aujourd'hui | `hour` (20) | 20 h |
| `inactivity` | N jours sans ouvrir une fiche du Savoir | `days` (3) | 48 h |

`streak_at_risk` **met en sourdine** `habits_pending` quand c'est la série
d'habitudes qui est menacée : elle dit déjà qu'il reste des habitudes à cocher.

Les notifications de test (bouton « Envoyer un test ») portent la règle `test` :
elles vont au journal mais **ne comptent pas** dans le plafond quotidien, sans
quoi deux vérifications d'affilée rendraient les vrais rappels muets pour la
journée.

Pourquoi des cooldowns de 20 h et non 24 h : la clé d'idempotence est déjà
journalière, et un cooldown de 24 h ferait *dériver* le rappel d'un jour sur
l'autre (déclenché à 20 h 05, il ne redeviendrait éligible qu'après 20 h 05 le
lendemain, donc au tick suivant, et ainsi de suite). `inactivity` garde 48 h pour
une raison inverse : sa clé journalière l'autoriserait à relancer *chaque* jour.

## Ajouter une règle

1. Créer `rules/ma_regle.rs` :

```rust
use super::NotificationRule;
use crate::notifications::model::{Candidate, EvalContext, RulePrefs};

pub struct MaRegle;
pub const ID: &str = "ma_regle";

impl NotificationRule for MaRegle {
    fn id(&self) -> &'static str { ID }
    fn label(&self) -> &'static str { "Mon libellé" }
    fn default_prefs(&self) -> RulePrefs { RulePrefs::new(24, &[("seuil", 5)]) }

    fn evaluate(&self, ctx: &EvalContext) -> Option<Candidate> {
        let prefs = ctx.rule_prefs(ID)?;      // absente = règle muette
        let seuil = prefs.param_i64("seuil", 5);
        // …lire `ctx.snapshot`, comparer à `ctx.now`…
        Some(Candidate {
            rule: ID,
            dedupe_key: format!("{ID}:{}", ctx.today()),  // l'ÉVÉNEMENT, pas l'instant
            title: "…".into(),
            body: "…".into(),
            summary: "…".into(),   // ligne courte, utilisée en cas de regroupement
            target: Some("today"), // vue ouverte au clic, ou None
            priority: 15,          // départage le regroupement
            supersedes: &[],       // règles à faire taire dans le même lot
        })
    }
}
```

2. L'enregistrer dans `rules/mod.rs` (une ligne dans `REGISTRY`).
3. Ajouter son entrée à `RULE_META` dans `src/lib/notifications.ts` pour l'écran
   de préférences. **Facultatif** : sans entrée, la règle reste pilotable avec un
   interrupteur et un cooldown génériques.

Une règle n'a **pas** à vérifier la fenêtre horaire, le plafond quotidien, le
cooldown ni les doublons : le moteur s'en charge pour toutes, de la même façon.
Elle dit seulement si son constat est vrai.

Si la règle a besoin d'une donnée absente du `Snapshot`, l'ajouter à `model.rs`
et la lire dans `data.rs` — en `SELECT` uniquement (voir « base de données »).

## Configuration

`~/Library/Application Support/com.atnfx.shale/notifications.json`, écrit
**uniquement par le Rust**. Le front y accède par les commandes `notif_*`.

```jsonc
{
  "preferences": {
    "enabled": true,
    "quiet_hours": { "start": 8, "end": 22 },  // start > end = fenêtre de nuit
    "daily_cap": 2,                            // un lot regroupé compte pour 1
    "check_interval_min": 15,
    "keep_running_in_background": true,
    "rules": { "habits_pending": { "enabled": true, "cooldown_h": 20, "hour": 20 } }
  },
  "log": [ /* 200 dernières, plus récentes en tête */ ],
  "state": { "last_run_at": "…" }
}
```

Les seuils propres à une règle sont **à plat** dans son objet (`#[serde(flatten)]`).
Un champ absent reprend son défaut ; une règle absente est ajoutée au démarrage
sans jamais écraser un réglage existant. Fichier illisible → mis de côté en
`.corrupt.json`, jamais écrasé.

## Trois pièges qui ont coûté du temps

**La base est en WAL.** Une connexion `read_only(true)` ne peut pas créer le
fichier `-shm` dont la lecture d'une base WAL a besoin : tant que le front n'a pas
ouvert `shale.db`, l'ouverture échoue sur `SQLITE_CANTOPEN (14)` — c'est-à-dire
exactement dans le cas visé, l'évaluation sans fenêtre ouverte. `data.rs` ouvre
donc en lecture-écriture et **n'émet que des `SELECT`** : l'interdiction d'écrire
est tenue par la discipline, pas par le mode d'ouverture.

**`Instant` ne compte pas la veille sur macOS.** Un `sleep(15 min)` posé avant que
le Mac ne dorme trois heures se réveille trois heures en retard, et le rappel de
20 h saute. Le planificateur dort donc par tranches de 60 s et décide sur
l'**horloge murale**, ce qui rattrape le réveil machine sans rien de spécifique.

**macOS ne dit pas si tu as refusé les notifications.** Dans
`tauri-plugin-notification`, `permission_state()` renvoie toujours `Granted` sur
desktop, et `show()` délègue l'envoi à une tâche de fond dont il jette le
résultat. On ne prétend donc rien savoir : `handed_to_system` signifie « remise au
système », pas « affichée », et le seul diagnostic honnête est le bouton
« Envoyer un test » des réglages.

## Résidence en arrière-plan

Une app fermée n'exécute rien : sans résidence, aucun rappel ne peut partir. Sur
`CloseRequested` de la fenêtre `main`, `lib.rs` cache la fenêtre **en mode
fenêtré seulement**, et quitte comme avant en plein écran — c'est le mode qui
produisait l'ancien bug d'espace macOS fantôme (écran noir). Le réglage
« garder Shale actif en arrière-plan » rend la chose désactivable ; « Quitter »
dans le tray et ⌘Q quittent toujours pour de bon.

## Tests

`cargo test --lib` — le moteur et les règles sont testés **avec une horloge
injectée** (`now` est un champ d'`EvalContext`, jamais un appel système) et un
`Snapshot` fabriqué à la main : ni base, ni application Tauri.

`task_streak.rs` mérite une vigilance particulière : c'est un **portage** de
`src/lib/logic.ts`. La source de vérité reste le TypeScript ; toute évolution de
`isDueOn`, `dayStat`, `todayTasks` ou `computeStreak` doit être répercutée ici, et
ses tests reprennent les cas limites du front (jour sans tâche due = neutre, tâche
créée après la date = non due, récurrence JSON invalide = non due).
