// ─────────────────────────────────────────────────────────────────────────────
// Dictionnaire anglais. La clé est la phrase FRANÇAISE exacte du code
// (apostrophes typographiques ’ comprises — une clé qui ne correspond pas au
// caractère près retombe silencieusement sur le français).
//
// Registre visé : anglais direct à la deuxième personne, vocabulaire de trading
// standard (stop-loss, entry, position size, R multiple, drawdown, prop firm).
// Les libellés en minuscules le restent : le design system s'appuie dessus
// (`.hud-label` met en majuscules en CSS).
// ─────────────────────────────────────────────────────────────────────────────

export const EN: Record<string, string> = {
  // ── Navigation, modules, catégories ───────────────────────────────────────
  "Aujourd'hui": "Today",
  "Tâches": "Tasks",
  "Timer": "Timer",
  "Objectifs": "Goals",
  "Performance": "Performance",
  "Notes": "Notes",
  "Savoir": "Knowledge",
  "Journal": "Journal",
  "Trading": "Trading",
  "Market-Brain": "Market Brain",
  "Position": "Position",
  "Réglages": "Settings",
  "Personnaliser": "Customize",
  "Admin": "Admin",
  "Productivité": "Productivity",
  // Catégories par intention de la barre latérale (2026-10-01), mêmes mots que le site.
  "Décider quoi faire": "Decide what to do",
  "Avancer et mesurer": "Move forward and measure",
  "Penser et retenir": "Think and remember",
  "Tenir les comptes": "Keep the books",
  "Système": "System",

  "Tableau de bord du jour : tâches, énergie, discipline, performance.":
    "Today’s dashboard: tasks, energy, discipline, performance.",
  "Créer, taguer et planifier les tâches récurrentes ou ponctuelles.":
    "Create, tag and schedule recurring or one-off tasks.",
  "Minuteur Pomodoro pour tes sessions de concentration.":
    "Pomodoro timer for your focus sessions.",
  "Objectifs court / moyen / long terme, regroupés par catégorie.":
    "Short, medium and long-term goals, grouped by category.",
  "Courbes de progression : régularité, focus, objectifs.":
    "Progress curves: consistency, focus, goals.",
  "Tests de réflexes et de mémoire — état de forme avant séance.":
    "Reflex and memory tests — your form before the session.",
  "Notes riches liées entre elles, recherche plein texte.":
    "Rich notes linked to each other, full-text search.",
  "Base de connaissances : notes, images, croquis et liens par thème.":
    "Knowledge base: notes, images, sketches and links by topic.",
  "Entrée quotidienne : humeur, énergie, ressenti de la journée.":
    "Daily entry: mood, energy, how the day felt.",
  "Journal de trades en R, statistiques et tracker de positions live.":
    "Trade journal in R, statistics and live position tracker.",
  "Briefing marchés généré 2×/jour : biais, niveaux, zones no-trade.":
    "Market briefing generated twice a day: bias, levels, no-trade zones.",
  "Calculateur de taille de position et de risque, envoi au tracker.":
    "Position size and risk calculator, with send-to-tracker.",
  "Clés d'API, apparence, charge mentale, réglages du tracker.":
    "API keys, appearance, mental load, tracker settings.",
  "Réorganiser les onglets et les widgets, densité, identité.":
    "Reorder tabs and widgets, density, identity.",
  "Console d'administration : utilisateurs, abonnements, métriques.":
    "Admin console: users, subscriptions, metrics.",
  "Déplier la catégorie": "Expand category",
  "Replier la catégorie": "Collapse category",

  // ── Actions génériques ────────────────────────────────────────────────────
  "Créer": "Create",
  "Ajouter": "Add",
  "Enregistrer": "Save",
  "Annuler": "Cancel",
  "Fermer": "Close",
  "Ouvrir": "Open",
  "Modifier": "Edit",
  "Supprimer": "Delete",
  "Réinitialiser": "Reset",
  "Réduire": "Collapse",
  "Démarrer": "Start",
  "Déplacer": "Move",
  "Insérer": "Insert",
  "Renommer": "Rename",

  // ── Corbeille « Supprimés récemment » et menu des tâches (2026-09-23) ──
  "Nouveau nom de la tâche": "New task name",
  "Journal du {date}": "Journal of {date}",
  "Brouillon sans objet": "Untitled draft",
  "« {titre} » est dans Supprimés récemment": "“{titre}” is in Recently Deleted",
  "Voir": "View",
  "« {titre} » est de retour": "“{titre}” is back",
  "« {titre} » est supprimé pour de bon": "“{titre}” is permanently deleted",
  "« {titre} » et 1 élément sont dans Supprimés récemment": "“{titre}” and 1 item are in Recently Deleted",
  "« {titre} » et {n} éléments sont dans Supprimés récemment": "“{titre}” and {n} items are in Recently Deleted",
  "Choisir une date…": "Choose a date…",
  "Cette tâche n'a pas de date.": "This task has no date.",
  "Aucun objectif": "No goal",
  "Rouvrir": "Reopen",
  "Dater": "Schedule",
  "Une tâche récurrente n'a pas de date : elle revient selon sa règle.": "A recurring task has no date: it comes back on its schedule.",
  "Rattacher à un objectif": "Link to a goal",
  "Aucun objectif pour l'instant.": "No goals yet.",
  "Modifier…": "Edit…",
  "« {titre} » est prévue le {date}": "“{titre}” is scheduled for {date}",
  "« {titre} » n'a plus de date": "“{titre}” no longer has a date",
  "Supprimés récemment": "Recently Deleted",
  "Ce que tu supprimes reste ici {n} jours, puis part pour de bon.": "What you delete stays here for {n} days, then is gone for good.",
  "Garder": "Keep",
  "Tout supprimer": "Delete all",
  "Rien à restaurer": "Nothing to restore",
  "Quand tu supprimes une note, une tâche ou un objectif, il attend ici {n} jours avant de partir.": "When you delete a note, a task or a goal, it waits here for {n} days before it's gone.",
  "Supprimé le {date}": "Deleted {date}",
  "part au prochain lancement": "goes at next launch",
  "Supprimer définitivement « {titre} »": "Delete “{titre}” permanently",
  "Supprimer définitivement": "Delete permanently",
  "Supprimer définitivement « {titre} » ? Il ne pourra plus être restauré.": "Delete “{titre}” permanently? It can't be restored.",
  "1 élément supprimé pour de bon": "1 item permanently deleted",
  "{n} éléments supprimés pour de bon": "{n} items permanently deleted",
  "Vider (1 élément)": "Empty (1 item)",
  "Vider ({n} éléments)": "Empty ({n} items)",
  "Supprimer définitivement 1 élément ? Il ne pourra plus être restauré.": "Delete 1 item permanently? It can't be restored.",
  "Supprimer définitivement les {n} éléments ? Ils ne pourront plus être restaurés.": "Delete all {n} items permanently? They can't be restored.",
  "encore 1 jour": "1 day left",
  "encore {n} jours": "{n} days left",
  "avec 1 élément": "with 1 item",
  "avec {n} éléments": "with {n} items",
  "« {titre} » est rangé sous un objectif lui aussi supprimé. Le restaurer ramène cet objectif, et 1 autre élément avec.": "“{titre}” sits under a goal that was deleted too. Restoring it brings that goal back, with 1 other item.",
  "« {titre} » est rangé sous un objectif lui aussi supprimé. Le restaurer ramène cet objectif, et {n} autres éléments avec.": "“{titre}” sits under a goal that was deleted too. Restoring it brings that goal back, with {n} other items.",
  "Restaurer « {titre} » ramène aussi 1 élément qui avait été supprimé avec lui.": "Restoring “{titre}” also brings back 1 item deleted with it.",
  "Restaurer « {titre} » ramène aussi les {n} éléments qui avaient été supprimés avec lui.": "Restoring “{titre}” also brings back the {n} items deleted with it.",
  "Restaurer les {n}": "Restore all {n}",
  "Supprimer définitivement « {titre} » et 1 élément rangé dessous ? Ils ne pourront plus être restaurés.": "Delete “{titre}” and 1 item under it permanently? They can't be restored.",
  "Supprimer définitivement « {titre} » et les {n} éléments rangés dessous ? Ils ne pourront plus être restaurés.": "Delete “{titre}” and the {n} items under it permanently? They can't be restored.",
  "Elle reste 30 jours dans Supprimés récemment.": "It stays in Recently Deleted for 30 days.",
  "Ce que tu as supprimé ces 30 derniers jours, prêt à revenir.": "What you deleted in the last 30 days, ready to come back.",
  "Ouvrir Supprimés récemment": "Open Recently Deleted",
  "Dupliquer l'événement": "Duplicate event",
  "Supprimer la série": "Delete series",
  "Nouvel événement ici": "New event here",
  "Nouvelle tâche ici": "New task here",
  "Tâche ajoutée à {heure}": "Task added at {heure}",
  "Nommer": "Name it",
  "Actions du calendrier": "Calendar actions",
  "Copier le numéro": "Copy number",
  "Supprimer le brouillon": "Delete draft",
  "Un document émis ne se supprime pas : il s'annule par un avoir, depuis sa fenêtre.": "An issued document can't be deleted: cancel it with a credit note, from its window.",
  "Copier le texte": "Copy text",
  "L'entrée du jour est vide.": "Today's entry is empty.",
  "Effacer l'entrée du jour": "Clear today's entry",
  "Rien n'est encore écrit aujourd'hui.": "Nothing written today yet.",
  "Décocher pour aujourd'hui": "Uncheck for today",
  "Cocher pour aujourd'hui": "Check for today",
  "Copier le nom": "Copy name",
  "Renommer…": "Rename…",
  "Ce sujet est déjà le premier.": "This topic is already first.",
  "Ce sujet est déjà le dernier.": "This topic is already last.",
  "Supprimer…": "Delete…",
  "Copier le titre": "Copy title",
  "Actions sur l'entrée du jour": "Actions on today's entry",
  "Elle part dans Supprimés récemment avec son historique de coches.": "It goes to Recently Deleted with its check history.",
  "Le sujet reste 30 jours dans Supprimés récemment. Le restaurer y range de nouveau ses notes.": "The topic stays in Recently Deleted for 30 days. Restoring it files its notes back under it.",
  "Elle part dans Supprimés récemment avec tout son historique.": "It goes to Recently Deleted with its full history.",
  "Supprimer le calcul {paire} du {date} ? C'est définitif.": "Delete the {paire} calculation from {date}? This can't be undone.",
  "Retirer ce décaissement ? C'est définitif, et le statut de la facture sera recalculé.": "Remove this outgoing payment? This can't be undone, and the invoice status will be recalculated.",
  "Retirer cet encaissement ? C'est définitif, et le statut de la facture sera recalculé.": "Remove this payment? This can't be undone, and the invoice status will be recalculated.",
  "Retirer {symbole}": "Remove {symbole}",
  "Retirer {symbole} de {compte} ? C'est définitif : la position ne passe pas par Supprimés récemment.": "Remove {symbole} from {compte}? This can't be undone: holdings don't go to Recently Deleted.",
  "Retirer {pair} du tracker ? Rien n'est écrit dans le journal, et la position ne pourra pas être récupérée.": "Remove {pair} from the tracker? Nothing is written to the journal, and the position can't be recovered.",
  "Actions sur {pair}": "Actions on {pair}",
  "Retirer du tracker…": "Remove from tracker…",
  "Actions sur le calcul": "Actions on the calculation",
  "Retirer la marque « tradé »": "Unmark as traded",
  "Actions sur le lien": "Actions on the link",
  "Copier l'adresse": "Copy address",
  "Actions sur le nœud": "Actions on the node",
  "Ce nœud et celui qui pend dessous disparaissent.": "This node and the one under it will be removed.",
  "Ce nœud et les {n} qui pendent dessous disparaissent.": "This node and the {n} under it will be removed.",
  "Actions sur la position": "Actions on the holding",
  "Retirer…": "Remove…",
  "Une mention se retire en effaçant le @ dans le texte.": "A mention is removed by deleting the @ in the text.",
  "La note a changé entre-temps : le bloc n'a pas pu être remis.": "The note changed in the meantime: the block couldn't be put back.",
  "Passe en écriture pour modifier la note.": "Switch to editing to change the note.",
  "Modifier la carte…": "Edit map…",
  "Supprimer la carte": "Delete map",
  "Modifier le croquis…": "Edit sketch…",
  "Supprimer le croquis": "Delete sketch",
  "Le dessin quitte la note. « Annuler » le remet juste après.": "The drawing leaves the note. “Undo” puts it right back.",
  "Supprimer l'image": "Delete image",
  "Ce fichier a été supprimé.": "This file has been deleted.",
  "Retirer de la note": "Remove from note",
  "Actions sur le bloc": "Actions on the block",
  "« {titre} » et sa branche quittent la note.": "“{titre}” and its branch leave the note.",
  "« {titre} » et ses {n} branches quittent la note.": "“{titre}” and its {n} branches leave the note.",
  "La carte et sa branche quittent la note.": "The map and its branch leave the note.",
  "La carte et ses {n} branches quittent la note.": "The map and its {n} branches leave the note.",
  "Actions sur le tag « {name} »": "Actions on tag “{name}”",
  "Ne plus filtrer": "Stop filtering",
  "Filtrer les tâches": "Filter tasks",
  "Supprimer le tag « {name} » ? 1 tâche le perd — elle reste, sans tag. C'est définitif.": "Delete tag “{name}”? 1 task loses it — the task stays, untagged. This can't be undone.",
  "Supprimer le tag « {name} » ? {n} tâches le perdent — elles restent, sans tag. C'est définitif.": "Delete tag “{name}”? {n} tasks lose it — they stay, untagged. This can't be undone.",
  "Une question est posée d'abord : c'est définitif.": "You'll be asked first: this can't be undone.",
  "Supprimer le trade {instrument} du {date} ({r}) ? C'est définitif : le journal de trading n'a pas de corbeille.": "Delete the {instrument} trade from {date} ({r})? This can't be undone: the trading journal has no trash.",
  "Actions sur le trade {instrument}": "Actions on the {instrument} trade",
  "Carte mentale retirée de la note": "Mind map removed from the note",
  "Croquis retiré de la note": "Sketch removed from the note",
  "Image retirée de la note": "Image removed from the note",
  "« {nom} » retiré de la note": "“{nom}” removed from the note",
  // ── Menus contextuels (chantier 2026-09-21) ─────────────────────────────
  "Actions": "Actions",
  "Dupliquer": "Duplicate",
  "Copier": "Copy",
  "Le titre": "The title",
  "Le texte": "The text",
  "Cette note est vide.": "This note is empty.",
  "{titre} (copie)": "{titre} (copy)",
  "Épingler": "Pin",
  "Désépingler": "Unpin",
  "Épinglés": "Pinned",
  "Activé": "On",
  "Désactivé": "Off",
  "Défaut": "Default",
  "Aucun": "None",
  "Une fois": "Once",
  "sûr ?": "sure?",
  "Confirmer la suppression": "Confirm deletion",
  "Confirmer le retrait": "Confirm removal",
  "Tout effacer": "Clear all",
  "Tout marquer lu": "Mark all read",
  "Échap": "Esc",
  "échap fermer": "esc to close",
  "⏎ ajouter": "⏎ to add",
  "⏎ exécuter": "⏎ to run",
  "Entrée": "Enter",
  "Vérification…": "Checking…",
  "Sans titre": "Untitled",
  "Sans catégorie": "No category",
  "Catégorie": "Category",
  "Priorité": "Priority",
  "Récurrence": "Recurrence",
  "unité": "unit",
  "méthode": "method",
  "règles": "rules",
  "identité": "identity",
  "données": "data",
  "synthèse": "summary",
  "Synthèse": "Summary",
  "Métriques": "Metrics",
  "métriques": "metrics",
  "thèmes": "topics",
  "tâches": "tasks",
  "année": "year",
  "après": "after",
  "à partir de": "from",
  "pas avant": "not before",
  "pas après": "not after",
  "pas plus souvent que": "no more often than",
  "vérifier toutes les": "check every",
  "à l'instant": "just now",
  "à toi": "your turn",
  "entrée": "entry",
  "Ce mois": "This month",
  "Cette semaine": "This week",
  "Cette année": "This year",
  "cette semaine": "this week",
  "cumulé": "cumulative",
  "7 jours": "7 days",
  "série en cours": "current streak",
  "Habitudes à tenir": "Habits to keep",
  "Aucune habitude pour l'instant.": "No habits yet.",
  "Crée la première dans le Journal": "Create your first one in the Journal",
  "Moyenne 30 jours": "30-day average",
  "Jours précis": "Specific days",
  "dernier jour": "last day",

  // ── Palette de commandes / actions ────────────────────────────────────────
  "Palette de commandes": "Command palette",
  "Que veux-tu faire ?": "What do you want to do?",
  "esc": "esc",
  "total": "total",
  "↑↓ naviguer": "↑↓ to navigate",
  // Catégories de la palette : la valeur reste l'identifiant technique côté
  // code, le suffixe « |palette » lève l'ambiguïté avec les ids de vues.
  "navigation|palette": "navigation",
  "tâches|palette": "tasks",
  "objectifs|palette": "goals",
  "métriques|palette": "metrics",
  "focus|palette": "focus",
  "notes|palette": "notes",
  "trading|palette": "trading",
  "Aucune action ne correspond.": "No matching action.",
  "Aller à Aujourd'hui": "Go to Today",
  "Aller aux Tâches": "Go to Tasks",
  "Aller au Timer": "Go to Timer",
  "Aller aux Objectifs": "Go to Goals",
  "Aller à Performance": "Go to Performance",
  "Aller aux Notes": "Go to Notes",
  "Aller au Savoir": "Go to Knowledge",
  "Aller au Journal": "Go to Journal",
  "Ajouter une tâche": "Add a task",
  "Début du nom de la tâche…": "Start of the task name…",
  "Nom de la tâche…": "Task name…",
  "Nom de la tâche": "Task name",
  "Nom de tâche vide": "Empty task name",
  "Précise le nom de la tâche": "Give the task a name",
  "Nouvelle note": "New note",
  "Rechercher\u2026": "Search\u2026",
  "Contenu de la note…": "Note content…",
  "Note vide": "Empty note",
  "Note rapide": "Quick note",
  "Cocher une tâche du jour": "Check off a task for today",
  "C'est noté.": "Noted.",
  "Données non chargées": "Data not loaded",
  "+1 sur une métrique": "+1 on a metric",
  "Précise le nom de la métrique": "Give the metric a name",
  "Nom de la métrique…": "Metric name…",
  "Lancer un focus (25 min)": "Start a focus session (25 min)",
  "Un focus est déjà en cours": "A focus session is already running",
  "Arrêter le focus en cours": "Stop the current focus session",
  "Aucun focus en cours": "No focus session running",
  "Focus arrêté": "Focus stopped",
  "Focus terminé": "Focus complete",
  "Logger un trade": "Log a trade",
  "Calculateur de taille de position": "Position size calculator",
  "Capture une tâche…": "Capture a task…",

  // ── Tâches ────────────────────────────────────────────────────────────────
  "Nouvelle tâche": "New task",
  "+ Nouvelle tâche": "+ New task",
  "Modifier la tâche": "Edit task",
  "Nouvelle tâche (formulaire complet)": "New task (full form)",
  "Un second clic supprime la tâche et son historique.":
    "A second click permanently deletes the task and its history.",
  "Tâches du jour": "Today’s tasks",
  "Marquer à faire": "Mark as to do",
  "Rien pour aujourd'hui.": "Nothing for today.",
  "Ajoute une première tâche ↑": "Add your first task ↑",
  "Ajouter une tâche…  (Entrée)": "Add a task…  (Enter)",
  "Compte dans la discipline et le streak du jour.":
    "Counts towards today’s discipline and streak.",
  "Démarre un pomodoro dédié à cette tâche.": "Start a pomodoro dedicated to this task.",
  "Libellé, tag, priorité, récurrence et objectif lié.":
    "Label, tag, priority, recurrence and linked goal.",
  "Retirer ce filtre.": "Remove this filter.",
  "N’afficher que les tâches de ce tag.": "Show only tasks with this tag.",
  "Nouveau tag…": "New tag…",
  "Couleur du tag": "Tag colour",
  "Les tâches concernées sont conservées, simplement sans tag.":
    "The tasks themselves are kept, just without the tag.",
  "Objectif lié": "Linked goal",
  "Sans tâche liée": "No linked task",
  "tâche liée": "linked task",
  "Tâche ou intitulé (optionnel)…": "Task or label (optional)…",

  // ── Objectifs ─────────────────────────────────────────────────────────────
  "Nouvel objectif": "New goal",
  "+ Nouvel objectif": "+ New goal",
  "Modifier l'objectif": "Edit goal",
  "Titre de l'objectif": "Goal title",
  "Objectif parent": "Parent goal",
  "+ sous-objectif": "+ sub-goal",
  "Ajouter un sous-objectif": "Add a sub-goal",
  "Les sous-objectifs remontent d’un niveau, les tâches liées sont déliées.":
    "Sub-goals move up one level and linked tasks are unlinked.",
  "ex. Formation, Santé, Finances… (optionnel)":
    "e.g. Learning, Health, Money… (optional)",
  "Aucun objectif en cours.": "No goal in progress.",
  "Crée-en un dans l'onglet Objectifs.": "Create one in the Goals tab.",
  "objectif quotidien": "daily goal",
  // Horizons : minuscules dans les pastilles (vue + widget), capitales dans le
  // sélecteur de la modale. Les deux casses sont des clés distinctes.
  "court terme": "short term",
  "moyen terme": "medium term",
  "long terme": "long term",
  "Court terme": "Short term",
  "Moyen terme": "Medium term",
  "Long terme": "Long term",
  "aujourd'hui": "today",
  "{n} tâche": "{n} task",
  "{n} tâches": "{n} tasks",
  "Description (optionnel)": "Description (optional)",
  "Progression": "Progress",
  "manuelle": "manual",

  // ── Timer / focus ─────────────────────────────────────────────────────────
  "Pause": "Pause",
  "Terminer": "End",  // « Reprendre » existe déjà plus bas
  "Mettre en pause": "Pause",
  "Moins 5 minutes": "5 minutes less",
  "Moins 30 minutes d'objectif": "30 minutes less on the target",
  "pause": "break",
  "en pause": "paused",
  "en cours": "running",
  "focus session": "focus session",
  "pause en cours": "break in progress",
  "session en cours": "session in progress",
  "pause {n} min ensuite": "{n} min break afterwards",
  "cycles aujourd'hui": "cycles today",
  "travail (min)": "work (min)",
  "pause (min)": "break (min)",
  "Lancer {n} min": "Start {n} min",
  "Session": "Session",
  "Statistiques": "Statistics",
  "oui": "yes",
  "Choisis un preset (ou « sur mesure »), lie une tâche, puis lance ta session.":
    "Pick a preset (or “custom”), link a task, then start your session.",
  // Les trois presets : « pomodoro » et « deep work » sont déjà anglais, seul
  // « ultradien » se traduit. Ils viennent de TIMER_PRESETS, traduits à
  // l'affichage comme toute table de libellés.
  "pomodoro": "pomodoro",
  "deep work": "deep work",
  "ultradien": "ultradian",
  "— tâches courtes, démarrage difficile : la friction minimale.":
    "— short tasks, hard starts: the least possible friction.",
  "— rédaction, montage : assez long pour entrer dans le flow.":
    "— writing, editing: long enough to reach flow.",
  "— aligné sur les cycles d'énergie naturels, pour les gros blocs du soir.":
    "— aligned with natural energy cycles, for the big evening blocks.",
  "Le mode « sur mesure » laisse fixer librement les durées travail et pause (1–240 min), mémorisées pour la prochaine session.":
    "“Custom” lets you set work and break lengths freely (1–240 min), remembered for the next session.",
  "Lancer la session": "Start session",
  "Terminer la session": "End session",
  "Reprendre la session": "Resume session",
  "Agrandir la session": "Expand session",
  "Plein écran": "Full screen",
  "Démarre le compte à rebours de concentration.": "Start the focus countdown.",
  "Ne laisse que le compte à rebours à l’écran.":
    "Leaves nothing on screen but the countdown.",
  "Clôt et enregistre le temps concentré effectué.":
    "Ends the session and logs the focus time completed.",
  "Enregistre le temps concentré déjà effectué.": "Logs the focus time already completed.",
  "Le temps déjà effectué reste acquis.": "The time already completed is kept.",
  "Le décompte repart où il s’était arrêté.": "The countdown picks up where it left off.",
  "Plus 5 minutes": "Add 5 minutes",
  "Pause terminée": "Break over",
  "On reprend le travail.": "Back to work.",
  "durée de travail": "work length",
  "Durées sur mesure": "Custom lengths",
  "sur mesure": "custom",
  "Travail et pause libres (1 à 240 min), mémorisés pour les prochaines sessions.":
    "Free work and break lengths (1–240 min), remembered for future sessions.",
  "cycles du jour": "cycles today",
  "sessions du jour": "sessions today",
  "nouvelle session": "new session",
  "Aucune session aujourd'hui — lance la première.":
    "No session today — start the first one.",
  "la fenêtre peut être réduite — le chrono continue":
    "you can minimise the window — the timer keeps running",
  "Sessions du jour": "Today’s sessions",

  // ── Journal ───────────────────────────────────────────────────────────────
  "Énergie": "Energy",
  "énergie": "energy",
  "Cocher ou décocher ce jour.": "Check or uncheck this day.",
  "Cocher pour aujourd’hui.": "Check for today.",
  "Cliquer à nouveau pour effacer.": "Click again to clear.",
  "Couleur de l’habitude": "Habit colour",
  "Supprimer l’habitude": "Delete habit",
  "Un second clic supprime l’habitude et son historique de coches.":
    "A second click deletes the habit and its check history.",
  "Nouvelle habitude…": "New habit…",
  "Ajoute ta première habitude — méditation, sport, lecture…":
    "Add your first habit — meditation, exercise, reading…",
  "Revue de la semaine": "Weekly review",
  "Générer la revue de la semaine": "Generate the weekly review",
  "Crée une note qui récapitule humeur, énergie et habitudes des 7 derniers jours.":
    "Creates a note summing up mood, energy and habits over the last 7 days.",
  "Réflexion du jour — qu'est-ce qui s'est passé, qu'est-ce que tu en retires ?":
    "Today’s reflection — what happened, and what do you take from it?",
  "## Stats de la semaine": "## Stats for the week",
  "## Ce qui a marché": "## What worked",
  "## À améliorer": "## What to improve",
  "## Priorités de la semaine prochaine": "## Priorities for next week",
  "Historique des streaks": "Streak history",
  "Pas encore de streak — vise ≥80% de tes tâches un jour donné.":
    "No streak yet — aim for ≥80% of your tasks on a given day.",
  "L'historique se construit au fil des jours — reviens demain.":
    "History builds up day by day — come back tomorrow.",

  // ── Notes ─────────────────────────────────────────────────────────────────
  "Titre de la note": "Note title",
  "Nouvelle note (éditeur)": "New note (editor)",
  "Supprimer la note": "Delete note",
  "Un second clic supprime définitivement la note.":
    "A second click permanently deletes the note.",
  "Aucune note. Crée la première !": "No notes yet. Create the first one!",
  "Aucun résultat.": "No results.",
  "Sélectionne une note, ou crée-en une nouvelle.": "Select a note, or create a new one.",
  "Écris ta note. Mets en forme avec la barre d'outils. Lie une note avec [[son titre]].":
    "Write your note. Format it with the toolbar. Link a note with [[its title]].",
  "Crée une note portant ce titre pour activer le lien.":
    "Create a note with this title to activate the link.",
  "Note inexistante": "Note doesn’t exist",
  "référencée par": "referenced by",
  "enregistrée": "saved",
  "enregistré": "saved",
  "Écrire une note": "Write a note",
  "Liste à puces": "Bulleted list",
  "Liste numérotée": "Numbered list",
  "Souligné": "Underline",
  "Barré": "Strikethrough",
  "Épais": "Bold",
  "Effacer la mise en forme": "Clear formatting",
  "Poser le lien": "Add link",
  "Vers une ressource externe": "To an external resource",
  "Séparateur": "Divider",
  "Case à cocher": "Checkbox",
  "Insérer un élément": "Insert an element",
  "Réaffiche le menu d’insertion et réactive la saisie.":
    "Brings back the insert menu and re-enables typing.",
  "Reprendre l’édition": "Resume editing",

  // ── Savoir ────────────────────────────────────────────────────────────────
  "Créer le thème": "Create topic",
  "Un dossier de couleur pour regrouper des notes.":
    "A colour-coded folder to group notes.",
  "Les notes ne sont pas supprimées : elles passent « non classées ».":
    "The notes are not deleted: they become “unfiled”.",
  "Aucun thème. Crée-en un pour classer tes notes.":
    "No topics yet. Create one to file your notes.",
  "Afficher les notes de ce thème.": "Show the notes in this topic.",
  "Non classée": "Unfiled",
  "Non classées": "Unfiled",
  "Notes qui n’appartiennent encore à aucun thème.":
    "Notes that don’t belong to a topic yet.",
  "Toutes les notes, tous thèmes confondus.": "All notes, across every topic.",
  "Ton savoir commence ici": "Your knowledge starts here",
  "Ton savoir t'attend": "Your knowledge is waiting",
  "Créer une première note": "Create a first note",
  "Aucune note ne correspond": "No matching note",
  "Essaie un autre mot-clé, ou retire le filtre de tag.":
    "Try another keyword, or clear the tag filter.",
  "Rechercher dans le savoir…": "Search your knowledge…",
  "Titre, tags et contenu — tous les mots doivent correspondre.":
    "Title, tags and content — every word must match.",
  "Ajouter un tag": "Add a tag",
  "N’afficher que les notes de ce tag.": "Show only notes with this tag.",
  "Les notes épinglées remontent en tête de liste.":
    "Pinned notes move to the top of the list.",
  "Les notes mises en avant, à garder sous la main.":
    "Highlighted notes, kept within reach.",
  "Écris ici. « Insérer » ajoute une image, un croquis, un lien…":
    "Write here. “Insert” adds an image, a sketch, a link…",
  "Une note contient tout : du texte, des liens, des images, des croquis. Colle une capture (⌘V) ou dépose un fichier pour aller encore plus vite.":
    "A note holds everything: text, links, images, sketches. Paste a screenshot (⌘V) or drop a file to go even faster.",
  "Texte, liens, images et croquis vivent tous dans la note.":
    "Text, links, images and sketches all live inside the note.",
  "Note à partir d'une image": "Note from an image",
  "Raccourci : crée une note contenant l'image choisie.":
    "Shortcut: creates a note containing the chosen image.",
  "Les images sont recompressées et placées dans la note.":
    "Images are recompressed and placed in the note.",
  "ou colle une image · glisse un fichier": "or paste an image · drop a file",
  "Déposez pour créer une note": "Drop to create a note",

  // ── Croquis ───────────────────────────────────────────────────────────────
  "Nouveau croquis": "New sketch",
  "Modifier le croquis": "Edit sketch",
  "Enregistrer le croquis": "Save sketch",
  "Schéma tracé à la main": "Hand-drawn diagram",
  "Annuler le dernier trait": "Undo last stroke",
  "Effacer toute la feuille": "Clear the whole sheet",
  "Repeint la zone en couleur du papier.": "Paints over the area in the paper colour.",
  "Le tracé reste modifiable : tu pourras le rouvrir et le compléter.":
    "The drawing stays editable: you can reopen it and add to it.",

  // ── Performance ───────────────────────────────────────────────────────────
  "Complétion des tâches": "Task completion",
  "complétion": "completion",
  "Granularité du graphique de complétion.": "Granularity of the completion chart.",
  "Habitudes à tenir (Journal)": "Habits to keep (Journal)",
  "Nouvelle métrique…": "New metric…",
  "Supprimer la métrique": "Delete metric",
  "Un second clic supprime la métrique et tout son historique.":
    "A second click deletes the metric and all its history.",
  "Ajoute 1 à la valeur du jour et l’enregistre.": "Adds 1 to today’s value and saves it.",
  "Incrémenter": "Increment",
  "(sans tag)": "(no tag)",
  "focus par tag — 30 jours": "focus by tag — 30 days",
  "Heures de backtesting": "Backtesting hours",

  // ── Charge mentale / discipline ───────────────────────────────────────────
  "charge mentale — énergie restante": "mental load — energy left",
  "Énergie restante": "Energy left",
  "Énergie restante (charge mentale)": "Energy left (mental load)",
  "énergie de départ": "starting energy",
  "coût par trade": "cost per trade",
  "coût / heure d'écran": "cost per screen hour",
  "Énergie basse : tes décisions se dégradent. Lève le pied.":
    "Low energy: your decisions are degrading. Ease off.",
  "Garde le cap": "Stay the course",

  // ── Trading / journal de trades ───────────────────────────────────────────
  "trades": "trades",
  "gagnants": "wins",
  "perdants": "losses",
  "Total": "Total",
  "Tracker live": "Live tracker",
  "Stats R": "R stats",
  "DD max": "max DD",
  "Stats mensuelles": "Monthly stats",
  "stats mensuelles": "monthly stats",
  "Logger": "Log",
  "retirer": "remove",
  "Loggue ton premier trade avec « + Nouveau trade » pour voir tes statistiques par setup.":
    "Log your first trade with “+ New trade” to see your stats by setup.",
  // Tracker live
  "{pct}% engagés": "{pct}% committed",
  "Aucune position en attente. Depuis": "No position waiting. From",
  ", clique sur": ", click",
  "Trader": "Trade",
  ": la position arrive ici avec son heure d'entrée, son R:R et sa taille.":
    ": the position lands here with its entry time, its R:R and its size.",
  "taille": "size",
  "{n} lot": "{n} lot",
  "Sortie partielle": "Partial exit",
  "partielle": "partial",
  "Position gagnante": "Winning position",
  "Position perdante": "Losing position",
  "Gagnante": "Win",
  "Perdante": "Loss",
  "Retirer": "Remove",
  "Fermeture partielle :": "Partial close:",
  "Take Profit :": "Take profit:",
  "(reste {pct}%)": "({pct}% left)",
  "niveau TP": "TP level",
  "Envoyer au tracker": "Send to tracker",
  "Take Profit initial (optionnel)": "Initial take profit (optional)",
  "TP incohérent avec un {sens} — le R:R ne sera pas calculé.":
    "TP inconsistent with a {sens} — the R:R will not be calculated.",
  "Nouveau trade": "New trade",
  "+ Nouveau trade": "+ New trade",
  "Modifier le trade": "Edit trade",
  "Supprimer le trade": "Delete trade",
  "Un second clic le retire définitivement du journal.":
    "A second click removes it from the journal for good.",
  "Liste des trades": "Trade list",
  "Aucun trade enregistré.": "No trades logged.",
  "Aucun trade sur 30 jours — la courbe apparaîtra ici.":
    "No trades in 30 days — the curve will appear here.",
  "Résultat (en R)": "Result (in R)",
  "Notes d'exécution (optionnel)": "Execution notes (optional)",
  "paramètres du trade": "trade parameters",
  "Saisie manuelle dans le journal (instrument, sens, résultat en R).":
    "Manual entry in the journal (instrument, direction, result in R).",
  "Screenshot du trade": "Trade screenshot",
  "Joindre un screenshot": "Attach a screenshot",
  "Changer le screenshot": "Change screenshot",
  "Voir le screenshot": "View screenshot",
  "Voir la capture": "View screenshot",
  "Agrandit le screenshot joint à ce trade.": "Enlarges the screenshot attached to this trade.",
  "Trades pris": "Trades taken",
  "Trades en réel": "Live trades",
  "Trades de backtest": "Backtest trades",
  "Trades testés sur historique — comptés séparément du réel.":
    "Trades tested on historical data — counted separately from live ones.",
  "Par setup": "By setup",
  "par setup": "by setup",
  "(sans setup)": "(no setup)",
  "Équity 30 jours": "30-day equity",
  "équity — r cumulé 30 jours": "equity — cumulative r over 30 days",
  "trading — r cumulé 30 jours": "trading — cumulative r over 30 days",
  "Journal du compte réel : statistiques, équity et tracker de positions.":
    "Live account journal: statistics, equity and position tracker.",
  "Exécution propre": "Clean execution",
  "Exécute proprement": "Execute cleanly",
  "Entré trop tôt": "Entered too early",

  // ── Tracker live ──────────────────────────────────────────────────────────
  "tracker live — en attente de dénouement": "live tracker — awaiting outcome",
  "Clôturer gagnante": "Close as winner",
  "Clôt au TP (ou au prix de sortie demandé), logue le trade et archive la position.":
    "Closes at TP (or at the exit price you enter), logs the trade and archives the position.",
  "Clôt au stop : −1R sur la part restante, trade enregistré au journal.":
    "Closes at stop: −1R on the remaining size, trade logged in the journal.",
  "Sortie à l’entrée : 0R sur la part restante (les partielles restent comptées).":
    "Exit at entry: 0R on the remaining size (partials still count).",
  "Retirer du tracker": "Remove from tracker",
  "Pour une position envoyée par erreur : rien n’est écrit dans le journal.":
    "For a position sent by mistake: nothing is written to the journal.",
  "prix de sortie": "exit price",
  "Prix de sortie (pas de TP défini) :": "Exit price (no TP set):",
  "définir": "set",
  "au dénouement.": "at the outcome.",
  "r:r théorique": "theoretical r:r",
  "Sécuriser une part de la position (ex. 50 %) à un prix donné — le R final en tient compte.":
    "Bank part of the position (e.g. 50%) at a given price — the final R accounts for it.",
  "Trader cette position": "Trade this position",
  "Trader ce calcul": "Trade this calculation",
  "Voir le tracker": "View tracker",
  "Marqué comme tradé": "Marked as traded",
  "Position déjà envoyée au tracker — cliquer pour retirer la marque.":
    "Position already sent to the tracker — click to clear the mark.",
  "Envoie la position au tracker live et la marque comme tradée.":
    "Sends the position to the live tracker and marks it as traded.",
  "Envoie la position au tracker live : l’heure d’entrée exacte est capturée, il ne restera qu’à la clôturer en gagnante ou perdante.":
    "Sends the position to the live tracker: the exact entry time is captured, all that’s left is to close it as a win or a loss.",
  "Recharger ce calcul": "Reload this calculation",
  "Repose ses valeurs dans le calculateur pour l’ajuster.":
    "Puts its values back in the calculator so you can adjust them.",
  "Supprimer de l’historique": "Delete from history",
  "historique des calculs": "calculation history",

  // ── Sizing / position ─────────────────────────────────────────────────────
  "Capital ({dev})": "Capital ({dev})",
  "Risque (%)": "Risk (%)",
  "Risque %": "Risk %",
  "risque": "risk",
  "Paire": "Pair",
  "Sens": "Direction",
  "Position longue (achat)": "Long position (buy)",
  "Position courte (vente)": "Short position (sell)",
  "Take Profit (optionnel)": "Take profit (optional)",
  "Spread (pips, optionnel)": "Spread (pips, optional)",
  "Spread inclus": "Spread included",
  "mini lots": "mini lots",
  "micro lots": "micro lots",
  "unités": "units",
  "cible {montant}": "target {montant}",
  "distance SL": "SL distance",
  "gain potentiel": "potential gain",
  "{montant} risqués": "{montant} at risk",
  "capital {montant}": "capital {montant}",
  "Seuil d'alerte risque (%)": "Risk alert threshold (%)",
  "aucune": "none",
  "défaut {valeur} {dev}/lot": "default {valeur} {dev}/lot",
  "override ({valeur})": "override ({valeur})",
  "tradé": "traded",
  "Aucun calcul enregistré pour l'instant. Chaque calcul valide est historisé automatiquement.":
    "No calculation saved yet. Every valid calculation is logged automatically.",
  "Ajuste la valeur d'un pip par lot standard pour coller à la convention exacte de ton broker / prop firm (ex. XAU/USD : 1 $ ou 10 $ selon la définition du pip). Laisse vide pour garder la valeur par défaut.":
    "Adjust the pip value per standard lot to match your broker or prop firm’s exact convention (e.g. XAU/USD: $1 or $10 depending on how the pip is defined). Leave blank to keep the default.",
  "taille de position": "position size",
  "taille recommandée": "recommended size",
  "Prix d'entrée": "Entry price",
  "Prix du stop-loss": "Stop-loss price",
  "entre entrée + stop": "between entry + stop",
  "risqué réel": "actual risk",
  "Devise du compte": "Account currency",
  "Capital par défaut": "Default capital",
  "Risque par défaut (%)": "Default risk (%)",
  "Limite de lots (prop firm, optionnel)": "Lot cap (prop firm, optional)",
  "valeur du pip par paire": "pip value per pair",
  "valeurs par défaut": "defaults",
  "Enregistrer les réglages": "Save settings",
  "réglages enregistrés": "settings saved",
  "Capital, risque par défaut, limites prop firm et paires personnalisées.":
    "Capital, default risk, prop firm limits and custom pairs.",
  "Capital, risque par défaut, seuils d’alerte et paires personnalisées.":
    "Capital, default risk, alert thresholds and custom pairs.",
  "Taille de position, risque en devise et R:R à partir de l’entrée et du stop.":
    "Position size, currency risk and R:R from your entry and stop.",
  "Détermine de quel côté du prix d’entrée se place le stop.":
    "Determines which side of the entry price the stop sits on.",
  "Ajoute le spread à la distance du stop pour un risque conservateur":
    "Adds the spread to the stop distance for a conservative risk",
  "Spread ignoré": "Spread ignored",
  "Renseigne les champs pour obtenir la taille de position.":
    "Fill in the fields to get your position size.",
  "Sélectionne une paire.": "Select a pair.",
  "Capital invalide — saisis un montant positif.":
    "Invalid capital — enter a positive amount.",
  "Risque invalide — saisis un pourcentage positif.":
    "Invalid risk — enter a positive percentage.",
  "Risque supérieur à 100 % — impossible.": "Risk above 100% — not possible.",
  "Prix d'entrée invalide.": "Invalid entry price.",
  "Prix du stop-loss invalide.": "Invalid stop-loss price.",
  "Stop-loss invalide : identique au prix d'entrée.":
    "Invalid stop-loss: same as the entry price.",
  "Pour un long, le stop-loss devrait être sous le prix d'entrée.":
    "For a long, the stop-loss should sit below the entry price.",
  "Pour un short, le stop-loss devrait être au-dessus du prix d'entrée.":
    "For a short, the stop-loss should sit above the entry price.",
  "TP incohérent": "Inconsistent TP",
  "Ouvrir le compte prop firm": "Open the prop firm account",

  // ── Market Brain ──────────────────────────────────────────────────────────
  "Flash marché": "Market flash",
  "FLASH — lecture express (démo)": "FLASH — quick read (demo)",
  "Fermer le flash": "Close flash",
  "Fermer le briefing": "Close briefing",
  "Générer le briefing maintenant": "Generate the briefing now",
  "Génération du briefing…": "Generating briefing…",
  "génération…": "generating…",
  "Régénérer": "Regenerate",
  "Régénérer le briefing": "Regenerate briefing",
  "Générer maintenant": "Generate now",
  "Relance l'analyse complète avec les données du moment et remplace le briefing de la session.":
    "Reruns the full analysis with current data and replaces this session’s briefing.",
  "Lecture ponctuelle de la séance en cours, à la demande. N'écrase pas le briefing du jour et n'est pas enregistrée.":
    "A one-off read of the current session, on demand. It doesn’t overwrite the daily briefing and isn’t saved.",
  "La lecture intra-séance n’est pas enregistrée : elle disparaît définitivement.":
    "The intraday read isn’t saved: it disappears for good.",
  "Retire le badge de la sidebar : le briefing reste consultable ici.":
    "Clears the sidebar badge: the briefing stays available here.",
  "En un coup d'œil": "At a glance",
  "thème du jour": "theme of the day",
  "Thème du jour": "Theme of the day",
  "Niveaux à surveiller": "Levels to watch",
  "Degré de confiance de l’analyse sur ce scénario.":
    "How confident the analysis is in this scenario.",
  "Indisponible : marché fermé — le briefing reprendra à la réouverture.":
    "Unavailable: market closed — the briefing resumes when it reopens.",
  "Indisponible : marché fermé — une lecture intra-séance n'a pas d'objet le week-end.":
    "Unavailable: market closed — an intraday read serves no purpose at the weekend.",
  "Marché fermé le week-end.": "Market closed for the weekend.",
  "Marché ouvert, entre deux sessions majeures (rollover).":
    "Market open, between two major sessions (rollover).",
  "reprise lundi à l'ouverture": "reopens Monday at the open",
  "Aucune clé LLM. Ajoute une clé Gemini ou Groq dans Réglages → market-brain.":
    "No LLM key. Add a Gemini or Groq key in Settings → market brain.",
  "Réponse Gemini vide.": "Empty Gemini response.",
  "Réponse Groq vide.": "Empty Groq response.",
  "Réponse LLM invalide : 'instruments' manquant.":
    "Invalid LLM response: 'instruments' missing.",
  "Données de marché indisponibles (réseau ?) — briefing annulé pour ne pas analyser des données de démo.":
    "Market data unavailable (network?) — briefing cancelled to avoid analysing demo data.",
  "pré-Londres": "pre-London",
  "pré-NY": "pre-NY",
  "Appétit pour le risque": "Risk appetite",
  "Aversion au risque": "Risk aversion",
  "DXY en hausse (taux US soutenus) : pression baissière alignée sur EUR/USD, GBP/USD et Or.":
    "DXY rising (firm US rates): bearish pressure aligned across EUR/USD, GBP/USD and Gold.",
  "DXY en baisse (taux US mous) : soutien haussier aligné sur EUR/USD, GBP/USD et Or.":
    "DXY falling (soft US rates): bullish support aligned across EUR/USD, GBP/USD and Gold.",
  "Risk-off (VIX en hausse / futures S&P sous pression) : fuite vers les refuges (USD/Or), pression sur NAS100 et BTC.":
    "Risk-off (VIX rising / S&P futures under pressure): flight to safety (USD/Gold), pressure on NAS100 and BTC.",
  "Risk-on (futures S&P en hausse, VIX qui se détend) : soutien pour NAS100 et BTC.":
    "Risk-on (S&P futures rising, VIX easing): supportive for NAS100 and BTC.",
  "Voici les données de marché horodatées à interpréter.":
    "Here is the time-stamped market data to interpret.",
  // Valeurs d'énumération du briefing : stockées en français (contrat avec le
  // LLM et la validation), traduites uniquement à l'affichage.
  "haussier": "bullish",
  "baissier": "bearish",
  "neutre": "neutral",
  "faible": "low",
  "moyenne": "medium",
  "forte": "high",
  "Biais {bias} · aller à la carte de l’instrument":
    "{bias} bias · jump to the instrument card",
  "Conviction {level}": "{level} conviction",
  "Session {session}": "{session} session",
  "généré à {time}": "generated at {time}",
  "Marché fermé — {reprise}.": "Market closed — {reprise}.",
  "Forex et indices en pause le week-end · le":
    "Forex and indices pause at the weekend ·",
  "BTC reste ouvert 24/7": "BTC stays open 24/7",
  "Briefing de démonstration (hors app native). L'analyse réelle tourne dans l'app reconstruite.":
    "Demo briefing (outside the native app). The real analysis runs in the rebuilt app.",
  "Données réelles indisponibles (tous les fetchers ont échoué) : affichage de données de démonstration. Vérifie la connexion puis régénère.":
    "Live data unavailable (every fetcher failed): showing demo data instead. Check your connection, then regenerate.",
  "{n} source en échec": "{n} source failed",
  "{n} sources en échec": "{n} sources failed",
  "Ajoute une clé Gemini ou Groq dans": "Add a Gemini or Groq key in",
  "pour générer le briefing automatiquement à {h}h.":
    "to generate the briefing automatically at {h}:00.",
  "Le briefing {session} sera généré automatiquement à {h}h (ou au premier lancement après cette heure).":
    "The {session} briefing will be generated automatically at {h}:00 (or at first launch after that time).",

  // ── Réglages ──────────────────────────────────────────────────────────────
  "market-brain — clés IA": "market brain — AI keys",
  "clé Gemini (Google AI Studio)": "Gemini key (Google AI Studio)",
  "clé Groq (console.groq.com)": "Groq key (console.groq.com)",
  "Enregistrer les clés": "Save keys",
  "Enregistré": "Saved",
  "Choisis le thème de l'interface. « Système » suit le réglage de l'appareil.":
    "Choose the interface theme. “System” follows your device setting.",
  "langue": "language",
  "Langue de l'interface": "Interface language",
  "« Système » suit la langue de l'appareil. Le changement s'applique immédiatement, partout dans l'app.":
    "“System” follows your device language. The change applies immediately, everywhere in the app.",
  "Français": "French",
  "Anglais": "English",
  "La langue des briefings du Market-Brain suit ce réglage.":
    "Market Brain briefings follow this setting.",
  "Copie propre et complète de la base (tâches, notes, trades…) dans un fichier unique.":
    "A clean, complete copy of your database (tasks, notes, trades…) in a single file.",
  "Copie propre et complète de la base (tâches, notes, objectifs…) dans un fichier unique.":
    "A clean, complete copy of your database (tasks, notes, goals…) in a single file.",
  "Exporter une sauvegarde…": "Export a backup…",
  "Sauvegarde exportée": "Backup exported",
  "export disponible dans l'app native": "export available in the native app only",
  "Disponible dans l'app native.": "Available in the native app only.",
  "Disponible dans l'app native uniquement.": "Available in the native app only.",
  "Activer les notifications": "Turn notifications on",
  "Coupe tout : plus aucune évaluation, plus aucun rappel.":
    "Turns everything off: no evaluation, no reminders.",
  "Envoyer une notification de test": "Send a test notification",
  "Envoyer un test": "Send a test",
  "Emprunte exactement le même chemin qu'un vrai rappel.":
    "Takes exactly the same path as a real reminder.",
  "Si le test n'affiche aucune bannière, autorise Shale dans Réglages iOS → Notifications. La cloche, elle, reçoit les rappels dans tous les cas.":
    "If the test shows no banner, allow Shale in iOS Settings → Notifications. The bell receives reminders either way.",
  "Rappels programmés": "Scheduled reminders",
  "aujourd'hui à {time}": "today at {time}",
  "demain à {time}": "tomorrow at {time}",
  "Notifications refusées au niveau du système. Rien ne peut être programmé tant que ce n'est pas changé dans les réglages du téléphone.":
    "Notifications are denied at the system level. Nothing can be scheduled until that changes in the phone\u2019s settings.",
  "Rien à signaler pour l'instant — c'est le cas normal quand tout est à jour.":
    "Nothing to flag right now — that\u2019s the normal case when everything is up to date.",
  "Déposés auprès d'iOS": "Handed to iOS",
  "Test envoyé. Aucune bannière ? Autorise Shale dans Réglages iOS → Notifications — il est déjà dans la cloche, lui.":
    "Test sent. No banner? Allow Shale in iOS Settings → Notifications — it’s already in the in-app bell either way.",
  "Test envoyé. Aucune bannière ? Autorise Shale dans Réglages macOS → Notifications — il est déjà dans la cloche, lui.":
    "Test sent. No banner? Allow Shale in macOS Settings → Notifications — it’s already in the in-app bell either way.",
  "Si le test n'affiche aucune bannière, autorise Shale dans Réglages macOS → Notifications. macOS ne nous le signale pas : la cloche de la barre latérale, elle, reçoit les rappels dans tous les cas.":
    "If the test shows no banner, allow Shale in macOS Settings → Notifications. macOS never tells us it was refused — the sidebar bell receives reminders either way.",
  "Évaluer les règles maintenant": "Evaluate the rules now",
  "Évaluer maintenant": "Evaluate now",
  "Sans attendre le prochain passage du planificateur.":
    "Without waiting for the scheduler’s next pass.",
  "Sans attendre l’heure de déclenchement automatique.":
    "Without waiting for the automatic trigger time.",
  "Les rappels déjà envoyés aujourd'hui pourront repartir":
    "Reminders already sent today may fire again",
  "Garder Shale actif en arrière-plan": "Keep Shale running in the background",
  "Fermer la fenêtre laisse Shale dans la barre de menus, seul moyen qu'un rappel parte fenêtre fermée. En plein écran, fermer quitte toujours l'app.":
    "Closing the window leaves Shale in the menu bar — the only way a reminder can fire with the window closed. In full screen, closing always quits the app.",
  "Mode démo : le planificateur et les notifications système n'existent que dans l'app native. Les réglages ci-dessus restent manipulables, mais ne sont pas enregistrés.":
    "Demo mode: the scheduler and system notifications only exist in the native app. The settings above stay usable, but aren’t saved.",
  "heure de l'alerte": "alert time",
  "heure du rappel": "reminder time",
  "Rappels d'habitudes, savoir délaissé, série en danger":
    "Habit reminders, neglected knowledge, streak at risk",
  "Règle ajoutée par une version plus récente.": "Rule added by a newer version.",
  "Affiche « BE » dans le tracker pour clôturer à 0R le restant de la position (les sorties partielles déjà prises restent comptées).":
    "Shows “BE” in the tracker to close the remaining size at 0R (partials already taken still count).",
  "Bascule automatiquement sur la vue Trading dès qu'une position est envoyée.":
    "Switches to the Trading view automatically as soon as a position is sent.",
  "Ne plus demander — envoyer directement (mode fast-track)":
    "Don’t ask again — send straight through (fast-track)",
  "Se déconnecter": "Sign out",
  "Accès complet": "Full access",
  // ── Inscription et mot de passe (écran de connexion + Réglages → compte) ──
  "Créer mon compte": "Create my account",
  "Création…": "Creating…",
  "Création de compte impossible.": "Could not create the account.",
  "Déjà un compte ?": "Already have an account?",
  "Confirme le mot de passe": "Confirm password",
  "Le mot de passe doit faire au moins 6 caractères.":
    "Password must be at least 6 characters.",
  "Les deux mots de passe ne correspondent pas.": "The two passwords do not match.",
  "Compte créé. Clique le lien envoyé par e-mail, puis reviens te connecter.":
    "Account created. Click the link we emailed you, then come back and sign in.",
  "Changer mon mot de passe": "Change my password",
  "Politique de confidentialité": "Privacy policy",
  "Nouveau mot de passe": "New password",
  "Enregistrement…": "Saving…",
  "Enregistrement impossible": "Could not save",
  "Mot de passe modifié.": "Password changed.",
  "Modification impossible.": "Could not save the change.",
  "Connecté en tant que": "Signed in as",
  "Compte actif": "Active account",
  "Ce compte n'est pas encore activé.": "This account is not activated yet.",
  "Aucun abonnement actif n'est associé à ce compte.": "No active subscription is linked to this account.",
  "Gérer mon abonnement": "Manage my subscription",
  "mode démo": "demo mode",

  // ── Personnaliser (admin UI) ──────────────────────────────────────────────
  "l'app, à ta main": "the app, your way",
  "Sous-titre (vide = masqué)": "Subtitle (empty = hidden)",
  "fenêtre & densité": "window & density",
  "densité": "density",
  "Screenshot : app native uniquement": "Screenshot: native app only",
  "modules": "modules",
  "colonne gauche": "left column",
  "colonne droite": "right column",
  "groupe 1": "group 1",
  "groupe 2": "group 2",
  "Sur téléphone, tout s'empile en une seule colonne : les deux groupes s'y alternent.":
    "On a phone everything stacks into a single column: the two groups alternate.",
  "Densité de l'interface": "Interface density",
  "Agrandi de {pct} % en plus, d’après la taille de texte de ton système.":
    "Scaled up a further {pct}% to match your system text size.",
  "Agrandit ou resserre toute l’interface.": "Expands or tightens the whole interface.",
  "Mémoriser la taille actuelle": "Remember current size",
  "La fenêtre s’ouvrira à cette taille aux prochains lancements.":
    "The window will open at this size next time.",
  "Taille actuelle mémorisée.": "Current size remembered.",
  "Taille appliquée.": "Size applied.",
  "Redimensionne la fenêtre à ces valeurs, sans attendre le prochain lancement.":
    "Resizes the window to these values, without waiting for the next launch.",
  "Aucune taille imposée au lancement (la fenêtre garde sa taille).":
    "No size forced at launch (the window keeps its size).",
  "Ne plus gérer la taille": "Stop managing size",
  "Ne plus gérer": "Stop managing",
  "macOS reprend la main sur la taille de la fenêtre.":
    "macOS takes back control of the window size.",
  "modules de la sidebar": "sidebar modules",
  "Un élément masqué reste configurable ici.": "A hidden item stays configurable here.",
  "Choisis les blocs affichés sur l'écran d'accueil et leur ordre.":
    "Choose which blocks appear on the home screen, and in what order.",
  "Calculateur de position (widget)": "Position calculator (widget)",
  "Bandeau performance (streak, focus, trading)":
    "Performance strip (streak, focus, trading)",
  "Anneau discipline": "Discipline ring",
  "Timer rapide": "Quick timer",
  "Liens rapides": "Quick links",
  "Objectifs en cours": "Goals in progress",

  // ── Grille redimensionnable ───────────────────────────────────────────────
  "Ouvrir la vue complète": "Open the full view",
  "Affiche ce module en pleine page, avec tous ses réglages.":
    "Shows this module full-page, with all its settings.",
  "Déplacer le panneau": "Move panel",
  "Glisser pour réordonner les panneaux de la vue.":
    "Drag to reorder the panels in this view.",
  "Réinitialiser la taille": "Reset size",
  "Réinitialiser la taille du panneau": "Reset panel size",
  "Rend au panneau sa largeur et sa hauteur d’origine.":
    "Restores the panel’s original width and height.",
  "Le panneau reprend sa place et sa taille dans la grille.":
    "The panel returns to its place and size in the grid.",
  "Il réapparaît en pastille sous la grille, pour le restaurer d’un clic.":
    "It reappears as a chip below the grid, one click away from being restored.",
  "Réafficher ce panneau": "Show this panel again",
  "Glisser pour ajuster · double-clic : revenir à la hauteur automatique.":
    "Drag to adjust · double-click to return to automatic height.",
  "masqués": "hidden",
  "ResizablePanel doit être dans <ResizableGrid>":
    "ResizablePanel must be inside <ResizableGrid>",

  // ── Liens rapides ─────────────────────────────────────────────────────────
  "Ajouter un lien rapide": "Add a quick link",
  "Supprimer ce lien": "Delete this link",
  "S’ouvre dans le navigateur par défaut, d’un seul clic depuis le tableau de bord.":
    "Opens in your default browser, one click from the dashboard.",

  // ── Auth / abonnement / onboarding ────────────────────────────────────────
  "Mot de passe": "Password",
  "Mot de passe oublié ?": "Forgot your password?",
  "Rester connecté": "Stay signed in",
  "Créer un compte": "Create an account",
  "Renseigne ton e-mail et ton mot de passe.": "Enter your email and password.",
  "Entre ton e-mail d'abord, puis appuie sur « Mot de passe oublié ».":
    "Enter your email first, then tap or click “Forgot your password?”.",
  "E-mail de réinitialisation envoyé. Vérifie ta boîte de réception.":
    "Reset email sent. Check your inbox.",
  "Vérification de l'abonnement impossible.": "Couldn’t verify your subscription.",
  "Connexion impossible.": "Couldn’t sign in.",
  "Envoi impossible.": "Couldn’t send the email.",
  "Connexion…": "Signing in…",
  "Se connecter": "Sign in",
  "Pas encore de compte ?": "No account yet?",
  "toi@exemple.com": "you@example.com",
  "Masquer": "Hide",
  "Afficher": "Show",
  "Mode démo — auth non configurée (voir src/lib/auth/config.ts). N'importe quel identifiant déverrouille l'app.":
    "Demo mode — authentication isn’t configured (see src/lib/auth/config.ts). Any credentials will unlock the app.",
  "Connecte-toi pour accéder à ton espace.": "Sign in to reach your workspace.",
  "Bienvenue dans Shale": "Welcome to Shale",
  "Ton poste de commande de trader : discipline, journal, sizing et briefing marché réunis. Voici l'essentiel en trois écrans.":
    "Your trading command post: discipline, journal, sizing and market briefing in one place. Here are the essentials in three screens.",
  "Calcule ta taille de position, envoie-la au tracker live, dénoue en un clic. Ton journal en R se remplit tout seul et calcule tes stats.":
    "Work out your position size, send it to the live tracker, close it in one click. Your R-based journal fills itself in and computes your stats.",
  "Le Market-Brain te prépare un briefing deux fois par jour ; la jauge de discipline et les objectifs te gardent dans ta zone de décision.":
    "Market Brain prepares a briefing twice a day; the discipline gauge and your goals keep you in your decision zone.",
  "Ton compte n'a pas d'abonnement actif. Souscris sur le site pour débloquer Shale.":
    "Your account has no active subscription. Subscribe on the website to unlock Shale.",
  "Ton essai est terminé": "Your trial has ended",
  "Essai terminé": "Trial ended",
  "Abonnement résilié": "Subscription cancelled",
  "Aucun abonnement": "No subscription",
  "Impayé": "Unpaid",
  "Résilié": "Cancelled",
  "Réactiver": "Reactivate",
  "Choisir ma formule": "Choose my plan",
  "J'ai souscrit — revérifier": "I’ve subscribed — check again",
  "politique de confidentialité": "privacy policy",
  "useSession doit être utilisé dans <AuthGate>":
    "useSession must be used inside <AuthGate>",
  "initialisation des systèmes": "initialising systems",
  "systèmes actifs": "systems online",

  // ── Notifications ─────────────────────────────────────────────────────────
  "Centre de notifications": "Notification centre",
  "Aucune notification.": "No notifications.",
  "Les rappels apparaîtront ici, même si tu as coupé les bannières macOS.":
    "Reminders show up here even if you’ve turned macOS banners off.",
  // Variante neutre du portage Windows : la phrase macOS ci-dessus a été
  // reformulée en « du système » pour ne pas mentir sur une machine Windows,
  // mais sa traduction n'avait pas suivi — la page anglaise retombait en
  // français sans rien signaler. Les deux clés coexistent : chaque branche
  // n'utilise que la sienne.
  "Les rappels apparaîtront ici, même si tu as coupé les bannières du système.":
    "Reminders show up here even if you’ve turned system banners off.",
  "Supprimer cette notification": "Delete this notification",
  "Série en danger": "Streak at risk",
  "En fin de journée, si une série en cours — habitudes ou tâches — risque d'être rompue.":
    "At the end of the day, if a running streak — habits or tasks — is about to break.",
  "Habitudes non cochées": "Habits not checked",
  "Le soir, si des habitudes du jour attendent encore d'être cochées.":
    "In the evening, if today’s habits are still waiting to be checked.",
  "Savoir délaissé": "Knowledge neglected",
  "Après plusieurs jours sans ouvrir une fiche du Savoir.":
    "After several days without opening a Knowledge note.",

  // ── Sessions de marché ────────────────────────────────────────────────────
  "Sydney": "Sydney",
  "Tokyo": "Tokyo",
  "Londres": "London",
  "New York": "New York",
  "marché fermé": "market closed",
  "entre sessions": "between sessions",
  "session {names}": "{names} session",
  "reprise {day} à {time}": "reopens {day} at {time}",
  "Chevauchement de sessions : {names} — liquidité maximale.":
    "Session overlap: {names} — peak liquidity.",
  "Session {names} active (heures locales des places converties à ton fuseau).":
    "{names} session open (each venue’s local hours converted to your time zone).",
  "Forex et indices fermés le week-end — {reopen} (heure locale). Le BTC reste ouvert 24/7.":
    "Forex and indices closed for the weekend — {reopen} (local time). BTC stays open 24/7.",

  // ── Chaînes à variables ───────────────────────────────────────────────────
  "Tâche « {label} » ajoutée": "Task “{label}” added",
  "« {label} » cochée ✓": "“{label}” checked ✓",
  "Aucune tâche du jour ne correspond à « {q} »":
    "No task due today matches “{q}”",
  "Aucune métrique ne correspond à « {q} »": "No metric matches “{q}”",
  "Priorité {p}": "{p} priority",
  "Rattachée à l'objectif « {title} »": "Linked to the goal “{title}”",
  "Objectif : {title}": "Goal: {title}",
  "Focus sur {label}": "Focus on {label}",
  "Ouvrir « {label} »": "Open “{label}”",
  "Supprimer {label}": "Delete {label}",
  "Supprimer {name}": "Delete {name}",
  "Confirmer la suppression de {label}": "Confirm deletion of {label}",
  "Confirmer la suppression de {name}": "Confirm deletion of {name}",
  "Valeur du jour pour {name}": "Today’s value for {name}",
  "en retard de {n} j": "{n} d overdue",
  "Supprimer le tag « {name} »": "Delete the tag “{name}”",
  "Supprimer le tag {name}": "Delete the tag {name}",
  "Retirer le tag {tag}": "Remove the tag {tag}",
  "Tag « {tag} »": "Tag “{tag}”",
  "Couleur de texte {name}": "{name} text colour",
  "Énergie {v}/5": "Energy {v}/5",
  "Revue — semaine du {date}": "Review — week of {date}",
  "- Complétion moyenne : {avg} %": "- Average completion: {avg}%",
  "- Temps de focus : {time}": "- Focus time: {time}",
  "{pair} {direction} envoyée au tracker": "{pair} {direction} sent to the tracker",
  "{pair} archivée : {r}": "{pair} archived: {r}",
  "fermé à {px}": "closed at {px}",
  "Tracker — entrée {px}": "Tracker — entry {px}",
  "{r} / trade": "{r} / trade",
  "{work} min sur « {label} ». Pause de {pause} min.":
    "{work} min on “{label}”. {pause} min break.",
  "{work} minutes sur « {label} ». Bien joué.":
    "{work} minutes on “{label}”. Nicely done.",
  "pause auto ({n} min) après la session": "auto-break ({n} min) after the session",
  "à {time}": "at {time}",
  "hier à {time}": "yesterday at {time}",
  "Densité {label} — {z} %": "{label} density — {z}%",
  "Appliquée à chaque lancement : {w} × {h}.": "Applied at every launch: {w} × {h}.",
  "Contrôle tes réflexes (alerte si +{pct} % vs ta moyenne).":
    "Checks your reflexes (alert if +{pct}% vs your average).",
  "Aucun résultat en {test} — lance le test pour démarrer la courbe.":
    "No {test} result yet — run the test to start the curve.",
  "Tendance {test}": "{test} trend",
  "{pair} n'est pas cotée en USD : vérifie la valeur du pip manuellement (conversion de devise requise).":
    "{pair} isn’t quoted in USD: check the pip value manually (currency conversion required).",
  "Renseigne la valeur du pip pour {pair} dans les réglages.":
    "Set the pip value for {pair} in the settings.",
  "Taille de pip invalide pour {pair}.": "Invalid pip size for {pair}.",
  "Taille calculée ({lots} lots) sous le minimum tradable ({min}). Augmente le risque ou resserre le stop-loss.":
    "Calculated size ({lots} lots) is below the minimum tradable size ({min}). Increase the risk or tighten the stop-loss.",
  "Requête bloquée par Gemini : {reason}": "Request blocked by Gemini: {reason}",

  // ── Timer : objectif quotidien ────────────────────────────────────────────
  "Méthode": "Method",
  "Objectif quotidien": "Daily goal",
  "Objectif de temps concentré pour la journée.": "Focus-time target for the day.",
  "Plus 30 minutes d'objectif": "Add 30 minutes to the target",
  "objectif atteint": "target reached",
  "moyenne / jour": "average / day",

  // ── Réglages / personnaliser (compléments) ────────────────────────────────
  "apparence": "appearance",
  "Clair": "Light",
  "Sombre": "Dark",
  "Suit l’apparence de macOS, jour et nuit.": "Follows macOS appearance, day and night.",
  "Palette claire « Alabaster », en toutes circonstances.":
    "The light “Alabaster” palette, in all circumstances.",
  "Palette sombre « Obsidian », en toutes circonstances.":
    "The dark “Obsidian” palette, in all circumstances.",
  "Suit la langue de macOS ; anglais si elle n'est ni française ni anglaise.":
    "Follows your macOS language; falls back to English if it’s neither French nor English.",
  "Le bouton": "The button",
  "Tout réinitialiser": "Reset everything",
  "Rétablit l’ordre, la visibilité, les libellés, la densité et l’identité d’origine.":
    "Restores the original order, visibility, labels, density and identity.",
  "Masquer le panneau": "Hide panel",
  "Fermer sans enregistrer": "Close without saving",
  "Masque les outils : plus que le texte, dans une mesure de lecture confortable.":
    "Hides the tools: nothing but the text, at a comfortable reading width.",
  "Un second clic la supprime définitivement.":
    "A second click deletes it for good.",
  "Réglages → market-brain": "Settings → market brain",

  // ── Console d'administration ──────────────────────────────────────────────
  "Abonnés actifs": "Active subscribers",
  "mensuel": "monthly",
  "annuel": "annual",
  // Dates du tableau de démonstration (jeu figé, pas de vraie date à formater)
  "12 janv.": "12 Jan",
  "3 févr.": "3 Feb",
  "21 févr.": "21 Feb",
  "24 juil.": "24 Jul",
  "9 mars": "9 Mar",
  "14 avr.": "14 Apr",
  "6 juin": "6 Jun",
  "2 mai": "2 May",
  "22 juil.": "22 Jul",
  "Aucun utilisateur.": "No users.",
  "Rechercher un e-mail…": "Search for an email…",
  "Données de démonstration (mode démo). En production, elles viennent de Supabase + Stripe.":
    "Demonstration data (demo mode). In production it comes from Supabase + Stripe.",
  "Astuce : branche cette console sur la table Supabase « subscriptions » (session admin / RLS) pour des données réelles.":
    "Tip: point this console at the Supabase “subscriptions” table (admin session / RLS) for real data.",

  // ── Fin d'essai (écran abonnement) ────────────────────────────────────────
  "Les sept jours sont passés. L'app est en lecture seule : ton historique reste":
    "The seven days are up. The app is read-only: your history is still",
  "lisible et exportable, rien n'a été supprimé. Un abonnement rouvre tout,":
    "readable and exportable, nothing has been deleted. A subscription reopens everything,",
  "exactement là où tu t'es arrêté.": "exactly where you left off.",
  "Il te reste 2 habitudes à cocher aujourd'hui (Sport, Lecture).":
    "You still have 2 habits to check off today (Exercise, Reading).",
  "4 jours sans ouvrir une fiche. Deux minutes suffisent pour reprendre le fil.":
    "4 days without opening a note. Two minutes are enough to pick the thread back up.",

  // ── Jeu de démonstration (mode démo / captures du site) ───────────────────
  // Le jeu est construit au chargement du module : en mode démo, changer de
  // langue recharge la fenêtre (cf. SettingsView::changeLang).
  // ⚠️ Réécrit le 2026-09-30 (trading mis de côté) : le jeu était celui d'un
  // trader, et il alimente les captures du site. C'est désormais celui d'un
  // indépendant (design), cohérent avec « Tenez votre activité » du site.
  "Prospection 1 h": "Prospecting, 1 h",
  "Production client (matin)": "Client work (morning)",
  "Publier un post LinkedIn": "Publish a LinkedIn post",
  "Réviser un module de la certification": "Study a certification module",
  "Présenter les maquettes au client": "Present the mockups to the client",
  "Envoyer le devis à Studio Hélice": "Send the quote to Studio Hélice",
  "Mettre à jour le portfolio": "Update the portfolio",
  "Clients": "Clients",
  "Contenu": "Content",
  "Formation": "Learning",
  "Activité": "Business",
  "Vivre de mon activité d'indépendant": "Make a living as a freelancer",
  "100 % du revenu en freelance d'ici septembre": "100% of income from freelancing by September",
  "5 000 abonnés LinkedIn": "5,000 LinkedIn followers",
  "Valider la certification UX": "Pass the UX certification",
  "Signer deux clients récurrents": "Sign two recurring clients",
  "Heures facturées": "Billed hours",
  "Appels clients": "Client calls",
  "appels": "calls",
  "Posts publiés": "Posts published",
  "Méditation": "Meditation",
  "Sport": "Exercise",
  "Lecture": "Reading",
  "Méthode de devis": "Quote method",
  "Tarifs 2026": "2026 rates",
  "Idées de posts": "Post ideas",
  "Structure d'un devis :\n- le contexte et le besoin du client\n- les livrables, en trois lignes au plus\n- le planning et les jalons\n- le prix, avec 30 % d'acompte\n\nVoir aussi [[Tarifs 2026]] pour les montants.":
    "How a quote is built:\n- the client’s context and need\n- the deliverables, in three lines at most\n- the schedule and milestones\n- the price, with a 30% deposit\n\nSee also [[2026 rates]] for the amounts.",
  "Jour : 450 €. Demi-journée : 250 €. Audit UX : forfait de 1 200 €.\n\nRappel : on ne négocie pas le prix, on négocie le périmètre. [[Méthode de devis]]":
    "Day: €450. Half day: €250. UX audit: €1,200 flat fee.\n\nReminder: don’t negotiate the price, negotiate the scope. [[Quote method]]",
  "- 3 erreurs sur un premier devis\n- Avant / après d'une refonte\n- Ce qu'un brief clair change au planning":
    "- 3 mistakes on a first quote\n- Before / after a redesign\n- What a clear brief changes to the schedule",
  "Architecture": "Architecture",
  "Refonte du site vitrine": "Showcase website redesign",
  "Anatomie d'un bon brief": "Anatomy of a good brief",
  "Les 3 questions": "The 3 questions",
  "Quel problème le client veut-il régler ?": "What problem does the client want solved?",
  "Qui décide, et <b>avant quelle date</b> ?": "Who decides, and <b>by what date</b>?",
  "Qui décide, et avant quelle date ?": "Who decides, and by what date?",
  "À quoi verra-t-on que c'est réussi ?": "How will we know it worked?",
  "S'il manque une réponse : on rappelle avant de chiffrer. Un devis sur un brief flou coûte plus cher qu'un appel de plus.":
    "If an answer is missing: call back before pricing. A quote on a vague brief costs more than one more call.",
  "Schéma : déroulé d'une mission": "Diagram: how a project unfolds",
  "déroulé d'une mission": "how a project unfolds",
  "Le croquis de référence à revoir avant chaque premier rendez-vous.":
    "The reference sketch to review before every first meeting.",
  "Après un refus : le protocole": "After a rejection: the protocol",
  "1. Relire le devis à froid, le lendemain.": "1. Reread the quote with fresh eyes, the next day.",
  "2. Demander au client ce qui a pesé, sans se justifier.":
    "2. Ask the client what tipped the balance, without justifying yourself.",
  "3. Noter la leçon dans le journal.": "3. Write the lesson down in the journal.",
  "Un refus n'est pas un verdict sur ton travail, c'est une information sur le besoin.":
    "A rejection isn’t a verdict on your work, it’s information about the need.",
  "Déclarer son chiffre d'affaires": "Declaring your turnover",
  "Le portail officiel des déclarations de micro-entrepreneur :":
    "The official portal for micro-entrepreneur declarations:",
  "À ouvrir à chaque échéance, avant le dernier jour du mois.":
    "Open it at every deadline, before the last day of the month.",
  "Bonne journée de production, les maquettes avancent.":
    "Good production day, the mockups are coming along.",
  "Point hebdo client": "Weekly client check-in",
  "Clôture mensuelle des comptes": "Monthly accounts close",
  "Séminaire design": "Design seminar",
  "Secteur": "Sector",
  "Prospect": "Prospect",
  "Besoin": "Need",
  "TJM (€)": "Day rate (€)",

  // ── Market Brain : jeu de démonstration ───────────────────────────────────
  "Dollar fort — thème baissier aligné sur EUR/USD, GBP/USD et Or.":
    "Strong dollar — bearish theme aligned across EUR/USD, GBP/USD and Gold.",
  "Risk-off modéré : DXY et taux US en hausse, VIX qui se détend légèrement.":
    "Moderate risk-off: DXY and US yields rising, VIX easing slightly.",
  "Thème Dollar-fort du jour : privilégier les setups vendeurs sur les paires vs USD et l'Or. Ne rien initier autour de 14:30 (CPI). NAS100 en contre-tendance D1, taille prudente.":
    "Strong-dollar theme today: favour short setups on USD pairs and Gold. Open nothing around 14:30 (CPI). NAS100 is counter-trend on D1 — keep size modest.",
  "Sous 1.0889 (haut de nuit), vente sur pullback vers 1.0920 avec objectif 1.0850. CPI US 14:30 = catalyseur.":
    "Below 1.0889 (overnight high), sell the pullback towards 1.0920 targeting 1.0850. US CPI at 14:30 is the catalyst.",
  "Corrélé EUR/USD : range 1.2698–1.2781, biais vendeur tant que sous 1.2735. Attendre l'impulsion post-CPI.":
    "Correlated to EUR/USD: 1.2698–1.2781 range, bearish bias while below 1.2735. Wait for the post-CPI impulse.",
  "Taux réels en hausse : pression sur l'Or. Vente sous 2329, cible 2310. Refuge si le VIX repart.":
    "Real yields rising: pressure on Gold. Sell below 2329, target 2310. Safe haven if the VIX picks up again.",
  "La tech déteste les taux hauts : biais court sous 20260. Support 20090 clé. D1 reste haussier — prudence contre-tendance.":
    "Tech hates high rates: short bias below 20260. 20090 is the key support. D1 is still bullish — be careful counter-trend.",
  "Suit le NAS100 en risk-off. Sous 61800, test possible de 60800. Range large, taille réduite.":
    "Follows NAS100 in risk-off. Below 61800, a test of 60800 is possible. Wide range — cut the size.",

  // ── Offres & paywall (deux tiers, 2026-08-02) ─────────────────────────────
  "Inclus dans Shale Trade": "Included in Shale Trade",
  "Passer à Shale Trade": "Upgrade to Shale Trade",
  "{module} fait partie de Shale Trade.": "{module} is part of Shale Trade.",
  "Le cœur trading fait partie de Shale Trade.": "The trading core is part of Shale Trade.",
  "Ton offre Shale couvre toute la productivité. Shale Trade y ajoute les cinq modules que tu as utilisés pendant l'essai.":
    "Your Shale plan covers the whole productivity side. Shale Trade adds the five modules you used during the trial.",
  "Plus tard": "Later",
  "Le changement d'offre est immédiat, et tes données restent intactes.":
    "The switch takes effect immediately, and your data stays untouched.",
  "essai en cours": "trial running",
  "offre simulée (démo)": "simulated plan (demo)",
  // Argumentaire du paywall (lib/features.ts)
  "Market Brain": "Market Brain",
  "Un briefing cross-asset généré deux fois par jour : biais, scénario, niveaux clés et zones no-trade, avant Londres et avant New York.":
    "A cross-asset briefing generated twice a day: bias, scenario, key levels and no-trade windows, before London and before New York.",
  "Les positions ouvertes suivies en direct, avec leur R:R, leurs partielles et leur durée. Un clic pour dénouer, le journal se remplit tout seul.":
    "Open positions tracked live, with their R:R, partials and time in trade. One click to close them out, and the journal fills itself in.",
  "Journal de trades en R": "Trade journal in R",
  "Winrate, profit factor, drawdown maximal et performance par setup — raisonnés en R, jamais en euros.":
    "Win rate, profit factor, max drawdown and performance by setup — all reasoned in R, never in euros.",
  "Calculateur de position": "Position size calculator",
  "Taille de lot, risque et R:R théorique en une saisie, envoyés directement au tracker.":
    "Lot size, risk and theoretical R:R in a single entry, sent straight to the tracker.",
  "Performance trading": "Trading performance",
  "La courbe de R cumulé et le comparatif mensuel, à côté de tes courbes de discipline.":
    "The cumulative R curve and the monthly comparison, next to your discipline curves.",

  // ── Clé LLM : stockage ────────────────────────────────────────────────────
  "Tu fournis ta propre clé, gratuite chez les deux fournisseurs. Elle ne sert qu'à l'analyse du briefing et n'est jamais envoyée ailleurs.":
    "You supply your own key — free with both providers. It is only used to analyse the briefing and is never sent anywhere else.",
  "En mode Auto, si le quota Gemini est atteint (429), Market-Brain bascule automatiquement sur Groq.":
    "In Auto mode, if the Gemini quota is hit (429), Market-Brain switches to Groq automatically.",
  "Chiffrée dans le trousseau macOS.": "Encrypted in the macOS Keychain.",
  "Stockée dans la base locale de l'app, en clair (trousseau indisponible).":
    "Stored in the app's local database, in the clear (Keychain unavailable).",

  // ── Synchronisation chiffrée ──────────────────────────────────────────────
  // Registre volontairement sobre : ces phrases parlent de perte de données
  // possible. Ni dramatisation, ni euphémisme.
  "synchronisation chiffrée": "encrypted sync",
  "sync désactivée": "sync off",
  "sync verrouillée": "sync locked",
  "sync en échec": "sync failed",
  "synchronisation…": "syncing…",
  "synchronisé": "in sync",
  "hors ligne": "offline",
  "{n} en attente": "{n} pending",
  "Tout est à jour.": "Everything is up to date.",
  "Tout est synchronisé": "Everything is in sync",
  "{n} modification(s) en attente": "{n} change(s) pending",
  "dernier échange {when}": "last exchange {when}",
  "Dernier échange {when}.": "Last exchange {when}.",
  "aucun échange pour l'instant": "no exchange yet",

  "Tes données restent sur cet appareil. Active la synchronisation dans Réglages.":
    "Your data stays on this device. Turn on sync in Settings.",
  "Ton mot de passe est nécessaire pour déchiffrer tes données sur cet appareil.":
    "Your password is needed to decrypt your data on this device.",
  "Tes modifications sont conservées et partiront au retour du réseau.":
    "Your changes are kept and will be sent when the network is back.",
  "La dernière tentative a échoué. Une autre suivra automatiquement.":
    "The last attempt failed. Another one will follow automatically.",
  "Échange en cours avec le cloud.": "Exchanging with the cloud.",
  "Modifications pas encore envoyées. Elles partiront au prochain échange.":
    "Changes not sent yet. They will go out at the next exchange.",
  "Ouvrir les réglages de synchronisation": "Open sync settings",
  "Synchroniser maintenant": "Sync now",

  "Retrouve tes tâches, notes et trades sur tes autres appareils. Tout est chiffré sur cet appareil avant d'être envoyé : le serveur ne voit que des données illisibles.":
    "Find your tasks, notes and trades on your other devices. Everything is encrypted on this device before being sent: the server only ever sees unreadable data.",
  "ton mot de passe Shale": "your Shale password",
  "pour créer la clé de chiffrement": "to create the encryption key",
  "activation…": "turning on…",
  "Activer la synchronisation": "Turn on sync",
  "créer un code de récupération (recommandé)": "create a recovery code (recommended)",
  "Ton mot de passe déchiffre tes données. Si tu le perds, seul le code de récupération pourra les rouvrir.":
    "Your password decrypts your data. If you lose it, only the recovery code can open it again.",
  "Sans code de récupération, un mot de passe perdu rendra tes données du cloud DÉFINITIVEMENT illisibles — même pour nous. Tes données locales, elles, resteront intactes.":
    "Without a recovery code, a lost password makes your cloud data PERMANENTLY unreadable — even to us. Your local data stays intact.",

  "Tes données chiffrées sont dans le cloud. Ton mot de passe est nécessaire une fois, pour les rouvrir sur cet appareil.":
    "Your encrypted data is in the cloud. Your password is needed once, to open it on this device.",
  "ouverture…": "opening…",
  "Déverrouiller": "Unlock",
  "J'ai perdu mon mot de passe": "I lost my password",
  "Rouvrir avec le code": "Open with the code",
  "Revenir au mot de passe": "Back to password",

  "code de récupération": "recovery code",
  "Note ce code hors de cet appareil. Il est le SEUL moyen de retrouver tes données si tu oublies ton mot de passe — personne, pas même nous, ne peut les déchiffrer sans lui.":
    "Write this code down somewhere other than this device. It is the ONLY way to recover your data if you forget your password — nobody, not even us, can decrypt it without it.",
  "copier": "copy",
  "copié": "copied",
  "je l'ai noté en lieu sûr": "I have written it down somewhere safe",
  "Terminé": "Done",
  "Voir un nouveau code de récupération": "Show a new recovery code",
  "Un nouveau code annule et remplace le précédent.": "A new code cancels and replaces the previous one.",
  "Supprimer le code de récupération": "Delete the recovery code",
  "Le code déjà noté cessera de fonctionner.": "The code you wrote down will stop working.",

  "Le trousseau du système n'a pas répondu : la clé n'est gardée que le temps de cette session, et ton mot de passe sera redemandé au prochain lancement.":
    "The system Keychain did not respond: the key is only kept for this session, and your password will be asked again at the next launch.",
  "Oublier la clé sur cet appareil": "Forget the key on this device",
  "Tes données locales ne sont pas touchées ; la synchronisation s'arrête ici.":
    "Your local data is untouched; sync simply stops here.",
  "état simulé (démo)": "simulated state (demo)",

  // ── Indicateur : trois échecs qui ne se disent pas pareil ─────────────────
  "Le serveur n'a pas répondu. Une nouvelle tentative suivra automatiquement.":
    "The server did not respond. Another attempt will follow automatically.",
  "reconnexion requise": "sign in again",
  "Ta session a expiré. Reconnecte-toi pour que la synchronisation reprenne.":
    "Your session has expired. Sign in again to resume syncing.",

  // ── Activation, en quatre temps ───────────────────────────────────────────
  "Personne ne peut rouvrir tes données à ta place — ni le support, ni nous. C'est la contrepartie du chiffrement de bout en bout : ton mot de passe et ton code de récupération sont les deux seules clés qui existent.":
    "Nobody can reopen your data for you — not support, not us. That is the trade-off of end-to-end encryption: your password and your recovery code are the only two keys that exist.",
  "Commencer": "Start",
  "Ce mot de passe dérive la clé qui chiffre tes données. Il n'est jamais envoyé.":
    "This password derives the key that encrypts your data. It is never sent.",
  "confirme-le": "confirm it",
  "Retour": "Back",
  "Continuer": "Continue",
  "Activer sans filet": "Turn on without a safety net",
  "Les deux saisies diffèrent.": "The two entries do not match.",
  "Voici ton code de récupération. Il ne sera plus jamais affiché.":
    "Here is your recovery code. It will never be shown again.",
  "Note-le HORS de cet appareil — sur papier, ou dans un gestionnaire de mots de passe. Le garder uniquement ici ne servirait à rien : c'est justement cet appareil qui peut tomber en panne.":
    "Write it down OFF this device — on paper, or in a password manager. Keeping it only here would be pointless: this device is precisely the one that can fail.",
  "Je l'ai noté": "I have written it down",
  "Dernière vérification : recopie les groupes manquants. Une case cochée ne prouve rien — celle-ci se coche aussi quand le code est resté à l'écran.":
    "Last check: type the missing groups. A ticked box proves nothing — it gets ticked just as easily when the code never left the screen.",
  "groupe {n}": "group {n}",
  "J'ai compris que si je perds à la fois mon mot de passe et ce code, mes données du cloud seront définitivement illisibles.":
    "I understand that if I lose both my password and this code, my cloud data will be permanently unreadable.",
  "Revoir le code": "Show the code again",

  // ── Déverrouillage au lancement ───────────────────────────────────────────
  "Déverrouiller la synchronisation": "Unlock sync",
  "synchronisation verrouillée": "sync locked",
  "Saisis ton code de récupération pour rouvrir tes données sur cet appareil.":
    "Enter your recovery code to reopen your data on this device.",
  "Shale fonctionne normalement sans cette étape : tes données restent sur cet appareil et tes modifications sont conservées. Elles partiront au déverrouillage.":
    "Shale works normally without this step: your data stays on this device and your changes are kept. They will be sent once you unlock.",
  // « Plus tard » est déjà traduit plus haut (notifications) : la clé est la
  // phrase française, donc une seconde entrée serait un doublon, pas une
  // nuance.

  "Aucune session ouverte.": "No open session.",

  // ── Sync : activation automatique (2026-08-10) ────────────────────────────
  "sync en attente": "sync pending",
  "sync à rétablir": "sync needs attention",
  "Elle se mettra en route à ta prochaine connexion. Tes modifications sont conservées.":
    "It will start at your next sign-in. Your changes are being kept.",
  "Reconnecte-toi pour rouvrir tes données chiffrées sur cet appareil.":
    "Sign in again to reopen your encrypted data on this device.",
  "Ton mot de passe a été réinitialisé : le cloud n'est plus lisible. Tes données locales sont intactes.":
    "Your password was reset: the cloud copy can no longer be read. Your local data is intact.",
  "Tes données sont chiffrées sur cet appareil avant d'être envoyées : le serveur ne voit que des données illisibles. La clé se déduit de ton mot de passe — personne d'autre ne peut la reconstituer.":
    "Your data is encrypted on this device before being sent: the server only ever sees unreadable data. The key comes from your password — nobody else can reconstruct it.",
  "Le trousseau du système n'a pas répondu : la clé n'est gardée que le temps de cette session, et ton mot de passe sera redemandé à la prochaine connexion.":
    "The system Keychain did not respond: the key is only kept for this session, and your password will be needed again at the next sign-in.",
  "La synchronisation se met en route toute seule à la connexion. Déconnecte-toi puis reconnecte-toi pour la réactiver sur cet appareil — tes modifications sont conservées en attendant.":
    "Sync starts on its own when you sign in. Sign out and back in to bring it up on this device — your changes are kept in the meantime.",
  "Ton mot de passe a été réinitialisé depuis un autre appareil. Les données déjà dans le cloud avaient été chiffrées avec l'ancien : plus personne ne peut les rouvrir, nous compris.":
    "Your password was reset from another device. The data already in the cloud was encrypted with the old one: nobody can open it any more, us included.",
  "Republier remplace le contenu du cloud par celui de CET appareil. Tes données locales ne risquent rien — mais ce qui n'existait que sur un autre appareil, et n'est jamais arrivé ici, sera perdu.":
    "Republishing replaces the cloud contents with those of THIS device. Your local data is safe — but anything that only ever existed on another device, and never reached this one, will be lost.",
  "le nouveau, celui que tu viens de définir": "the new one, the one you just set",
  "republication…": "republishing…",
  "Republier depuis cet appareil": "Republish from this device",
  "j'ai compris que le contenu du cloud sera remplacé":
    "I understand the cloud contents will be replaced",

  // ── Sauvegardes locales ───────────────────────────────────────────────────
  "sauvegardes locales":
    "local backups",
  "Une copie datée de toute ta base est faite à chaque premier lancement de la journée. Elle se relit sans mot de passe et sans réseau — c'est ce qui te protège d'une suppression accidentelle, que la synchronisation, elle, recopie fidèlement partout.":
    "A dated copy of your whole database is made at the first launch of each day. It can be read back without a password and without a network — that is what protects you from an accidental deletion, which sync itself faithfully copies everywhere.",
  "sauvegarde…":
    "backing up…",
  "Sauvegarder maintenant":
    "Back up now",
  "Ouvrir le dossier":
    "Open the folder",
  "Copie ce dossier ailleurs : sur ce disque, une panne matérielle emporterait tout.":
    "Copy this folder elsewhere: on this disk, a hardware failure would take everything with it.",
  "Restauration prête. Elle sera appliquée au prochain démarrage de Shale — quitte et relance l'app. L'état actuel sera mis de côté au passage, rien n'est définitif.":
    "Restore is ready. It will be applied the next time Shale starts — quit and relaunch the app. The current state is set aside on the way, nothing is final.",
  "aucune sauvegarde pour l'instant":
    "no backups yet",
  "Restaurer":
    "Restore",
  "Remplacer toute la base par la copie du {quand} ?":
    "Replace the whole database with the copy from {quand}?",
  "Tout ce qui a été saisi depuis sera perdu — sauf que l'état actuel est lui aussi mis de côté avant l'échange, et pourra être restauré à son tour.":
    "Everything entered since will be lost — except that the current state is also set aside before the swap, and can be restored in turn.",
  "Oui, restaurer":
    "Yes, restore",

  // ── Mur d'authentification et mode hors ligne (2026-08-12) ────────────────
  "Hors ligne — tes données restent sur ce Mac, la synchronisation reprendra plus tard.":
    "Offline — your data stays on this Mac, syncing will resume later.",
  "Réessayer":
    "Try again",
  "Hors ligne depuis plus de {n} jours. Reconnecte-toi une fois en ligne.":
    "Offline for more than {n} days. Sign in again once you are back online.",
  "La première connexion demande une connexion Internet.":
    "The first sign-in needs an internet connection.",

  // ── Activation du compte (2026-08-13) ─────────────────────────────────────
  // Recopiées telles quelles depuis la branche macOS : le mur d'activation est
  // le même des deux côtés, et il n'a rien de spécifique à la plateforme.
  "Ce compte n'est pas encore activé. L'accès à Shale est ouvert compte par compte — écris-nous depuis le site pour demander le tien.":
    "This account isn’t activated yet. Access to Shale is granted one account at a time — get in touch through the website to request yours.",
  "L'activation de ce compte n'a pas encore été vérifiée. Connecte-toi une fois en ligne.":
    "This account’s activation hasn’t been verified yet. Sign in once you are back online.",
  "Vérification du compte impossible.":
    "Couldn’t verify your account.",

  // ── Finance (2026-08-25) ──────────────────────────────────────────────────
  // ⚠️ Les libellés lus depuis un tableau (`t(n.label)`, `t(DESCRIPTIONS[id])`,
  // titres d'actions) sont INVISIBLES pour `i18n:check` : l'outil ne repère que
  // `t("littéral")`. Ils sont donc ajoutés ici à la main, et c'est le seul
  // endroit du fichier où une omission ne serait signalée par rien.
  "Finance": "Finance",
  "Trésorerie : runway, patrimoine net, burn mensuel.":
    "Cash position: runway, net worth, monthly burn.",
  "Aller à Finance": "Go to Finance",
  "Combien de mois tu tiens si tes revenus s'arrêtent. Pas de tickets de caisse, pas de connexion bancaire.":
    "How many months you can hold out if your income stops. No receipts to enter, no bank connection.",

  // Natures de compte (tableau `NATURES`)
  "Compte courant": "Current account",
  "Épargne": "Savings",
  "Investissement": "Investment",
  "Crédit": "Credit",
  "Espèces": "Cash",

  // Fréquences (tableau `FREQUENCES`) et périodes (tableau `PERIODES`)
  "par semaine": "per week",
  "par mois": "per month",
  "par trimestre": "per quarter",
  "par an": "per year",
  "3 mois": "3 months",
  "6 mois": "6 months",
  "12 mois": "12 months",

  // En-tête : les trois chiffres
  "runway": "runway",
  "patrimoine net": "net worth",
  "burn mensuel": "monthly burn",
  "épargne mensuelle": "monthly savings",
  "{n} mois": "{n} months",
  "0 mois": "0 months",
  "—": "—",
  "épuisement estimé le {d}": "estimated to run out on {d}",
  "tes revenus récurrents couvrent tes charges":
    "your recurring income covers your outgoings",
  "tes liquidités sont à sec": "your liquid funds are gone",
  "déclare tes charges récurrentes pour obtenir un runway":
    "declare your recurring outgoings to get a runway",
  "relève le solde d'au moins un compte": "record the balance of at least one account",
  "dont {n} de liquidités": "of which {n} is liquid",
  "{n} compte sans aucun relevé — le total est incomplet":
    "{n} account has never been recorded — the total is incomplete",
  "{n} comptes sans aucun relevé — le total est incomplet":
    "{n} accounts have never been recorded — the total is incomplete",
  "aucun flux déclaré": "no flows declared",
  "{s} de charges − {e} de revenus": "{s} of outgoings − {e} of income",

  // Comptes
  "comptes": "accounts",
  "Compte": "Account",
  "Tout relever": "Record all",
  "Saisir tous les soldes du jour — deux minutes, une fois par mois":
    "Enter every balance for today — two minutes, once a month",
  "Ajouter un compte": "Add an account",
  "Aucun compte. Commence par en ajouter un — même approximatif.":
    "No accounts yet. Start by adding one — a rough figure will do.",
  "Certains relevés datent : le runway s'appuie sur des chiffres vieillissants.":
    "Some balances are old: the runway rests on ageing figures.",
  "hors runway": "outside the runway",
  "Saisir le solde d'aujourd'hui": "Enter today’s balance",
  "jamais relevé": "never recorded",
  "Modifier ce compte": "Edit this account",
  "Relevé du {d}": "Balances for {d}",
  "Un champ laissé vide ne modifie rien — ne pas savoir n'est pas déclarer zéro.":
    "A field left blank changes nothing — not knowing isn’t declaring zero.",
  "total saisi": "total entered",
  "Modifier le compte": "Edit account",
  "Nouveau compte": "New account",
  "Libellé": "Name",
  "Nature": "Kind",
  "Établissement": "Institution",
  "facultatif": "optional",
  "Compte dans le runway": "Counts towards the runway",
  "Décoche pour un placement que tu ne comptes pas vendre pour payer tes charges — un PEA bloqué, par exemple.":
    "Untick for holdings you don’t intend to sell to cover your outgoings — a locked-in share plan, for instance.",
  "Le compte sort des totaux mais son historique est conservé":
    "The account leaves the totals but its history is kept",
  "Désarchiver": "Unarchive",
  "Archiver": "Archive",
  "Supprimer définitivement, relevés compris":
    "Delete permanently, balances included",

  // Courbe et projection
  "patrimoine — 12 derniers mois": "net worth — last 12 months",
  "liquide": "liquid",
  "Relève le solde d'un compte : la courbe part de là.":
    "Record one account balance: the curve starts from there.",
  "La courbe se dessine à partir du deuxième relevé — reviens le mois prochain.":
    "The curve appears from the second set of balances — come back next month.",
  "au rythme actuel": "at the current pace",
  "dans {n} mois": "in {n} months",

  // Mise en route
  "mise en route · {n}/3": "getting started · {n}/3",
  "Trois gestes, et Finance sait combien de mois tu tiens.":
    "Three steps, and Finance knows how many months you can hold out.",
  "Pas de tickets de caisse, pas de connexion bancaire : tu relèves tes soldes une fois par mois et tu déclares ce qui revient. Le reste se calcule.":
    "No receipts, no bank connection: you record your balances once a month and declare what recurs. The rest is worked out.",
  "Ces données partent chiffrées de bout en bout vers tes autres appareils, et illisibles pour le serveur. Les cotations de marché, elles, ne sont pas synchronisées : ce sont des données publiques.":
    "This data travels end-to-end encrypted to your other devices, unreadable by the server. Market quotes aren’t synced at all — they are public data.",
  "Ajoute un compte": "Add an account",
  "Ton compte courant suffit pour commencer. Les autres viendront.":
    "Your current account is enough to begin. The others can wait.",
  "Relève son solde": "Record its balance",
  "Un chiffre approximatif vaut mieux que pas de chiffre. Tu le corrigeras.":
    "A rough figure beats no figure. You can correct it later.",
  "Déclare un revenu et une charge": "Declare one income and one outgoing",
  "Ton loyer et ta principale rentrée : c'est ce qui produit le runway.":
    "Your rent and your main income: that’s what produces the runway.",
  "Ajouter un flux": "Add a flow",

  // Flux récurrents
  "flux récurrents": "recurring flows",
  "Flux": "Flow",
  "Ajouter un flux récurrent": "Add a recurring flow",
  "Aucun flux déclaré. Sans eux, pas de burn — donc pas de runway.":
    "No flows declared. Without them there’s no burn — and so no runway.",
  "entrées": "income",
  "sorties": "outgoings",
  "burn net mensuel": "net monthly burn",
  "{n} flux terminé depuis plus de trois mois":
    "{n} flow ended more than three months ago",
  "{n} flux terminés depuis plus de trois mois":
    "{n} flows ended more than three months ago",
  "terminé le {d}": "ended on {d}",
  "Reprendre": "Resume",
  "Ils ne pèsent plus sur le burn. Ils restent listés : un flux résilié garde sa valeur d'historique.":
    "They no longer weigh on the burn. They stay listed: a cancelled flow keeps its value as history.",
  "mois": "month",
  "sans catégorie": "no category",
  "soit": "i.e.",
  " / mois": " / month",
  "Modifier ce flux": "Edit this flow",
  "Modifier le flux": "Edit flow",
  "Nouveau flux récurrent": "New recurring flow",
  "Loyer": "Rent",
  "Sortie": "Outgoing",
  "Montant": "Amount",
  "Fréquence": "Frequency",
  "Actif depuis": "Active since",
  "Jusqu'au (vide = toujours actif)": "Until (blank = always active)",
  "Compté comme": "Counted as",
  " par mois dans le burn.": " per month in the burn.",

  // Trading → euros
  "trading → euros": "trading → euros",
  "Ton journal est en R, ta vie se paye en euros. Dis à Shale ce que vaut 1 R et il fera le pont.":
    "Your journal is in R, your life is paid in euros. Tell Shale what 1 R is worth and it will bridge the two.",
  "Ce que vaut 1 R, en euros": "What 1 R is worth, in euros",
  "D'après tes réglages du calculateur de position :":
    "From your position-calculator settings:",
  "Aucun trade réel sur la période.": "No live trades over this period.",
  "résultat": "result",
  "{n} trade · {r} R": "{n} trade · {r} R",
  "{n} trades · {r} R": "{n} trades · {r} R",
  "ramené au rythme mensuel": "brought back to a monthly pace",
  "part du burn couverte": "share of the burn covered",
  "pas de burn net à couvrir": "no net burn to cover",
  "de tes {b} de charges nettes": "of your {b} of net outgoings",
  "Les backtests sont exclus : un backtest ne paye pas de loyer.":
    "Backtests are excluded: a backtest doesn’t pay rent.",
  "1 R =": "1 R =",

  // Positions
  "positions": "holdings",
  "compte inconnu": "unknown account",
  "Redemander les cotations à Yahoo et Binance":
    "Fetch quotes again from Yahoo and Binance",
  "Mise à jour…": "Updating…",
  "Actualiser": "Refresh",
  "Ajouter une position": "Add a holding",
  "Aucune position suivie. Facultatif : le runway n'en a pas besoin.":
    "No holdings tracked. Optional: the runway doesn’t need them.",
  "cotation indisponible": "quote unavailable",
  "taux de change indisponible": "exchange rate unavailable",
  "cotation datée": "quote is stale",
  "Retirer cette position": "Remove this holding",
  "valorisation": "market value",
  "{n} ligne non valorisée": "{n} line not valued",
  "{n} lignes non valorisées": "{n} lines not valued",
  "Informatif : le patrimoine net s'appuie sur les soldes que tu relèves, pas sur cette valorisation — sinon le même argent serait compté deux fois.":
    "For information only: net worth rests on the balances you record, not on this valuation — otherwise the same money would be counted twice.",
  "Cotations indisponibles :": "Quotes unavailable:",
  "Nouvelle position": "New holding",
  "Source": "Source",
  "Yahoo Finance": "Yahoo Finance",
  "Binance": "Binance",
  "Manuel (pas de cotation)": "Manual (no quote)",
  "Symbole": "Symbol",
  "Quantité": "Quantity",
  "Prix de revient total (facultatif)": "Total cost basis (optional)",
  "Le symbole ne sera plus modifiable ensuite : l'identité de la ligne en dérive pour la synchronisation. Le corriger se fait en supprimant la position et en la recréant.":
    "The symbol can’t be changed afterwards: the row’s identity for syncing derives from it. To correct one, delete the holding and add it again.",

  "Relever": "Record",
  "Enregistrer ce solde": "Save this balance",
  "Relever mes soldes": "Record my balances",
  "Mettre à jour mes soldes": "Update my balances",
  "Saisir un solde": "Enter a balance",
  "{n} compte archivé": "{n} archived account",
  "{n} comptes archivés": "{n} archived accounts",
  "Chargement…": "Loading…",

  // ── Navigation mobile (2026-08-27) ────────────────────────────────────────
  "Plus": "More",

  // ── Chargement et échec de lecture (2026-08-27) ───────────────────────────
  // Deux attentes distinctes, volontairement : le module (chunk `lazy()`) et
  // les données (`fetchAll`). Elles disaient toutes deux « Chargement… », et
  // les distinguer sur une capture d'iPhone avait coûté un cycle entier.
  "Ouverture du module…": "Opening module…",
  "Chargement des données…": "Loading your data…",
  "Les données n'ont pas pu être chargées.": "Your data could not be loaded.",
  "Les données affichées datent de la dernière lecture réussie.":
    "What you see is from the last successful read.",

  // ── Rappel du briefing de marché (2026-08-27) ─────────────────────────────
  // Le texte ne doit JAMAIS dire que le briefing est prêt : il est rédigé à
  // l'ouverture de l'app, pas au moment où la bannière tombe (§ 10, décision 3).
  "Briefing pré-Londres": "Pre-London briefing",
  "Briefing pré-New York": "Pre-New York briefing",
  "Ouvre Shale : Market Brain le rédige à l'ouverture.":
    "Open Shale — Market Brain writes it on launch.",
  "briefing de marché": "market briefing",
  "Rappeler les briefings de 8 h et 14 h": "Remind me of the 8am and 2pm briefings",
  // Retour du maître-détail de Notes, téléphone uniquement. ⚠️ « Thèmes » vivait
  // ici aussi, pour le maître-détail que j'avais bricolé sur Savoir le matin
  // du 2026-08-27 ; la refonte « grille de thèmes » l'a remplacé par son propre
  // « Revenir aux thèmes ». La clé est retirée avec le code qui l'utilisait.
  "Toutes les notes": "All notes",
  // Libellé du filtre de date de Tâches : sans lui, un `<input type="date">`
  // vide est un rectangle muet sur iOS.
  "échéance": "due",
  "Le screenshot n'a pas pu être joint.": "The screenshot couldn’t be attached.",
  "Une bannière avant Londres et avant New York. Le briefing n'est pas encore écrit quand elle tombe : Market Brain le rédige à l'ouverture de l'app. Sans clé IA configurée, rien n'est programmé.":
    "A banner before London and before New York. The briefing isn’t written yet when it lands: Market Brain writes it when you open the app. With no AI key set up, nothing is scheduled.",
  // ── Savoir : grille de thèmes (refonte 2026-08-26) ────────────────────────
  "Lectures": "Reading",
  "Elle sera classée dans « {nom} ».": "It will be filed under “{nom}”.",
  "Rechercher dans « {nom} »…": "Search “{nom}”…",
  "Le savoir n’a pas pu être ouvert": "Knowledge couldn’t be opened",
  "La base locale n’a pas répondu. Rien n’est perdu : réessaie.":
    "The local database didn’t answer. Nothing is lost — try again.",
  "Chercher partout": "Search everywhere",
  "Quitte ce périmètre et garde les mots cherchés.":
    "Leaves this topic and keeps what you typed.",
  "Aucune note pour l’instant.": "No notes yet.",
  "Déplacer avant": "Move earlier",
  "Déplacer après": "Move later",
  "Change aussi sa teinte.": "Its colour too.",
  "hors classement": "unfiled",
  "Supprimer « {nom} » ?": "Delete “{nom}”?",
  "Range par sujet, et retrouve tout d’un clic au lieu de chercher.":
    "File by subject, and get everything back in one click instead of searching.",
  "ou commence par": "or start with",
  "Créé immédiatement, renommable ensuite.": "Created right away, renamable later.",
  "Les voir": "See them",
  "Une note correspond, mais elle est rangée ailleurs.":
    "One note matches, but it’s filed elsewhere.",
  "{n} notes correspondent, mais elles sont rangées ailleurs.":
    "{n} notes match, but they’re filed elsewhere.",
  "{n} note": "{n} note",
  "{n} notes": "{n} notes",
  "{n} résultat ailleurs — chercher partout": "{n} match elsewhere — search everywhere",
  "{n} résultats ailleurs — chercher partout": "{n} matches elsewhere — search everywhere",
  "Sa note n’est pas supprimée : elle passe « sans thème » et reste accessible depuis l’accueil.":
    "Its note isn’t deleted: it moves to “no topic” and stays reachable from the home grid.",
  "Ses {n} notes ne sont pas supprimées : elles passent « sans thème » et restent accessibles depuis l’accueil.":
    "Its {n} notes aren’t deleted: they move to “no topic” and stay reachable from the home grid.",
  "{n} note attend un thème.": "{n} note is waiting for a topic.",
  "{n} notes attendent un thème.": "{n} notes are waiting for a topic.",
  // ───────────────────────────────────────────────────────────────────────────
  // Audit i18n du 2026-08-28 — français en dur trouvé par `npm run i18n:durs`.
  // Rangé en un bloc daté plutôt qu'éparpillé dans les sections thématiques :
  // ces 110 clés viennent d'un seul passage et se relisent ensemble.
  // ───────────────────────────────────────────────────────────────────────────

  // ── Éditeur de texte, croquis, Savoir ─────────────────────────────────────
  "Gras": "Bold",
  "Italique": "Italic",
  "Titre": "Heading",
  "Sous-titre": "Subheading",
  "Paragraphe": "Paragraph",
  "Liste": "List",
  "Citation": "Quote",
  "Lien": "Link",
  "Texte {name}": "{name} text",
  "Couleur {name}": "{name} colour",
  "Surligner {name}": "Highlight {name}",
  "Encre {name}": "{name} ink",
  "Trait {name}": "{name} stroke",
  "Gomme": "Eraser",
  "Image, croquis, lien, titre, liste, citation…":
    "Image, sketch, link, heading, list, quote…",
  "import…": "importing…",
  "Image": "Image",
  "Recherche": "Search",
  "Lecture immersive": "Immersive reading",
  "connaissances": "knowledge",
  "créée le {creee} · modifiée le {modifiee}":
    "created {creee} · edited {modifiee}",
  "Retirer « {tag} »": "Remove “{tag}”",
  "+ tag": "+ tag",
  "supprimer": "delete",
  // Noms de couleurs et d'épaisseurs (tables de libellés).
  "Bleu": "Blue",
  "Vert": "Green",
  "Jaune": "Yellow",
  "Rouge": "Red",
  "Violet": "Purple",
  "Encre": "Ink",
  "Ambre": "Amber",
  "Fin": "End",
  "Moyen": "Medium",

  // ── Tâches, journal, aujourd'hui ──────────────────────────────────────────
  "Marquer faite": "Mark done",
  "Focus 25 min": "25 min focus",
  "effacer": "clear",
  "Tag": "Tag",
  "Moyenne": "Medium",
  "Quotidien": "Daily",
  "Lun–ven": "Mon–Fri",
  "Confirmer": "Confirm",
  "Nom": "Name",
  "+ lien": "+ link",
  "Discipline": "Discipline",
  "Humeur": "Mood",
  "Humeur {n}/5": "Mood {n}/5",
  "habitudes — 12 semaines": "habits — 12 weeks",
  "{nom} aujourd'hui": "{nom} today",
  "{done}/{n} tâche": "{done}/{n} task",
  "{done}/{n} tâches": "{done}/{n} tasks",
  "{n} trade": "{n} trade",
  "{n} trades": "{n} trades",
  "{n} position": "{n} position",
  "{n} positions": "{n} positions",
  "{duree} écran": "{duree} on screen",
  "focus / {objectif}": "focus / {objectif}",
  "trading 7 j": "trading 7 d",

  // ── Performance ───────────────────────────────────────────────────────────
  "Jour": "Day",
  "Semaine": "Week",
  "Mois": "Month",
  "Streak actuel": "Current streak",
  "Record": "Best",
  "Focus aujourd'hui": "Focus today",
  "discipline — 6 derniers mois": "discipline — last 6 months",
  "moins": "less",
  "plus": "more",
  "{unite} aujourd'hui": "{unite} today",
  "sur 7 jours": "over 7 days",
  "Lance ta première session depuis le Timer ou le bouton lecture d'une tâche pour voir ton focus par tag.":
    "Start your first session from the Timer or a task’s play button to see your focus by tag.",
  "Suis ce qui compte pour toi : heures de backtesting, trades pris, reels publiés…":
    "Track what matters to you: backtesting hours, trades taken, reels published…",
  "Suis ce qui compte pour toi : heures de lecture, séances de sport, pages écrites…":
    "Track what matters to you: hours of reading, workouts, pages written…",

  // ── Personnaliser ─────────────────────────────────────────────────────────
  "Monter": "Move up",
  "Descendre": "Move down",
  "Change l’ordre d’affichage.": "Changes the display order.",
  "textes": "wording",
  "Largeur": "Width",
  "Hauteur": "Height",
  "Appliquer": "Apply",
  "Appliquer maintenant": "Apply now",
  "Accueil — titre": "Welcome — heading",
  "Accueil — texte": "Welcome — body",
  "Connexion — sous-titre": "Sign-in — subtitle",
  "Abonnement requis — texte": "Subscription required — body",
  "dashboard — aujourd'hui": "dashboard — today",
  "bandeaux (pleine largeur)": "banners (full width)",
  "Compacte": "Compact",
  "Normale": "Normal",
  "Confort": "Comfortable",
  "Large": "Large",
  "Modifie les textes vus par tes utilisateurs (connexion, accueil, abonnement). Appliqué en direct.":
    "Edit the wording your users see (sign-in, welcome, subscription). Applied live.",
  "Ordre, visibilité et libellé de chaque module. « Aujourd'hui » reste toujours accessible ; Personnaliser et Réglages sont fixes en bas.":
    "Order, visibility and label of every module. “Today” always stays reachable; Customize and Settings are pinned at the bottom.",

  // ── Console d'administration ──────────────────────────────────────────────
  "administration": "administration",
  "inscriptions · 30 j": "sign-ups · 30 d",
  "Utilisateurs": "Users",
  "Churn 30 j": "Churn 30 d",
  "jours": "days",
  "Espace": "Space",
  "Calculateur": "Calculator",
  // En-têtes du tableau d'historique de la vue Position : ils sont mappés
  // depuis un tableau littéral, donc traduits à l'exécution — `i18n:check` ne
  // peut pas les réclamer, ils s'ajoutent à la main.
  "date": "date",
  "paire": "pair",
  "sens": "direction",
  "risqué": "at risk",
  "SL": "SL",
  "R:R": "R:R",
  "2 habitudes t'attendent": "2 habits are waiting for you",
  "Utilisateur": "User",
  "Plan": "Plan",
  "Statut": "Status",
  "Action": "Action",
  "Actif": "Active",
  "Essai": "Trial",
  "Suspendre": "Suspend",
  "{n} abonnés actifs affichés.": "{n} active subscribers shown.",

  // ── Réglages ──────────────────────────────────────────────────────────────
  "compte": "account",
  "Session locale": "Local session",
  "notifications": "notifications",
  "raccourcis": "shortcuts",
  "fournisseur": "provider",
  "maximum par jour": "maximum per day",
  "Capture rapide (global)": "Quick capture (global)",
  "dernière évaluation {quand}": "last evaluated {quand}",
  "Bascule automatique": "Automatic switching",
  "Mode fast-track": "Fast-track mode",
  "Ouvrir le tracker après envoi": "Open the tracker after sending",
  "Bouton break-even": "Break-even button",
  "Exporter une sauvegarde": "Export a backup",
  "tracker live trading — workflow « trader »": "live trading tracker — “trade” workflow",
  "ou": "or",
  "Shale évalue quelques règles locales (habitudes non cochées, savoir délaissé) et te relance au bon moment. Rien ne sort de la machine, et jamais plus d'une notification à la fois : plusieurs rappels le même soir sont regroupés.":
    "Shale evaluates a few local rules (unchecked habits, neglected knowledge) and nudges you at the right moment. Nothing leaves the machine, and never more than one notification at a time: several reminders on the same evening are grouped.",
  "Gemini d’abord, bascule sur Groq en cas de quota atteint ou d’indisponibilité.":
    "Gemini first, falling back to Groq on quota limits or outages.",
  "gemini-2.5-flash — analyse la plus fine.": "gemini-2.5-flash — the sharpest analysis.",
  "llama-3.3-70b — très rapide, quotas plus serrés.":
    "llama-3.3-70b — very fast, tighter quotas.",
  "Stockées en local dans la base de l’app, jamais envoyées ailleurs.":
    "Stored locally in the app’s database, never sent anywhere else.",
  "(vue Position) envoie instantanément la position vers le tracker de la vue Trading : heure d'entrée, paire, prix, SL/TP et R:R sont capturés automatiquement. Il ne reste qu'à cliquer":
    "(Position view) instantly sends the position to the Trading view’s tracker: entry time, pair, prices, SL/TP and R:R are captured automatically. All that’s left is to click",
  "Envoi en arrière-plan sans interruption visuelle (un toast discret confirme). Désactivé : une mini-popup de confirmation s'ouvre avant l'envoi, TP encore éditable.":
    "Sends in the background with no visual interruption (a discreet toast confirms). Off: a small confirmation popup opens first, with the TP still editable.",
  "Exporte une copie propre de toute la base (tâches, objectifs, notes, trades…) — à garder sur un disque externe ou un cloud perso.":
    "Exports a clean copy of the whole database (tasks, goals, notes, trades…) — keep it on an external drive or your own cloud.",
  "Exporte une copie propre de toute la base (tâches, objectifs, notes…) — à garder sur un disque externe ou un cloud perso.":
    "Exports a clean copy of the whole database (tasks, goals, notes…) — keep it on an external drive or your own cloud.",
  "La jauge « énergie restante » du tableau de bord part de l'énergie de départ et baisse selon les trades pris et le temps passé devant l'écran aujourd'hui. Ajuste l'impact de chaque facteur.":
    "The dashboard’s “energy left” gauge starts from your starting energy and drops with the trades taken and the screen time spent today. Adjust how much each factor weighs.",
  "Recalcule immédiatement la jauge d’énergie du tableau de bord.":
    "Recalculates the dashboard’s energy gauge straight away.",
  // ── Auth, onboarding, cloche, grille (audit du 2026-08-28) ────────────────
  "E-mail": "Email",
  "Suivant": "Next",
  "Passer": "Skip",
  "CGU": "Terms of use",
  "En continuant, tu acceptes nos": "By continuing, you accept our",
  "et notre": "and our",
  "Abonnement requis": "Subscription required",
  "Statut actuel :": "Current status:",
  "Essai gratuit —": "Free trial —",
  "{n} jour restant": "{n} day left",
  "{n} jours restants": "{n} days left",
  "Les sept jours sont passés. L'app est en lecture seule : ton historique reste lisible et exportable, rien n'a été supprimé. Un abonnement rouvre tout, exactement là où tu t'es arrêté.":
    "The seven days are up. The app is read-only: your history stays readable and exportable, nothing has been deleted. A subscription reopens everything, exactly where you left off.",
  "Effacer l'historique": "Clear history",
  "Notifications, {n} non lue": "Notifications, {n} unread",
  "Notifications, {n} non lues": "Notifications, {n} unread",
  "Redimensionner": "Resize",
  "Redimensionner en glissant": "Drag to resize",

  // ─── Socle Calendrier & Liaisons (2026-09-02, migration 020) ──────────────
  // Données de démonstration : les quatre types d'objets livrés, leurs champs,
  // et les événements du calendrier de preview. ⚠️ « Statut », « Lien »,
  // « Terminé » et « Revue de la semaine » existent déjà plus haut — les
  // réécrire ici ferait échouer le contrôle des doublons.
  "Point hebdo prop firm": "Weekly prop firm check-in",
  "Clôture mensuelle du journal": "Monthly journal close",
  "Personne": "Person",
  "Rôle": "Role",
  "Rencontré le": "Met on",
  "Contact": "Contact",
  "Ressource": "Resource",
  "Support": "Format",
  "Livre": "Book",
  "Vidéo": "Video",
  "Article": "Article",
  "Podcast": "Podcast",
  "Auteur": "Author",
  "Terminé le": "Finished on",
  "Projet": "Project",
  "En cours": "In progress",
  "En pause": "Paused",
  "Abandonné": "Dropped",
  "Échéance": "Deadline",
  "Prochaine action": "Next action",
  "Setup de trading": "Trading setup",
  "Biais": "Bias",
  "Neutre": "Neutral",
  "Règle d'entrée": "Entry rule",
  "R visé": "Target R",
  "Balayage puis retour dans le range": "Sweep, then back inside the range",

  // ─── Calendrier (2026-09-02, 13ᵉ module) ──────────────────────────────────
  "Calendrier": "Calendar",
  "+ Nouvel événement": "+ New event",
  "Nouvel événement": "New event",
  "Modifier l'événement": "Edit event",
  "Supprimer l'événement": "Delete event",
  "Un rendez-vous, un créneau bloqué, un anniversaire.": "An appointment, a blocked slot, a birthday.",
  "Un événement a besoin d'un titre.": "An event needs a title.",
  "La fin doit venir après le début.": "The end must come after the start.",
  "Point hebdo, dentiste, anniversaire…": "Weekly check-in, dentist, birthday…",
  "Date": "Date",
  "Début": "Start",
  "Note": "Note",
  "Couleur": "Colour",
  "Répétition": "Repeats",
  "Toute la journée": "All day",
  "Sans heure": "No time",
  "jour": "day",
  "Précédent": "Previous",
  "Revenir à aujourd'hui": "Back to today",
  "Ouvrir cette journée": "Open this day",
  "Ouvrir la note de ce jour": "Open this day's note",
  "Le journal et le calendrier partagent la même journée.": "The journal and the calendar share the same day.",
  "+ {n} autres": "+ {n} more",
  "Rien de prévu aujourd'hui.": "Nothing planned today.",

  // L'intelligence du module — ce qu'il dit, et ce qu'il avoue ne pas savoir.
  "Journée surchargée": "Overloaded day",
  "Journée surchargée.": "Overloaded day.",
  "Surchargée": "Overloaded",
  "{posees} posées pour {capacite} de capacité.": "{posees} scheduled against {capacite} of capacity.",
  "Et {n} tâches sans horaire, qui ne sont pas comptées.": "Plus {n} tasks with no time, which are not counted.",
  "(capacité par défaut — pas encore assez de sessions pour l'apprendre)":
    "(default capacity — not enough sessions yet to learn it)",
  "La charge de cette journée": "This day's load",
  "Capacité apprise de tes sessions de concentration.": "Capacity learned from your focus sessions.",
  "Capacité par défaut : pas encore assez de sessions pour l'apprendre.":
    "Default capacity: not enough sessions yet to learn it.",
  "{n} tâches sans horaire — non comptées, faute de durée connue.":
    "{n} tasks with no time — not counted, since their length is unknown.",
  "{n} h": "{n} h",
  "{n} min": "{n} min",

  "échéance dépassée de {n} jours.": "deadline missed by {n} days.",
  "{n} jours restants, {pct} % fait.": "{n} days left, {pct}% done.",
  "(progression déclarée à la main, pas mesurée)": "(progress entered by hand, not measured)",

  "prévue le {date}, repoussée {n} fois.": "due on {date}, pushed back {n} times.",
  "Une tâche reportée cinq fois n'est pas une tâche, c'est une décision à prendre.":
    "A task pushed back five times isn't a task, it's a decision you're avoiding.",
  "La faire maintenant": "Do it now",
  "Replanifier dans 7 jours": "Reschedule in 7 days",

  "La note de cette journée": "This day's note",
  "Ce qui s'est passé ce jour-là…": "What happened that day…",
  "Enregistré.": "Saved.",
  "Non enregistré — sortir du champ enregistre.": "Not saved — leaving the field saves it.",

  // Rappels
  "Événement imminent": "Event coming up",
  "Avant un rendez-vous du jour, et en fin de journée pour ce qui tombe demain.":
    "Before an appointment today, and at the end of the day for what falls tomorrow.",
  "prévenir": "warn me",
  "min avant": "min before",
  "annoncer demain à": "announce tomorrow at",

  // Créneaux proposés — et ce qu'on dit quand il n'y a rien à proposer.
  "Créneaux libres proposés": "Suggested free slots",
  "Tes heures les plus souvent tenues, encore libres. À toi de déposer.":
    "Your most frequently kept hours, still free. Yours to fill.",
  "Heures ouvrées par défaut : l'app n'a pas encore assez de sessions pour apprendre les tiennes.":
    "Default working hours: not enough sessions yet for the app to learn yours.",
  "Rien à proposer : tes heures habituelles sont déjà prises ce jour-là.":
    "Nothing to suggest: your usual hours are already taken that day.",
  "Aucune heure de travail apprise pour ce jour de la semaine.":
    "No working hours learned for that day of the week.",
  "+ {n} autres objectifs en péril, dans le module Objectifs.":
    "+ {n} more goals at risk, in the Goals module.",
  "+ {n} autres tâches attendent une décision.": "+ {n} more tasks are waiting on a decision.",

  // Singuliers — l'anglais n'accorde pas comme le français, d'où les deux formes
  // complètes plutôt qu'un suffixe ajouté à la volée.
  "+ {n} autre objectif en péril, dans le module Objectifs.":
    "+ {n} more goal at risk, in the Goals module.",
  "+ {n} autre tâche attend une décision.": "+ {n} more task is waiting on a decision.",
  "Et {n} tâche sans horaire, qui n'est pas comptée.":
    "Plus {n} task with no time, which is not counted.",
  "{n} tâche sans horaire — non comptée, faute de durée connue.":
    "{n} task with no time — not counted, since its length is unknown.",
  "{n} jour restant, {pct} % fait.": "{n} day left, {pct}% done.",
  "échéance dépassée d'{n} jour.": "deadline missed by {n} day.",

  // ─── Liaisons & objets (2026-09-02) ───────────────────────────────────────
  // ⚠️ Les libellés de FAMILLE ci-dessous sont appelés par clé DYNAMIQUE
  // (`t(LIBELLE_DE_KIND[k])`) : `i18n:check` ne les voit pas, et ne les
  // réclamera jamais. Ils se vérifient en basculant l'app en anglais — la seule
  // preuve, comme le rappelle `PIEGES.md` § 5.2 bis.
  "Tâche": "Task",
  "Objectif": "Goal",
  "Événement": "Event",
  "Trade": "Trade",
  "Objet": "Object",
  "Fiches du Savoir": "Knowledge cards",
  "Événements": "Events",
  "Trades": "Trades",
  "Objets": "Objects",

  // Types de champ — même remarque : clés dynamiques.
  "Texte": "Text",
  "Nombre": "Number",
  "Choix": "Choice",

  // Mentions et backlinks
  "Écris ta note. Tape @ pour citer une note, une fiche, un objectif…":
    "Write your note. Type @ to cite a note, a card, a goal…",
  "Rien à citer sous ce nom.": "Nothing to cite under that name.",
  "Mentionné dans": "Mentioned in",
  "Rien ne cite encore ceci.": "Nothing cites this yet.",
  "Lier": "Link",
  "Rattacher à la main": "Attach by hand",
  "Tout ne se dit pas dans un texte.": "Not everything gets said in a text.",
  "Chercher une note, une fiche, un objet…": "Search a note, a card, an object…",
  "Retirer ce rattachement": "Remove this attachment",
  "à la main": "by hand",
  "aller à": "go to",
  "Rien ne correspond.": "Nothing matches.",

  // Objets et types
  "Nouveau type d'objet": "New object type",
  "Modifier ce type": "Edit this type",
  "Modifier le type": "Edit type",
  "Type livré avec l'app. Tu peux le modifier et le supprimer comme les autres.":
    "Type shipped with the app. You can edit and delete it like any other.",
  "Client, Recette, Lieu…": "Client, Recipe, Place…",
  "Champs": "Fields",
  "Ajouter un champ": "Add a field",
  "Nom du champ": "Field name",
  "Retirer ce champ": "Remove this field",
  "obligatoire": "required",
  "Options, séparées par des virgules": "Options, comma-separated",
  "← Retour": "← Back",

  // ⭐ Ce que l'app promet : retirer un champ ne détruit rien.
  "Ces champs retirés ne seront plus affichés :": "These removed fields will no longer be shown:",
  "{n} fiches le remplissent": "{n} cards fill it in",
  "Rien n'est effacé : les valeurs restent en base et réapparaissent si tu remets le champ.":
    "Nothing is deleted: the values stay in the database and come back if you restore the field.",
  "{n} valeurs sont conservées pour des champs retirés du type. Elles reviendront si tu remets ces champs.":
    "{n} values are kept for fields removed from the type. They will come back if you restore those fields.",

  // Messages de validation (`lib/objets.ts` — clés dynamiques, elles aussi).
  "Un type doit avoir un nom.": "A type needs a name.",
  "Un champ doit avoir un nom.": "A field needs a name.",
  "Deux champs portent le même identifiant.": "Two fields share the same identifier.",

  // ─── Parité iPhone (2026-09-02) ───────────────────────────────────────────
  // ⚠️ « Agenda » et son aide passent par la table `MODES`, donc par clé
  // DYNAMIQUE : `i18n:check` ne les réclamera jamais (PIEGES.md § 5.2 bis).
  "Agenda": "Agenda",
  "Ce qui vient, dans l'ordre où ça vient.": "What's coming, in the order it comes.",
  "Rien de prévu sur les {n} prochains jours.": "Nothing planned for the next {n} days.",

  // ─── Calendrier V2 (2026-09-05) ───────────────────────────────────────────
  "Sur plusieurs jours": "Spans several days",
  "jusqu'au": "until",
  "Le dernier jour doit venir après le premier.": "The last day must come after the first.",
  "Un événement sur plusieurs jours ne se répète pas.":
    "An event spanning several days doesn't repeat.",
  // L'en-tête de la bande des journées entières et des séjours, en vue semaine.
  "Journée": "All day",
  "Séminaire prop firm": "Prop firm seminar",
  "Choisis au moins un jour de répétition.": "Pick at least one day to repeat on.",
  "Heure": "Hour",
  "Minutes": "Minutes",
  "Choisir à la roulette": "Pick on the wheel",
  "Masquer la roulette": "Hide the wheel",
  "Une tâche qui se répète n'a pas d'échéance : ses occurrences se calculent.":
    "A repeating task has no due date: its occurrences are computed.",
  // ⚠️ Les quatre libellés de récurrence de l'événement passent par la table
  // `RECURRENCES`, donc par clé CALCULÉE : `i18n:check` ne les réclamera
  // JAMAIS (PIEGES § 5.2 bis). Ils existent déjà plus haut, écrits pour
  // `TaskModal` — « Une fois », « Quotidien », « Lun–ven », « Jours précis » —
  // et c'est précisément ce que veut dire « le même vocabulaire ». Les trois
  // anciens libellés propres à l'événement s'affichaient en FRANÇAIS dans
  // l'app anglaise, les deux outils au vert.
  // ─── Cartes mentales (2026-09-07) ─────────────────────────────────────────
  "Carte mentale": "Mind map",
  "Insérer une carte mentale": "Insert a mind map",
  "Une idée par nœud, au clavier": "One idea per node, from the keyboard",
  "Écris ici. « Insérer » ajoute une image, un croquis, une carte mentale…":
    "Write here. \u201cInsert\u201d adds an image, a sketch, a mind map\u2026",
  "Tout voir": "Fit to view",
  "Rétablir": "Redo",
  "Exporter en PNG": "Export as PNG",
  "Une image qui se colle partout.": "An image you can paste anywhere.",
  "Exporter en SVG": "Export as SVG",
  "Net à n'importe quel agrandissement.": "Sharp at any zoom level.",
  "Carte exportée": "Map exported",
  "La carte est déjà enregistrée.": "The map is already saved.",
  "Déposer sous « {cible} »": "Drop under \u201c{cible}\u201d",
  "Relâche sur un nœud pour l'y rattacher": "Release on a node to attach it there",
  "sans titre": "untitled",
  "Ouvrir « {titre} »": "Open \u201c{titre}\u201d",
  "La cible de ce nœud n'existe plus.": "This node's target no longer exists.",
  // ─── La barre d'outils de la carte (2026-09-07) ───────────────────────────
  // Chaque bouton = un LIBELLÉ court (data-tip) + une PHRASE (data-tip-sub).
  // Les deux se traduisent : la phrase est ce que lit quelqu'un qui n'a jamais
  // construit de carte, elle ne peut pas rester en français.
  "Sous-nœud": "Sub-node",
  "Une idée qui découle de celle sélectionnée.": "An idea that follows from the selected one.",
  "Nœud voisin": "Sibling node",
  "Une idée au même niveau, juste en dessous.": "An idea at the same level, just below.",
  "Le nœud central n'a pas de voisin : tout part de lui.":
    "The central node has no sibling: everything starts from it.",
  // ─── Le côté d'une branche (2026-09-08) ───────────────────────────────────
  "Une branche de plus. Elle naît du côté le moins chargé, pour équilibrer la carte.":
    "One more branch. It appears on the lighter side, to keep the map balanced.",
  // ─── La suppression en deux temps (2026-09-22) ────────────────────────────
  "Retire ce nœud et tout ce qui pend dessous. Un premier appui montre ce qui partirait.":
    "Removes this node and everything hanging under it. A first press shows what would go.",
  "Tout ce qui est en rouge disparaît : ce nœud et les {n} qui pendent dessous. Échap annule.":
    "Everything in red goes: this node and the {n} hanging under it. Esc cancels.",
  "Ce nœud disparaît. Échap annule.": "This node goes. Esc cancels.",
  "Ce nœud et les {n} qui pendent dessous vont disparaître.":
    "This node and the {n} hanging under it are about to go.",
  "Ce nœud va disparaître.": "This node is about to go.",
  "confirmer": "confirm",
  "Changer de côté": "Switch side",
  "Faire passer cette branche, et tout ce qui pend dessous, de l'autre côté du centre.":
    "Move this branch, and everything hanging under it, to the other side of the centre.",
  "Seule une branche partant du centre a un côté à changer.":
    "Only a branch starting from the centre has a side to switch.",
  "⌥ flèches": "⌥ arrows",
  "Réécrire le texte du nœud sélectionné.": "Rewrite the text of the selected node.",
  "Un nœud lié porte le titre de sa cible : il se renomme là-bas.":
    "A linked node carries its target's title: rename it over there.",
  "Citer un objet": "Cite an object",
  "Remplace le nœud par un lien vers une note, une tâche, une fiche…":
    "Replaces the node with a link to a note, a task, a card…",
  "Replier": "Collapse",
  "Déplier": "Expand",
  "Cacher ou remontrer ce qui pend sous ce nœud.": "Hide or show again what hangs under this node.",
  "Ce nœud n'a rien en dessous à cacher.": "This node has nothing below to hide.",
  "Retire ce nœud et tout ce qui pend dessous.": "Removes this node and everything hanging below it.",
  "Le nœud central ne se supprime pas : c'est la carte elle-même.":
    "The central node cannot be deleted: it is the map itself.",
  "Zoom arrière": "Zoom out",
  "Zoom avant": "Zoom in",
  "Voir de plus loin.": "See from further away.",
  "Voir de plus près.": "See from closer up.",
  "Recadrer la carte entière dans la fenêtre.": "Fit the whole map into the window.",
  // Le pied d'aide : chaque raccourci en deux mots, pas une phrase.
  // ⚠️ « frère » / « enfant » ont vécu ici jusqu'au 2026-09-07 : Entrée validait
  // un frère, elle valide maintenant la case. Les deux clés sont retirées avec
  // le libellé qui les portait — les garder ferait croire à un raccourci mort.
  "valider": "confirm",
  "sous-nœud": "sub-node",
  "voisin": "sibling",
  "Flèches": "Arrows",
  "se déplacer": "move around",
  "replier": "collapse",
  "citer un objet": "cite an object",
  "annuler": "undo",
  // Sous « Échap », « annuler » veut dire RENONCER, pas défaire (⌘Z) : clé à part
  // (2026-09-29 — le pied de la suppression en deux temps disait « Esc undo »).
  "annuler|renoncer": "cancel",
  "molette : déplacer · ⌘molette : zoomer": "wheel: pan \u00b7 \u2318wheel: zoom",
  // ⚠️ CLÉS DYNAMIQUES — `i18n:check` ne les réclamera JAMAIS (PIEGES § 5.2
  // bis) : `lib/fichiers.ts` fait `t(NOM[extension])`, donc une clé CALCULÉE.
  // Elles sont ajoutées à la main, et vérifiées en basculant l'app en anglais.
  "Image PNG": "PNG image",
  "Image SVG": "SVG image",
  "Fichier": "File",
  // ─── Charge d'une journée : événements ≠ tâches (2026-09-07) ──────────────
  // Le compte était juste, le mot était faux : une « journée entière »
  // s'annonçait comme « 1 tâche sans horaire ».
  "Et {n} événement sans horaire, qui n'est pas compté.":
    "Plus {n} event with no time, which is not counted.",
  "Et {n} événements sans horaire, qui ne sont pas comptés.":
    "Plus {n} events with no time, which are not counted.",
  "{n} événement sans horaire — non compté, faute de durée connue.":
    "{n} event with no time \u2014 not counted, no known duration.",
  "{n} événements sans horaire — non comptés, faute de durée connue.":
    "{n} events with no time \u2014 not counted, no known duration.",
  // ─── Fusion des thèmes et des objets : le SUJET (2026-09-07) ──────────────
  // 38 clés ont été RETIRÉES avec ce bloc — « Nouveau thème », « Sans thème »,
  // « Aucune fiche de ce type pour l'instant. », les libellés des deux onglets…
  // Contrairement à la documentation, une clé i18n périmée ne se marque pas :
  // elle ne dit rien de l'histoire du projet, et la garder ferait croire à un
  // écran qui existe encore. Le journal de ce commit tient ce rôle.
  // ⚠️ Le vocabulaire visible change des DEUX côtés : « theme » et « object »
  // disparaissent de l'app anglaise en même temps qu'ils disparaissent de la
  // française. Les anciennes clés (« Nouveau thème », « Sans thème »…) sont
  // retirées avec les libellés qui les portaient — les garder ferait croire à
  // un écran qui existe encore.
  "sujet": "subject",
  "{n} sujet": "{n} subject",
  "{n} sujets": "{n} subjects",
  "type": "type",
  "Sans sujet": "No subject",
  "Nouveau sujet": "New subject",
  "Renommer le sujet": "Rename subject",
  "Supprimer le sujet": "Delete subject",
  "Ouvrir le sujet « {nom} »": "Open subject \u201c{nom}\u201d",
  "Ouvrir les notes sans sujet": "Open notes with no subject",
  "Revenir aux sujets": "Back to subjects",
  "Rechercher dans tous les sujets…": "Search across all subjects\u2026",
  "Tous sujets confondus, sans quitter Savoir.": "Across every subject, without leaving Knowledge.",
  "Ce sujet est encore vide": "This subject is still empty",
  "Ce sujet ne contient aucune note.": "This subject holds no notes.",
  "Ce sujet existe déjà.": "That subject already exists.",
  "Nom du sujet": "Subject name",
  "Teinte du sujet": "Subject colour",
  "modifier le sujet": "edit subject",
  "nouveau sujet": "new subject",
  "Créer mon premier sujet": "Create my first subject",
  "Créer le sujet « {nom} »": "Create subject \u201c{nom}\u201d",
  "Un sujet, c’est un tiroir — et bien plus si tu veux":
    "A subject is a drawer \u2014 and much more if you want it to be",
  "Un tiroir pour tes notes — qui peut aussi se citer avec @.":
    "A drawer for your notes \u2014 which you can also cite with @.",
  "Les notes ne sont pas supprimées : elles passent « sans sujet ».":
    "The notes are not deleted: they become \u201cno subject\u201d.",
  "Ces notes existent et restent trouvables : elles n’ont simplement pas encore de sujet.":
    "These notes exist and stay findable \u2014 they just have no subject yet.",
  "Sujet de classement": "Filed under",
  "Déplace la note dans un autre sujet.": "Move the note to another subject.",
  "Entrée pour valider. Les tags filtrent les notes, tous sujets confondus.":
    "Enter to confirm. Tags filter notes across every subject.",
  // La page d'un sujet
  "Décrire ce sujet": "Describe this subject",
  "Un type, des champs, une description, ses liens.": "A type, fields, a description, its links.",
  "Ce que tu sais de ce sujet. Tape @ pour citer autre chose.":
    "What you know about this subject. Type @ to cite something else.",
  "Un type est facultatif : il ajoute des champs, il ne range rien.":
    "A type is optional: it adds fields, it files nothing.",
  "Nouveau type": "New type",
  "Un type décrit les champs de ses sujets.": "A type describes the fields of its subjects.",
  "Supprimer ce type ?": "Delete this type?",
  "Supprimer le type ? Ses {n} sujets sont conservés, sans type.":
    "Delete the type? Its {n} subjects are kept, untyped.",
  // ─── Checkup du 2026-09-07 : du français dans l'app ANGLAISE ──────────────
  // ⚠️ Ces huit chaînes passaient par `t()` mais n'avaient AUCUNE traduction, et
  // les deux outils étaient au vert : `i18n:check` ne voit que les clés
  // ÉCRITES dans un appel `t("…")`, or celles-ci sont des valeurs de TABLE
  // (`ACTIONS`, `WIDGET_LABELS`, `DESCRIPTIONS`, `VUES`, `correlations.ts`)
  // traduites à l'affichage — le piège § 5.2 bis. `i18n:durs`, lui, les
  // signalait comme « entrées de table » sans savoir si elles étaient
  // traduites. Seul l'app basculée en anglais les a montrées, en lisant le
  // journal de `t()`. Sept viennent du chantier Calendrier (2026-09-02).
  "Aller au Calendrier": "Go to Calendar",
  "Calendrier du jour": "Today's calendar",
  "Mois, semaine, jour : événements, tâches datées et échéances, au même endroit.":
    "Month, week, day: events, dated tasks and deadlines, all in one place.",
  "Vue d'ensemble : ce qui est chargé, ce qui est libre.":
    "The wide view: what's busy, what's free.",
  "L'horizon où la planification se décide.": "The horizon where planning happens.",
  "La grille horaire, pour poser les créneaux.": "The hour grid, to lay out your slots.",
  "Dollar fort": "Strong dollar",
  "Dollar faible": "Weak dollar",

  // ── Facturation (migration 023) ────────────────────────────────────────
  // ⚠️ « TVA non applicable, art. 293 B du CGI » n'est PAS traduit : c'est un
  // texte de loi FRANÇAISE, qui doit figurer tel quel sur le document même
  // quand l'interface est en anglais.
  "Créances et trésorerie": "Receivables and cash",
  "Ce qu'on me doit": "Owed to me",
  "Ce que je dois": "What I owe",
  "Runway prudent": "Conservative runway",
  "L'argent réellement en banque": "The money actually in the bank",
  "Avec créances": "With receivables",
  "Si les factures sont payées à l'échéance": "If invoices are paid on their due date",
  "Les créances attendues repoussent l'épuisement de {n} mois.": "Expected receivables push the runout back by {n} months.",
  "Les dettes fournisseurs rapprochent l'épuisement de {n} mois.": "Supplier debts bring the runout forward by {n} months.",
  "Épuisement estimé le": "Estimated runout on",
  "Épuisé": "Exhausted",
  "Aucune charge déclarée": "No expenses declared",
  "Aucun compte relevé": "No account recorded",
  "Rien en attente de règlement.": "Nothing awaiting payment.",
  "Rien à régler.": "Nothing to pay.",
  "Déclaré face à encaissé": "Declared vs collected",
  "Revenus récurrents déclarés": "Declared recurring income",
  "/ mois": "/ month",
  "Réellement encaissé": "Actually collected",
  "Tu encaisses durablement moins que ce que tu as déclaré. Ce n'est pas une erreur de saisie : ton burn reste ce que tu as choisi, et cet écart décrit ton activité.": "You are consistently collecting less than you declared. This is not a data-entry mistake: your burn stays what you chose, and this gap describes your activity.",
  "Tu encaisses durablement plus que ce que tu as déclaré. Ton runway prudent est donc plus pessimiste que la réalité.": "You are consistently collecting more than you declared, so your conservative runway is more pessimistic than reality.",
  "{n} document en retard": "{n} overdue document",
  "{n} documents en retard": "{n} overdue documents",
  "{n} encaissement est exclu faute de taux de change": "{n} payment is excluded for lack of an exchange rate",
  "{n} encaissements sont exclus faute de taux de change": "{n} payments are excluded for lack of an exchange rate",
  "Factures": "Invoices",
  "Achats": "Purchases",
  "Créer un brouillon de facture": "Create an invoice draft",
  "Saisir un achat": "Record a purchase",
  "Nouveau": "New",
  "Tous les clients": "All clients",
  "Aucun document pour l'instant.": "No documents yet.",
  "Aucun document ne correspond à ce filtre.": "No document matches this filter.",
  "Brouillon": "Draft",
  "Sans objet": "No subject",
  "reste": "left",
  "Enregistrer un encaissement": "Record a payment received",
  "Devis": "Quote",
  "Encaissée": "Paid",
  "Rien n'a été renuméroté : un numéro déjà envoyé à un client ne peut pas changer sans que tu le décides.": "Nothing was renumbered: a number already sent to a client cannot change unless you decide it.",
  "le plus ancien date du": "the oldest is dated",
  "En retard d'{n} jour": "{n} day overdue",
  "En retard de {n} jours": "{n} days overdue",
  "{n} numéro est porté par deux documents": "{n} number is shared by two documents",
  "{n} numéros sont portés par plusieurs documents": "{n} numbers are shared by several documents",
  "Enregistrer un décaissement": "Record a payment made",
  "Reste à payer": "Left to pay",
  "Compte débité": "Account debited",
  "Compte crédité": "Account credited",
  "— non précisé —": "— not specified —",
  "Sans compte, ce paiement suit la facture mais n'entre dans aucun solde : l'app ne sait pas où l'argent est arrivé.": "Without an account, this payment tracks the invoice but enters no balance: the app does not know where the money landed.",
  "Facultative": "Optional",
  "Déjà enregistré": "Already recorded",
  "Retirer cet encaissement": "Remove this payment",
  "Document": "Document",
  "Modifier le brouillon": "Edit draft",
  "Nouveau document": "New document",
  "Client": "Client",
  "— choisir —": "— choose —",
  "Type": "Type",
  "Facture": "Invoice",
  "Avoir": "Credit note",
  "Prestation de conseil — septembre": "Consulting work — September",
  "Série": "Series",
  "Date d'émission": "Issue date",
  "Lignes": "Line items",
  "Ajouter une ligne": "Add a line",
  "Mentions": "Legal notices",
  "Conditions de paiement": "Payment terms",
  "30 jours": "30 days",
  "Note interne": "Internal note",
  "Jamais imprimée": "Never printed",
  "Un brouillon se supprime librement": "A draft can be deleted freely",
  "Marque le document annulé. Émets un avoir pour la contrepartie comptable.": "Marks the document cancelled. Issue a credit note for the accounting counterpart.",
  "Annuler le document": "Cancel document",
  "Enregistrer le brouillon": "Save draft",
  "Émettre": "Issue",
  "Ce document est émis : il ne se modifie plus.": "This document is issued: it can no longer be edited.",
  "Son numéro est parti chez ton client. Pour l'annuler, émets un avoir — le document reste, sa contrepartie s'ajoute.": "Its number has gone to your client. To cancel it, issue a credit note — the document stays, its counterpart is added.",
  "Émis le": "Issued on",
  "Désignation": "Description",
  "Qté": "Qty",
  "Prix unitaire": "Unit price",
  "TVA": "VAT",
  "Monter cette ligne": "Move this line up",
  "Descendre cette ligne": "Move this line down",
  "Retirer cette ligne": "Remove this line",
  "Total HT": "Total excl. VAT",
  "sur": "on",
  "Total TTC": "Total incl. VAT",
  "Émettre ce document": "Issue this document",
  "Numéro attribué": "Number assigned",
  "Une fois émis, ce document ne se modifie plus et son numéro ne se rend pas — une série de numéros doit rester continue. Pour l'annuler ensuite, tu émettras un avoir.": "Once issued, this document can no longer be edited and its number is never released — a number series must stay unbroken. To cancel it afterwards, you will issue a credit note.",
  "Revenir": "Back",
  "Virement": "Bank transfer",
  "Carte": "Card",
  "Chèque": "Cheque",
  "Prélèvement": "Direct debit",
  "TVA non applicable, art. 293 B du CGI": "TVA non applicable, art. 293 B du CGI",

  // ⚠️ VALEURS DE TABLE, traduites à l'AFFICHAGE (jamais de `t()` dans une
  // constante de module, qui serait figée à l'import dans la langue de
  // départ). `i18n:check` ne les voit PAS — il ne lit que les littéraux
  // passés à `t()`. Sans ces lignes, les filtres, les statuts, les tranches
  // d'ancienneté et les messages de refus s'afficheraient en FRANÇAIS dans
  // l'app anglaise, exactement comme les huit chaînes trouvées au checkup du
  // 2026-09-07.
  "À encaisser": "To collect",
  "Brouillons": "Drafts",
  "Encaissées": "Paid",
  "Émise": "Issued",
  "Partiellement encaissée": "Partly paid",
  "Annulée": "Cancelled",
  "À échoir": "Not yet due",
  "1 à 30 j": "1 to 30 d",
  "31 à 60 j": "31 to 60 d",
  "Plus de 60 j": "Over 60 d",
  "Ce document a déjà été émis.": "This document has already been issued.",
  "Choisis une série de numérotation.": "Choose a numbering series.",
  "Choisis un client.": "Choose a client.",
  "Ajoute au moins une ligne.": "Add at least one line.",
  "Donne une date d'émission.": "Set an issue date.",
  "Le total est nul : rien à facturer.": "The total is zero: nothing to invoice.",
  "Émets d'abord la facture : un brouillon ne s'encaisse pas.": "Issue the invoice first: a draft cannot be paid.",
  "Donne une date à cet encaissement.": "Set a date for this payment.",
  "Un encaissement de zéro n'a rien à enregistrer.": "A payment of zero records nothing.",
  "Ce montant dépasse ce qu'il reste à payer.": "This amount exceeds what is left to pay.",
  "À payer": "To pay",
  "Payées": "Paid",
  "Payée": "Paid",
  "Partiellement payée": "Partly paid",
  "Tous les fournisseurs": "All suppliers",
  "Tous": "All",
  "En retard": "Overdue",
  "mois|un": "month",
  "mois|plusieurs": "months",
  "Un compteur de série est en retard sur les numéros déjà émis.": "A series counter is behind the numbers already issued.",
  "prochain numéro {p}, alors que {o} est déjà utilisé": "next number {p}, while {o} is already in use",
  "Émettre maintenant produirait un doublon. Corrige le compteur de la série avant d'émettre.": "Issuing now would create a duplicate. Fix the series counter before issuing.",
  "Aperçu": "Preview",
  "Aperçu du document": "Document preview",
  "Voir le document tel qu'il sera imprimé": "See the document as it will be printed",
  "Ce document est incomplet au regard de la loi.": "This document is legally incomplete.",
  "L'aperçu n'a pas pu être produit.": "The preview could not be produced.",
  "Le XML Factur-X (profil BASIC) est joint au PDF. C'est un PDF valide portant un XML conforme — pas un PDF/A-3 certifié : la conformité finale se jouera au branchement d'une plateforme agréée.": "The Factur-X XML (BASIC profile) is attached to the PDF. This is a valid PDF carrying a compliant XML — not a certified PDF/A-3: full compliance will come when an approved platform is connected.",
  "Enregistrer :": "Saved:",
  "Enregistrer le PDF": "Save the PDF",
  "Enregistrer le PDF sur le disque": "Save the PDF to disk",
  "Document PDF": "PDF document",
  "Fichier CSV": "CSV file",
  "La dénomination de l'émetteur est vide.": "The issuer's business name is empty.",
  "L'émetteur n'a ni SIRET ni SIREN.": "The issuer has neither SIRET nor SIREN.",
  "L'adresse de l'émetteur est vide.": "The issuer's address is empty.",
  "Aucun client n'est renseigné.": "No client is set.",
  "L'adresse du client est vide.": "The client's address is empty.",
  "Le document n'a aucune ligne.": "The document has no line items.",
  "Le document n'a pas de numéro.": "The document has no number.",
  "Le document n'a pas de date d'émission.": "The document has no issue date.",
  "Enregistré :": "Saved:",
  "Export comptable": "Accounting export",
  "Du": "From",
  "Au": "To",
  "Une ligne par facture": "One row per invoice",
  "Une ligne par ligne de facture — c'est celui qui permet de refaire le calcul de TVA": "One row per line item — the one that lets you re-check the VAT calculation",
  "Détail": "Detail",
  "Les encaissements, à part": "Payments, separately",
  "Paiements": "Payments",
  "Facturer ce devis": "Invoice this quote",
  "Crée une facture depuis ce devis. Le devis est conservé.": "Creates an invoice from this quote. The quote is kept.",
  "Déjà facturé :": "Already invoiced:",
  // ── Premier démarrage : l'accueil, la grille, le contenu de départ ────────
  // Chantier L, 2026-09-10.
  // ⚠️ Les entrées de `lib/onboarding/exemples.ts` sont un cas à part : elles
  // partent en BASE, pas à l'écran. Elles sont traduites au moment où le
  // contenu de départ est créé et ne changent plus ensuite — basculer l'app en
  // anglais après coup ne réécrit pas les notes de l'utilisateur, et ne doit
  // pas.
  "Créer et commencer": "Create and start",
  "À quelle heure te lèves-tu et te couches-tu, d'habitude ?":
    "What time do you usually get up and go to bed?",
  "Ces deux heures dessinent ta semaine et servent à repérer la régularité de ton coucher. Elles ne servent jamais à te proposer de dormir moins.":
    "These two times draw your week and help spot how regular your bedtime is. They are never used to suggest you sleep less.",
  "Lever": "Wake-up",
  "Coucher": "Bedtime",
  "Quand travailles-tu ?": "When do you work?",
  "C'est de là que partent les créneaux que le calendrier te proposera, jusqu'à ce qu'il ait appris tes heures réelles.":
    "This is where the slots the calendar suggests come from, until it has learnt your real hours.",
  "Trajet": "Commute",
  "Un trajet, un cours, une garde ?": "A commute, a class, a shift?",
  "Tout bloc qui revient et que tu ne choisis pas. Facultatif — tu peux passer.":
    "Any block that comes back and that you do not choose. Optional — you can skip it.",
  "Trajet, cours, garde…": "Commute, class, shift…",
  "Ta semaine": "Your week",
  "Il te reste {n} h libres.": "You have {n} h free.",
  "Combien d'heures veux-tu récupérer par semaine ?":
    "How many hours a week do you want to get back?",
  "Les cases s'arrêtent à ce que ta semaine laisse de libre. Ça devient un objectif que tu pourras changer.":
    "The boxes stop at what your week leaves free. It becomes a goal you can change.",
  "Une première tâche, pour commencer": "A first task, to get started",
  "Quelque chose que tu dois vraiment faire. Elle t'attendra dans Tâches.":
    "Something you actually have to do. It will be waiting in Tasks.",
  "Ce que je fais en premier…": "What I do first…",
  "Créé par Shale pour te montrer le produit. Modifie-le, il devient tien.":
    "Created by Shale to show you around. Edit it and it becomes yours.",
  "exemple": "example",
  "Quelques exemples sont là pour te montrer le produit, dans Tâches, Notes, Journal et Savoir. Modifie-en un, il devient tien.":
    "A few examples are here to show you around, in Tasks, Notes, Journal and Knowledge. Edit one and it becomes yours.",
  "Supprimer l'exemple": "Delete the example",
  "Supprimer les {n} exemples": "Delete the {n} examples",
  "Sommeil": "Sleep",
  "Travail": "Work",
  "Trajets": "Commutes",
  "Temps libre": "Free time",
  "Ta semaine, heure par heure — {n} h libres": "Your week, hour by hour — {n} h free",
  "La revue de fin de journée": "The end-of-day review",
  "Cinq minutes, le soir, toujours au même moment. Trois questions, dans cet ordre :":
    "Five minutes, in the evening, always at the same time. Three questions, in this order:",
  "Qu'est-ce qui a avancé aujourd'hui ?": "What moved forward today?",
  "Qu'est-ce qui a coincé, et pourquoi ?": "What got stuck, and why?",
  "Quelle est la première chose à faire demain ?": "What is the first thing to do tomorrow?",
  "La troisième question est celle qui compte : c'est elle qui fait que le lendemain commence sans hésiter.":
    "The third question is the one that matters: it is what makes tomorrow start without hesitating.",
  "Faire la revue au même moment chaque soir la rend automatique. C'est aussi pour cela que l'habitude porte sur la RÉGULARITÉ de l'heure de coucher, et sur rien d'autre : une heure de coucher stable est ce qui rend le soir prévisible, donc utilisable.":
    "Doing the review at the same time every evening makes it automatic. That is also why the habit is about the REGULARITY of your bedtime, and nothing else: a stable bedtime is what makes the evening predictable, and therefore usable.",
  "Ma revue du soir — modèle": "My evening review — template",
  "Le modèle que je recopie chaque soir. La méthode est ici :":
    "The template I copy every evening. The method is here:",
  "Ce qui a avancé": "What moved forward",
  "Ce qui a coincé": "What got stuck",
  "La première chose de demain": "Tomorrow's first thing",
  "Revue de fin de journée": "End-of-day review",
  "Me coucher à heure régulière": "Go to bed at a regular time",
  "Récupérer {n} h par semaine": "Get back {n} h a week",
  "Temps": "Time",
  "C'est prêt : l'accueil se rejouera au prochain démarrage de Shale.":
    "Done: the welcome flow will play again next time Shale starts.",
  "Trois questions pour régler l'app sur ta semaine. Rien de décoratif : chaque réponse sert à quelque chose. Tu peux passer à tout moment.":
    "Three questions to tune the app to your week. Nothing decorative: every answer is used for something. You can skip at any time.",
  "Refaire l'accueil du premier démarrage": "Redo the first-launch welcome",
  "Repose tes heures de lever, de coucher et de travail. Tes données ne sont pas touchées.":
    "Sets your wake-up, bedtime and work hours again. Your data is untouched.",
  // Réglages → Apparence → Animation d'entrée
  "animation d'entrée": "entry animation",
  "Ce que Shale montre pendant qu'elle s'ouvre. Elle n'attend jamais pour faire joli : si tout est prêt avant la fin, elle abrège.":
    "What Shale shows while it opens. It never waits just to look good: if everything is ready before the end, it cuts short.",
  "Complète": "Full",
  "Courte": "Short",
  "Aucune": "None",
  "La marque grandit, ses strates se décollent, et on la traverse.":
    "The mark grows, its strata pull apart, and you pass through it.",
  "L'ouverture seule, sans l'approche. Environ trois fois plus court.":
    "The opening alone, without the approach. About three times shorter.",
  "Rien du tout : l'app apparaît dès qu'elle est prête.":
    "Nothing at all: the app appears as soon as it is ready.",

  // ── Profils de licence (2026-09-13) ─────────────────────────────────────
  "Certains modules et libellés sont fixés par la licence de ton organisation.":
    "Some modules and labels are set by your organization's licence.",
  "Libellé fixé par la licence": "Label set by the licence",
  "profil de licence simulé (démo)": "simulated licence profile (demo)",
  "aucun": "none",
  "cabinet de conseil": "consulting firm",
  "profil vide": "empty profile",
  "profil expiré": "expired profile",
  "signature altérée": "tampered signature",

  // ── Feuille de route des objectifs (2026-09-15) ─────────────────────────
  "saisie à la main": "set by hand",
  "mesurée": "measured",
  "Mesurée sur ce qui est fait : ses étapes, ses tâches, ses nombres à atteindre.": "Measured on what is done: its steps, its tasks, its numbers to reach.",
  "Rattaché directement": "Attached directly",
  "Ajouter une première étape": "Add a first step",
  "Ajouter une étape": "Add a step",
  "Déplacer « {titre} »": "Move “{titre}”",
  "Glisser pour réordonner": "Drag to reorder",
  "Replier « {titre} »": "Collapse “{titre}”",
  "Déplier « {titre} »": "Expand “{titre}”",
  "Titre de l’étape": "Step title",
  "Actions sur « {titre} »": "Actions for “{titre}”",
  "Redevenir un sous-objectif": "Turn back into a sub-goal",
  "Supprimer l’étape": "Delete step",
  "Ses sous-objectifs remontent d’un niveau, ses tâches sont déliées.": "Its sub-goals move up one level, its tasks are unlinked.",
  "Genre de l’étape": "Kind of step",
  "Sous-objectif": "Sub-goal",
  "Nom du sous-objectif — Entrée pour valider et continuer": "Sub-goal name — Enter to confirm and continue",
  "Cette étape est suivie à la main.": "This step is tracked by hand.",
  "La mesurer": "Measure it",
  "Comment cette étape avance": "How this step moves forward",
  "Compter des éléments": "Count items",
  "Atteindre un nombre": "Reach a number",
  "faite": "done",
  "à faire": "to do",
  "Une tâche récurrente n’est jamais « finie »": "A recurring task is never “finished”",
  "Elle ne compte pas comme une unité. Pour la compter, fixe un nombre à atteindre et choisis-la comme source.": "It does not count as a unit. To count it, set a number to reach and pick it as the source.",
  "Détacher « {titre} »": "Detach “{titre}”",
  "Cible": "Target",
  "Unité": "Unit",
  "séances, €, pages…": "sessions, $, pages…",
  "Compté": "Counted",
  "par une tâche récurrente": "by a recurring task",
  "par une habitude": "by a habit",
  "Retirer un": "Remove one",
  "Ajouter un": "Add one",
  "La tâche qui compte": "The task that counts",
  "L’habitude qui compte": "The habit that counts",
  "Choisir une tâche…": "Choose a task…",
  "Choisir une habitude…": "Choose a habit…",
  "{n} compté depuis le {date}": "{n} counted since {date}",
  "{n} comptés depuis le {date}": "{n} counted since {date}",
  "Créer la tâche « {titre} »": "Create the task “{titre}”",
  "quittera « {titre} »": "will leave “{titre}”",
  "saisi à la main": "set by hand",
  "Une cible de zéro ne se mesure pas. Donne-lui un nombre à atteindre.": "A target of zero can’t be measured. Give it a number to reach.",
  "L’élément qui comptait a été supprimé. Choisis une autre source, ou compte à la main.": "The item that was counting has been deleted. Choose another source, or count by hand.",
  "Aucune de ses étapes n’a encore de quoi se mesurer.": "None of its steps has anything to measure yet.",
  "Rien à mesurer pour l’instant. Rattache une tâche ou fixe un nombre à atteindre.": "Nothing to measure yet. Attach a task or set a number to reach.",
  "{n} étape": "{n} step",
  "{n} étapes": "{n} steps",
  "{faits}/{n} élément": "{faits}/{n} item",
  "{faits}/{n} éléments": "{faits}/{n} items",
  "Suivre à la main": "Track by hand",
  "Pour un objectif qui ne se découpe pas : tu règles toi-même son avancement.": "For a goal that doesn’t break down into steps: you set its progress yourself.",
  "Un titre suffit. La feuille de route viendra quand tu en auras besoin.": "A title is enough. The roadmap will come when you need it.",
  "Aucun objectif. Commence par le long terme, puis découpe-le en étapes quand tu en as besoin. Range-les par catégorie (Formation, Santé…).": "No goals yet. Start with the long term, then break it into steps when you need to. Sort them by category (Learning, Health…).",
  "Écrire n’est pas avancer": "Writing is not progressing",
  "Une note ou une fiche éclaire l’objectif, elle ne le fait pas progresser.": "A note or a card sheds light on the goal; it doesn’t move it forward.",
  "Rattacher un élément à « {titre} »": "Attach an item to “{titre}”",
  "Fiche": "Card",
  "(étape de « {titre} »)": "(step of “{titre}”)",
  "{n} étape ou tâche restante.": "{n} step or task left.",
  "{n} étapes ou tâches restantes.": "{n} steps or tasks left.",
  "Rattacher ou créer un élément…": "Attach or create an item…",

  // ── Accueil : le premier objectif et ses jalons (2026-09-16) ───────────
  "Et ces {n} h, pour quoi faire ?": "And these {n} h — what for?",
  "Un objectif à toi. Tu pourras le découper en étapes maintenant, ou plus tard.": "A goal of your own. You can break it into steps now, or later.",
  "Ce que je veux atteindre…": "What I want to reach…",
  "Ses grandes étapes (facultatif)": "Its main steps (optional)",
  "Première étape…": "First step…",
  "Étape suivante…": "Next step…",
  "La première chose à faire pour « {titre} »": "The first thing to do for “{titre}”",
  "Elle t'attendra dans Tâches, et comptera dans ta première étape.": "It will wait for you in Tasks, and count towards your first step.",
  "{n} h par semaine libérées pour ça.": "{n} h a week freed up for this.",
  "Et ce temps, pour quoi faire ?": "And this time — what for?",

  // ── Champ de date : calendrier à la Apple (2026-09-18) ────────────────────
  // ⚠️ Le gabarit de saisie est TRADUIT, pas recopié : `en-US` écrit le mois
  // d'abord, et « jj/mm/aaaa » sous un champ qui attend « 09/24/2026 » donnerait
  // un ordre faux à l'utilisateur anglais.
  "jj": "dd",
  "mm": "mm",
  "aaaa": "yyyy",
  "Demain": "Tomorrow",
  "Hier": "Yesterday",
  "Lundi prochain": "Next Monday",
  "Choisir une date": "Pick a date",
  "Retirer la date": "Remove date",
  "Revenir au mois en cours": "Back to this month",
  "Mois précédent": "Previous month",
  "Mois suivant": "Next month",
  "Effacer": "Clear",
  "Taper une date": "Type a date",
  "Date illisible": "Can’t read that date",
  "Date hors des bornes": "Date out of range",
  // Les champs que le calendrier remplace, et le mot qui dit leur vide.
  // ⚠️ « toutes » et « Sans échéance » sont en MINUSCULES et le restent : le
  // design system met en majuscules en CSS (`.hud-label`).
  "Deadline": "Deadline",
  "Sans date": "No date",
  "Sans échéance": "No due date",
  "Toujours actif": "Always active",
  // ⚠️ Minuscule : c'est le contenu d'un champ, pas la pastille « Toutes »
  // (celle-ci vaut « All »). Le dictionnaire distingue la casse.
  // Deux libellés de filtre qui s'affichaient EN FRANÇAIS dans l'app anglaise
  // jusqu'au 2026-09-18 : ils vivaient en dur dans un tableau de `TasksView`.
  "Toutes": "All",
  "Faites": "Done",

  // ── Objectifs : ajouter une tâche depuis la feuille de route (2026-09-18) ─
  "Rattacher": "Link",
  "Une tâche neuve, déjà rattachée à cette étape": "A new task, already linked to this step",
  "Rattacher quelque chose qui existe déjà": "Link something that already exists",
  "Une tâche, une note, une fiche du Savoir ou un événement.": "A task, a note, a knowledge card or an event.",
  "Chercher une tâche, une note, une fiche…": "Search a task, a note, a card…",
  "À faire pour cette étape…": "To do for this step…",
  "Nouvelle tâche pour « {titre} »": "New task for “{titre}”",
  // ── Objectifs : le vocabulaire, le premier jet, et la carte (2026-09-20) ──
  //
  // ⚠️ « Phase » remplace « Jalon » : le mot AFFICHÉ change, la clé de code
  // (`GenreEtape = "jalon" | …`) et la colonne `is_milestone` ne bougent pas.
  // Les anciennes clés « jalon » ont été retirées de ce dictionnaire le même
  // jour — les garder aurait invité une session future à ressusciter le mot.
  "Phase": "Phase",
  "En faire une phase": "Make it a phase",
  "Nom de la phase — Entrée pour valider et continuer": "Phase name — Enter to confirm and continue",
  "Une phase regroupe plusieurs sous-objectifs : « Préparer », « Tester », « Lancer ».":
    "A phase groups several sub-goals: “Prepare”, “Test”, “Launch”.",
  "Un sous-objectif est une chose à atteindre, mesurée par ses tâches ou par un nombre.":
    "A sub-goal is something to reach, measured by its tasks or by a number.",
  "Cette phase ne compte pas encore. Ajoute-lui un sous-objectif, rattache une tâche ou fixe un nombre à atteindre.":
    "This phase doesn’t count yet. Add a sub-goal, attach a task or set a number to reach.",

  // L'en-tête du bloc, et l'échéance qui se pose sur place.
  "Feuille de route": "Roadmap",
  "Échéance de « {titre} »": "Due date for “{titre}”",

  // Le premier jet, dans la fenêtre de création (jamais en modification).
  "Par quoi commencer": "Where to start",
  "Facultatif : tout se complète ensuite dans la feuille de route.":
    "Optional: everything else goes in the roadmap later.",
  "Premières étapes": "First steps",
  "ex. Préparer le plan de révision": "e.g. Prepare the study plan",
  "Étape {n}": "Step {n}",
  "Premières tâches": "First tasks",
  "ex. Réviser 1 h": "e.g. Study for 1 h",
  "Tâche suivante…": "Next task…",
  "Tâche {n}": "Task {n}",
  "Échéance de la tâche {n}": "Due date for task {n}",
  "Les tâches naissent rattachées à l’objectif : elles comptent dans son avancement, et leur échéance les fait apparaître dans le calendrier.":
    "Tasks are born linked to the goal: they count towards its progress, and their due date puts them on the calendar.",

  // La feuille de route regardée en carte mentale (lecture seule).
  "Voir en carte mentale": "View as a mind map",
  // ⚠️ « Carte » EXISTE DÉJÀ (ligne ~2356) et veut dire « Card » : c'est la
  // carte bancaire de Finance. Sans le discriminant, la seconde clé écrasait la
  // première et Finance se mettait à parler de cartes mentales — signalé par
  // `i18n:check`, qui dénonce les clés en double.
  "Carte|carte mentale": "Map",
  "La carte se lit": "This map is read-only",
  "Elle est dessinée depuis la feuille de route : c'est là qu'on la modifie.":
    "It is drawn from the roadmap: that’s where you change it.",
  "lecture": "read-only",
  "Ouvrir l'étape ou la tâche que ce nœud désigne.": "Open the step or task this node points to.",
  "Clic": "Click",
  "ouvrir": "open",
  // Le même pied, au doigt : ni clic, ni molette.
  "Appui": "Tap",
  "Glisser": "Drag",
  "les loupes zooment": "the magnifiers zoom",

  // Et l'inverse : une carte mentale devenue objectif.
  "En faire un objectif": "Turn it into a goal",
  "Le centre devient l'objectif, les branches sa feuille de route. La carte, elle, ne bouge pas.":
    "The centre becomes the goal, the branches its roadmap. The map itself doesn’t change.",
  // Le même mot dans les deux langues — la clé existe quand même, sinon
  // `i18n:check` signale un trou à chaque passage (cf. « Deadline »).
  "Horizon": "Horizon",
  "Ce qui va être créé": "What will be created",
  "Un objectif seul : la carte n’a encore aucune branche à découper.":
    "A goal on its own: the map has no branches to break down yet.",
  "Au-delà du deuxième niveau, les nœuds deviennent des tâches de l’étape qui les porte.":
    "Past the second level, nodes become tasks of the step that holds them.",
  "Créer l’objectif": "Create the goal",
  "L’objectif est créé, avec sa feuille de route.": "The goal is created, with its roadmap.",
  "La carte reste dans cette note : elle n’est pas liée à l’objectif, et la reconvertir en créerait un second.":
    "The map stays in this note: it isn’t linked to the goal, and converting it again would create a second one.",
  "Voir l’objectif": "View the goal",
  "dont {n} phase": "including {n} phase",
  "dont {n} phases": "including {n} phases",
  "{n} tâche créée": "{n} task created",
  "{n} tâches créées": "{n} tasks created",
  "{n} tâche existante rattachée": "{n} existing task linked",
  "{n} tâches existantes rattachées": "{n} existing tasks linked",
  "{n} élément cité rattaché": "{n} cited item linked",
  "{n} éléments cités rattachés": "{n} cited items linked",
  "{n} nœud vide écarté": "{n} empty node skipped",
  "{n} nœuds vides écartés": "{n} empty nodes skipped",

  // ─── Pièces jointes (chantier du 2026-09-23, migration 028) ───────────────
  // ⚠️ « Fichier » existe déjà plus haut ("File") : ne PAS le redéclarer, le
  // contrôle i18n refuse une clé écrite deux fois.
  "Joindre un fichier": "Attach a file",
  "PDF, tableur, document…": "PDF, spreadsheet, document…",
  "{nom} dépasse {max}": "{nom} is larger than {max}",
  "{nom} est vide": "{nom} is empty",
  // Menu des panneaux de grille (2026-09-25)
  "Avancer d'une place": "Move earlier",
  "Reculer d'une place": "Move later",
  "C'est déjà le premier panneau.": "It's already the first panel.",
  "C'est déjà le dernier panneau.": "It's already the last panel.",
  "Actions sur le panneau « {titre} »": "Actions for the “{titre}” panel",
  "Actions sur le panneau": "Panel actions",
  "Ce fichier n'est pas sur cet appareil : il reste sur celui où il a été joint.": "This file isn't on this device: it stays on the one it was attached from.",
  "Le fichier n'a pas pu s'ouvrir : {erreur}": "The file couldn't be opened: {erreur}",
  // ── Filet contre l'écran blanc (FiletErreur.tsx, 2026-09-26) ──
  "Shale a rencontré un problème.": "Shale ran into a problem.",
  "Ce module a rencontré un problème. Le reste de l'app fonctionne.": "This module ran into a problem. The rest of the app still works.",
  "Recharger Shale": "Reload Shale",

  // ─── Cartes : déplacement libre (chantier carte-objectifs, 2026-09-29) ──────
  "Un nœud ne peut pas se ranger sous sa propre branche.": "A node can't go under its own branch.",
  "Rattacher à un autre nœud…": "Attach to another node…",
  "Le nœud central ne se rattache à rien : tout part de lui.": "The central node isn't attached to anything: everything starts from it.",
  "Tout ce qu'on peut faire du nœud sélectionné — le même menu que le clic droit.": "Everything you can do with the selected node — the same menu as right-click.",
  "Réorganiser": "Tidy up",
  "Aucun nœud n'a été déplacé à la main : la carte est déjà rangée automatiquement.": "No node has been moved by hand: the map is already laid out automatically.",
  "Remettre toute la carte en rangement automatique. Un premier appui dit combien de nœuds bougeraient.": "Put the whole map back into automatic layout. A first press shows how many nodes would move.",
  "Le nœud déplacé à la main reprend sa place automatique. Échap annule.": "The node moved by hand goes back to its automatic place. Esc cancels.",
  "Les {n} nœuds déplacés à la main reprennent leur place automatique. Échap annule.": "The {n} nodes moved by hand go back to their automatic place. Esc cancels.",
  "Aperçu : le nœud déplacé à la main reprend sa place automatique.": "Preview: the node moved by hand goes back to its automatic place.",
  "Aperçu : les {n} nœuds déplacés à la main reprennent leur place automatique.": "Preview: the {n} nodes moved by hand go back to their automatic place.",
  "Déplacé à l'écran — la structure ne change pas": "Moved on screen — the structure doesn't change",
  "⌥ + glisser pour le rattacher ailleurs": "⌥ + drag to attach it elsewhere",
  "Choisis le nœud qui accueillera « {titre} »": "Pick the node that will take “{titre}”",
  "Clique le nœud qui doit l'accueillir.": "Click the node that should take it.",
  "Touche le nœud qui doit l'accueillir.": "Tap the node that should take it.",
  "choisir": "choose",
  "déplacer un nœud": "move a node",
  "+ glisser : le rattacher ailleurs": "+ drag: attach it elsewhere",
  "⌥ glisser": "⌥ drag",
  // ─── Cartes : types de nœud (chantier carte-objectifs, 2026-09-29) ──────────
  "Ce nœud cite déjà un objet : repasse-le en Idée d'abord.": "This node already cites an item: turn it back into an Idea first.",
  "Un nœud typé EST son objet : repasse-le en Idée pour lui donner un autre type.": "A typed node IS its item: turn it back into an Idea to give it another type.",
  "Idée": "Idea",
  "Idée — retirer le type": "Idea — remove the type",
  "C'est déjà une idée : du texte libre.": "It's already an idea: free text.",
  "Type du nœud": "Node type",
  "{n} j": "{n} d",
  "Donne d'abord un nom au nœud : c'est lui qui deviendra le titre.": "Give the node a name first: it will become the title.",
  "Tu n'as encore aucun objectif. Crée-le d'abord, dans Objectifs ou avec « En faire un objectif ».": "You don't have any goal yet. Create one first, in Goals or with “Make it a goal”.",
  "Cible en jours": "Target in days",
  "Cette carte part déjà d'un objectif : son centre en est un.": "This map already starts from a goal: its centre is one.",
  "Rien à créer — ses étapes se modifient dans sa feuille de route, ou dans sa carte.": "Nothing to create — its steps are edited in its roadmap, or in its map.",
  "Une étape par habitude, qui compte les jours tenus à partir d'aujourd'hui. Décoche pour les laisser seules.": "One step per habit, counting the days kept from today. Uncheck to leave them standalone.",
  "{n} étape ou tâche appartient déjà à un autre objectif : laissée où elle est.": "{n} step or task already belongs to another goal: left where it is.",
  "{n} étapes ou tâches appartiennent déjà à un autre objectif : laissées où elles sont.": "{n} steps or tasks already belong to another goal: left where they are.",
  "Rattacher l'habitude citée": "Attach the cited habit",
  "Rattacher les {n} habitudes citées": "Attach the {n} cited habits",
  // ─── Carte d'objectif éditable (chantier carte-objectifs, 2026-09-29) ──────
  "Pas à cet endroit : la feuille de route n'a que trois niveaux.": "Not here: the roadmap only has three levels.",
  "Une tâche, une habitude ou une note ne porte rien dessous.": "A task, a habit or a note holds nothing underneath.",
  "Habitude": "Habit",
  "Détacher": "Detach",
  "Une seconde vue de la feuille de route": "A second view of the roadmap",
  "Chaque nœud est un vrai objet : le renommer, le cocher ou le supprimer ici le fait aussi dans la feuille de route. Le glisser ne change que sa place à l'écran.": "Each node is a real item: renaming, ticking or deleting it here does it in the roadmap too. Dragging only changes where it sits on screen.",
  "feuille de route": "roadmap",
  "Renomme l'objet lui-même : la feuille de route suit.": "Renames the item itself: the roadmap follows.",
  "Retire le lien avec l'objectif : la note, elle, reste. Un premier appui montre ce qui partirait.": "Removes the link to the goal: the note itself stays. A first press shows what would go.",
  "Met l'objet dans « Supprimés récemment » (30 jours), avec ce qui pend dessous. Un premier appui montre ce qui partirait.": "Moves the item to “Recently deleted” (30 days), with what hangs below it. A first press shows what would go.",
  "Ajouter sous ce nœud": "Add under this node",
  "Appui long": "Long press",
  "les actions du nœud": "the node's actions",
  // ─── Vue Objectifs en maître-détail (chantier carte-objectifs, phase D, 2026-09-29) ──
  "Mes objectifs": "My goals",
  "Tous les objectifs": "All goals",
  "Atteint": "Reached",
  "Pas encore de feuille de route.": "No roadmap yet.",
  "Saisi à la main : la feuille de route ne compte pas.": "Set by hand: the roadmap doesn't count.",
  "La faire compter": "Make it count",
  "La même feuille de route, en carte mentale. Ce que tu y changes change ici aussi.": "The same roadmap, as a mind map. What you change there changes here too.",
  // ── Timer : horloge à volets + fenêtre séparée (2026-09-29) ──
  "Fenêtre séparée": "Separate window",
  "Ouvre le chrono dans sa propre fenêtre, à poser sur un autre écran.": "Opens the timer in its own window, to put on another screen.",
  "La fenêtre séparée n'a pas pu s'ouvrir.": "The separate window couldn't open.",
  "Le chrono continue. Raccourci : Échap": "The timer keeps running. Shortcut: Esc",
  "Raccourci : Espace": "Shortcut: Space",
  "Raccourci : F": "Shortcut: F",
  "Progression de la séance": "Session progress",
  "Revenir à Shale": "Back to Shale",
  "Ramène la fenêtre principale devant. Le chrono reste ici.": "Brings the main window to the front. The timer stays here.",
  "Garder au premier plan": "Keep on top",
  "Ne plus garder au premier plan": "Stop keeping on top",
  "La fenêtre reste visible par-dessus les autres applications.": "The window stays visible above other apps.",
  "Quitter le plein écran": "Exit full screen",
  "Session terminée": "Session finished",
  "En attente du chrono…": "Waiting for the timer…",
  // ─── Typage direct et suppression qui emporte l'objet (retours d'Antonin, 2026-09-29 au soir) ──
  "Tâche rattachée à « {objectif} ».": "Task attached to “{objectif}”.",
  "Tâche libre, dans Tâches : aucun objectif au-dessus d'elle.": "Standalone task, in Tasks: no goal above it.",
  "Phase rangée sous « {objectif} » : la feuille de route n'a que trois niveaux.": "Phase placed under “{objectif}”: the roadmap only has three levels.",
  "Sous-objectif rangé sous « {objectif} » : la feuille de route n'a que trois niveaux.": "Sub-goal placed under “{objectif}”: the roadmap only has three levels.",
  "Phase ajoutée à « {objectif} ».": "Phase added to “{objectif}”.",
  "Sous-objectif ajouté à « {objectif} ».": "Sub-goal added to “{objectif}”.",
  "Habitude dans le Journal, comptée sur {n} jours dans « {objectif} ».": "Habit in the Journal, counted over {n} days in “{objectif}”.",
  "Habitude dans le Journal.": "Habit in the Journal.",
  "Phase « {titre} » : sous quel objectif ?": "Phase “{titre}”: under which goal?",
  "Sous-objectif « {titre} » : sous quel objectif ?": "Sub-goal “{titre}”: under which goal?",
  "Aucun objectif au-dessus de ce nœud sur la carte : choisis celui qui l'accueille.": "No goal above this node on the map: choose the one that holds it.",
  // ─── Suppression en cascade : un objectif emporte ses tâches, une carte ses objets (2026-09-30) ──
  "Il part dans Supprimés récemment avec {liste}.": "It goes to Recently Deleted with {liste}.",
  "Elle part dans Supprimés récemment avec {liste}.": "It goes to Recently Deleted with {liste}.",
  "{a} et {b}": "{a} and {b}",
  "{n} sous-étape": "{n} sub-step",
  "{n} sous-étapes": "{n} sub-steps",
  "La carte quitte la note.": "The map leaves the note.",
  "Ses tâches, étapes et habitudes partent aussi dans Supprimés récemment.": "Its tasks, steps and habits go to Recently Deleted too.",
  "Carte retirée de la note, et 1 élément dans Supprimés récemment": "Map removed from the note, and 1 item in Recently Deleted",
  "Carte retirée de la note, et {n} éléments dans Supprimés récemment": "Map removed from the note, and {n} items in Recently Deleted",
  // ─── Vue Tâches rangée par moment (refonte du 2026-09-30) ──
  "À venir": "Upcoming",
  "Routines": "Routines",
  "Datées d'avant aujourd'hui, pas encore faites.": "Due before today, not done yet.",
  "Datées d'aujourd'hui, et les routines du jour.": "Due today, plus today's routines.",
  "Datées de demain ou plus tard.": "Due tomorrow or later.",
  "Ni date ni rythme : à faire quand tu peux.": "No date, no rhythm: whenever you can.",
  "Les tâches récurrentes qui ne tombent pas aujourd'hui.": "Recurring tasks that don't fall today.",
  "Les ponctuelles cochées, et les routines cochées aujourd'hui.": "One-off tasks you checked, and routines checked today.",
  "Ouvrir l'objectif": "Open the goal",
  "Ajouter une tâche…": "Add a task…",
  "Elle prendra ce tag": "It will get this tag",
  "C'est le tag que tu regardes. Retire le filtre pour ajouter sans tag.": "It's the tag you're looking at. Clear the filter to add without a tag.",
  "Gérer les tags": "Manage tags",
  "Créer un tag, choisir sa couleur, en supprimer un.": "Create a tag, pick its color, delete one.",
  "Gérer": "Manage",
  "Rechercher": "Search",
  "Rechercher une tâche": "Search tasks",
  "Effacer la recherche": "Clear search",
  "Aucun tag pour l'instant.": "No tags yet.",
  "Nom du nouveau tag": "New tag name",
  "Aucune tâche pour l'instant.": "No tasks yet.",
  "Écris-en une juste au-dessus, puis Entrée.": "Type one just above, then press Return.",
  "Aucune tâche ne correspond.": "No task matches.",
  "Effacer les filtres": "Clear filters",
  "{n} tâche aujourd'hui": "{n} task today",
  "{n} tâches aujourd'hui": "{n} tasks today",
  "{n} en retard": "{n} overdue",
  "reportée une fois": "postponed once",
  "reportée {n} fois": "postponed {n} times",
  "Afficher la dernière": "Show the last one",
  "Afficher les {n} autres": "Show {n} more",

  // ── Trading mis de côté (chantier sans-trading, 2026-09-30) ─────────────
  // Variantes affichées quand `TRADING_ACTIF` est faux ; les phrases d'origine,
  // avec le trading, restent plus haut pour le jour où il revient.
  "Bandeau performance (streak, focus)": "Performance strip (streak, focus)",
  "La jauge « énergie restante » du tableau de bord part de l'énergie de départ et baisse avec le temps passé devant l'écran aujourd'hui. Règle son point de départ et son rythme.":
    "The dashboard’s “energy left” gauge starts from your starting energy and drops with the screen time spent today. Set where it starts and how fast it drops.",
  "Idées": "Ideas",

  // ── Priorité des étapes et des tâches, feuille de route épurée (2026-09-30) ──
  // Un seul vocabulaire (« Haute / Basse » retirés) ; les phrases d'aide de la
  // feuille de route passent dans des bulles au survol prolongé.
  "Faible": "Low",
  "Élevée": "High",
  "{priorite} — passer à « {suivante} »": "{priorite} — switch to “{suivante}”",
  "Cliquer pour changer": "Click to change",
  "Modifier l'étape": "Edit step",
  "Pas encore mesurée": "Not measured yet",
  "L’étape avance à chaque tâche cochée parmi celles qui lui sont rattachées.":
    "The step moves forward with each task you check off among those attached to it.",
  "L’étape avance vers un nombre que tu fixes : 50 séances, 10 pages… compté à la main, par une tâche récurrente ou par une habitude.":
    "The step moves toward a number you set — 50 sessions, 10 pages… — counted by hand, by a recurring task or by a habit.",
  "Un événement qui revient ne compte pas": "A recurring event doesn’t count",
  "Le nombre à atteindre": "The number to reach",
  "L’étape commence à compter dès qu’il existe.": "The step starts counting as soon as it’s set.",
  "cible à zéro": "target of zero",
  "source introuvable": "source not found",
  "Une étape avance quand tu coches ses tâches, ou quand tu atteins un nombre que tu t'es fixé (50 séances, 10 pages…). Sa priorité — faible, moyenne ou élevée — dit par où commencer.":
    "A step moves forward when you check off its tasks, or when you reach a number you set (50 sessions, 10 pages…). Its priority — low, medium or high — tells you where to start.",

  // ── Un liseré par type dans la feuille de route (2026-10-01) ──
  "Légende": "Legend",

  // ── IA de Shale Pro (chantier ia-pro, 2026-09-29) ──────────────────────────
  "Passer à Shale Pro": "Upgrade to Shale Pro",
  "Inclus dans Shale Pro": "Included in Shale Pro",
  "L'intelligence artificielle fait partie de Shale Pro.": "AI is part of Shale Pro.",
  "Avec Shale Pro, l'IA rédige des propositions à partir de tes notes, tâches et objectifs. Rien n'est modifié sans ton accord : tu valides chaque proposition.": "With Shale Pro, AI drafts suggestions from your notes, tasks and goals. Nothing changes without your say-so: you approve every suggestion.",
  "Ce qui sera envoyé": "What will be sent",
  "Exactement ce contenu part vers Shale, puis vers Google, le temps de la réponse. Shale n'en garde rien.": "Exactly this content goes to Shale, then to Google, for the time it takes to answer. Shale keeps none of it.",
  "L'IA rédige…": "AI is writing…",
  "Ouvrir les Réglages": "Open Settings",
  "Découvrir Shale Pro": "Discover Shale Pro",
  "L'IA n'a rien trouvé à proposer.": "AI found nothing to suggest.",
  "Tout décocher": "Uncheck all",
  "Tout cocher": "Check all",
  "Garder cette proposition": "Keep this suggestion",
  "Valider ({n})": "Approve ({n})",
  "Tout rejeter": "Reject all",
  "{n} proposition": "{n} suggestion",
  "{n} propositions": "{n} suggestions",
  "Brief du matin et clôture du soir": "Morning brief and evening wrap-up",
  "Tes sujets suivis, ta journée, et le bilan du soir.": "The topics you follow, your day, and the evening review.",
  "Capture": "Capture",
  "Un texte, un PDF ou une image devient des tâches, des événements ou une facture à valider.": "A text, a PDF or an image becomes tasks, events or an invoice for you to approve.",
  "Tâches et objectifs": "Tasks and goals",
  "Découper, estimer, décomposer, proposer des étapes.": "Break down, estimate, decompose, suggest steps.",
  "Résumer, réécrire, traduire, développer, suggérer des liens, carte mentale.": "Summarize, rewrite, translate, expand, suggest links, mind map.",
  "Revue hebdomadaire": "Weekly review",
  "Ce qui a tenu, ce qui a glissé, trois ajustements.": "What held, what slipped, three adjustments.",
  "Ton runway expliqué, et les scénarios « et si… ».": "Your runway explained, and “what if…” scenarios.",
  "Quand tu utilises une fonction d'IA, le contenu concerné — la note, les tâches, le fichier que tu choisis — part vers Shale, puis vers Google, qui rédige la réponse avec son modèle Gemini.": "When you use an AI feature, the content involved — the note, the tasks, the file you choose — goes to Shale, then to Google, which writes the answer with its Gemini model.",
  "Pendant cet envoi, ce contenu ne profite pas du chiffrement de bout en bout : le modèle doit pouvoir le lire pour répondre. Le reste de tes données n'est pas concerné.": "While it is sent, this content is not end-to-end encrypted: the model has to be able to read it to answer. The rest of your data is not affected.",
  "Shale ne conserve ni ce qui part ni ce qui revient. Seul un compteur d'actions est gardé, sans aucun texte.": "Shale keeps neither what goes out nor what comes back. Only an action counter is kept, with no text at all.",
  "L'IA ne modifie rien seule : chaque proposition attend ta validation.": "AI changes nothing on its own: every suggestion waits for your approval.",
  "Tu peux désactiver l'IA à tout moment, en entier ou par famille.": "You can turn AI off at any time, entirely or feature by feature.",
  "Activer l'intelligence artificielle": "Turn on AI",
  "Avant de l'activer, voici ce qui se passe.": "Before you turn it on, here is what happens.",
  "Activer l'IA": "Turn on AI",
  "intelligence artificielle": "artificial intelligence",
  "Désactivée par défaut. Quand elle est active, seul le contenu que tu soumets à une fonction d'IA part vers Google, le temps de la réponse ; Shale n'en garde rien.": "Off by default. When it is on, only the content you submit to an AI feature goes to Google, for the time it takes to answer; Shale keeps none of it.",
  "Rédigée par Gemini, le modèle de Google, avec la clé de Shale : tu n'as rien à configurer.": "Written by Gemini, Google's model, with Shale's key: nothing for you to set up.",
  "{n} actions restantes sur {quota} · réinitialisation le {date}": "{n} of {quota} actions left · resets on {date}",
  "{n} actions restantes sur {quota}": "{n} of {quota} actions left",
  "{quota} actions pendant l'essai.": "{quota} actions during the trial.",
  "{quota} actions par mois.": "{quota} actions per month.",
  "[fichier {type}, {taille} Ko]": "[{type} file, {taille} KB]",
  "Cette note parle de « {titre} ». Elle pose le contexte, liste ce qui reste à trancher et se termine sur une prochaine étape.": "This note is about “{titre}”. It sets the context, lists what is still open and ends with a next step.",
  "La note est vide : il n'y a rien à résumer.": "The note is empty: there is nothing to summarize.",
  "Le contexte est posé en quelques lignes.": "The context is set in a few lines.",
  "Deux points restent ouverts.": "Two points are still open.",
  "La prochaine étape est datée.": "The next step has a date.",
  "Pas de connexion : l'IA a besoin d'internet pour répondre.": "No connection: AI needs the internet to answer.",
  "L'IA est désactivée. Tu peux l'activer dans les Réglages.": "AI is turned off. You can turn it on in Settings.",
  "Ta session a expiré. Reconnecte-toi pour utiliser l'IA.": "Your session has expired. Sign in again to use AI.",
  "Tu as utilisé toutes les actions d'IA de ton essai.": "You have used all the AI actions of your trial.",
  "Tu as utilisé toutes tes actions d'IA ce mois-ci. Elles reviennent le {date}.": "You have used all your AI actions this month. They come back on {date}.",
  "Tu as utilisé toutes tes actions d'IA ce mois-ci.": "You have used all your AI actions this month.",
  "Beaucoup de demandes d'un coup. Réessaie dans une minute.": "Lots of requests at once. Try again in a minute.",
  "L'IA est en pause pour le moment. Réessaie plus tard.": "AI is paused for now. Try again later.",
  "L'IA ne répond pas pour le moment. Réessaie dans quelques instants.": "AI isn't responding right now. Try again in a moment.",
  "C'est trop volumineux pour l'IA. Un PDF : 10 Mo et 20 pages au plus ; une image : 5 Mo.": "That's too large for AI. A PDF: 10 MB and 20 pages at most; an image: 5 MB.",
  "L'IA n'a pas pu produire une réponse utilisable. Aucune action n'a été décomptée.": "AI couldn't produce a usable answer. No action was counted.",
  "Cette demande n'a pas pu être envoyée à l'IA.": "This request couldn't be sent to AI.",
  // IA — phase C (brief du matin, clôture du soir)
  "Ouvrir la source": "Open the source",
  "Brief du jour": "Today's brief",
  "Relire": "Read again",
  "Lire en entier": "Read in full",
  "Ton brief arrive à {heure}.": "Your brief arrives at {heure}.",
  "Clôturer la journée": "Wrap up the day",
  "Rédige un nouveau brief : c'est un nouvel appel à l'IA, décompté.": "Writes a new brief: it is a new AI request, and it counts.",
  "Rédigé par l'IA à partir de tes sources et de ton agenda. Chaque point renvoie à son article.": "Written by AI from your sources and your calendar. Each point links to its article.",
  "À une date": "On a date",
  "Plus tard (sans date)": "Later (no date)",
  "Clôture de la journée": "Day wrap-up",
  "Rien à reporter : tout ce qui était prévu pour aujourd'hui est fait, ou n'avait pas de date.": "Nothing to reschedule: everything planned for today is done, or had no date.",
  "Appliquer ({n})": "Apply ({n})",
  "L'IA n'a rien proposé pour les tâches restantes.": "AI suggested nothing for the remaining tasks.",
  "Que faire de cette tâche ?": "What to do with this task?",
  "Nouvelle date": "New date",
  "Nom du sujet (ex. : IA, ma ville, le rugby)": "Topic name (e.g. AI, my city, rugby)",
  "Retirer ce sujet": "Remove this topic",
  "Retirer cette source": "Remove this source",
  "Ajouter une source du catalogue": "Add a source from the catalogue",
  "Ajouter une source…": "Add a source…",
  "ou l'adresse d'un flux RSS (https://…)": "or an RSS feed address (https://…)",
  "Adresse d'un flux RSS": "RSS feed address",
  "Sujets du brief": "Brief topics",
  "Jusqu'à cinq sujets. Pour chacun, des sources du catalogue ou tes propres flux RSS : l'IA en tire trois à cinq points, chacun avec le lien de son article.": "Up to five topics. For each, sources from the catalogue or your own RSS feeds: AI draws three to five points from them, each with a link to its article.",
  "Ajouter un sujet": "Add a topic",
  "Brief à": "Brief at",
  "Clôture proposée à": "Wrap-up suggested at",
  "Démonstration : ici, un fait tiré d'un article de tes sources, en une ou deux phrases.": "Demo: here, a fact drawn from an article in your sources, in one or two sentences.",
  "Démonstration : chaque point renvoie à l'article dont il vient.": "Demo: each point links to the article it comes from.",
  "Démonstration : aucune source n'est inventée, le serveur le vérifie.": "Demo: no source is made up; the server checks it.",
  "Ta journée est chargée : {n} tâches prévues. Commence par « {p} », et choisis ce qui peut attendre.": "Your day is packed: {n} tasks planned. Start with “{p}”, and choose what can wait.",
  "ta priorité": "your priority",
  "Journée tenable. Ta priorité : « {p} ».": "A manageable day. Your priority: “{p}”.",
  "Rien d'inscrit aujourd'hui : une journée libre à organiser.": "Nothing scheduled today: a free day to organize.",
  "Reportée plusieurs fois : peut-être plus d'actualité.": "Postponed several times: maybe no longer relevant.",
  "Prioritaire : à reprendre dès demain.": "High priority: pick it up tomorrow.",
  "Peut attendre deux jours.": "Can wait two days.",
  "{n} tâche faite aujourd'hui.": "{n} task done today.",
  "{n} tâches faites aujourd'hui.": "{n} tasks done today.",
  "{n} tâche reste.": "{n} task remains.",
  "{n} tâches restent.": "{n} tasks remain.",
  "Le brief de ce matin a déjà été rédigé sur un autre appareil : il arrive avec la synchronisation.": "This morning's brief was already written on another device: it arrives with sync.",
  "Actualité": "News",
  "Tech et IA": "Tech and AI",
  "Économie": "Economy",
  "Sciences": "Science",
  "Culture": "Culture",
  "Brief du jour (IA, Shale Pro)": "Today's brief (AI, Shale Pro)",
  // IA — phase D (capture)
  "Ce type de fichier n'est pas pris en charge : un PDF, ou une image PNG, JPEG, WebP ou HEIC.": "This file type isn't supported: a PDF, or a PNG, JPEG, WebP or HEIC image.",
  "Ce fichier est trop volumineux : 10 Mo pour un PDF, 5 Mo pour une image.": "This file is too large: 10 MB for a PDF, 5 MB for an image.",
  "Ce PDF a plus de 20 pages : l'IA n'en lit pas davantage.": "This PDF has more than 20 pages: AI doesn't read further.",
  "Ce fichier n'a pas pu être lu.": "This file couldn't be read.",
  "à vérifier": "to check",
  "n° {n}": "no. {n}",
  "HT {ht} · TVA {tva} · TTC {ttc}": "Excl. tax {ht} · VAT {tva} · Incl. tax {ttc}",
  "HT + TVA ne donne pas le TTC (écart de {e}) : vérifie les montants.": "Net + VAT doesn't add up to the gross total (off by {e}): check the amounts.",
  "Deviendra une facture d'achat en brouillon, dans Finance → Facturation. Montants à vérifier.": "Will become a draft purchase invoice, in Finance → Invoicing. Amounts to check.",
  "L'IA n'a rien trouvé à extraire de ce contenu.": "AI found nothing to extract from this content.",
  "Vide ta tête": "Clear your head",
  "L'IA n'a trouvé aucune action dans ce texte.": "AI found no action in this text.",
  "Capturer avec l'IA": "Capture with AI",
  "Capturer avec l'IA…": "Capture with AI…",
  "Coller ou déposer": "Paste or drop",
  "Une précision sur le fichier ? (facultatif)": "Anything to add about the file? (optional)",
  "Colle un e-mail, un message, un compte rendu… ou dépose un PDF ou une image ici.": "Paste an email, a message, meeting notes… or drop a PDF or an image here.",
  "Texte à analyser": "Text to analyze",
  "Choisir un fichier…": "Choose a file…",
  "Tout ce que tu as en tête, en vrac : l'IA en fait des tâches, que tu valides.": "Everything on your mind, in any order: AI turns it into tasks, which you approve.",
  "Ce que tu as en tête": "What's on your mind",
  "Faire des tâches": "Make tasks",
  "Analyser": "Analyze",
  "Créer {n} tâche": "Create {n} task",
  "Créer {n} tâches": "Create {n} tasks",
  "{n} page": "{n} page",
  "{n} pages": "{n} pages",
  "{titre} — n° {numero}": "{titre} — no. {numero}",
  "Saisie par l'IA à partir d'un document : montants à vérifier.": "Entered by AI from a document: amounts to check.",
  "Appeler le comptable": "Call the accountant",
  "Préparer la réunion de lundi": "Prepare Monday's meeting",
  "Trier les photos de vacances": "Sort the holiday photos",
  "Renvoyer le contrat signé": "Send back the signed contract",
  "Point avec l'agence": "Check-in with the agency",
  "Facture hébergement": "Hosting invoice",
  "Un e-mail, un PDF, une photo de reçu ou du vrac : l'IA propose des tâches, rendez-vous et achats à valider.": "An email, a PDF, a photo of a receipt or a brain dump: AI suggests tasks, appointments and purchases for you to approve.",
  "Capturer": "Capture",
  "Rendez-vous": "Appointment",
  "Achat": "Purchase",

  // ── IA, phase E : tâches et objectifs ──────────────────────────────────────
  "Découper « {titre} »": "Break down “{titre}”",
  "Cette tâche est déjà concrète : l'IA ne propose pas de la découper.": "This task is already concrete: AI has nothing to break down.",
  "Découper": "Break down",
  "L'IA propose des étapes concrètes. Chacune devient une tâche, reliée à celle-ci.": "AI suggests concrete steps. Each one becomes a task, linked to this one.",
  "Elles rejoignent l'objectif « {o} ».": "They join the goal “{o}”.",
  "Elles portent l'étiquette « {e} ».": "They carry the tag “{e}”.",
  "La tâche d'origine reste : à toi de voir si elle a encore un sens.": "The original task stays: it's up to you whether it still makes sense.",
  "Lecture de l'historique du Timer…": "Reading the Timer history…",
  "Pas assez d'historique pour estimer cette tâche.": "Not enough history to estimate this task.",
  "Lance le Timer sur tes tâches : l'estimation viendra avec l'historique.": "Run the Timer on your tasks: estimates will come with the history.",
  "Estimer": "Estimate",
  "Environ {a}": "About {a}",
  "Entre {a} et {b}": "Between {a} and {b}",
  "Durées du Timer, pauses comprises.": "Timer durations, breaks included.",
  "L'IA n'a retenu aucun comparable : pas d'estimation.": "AI kept no comparable task: no estimate.",
  "par occurrence": "per occurrence",
  "Estimer « {titre} »": "Estimate “{titre}”",
  "Étape": "Step",
  "L'objectif lui-même": "The goal itself",
  "Décomposer « {titre} »": "Break “{titre}” into sub-goals",
  "Tâches pour « {titre} »": "Tasks for “{titre}”",
  "Lecture du calendrier…": "Reading the calendar…",
  "Cette étape est déjà au dernier niveau de la feuille de route : on ne peut plus la découper en sous-objectifs. Propose-lui plutôt des tâches.": "This step is already at the last level of the roadmap: it can't be split into sub-goals. Suggest tasks for it instead.",
  "Décomposer": "Break into sub-goals",
  "L'IA propose des sous-objectifs, ajoutés après les étapes existantes de la feuille de route.": "AI suggests sub-goals, added after the roadmap's existing steps.",
  "Leurs échéances tiennent avant le {d}, en tenant compte de ton calendrier.": "Their deadlines fit before {d}, taking your calendar into account.",
  "Les échéances suivent l'horizon de l'objectif et ton calendrier.": "Deadlines follow the goal's horizon and your calendar.",
  "Proposer des tâches": "Suggest tasks",
  "L'IA propose les prochaines tâches concrètes, datées selon ton calendrier et rattachées à l'objectif ou à l'une de ses étapes.": "AI suggests the next concrete tasks, dated around your calendar and attached to the goal or one of its steps.",
  "« {titre} » en péril": "“{titre}” at risk",
  "Cet objectif n'est plus en péril : rien à expliquer.": "This goal is no longer at risk: nothing to explain.",
  "L'IA n'a pas proposé de tâche de rattrapage.": "AI suggested no catch-up task.",
  "Pourquoi, et que faire ?": "Why, and what to do?",
  "L'IA reçoit les faits calculés par Shale — avancement, échéance, étapes et tâches restantes, rythme des quatorze derniers jours — et propose un plan de rattrapage en tâches à valider.": "AI receives the facts Shale computed — progress, deadline, remaining steps and tasks, pace over the last fourteen days — and suggests a catch-up plan as tasks for you to approve.",
  "{n} tâche créée, reliée à « {titre} »": "{n} task created, linked to “{titre}”",
  "{n} tâches créées, reliées à « {titre} »": "{n} tasks created, linked to “{titre}”",
  "Il faut au moins {min} tâches comparables suivies au Timer (même étiquette, même objectif ou mots en commun) ; il y en a {n}.": "It takes at least {min} comparable tasks tracked with the Timer (same tag, same goal or shared words); there are {n}.",
  "{n} tâche comparable trouvée dans ton historique Timer. L'IA choisit celles qui ressemblent vraiment à celle-ci ; la fourchette est calculée sur ton temps réel.": "{n} comparable task found in your Timer history. AI picks the ones that really resemble this one; the range is computed from your actual time.",
  "{n} tâches comparables trouvées dans ton historique Timer. L'IA choisit celles qui ressemblent vraiment à celle-ci ; la fourchette est calculée sur ton temps réel.": "{n} comparable tasks found in your Timer history. AI picks the ones that really resemble this one; the range is computed from your actual time.",
  "Médiane {m}, sur {n} tâche comparable.": "Median {m}, over {n} comparable task.",
  "Médiane {m}, sur {n} tâches comparables.": "Median {m}, over {n} comparable tasks.",
  "Créer {n} sous-objectif": "Create {n} sub-goal",
  "Créer {n} sous-objectifs": "Create {n} sub-goals",
  "Découper avec l'IA…": "Break down with AI…",
  "Estimer la durée…": "Estimate duration…",
  "Décomposer avec l'IA…": "Break into sub-goals with AI…",
  "Proposer des tâches avec l'IA…": "Suggest tasks with AI…",
  "Lister ce qui est déjà prêt et ce qui manque": "List what's ready and what's missing",
  "Préparer la première version en 45 minutes": "Prepare a first version in 45 minutes",
  "Relire, corriger et envoyer": "Proofread, fix and send",
  "Démonstration : ces tâches passées portent la même étiquette et un travail de même ampleur.": "Demo: these past tasks share the same tag and a similar amount of work.",
  "Périmètre défini et validé": "Scope defined and approved",
  "Première version livrée": "First version delivered",
  "Retours intégrés, version finale": "Feedback applied, final version",
  "Bloquer une heure pour faire le point": "Block an hour to take stock",
  "Préparer la prochaine étape": "Prepare the next step",
  "Demander un retour à une personne concernée": "Ask someone involved for feedback",
  "Démonstration : l'échéance est passée et l'objectif est à {pct} %. Au rythme des quatorze derniers jours (tâches faites : {f}), il faut soit décaler l'échéance, soit réduire le périmètre.": "Demo: the deadline has passed and the goal is at {pct}%. At the pace of the last fourteen days (tasks done: {f}), either the deadline moves or the scope shrinks.",
  "Démonstration : l'échéance approche (jours restants : {j}) et l'objectif est à {pct} %. Au rythme des quatorze derniers jours (tâches faites : {f}), le compte ne tombe pas : il faut concentrer l'effort sur l'essentiel.": "Demo: the deadline is close (days left: {j}) and the goal is at {pct}%. At the pace of the last fourteen days (tasks done: {f}), the numbers don't add up: focus on what matters most.",
  "Choisir les deux étapes qui comptent vraiment": "Pick the two steps that really matter",
  "Avancer la première étape restante": "Move the first remaining step forward",
  "Décider : décaler l'échéance ou réduire le périmètre": "Decide: move the deadline or shrink the scope",
  "L'échéance de l'objectif est déjà passée : les sous-objectifs sont datés à partir d'aujourd'hui.": "The goal's deadline has already passed: sub-goals are dated from today.",

  // ── IA, phase F : les notes ────────────────────────────────────────────────
  "IA": "AI",
  "Résumer, réécrire, relier, développer, traduire, faire une carte. Tu valides avant que rien ne change.": "Summarize, rewrite, link, expand, translate, make a mind map. You approve before anything changes.",
  "Actions d'IA sur la note": "AI actions on the note",
  "Résumer la note": "Summarize the note",
  "Insérer en tête de la note": "Insert at the top of the note",
  "Fermer sans insérer": "Close without inserting",
  "Résumé": "Summary",
  "Résumer": "Summarize",
  "L'IA résume la note en quelques phrases et en points clés. Tu choisis ensuite de poser le résumé en tête de la note, ou de simplement le lire.": "AI summarizes the note in a few sentences and key points. You then choose to put the summary at the top of the note, or just read it.",
  "Réécrire la sélection": "Rewrite the selection",
  "Réécrire la note": "Rewrite the note",
  "Il n'y a pas de texte à réécrire.": "There is no text to rewrite.",
  "Cette note contient des blocs ou des liens @ (carte, image, fichier, mention) qu'une réécriture complète détruirait. Sélectionne le passage à réécrire, puis relance.": "This note contains blocks or @ links (mind map, image, file, mention) that a full rewrite would destroy. Select the passage to rewrite, then try again.",
  "Ce texte est trop long pour être réécrit d'un coup. Sélectionne un passage plus court.": "This text is too long to rewrite in one go. Select a shorter passage.",
  "Avant": "Before",
  "Après": "After",
  "La mise en forme en ligne (gras, couleurs) n'est pas conservée. Après acceptation, « Annuler » (⌘Z) dans la note revient au texte d'avant.": "Inline formatting (bold, colors) is not kept. After accepting, Undo (⌘Z) in the note brings the previous text back.",
  "Accepter": "Accept",
  "Réécrire": "Rewrite",
  "L'IA propose une nouvelle version, affichée à côté de l'originale. Rien ne change dans la note avant que tu acceptes.": "AI suggests a new version, shown next to the original. Nothing changes in the note until you accept.",
  "Développer la sélection": "Expand the selection",
  "Sélectionne d'abord les puces à développer.": "Select the bullets to expand first.",
  "La sélection est trop longue : développer part de quelques puces.": "The selection is too long: expanding starts from a few bullets.",
  "Insérer après la sélection": "Insert after the selection",
  "Développer": "Expand",
  "L'IA rédige un texte à partir des puces sélectionnées, sans rien y ajouter de son cru. Le texte arrive en proposition, à insérer après la sélection.": "AI writes a text from the selected bullets, adding nothing of its own. The text comes as a suggestion, to insert after the selection.",
  "Suggérer des liens @": "Suggest @ links",
  "La note est vide : il n'y a rien à relier.": "The note is empty: there is nothing to link.",
  "Recherche des objets proches de cette note…": "Looking for items close to this note…",
  "Aucun objet de Shale ne ressemble à cette note : rien à relier. Aucune action n'a été consommée.": "No Shale item resembles this note: nothing to link. No action was used.",
  "Ce passage n'est plus dans la note : lien non posé.": "This passage is no longer in the note: link not added.",
  "L'IA n'a trouvé aucun lien pertinent.": "AI found no relevant link.",
  "Plus de suggestion.": "No more suggestions.",
  "Relier": "Link",
  "Ignorer": "Ignore",
  "Le lien @ est posé juste après le passage. Rien n'est relié sans ton clic.": "The @ link is placed right after the passage. Nothing is linked without your click.",
  "Suggérer des liens": "Suggest links",
  "Traduire en {langue}": "Translate into {langue}",
  "La note est vide : il n'y a rien à traduire.": "The note is empty: there is nothing to translate.",
  "Cette note est trop longue pour être traduite d'un coup.": "This note is too long to translate in one go.",
  "Traduction créée : « {titre} »": "Translation created: “{titre}”",
  "Créer la note traduite": "Create the translated note",
  "Traduire": "Translate",
  "La traduction devient une nouvelle note, reliée à celle-ci. L'originale n'est pas modifiée.": "The translation becomes a new note, linked to this one. The original is not changed.",
  "Les blocs (carte, image, fichier) ne sont pas repris ; les liens @ deviennent du texte.": "Blocks (mind map, image, file) are not carried over; @ links become plain text.",
  "Faire une carte mentale": "Make a mind map",
  "La note est vide : il n'y a rien à mettre en carte.": "The note is empty: there is nothing to map.",
  "Cet éditeur ne porte pas de carte mentale.": "This editor has no mind maps.",
  "La carte est insérée en fin de note, comme un bloc normal : double-clic pour la modifier.": "The map is inserted at the end of the note, as a regular block: double-click to edit it.",
  "Insérer la carte": "Insert the map",
  "L'IA n'a pas trouvé de structure à mettre en carte.": "AI found no structure to map.",
  "Faire la carte": "Make the map",
  "L'IA dégage la structure de la note : une idée centrale, des branches, leurs détails. Tu vois le plan avant de l'insérer.": "AI draws out the note's structure: a central idea, branches, their details. You see the outline before inserting it.",
  "{n} suggestion": "{n} suggestion",
  "{n} suggestions": "{n} suggestions",
  "Shale a trouvé {n} objet proche de cette note. L'IA ne voit que cette liste et propose où le citer ; tu acceptes ou refuses chaque lien.": "Shale found {n} item close to this note. AI only sees this list and suggests where to cite it; you accept or refuse each link.",
  "Shale a trouvé {n} objets proches de cette note. L'IA ne voit que cette liste et propose où les citer ; tu acceptes ou refuses chaque lien.": "Shale found {n} items close to this note. AI only sees this list and suggests where to cite them; you accept or refuse each link.",
  "Plus clair": "Clearer",
  "Plus court": "Shorter",
  "Ton professionnel": "Professional tone",
  "Espagnol": "Spanish",
  "Allemand": "German",
  "Italien": "Italian",
  "Portugais": "Portuguese",
  "Traduire la note": "Translate the note",
  "(reformulé)": "(rephrased)",
  "Démonstration : ici, l'IA rédige deux à cinq phrases qui développent cette puce, sans rien ajouter qui n'y figure pas.": "Demo: here, AI writes two to five sentences expanding this bullet, adding nothing that isn't in it.",
  "Précision": "Detail",
  // ── IA sans Finance (2026-10-01) ───────────────────────────────────────────
  "Deviendra une note qui garde ces montants, à vérifier.": "Will become a note that keeps these amounts, to check.",
  "Un texte, un PDF ou une image devient des tâches, des événements ou des notes à valider.": "A text, a PDF or an image becomes tasks, events or notes for you to approve.",
  "Fournisseur": "Supplier",
  "Numéro": "Number",
  "HT": "Excl. tax",
  "TTC": "Incl. tax",
  // ── IA, phase G : la revue hebdomadaire ────────────────────────────────────
  "du {a} au {b}": "{a} to {b}",
  "Tâche créée : « {titre} »": "Task created: “{titre}”",
  "Ce qui a tenu": "What held",
  "Ce qui a glissé": "What slipped",
  "Trois ajustements": "Three adjustments",
  "Tâche créée": "Task created",
  "En faire une tâche": "Make it a task",
  "Générée le {d}.": "Generated on {d}.",
  "Régénérer ({n} actions)": "Regenerate ({n} actions)",
  "Shale calcule les faits de ta semaine — complétion, focus, objectifs, tâches reportées — et l'IA rédige ce qui a tenu, ce qui a glissé et trois ajustements, que tu peux transformer en tâches.": "Shale computes the facts of your week — completion, focus, goals, postponed tasks — and AI writes what held, what slipped and three adjustments, which you can turn into tasks.",
  "Inclure l'humeur et l'énergie de mon Journal": "Include mood and energy from my Journal",
  "Seules les notes de 1 à 5 partent, jamais le texte de tes entrées. Décoché par défaut.": "Only the 1-to-5 ratings are sent, never the text of your entries. Off by default.",
  "Générer la revue": "Generate the review",
  "Compte pour {n} actions.": "Counts as {n} actions.",
  "Pas de revue pour cette semaine.": "No review for this week.",
  "Démonstration : {f} tâches faites sur {p} prévues ({t} %), et {m} minutes de focus sur {j} jours.": "Demo: {f} tasks done out of {p} planned ({t}%), and {m} minutes of focus over {j} days.",
  "Démonstration : des tâches ont glissé (nombre : {n}). La plus reportée : « {t} ».": "Demo: some tasks slipped (count: {n}). The most postponed: “{t}”.",
  "Démonstration : rien n'a glissé cette semaine.": "Demo: nothing slipped this week.",
  "Bloquer deux matinées de focus sans réunion": "Block two meeting-free focus mornings",
  "Le focus tient mieux les jours où il est posé tôt.": "Focus holds better on days when it is scheduled early.",
  "Décider du sort de la tâche la plus reportée": "Decide what to do with the most postponed task",
  "Une tâche qui glisse chaque semaine est une décision à prendre.": "A task that slips every week is a decision to make.",
  "Choisir l'objectif de la semaine": "Pick the goal of the week",
  "Un objectif nommé le lundi avance davantage.": "A goal named on Monday moves further.",
  "Le dimanche soir, si la revue de la semaine n'a pas encore été générée. Elle ne se génère jamais seule.": "On Sunday evening, if the weekly review has not been generated yet. It never generates on its own.",
  "Copie impossible ici : sélectionne et copie à la main.": "Copying isn't possible here: select and copy by hand.",
  "Importer une checklist": "Import a checklist",
  "Demande-la à l'IA de ton choix, colle sa réponse : elle devient un objectif avec ses étapes et ses tâches.": "Ask the AI of your choice, paste its answer: it becomes a goal with its steps and tasks.",
  "1 · Demander à l'IA": "1 · Ask the AI",
  "Ce que tu veux planifier (facultatif)": "What you want to plan (optional)",
  "Consigne copiée": "Prompt copied",
  "Copier la consigne": "Copy the prompt",
  "Colle la consigne dans ChatGPT, Claude, Gemini… puis reviens ici avec sa réponse.": "Paste the prompt into ChatGPT, Claude, Gemini… then come back here with its answer.",
  "2 · Coller la réponse": "2 · Paste the answer",
  "Rien d'exploitable : il faut au moins une étape (##) ou une tâche (- [ ]).": "Nothing usable: it needs at least one step (##) or one task (- [ ]).",
  "Importer": "Import",
  "{n} ligne ignorée": "{n} line ignored",
  "{n} lignes ignorées": "{n} lines ignored",
  "Demande-la à une IA, colle sa réponse : elle devient un objectif.": "Ask an AI, paste its answer: it becomes a goal.",
  "# Mon objectif\n## Une étape\n- [ ] Une tâche @2026-12-01 !haute": "# My goal\n## A step\n- [ ] A task @2026-12-01 !high",
  "Ce fichier est trop gros pour une checklist.": "This file is too big for a checklist.",
  "Choisir un fichier (.md, .txt)": "Choose a file (.md, .txt)",
  // ─── Contenu de départ refondu (2026-10-05) ───
  "Comment marche Shale":
    "How Shale works",
  "Les modules en une minute":
    "The modules in one minute",
  "Shale rassemble ce que tu fais, ce que tu vises et ce que tu retiens. Chaque module a un rôle :":
    "Shale brings together what you do, what you aim for and what you keep. Each module has a role:",
  "ce qui t'attend maintenant.":
    "what is waiting for you right now.",
  "tout ce que tu dois faire, rangé par moment. Une tâche peut se répéter.":
    "everything you have to do, sorted by moment. A task can repeat.",
  "il ne stocke rien, il rassemble tes tâches, tes créneaux et tes habitudes.":
    "it stores nothing, it gathers your tasks, your slots and your habits.",
  "des sessions de concentration, avec un chrono.":
    "focus sessions, with a timer.",
  "un cap, découpé en étapes et en tâches ; l'avancement se calcule tout seul.":
    "a direction, split into steps and tasks; progress works itself out.",
  "tes statistiques de la semaine.":
    "your stats for the week.",
  "du texte libre ; tape @ pour citer une tâche, un objectif ou une fiche.":
    "free text; type @ to cite a task, a goal or a card.",
  "tes habitudes, une case par jour à cocher.":
    "your habits, one box a day to tick.",
  "ce que tu veux garder, rangé par sujet. Cette fiche en fait partie.":
    "what you want to keep, filed by subject. This card is part of it.",
  "Rien n'est obligatoire : commence par les Tâches, et ajoute un module quand tu en as besoin.":
    "Nothing is compulsory: start with Tasks, and add a module when you need it.",
  "Tâche, objectif, étape : qui contient quoi":
    "Task, goal, step: what contains what",
  "Trois niveaux, du plus large au plus petit :":
    "Three levels, from the widest to the smallest:",
  "ce que tu veux atteindre, par exemple « Publier mon site ».":
    "what you want to achieve, for example “Publish my website”.",
  "un morceau de l'objectif, par exemple « Écrire les textes ». Sa priorité — faible, moyenne ou élevée — dit par où commencer. Une étape qui en regroupe d'autres s'appelle une phase.":
    "a piece of the goal, for example “Write the copy”. Its priority — low, medium or high — says where to start. A step that groups other steps is called a phase.",
  "un geste concret qu'on coche, par exemple « Rédiger la page d'accueil ». Elle se rattache à une étape.":
    "a concrete action you tick off, for example “Write the home page”. It belongs to a step.",
  "Quand tu coches les tâches, l'étape avance ; quand les étapes avancent, l'objectif avance. Tu n'as jamais à saisir un pourcentage.":
    "When you tick tasks, the step moves forward; when steps move forward, the goal moves forward. You never have to enter a percentage.",
  "Deep Work":
    "Deep Work",
  "Travailler en profondeur : mode d'emploi":
    "Working in depth: how-to",
  "Le travail en profondeur, c'est une période sans interruption sur une seule chose exigeante. Mode d'emploi :":
    "Deep work is an uninterrupted stretch spent on one demanding thing. How to do it:",
  "Choisis un seul sujet et écris-le en une phrase avant de commencer.":
    "Pick a single subject and write it in one sentence before you start.",
  "Réserve un bloc de 60 à 90 minutes, à un moment où tu as de l'énergie.":
    "Set aside a 60 to 90 minute block, at a time when you have energy.",
  "Coupe les notifications et ferme tout ce qui ne sert pas ce sujet.":
    "Turn off notifications and close everything that does not serve this subject.",
  "Lance le Timer de Shale : le chrono t'évite de surveiller l'heure.":
    "Start Shale's Timer: the countdown saves you from watching the clock.",
  "À la fin, écris deux lignes : ce qui a avancé, et par où reprendre.":
    "At the end, write two lines: what moved forward, and where to pick up.",
  "Un ou deux blocs par jour, c'est déjà beaucoup. Mieux vaut un bloc tenu que quatre prévus.":
    "One or two blocks a day is already a lot. One block kept beats four planned.",
  "Mindset":
    "Mindset",
  "Faire la revue au même moment chaque soir la rend automatique.":
    "Doing the review at the same time every evening makes it automatic.",
  "Exemple · ceci est une note":
    "Example · this is a note",
  "Une note, c'est du texte libre : une idée, un compte rendu, une liste. Tape @ pour citer une tâche, un objectif ou une fiche du Savoir — le lien se voit des deux côtés. Ici, la fiche citée est :":
    "A note is free text: an idea, a write-up, a list. Type @ to cite a task, a goal or a Knowledge card — the link shows on both sides. Here, the card cited is:",
  "La tâche « Exemple · tâche répétée chaque jour » est reliée à cette note : ouvre-la pour voir le lien.":
    "The task “Example · task repeated every day” is linked to this note: open it to see the link.",
  "Tu peux tout effacer et écrire ta propre note.":
    "You can erase everything and write your own note.",
  "Modèle · ma revue du soir":
    "Template · my evening review",
  "Exemple · tâche répétée chaque jour":
    "Example · task repeated every day",
  "Exemple · ceci est une tâche, rattachée à une étape":
    "Example · this is a task, attached to a step",
  "Exemple · ceci est un objectif":
    "Example · this is a goal",
  "Un objectif est un cap. Il se découpe en étapes, et chaque étape en tâches : l'avancement se calcule tout seul quand tu coches les tâches. Supprime-le quand tu as compris.":
    "A goal is a direction. It splits into steps, and each step into tasks: progress works itself out as you tick tasks. Delete it once you have understood.",
  "Exemple · ceci est une étape":
    "Example · this is a step",
  "Une étape est un morceau de l'objectif. Sa priorité (faible, moyenne, élevée) dit par où commencer.":
    "A step is a piece of the goal. Its priority (low, medium, high) says where to start.",
  "Exemple · une seconde étape":
    "Example · a second step",
  "Une étape avance quand ses tâches sont cochées.":
    "A step moves forward when its tasks are ticked.",
  "Exemple · habitude à cocher chaque jour":
    "Example · habit to tick every day",

  // ── Objectifs : la liste, la page, et le fil (2026-10-08) ──
  "Revenir à la liste": "Back to the list",
  "Arrivée": "Finish",

  // ── Performance : période unique, courbes, « À améliorer » (2026-10-09) ──
  "7 j": "7 d",
  "30 j": "30 d",
  "7 derniers jours": "Last 7 days",
  "30 derniers jours": "Last 30 days",
  "3 derniers mois": "Last 3 months",
  "6 derniers mois": "Last 6 months",
  "Période analysée": "Period analysed",
  "Tout l'onglet suit cette période, et se compare à la même durée juste avant.":
    "The whole tab follows this period, and compares it with the same length of time just before.",
  "Tâches tenues": "Tasks done",
  "Habitudes tenues": "Habits kept",
  "Série en cours": "Current streak",
  "record {n} j": "best {n} d",
  "vs période d'avant": "vs previous period",
  "stable": "steady",
  "{tenus}/{comptes} j": "{tenus}/{comptes} d",
  "{n} pt": "{n} pt",
  "{n} pts": "{n} pts",
  "À améliorer": "To improve",
  "Rien ne décroche sur cette période.": "Nothing is slipping over this period.",
  "{n} tâche reportée au moins deux fois, toujours pas faite.":
    "{n} task postponed at least twice, still not done.",
  "{n} tâches reportées au moins deux fois, toujours pas faites.":
    "{n} tasks postponed at least twice, still not done.",
  "Voir les tâches": "See tasks",
  "« {nom} » : tenue {pct} % du temps, contre {avant} % la période d'avant.":
    "“{nom}”: kept {pct}% of the time, against {avant}% the period before.",
  "« {nom} » : tenue {pct} % du temps.": "“{nom}”: kept {pct}% of the time.",
  "Ouvrir le Journal": "Open the Journal",
  "Le {jour} : {pct} % de tes tâches faites, contre {moyenne} % en moyenne.":
    "{jour}: {pct}% of your tasks done, against {moyenne}% on average.",
  "Le {jour} : {pct} % de tes habitudes tenues, contre {moyenne} % en moyenne.":
    "{jour}: {pct}% of your habits kept, against {moyenne}% on average.",
  "Voir le calendrier": "See the calendar",
  "Tâches tenues : {valeur} %, soit {n} pts de moins que la période d'avant.":
    "Tasks done: {valeur}%, {n} pts lower than the period before.",
  "Habitudes tenues : {valeur} %, soit {n} pts de moins que la période d'avant.":
    "Habits kept: {valeur}%, {n} pts lower than the period before.",
  "Focus : {minutes}, contre {avant} la période d'avant.":
    "Focus: {minutes}, against {avant} the period before.",
  "Ouvrir le Timer": "Open the Timer",
  "discipline — tâches": "discipline — tasks",
  "discipline — habitudes": "discipline — habits",
  "80 % : jour tenu": "80%: day held",
  "régularité — un carré par jour": "regularity — one square per day",
  "moyenne 7 jours": "7-day average",
  "jour par jour": "day by day",
  "ce jour-là": "that day",
  "Pas encore assez de jours pour tracer une courbe.": "Not enough days yet to draw a curve.",
  "Ajoute une habitude dans le Journal pour suivre ta régularité ici.":
    "Add a habit in the Journal to follow your regularity here.",
  "{n} jour d'affilée": "{n} day in a row",
  "{n} jours d'affilée": "{n} days in a row",
  "par jour de la semaine": "by day of the week",
  "Rien à comparer sur cette période.": "Nothing to compare over this period.",
  "focus — par jour": "focus — per day",
  "focus — par semaine": "focus — per week",
  "Aucune séance de focus sur cette période.": "No focus session over this period.",
  "focus par tag": "focus by tag",
  "Focus": "Focus",
  "focus": "focus",
  "habitudes": "habits",
};
