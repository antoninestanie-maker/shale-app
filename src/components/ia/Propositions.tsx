// ─────────────────────────────────────────────────────────────────────────────
// Les brouillons à valider — le composant commun à toutes les fonctions d'IA
// qui proposent des objets (tâches, reports, lignes de facture, liens…).
//
//   <Propositions
//     items={taches}
//     cle={(t) => t.label}
//     rendu={(t, maj) => <input value={t.label} onChange={(e) => maj({ ...t, label: e.target.value })} />}
//     onValider={(choisies) => creerTaches(choisies)}
//     onAnnuler={fermer}
//   />
//
// Rien n'est écrit tant que l'utilisateur n'a pas cliqué « Valider » : seul ce
// qu'il a coché, tel qu'il l'a corrigé, part vers `onValider`. La logique est
// dans `lib/ia/propositions.ts` (testée à part).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type ReactNode } from "react";
import { t, tp } from "../../lib/i18n";
import { basculer, choisies, initialiser, modifier, toutes, type EtatPropositions } from "../../lib/ia/propositions";
import { CaseACocher } from "../CaseACocher";

export function Propositions<T>({
  items,
  cle,
  rendu,
  onValider,
  onAnnuler,
  libelleValider,
  vide,
}: {
  items: readonly T[];
  cle: (item: T, index: number) => string;
  /** Le rendu d'une proposition ; `maj` enregistre la version corrigée. */
  rendu: (item: T, maj: (nouveau: T) => void) => ReactNode;
  onValider: (choisies: T[]) => void | Promise<void>;
  onAnnuler: () => void;
  /** Par défaut : « Valider (n) ». */
  libelleValider?: (n: number) => string;
  /** Affiché quand l'IA n'a rien proposé. */
  vide?: string;
}) {
  const [etat, setEtat] = useState<EtatPropositions<T>>(() => initialiser(items, cle));
  const [envoi, setEnvoi] = useState(false);
  const n = choisies(etat).length;
  const tout = n === etat.ordre.length;

  if (etat.ordre.length === 0)
    return (
      <div className="text-sm text-text-dim">
        <p>{vide ?? t("L'IA n'a rien trouvé à proposer.")}</p>
        <button type="button" onClick={onAnnuler} className="mt-3 text-sm font-medium text-blue hover:underline">
          {t("Fermer")}
        </button>
      </div>
    );

  const valider = async () => {
    if (n === 0 || envoi) return;
    setEnvoi(true);
    try {
      await onValider(choisies(etat));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="hud-label">{tp(etat.ordre.length, "{n} proposition", "{n} propositions")}</p>
        <button
          type="button"
          onClick={() => setEtat((e) => toutes(e, !tout))}
          className="text-xs font-medium text-blue hover:underline"
        >
          {tout ? t("Tout décocher") : t("Tout cocher")}
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {etat.ordre.map((k) => {
          const it = etat.items[k];
          return (
            <li
              key={k}
              className={`grid grid-cols-[auto_1fr] items-start gap-3 rounded-[10px] border border-border px-3 py-2.5 transition-opacity ${
                it.cochee ? "" : "opacity-55"
              }`}
            >
              <span className="pt-0.5">
                <CaseACocher
                  cochee={it.cochee}
                  onBascule={() => setEtat((e) => basculer(e, k))}
                  libelle={t("Garder cette proposition")}
                  taille="sm"
                />
              </span>
              <div className="min-w-0">{rendu(it.valeur, (v) => setEtat((e) => modifier(e, k, v)))}</div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          onClick={valider}
          disabled={n === 0 || envoi}
          className="pill fill-primary px-5 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {libelleValider ? libelleValider(n) : t("Valider ({n})", { n })}
        </button>
        <button
          type="button"
          onClick={onAnnuler}
          className="pill border border-border bg-surface-2 px-5 py-2 text-sm text-text transition-colors hover:border-blue/50"
        >
          {t("Tout rejeter")}
        </button>
      </div>
    </div>
  );
}
