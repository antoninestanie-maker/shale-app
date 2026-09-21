import { useMemo } from "react";
import { createPortal } from "react-dom";

import { carteDObjectif } from "../../lib/objectifs/carte";
import type { ContexteObjectifs } from "../../lib/objectifs/contexte";
import { uidDeLigne, type Mesure } from "../../lib/objectifs/progression";
import { ouvrirObjet } from "../../lib/naviguer";
import type { AppData, Goal } from "../../lib/types";
import EditeurCarte from "../carte/EditeurCarte";

/**
 * ⭐ La feuille de route d'un objectif, regardée comme une carte mentale.
 *
 * Antonin, 2026-09-20 : « ce serait aussi bon que ce système d'objectifs puisse
 * apparaître sous forme de carte mentale ».
 *
 * ⚠️ CE COMPOSANT NE FAIT QUE DEUX CHOSES, et c'est voulu : il DÉRIVE la carte
 * (fonction pure et testée, `lib/objectifs/carte.ts`) et il la donne à
 * `EditeurCarte` en LECTURE. Aucun second éditeur de carte n'a été écrit —
 * celui-ci porte déjà le zoom, le panoramique, « tout voir », l'export PNG/SVG
 * et la navigation au clavier, tout cela vérifié à l'écran depuis le
 * 2026-09-07. En réécrire une version « juste pour lire » aurait fabriqué deux
 * rendus de carte qui divergeraient au premier ajustement.
 *
 * ⚠️ Et la lecture n'est pas une pudeur : la carte est CALCULÉE à chaque
 * ouverture. Y écrire donnerait un dessin que personne ne relira — la feuille
 * de route est l'unique auteur de ces nœuds.
 */
export default function CarteObjectif(props: {
  racine: Goal;
  data: AppData;
  contexte: ContexteObjectifs;
  mesures: ReadonlyMap<number, Mesure>;
  onFermer: () => void;
}) {
  const { racine, data, contexte, mesures } = props;

  const carte = useMemo(() => {
    const faites = new Set(data.completions.filter((c) => c.done).map((c) => c.task_id));
    // ⚠️ Les pourcentages sont REPRIS de la vue, jamais recalculés : deux règles
    // de progression finiraient par donner deux chiffres pour la même étape.
    const pct = new Map<number, number | null>();
    for (const [id, m] of mesures) pct.set(id, m.pct);
    return carteDObjectif(racine, { goals: data.goals, tasks: data.tasks, faites, contexte, pct });
  }, [racine, data.goals, data.tasks, data.completions, contexte, mesures]);

  /**
   * ⚠️⚠️ PORTAIL OBLIGATOIRE, ET LA RAISON EST RETORSE — vue à l'écran le
   * 2026-09-20, en mesurant `elementFromPoint` au centre d'un nœud : il rendait
   * `BODY`.
   *
   * `EditeurCarte` pose `inert` sur `#root` le temps de sa vie, pour que la
   * tabulation n'atteigne pas ce qui est derrière. Rendu DANS l'arbre de la vue,
   * il est lui-même un descendant de `#root` : il s'éteignait donc lui-même. Le
   * symptôme était trompeur — le clavier marchait (son écouteur est posé sur
   * `window`, hors de l'arbre), la carte s'affichait, et seuls les CLICS ne
   * faisaient rien. Un utilisateur aurait conclu que la carte est un dessin
   * mort.
   *
   * Les deux hôtes de l'éditeur (Notes, Savoir) portaient déjà ce portail, pour
   * une autre raison (le `transform` d'un ancêtre animé devient le bloc
   * conteneur d'un `position: fixed`). Deux raisons différentes, une seule
   * parade : la carte se monte sur `document.body`, jamais dans la vue.
   */
  return createPortal(
    <EditeurCarte
      lecture
      titre={racine.title}
      carte={carte}
      source={{ kind: "goal", uid: uidDeLigne("goal", racine) }}
      onFermer={props.onFermer}
      onOuvrirRef={(kind, uid) => void ouvrirObjet(kind, uid)}
    />,
    document.body,
  );
}
