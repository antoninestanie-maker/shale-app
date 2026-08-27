// ─────────────────────────────────────────────────────────────────────────────
// Les créneaux de rappel du briefing de marché, tels qu'iOS doit les recevoir.
//
// C'est le SEUL rappel de Shale qui n'ait aucune condition : « ton briefing
// t'attend » est vrai tous les jours. Il a donc droit au vrai rendez-vous
// quotidien du système (`Schedule::Interval`) au lieu d'une échéance ponctuelle
// reprogrammée à chaque passage en arrière-plan (MOBILE.md § 13.4).
//
// ⚠️ Pourquoi ce calcul vit ici et pas dans le Rust. Market Brain raisonne en
// heure de PARIS — `TRIGGER_HOUR` : 8 h avant Londres, 14 h avant New York —
// alors que `Schedule::Interval` est un rendez-vous exprimé dans le calendrier
// de l'APPAREIL. Traduire l'un dans l'autre demande la base de fuseaux nommés :
// le front l'a gratuitement (`Intl`), le Rust ne l'a pas sans dépendance neuve.
// Le front est de surcroît le seul à connaître la langue courante et l'offre du
// compte. Les créneaux sont donc recalculés et repoussés à CHAQUE projection.
// ─────────────────────────────────────────────────────────────────────────────
import { t } from "../i18n";
import { TRIGGER_HOUR } from "./agent";
import { hasAnyKey } from "./llm";

/** Un créneau, dans la forme exacte que `notif_plan` désérialise côté Rust. */
export interface BriefingSlot {
  /** Identité stable du créneau : elle dérive l'identifiant système iOS. */
  key: string;
  /** Heure MURALE DE L'APPAREIL, pas de Paris. */
  hour: number;
  minute: number;
  title: string;
  body: string;
}

/**
 * Décalage, en minutes, entre l'heure murale de Paris et l'heure murale locale.
 *
 * Mesuré plutôt que déduit d'une table : on formate le même instant dans le
 * fuseau de Paris, on relit ces composantes COMME SI elles étaient locales, et
 * on compare. Zéro quand l'appareil est à Paris — le cas courant ; +60 depuis
 * Londres en été, où 8 h à Paris est 7 h sur place.
 */
function decalageParis(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // `hour: "2-digit"` en `hour12: false` rend « 24 » à minuit sur certaines
  // implémentations : le modulo évite un décalage d'un jour entier.
  const murParis = new Date(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute"), 0, 0);
  // ⚠️ Les DEUX côtés doivent être ramenés à la minute pleine. Comparer à
  // `now` brut laissait ses secondes dans la différence : à 10 h 46 min 42 s,
  // l'écart valait −0,7 minute et `Math.round` le rendait à −1. Le créneau
  // était alors déposé à 8 h 01, ce qu'on a lu dans le magasin d'iOS avant de
  // le corriger. Une seconde d'horloge n'a rien à faire dans un décalage de
  // fuseau.
  const murLocal = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    0,
    0,
  );
  return Math.round((murParis.getTime() - murLocal.getTime()) / 60_000);
}

/** Ramène des minutes depuis minuit dans [0, 1440[. */
const dansLaJournee = (min: number) => ((min % 1440) + 1440) % 1440;

/**
 * Les deux créneaux, en heure murale de l'appareil.
 *
 * ⚠️ Ce que ça ne règle PAS, et qui est assumé : `Schedule::Interval` est un
 * rendez-vous à heure murale FIXE. Si Paris et le fuseau de l'appareil ne
 * changent pas d'heure d'été le même jour, le rappel dérive d'une heure pendant
 * la quinzaine qui les sépare. Il se recale au dépôt suivant, c'est-à-dire au
 * prochain passage de l'app en arrière-plan.
 */
export function creneauxBriefing(now = new Date()): BriefingSlot[] {
  const decalage = decalageParis(now);
  const corps = t("Ouvre Shale : Market Brain le rédige à l'ouverture.");
  const titres: Record<keyof typeof TRIGGER_HOUR, string> = {
    pre_london: t("Briefing pré-Londres"),
    pre_ny: t("Briefing pré-New York"),
  };
  return (Object.keys(TRIGGER_HOUR) as (keyof typeof TRIGGER_HOUR)[]).map((session) => {
    const local = dansLaJournee(TRIGGER_HOUR[session] * 60 - decalage);
    return {
      key: `market_briefing:${session}`,
      hour: Math.floor(local / 60),
      minute: local % 60,
      title: titres[session],
      body: corps,
    };
  });
}

/**
 * Les créneaux à déposer, ou une liste vide si le rappel n'a pas lieu d'être.
 *
 * Deux refus, et tous deux évitent une bannière MENSONGÈRE — ce que tout le
 * module de notifications cherche à éviter :
 *
 * - **sans l'offre Trade**, Market Brain n'est pas accessible : annoncer un
 *   briefing qui ouvrirait un paywall serait une publicité déguisée en rappel ;
 * - **sans clé LLM**, le briefing ne peut pas être rédigé du tout. La bannière
 *   annoncerait quelque chose qui n'arrivera pas, même app ouverte.
 *
 * L'interrupteur, lui, vit côté Rust avec les autres réglages de notification :
 * c'est un choix de l'utilisateur, pas une condition d'existence.
 */
export async function creneauxBriefingActifs(hasTrading: boolean): Promise<BriefingSlot[]> {
  if (!hasTrading) return [];
  try {
    if (!(await hasAnyKey())) return [];
  } catch {
    // Trousseau indisponible : on ne sait pas, donc on ne promet rien.
    return [];
  }
  return creneauxBriefing();
}
