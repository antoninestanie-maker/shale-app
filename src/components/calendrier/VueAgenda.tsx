import { useMemo } from "react";
import { dansLeBandeau, joursEntre, type EntreeAgenda } from "../../lib/calendrier/agenda";
import { toDateStr } from "../../lib/logic";
import { formatHeure, localeTag, t } from "../../lib/i18n";
import { IconSablier } from "../icons";
import { surAppuiLong } from "./appuiLong";

/**
 * La vue AGENDA — le défaut du téléphone jusqu'au 2026-10-13 ; depuis, la
 * semaine s'ouvre partout (décision d'Antonin) et l'agenda reste à un toucher.
 *
 * ⚠️ POURQUOI ELLE EXISTE. La vue semaine tient sept colonnes de front : sur un
 * écran de six pouces, chaque colonne fait moins de cinquante points de large et
 * ne montre plus qu'un titre tronqué à trois lettres. Ce n'est pas un défaut de
 * mise en page, c'est une forme qui ne convient pas — d'où une forme différente,
 * pas un rétrécissement de la même.
 *
 * Une liste chronologique déroulante : les jours à la suite, ceux qui n'ont rien
 * repliés en une ligne. On lit ce qui vient, dans l'ordre où ça vient.
 */
interface Props {
  depuis: string;
  jours: number;
  parJour: ReadonlyMap<string, EntreeAgenda[]>;
  aujourdhui: string;
  onOuvrir: (entree: EntreeAgenda) => void;
  onJour: (jour: string) => void;
  /** Le menu d'une ligne, au doigt : un maintien (2026-10-13). */
  onMenu?: (entree: EntreeAgenda, el: HTMLElement) => void;
}

export default function VueAgenda({
  depuis,
  jours,
  parJour,
  aujourdhui,
  onOuvrir,
  onJour,
  onMenu,
}: Props) {
  const dates = useMemo(() => {
    const fin = new Date(`${depuis}T12:00:00`);
    fin.setDate(fin.getDate() + jours - 1);
    // ⚠️ `toDateStr` et jamais `toISOString().slice(0, 10)` : le second convertit
    // en UTC. Midi local à Paris redescend à 10 h UTC — même jour, tout va
    // bien —, mais midi local à Auckland (UTC+13) devient 23 h la VEILLE, et
    // l'agenda commencerait un jour trop tôt. Le défaut ne se verrait jamais
    // ici, seulement chez quelqu'un d'autre.
    return joursEntre(depuis, toDateStr(fin));
  }, [depuis, jours]);

  const remplis = dates.filter((d) => (parJour.get(d) ?? []).length > 0);

  if (remplis.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-text-dim">
        {t("Rien de prévu sur les {n} prochains jours.", { n: jours })}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {remplis.map((jour) => {
        const entrees = parJour.get(jour) ?? [];
        const d = new Date(`${jour}T12:00:00`);
        return (
          <li key={jour}>
            {/* ⚠️ 44 pt AU DOIGT : c'est aussi le bouton qui ouvre la journée,
                et une cible de 30 pt se rate une fois sur trois. À la souris on
                garde la densité de l'app — `cible-tactile-ligne` ne s'applique
                que sous `pointer: coarse`. */}
            <button
              type="button"
              onClick={() => onJour(jour)}
              className="cible-tactile-ligne flex w-full items-baseline gap-2 px-4 py-2 text-left"
            >
              <span
                className={`text-sm font-semibold ${
                  jour === aujourdhui ? "text-accent" : "text-text"
                }`}
              >
                {d.toLocaleDateString(localeTag(), { weekday: "long", day: "numeric" })}
              </span>
              <span className="text-xs text-text-dim">
                {d.toLocaleDateString(localeTag(), { month: "long" })}
              </span>
              {jour === aujourdhui && (
                <span className="ml-auto text-[0.65rem] uppercase tracking-wide text-accent">
                  {t("Aujourd'hui")}
                </span>
              )}
            </button>

            <ul className="pb-2">
              {entrees.map((e) => (
                <li key={`${e.kind}-${e.id}`}>
                  <button
                    type="button"
                    data-entree={`${e.kind}:${e.id}:${e.date}`}
                    onPointerDown={(ev) => onMenu && surAppuiLong(ev, (el) => onMenu(e, el))}
                    onClick={() => onOuvrir(e)}
                    // `select-none` : sur iOS, un maintien sélectionnerait le titre.
                    className="cible-tactile-ligne flex w-full select-none items-center gap-3 px-4 py-1.5 text-left [-webkit-touch-callout:none]"
                  >
                    <span
                      className="h-8 w-0.5 shrink-0 rounded-full"
                      style={{ backgroundColor: couleur(e) }}
                    />
                    {/* ⚠️ `w-16` et non `w-11` : « 12:15 AM » est plus large
                        que « 00:15 ». La colonne était taillée pour le format
                        français, qui est le plus court des deux. */}
                    <span className="w-16 shrink-0 text-xs tabular-nums text-text-dim">
                      {dansLeBandeau(e) ? t("jour") : e.start_at ? formatHeure(e.start_at) : "—"}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-sm text-text"
                      style={{
                        textDecoration: e.faite ? "line-through" : undefined,
                        opacity: e.faite ? 0.5 : 1,
                      }}
                    >
                      {e.enRetard && <IconSablier className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />}
                      {e.titre}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function couleur(e: EntreeAgenda): string {
  if (e.kind === "deadline") return "var(--color-violet)";
  if (e.enRetard) return "var(--color-red)";
  if (e.kind === "event") return `var(--color-${e.color ?? "blue"})`;
  if (e.kind === "recurrence") return "var(--color-text-dim)";
  return "var(--color-success)";
}
