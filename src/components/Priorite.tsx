import { t } from "../lib/i18n";
import { couleurPriorite, nomDePriorite, phrasePriorite, PRIORITES, prioriteDe } from "../lib/priorite";
import type { Priority } from "../lib/types";

/**
 * ⭐ LA PRIORITÉ À L'ÉCRAN — trois briques, pour toute l'app (2026-09-30).
 *
 *   • `IconePriorite` : trois barres qui montent, autant de pleines que de
 *     niveaux (le symbole de réseau, que tout le monde lit sans légende) ;
 *   • `ChoixPriorite` : trois boutons côte à côte, pour une fenêtre et un menu ;
 *   • `PastillePriorite` : une pastille compacte posée à côté d'un champ de
 *     saisie en une ligne. C'est un vrai `<select>` natif sous la pastille —
 *     le menu du système sur Mac, la molette sur iPhone, les flèches au
 *     clavier, sans rien réécrire de tout ça.
 *
 * Le vocabulaire et les couleurs vivent dans `lib/priorite.ts`.
 */

export function IconePriorite({ priorite, className = "h-3.5 w-3.5" }: { priorite: string; className?: string }) {
  const p = prioriteDe({ priority: priorite });
  const pleines = p === "high" ? 3 : p === "medium" ? 2 : 1;
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden style={{ color: couleurPriorite(p) }}>
      {[
        { x: 4, h: 7 },
        { x: 10.25, h: 11.5 },
        { x: 16.5, h: 16 },
      ].map((b, i) => (
        <rect key={i} x={b.x} y={20 - b.h} width={3.5} height={b.h} rx={1} opacity={i < pleines ? 1 : 0.28} />
      ))}
    </svg>
  );
}

/** Trois boutons — la fenêtre de modification, le menu « ⋯ » d'une étape. */
export function ChoixPriorite({
  valeur,
  onChange,
  role = "radio",
  compact = false,
}: {
  valeur: string;
  onChange: (p: Priority) => void;
  /** Dans un menu de 16 rem : plus serré, le mot en 11 px. */
  compact?: boolean;
  /** `menuitemradio` dans un menu (lecteurs d'écran), `radio` dans un formulaire. */
  role?: "radio" | "menuitemradio";
}) {
  const actuelle = prioriteDe({ priority: valeur });
  return (
    <div className="flex gap-1" role={role === "radio" ? "radiogroup" : "group"} aria-label={t("Priorité")}>
      {PRIORITES.map((p) => (
        <button
          key={p}
          type="button"
          role={role}
          aria-checked={actuelle === p}
          onClick={() => onChange(p)}
          className={`cible-tactile flex flex-1 items-center justify-center rounded-[8px] border font-medium transition-colors ${
            compact ? "gap-1 px-1 py-1 text-[11px]" : "gap-1.5 px-2 py-1.5 text-xs"
          } ${
            actuelle === p ? "border-text/30 bg-surface-2 text-text" : "border-border text-text-dim hover:text-text"
          }`}
        >
          <IconePriorite priorite={p} />
          {nomDePriorite(p)}
        </button>
      ))}
    </div>
  );
}

/**
 * La pastille d'un champ en une ligne : « ▂▄▆ Moyenne ». Un clic passe au
 * niveau suivant (faible → moyenne → élevée → faible).
 *
 * ⚠️ UN BOUTON QUI NE PREND PAS LE FOCUS, et c'est pour ça qu'il tourne au lieu
 * d'ouvrir une liste. Les champs en une ligne de la feuille de route VALIDENT
 * quand ils perdent le focus (`ChampLigne` : « on ne perd jamais une frappe en
 * cliquant ailleurs ») : un `<select>` natif, qui doit prendre le focus pour
 * s'ouvrir, créait l'étape avant qu'on ait choisi — ou refermait le champ
 * encore vide. `pointerdown` empêché : le curseur reste dans le texte, comme
 * pour les boutons « Phase / Sous-objectif » juste à côté.
 */
export function PastillePriorite({ valeur, onChange }: { valeur: Priority; onChange: (p: Priority) => void }) {
  const suivante = PRIORITES[(PRIORITES.indexOf(valeur) + 1) % PRIORITES.length];
  return (
    <button
      type="button"
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => onChange(suivante)}
      aria-label={t("{priorite} — passer à « {suivante} »", {
        priorite: phrasePriorite(valeur),
        suivante: nomDePriorite(suivante),
      })}
      data-tip={phrasePriorite(valeur)}
      data-tip-sub={t("Cliquer pour changer")}
      className="cible-tactile inline-flex shrink-0 items-center gap-1.5 rounded-[8px] border border-border bg-surface px-2 py-1.5 text-xs text-text-dim transition-colors hover:border-border-strong hover:text-text"
    >
      <IconePriorite priorite={valeur} />
      {/* Le mot se tait sur iPhone : l'icône seule y tient la place. */}
      <span className="hidden sm:inline">{nomDePriorite(valeur)}</span>
    </button>
  );
}
