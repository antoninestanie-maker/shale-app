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
  "Benchmark": "Benchmark",
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
  "7 derniers jours": "Last 7 days",
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
  "Aller au Human Benchmark": "Go to Human Benchmark",
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
  "Supprimer la tâche": "Delete task",
  "Un second clic supprime la tâche et son historique.":
    "A second click permanently deletes the task and its history.",
  "Tâches du jour": "Today’s tasks",
  "Toutes les tâches du jour, faites ou non.": "Every task due today, done or not.",
  "Tâches dues à cette date": "Tasks due on this date",
  "À faire": "To do",
  "Marquer à faire": "Mark as to do",
  "Rien pour aujourd'hui.": "Nothing for today.",
  "Ajoute une première tâche ↑": "Add your first task ↑",
  "Ajouter une tâche…  (Entrée)": "Add a task…  (Enter)",
  "Aucune tâche ne correspond à ces filtres.": "No task matches these filters.",
  "Compte dans la discipline du jour.": "Counts towards today’s discipline.",
  "Compte dans la discipline et le streak du jour.":
    "Counts towards today’s discipline and streak.",
  "Démarre un pomodoro dédié à cette tâche.": "Start a pomodoro dedicated to this task.",
  "Uniquement celles déjà cochées.": "Only the ones already checked.",
  "Uniquement celles qui restent à faire.": "Only the ones still to do.",
  "Libellé, tag, priorité, récurrence et objectif lié.":
    "Label, tag, priority, recurrence and linked goal.",
  "Effacer le filtre de date": "Clear date filter",
  "Retirer ce filtre.": "Remove this filter.",
  "Retire le filtre par tag.": "Remove the tag filter.",
  "N’afficher que les tâches de ce tag.": "Show only tasks with this tag.",
  "Tous les tags": "All tags",
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
  "Modifier l’objectif": "Edit goal",
  "Supprimer l’objectif": "Delete goal",
  "Titre de l'objectif": "Goal title",
  "Objectif parent": "Parent goal",
  "+ sous-objectif": "+ sub-goal",
  "Ajouter un sous-objectif": "Add a sub-goal",
  "Les sous-objectifs remontent d’un niveau, les tâches liées sont déliées.":
    "Sub-goals move up one level and linked tasks are unlinked.",
  "auto (sous-objectifs + tâches)": "auto (sub-goals + tasks)",
  "Progression calculée (sous-objectifs + tâches liées)":
    "Calculated progress (sub-goals + linked tasks)",
  "La progression du parent se calcule à partir de ses enfants.":
    "The parent’s progress is derived from its children.",
  "Horizon, catégorie, deadline et progression manuelle ou calculée.":
    "Horizon, category, deadline and manual or calculated progress.",
  "ex. Trading, Formation, Santé… (optionnel)":
    "e.g. Trading, Learning, Health… (optional)",
  "Aucun objectif en cours.": "No goal in progress.",
  "Crée-en un dans l'onglet Objectifs.": "Create one in the Goals tab.",
  "objectif quotidien": "daily goal",

  // ── Timer / focus ─────────────────────────────────────────────────────────
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
  "Nouveau thème": "New topic",
  "Créer le thème": "Create topic",
  "Nom du thème": "Topic name",
  "Renommer le thème": "Rename topic",
  "Supprimer le thème": "Delete topic",
  "Teinte du thème": "Topic colour",
  "Thème de classement": "Filing topic",
  "Un dossier de couleur pour regrouper des notes.":
    "A colour-coded folder to group notes.",
  "Les notes ne sont pas supprimées : elles passent « non classées ».":
    "The notes are not deleted: they become “unfiled”.",
  "Aucun thème. Crée-en un pour classer tes notes.":
    "No topics yet. Create one to file your notes.",
  "Afficher les notes de ce thème.": "Show the notes in this topic.",
  "Déplace la note dans un autre thème.": "Move the note to another topic.",
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
  "Entrée pour valider. Les tags filtrent les notes, tous thèmes confondus.":
    "Press Enter to confirm. Tags filter notes across every topic.",
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
  "Graphique 7 jours": "7-day chart",
  "Nouvelle métrique…": "New metric…",
  "Supprimer la métrique": "Delete metric",
  "Un second clic supprime la métrique et tout son historique.":
    "A second click deletes the metric and all its history.",
  "Ajoute 1 à la valeur du jour et l’enregistre.": "Adds 1 to today’s value and saves it.",
  "Incrémenter": "Increment",
  "(sans tag)": "(no tag)",
  "focus par tag — 30 jours": "focus by tag — 30 days",
  "Heures de backtesting": "Backtesting hours",

  // ── Benchmark ─────────────────────────────────────────────────────────────
  "Réaction": "Reaction",
  "Temps de réaction": "Reaction time",
  "Test de réaction": "Reaction test",
  "Test de réaction (pré-session)": "Reaction test (pre-session)",
  "Test de réaction pré-session": "Pre-session reaction test",
  "Lancer le test pré-session": "Run the pre-session test",
  "Séquence": "Sequence",
  "Lancer le test": "Run test",
  "Refaire le test": "Run it again",
  "Clique dès que ça passe au vert": "Click as soon as it turns green",
  "Attends que le panneau passe au vert, puis clique le plus vite possible.":
    "Wait for the panel to turn green, then click as fast as you can.",
  "Trop tôt !": "Too early!",
  "On refait cette manche…": "Let’s redo that round…",
  "Reproduis la séquence de cases allumées.": "Repeat the sequence of lit tiles.",
  "Chaque case a sa note — utile pour mémoriser à l'oreille.":
    "Each tile has its own note — handy for memorising by ear.",
  "Activer le son": "Turn sound on",
  "Couper le son": "Mute",
  "Pas encore testé": "Not tested yet",
  "Pas encore testé aujourd'hui": "Not tested today yet",
  "non testé": "not tested",
  "Lance le test pour situer ta forme du jour.":
    "Run the test to gauge your form today.",
  "Établis ta moyenne de référence en lançant quelques tests.":
    "Set your baseline by running a few tests.",
  "Fais quelques tests pour établir ta moyenne de référence.":
    "Run a few tests to establish your baseline.",
  "Il faut au moins 3 jours de tests pour établir ta référence.":
    "You need at least 3 days of tests to establish your baseline.",
  "Encore un jour de test et la tendance apparaît.":
    "One more day of testing and the trend appears.",
  "tendance — meilleur par jour": "trend — best per day",
  "Repère indicatif": "Rough benchmark",
  "Ordre de grandeur adulte courant — pour situer un score, pas pour le juger.":
    "Typical adult range — to place a score, not to judge it.",
  "Alcootest du trader": "Trader’s breathalyser",
  "Vérifie tes réflexes avant d'ouvrir une position.":
    "Check your reflexes before opening a position.",
  "Quelques secondes de test : compare tes réflexes du jour à ta moyenne.":
    "A few seconds of testing: compare today’s reflexes to your average.",
  "Quelques secondes de test de réaction : compare tes réflexes du jour à ta moyenne.":
    "A few seconds of reaction testing: compare today’s reflexes to your average.",
  "Tes réflexes et ton attention sont bas aujourd'hui.":
    "Your reflexes and attention are low today.",

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
  "Plan de risque": "Risk plan",

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

  // ── Réglages ──────────────────────────────────────────────────────────────
  "market-brain — clés IA": "market brain — AI keys",
  "clé Gemini (Google AI Studio)": "Gemini key (Google AI Studio)",
  "clé Groq (console.groq.com)": "Groq key (console.groq.com)",
  "Enregistrer les clés": "Save keys",
  "Enregistré": "Saved",
  "Choisis le thème de l'interface. « Système » suit le réglage de macOS.":
    "Choose the interface theme. “System” follows your macOS setting.",
  "langue": "language",
  "Langue de l'interface": "Interface language",
  "« Système » suit la langue de macOS. Le changement s'applique immédiatement, partout dans l'app.":
    "“System” follows your macOS language. The change applies immediately, everywhere in the app.",
  "Français": "French",
  "Anglais": "English",
  "La langue des briefings du Market-Brain suit ce réglage.":
    "Market Brain briefings follow this setting.",
  "Copie propre et complète de la base (tâches, notes, trades…) dans un fichier unique.":
    "A clean, complete copy of your database (tasks, notes, trades…) in a single file.",
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
  "Nouveau mot de passe": "New password",
  "Enregistrement…": "Saving…",
  "Mot de passe modifié.": "Password changed.",
  "Modification impossible.": "Could not save the change.",
  "Connecté en tant que": "Signed in as",
  "Gérer mon abonnement": "Manage my subscription",
  "mode démo": "demo mode",

  // ── Personnaliser (admin UI) ──────────────────────────────────────────────
  "l'app, à ta main": "the app, your way",
  "Sous-titre (vide = masqué)": "Subtitle (empty = hidden)",
  "fenêtre & densité": "window & density",
  "Densité de l'interface": "Interface density",
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
  "Entre ton e-mail d'abord, puis clique sur « Mot de passe oublié ».":
    "Enter your email first, then click “Forgot your password?”.",
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
  "Modifier {title}": "Edit {title}",
  "Supprimer {title}": "Delete {title}",
  "Supprimer {label}": "Delete {label}",
  "Supprimer {name}": "Delete {name}",
  "Confirmer la suppression de {label}": "Confirm deletion of {label}",
  "Confirmer la suppression de {name}": "Confirm deletion of {name}",
  "Valeur du jour pour {name}": "Today’s value for {name}",
  "Ajouter un sous-objectif à {title}": "Add a sub-goal to {title}",
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

  // ── Benchmark : tests de mémoire ──────────────────────────────────────────
  "Mémoire": "Memory",
  "Mémoire des chiffres": "Number memory",
  "Mémoire visuelle": "Visual memory",
  "Mémorise la suite de chiffres, puis saisis-la.":
    "Memorise the digit sequence, then type it back.",
  "human benchmark — réflexes &amp; mémoire": "human benchmark — reflexes &amp; memory",
  "Le panneau est": "The panel is",
  "mémorise": "memorise",
  "Un nouveau test de réaction met à jour l’alerte.":
    "A new reaction test refreshes the alert.",
  "Aujourd'hui : {v}": "Today: {v}",
  "Ta référence est {ref} — {dir} de {pct} %.":
    "Your baseline is {ref} — you’re {dir} by {pct}%.",
  "tu es au-dessus": "above it",
  "tu es en dessous": "below it",
  "record": "record",
  "moy.": "avg",
  "dernier": "last",
  "{n} essai": "{n} attempt",
  "{n} essais": "{n} attempts",
  "repère": "benchmark",
  "baseline réaction :": "reaction baseline:",

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
  "Publier un reel ChartCore": "Publish a ChartCore reel",
  "Réviser module BTS": "Revise BTS module",
  "Préparer script reel Moov": "Draft Moov reel script",
  "Rédiger le plan de risque": "Write the risk plan",
  "Session trading (Londres)": "Trading session (London)",
  "Contenu": "Content",
  "Formation": "Learning",
  "BTS": "BTS",
  "Passer trader full-time": "Go full-time as a trader",
  "Transition complète en septembre": "Full transition in September",
  "10k abonnés ChartCore.fx": "10k ChartCore.fx followers",
  "Valider le semestre BTS": "Pass the BTS semester",
  "Préparer le passage full-time": "Prepare the move to full-time",
  "Reels publiés": "Reels published",
  "Heures de backtesting|démo": "Backtesting hours",
  "Méditation": "Meditation",
  "Sport": "Exercise",
  "Lecture": "Reading",
  "Idées de reels": "Reel ideas",
  "Après une perte : le protocole": "After a loss: the protocol",
  "Anatomie d'une cassure propre": "Anatomy of a clean breakout",
  "Setup cassure H4": "H4 breakout setup",
  "Plan de risque|démo": "Risk plan",
  "Les 3 conditions": "The 3 conditions",
  "Range H4 net, au moins 3 touches": "Clean H4 range, at least 3 touches",
  "Cassure avec <b>volume</b> et clôture hors du range":
    "Break on <b>volume</b>, closing outside the range",
  "Cassure avec volume et clôture hors du range":
    "Break on volume, closing outside the range",
  "Retest qui tient, mèche de rejet": "Retest that holds, rejection wick",
  "Si l'une manque : on passe. Le manque de patience coûte plus cher que le manque de setups.":
    "If one is missing: skip it. Impatience costs more than a shortage of setups.",
  "Schéma : cassure + retest": "Diagram: breakout + retest",
  "Calendrier économique ForexFactory": "ForexFactory economic calendar",
  "Bonne session de backtesting, le setup H4 se confirme.":
    "Good backtesting session, the H4 setup is holding up.",
  "À ouvrir chaque dimanche soir pour repérer les annonces de la semaine.":
    "Open it every Sunday evening to spot the week’s releases.",
  "Le croquis de référence à revoir avant chaque session de Londres.":
    "The reference sketch to review before every London session.",
  "La source du bloc « no-trade » du Market-Brain :":
    "The source of Market Brain’s “no-trade” block:",
  "1. Fermer la plateforme 20 minutes.": "1. Close the platform for 20 minutes.",
  "2. Noter le trade dans le journal, sans jugement.":
    "2. Log the trade in the journal, without judgement.",
  "3. Relire le plan de risque à voix haute.":
    "3. Read the risk plan out loud.",
  "Le revenge trading n'est pas un problème de marché, c'est un problème d'ego.":
    "Revenge trading isn’t a market problem, it’s an ego problem.",
  "- 3 erreurs de débutant en trading\n- POV : ta première prop firm\n- Breakdown d'un trade perdant (transparence)":
    "- 3 beginner trading mistakes\n- POV: your first prop firm\n- Breakdown of a losing trade (transparency)",
  "Max 1% par trade. Max 3 trades/jour. Stop à -2R quotidien.\n\nRappel : la discipline > le setup. [[Setup cassure H4]]":
    "Max 1% per trade. Max 3 trades/day. Daily stop at -2R.\n\nReminder: discipline > setup. [[H4 breakout setup]]",
  "Règles du setup :\n- attendre la cassure du range H4\n- retest + rejet\n- SL sous la mèche, TP 2R minimum\n\nVoir aussi [[Plan de risque]] pour le sizing.":
    "Setup rules:\n- wait for the H4 range to break\n- retest + rejection\n- SL below the wick, TP 2R minimum\n\nSee also [[Risk plan]] for sizing.",

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
  "Tracker live": "Live tracker",
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
};
