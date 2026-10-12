import { useSyncExternalStore } from "react";
import { PanneauDate } from "./ChampDate";
import { abonnerSelecteurDate, demandeDeDate, fermerSelecteurDate } from "../lib/selecteurDate";

/**
 * L'hôte du calendrier ouvert sur place (`lib/selecteurDate.ts`) — monté UNE
 * fois, dans `App.tsx`. Il ne dessine rien lui-même : c'est `PanneauDate`, le
 * panneau de `ChampDate`.
 */
export default function SelecteurDateFlottant() {
  const demande = useSyncExternalStore(abonnerSelecteurDate, demandeDeDate, () => null);
  if (!demande) return null;
  return (
    <PanneauDate
      // Une NOUVELLE demande est un nouveau panneau : son curseur repart de la
      // date de CETTE tâche, pas de celle d'avant.
      key={cleDe(demande)}
      ancre={demande.ancre}
      ami={demande.ami}
      valeur={demande.valeur}
      effacable={demande.effacable}
      onChoisir={demande.onChoisir}
      onFermer={(rendreLeFocus) => {
        const retour = rendreLeFocus ? demande.focusApres?.() : null;
        fermerSelecteurDate();
        if (retour?.isConnected) retour.focus();
      }}
    />
  );
}

/** Une clé stable par demande — l'identité de l'objet, numérotée. */
const numeros = new WeakMap<object, number>();
let prochain = 1;
function cleDe(demande: object): number {
  let n = numeros.get(demande);
  if (!n) numeros.set(demande, (n = prochain++));
  return n;
}
