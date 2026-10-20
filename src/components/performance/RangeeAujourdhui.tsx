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
 *
 * ⭐ LA SÉRIE EN COURS EST ICI (2026-10-12). Antonin a fait retirer les tuiles
 * de période (« Tâches tenues », « Habitudes tenues », « Focus ») et gardé
 * « Jours tenus d'affilée ». Une tuile seule sur toute la largeur ne ressemble
 * à rien, et ce chiffre n'a jamais été un chiffre DE PÉRIODE : c'est l'état
 * d'aujourd'hui (aujourd'hui y compte dès 80 %), il ne se compare à rien. Sa
 * place est donc dans cette rangée. `serie` vient de `computeStreak`
 * (`lib/logic.ts`) : la série des TÂCHES.
 *
 * ⚠️ Ce n'est PLUS la série de l'accueil : depuis le 2026-10-20 l'anneau et la
 * tuile d'Aujourd'hui comptent les HABITUDES (75 %). L'écart est voulu ; son
 * nom le dit (« série de tâches », constat 3 de l'audit du 20/10) et la bulle
 * renvoie à l'autre.
 */
export function RangeeAujourdhui({ jour, serie }: { jour: JourEnCours; serie: number }) {
  const cases = [
    {
      nom: t("tâches faites"),
      valeur: jour.taches.dues > 0 ? `${jour.taches.faites}/${jour.taches.dues}` : "—",
      bulle: jour.taches.dues > 0 ? t("Faites sur prévues aujourd'hui") : t("Aucune tâche prévue aujourd'hui"),
      detail: undefined as string | undefined,
    },
    {
      nom: t("focus"),
      valeur: enHeures(jour.focus.minutes),
      bulle: t("Les séances de concentration terminées aujourd'hui"),
      detail: undefined as string | undefined,
    },
    {
      nom: t("habitudes tenues"),
      valeur: jour.habitudes.actives > 0 ? `${jour.habitudes.tenues}/${jour.habitudes.actives}` : "—",
      bulle: jour.habitudes.actives > 0 ? t("Cochées aujourd'hui sur celles que tu suis") : t("Aucune habitude suivie"),
      detail: undefined as string | undefined,
    },
    {
      // « Série » de QUOI : de jours où les TÂCHES sont tenues (constat 28 du
      // labo, puis constat 3 de l'audit du 2026-10-20 : l'accueil montre une
      // autre série, d'habitudes, le même jour).
      nom: t("série de tâches"),
      valeur: t("{n} j", { n: serie }),
      bulle: t("Jours d'affilée où 80 % des tâches prévues sont faites"),
      detail: t("Aujourd'hui compte dès qu'il atteint 80 %. Un jour sans tâche due ne casse pas la série. La série d'Aujourd'hui, elle, compte les habitudes."),
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
      {/* Quatre chiffres : en ligne au bureau, deux par deux au téléphone (à
          quatre de front sur 390 px, chaque nom passait sur trois lignes). */}
      <dl className="grid min-w-[min(100%,15rem)] flex-1 grid-cols-4 gap-4 telephone:grid-cols-2">
        {cases.map((c) => (
          // Le nombre AU-DESSUS de son nom, alignés en haut : au téléphone un
          // nom sur deux lignes ne doit pas faire descendre le nombre voisin.
          <div key={c.nom} className="flex min-w-0 flex-col" data-tip={c.bulle} data-tip-sub={c.detail}>
            <dt className="hud-label truncate-souris order-2">{c.nom}</dt>
            <dd className="order-1 truncate font-display text-xl font-extrabold tabular-nums text-text">{c.valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
