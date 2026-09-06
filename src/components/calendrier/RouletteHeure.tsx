import { useCallback, useEffect, useRef } from "react";
import { heureDe, minutesDe } from "../../lib/calendrier/agenda";
import { localeTag, t } from "../../lib/i18n";

/**
 * La roulette de sélection d'une heure — demandée par Antonin le 2026-09-06.
 *
 * ⭐ ELLE S'AJOUTE, ELLE NE REMPLACE PAS. Le champ `<input type="time">` reste :
 * taper « 1437 » au clavier est plus rapide que faire tourner deux molettes, et
 * c'est précisément ce qui rendait 14:37 aussi facile que 14:00. La roulette
 * sert quand on préfère viser que taper — au doigt, surtout.
 *
 * ⚠️ LES MINUTES VONT UNE PAR UNE, décision d'Antonin. Un pas de cinq aurait
 * rendu la molette plus rapide à viser et aurait DÉFAIT le chantier de la
 * veille : 14:37 serait redevenu inatteignable.
 */

/** Hauteur d'un cran, en pixels. Trois crans visibles à la fois. */
const CRAN = 28;
const VISIBLES = 3;

/**
 * ⚠️ AUCUNE DÉPENDANCE, ET AUCUN GESTE À LA MAIN : c'est le DÉFILEMENT NATIF qui
 * fait tourner la molette (`overflow-y` + `scroll-snap`).
 *
 * Écrire un glisser au pointeur aurait redemandé tout ce que `GrilleHoraire` a
 * payé — appui long au doigt, `touch-action` à l'armement, écouteurs posés dans
 * le `pointerdown` — pour réobtenir ce que le navigateur fait déjà : molette de
 * souris, deux doigts sur le trackpad, glissement au doigt avec inertie, et le
 * clavier. Le seul travail restant est de LIRE la position, pas de la produire.
 */
function Colonne({
  valeurs,
  libelle,
  index,
  onIndex,
  aria,
}: {
  valeurs: number[];
  libelle: (v: number) => string;
  index: number;
  onIndex: (i: number) => void;
  aria: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /**
   * ⚠️ LE VERROU QUI EMPÊCHE LA BOUCLE. Faire défiler appelle `onIndex`, qui
   * remonte dans l'état, qui redescend en `index`, dont l'effet REPOSITIONNE le
   * défilement — ce qui déclenche un `scroll`, donc `onIndex` à nouveau. Sans ce
   * drapeau, la molette se met à vibrer entre deux crans dès qu'on la lâche
   * entre les deux, et l'utilisateur ne peut plus rien viser.
   */
  const programmatique = useRef(false);
  const minuterie = useRef(0);

  // Positionne la molette quand la valeur change AILLEURS (le champ texte, ou
  // la fin qui suit le début).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cible = index * CRAN;
    if (Math.abs(el.scrollTop - cible) < 1) return;
    programmatique.current = true;
    /**
     * ⚠️ `behavior: "auto"` — INSTANTANÉ, et c'est un correctif, pas une
     * préférence. Avec un défilement lissé, la molette n'arrivait jamais à sa
     * valeur : mesuré à l'écran, `scrollTop` valait 19 au lieu de 392. Trois
     * choses se battaient — l'animation de `scrollTo`, le `scroll-snap` qui
     * recale à chaque image, et mon propre verrou qui se relâche après 120 ms
     * alors que l'animation dure plus longtemps. Le défilement était alors relu
     * EN PLEIN VOL, sa position intermédiaire réécrite dans l'état, et la
     * molette retombait en haut.
     *
     * ⭐ Et le `scroll-behavior: smooth` du CSS n'apportait RIEN : cette
     * propriété ne touche que les défilements PROGRAMMATIQUES, jamais le geste
     * de l'utilisateur. Elle ne coûtait que ce bogue.
     */
    el.scrollTo({ top: cible, behavior: "auto" });
    // Le `scroll` programmatique arrive au tour suivant : on relâche après.
    window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => {
      programmatique.current = false;
    }, 120);
  }, [index]);

  const auDefilement = useCallback(() => {
    const el = ref.current;
    if (!el || programmatique.current) return;
    window.clearTimeout(minuterie.current);
    // On attend l'arrêt : lire pendant l'inertie ferait défiler la valeur à
    // toute vitesse dans le formulaire, et écrirait des dizaines d'états pour
    // un seul geste.
    minuterie.current = window.setTimeout(() => {
      const i = Math.max(0, Math.min(valeurs.length - 1, Math.round(el.scrollTop / CRAN)));
      if (i !== index) onIndex(i);
    }, 90);
  }, [index, onIndex, valeurs.length]);

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={aria}
      tabIndex={0}
      onScroll={auDefilement}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          onIndex(Math.min(valeurs.length - 1, index + 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          onIndex(Math.max(0, index - 1));
        }
      }}
      /* ⚠️ AUCUNE BORDURE ICI. Avec `box-sizing: border-box`, une bordure d'un
         pixel retirait deux pixels de hauteur utile — `clientHeight` valait 82
         pour trois crans de 28 — et le cran sélectionné ne tombait jamais tout à
         fait au centre. La bordure vit sur l'enveloppe. */
      className="roulette-colonne no-scrollbar overflow-y-auto bg-overlay text-center text-sm outline-none"
      style={{ height: CRAN * VISIBLES }}
    >
      {/* Les cales du haut et du bas laissent le PREMIER et le DERNIER cran
          arriver au centre. Sans elles, minuit et 23 h sont inatteignables. */}
      <div style={{ height: CRAN * ((VISIBLES - 1) / 2) }} />
      {valeurs.map((v, i) => (
        <div
          key={v}
          role="option"
          aria-selected={i === index}
          onClick={() => onIndex(i)}
          className={`roulette-cran flex cursor-pointer items-center justify-center tabular-nums ${
            i === index ? "font-semibold text-text" : "text-text-dim"
          }`}
          style={{ height: CRAN }}
        >
          {libelle(v)}
        </div>
      ))}
      <div style={{ height: CRAN * ((VISIBLES - 1) / 2) }} />
    </div>
  );
}

