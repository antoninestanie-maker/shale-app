import { useMemo } from "react";

import { formatHeure, t } from "../../lib/i18n";
import { nomCourtDuJour, ORDRE_SEMAINE } from "../../lib/logic";
import { grilleSemaine, heuresLibres, type Categorie } from "../../lib/onboarding/grille";
import type { ReglagesHoraires } from "../../lib/onboarding/reglages";

/**
 * ⭐ La semaine, sept journées lues de gauche à droite.
 *
 * ─── POURQUOI CE DESSIN, ET PAS CELUI D'AVANT ───────────────────────────────
 *
 * La première version empilait 24 lignes de 7 colonnes, avec un interstice d'un
 * pixel entre chacune des 168 cases. Demandé par Antonin le 2026-09-12 : « plus
 * intuitif visuellement et plus épuré ». Trois défauts, tous du même genre — le
 * dessin donnait du travail à l'œil au lieu d'en faire :
 *
 *   ① **les interstices découpaient les blocs.** Huit heures de sommeil
 *      d'affilée s'affichaient en huit briques séparées. Or une nuit n'est pas
 *      huit heures, c'est UNE nuit : c'est au dessin de le montrer, pas au
 *      lecteur de le recomposer ;
 *   ② **le temps descendait.** Une journée se lit de gauche à droite — c'est
 *      l'idiome du suivi de sommeil et de la frise, et c'est exactement ce que
 *      cet écran raconte. En colonnes, la nuit se coupait en deux moitiés
 *      (23 h en bas, 0 h – 7 h en haut) sans que rien ne dise qu'elles se
 *      suivent. En ligne, elle occupe les deux bouts de la barre, ce qu'une
 *      nuit fait vraiment ;
 *   ③ **trop de traits.** Interstices, bordures de case et filets toutes les
 *      trois heures se disputaient l'attention du regard avec les couleurs.
 *
 * ⭐ IL Y A TOUJOURS 168 CASES DANS LE DOM, une par heure — la fusion est un
 * effet de STYLE, pas une perte de résolution. C'est délibéré : le cahier des
 * charges demande la grille heure par heure, et un dessin par blocs agrégés
 * aurait rendu invérifiable ce que la grille montre vraiment. Les arrondis sont
 * calculés par case (`debutDeBloc` / `finDeBloc`), ce qui fait que des heures
 * voisines de même catégorie se soudent en une seule forme.
 *
 * ⚠️ Le TEMPS LIBRE n'a pas de couleur : c'est la gouttière du fond qui
 * apparaît. Le teinter en vert l'aurait désigné comme « le bon temps », donc le
 * travail et le sommeil comme le moins bon — or cette grille ne juge rien, elle
 * montre. Un creux se lit mieux qu'une couleur de plus.
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
 * ⚠️ Les tokens employés existent tous dans `index.css` : un token inexistant
 * échouerait EN SILENCE (PIEGES § 6.3).
 *
 * Les proportions ne sont pas uniformes, et c'est voulu. Le sommeil est le plus
 * gros bloc de la semaine : à saturation égale, il écrasait tout le reste, donc
 * il est le plus doux. Les trajets sont les plus fins — souvent une seule
 * heure — donc les plus francs, sans quoi on ne les voit pas du tout.
 */
const FOND: Record<Categorie, string | undefined> = {
  sommeil: "color-mix(in srgb, var(--color-violet) 40%, transparent)",
  travail: "color-mix(in srgb, var(--color-blue) 52%, transparent)",
  trajet: "color-mix(in srgb, var(--color-yellow) 62%, transparent)",
  // Pas de couleur : la gouttière du fond fait le travail.
  libre: undefined,
};

/** Teintes pleines de la légende — une pastille n'a pas besoin d'être discrète. */
const PASTILLE: Record<Categorie, string> = {
  sommeil: "var(--color-violet)",
  travail: "var(--color-blue)",
  trajet: "var(--color-yellow)",
  libre: "var(--color-overlay-2)",
};

/** Repères de l'axe : un quart de journée. Quatre suffisent à se situer. */
const REPERES = [0, 6, 12, 18];

const RAYON = 5;

