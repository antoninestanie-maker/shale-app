import { t } from "../../lib/i18n";
import { jourEnClair } from "../../lib/performance/dates";
import type { JourEnCours } from "../../lib/performance/jour";
import { enHeures } from "../../lib/performance/durees";

/**
 * ⭐ « AUJOURD'HUI » — le jour en cours, À PART (2026-10-11).
 *
 * Performance ne lit que des jours finis, et c'est voulu (les moyennes
 * plongeraient chaque matin). Mais un écran qui restait vide après une tâche
 * cochée et une séance terminée contredisait le Timer (crible du labo,
 * constat 2). Cette rangée montre le jour — et ne le compare à rien : ni
 * flèche, ni écart, ni pourcentage.
 *
 * Les nombres viennent de `lib/performance/jour.ts`.
 */
export function RangeeAujourdhui({ jour }: { jour: JourEnCours }) {
  const cases = [
    {
      nom: t("tâches faites"),
      valeur: jour.taches.dues > 0 ? `${jour.taches.faites}/${jour.taches.dues}` : "—",
      bulle: jour.taches.dues > 0 ? t("Faites sur prévues aujourd'hui") : t("Aucune tâche prévue aujourd'hui"),
    },
    {
      nom: t("focus"),
      valeur: enHeures(jour.focus.minutes),
      bulle: t("Les séances de concentration terminées aujourd'hui"),
    },
    {
      nom: t("habitudes tenues"),
      valeur: jour.habitudes.actives > 0 ? `${jour.habitudes.tenues}/${jour.habitudes.actives}` : "—",
      bulle: jour.habitudes.actives > 0 ? t("Cochées aujourd'hui sur celles que tu suis") : t("Aucune habitude suivie"),
    },
  ];

  return (
    <section className="card mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4" aria-label={t("Aujourd'hui")}>
      <div
        className="min-w-0 shrink-0"
        data-tip={t("Le jour en cours, à part")}
        data-tip-sub={t("Il n'entre dans aucune moyenne ni aucun écart : la période analysée s'arrête à hier.")}
      >
        <h2 className="hud-label">{t("Aujourd'hui")}</h2>
        <p className="mt-0.5 text-xs text-text-dim">
          {jourEnClair(jour.date)} · {t("en cours|jour")}
        </p>
      </div>
      <dl className="grid min-w-[min(100%,15rem)] flex-1 grid-cols-3 gap-4">
        {cases.map((c) => (
          // Le nombre AU-DESSUS de son nom, alignés en haut : au téléphone un
          // nom sur deux lignes ne doit pas faire descendre le nombre voisin.
          <div key={c.nom} className="flex min-w-0 flex-col" data-tip={c.bulle}>
            <dt className="hud-label truncate-souris order-2">{c.nom}</dt>
            <dd className="order-1 truncate font-display text-xl font-extrabold tabular-nums text-text">{c.valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
