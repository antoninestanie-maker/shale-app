import { useEffect, useRef } from "react";
import { ICONE_DE_KIND, LIBELLE_DE_KIND } from "./libelles";
import type { Trouvaille } from "../../lib/recherche";
import { t } from "../../lib/i18n";

/**
 * Le sélecteur qui s'ouvre à la frappe d'un `@`.
 *
 * Purement présentationnel : la navigation au clavier est tenue par l'éditeur,
 * qui est le seul à savoir si la frappe lui est destinée ou non.
 *
 * ⚠️ Positionné en `fixed` sur le rectangle du curseur, et REPLIÉ VERS LE HAUT
 * quand il déborderait du bas de la fenêtre. Sans cela, une mention tapée en bas
 * d'une longue note ouvrirait une liste hors de l'écran — et sur téléphone,
 * sous le clavier.
 */
interface Props {
  resultats: Trouvaille[];
  selection: number;
  position: { x: number; y: number };
  onChoisir: (r: Trouvaille) => void;
}

const HAUTEUR_MAX = 260;

export default function MentionPicker({ resultats, selection, position, onChoisir }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Garde la ligne sélectionnée visible quand on descend au clavier.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(`[data-i="${selection}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selection]);

  /**
   * ⭐ LA HAUTEUR UTILE, PAS LA HAUTEUR DE LA FENÊTRE.
   *
   * ⚠️ Sur iPhone, ouvrir le clavier logiciel ne change PAS `innerHeight` : la
   * fenêtre garde sa taille, le clavier se pose par-dessus. Un sélecteur placé
   * d'après `innerHeight` s'affiche donc **sous le clavier**, invisible et
   * inatteignable — exactement le défaut que le cahier des charges du chantier
   * iOS nommait. `visualViewport` mesure ce qui reste VISIBLE, clavier déduit ;
   * c'est la seule mesure qui dit la vérité ici.
   *
   * Le repli sur `innerHeight` couvre le bureau, où les deux coïncident.
   */
  const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
  const hauteurUtile = vv?.height ?? window.innerHeight;
  const largeurUtile = vv?.width ?? window.innerWidth;
  // `offsetTop` : la partie visible peut aussi être DÉCALÉE vers le bas quand
  // la page a été poussée par le clavier.
  const basVisible = (vv?.offsetTop ?? 0) + hauteurUtile;

  const place = position.y + HAUTEUR_MAX > basVisible;

  return (
    <div
      ref={ref}
      className="card card-solid fixed z-50 max-h-[16rem] w-72 overflow-y-auto p-1 shadow-lg"
      style={{
        left: Math.max(8, Math.min(position.x, largeurUtile - 296)),
        top: place ? undefined : position.y + 6,
        bottom: place ? window.innerHeight - position.y + 22 : undefined,
      }}
    >
      {resultats.length === 0 ? (
        <p className="px-3 py-2 text-sm text-text-dim">{t("Rien à citer sous ce nom.")}</p>
      ) : (
        resultats.map((r, i) => (
          <button
            key={`${r.kind}-${r.id}`}
            type="button"
            data-i={i}
            // ⚠️ `onMouseDown` et non `onClick` : le clic ferait d'abord perdre
            // le curseur de l'éditeur, et on ne saurait plus où insérer.
            onMouseDown={(e) => {
              e.preventDefault();
              onChoisir(r);
            }}
            className={`cible-tactile-ligne flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
              i === selection ? "bg-overlay-2 text-text" : "text-text-dim hover:bg-overlay"
            }`}
          >
            <span className="shrink-0 text-text-dim">{ICONE_DE_KIND[r.kind]}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-text">{r.titre}</span>
              <span className="block truncate text-[0.7rem] text-text-dim">
                {r.contexte ?? t(LIBELLE_DE_KIND[r.kind])}
              </span>
            </span>
          </button>
        ))
      )}
    </div>
  );
}