export default function GrilleSemaine({
  reglages,
  compact = false,
}: {
  reglages: ReglagesHoraires;
  /** Barres plus basses — l'écran de l'accueil, où la grille partage la place. */
  compact?: boolean;
}) {
  const grille = useMemo(() => grilleSemaine(reglages), [reglages]);
  const libres = heuresLibres(grille);
  const hauteur = compact ? 20 : 26;
  const legende = LEGENDE();

  return (
    <div>
      {/*
        ⚠️⚠️ UNE SEULE GRILLE POUR L'AXE **ET** LES JOURNÉES — et c'est un
        correctif, pas une élégance. La première rédaction en faisait deux, avec
        chacune sa colonne de gauche en `auto` : celle des jours était large de
        l'étiquette « lun. », celle de l'axe était VIDE donc large de zéro. Les
        deux ne s'alignaient pas, et « 06:00 » se retrouvait au-dessus de 4 h.
        Un axe décalé ne décore pas mal, il MENT — c'est la seule partie de ce
        composant qui prétend dire QUAND. Mesuré à l'écran le 2026-09-12 : 43 px
        d'écart, soit deux heures et demie.
      */}
      <div
        className="grid items-center gap-y-[3px] text-[10px]"
        style={{ gridTemplateColumns: "auto 1fr" }}
        role="img"
        aria-label={t("Ta semaine, heure par heure — {n} h libres", { n: libres })}
      >
        {/* L'axe : quatre repères, un par quart de journée. */}
        <div aria-hidden />
        <div
          className="grid pb-1.5 tabular-nums text-text-dim"
          style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
          aria-hidden
        >
          {REPERES.map((h) => (
            <span key={h}>
              {/* ⚠️ `formatHeure` et non la chaîne 'HH:MM' : « 06:00 » est juste
                  en français et faux en anglais, qui écrit « 6 AM »
                  (PIEGES § 4.4). */}
              {formatHeure(`${String(h).padStart(2, "0")}:00`)}
            </span>
          ))}
        </div>

        {ORDRE_SEMAINE.map((j) => (
          <Journee key={j} jour={j} heures={grille[j]} hauteur={hauteur} />
        ))}
      </div>

      {/* ── La légende ───────────────────────────────────────────────────── */}
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-text-dim">
        {legende.map((l) => (
          <span key={l.cle} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: PASTILLE[l.cle] }}
            />
            {l.libelle}
          </span>
        ))}
      </div>
    </div>
  );
}

function Journee({
  jour,
  heures,
  hauteur,
}: {
  jour: number;
  heures: Categorie[];
  hauteur: number;
}) {
  return (
    <>
      <div className="pr-2.5 text-right leading-none text-text-dim">
        {/* ⚠️ `nomCourtDuJour` (Intl) et jamais une table française :
            PIEGES § 5.2 bis — une table de constantes est de la donnée, et les
            deux outils i18n restent au vert en la laissant passer. */}
        {nomCourtDuJour(jour)}
      </div>
      {/* La gouttière : c'est elle qu'on voit là où l'heure est libre. */}
      <div
        className="grid overflow-hidden bg-overlay"
        style={{
          gridTemplateColumns: "repeat(24, 1fr)",
          height: hauteur,
          borderRadius: RAYON,
        }}
      >
        {heures.map((categorie, h) => (
          <Case
            key={h}
            categorie={categorie}
            // ⭐ C'est ici que les heures voisines se soudent : une case n'a
            // d'arrondi que du côté où le bloc COMMENCE ou FINIT. Sans cela, on
            // retrouverait 168 pastilles au lieu d'une nuit et d'une journée.
            debutDeBloc={h === 0 || heures[h - 1] !== categorie}
            finDeBloc={h === 23 || heures[h + 1] !== categorie}
          />
        ))}
      </div>
    </>
  );
}

function Case({
  categorie,
  debutDeBloc,
  finDeBloc,
}: {
  categorie: Categorie;
  debutDeBloc: boolean;
  finDeBloc: boolean;
}) {
  const fond = FOND[categorie];
  return (
    <div
      data-categorie={categorie}
      style={{
        background: fond,
        borderTopLeftRadius: debutDeBloc ? RAYON : 0,
        borderBottomLeftRadius: debutDeBloc ? RAYON : 0,
        borderTopRightRadius: finDeBloc ? RAYON : 0,
        borderBottomRightRadius: finDeBloc ? RAYON : 0,
      }}
    />
  );
}
