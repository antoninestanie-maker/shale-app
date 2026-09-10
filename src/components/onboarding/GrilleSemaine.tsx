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
  compact = false,
}: {
  reglages: ReglagesHoraires;
  /** Cases plus basses — l'écran de l'accueil, où la grille partage la place. */
  compact?: boolean;
}) {
  const grille = useMemo(() => grilleSemaine(reglages), [reglages]);
  const libres = heuresLibres(grille);
  const hauteurCase = compact ? 9 : 13;
  const legende = LEGENDE();

  return (
    <div>
      <div
        className="grid gap-[1px] text-[10px]"
        style={{ gridTemplateColumns: "auto repeat(7, minmax(0, 1fr))" }}
        role="img"
        aria-label={t("Ta semaine, heure par heure — {n} h libres", { n: libres })}
      >
        {/* Coin vide, puis les sept en-têtes de jour. */}
        <div />
        {ORDRE_SEMAINE.map((j) => (
          <div key={`tete-${j}`} className="pb-1 text-center text-text-dim">
            {/* ⚠️ `nomCourtDuJour` (Intl) et jamais une table française :
                PIEGES § 5.2 bis — une table de constantes est de la donnée, et
                les deux outils i18n restent au vert en la laissant passer. */}
            {nomCourtDuJour(j)}
          </div>
        ))}

        {Array.from({ length: 24 }, (_, h) => (
          <Ligne
            key={h}
            heure={h}
            grille={grille}
            hauteurCase={hauteurCase}
          />
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

function Ligne({
  heure,
  grille,
  hauteurCase,
}: {
  heure: number;
  grille: Categorie[][];
  hauteurCase: number;
}) {
  // ⚠️ Un repère toutes les trois heures, et pas vingt-quatre étiquettes :
  // au-delà, l'axe devient illisible avant la grille elle-même.
  const repere = heure % 3 === 0;
  return (
    <>
      <div
        className="pr-1.5 text-right leading-none text-text-dim tabular-nums"
        style={{ height: hauteurCase, fontSize: 9 }}
      >
        {/* ⚠️ `formatHeure` et non la chaîne 'HH:MM' : « 06:00 » est juste en
            français et faux en anglais, qui écrit « 6 AM » (PIEGES § 4.4). */}
        {repere ? formatHeure(`${String(heure).padStart(2, "0")}:00`) : ""}
      </div>
      {ORDRE_SEMAINE.map((j) => (
        <div
          key={`${j}-${heure}`}
          style={{ height: hauteurCase, background: FOND[grille[j][heure]] }}
          className={repere ? "border-t border-border" : undefined}
        />
      ))}
    </>
  );
}
