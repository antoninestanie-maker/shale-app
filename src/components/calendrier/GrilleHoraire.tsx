import { useCallback, useMemo, useRef, useState } from "react";
import { heureDe, minutesDe, type EntreeAgenda } from "../../lib/calendrier/agenda";
import { localeTag, t } from "../../lib/i18n";

/**
 * La grille horaire — vues Semaine et Jour.
 *
 * ⭐ LE GESTE CENTRAL DU MODULE : on saisit une tâche et on la POSE sur une
 * heure. C'est ce qui distingue un calendrier d'une liste de dates.
 *
 * ⚠️ POURQUOI DES `PointerEvent` ET PAS LE GLISSER-DÉPOSER HTML5. Le
 * `draggable` natif ne se déclenche pas au doigt sur iOS : le module serait
 * inutilisable sur téléphone, et la parité iPhone (chantier D) devrait tout
 * réécrire. Les événements pointeur couvrent souris ET doigt avec le même code.
 *
 * ⚠️ Le hit-test se fait par `elementFromPoint` sur les positions RÉELLES du
 * DOM, jamais sur des rectangles mémorisés au début du geste : la grille peut
 * défiler pendant le glissement, et des rectangles périmés feraient déposer la
 * tâche plusieurs heures à côté. C'est la leçon que porte déjà `ResizableGrid`.
 */

/** Hauteur d'une heure, en pixels. Une heure trop courte rend le dépôt imprécis. */
const PX_PAR_HEURE = 56;
/** Le dépôt se cale au quart d'heure : plus fin serait illisible, plus large inutile. */
const PAS_MIN = 15;
/** Distance en pixels au-delà de laquelle un appui devient un glissement. */
const SEUIL_GLISSEMENT = 6;

/**
 * ⭐ AU DOIGT, IL FAUT UN APPUI LONG — et ce n'est pas une préférence.
 *
 * À la souris, un déplacement de six pixels ne peut être qu'un glissement
 * délibéré : la molette fait défiler, le curseur ne sert qu'à pointer. Au doigt,
 * le MÊME geste sert à faire défiler la grille. Sans appui long, un simple
 * défilement vertical arracherait la première tâche touchée et la déposerait
 * quelques heures plus bas — sans erreur, sans annulation possible.
 *
 * 400 ms : au-delà l'attente se sent, en deçà le défilement redevient dangereux.
 */
const APPUI_LONG_MS = 400;

export interface Props {
  jours: string[];
  parJour: ReadonlyMap<string, EntreeAgenda[]>;
  aujourdhui: string;
  /** Créneaux proposés, mis en évidence sur la grille. */
  suggestions?: { jour: string; debut: string; fin: string }[];
  onDeposer: (entree: EntreeAgenda, jour: string, heure: string) => void;
  onOuvrir: (entree: EntreeAgenda) => void;
  onCreer: (jour: string, heure: string) => void;
  onJour?: (jour: string) => void;
}

interface Glissement {
  entree: EntreeAgenda;
  x: number;
  y: number;
  actif: boolean;
}

