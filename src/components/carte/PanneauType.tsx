import { useEffect, useMemo, useRef, useState } from "react";

import type { Carte, GenreRef, RefNoeud } from "../../lib/carte";
import { t } from "../../lib/i18n";
import { menuContextuelOuvert } from "../../lib/menu/tactile";
import { peutAjouterEtape, type GenreEtape } from "../../lib/objectifs/structure";
import { objectifsAccueillants } from "../../lib/objectifs/typage";
import { typerEnEtape } from "../../lib/objectifs/typer";
import type { Goal } from "../../lib/types";

/**
 * ⭐ « SOUS QUEL OBJECTIF ? » — la seule question qui reste au typage direct.
 *
 * Jusqu'au soir du 2026-09-29, ce panneau s'ouvrait à CHAQUE typage pour
 * annoncer ce qui allait être créé, avec un bouton « Créer ». Antonin, après
 * essai : « on doit pouvoir choisir directement sans avoir de confirmation par
 * une fenêtre ». Le menu « Type » crée donc l'objet d'un clic (`planDirect`),
 * et ce panneau ne s'ouvre plus que quand la carte ne dit pas OÙ ranger une
 * étape — aucun ancêtre du nœud n'est un objectif. Ce n'est pas une
 * confirmation, c'est un choix : un clic sur l'objectif crée l'étape.
 */
export default function PanneauType(props: {
  genre: GenreEtape;
  carte: Carte;
  noeudId: string;
  /** Les objectifs VIVANTS, lus par l'éditeur. */
  goals: readonly Goal[];
  onFermer: () => void;
  /** L'étape est créée : le nœud devient sa référence. `sous` : le titre de l'objectif qui l'accueille. */
  onCree: (ref: RefNoeud, titre: string, genre: GenreRef, sous: string) => void;
}) {
  const { genre, carte, noeudId, goals } = props;
  const titre = (carte.noeuds.find((n) => n.id === noeudId)?.texte ?? "").trim();
  // Une phase ne va que sous un objectif racine ; un sous-objectif, sous une racine ou une phase.
  const accueillants = useMemo(
    () => objectifsAccueillants(goals).filter(({ goal }) => peutAjouterEtape(goal, genre, goals)),
    [goals, genre],
  );
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const premier = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    premier.current?.focus();
  }, []);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      // ⚠️ On MARQUE la touche : sans ça, un seul Échap referme aussi la carte
      // derrière (même convention que `DepuisCarte`).
      if (e.defaultPrevented || e.key !== "Escape" || menuContextuelOuvert()) return;
      e.preventDefault();
      e.stopPropagation();
      props.onFermer();
    };
    window.addEventListener("keydown", touche, true);
    return () => window.removeEventListener("keydown", touche, true);
  }, [props]);

  const nomObjectif = (g: Goal) => g.title.trim() || t("Sans titre");

  const choisir = async (parent: Goal) => {
    if (occupe || !titre) return;
    setOccupe(true);
    setErreur(null);
    try {
      const r = await typerEnEtape(titre, parent, genre, goals);
      if (r) props.onCree(r.ref, titre, r.genre, nomObjectif(parent));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  };

  const entete =
    genre === "jalon" ? t("Phase « {titre} » : sous quel objectif ?", { titre }) : t("Sous-objectif « {titre} » : sous quel objectif ?", { titre });

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4" onClick={props.onFermer}>
      <div
        role="dialog"
        aria-label={entete}
        className="card card-solid flex max-h-[78vh] w-full max-w-sm flex-col rounded-[16px] p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h4 className="font-display text-base font-bold text-text">{entete}</h4>
        <p className="mt-1 text-xs text-text-dim">{t("Aucun objectif au-dessus de ce nœud sur la carte : choisis celui qui l'accueille.")}</p>

        {accueillants.length === 0 ? (
          <p className="mt-3 text-sm text-text-dim">
            {t("Tu n'as encore aucun objectif. Crée-le d'abord, dans Objectifs ou avec « En faire un objectif ».")}
          </p>
        ) : (
          <ul className="mt-3 flex min-h-0 flex-col gap-0.5 overflow-y-auto">
            {accueillants.map(({ goal, niveau }, i) => (
              <li key={goal.id}>
                <button
                  ref={i === 0 ? premier : undefined}
                  type="button"
                  disabled={occupe}
                  onClick={() => void choisir(goal)}
                  className={`cible-tactile-ligne block w-full truncate rounded-[10px] px-3 py-2 text-left text-sm text-text hover:bg-surface-2 focus-visible:bg-surface-2 disabled:opacity-40 ${
                    niveau > 0 ? "pl-7 text-text-dim" : ""
                  }`}
                >
                  {nomObjectif(goal)}
                </button>
              </li>
            ))}
          </ul>
        )}

        {erreur && <p className="mt-2 text-xs text-red">{erreur}</p>}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={props.onFermer}
            className="pill cible-tactile-ligne px-3 py-1.5 text-sm font-medium text-text-dim hover:text-text"
          >
            {t("Annuler")}
          </button>
        </div>
      </div>
    </div>
  );
}
