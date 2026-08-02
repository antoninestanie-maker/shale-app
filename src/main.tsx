import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AuthGate from "./components/auth/AuthGate";
import CapturePane from "./CapturePane";
import { applyLangAttribute, useLang } from "./lib/i18n";
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