export default function GrilleHoraire({
  jours,
  parJour,
  aujourdhui,
  suggestions = [],
  onDeposer,
  onOuvrir,
  onCreer,
  onJour,
}: Props) {
  const [glissement, setGlissement] = useState<Glissement | null>(null);
  const [cible, setCible] = useState<{ jour: string; heure: string } | null>(null);
  /** Le geste en cours, hors de React : il doit exister AVANT le prochain rendu. */
  const geste = useRef<{ entree: EntreeAgenda; x: number; y: number; actif: boolean } | null>(null);

  /**
   * Les heures affichées. On part de 6 h – 22 h, puis on ÉLARGIT pour ne
   * jamais masquer un rendez-vous : un événement à 5 h du matin qui
   * n'apparaît pas est pire qu'une grille un peu longue.
   */
  const [heureMin, heureMax] = useMemo(() => {
    let min = 6;
    let max = 22;
    for (const jour of jours) {
      for (const e of parJour.get(jour) ?? []) {
        const d = minutesDe(e.start_at);
        if (d == null) continue;
        min = Math.min(min, Math.floor(d / 60));
        max = Math.max(max, Math.ceil((d + (e.dureeMin ?? 30)) / 60));
      }
    }
    return [Math.max(0, min), Math.min(24, Math.max(max, min + 4))];
  }, [jours, parJour]);

  const heures = useMemo(
    () => Array.from({ length: heureMax - heureMin }, (_, i) => heureMin + i),
    [heureMin, heureMax],
  );

  // ─── Le geste ──────────────────────────────────────────────────────────────

  /**
   * ⚠️ LES ÉCOUTEURS SONT POSÉS DANS LE `pointerdown`, PAS DANS UN `useEffect`.
   *
   * La version d'avant les posait par un effet déclenché sur l'état du
   * glissement. Un effet ne s'exécute qu'APRÈS le rendu : un geste rapide —
   * appui, déplacement et relâchement dans la même tâche du navigateur — se
   * terminait avant que le moindre écouteur n'existe, et il ne se passait
   * strictement rien. **Constaté à l'écran**, pas déduit : la tâche restait
   * dans sa bande, sans erreur ni message.
   *
   * En les posant ici, le geste est capturé dès la première milliseconde, quel
   * que soit le moment où React décide de rendre.
   */
  const saisir = useCallback(
    (e: React.PointerEvent, entree: EntreeAgenda) => {
      // ⚠️ Un événement récurrent ne se déplace pas d'un jour : sa série serait
      // silencieusement rompue. Il s'ouvre, et l'utilisateur décide.
      if (entree.kind === "recurrence" || entree.kind === "deadline") return;
      const auDoigt = e.pointerType === "touch";
      geste.current = { entree, x: e.clientX, y: e.clientY, actif: false };
      const depart = { x: e.clientX, y: e.clientY };
      setGlissement({ entree, x: e.clientX, y: e.clientY, actif: false });

      /**
       * Au doigt, le glissement ne s'arme qu'après l'appui long — et un
       * mouvement AVANT l'échéance l'annule : c'est un défilement, pas une
       * saisie. À la souris, l'armement est immédiat, seul le seuil compte.
       */
      let arme = !auDoigt;
      /**
       * ⚠️ « Armé » n'est pas « déplacé ». Au doigt, l'appui long met la carte
       * en main — mais un appui long suivi d'un simple relâchement, sans le
       * moindre mouvement, ne veut PAS dire « pose-la ici » : elle y est déjà.
       * Sans ce second drapeau, une pression un peu longue sur une tâche sans
       * horaire suffisait à lui en donner un, au hasard de l'endroit touché.
       */
      let deplace = false;
      const minuterie = auDoigt
        ? window.setTimeout(() => {
            if (!geste.current) return;
            arme = true;
            geste.current.actif = true;
            setGlissement({ ...geste.current, actif: true });
            vibrer();
          }, APPUI_LONG_MS)
        : 0;

      const bouger = (ev: PointerEvent) => {
        const g = geste.current;
        if (!g) return;
        const distance = Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y);
        if (!arme) {
          // Le doigt a bougé avant l'appui long : c'est un défilement. On rend
          // la main au navigateur plutôt que de voler son geste à l'utilisateur.
          if (distance > SEUIL_GLISSEMENT) {
            window.clearTimeout(minuterie);
            annuler();
          }
          return;
        }
        if (distance > SEUIL_GLISSEMENT) deplace = true;
        g.actif = g.actif || deplace;
        g.x = ev.clientX;
        g.y = ev.clientY;
        setGlissement({ entree: g.entree, x: g.x, y: g.y, actif: g.actif });
        if (g.actif) setCible(creneauSous(ev.clientX, ev.clientY));
      };

      const detacher = () => {
        window.clearTimeout(minuterie);
        window.removeEventListener("pointermove", bouger);
        window.removeEventListener("pointerup", lacher);
        window.removeEventListener("pointercancel", lacher);
      };

      function annuler() {
        detacher();
        geste.current = null;
        setGlissement(null);
        setCible(null);
      }

      function lacher(ev: PointerEvent) {
        detacher();
        const g = geste.current;
        geste.current = null;
        setGlissement(null);
        setCible(null);
        if (!g) return;
        // Un simple clic (jamais franchi le seuil) OUVRE, il ne déplace pas.
        // Et au doigt, un appui long RELÂCHÉ SUR PLACE n'est pas un dépôt : la
        // carte n'a pas bougé, il n'y a rien à écrire.
        if (!g.actif || !deplace) {
          if (!g.actif) onOuvrir(g.entree);
          return;
        }
        const creneau = creneauSous(ev.clientX, ev.clientY);
        if (creneau) onDeposer(g.entree, creneau.jour, creneau.heure);
      }

      window.addEventListener("pointermove", bouger);
      window.addEventListener("pointerup", lacher);
      window.addEventListener("pointercancel", lacher);
    },
    [onDeposer, onOuvrir],
  );

  return (
    /**
     * ⚠️ `data-glisse` coupe le défilement UNIQUEMENT pendant qu'un glissement
     * est armé (`touch-action: none`, cf. `index.css`).
     *
     * Le poser en permanence sur la grille empêcherait tout défilement au doigt
     * — on ne pourrait plus atteindre l'après-midi. Le poser sur les seules
     * cartes empêcherait de faire défiler en partant d'une carte, c'est-à-dire
     * la moitié de la surface. En le posant à l'armement, on garde les deux :
     * on défile librement, et dès que l'appui long a pris, le doigt ne fait plus
     * que déplacer.
     */
    <div className="relative select-none" data-glisse={glissement?.actif ? "1" : undefined}>
      {/* En-tête des jours */}
      <div
        className="sticky top-0 z-10 grid border-b border-border bg-surface"
        style={{ gridTemplateColumns: `3.5rem repeat(${jours.length}, minmax(0, 1fr))` }}
      >
        <span />
        {jours.map((jour) => {
          const estAujourdhui = jour === aujourdhui;
          return (
            <button
              key={jour}
              type="button"
              onClick={() => onJour?.(jour)}
              data-tip={t("Ouvrir la note de ce jour")}
              data-tip-sub={t("Le journal et le calendrier partagent la même journée.")}
              className="cible-tactile flex flex-col items-center justify-center py-2 transition-colors hover:bg-overlay"
            >
              {/* ⚠️ Le nom du jour vient d'`Intl`, PAS de `DAY_SHORT`.
                  Vu à l'écran en basculant l'app en anglais : `DAY_SHORT` est
                  une table française (`lun`, `mar`…) sans clé de traduction, et
                  les deux outils i18n étaient au vert — `i18n:check` ne voit
                  que les clés absentes, et `i18n:durs` ne suit pas la donnée.
                  `Intl` connaît toutes les langues sans qu'on lui en ajoute. */}
              <span className="text-[0.65rem] uppercase tracking-wide text-text-dim">
                {new Date(`${jour}T12:00:00`).toLocaleDateString(localeTag(), {
                  weekday: "short",
                })}
              </span>
              <span
                className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                  estAujourdhui ? "bg-blue font-semibold text-white" : "text-text"
                }`}
              >
                {Number(jour.slice(8))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Ce qui n'a pas d'heure — au-dessus de la grille, jamais noyé dedans.
          ⚠️ PLAFONNÉ ET DÉFILANT. Vu à l'écran : cinq tâches récurrentes par
          jour repoussaient la première heure de la grille sous le pli, et la
          vue semaine s'ouvrait sur une liste au lieu d'un calendrier. */}
      <div
        className="grid max-h-28 overflow-y-auto border-b border-border"
        style={{ gridTemplateColumns: `3.5rem repeat(${jours.length}, minmax(0, 1fr))` }}
      >
        <span className="py-1 pr-2 text-right text-[0.6rem] uppercase text-text-dim">
          {t("Sans heure")}
        </span>
        {jours.map((jour) => (
          <div key={jour} className="min-h-[1.75rem] space-y-1 border-l border-border p-1">
            {(parJour.get(jour) ?? [])
              .filter((e) => minutesDe(e.start_at) == null)
              .map((e) => (
                <Chip key={`${e.kind}-${e.id}`} entree={e} onPointerDown={(ev) => saisir(ev, e)} />
              ))}
          </div>
        ))}
      </div>

      {/* La grille horaire */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `3.5rem repeat(${jours.length}, minmax(0, 1fr))` }}
      >
        <div>
          {heures.map((h) => (
            <div
              key={h}
              className="relative pr-2 text-right text-[0.65rem] text-text-dim"
              style={{ height: PX_PAR_HEURE }}
            >
              <span className="absolute -top-1.5 right-2">{heureDe(h * 60)}</span>
            </div>
          ))}
        </div>

        {jours.map((jour) => (
          <ColonneJour
            key={jour}
            jour={jour}
            heures={heures}
            heureMin={heureMin}
            entrees={parJour.get(jour) ?? []}
            suggestions={suggestions.filter((s) => s.jour === jour)}
            cible={cible?.jour === jour ? cible.heure : null}
            onCreer={onCreer}
            onSaisir={saisir}
          />
        ))}
      </div>

      {/* Le fantôme qui suit le doigt. `pointer-events: none` est indispensable :
          sans lui, `elementFromPoint` ne trouverait que le fantôme lui-même. */}
      {glissement?.actif && (
        <div
          className="pointer-events-none fixed z-50 rounded-md bg-blue px-2 py-1 text-xs font-medium text-white shadow-lg"
          style={{ left: glissement.x + 12, top: glissement.y - 8 }}
        >
          {glissement.entree.titre}
        </div>
      )}
    </div>
  );
}

/**
 * Retour haptique quand le glissement s'arme.
 *
 * ⚠️ `navigator.vibrate` N'EXISTE PAS sur iOS Safari ni dans une WKWebView : le
 * garde n'est pas une politesse, sans lui l'appel lève. Le geste reste correct
 * sans vibration — c'est le contour bleu du jeton qui dit qu'il est saisi, la
 * vibration n'est qu'un renfort là où elle existe (Android, et le jour où Apple
 * l'ouvrira).
 */
function vibrer(): void {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* rien : un appareil sans vibreur n'est pas une erreur */
  }
}

/** Le créneau sous ce point de l'écran, ou `null`. */
function creneauSous(x: number, y: number): { jour: string; heure: string } | null {
  const el = document.elementFromPoint(x, y);
  const cellule = el?.closest<HTMLElement>("[data-jour][data-heure]");
  if (!cellule) return null;
  const jour = cellule.dataset.jour;
  const base = Number(cellule.dataset.heure);
  if (!jour || !Number.isFinite(base)) return null;
  // Position VERTICALE dans la cellule → quart d'heure. Sans cela, déposer en
  // bas d'une case poserait la tâche à l'heure pile au-dessus.
  const rect = cellule.getBoundingClientRect();
  const part = Math.min(0.999, Math.max(0, (y - rect.top) / rect.height));
  const minutes = base * 60 + Math.floor((part * 60) / PAS_MIN) * PAS_MIN;
  return { jour, heure: heureDe(minutes) };
}

function ColonneJour({
  jour,
  heures,
  heureMin,
  entrees,
  suggestions,
  cible,
  onCreer,
  onSaisir,
}: {
  jour: string;
  heures: number[];
  heureMin: number;
  entrees: EntreeAgenda[];
  suggestions: { debut: string; fin: string }[];
  cible: string | null;
  onCreer: (jour: string, heure: string) => void;
  onSaisir: (e: React.PointerEvent, entree: EntreeAgenda) => void;
}) {
  const placees = entrees.filter((e) => minutesDe(e.start_at) != null);
  const haut = (min: number) => ((min - heureMin * 60) / 60) * PX_PAR_HEURE;

  return (
    <div className="relative border-l border-border">
      {heures.map((h) => (
        <div
          key={h}
          data-jour={jour}
          data-heure={h}
          onClick={() => onCreer(jour, heureDe(h * 60))}
          className="border-b border-border transition-colors hover:bg-overlay"
          style={{ height: PX_PAR_HEURE }}
        />
      ))}

      {/* Créneaux proposés — un fond discret, jamais un événement déjà posé.
          ⚠️ L'app PROPOSE, elle ne place rien elle-même. */}
      {suggestions.map((s) => {
        const d = minutesDe(s.debut);
        const f = minutesDe(s.fin);
        if (d == null || f == null) return null;
        return (
          <div
            key={`${s.debut}-${s.fin}`}
            className="pointer-events-none absolute inset-x-1 rounded-md border border-dashed"
            style={{
              top: haut(d),
              height: ((f - d) / 60) * PX_PAR_HEURE,
              borderColor: "var(--color-green)",
              backgroundColor: "color-mix(in srgb, var(--color-green) 8%, transparent)",
            }}
          />
        );
      })}

      {placees.map((e) => {
        const d = minutesDe(e.start_at)!;
        const duree = e.dureeMin ?? 30;
        return (
          <button
            key={`${e.kind}-${e.id}`}
            type="button"
            onPointerDown={(ev) => {
              ev.stopPropagation();
              onSaisir(ev, e);
            }}
            onClick={(ev) => ev.stopPropagation()}
            className="absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-1 text-left text-[0.7rem] leading-tight"
            style={{
              top: haut(d),
              // Un rendez-vous de dix minutes doit rester lisible : plancher à
              // 22 px, quitte à ce que la carte dépasse un peu son créneau.
              height: Math.max(22, (duree / 60) * PX_PAR_HEURE - 2),
              backgroundColor: couleurDe(e),
              color: "var(--color-text)",
              borderLeft: `2px solid ${bordDe(e)}`,
              opacity: e.faite ? 0.5 : 1,
              textDecoration: e.faite ? "line-through" : undefined,
            }}
          >
            <span className="block truncate font-medium">{e.titre}</span>
            {duree >= 45 && <span className="block text-text-dim">{e.start_at}</span>}
          </button>
        );
      })}

      {cible && (
        <div
          className="pointer-events-none absolute inset-x-1 rounded-md border-2 border-blue"
          style={{ top: haut(minutesDe(cible)!), height: PX_PAR_HEURE / 2 }}
        />
      )}
    </div>
  );
}

function Chip({
  entree,
  onPointerDown,
}: {
  entree: EntreeAgenda;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      className="cible-tactile-ligne block w-full truncate rounded px-1.5 py-0.5 text-left text-[0.7rem]"
      style={{
        backgroundColor: couleurDe(entree),
        borderLeft: `2px solid ${bordDe(entree)}`,
        opacity: entree.faite ? 0.5 : 1,
        textDecoration: entree.faite ? "line-through" : undefined,
      }}
    >
      {entree.enRetard && "⌛ "}
      {entree.titre}
    </button>
  );
}

/** Le fond d'une carte. Toujours un token, jamais un voile blanc. */
function couleurDe(e: EntreeAgenda): string {
  return `color-mix(in srgb, ${bordDe(e)} 14%, transparent)`;
}

function bordDe(e: EntreeAgenda): string {
  if (e.kind === "deadline") return "var(--color-violet)";
  if (e.enRetard) return "var(--color-red)";
  if (e.kind === "event") return `var(--color-${e.color ?? "blue"})`;
  if (e.kind === "recurrence") return "var(--color-text-dim)";
  return "var(--color-green)";
}
