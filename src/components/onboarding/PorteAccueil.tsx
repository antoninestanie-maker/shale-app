import Accueil from "./Accueil";
import { useAccueil } from "../../lib/onboarding/useAccueil";

/**
 * Le point de montage de l'accueil.
 *
 * ⚠️ CE COMPOSANT EXISTE POUR UNE RAISON DE PLACEMENT, pas de découpage :
 * `useAccueil()` lit l'état de la synchronisation par `useSyncApi()`, qui exige
 * d'être **à l'intérieur** de `<SyncProvider>`. Or `App` est le composant qui
 * MONTE ce provider : son propre corps est donc au-dessus du contexte, et le
 * hook y lèverait « useSyncApi doit être utilisé dans <SyncProvider> ».
 *
 * Le décider dans un enfant est la seule façon de savoir si le premier cycle a
 * abouti avant de trancher — voir le commentaire de `useAccueil`, qui explique
 * pourquoi ce moment compte.
 */
export default function PorteAccueil({
  onFini,
}: {
  /** `allerAuxTaches` : l'utilisateur a saisi une première tâche, on l'y emmène. */
  onFini: (allerAuxTaches: boolean) => void;
}) {
  const { etat, terminer } = useAccueil();
  if (etat !== "requis") return null;
  return (
    <Accueil
      onDone={(allerAuxTaches) => {
        terminer();
        onFini(allerAuxTaches);
      }}
    />
  );
}
