import { IconBan, IconBolt, IconSablier } from "../icons";
import { auFilDeLaLigne } from "../../lib/calendrier/champDate";
import type { EntreeAgenda } from "../../lib/calendrier/agenda";
import { t } from "../../lib/i18n";
import { todayStr } from "../../lib/logic";
import { badgeDEntree, type BadgeEtat as Badge } from "../../lib/taches/etat";

/**
 * ⭐ L'ÉTAT d'une tâche, là où elle paraît hors de la vue Tâches — Aujourd'hui,
 * Calendrier, feuille de route d'un objectif (audit 2026-10-20, constat
 * d'usage 21 : « les états ne se voient que dans Tâches »). Le badge se DÉDUIT
 * (`badgeEtat`, `lib/taches/etat.ts`) ; ce composant ne fait que le dire.
 *
 * Mêmes mots, mêmes icônes, mêmes couleurs que la ligne de la vue Tâches, et la
 * grammaire du design (`CLAUDE.md`, V9) : braise pour « en cours » (ce qui
 * avance), ambre pour « à relancer » (attention), gris pour le reste. Jamais
 * de rouge : un état n'est pas un problème.
 *
 * `compact` : l'icône seule, le mot en bulle — pour une pastille du calendrier,
 * où un mot de plus mangerait le titre.
 */
export default function BadgeEtat({
  badge,
  compact = false,
  detail,
}: {
  badge: Badge | null;
  compact?: boolean;
  /** Une précision pour la bulle (« relance ven. 23 oct. »). */
  detail?: string;
}) {
  if (!badge) return null;
  const { icone, mot, couleur } = (() => {
    switch (badge) {
      case "en-cours":
        return { icone: <IconBolt className="h-3 w-3 shrink-0" />, mot: t("En cours"), couleur: "font-medium text-accent" };
      case "a-relancer":
        return { icone: <IconSablier className="h-3 w-3 shrink-0" />, mot: t("À relancer"), couleur: "font-medium text-yellow" };
      case "en-attente":
        return { icone: <IconSablier className="h-3 w-3 shrink-0" />, mot: t("En attente"), couleur: "text-text-dim" };
      case "abandonnee":
        return { icone: <IconBan className="h-3 w-3 shrink-0" />, mot: t("Abandonnée"), couleur: "text-text-dim" };
    }
  })();
  if (compact) {
    return (
      <span
        className={`inline-flex shrink-0 items-center ${couleur}`}
        role="img"
        aria-label={detail ? `${mot} · ${detail}` : mot}
        data-tip={mot}
        data-tip-sub={detail}
        data-etat={badge}
      >
        {icone}
      </span>
    );
  }
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 text-xs ${couleur}`} data-etat={badge}>
      {icone}
      {mot}
    </span>
  );
}

/**
 * Le badge d'une entrée du CALENDRIER, en icône (la pastille est étroite), avant
 * le titre comme le sablier du retard. La bulle dit l'état, et la relance.
 */
export function BadgeDEntree({ entree }: { entree: Pick<EntreeAgenda, "etat" | "faite" | "relance"> }) {
  const jour = todayStr();
  const badge = badgeDEntree(entree, jour);
  if (!badge) return null;
  const detail =
    badge === "en-attente" && entree.relance
      ? t("relance {quand}", { quand: auFilDeLaLigne(entree.relance, jour) })
      : undefined;
  return (
    <span className="mr-1 inline-flex align-[-2px]">
      <BadgeEtat badge={badge} compact detail={detail} />
    </span>
  );
}
