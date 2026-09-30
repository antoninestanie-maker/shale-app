// ─────────────────────────────────────────────────────────────────────────────
// Ce que l'utilisateur lit quand l'IA ne répond pas. Un message par code, écrit
// pour quelqu'un qui n'a pas à savoir ce qu'est un quota serveur.
// `t()` est appelé à l'appel : la langue est celle du moment.
// ─────────────────────────────────────────────────────────────────────────────

import { formatDate, t } from "../i18n";
import type { CodeIa } from "./runAi";

export interface MessageIa {
  texte: string;
  /** Ce qu'on propose de faire : réessayer, ouvrir les Réglages, voir Pro. */
  geste: "reessayer" | "reglages" | "pro" | "aucun";
}

export function messageIa(code: CodeIa, resetsAt?: string | null, enEssai = false): MessageIa {
  // En UTC : la remise à zéro tombe à minuit UTC le 1er ; lue à l'heure locale
  // d'un fuseau à l'ouest, elle s'afficherait la veille.
  const quand = resetsAt ? formatDate(new Date(resetsAt), { day: "numeric", month: "long", timeZone: "UTC" }) : null;
  switch (code) {
    case "network":
      return { texte: t("Pas de connexion : l'IA a besoin d'internet pour répondre."), geste: "reessayer" };
    case "disabled":
      return { texte: t("L'IA est désactivée. Tu peux l'activer dans les Réglages."), geste: "reglages" };
    case "not_pro":
      return { texte: t("L'intelligence artificielle fait partie de Shale Pro."), geste: "pro" };
    case "unauthorized":
      return { texte: t("Ta session a expiré. Reconnecte-toi pour utiliser l'IA."), geste: "aucun" };
    case "quota_exhausted":
      return {
        texte: enEssai
          ? t("Tu as utilisé toutes les actions d'IA de ton essai.")
          : quand
            ? t("Tu as utilisé toutes tes actions d'IA ce mois-ci. Elles reviennent le {date}.", { date: quand })
            : t("Tu as utilisé toutes tes actions d'IA ce mois-ci."),
        geste: "aucun",
      };
    case "rate_limited":
      return { texte: t("Beaucoup de demandes d'un coup. Réessaie dans une minute."), geste: "reessayer" };
    case "ai_paused":
      return { texte: t("L'IA est en pause pour le moment. Réessaie plus tard."), geste: "aucun" };
    case "ai_busy":
    case "ai_unavailable":
      return { texte: t("L'IA ne répond pas pour le moment. Réessaie dans quelques instants."), geste: "reessayer" };
    case "too_large":
      return {
        texte: t("C'est trop volumineux pour l'IA. Un PDF : 10 Mo et 20 pages au plus ; une image : 5 Mo."),
        geste: "aucun",
      };
    case "bad_output":
    case "refused":
      return {
        texte: t("L'IA n'a pas pu produire une réponse utilisable. Aucune action n'a été décomptée."),
        geste: "reessayer",
      };
    case "already_done":
      return {
        texte: t("Le brief de ce matin a déjà été rédigé sur un autre appareil : il arrive avec la synchronisation."),
        geste: "aucun",
      };
    case "bad_request":
    case "bad_payload":
    case "unknown_feature":
      return { texte: t("Cette demande n'a pas pu être envoyée à l'IA."), geste: "aucun" };
  }
}
