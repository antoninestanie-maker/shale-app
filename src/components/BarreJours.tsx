import { addDays, weekdayOf } from "../lib/logic";
import { formatDate, localeTag, t } from "../lib/i18n";
import { IconChevronLeft, IconChevronRight } from "./icons";

/**
 * La barre qui CHOISIT LE JOUR du Journal (2026-10-13, demande d'Antonin).
 *
 * Avant elle, chaque ligne d'habitude portait sept ou quatorze petites cases,
 * toutes cliquables : on cochait hier ou avant-hier d'un doigt qui visait
 * aujourd'hui. Ses mots : « le coche doit être pour le jour choisi et c'est
 * tout. En revanche une barre un peu au-dessus qui permet de choisir un jour
 * et qui est par défaut sur aujourd'hui serait mieux. »
 *
 * Une semaine, du lundi au dimanche, et deux flèches pour en changer. Le
 * FUTUR ne se choisit pas : on ne tient pas une habitude demain, et on n'écrit
 * pas le journal d'un jour qui n'a pas eu lieu.
 */

/** Le lundi de la semaine de `jour`. */
export function lundiDe(jour: string): string {
  const w = weekdayOf(jour);
  return addDays(jour, w === 0 ? -6 : 1 - w);
}

/** Les sept jours, lundi → dimanche, de la semaine de `jour`. */
export function semaineDuJour(jour: string): string[] {
  const lundi = lundiDe(jour);
  return Array.from({ length: 7 }, (_, i) => addDays(lundi, i));
}

/**
 * Le jour où mène une flèche : le même jour de la semaine, sept jours plus
 * loin — ramené à aujourd'hui s'il tombait dans le futur. `null` : la flèche
 * ne mène nulle part (on est déjà dans la semaine en cours).
 */
export function jourVoisin(jour: string, sens: -1 | 1, aujourdhui: string): string | null {
  if (sens === -1) return addDays(jour, -7);
  if (lundiDe(jour) >= lundiDe(aujourdhui)) return null;
  const cible = addDays(jour, 7);
  return cible > aujourdhui ? aujourdhui : cible;
}

export default function BarreJours({
  jour,
  aujourdhui,
  onChoisir,
}: {
  jour: string;
  aujourdhui: string;
  onChoisir: (jour: string) => void;
}) {
  const semaine = semaineDuJour(jour);
  const suivant = jourVoisin(jour, 1, aujourdhui);
  const midi = (d: string) => new Date(`${d}T12:00:00`);

  return (
    <nav className="card flex items-center gap-1 p-1.5" aria-label={t("Choisir le jour")}>
      <button
        type="button"
        onClick={() => onChoisir(addDays(jour, -7))}
        aria-label={t("Semaine précédente")}
        data-tip={t("Semaine précédente")}
        className="cible-tactile flex h-9 w-8 shrink-0 items-center justify-center rounded-[10px] text-text-dim hover:bg-overlay hover:text-text"
      >
        <IconChevronLeft className="h-4 w-4" />
      </button>

      <div className="grid min-w-0 flex-1 grid-cols-7 gap-1">
        {semaine.map((d) => {
          const futur = d > aujourdhui;
          const choisi = d === jour;
          const estAujourdhui = d === aujourdhui;
          return (
            <button
              key={d}
              type="button"
              disabled={futur}
              onClick={() => onChoisir(d)}
              aria-pressed={choisi}
              aria-label={formatDate(midi(d), { weekday: "long", day: "numeric", month: "long" })}
              data-tip={
                futur ? undefined : formatDate(midi(d), { weekday: "long", day: "numeric", month: "long" })
              }
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-[10px] border py-1 transition-colors duration-150 ${
                choisi
                  ? "border-border-strong bg-overlay-2"
                  : "border-transparent hover:bg-overlay"
              } ${futur ? "cursor-default opacity-35 hover:bg-transparent" : ""}`}
            >
              <span className="text-[0.65rem] uppercase tracking-wide text-text-dim">
                {midi(d).toLocaleDateString(localeTag(), { weekday: "short" })}
              </span>
              <span
                className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm tabular-nums ${
                  estAujourdhui ? "bg-blue-solid font-semibold text-on-blue" : "text-text"
                }`}
              >
                {Number(d.slice(8))}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={suivant === null}
        onClick={() => suivant && onChoisir(suivant)}
        aria-label={t("Semaine suivante")}
        data-tip={suivant === null ? undefined : t("Semaine suivante")}
        className="cible-tactile flex h-9 w-8 shrink-0 items-center justify-center rounded-[10px] text-text-dim hover:bg-overlay hover:text-text disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <IconChevronRight className="h-4 w-4" />
      </button>

      {/* Toujours là, pour que la barre ne change pas de largeur : éteint tant
          qu'on est sur aujourd'hui. */}
      <button
        type="button"
        disabled={jour === aujourdhui}
        onClick={() => onChoisir(aujourdhui)}
        data-tip={jour === aujourdhui ? undefined : t("Revenir à aujourd'hui")}
        className="pill cible-tactile-ligne ml-1 shrink-0 border border-border px-3 py-1.5 text-xs font-medium text-text-dim hover:bg-overlay hover:text-text disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent telephone:hidden"
      >
        {t("Aujourd'hui")}
      </button>
    </nav>
  );
}
