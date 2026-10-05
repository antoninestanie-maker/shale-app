// ─────────────────────────────────────────────────────────────────────────────
// La clôture du soir (#3) : un court bilan, et une proposition de report pour
// chaque tâche restante — demain, une date, plus tard, supprimer — à valider
// en groupe dans les brouillons. Rien n'est reporté ni supprimé sans le clic
// « Valider » ; une suppression passe par la corbeille (30 jours).
//
// S'il n'y a rien à reporter, l'IA n'est pas appelée : une action décomptée
// pour dire « tout est fait » ne rendrait aucun service.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getLang, t } from "../../lib/i18n";
import {
  appliquerProposition,
  lendemain,
  payloadCloture,
  propositionsDe,
  type PropositionCloture,
} from "../../lib/ia/brief";
import type { ActionCloture, SortieDe } from "../../lib/ia/contrats";
import { useIa } from "../../lib/ia/useIa";
import { todayStr } from "../../lib/logic";
import { ecrireContenuIa } from "../../lib/repo";
import type { AppData } from "../../lib/types";
import { EtatIa, type EtatAppelIa } from "./EtatIa";
import { FenetreIa } from "./FenetreIa";
import { Propositions } from "./Propositions";

function libelleAction(a: ActionCloture): string {
  switch (a) {
    case "demain":
      return t("Demain");
    case "date":
      return t("À une date");
    case "plus_tard":
      return t("Plus tard (sans date)");
    case "supprimer":
      return t("Supprimer");
  }
}

const ACTIONS: readonly ActionCloture[] = ["demain", "date", "plus_tard", "supprimer"];

export function ClotureSoir({
  data,
  refresh,
  onFermer,
}: {
  data: AppData;
  refresh: () => Promise<void>;
  onFermer: () => void;
}) {
  const { run } = useIa();
  const jour = todayStr();
  const payload = useMemo(() => payloadCloture(getLang(), jour, data), [jour, data]);
  const [etat, setEtat] = useState<EtatAppelIa>({ etat: "repos" });
  const [sortie, setSortie] = useState<SortieDe<"cloture"> | null>(null);
  const lance = useRef(false);

  const lancer = useCallback(async () => {
    setEtat({ etat: "chargement" });
    const r = await run("cloture", payload);
    if (r.ok) {
      setSortie(r.data);
      setEtat({ etat: "repos" });
    } else setEtat({ etat: "erreur", code: r.code, resetsAt: r.resetsAt ?? null });
  }, [run, payload]);

  useEffect(() => {
    if (lance.current || payload.restantes.length === 0) return;
    lance.current = true;
    void lancer();
  }, [lancer, payload.restantes.length]);

  const propositions = useMemo(() => (sortie ? propositionsDe(sortie, data) : []), [sortie, data]);

  const valider = async (choisies: PropositionCloture[]) => {
    for (const p of choisies) await appliquerProposition(p, jour);
    await ecrireContenuIa("cloture", jour, { bilan: sortie?.bilan ?? "", appliquees: choisies.length }).catch(() => undefined);
    await refresh();
    onFermer();
  };

  return (
    <FenetreIa titre={t("Clôture de la journée")} onFermer={onFermer} large>
      {payload.restantes.length === 0 ? (
        <p className="text-sm leading-relaxed text-text">
          {t("Rien à reporter : tout ce qui était prévu pour aujourd'hui est fait, ou n'avait pas de date.")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <EtatIa etat={etat} onReessayer={() => void lancer()} />
          {sortie && (
            <>
              <p className="text-[15px] leading-relaxed text-text">{sortie.bilan}</p>
              <Propositions
                items={propositions}
                cle={(p) => String(p.tache.id)}
                libelleValider={(n) => t("Appliquer ({n})", { n })}
                vide={t("L'IA n'a rien proposé pour les tâches restantes.")}
                onAnnuler={onFermer}
                onValider={valider}
                rendu={(p, maj) => (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm font-medium text-text">{p.tache.label}</p>
                    <p className="text-xs leading-relaxed text-text-dim">{p.raison}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={p.action}
                        onChange={(e) => {
                          const action = e.target.value as ActionCloture;
                          maj({ ...p, action, date: action === "date" ? (p.date ?? lendemain(jour)) : null });
                        }}
                        aria-label={t("Que faire de cette tâche ?")}
                        className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-text"
                      >
                        {ACTIONS.map((a) => (
                          <option key={a} value={a}>
                            {libelleAction(a)}
                          </option>
                        ))}
                      </select>
                      {p.action === "date" && (
                        <input
                          type="date"
                          min={lendemain(jour)}
                          value={p.date ?? lendemain(jour)}
                          onChange={(e) => maj({ ...p, date: e.target.value || null })}
                          aria-label={t("Nouvelle date")}
                          className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-text"
                        />
                      )}
                    </div>
                  </div>
                )}
              />
            </>
          )}
        </div>
      )}
    </FenetreIa>
  );
}
