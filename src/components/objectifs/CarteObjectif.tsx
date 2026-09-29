import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { Carte, RefNoeud } from "../../lib/carte";
import type { KindCorbeille } from "../../lib/corbeille/regles";
import {
  carteDObjectif,
  clePositionsObjectif,
  ecrirePositionsObjectif,
  lirePositionsObjectif,
  type PositionsObjectif,
} from "../../lib/objectifs/carte";
import { rattachementsDe, type ContexteObjectifs } from "../../lib/objectifs/contexte";
import { uidDeLigne } from "../../lib/objectifs/progression";
import { peutAjouterEtape } from "../../lib/objectifs/structure";
import { genresPour } from "../../lib/objectifs/typage";
import { typerEnEtape, typerEnTache } from "../../lib/objectifs/typer";
import { ouvrirObjet } from "../../lib/naviguer";
import {
  deleteLink,
  getSetting,
  renommerHabitude,
  renommerObjectif,
  renommerTache,
  setSetting,
} from "../../lib/repo";
import type { AppData, Goal } from "../../lib/types";
import EditeurCarte, { type EnfantObjectif, type GestesObjectif } from "../carte/EditeurCarte";
import { jeter } from "../corbeille/geste";

/**
 * ⭐ La feuille de route d'un objectif, en carte mentale — ÉDITABLE depuis le
 * 2026-09-29.
 *
 * Antonin, 2026-09-20 : « ce serait aussi bon que ce système d'objectifs puisse
 * apparaître sous forme de carte mentale ». Elle était en lecture seule ; elle
 * devient une SECONDE VUE du même plan, modifiable des deux côtés :
 *   • ajouter un enfant EXIGE un type (phase, sous-objectif, tâche, habitude) ;
 *   • renommer un nœud renomme l'objet, et la feuille de route le montre ;
 *   • cocher une tâche passe par `basculerTache`, comme partout ;
 *   • supprimer passe par `jeter` — deux temps, puis « Supprimés récemment » ;
 *     une note rattachée, elle, se DÉTACHE (décision E) ;
 *   • glisser ne change QUE la place à l'écran : l'ordre des étapes ne change
 *     que dans la feuille de route.
 *
 * ⚠️ AUCUN JSON DE CARTE : la carte est re-dérivée des données à chaque
 * écriture (`carteDObjectif`). Toute écriture émet `sb:data-changed` — c'est
 * lui qui fait relire l'app, donc redessiner la carte (PIEGES § 18.2).
 *
 * ⚠️ Les positions posées à la main vivent dans un RÉGLAGE synchronisé,
 * `carte.objectif.<uid>`, jamais sur les lignes d'objectif (décision B).
 */
