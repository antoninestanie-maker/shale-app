// Ce que partagent les fenêtres d'IA (tâches, objectifs, notes) : l'appel et son
// état, et l'écran d'AVANT l'appel — ce qui va se passer, ce qui part, le bouton.
import { useState, type ReactNode } from "react";
import type { FonctionIa, PayloadDe, SortieDe } from "../../lib/ia/contrats";
import { useIa } from "../../lib/ia/useIa";
import { ApercuEnvoi } from "./ApercuEnvoi";
import { EtatIa, type EtatAppelIa } from "./EtatIa";
import { IconeIa } from "./IconeIa";

export function useAppel<F extends FonctionIa>(feature: F) {
  const { run } = useIa();
  const [etat, setEtat] = useState<EtatAppelIa>({ etat: "repos" });
  const [sortie, setSortie] = useState<SortieDe<F> | null>(null);
  const lancer = async (payload: PayloadDe<F>) => {
    setEtat({ etat: "chargement" });
    const r = await run(feature, payload);
    if (r.ok) setSortie(r.data);
    setEtat(r.ok ? { etat: "repos" } : { etat: "erreur", code: r.code, resetsAt: r.resetsAt ?? null });
  };
  return { etat, sortie, lancer };
}

export function Avant({
  children,
  payload,
  libelle,
  etat,
  onLancer,
}: {
  children: ReactNode;
  /** Le payload EXACT qui partira : c'est lui que montre « Ce qui sera envoyé ». */
  payload: unknown;
  libelle: string;
  etat: EtatAppelIa;
  onLancer: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm leading-relaxed text-text-dim">{children}</div>
      <ApercuEnvoi payload={payload} />
      <EtatIa etat={etat} onReessayer={onLancer} />
      {etat.etat !== "chargement" && (
        <button
          type="button"
          onClick={onLancer}
          className="pill fill-primary flex items-center gap-2 self-start px-4 py-2 text-sm font-semibold"
        >
          <IconeIa className="h-4 w-4" />
          {libelle}
        </button>
      )}
    </div>
  );
}
