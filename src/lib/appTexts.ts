import { useEffect, useState } from "react";

import { t } from "./i18n";
// ─────────────────────────────────────────────────────────────────────────────
// Textes commerciaux de l'app, éditables sans code depuis « Personnaliser ».
// Stockés en localStorage (marche avant login et en natif comme en démo).
// ─────────────────────────────────────────────────────────────────────────────

export interface AppTexts {
  onboardingTitle: string;
  onboardingBody: string;
  loginSubtitle: string;
  subRequiredBody: string;
}

export const defaultTexts = (): AppTexts => ({
  onboardingTitle: t("Bienvenue dans Shale"),
  onboardingBody:
    t("Ton poste de commande de trader : discipline, journal, sizing et briefing marché réunis. Voici l'essentiel en trois écrans."),
  loginSubtitle: t("Connecte-toi pour accéder à ton espace."),
  subRequiredBody:
    t("Ton compte n'a pas d'abonnement actif. Souscris sur le site pour débloquer Shale."),
});

const KEY = "shale.app.texts";
export const TEXTS_EVENT = "shale:app-texts";

export function loadTexts(): AppTexts {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaultTexts() };
    const saved = JSON.parse(raw) as Partial<AppTexts>;
    return { ...defaultTexts(), ...saved };
  } catch {
    return { ...defaultTexts() };
  }
}

export function saveTexts(patch: Partial<AppTexts>): void {
  const next = { ...loadTexts(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new CustomEvent(TEXTS_EVENT));
}

/** Hook réactif : se met à jour quand les textes changent (événement global). */
export function useAppTexts(): AppTexts {
  const [texts, setTexts] = useState<AppTexts>(loadTexts);
  useEffect(() => {
    const refresh = () => setTexts(loadTexts());
    window.addEventListener(TEXTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(TEXTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return texts;
}