/** L'enveloppe qui porte la bordure et met en évidence le cran du milieu. */
function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border focus-within:border-border-strong">
      {children}
      {/* Deux filets discrets encadrent le cran retenu : sans eux, rien ne dit
          QUELLE ligne sera prise, et une molette dont on ignore où elle pointe
          ne se vise pas. `pointer-events: none` — ils ne doivent pas voler le
          défilement. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 border-y border-border-strong"
        style={{ top: CRAN, height: CRAN }}
      />
    </div>
  );
}

const HEURES = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 60 }, (_, m) => m);

export default function RouletteHeure({
  valeur,
  onChange,
  aria,
}: {
  /** 'HH:MM', ou vide. */
  valeur: string;
  onChange: (hhmm: string) => void;
  aria: string;
}) {
  const total = minutesDe(valeur);
  // Une molette doit toujours pointer quelque part : midi tant que rien n'est
  // saisi, plutôt qu'un cran vide dont on ne saurait pas quoi faire.
  const h = total == null ? 12 : Math.floor(total / 60);
  const m = total == null ? 0 : total % 60;

  return (
    <div className="mt-1.5 flex gap-1.5">
      <Cadre>
      <Colonne
        valeurs={HEURES}
        /* ⚠️ `Intl`, pas un nombre brut : `en-US` écrit « 6 AM » et « 1 PM » là
           où le français écrit « 06 h » et « 13 h ». Une colonne de 0 à 23
           serait fausse dans l'app anglaise, et aucun des deux outils i18n ne
           le verrait — c'est de la donnée (PIEGES § 5.2 bis). */
        libelle={(v) => new Date(2000, 0, 1, v, 0).toLocaleTimeString(localeTag(), { hour: "numeric" })}
        index={h}
        onIndex={(i) => onChange(heureDe(i * 60 + m))}
        aria={t("Heure")}
      />
      </Cadre>
      <Cadre>
      <Colonne
        valeurs={MINUTES}
        libelle={(v) => String(v).padStart(2, "0")}
        index={m}
        onIndex={(i) => onChange(heureDe(h * 60 + i))}
        aria={t("Minutes")}
      />
      </Cadre>
      <span className="sr-only">{aria}</span>
    </div>
  );
}
