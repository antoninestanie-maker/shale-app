import ChampDate from "../ChampDate";
import { t, tp } from "../../lib/i18n";
import type { FaitEcheance } from "../../lib/objectifs/echeance";
import { daterObjectif } from "../../lib/repo";
import type { Goal } from "../../lib/types";

/**
 * ⭐ L'ÉCHÉANCE D'UN OBJECTIF, EN TÊTE DE SA PAGE (2026-10-12).
 *
 * Antonin, après essai de l'app installée : « Pour la date, la deadline de
 * l'objectif, c'est très important donc on le fait. » Le labo (seconde passe,
 * rang 8, cinq utilisateurs) : la date se posait sous « ⋯ › Modifier… ›
 * Deadline » — quatre commandes ; elle s'affichait sans année, dans une ligne
 * de petites capitales ; rien ne disait le temps qui reste.
 *
 * Maintenant, sous le titre :
 *   • pas d'échéance → UNE invite, « Ajouter une échéance », qui ouvre le
 *     calendrier de l'app sur place ;
 *   • une échéance → le mot « Échéance », le champ (il écrit l'année dès que
 *     ce n'est pas l'année en cours, et se change ou se retire sur place), puis
 *     ce qu'on SAIT du temps qui reste (`lib/objectifs/echeance.ts`).
 *
 * ⚠️ DES FAITS, JAMAIS UN PRONOSTIC. Dépassée ou en péril : les mots et les
 * nombres du Calendrier (mêmes clés de traduction que son bandeau, mesure de
 * `calendrier/peril.ts`). Sinon : les semaines pleines qui restent. Aucun « à
 * ce rythme, fini le… ».
 *
 * ⚠️ Pas de phrase d'aide permanente (décision du 2026-09-30) : l'invite est un
 * bouton, et ce que le champ sait faire se découvre en l'ouvrant.
 *
 * L'écriture passe par `daterObjectif`, qui ne touche QUE `deadline` — la même
 * que l'échéance d'une étape (`FeuilleDeRoute`, `EcheanceEtape`).
 */
export default function EcheanceObjectif(props: { goal: Goal; fait: FaitEcheance; refresh: () => Promise<void> }) {
  const { goal, fait } = props;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm">
      {goal.deadline && <span className="hud-label shrink-0">{t("Échéance")}</span>}
      <ChampDate
        valeur={goal.deadline?.slice(0, 10) ?? ""}
        onChange={async (v) => {
          if ((v || null) === (goal.deadline ?? null)) return;
          await daterObjectif(goal.id, v || null);
          await props.refresh();
        }}
        aria={t("Échéance de « {titre} »", { titre: goal.title })}
        placeholder={t("Ajouter une échéance")}
        className="cible-tactile-ligne flex shrink-0 items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2.5 py-1.5 text-left text-sm text-text transition-colors hover:border-border-strong focus:border-accent focus:outline-none"
      />
      <Fait fait={fait} />
    </div>
  );
}

/** Ce qu'on sait du temps qui reste — rien quand il n'y a rien à dire. */
function Fait({ fait }: { fait: FaitEcheance }) {
  if (!fait || fait.genre === "aujourdhui") return null; // « Aujourd'hui » : le champ le dit déjà

  if (fait.genre === "peril") {
    const p = fait.peril;
    const restant = p.etapesRestantes + p.tachesRestantes;
    return (
      <p className="min-w-0 text-xs text-text-dim">
        <span className="inline-block font-medium text-red first-letter:uppercase">
          {p.joursRestants < 0
            ? tp(-p.joursRestants, "dépassée d'un jour.", "dépassée de {n} jours.")
            : // Les mots du bandeau du Calendrier, tels quels.
              tp(p.joursRestants, "{n} jour restant, {pct} % fait.", "{n} jours restants, {pct} % fait.", {
                pct: p.progression,
              })}
        </span>{" "}
        {restant > 0 && tp(restant, "{n} étape ou tâche restante.", "{n} étapes ou tâches restantes.")}{" "}
        {p.declaratif && t("(progression déclarée à la main, pas mesurée)")}
      </p>
    );
  }

  return (
    <p className="min-w-0 text-xs text-text-dim">
      {fait.semaines === 0
        ? tp(fait.joursRestants, "{n} jour d'ici là", "{n} jours d'ici là")
        : tp(fait.semaines, "{n} semaine pleine d'ici là", "{n} semaines pleines d'ici là")}
    </p>
  );
}