export default function CarteObjectif(props: {
  racine: Goal;
  data: AppData;
  contexte: ContexteObjectifs;
  onFermer: () => void;
}) {
  const { racine, data, contexte } = props;
  const cle = clePositionsObjectif(uidDeLigne("goal", racine));

  /** `null` tant que le réglage n'est pas lu : on n'ouvre pas la carte sans ses positions. */
  const [positions, setPositions] = useState<PositionsObjectif | null>(null);
  const ecrit = useRef<string | null>(null);
  useEffect(() => {
    let vivant = true;
    void getSetting(cle).then((brut) => {
      if (!vivant) return;
      ecrit.current = brut;
      setPositions(lirePositionsObjectif(brut));
    });
    return () => {
      vivant = false;
    };
  }, [cle]);

  const carte = useMemo(
    () =>
      carteDObjectif(racine, {
        goals: data.goals,
        tasks: data.tasks,
        habits: data.habits,
        contexte,
        positions: positions ?? {},
      }),
    [racine, data.goals, data.tasks, data.habits, contexte, positions],
  );

  const signaler = () => window.dispatchEvent(new Event("sb:data-changed"));
  const objectifDe = (uid: string) => data.goals.find((g) => uidDeLigne("goal", g) === uid) ?? null;

  const gestes: GestesObjectif = {
    enfantsPossibles: (ref) => {
      if (ref.kind !== "goal") return [];
      const g = objectifDe(ref.uid);
      if (!g) return [];
      const out: EnfantObjectif[] = genresPour(g, data.goals).map((x) => (x === "jalon" ? "phase" : "sous-objectif"));
      out.push("tache");
      // Une habitude se rattache par l'étape qui la compte (décision C) : il
      // faut donc une place pour un sous-objectif ici ou juste au-dessus.
      const parent = g.parent_goal_id == null ? null : data.goals.find((x) => x.id === g.parent_goal_id);
      if (peutAjouterEtape(g, "sous-objectif", data.goals) || (parent && peutAjouterEtape(parent, "sous-objectif", data.goals))) {
        out.push("habitude");
      }
      return out;
    },
    creer: async (parentRef, type, titre) => {
      const parent = parentRef.kind === "goal" ? objectifDe(parentRef.uid) : null;
      if (!parent) return;
      // Les MÊMES écritures que le typage d'un nœud de note (`typer.ts`) : une
      // étape en dernier rang, une tâche rattachée — et `sb:data-changed`.
      if (type === "tache") await typerEnTache(titre, parent);
      else await typerEnEtape(titre, parent, type === "phase" ? "jalon" : "sous-objectif", data.goals);
    },
    renommer: async (ref, titre) => {
      const nom = titre.trim();
      if (!nom) return;
      const id = idDe(ref, data);
      if (id == null) return;
      if (ref.kind === "goal") await renommerObjectif(id, nom);
      else if (ref.kind === "task") await renommerTache(id, nom);
      else if (ref.kind === "habit") await renommerHabitude(id, nom);
      signaler();
    },
    supprimer: async (ref, parentRef, titre) => {
      if (ref.kind === "goal" || ref.kind === "task" || ref.kind === "habit") {
        const id = idDe(ref, data);
        if (id == null) return;
        // Le chemin NORMAL de l'app (règle 18) : la corbeille, son toast et son
        // « Annuler ». Un objectif qui a des étapes les emporte en un seul lot.
        await jeter(ref.kind as KindCorbeille, id, titre, signaler);
        return;
      }
      // ⭐ Décision E : une note, une fiche, un événement RATTACHÉS ne sont pas
      // un morceau de l'objectif — on retire le lien, exactement comme le ✕ de
      // la feuille de route (`deleteLink`), et jamais la note elle-même.
      if (!parentRef || parentRef.kind !== "goal") return;
      const lien = rattachementsDe(parentRef.uid, contexte).find((r) => r.kind === ref.kind && r.uid === ref.uid)?.lien;
      if (!lien) return;
      await deleteLink(lien.id);
      signaler();
    },
  };

  /** Les positions, et elles seules, partent dans le réglage — et seulement si elles ont changé. */
  const enregistrerPositions = (c: Carte) => {
    const brut = ecrirePositionsObjectif(c);
    if (brut === ecrit.current || (ecrit.current === null && brut === ecrirePositionsObjectif({ v: 1, noeuds: [] }))) return;
    ecrit.current = brut;
    void setSetting(cle, brut);
  };

  if (positions === null) return null;

  /**
   * ⚠️⚠️ PORTAIL OBLIGATOIRE — vu à l'écran le 2026-09-20 (PIEGES § 18.1).
   * `EditeurCarte` pose `inert` sur `#root` : rendu dans l'arbre de la vue, il
   * s'éteindrait lui-même.
   */
  return createPortal(
    <EditeurCarte
      titre={racine.title}
      carte={carte}
      source={{ kind: "goal", uid: uidDeLigne("goal", racine) }}
      objectif={gestes}
      onEnregistrer={enregistrerPositions}
      onFermer={props.onFermer}
      onOuvrirRef={(kind, uid) => void ouvrirObjet(kind, uid)}
    />,
    document.body,
  );
}

/** Le numéro LOCAL d'un objet cité, relu dans les données (jamais deviné). */
function idDe(ref: RefNoeud, data: AppData): number | null {
  const liste =
    ref.kind === "goal" ? data.goals : ref.kind === "task" ? data.tasks : ref.kind === "habit" ? data.habits : [];
  const kind = ref.kind as "goal" | "task" | "habit";
  return liste.find((x) => uidDeLigne(kind, x) === ref.uid)?.id ?? null;
}
