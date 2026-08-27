// Le geste physique qui ouvre une note — côté Swift.
//
// ─── CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS ────────────────────────────
// C'est la SEULE partie de Shale sur iPhone qui ne soit pas du React, et elle
// tient volontairement en une page. Un `AppIntent` déclaré une fois, et iOS
// l'expose partout, gratuitement : bouton Action, Toucher au dos, Siri,
// Spotlight, icône dédiée sur l'écran d'accueil. Aucune interface à écrire.
//
// ⚠️ Il OUVRE l'app, il n'écrit rien. Une version « dicte ta note à Siri sans
// ouvrir Shale » demanderait au Swift d'écrire dans `shale.db`, ce qui casserait
// l'invariant « le front est seul écrivain » dont dépendent le moteur de
// notifications et la synchronisation. Ce n'est pas un raffinement à ajouter
// plus tard sans y réfléchir. Voir `MOBILE.md` § 4.1.
//
// ─── LE PONT VERS LA WEBVIEW ─────────────────────────────────────────────────
// Tauri n'expose pas sa `WKWebView` aux sources du projet Xcode : il n'y a
// aucun appel direct possible d'ici vers le front. On pose donc un fichier vide
// dans le conteneur de l'app — l'intent tourne dans le processus de l'app, donc
// dans le même bac à sable — et `src-tauri/src/note_rapide.rs` le relève.
//
// ⚠️ `IDENTIFIANT` et `FICHIER` doivent rester exactement ceux du Rust
// (`note_rapide::FICHIER`, `tauri.conf.json`). Les désaccorder casse le pont
// EN SILENCE : l'app s'ouvrira, simplement sans note.

import AppIntents
import Foundation

enum DemandeNoteRapide {
  /// Identifiant de paquet — le même que `PRODUCT_BUNDLE_IDENTIFIER`.
  static let identifiant = "com.atnfx.shale"
  /// Doit valoir `note_rapide::FICHIER` côté Rust.
  static let fichier = "note-rapide.demande"

  /// `Library/Application Support/<identifiant>/` — le dossier de données de
  /// Tauri sur iOS, celui-là même où vit `shale.db`.
  static func url() -> URL? {
    guard
      let support = FileManager.default.urls(
        for: .applicationSupportDirectory, in: .userDomainMask
      ).first
    else { return nil }
    let dossier = support.appendingPathComponent(identifiant, isDirectory: true)
    try? FileManager.default.createDirectory(at: dossier, withIntermediateDirectories: true)
    return dossier.appendingPathComponent(fichier, isDirectory: false)
  }

  /// Pose la demande. Le CONTENU ne sert à rien : c'est la date de modification
  /// qui compte, le Rust jetant toute demande de plus de deux minutes.
  static func poser() {
    guard let url = url() else { return }
    try? Data().write(to: url, options: .atomic)
  }
}

@available(iOS 16.0, *)
struct NouvelleNoteShaleIntent: AppIntent {
  static var title: LocalizedStringResource = "Nouvelle note Shale"
  static var description = IntentDescription(
    "Ouvre Shale sur une note vierge, prête à écrire.")

  /// Tout le sujet : le geste doit AMENER À L'ÉCRAN, pas travailler en fond.
  static var openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    DemandeNoteRapide.poser()
    return .result()
  }
}

/// ⚠️ `@available(iOS 16, *)` plutôt qu'une cible de déploiement relevée : les
/// App Intents n'existent qu'à partir d'iOS 16, mais le projet cible iOS 14.
/// Garder 14 signifie qu'aucun iPhone ne perd l'app — ceux d'avant iOS 16
/// n'ont simplement pas le raccourci, ce qui est exactement le bon compromis
/// pour une commodité.
@available(iOS 16.0, *)
struct RaccourcisShale: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    // ⚠️ Chaque phrase DOIT contenir `\(.applicationName)` — iOS refuse
    // silencieusement celles qui ne nomment pas l'app.
    AppShortcut(
      intent: NouvelleNoteShaleIntent(),
      phrases: [
        "Nouvelle note \(.applicationName)",
        "Note rapide \(.applicationName)",
        "New note in \(.applicationName)",
        "Quick note in \(.applicationName)",
      ],
      shortTitle: "Nouvelle note",
      systemImageName: "square.and.pencil"
    )
  }
}
