import { useMemo } from "react";

import { formatHeure, t } from "../../lib/i18n";
import { nomCourtDuJour, ORDRE_SEMAINE } from "../../lib/logic";
import { grilleSemaine, heuresLibres, type Categorie } from "../../lib/onboarding/grille";
import type { ReglagesHoraires } from "../../lib/onboarding/reglages";

/**
 * ⭐ Les 168 cases — le sous-produit visuel de ce que la personne vient de dire.
 *
 * ⚠️ MÊME GRILLE SUR TÉLÉPHONE, et c'est une contrainte du cahier des charges,
 * pas une préférence : « ne la remplace pas par un résumé chiffré, la grille est
 * le cœur de l'écran ». Sept colonnes tiennent sur 375 px — l'axe des heures se
 * réduit, les cases rétrécissent, le nombre de cases ne bouge pas.
 *
 * ⚠️ Aucune unité de viewport ici (PIEGES § 6.4) : tout est en `fr` et en
 * pixels, donc le zoom de l'app s'applique sans `--zoom-inv`.
 */

/**
 * ⚠️ Une FONCTION, jamais une constante de module : `t()` appelé à l'import
 * figerait ces libellés dans la langue de démarrage (PIEGES § 5.2).
 */
const LEGENDE = (): { cle: Categorie; libelle: string }[] => [
  { cle: "sommeil", libelle: t("Sommeil") },
  { cle: "travail", libelle: t("Travail") },
  { cle: "trajet", libelle: t("Trajets") },
  { cle: "libre", libelle: t("Temps libre") },
];

/**
 * ⚠️ Le temps libre est NEUTRE, pas vert. Le teinter en « bon » ferait du
 * travail et du sommeil du « moins bon », alors que la grille ne juge rien —
 * elle montre. Les tokens employés existent tous dans `index.css` : un token
 * inexistant échouerait EN SILENCE (PIEGES § 6.3).
 */
const FOND: Record<Categorie, string> = {
  sommeil: "color-mix(in srgb, var(--color-violet) 55%, transparent)",
  travail: "color-mix(in srgb, var(--color-blue) 55%, transparent)",
  trajet: "color-mix(in srgb, var(--color-yellow) 55%, transparent)",
  libre: "var(--color-overlay)",
};

export default function GrilleSemaine({
  reglages,
}: {
  reglages: ReglagesHoraires;
  /** Gardé pour les appelants : la grille en cases a la même taille partout. */
  compact?: boolean;
}) {
  const grille = useMemo(() => grilleSemaine(reglages), [reglages]);
  const libres = heuresLibres(grille);
  const legende = LEGENDE();

  // ⭐ 2026-10-05 (Antonin) : des CASES, pas de longs rectangles. Une ligne par
  // jour, une case carrée par heure — comme les cases du Journal. Les jours en
  // lignes et les heures en colonnes : 24 carrés tiennent en largeur, et la
  // grille reste basse (sept lignes) au lieu de deux cents pixels de haut.
  return (
    <div>
      <div
        className="grid gap-[3px] text-[10px]"
        style={{ gridTemplateColumns: "auto repeat(24, minmax(0, 1fr))" }}
        role="img"
        aria-label={t("Ta semaine, heure par heure — {n} h libres", { n: libres })}
      >
        {/* Coin vide, puis un repère toutes les trois heures. */}
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={`h-${h}`}
            className="relative h-3 text-text-dim tabular-nums"
            aria-hidden="true"
          >
            {/* ⚠️ `formatHeure` et non 'HH:MM' : « 06:00 » est faux en anglais
                (« 6 AM », PIEGES § 4.4). Le libellé déborde volontairement de sa
                case : les deux voisines sont vides. */}
            {h % 3 === 0 && (
              <span className="absolute left-0 top-0 whitespace-nowrap text-[9px] leading-none">
                {formatHeure(`${String(h).padStart(2, "0")}:00`)}
              </span>
            )}
          </div>
        ))}

        {ORDRE_SEMAINE.map((j) => (
          <Jour key={j} jour={j} grille={grille} />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-dim">
        {legende.map((l) => (
          <span key={l.cle} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-[3px] border border-border"
              style={{ background: FOND[l.cle] }}
            />
            {l.libelle}
          </span>
        ))}
      </div>
    </div>
  );
}

function Jour({ jour, grille }: { jour: number; grille: Categorie[][] }) {
  return (
    <>
      <div className="pr-1.5 text-right leading-none text-text-dim self-center">
        {/* ⚠️ `nomCourtDuJour` (Intl), jamais une table française (§ 5.2 bis). */}
        {nomCourtDuJour(jour)}
      </div>
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={`${jour}-${h}`}
          style={{ background: FOND[grille[jour][h]], aspectRatio: "1 / 1" }}
          className="rounded-[3px]"
        />
      ))}
    </>
  );
}
