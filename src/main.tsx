import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AuthGate from "./components/auth/AuthGate";
import CapturePane from "./CapturePane";
import { applyLangAttribute, useLang } from "./lib/i18n";
import { sauvegardeQuotidienne } from "./lib/sauvegardes";
import "./index.css";

/** La fenêtre Tauri "capture" (et /?pane=capture en navigateur) rend la barre de capture. */
function isCapturePane(): boolean {
  if (new URLSearchParams(location.search).get("pane") === "capture") return true;
  if ("__TAURI_INTERNALS__" in window) {
    const label = (
      window as unknown as {
        __TAURI_INTERNALS__: { metadata?: { currentWindow?: { label?: string } } };
      }
    ).__TAURI_INTERNALS__.metadata?.currentWindow?.label;
    return label === "capture";
  }
  return false;
}

/**
 * Remonte tout l'arbre quand la langue change.
 *
 * `t()` est une fonction pure lue au rendu : un simple re-rendu suffirait pour
 * le JSX, mais pas pour ce qui a été MÉMORISÉ (useMemo, état initial d'un
 * useState, libellés capturés dans une closure). Changer la `key` force React à
 * démonter puis remonter — c'est la seule garantie que plus une seule chaîne
 * ne reste dans l'ancienne langue, sans recharger la fenêtre.
 */
function LangRoot({ children }: { children: React.ReactNode }) {
  const lang = useLang();
  return <React.Fragment key={lang}>{children}</React.Fragment>;
}

applyLangAttribute();

/**
 * ⭐ LA SAUVEGARDE QUOTIDIENNE EST DÉCLENCHÉE ICI, HORS D'`AuthGate`.
 *
 * ⚠️ Elle vivait dans un effet d'`App`, qui est monté À L'INTÉRIEUR d'`AuthGate` :
 * tant que la session n'était pas ouverte, elle ne partait pas. Or c'est une
 * opération PUREMENT LOCALE — une copie d'un fichier SQLite par le Rust, sans
 * réseau, sans jeton, sans rien qui dépende du compte. La lier à
 * l'authentification, c'est faire disparaître le filet exactement quand on en a
 * le plus besoin : session expirée, trousseau refusé, panne du serveur d'auth.
 *
 * Constaté le 2026-09-07 sur la vraie machine d'Antonin : l'app avait démarré à
 * 03:39, la fenêtre de trousseau attendait encore un clic, et `backup.last_at`
 * était resté au 2026-09-06. Aucune copie du jour. Personne ne l'aurait vu — une
 * sauvegarde qui manque ne fait pas de bruit, c'est le § 4.3 bis de `PIEGES.md`
 * mot pour mot : « rien n'est écrasé, c'est une copie qui n'existe pas ».
 *
 * Elle est silencieuse et se garde elle-même contre les doublons (verrou
 * `backup.last_at` en jour LOCAL), donc l'appeler au chargement du module ne
 * peut ni bloquer le démarrage ni produire deux copies.
 */
void sauvegardeQuotidienne();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LangRoot>
      {isCapturePane() ? (
        <CapturePane />
      ) : (
        <AuthGate>
          <App />
        </AuthGate>
      )}
    </LangRoot>
  </React.StrictMode>,
);
