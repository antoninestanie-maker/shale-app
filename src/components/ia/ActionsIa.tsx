// ─────────────────────────────────────────────────────────────────────────────
// Les actions d'IA sur une tâche ou un objectif (Phase E) — UNE fenêtre, montée
// une fois dans `App`, ouverte par `demanderIa()` (`lib/ia/demande.ts`).
//
//   Découper (#7)        une tâche floue → des tâches reliées à elle
//   Estimer (#8)         une durée, calculée ICI sur les comparables retenus
//   Décomposer (#11)     un objectif → des sous-objectifs
//   Proposer des tâches (#12)  un objectif → des tâches datées, rattachées
//   Pourquoi, et que faire ? (#13)  un objectif en péril → explication + plan
//
// Même déroulé partout : ce qui va partir (repli « Ce qui sera envoyé »), un
// bouton, puis des brouillons à valider. Rien n'est écrit avant « Valider ».
// Le texte du modèle est rendu en nœuds texte, jamais en HTML.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { objectifsEnPeril } from "../../lib/calendrier/peril";
import { formatDate, getLang, t, tp } from "../../lib/i18n";
import type { TacheProposee } from "../../lib/ia/contrats";
import { EVENEMENT_DEMANDE_IA, type DemandeIa } from "../../lib/ia/demande";
import {
  appliquerDecoupage,
  appliquerEtapes,
  appliquerTachesProposees,
  chargeJours,
  comparablesDe,
  descendants,
  fourchette,
  JOURS_HISTORIQUE,
  joursDeCharge,
  MIN_COMPARABLES,
  payloadDecomposer,
  payloadDecouper,
  payloadEstimer,
  payloadPeril,
  payloadTachesObjectif,
  peutDecomposer,
  retenusParmi,
  type Comparable,
} from "../../lib/ia/planifier";
import { addDays, todayStr } from "../../lib/logic";
import { fetchCalendarEvents, historiqueFocus } from "../../lib/repo";
import { afficherToast } from "../../lib/toast";
import type { AppData, Goal, Task } from "../../lib/types";
import { Avant, useAppel } from "./communs";
import { FenetreIa } from "./FenetreIa";
import { Propositions } from "./Propositions";

const CHAMP = "rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm text-text";

function duree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return t("{n} min", { n: m });
  if (m === 0) return t("{n} h", { n: h });
  return `${h} h ${String(m).padStart(2, "0")}`;
}

export function ActionsIa({ data, refresh }: { data: AppData | null; refresh: () => Promise<void> }) {
  const [demande, setDemande] = useState<DemandeIa | null>(null);
  useEffect(() => {
    const ouvrir = (e: Event) => setDemande((e as CustomEvent<DemandeIa>).detail);
    window.addEventListener(EVENEMENT_DEMANDE_IA, ouvrir);
    return () => window.removeEventListener(EVENEMENT_DEMANDE_IA, ouvrir);
  }, []);
  if (!demande || !data) return null;

  const fermer = () => setDemande(null);
  // ⚠️ Relu dans les données FRAÎCHES : une tâche ou un objectif jeté entre le
  // clic et l'ouverture ferme la fenêtre au lieu d'agir sur un fantôme.
  if ("taskId" in demande) {
    const task = data.tasks.find((x) => x.id === demande.taskId);
    if (!task) return null;
    return demande.action === "decouper" ? (
      <Decouper task={task} data={data} refresh={refresh} fermer={fermer} />
    ) : (
      <Estimer task={task} data={data} fermer={fermer} />
    );
  }
  const goal = data.goals.find((g) => g.id === demande.goalId);
  if (!goal) return null;
  if (demande.action === "peril") return <Peril goal={goal} data={data} refresh={refresh} fermer={fermer} />;
  return <Objectif goal={goal} mode={demande.action} data={data} refresh={refresh} fermer={fermer} />;
}

function ChoixPriorite({ valeur, onChange }: { valeur: TacheProposee["priorite"]; onChange: (p: TacheProposee["priorite"]) => void }) {
  return (
    <select value={valeur} onChange={(e) => onChange(e.target.value as TacheProposee["priorite"])} aria-label={t("Priorité")} className={CHAMP}>
      <option value="high">{t("Élevée")}</option>
      <option value="medium">{t("Moyenne")}</option>
      <option value="low">{t("Faible")}</option>
    </select>
  );
}

function Titre({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  return (
    <input
      value={valeur}
      maxLength={200}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t("Titre")}
      className="rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-text"
    />
  );
}

function ChampJour({ valeur, onChange, label }: { valeur: string | null; onChange: (v: string | null) => void; label: string }) {
  return <input type="date" value={valeur ?? ""} onChange={(e) => onChange(e.target.value || null)} aria-label={label} className={CHAMP} />;
}

// ── #7 Découper ─────────────────────────────────────────────────────────────

function Decouper({ task, data, refresh, fermer }: { task: Task; data: AppData; refresh: () => Promise<void>; fermer: () => void }) {
  const jour = todayStr();
  const payload = useMemo(() => payloadDecouper(getLang(), jour, task, data.goals), [task, data.goals, jour]);
  const { etat, sortie, lancer } = useAppel("decouper");
  const objectif = task.goal_id != null ? data.goals.find((g) => g.id === task.goal_id) : null;

  return (
    <FenetreIa titre={t("Découper « {titre} »", { titre: task.label })} onFermer={fermer} large={!!sortie}>
      {sortie ? (
        <Propositions
          items={sortie.etapes}
          cle={(x, i) => `${i}-${x.titre}`}
          vide={t("Cette tâche est déjà concrète : l'IA ne propose pas de la découper.")}
          libelleValider={(n) => tp(n, "Créer {n} tâche", "Créer {n} tâches")}
          onAnnuler={fermer}
          onValider={async (choisies) => {
            await appliquerDecoupage(task, choisies);
            await refresh();
            afficherToast({ msg: tp(choisies.length, "{n} tâche créée, reliée à « {titre} »", "{n} tâches créées, reliées à « {titre} »", { titre: task.label }) });
            fermer();
          }}
          rendu={(x, maj) => (
            <div className="flex flex-col gap-1.5">
              <Titre valeur={x.titre} onChange={(titre) => maj({ ...x, titre })} />
              <div className="flex flex-wrap items-center gap-2">
                <ChoixPriorite valeur={x.priorite} onChange={(priorite) => maj({ ...x, priorite })} />
                <ChampJour valeur={x.date} onChange={(date) => maj({ ...x, date })} label={t("Date")} />
              </div>
            </div>
          )}
        />
      ) : (
        <Avant payload={payload} libelle={t("Découper")} etat={etat} onLancer={() => void lancer(payload)}>
          <p>
            {t("L'IA propose des étapes concrètes. Chacune devient une tâche, reliée à celle-ci.")}{" "}
            {objectif ? `${t("Elles rejoignent l'objectif « {o} ».", { o: objectif.title })} ` : ""}
            {task.tag ? `${t("Elles portent l'étiquette « {e} ».", { e: task.tag })} ` : ""}
            {t("La tâche d'origine reste : à toi de voir si elle a encore un sens.")}
          </p>
        </Avant>
      )}
    </FenetreIa>
  );
}

// ── #8 Estimer ──────────────────────────────────────────────────────────────

function Estimer({ task, data, fermer }: { task: Task; data: AppData; fermer: () => void }) {
  const [comparables, setComparables] = useState<Comparable[] | null>(null);
  const { etat, sortie, lancer } = useAppel("estimer");
  useEffect(() => {
    let vivant = true;
    historiqueFocus(addDays(todayStr(), -JOURS_HISTORIQUE))
      .then((h) => vivant && setComparables(comparablesDe(task, data.tasks, h)))
      .catch(() => vivant && setComparables([]));
    return () => {
      vivant = false;
    };
  }, [task, data.tasks]);

  const payload = comparables ? payloadEstimer(getLang(), task, comparables) : null;
  const retenus = sortie && comparables ? retenusParmi(comparables, sortie.retenus) : null;
  const f = retenus ? fourchette(retenus.map((c) => c.minutes)) : null;

  let contenu: ReactNode;
  if (!comparables) contenu = <p className="text-sm text-text-dim">{t("Lecture de l'historique du Timer…")}</p>;
  else if (comparables.length < MIN_COMPARABLES)
    // ⭐ Pas assez d'historique : on le dit, on n'estime rien, et AUCUNE action n'est consommée.
    contenu = (
      <div className="text-sm leading-relaxed text-text">
        <p>
          {t("Pas assez d'historique pour estimer cette tâche.")}{" "}
          {tp(
            comparables.length,
            "Il faut au moins {min} tâches comparables suivies au Timer (même étiquette, même objectif ou mots en commun) ; il y en a {n}.",
            "Il faut au moins {min} tâches comparables suivies au Timer (même étiquette, même objectif ou mots en commun) ; il y en a {n}.",
            { min: MIN_COMPARABLES },
          )}
        </p>
        <p className="mt-2 text-text-dim">{t("Lance le Timer sur tes tâches : l'estimation viendra avec l'historique.")}</p>
      </div>
    );
  else if (!sortie && payload)
    contenu = (
      <Avant payload={payload} libelle={t("Estimer")} etat={etat} onLancer={() => void lancer(payload)}>
        <p>
          {tp(
            comparables.length,
            "{n} tâche comparable trouvée dans ton historique Timer. L'IA choisit celles qui ressemblent vraiment à celle-ci ; la fourchette est calculée sur ton temps réel.",
            "{n} tâches comparables trouvées dans ton historique Timer. L'IA choisit celles qui ressemblent vraiment à celle-ci ; la fourchette est calculée sur ton temps réel.",
          )}
        </p>
      </Avant>
    );
  else if (sortie && retenus)
    contenu = (
      <div className="flex flex-col gap-3 text-sm">
        {f ? (
          <>
            <p className="font-display text-2xl font-extrabold text-text">
              {f.basse === f.haute ? t("Environ {a}", { a: duree(f.basse) }) : t("Entre {a} et {b}", { a: duree(f.basse), b: duree(f.haute) })}
            </p>
            <p className="text-text-dim">
              {tp(f.n, "Médiane {m}, sur {n} tâche comparable.", "Médiane {m}, sur {n} tâches comparables.", { m: duree(f.mediane) })}{" "}
              {t("Durées du Timer, pauses comprises.")}
            </p>
          </>
        ) : (
          <p className="text-text">{t("L'IA n'a retenu aucun comparable : pas d'estimation.")}</p>
        )}
        {sortie.justification && <p className="leading-relaxed text-text">{sortie.justification}</p>}
        {retenus.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-lg bg-surface-2 px-3 py-2">
            {retenus.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-text">{c.titre}</span>
                <span className="shrink-0 font-mono text-xs text-text-dim">
                  {duree(c.minutes)}
                  {c.recurrente ? ` ${t("par occurrence")}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={fermer} className="self-start text-sm font-medium text-blue hover:underline">
          {t("Fermer")}
        </button>
      </div>
    );

  return (
    <FenetreIa titre={t("Estimer « {titre} »", { titre: task.label })} onFermer={fermer}>
      {contenu}
    </FenetreIa>
  );
}

// ── La charge du calendrier, lue à l'ouverture ──────────────────────────────

function useCharge(data: AppData, echeance: string | null) {
  const [charge, setCharge] = useState<ReturnType<typeof chargeJours> | null>(null);
  useEffect(() => {
    let vivant = true;
    const jour = todayStr();
    const nb = Math.min(62, joursDeCharge(jour, echeance));
    fetchCalendarEvents(jour, addDays(jour, nb - 1))
      .catch(() => [])
      .then((evts) => vivant && setCharge(chargeJours(data.tasks, data.completions, evts, jour, nb)));
    return () => {
      vivant = false;
    };
  }, [data.tasks, data.completions, echeance]);
  return charge;
}

/** Le rendu d'une tâche proposée pour un objectif (#12, #13) : titre, priorité, date, étape. */
function LigneTacheProposee({ x, maj, etapes }: { x: TacheProposee; maj: (n: TacheProposee) => void; etapes: readonly Goal[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Titre valeur={x.titre} onChange={(titre) => maj({ ...x, titre })} />
      <div className="flex flex-wrap items-center gap-2">
        <ChoixPriorite valeur={x.priorite} onChange={(priorite) => maj({ ...x, priorite })} />
        <ChampJour valeur={x.date} onChange={(date) => maj({ ...x, date })} label={t("Date")} />
        {etapes.length > 0 && (
          <select
            value={x.etape ?? ""}
            onChange={(e) => maj({ ...x, etape: e.target.value || null })}
            aria-label={t("Étape")}
            className={`${CHAMP} max-w-[16rem]`}
          >
            <option value="">{t("L'objectif lui-même")}</option>
            {etapes.map((g) => (
              <option key={g.id} value={String(g.id)}>
                {g.title}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

// ── #11 Décomposer, #12 Proposer des tâches ─────────────────────────────────

function Objectif({
  goal,
  mode,
  data,
  refresh,
  fermer,
}: {
  goal: Goal;
  mode: "decomposer" | "taches";
  data: AppData;
  refresh: () => Promise<void>;
  fermer: () => void;
}) {
  const jour = todayStr();
  const charge = useCharge(data, goal.deadline);
  const decomposer = useAppel("decomposer_objectif");
  const taches = useAppel("etapes_objectif");
  const arbre = useMemo(() => descendants(goal, data.goals), [goal, data.goals]);
  const titre =
    mode === "decomposer" ? t("Décomposer « {titre} »", { titre: goal.title }) : t("Tâches pour « {titre} »", { titre: goal.title });

  if (!charge)
    return (
      <FenetreIa titre={titre} onFermer={fermer}>
        <p className="text-sm text-text-dim">{t("Lecture du calendrier…")}</p>
      </FenetreIa>
    );

  if (mode === "decomposer") {
    if (!peutDecomposer(goal, data.goals))
      return (
        <FenetreIa titre={titre} onFermer={fermer}>
          <p className="text-sm text-text">{t("Cette étape est déjà au dernier niveau de la feuille de route : on ne peut plus la découper en sous-objectifs. Propose-lui plutôt des tâches.")}</p>
        </FenetreIa>
      );
    const payload = payloadDecomposer(getLang(), jour, goal, data.goals, charge);
    return (
      <FenetreIa titre={titre} onFermer={fermer} large={!!decomposer.sortie}>
        {decomposer.sortie ? (
          <Propositions
            items={decomposer.sortie.etapes}
            cle={(x, i) => `${i}-${x.titre}`}
            libelleValider={(n) => tp(n, "Créer {n} sous-objectif", "Créer {n} sous-objectifs")}
            onAnnuler={fermer}
            onValider={async (choisies) => {
              await appliquerEtapes(goal, data.goals, choisies);
              await refresh();
              fermer();
            }}
            rendu={(x, maj) => (
              <div className="flex flex-col gap-1.5">
                <Titre valeur={x.titre} onChange={(titre) => maj({ ...x, titre })} />
                <div className="flex flex-wrap items-center gap-2">
                  <ChoixPriorite valeur={x.priorite} onChange={(priorite) => maj({ ...x, priorite })} />
                  <ChampJour valeur={x.echeance} onChange={(echeance) => maj({ ...x, echeance })} label={t("Échéance")} />
                </div>
              </div>
            )}
          />
        ) : (
          <Avant payload={payload} libelle={t("Décomposer")} etat={decomposer.etat} onLancer={() => void decomposer.lancer(payload)}>
            <p>
              {t("L'IA propose des sous-objectifs, ajoutés après les étapes existantes de la feuille de route.")}{" "}
              {goal.deadline && goal.deadline >= jour
                ? t("Leurs échéances tiennent avant le {d}, en tenant compte de ton calendrier.", {
                    d: formatDate(new Date(`${goal.deadline}T12:00:00`), { day: "numeric", month: "long", year: "numeric" }),
                  })
                : goal.deadline
                  ? t("L'échéance de l'objectif est déjà passée : les sous-objectifs sont datés à partir d'aujourd'hui.")
                  : t("Les échéances suivent l'horizon de l'objectif et ton calendrier.")}
            </p>
          </Avant>
        )}
      </FenetreIa>
    );
  }

  const payload = payloadTachesObjectif(getLang(), jour, goal, data.goals, data.tasks, data.completions, charge);
  return (
    <FenetreIa titre={titre} onFermer={fermer} large={!!taches.sortie}>
      {taches.sortie ? (
        <Propositions
          items={taches.sortie.taches}
          cle={(x, i) => `${i}-${x.titre}`}
          libelleValider={(n) => tp(n, "Créer {n} tâche", "Créer {n} tâches")}
          onAnnuler={fermer}
          onValider={async (choisies) => {
            await appliquerTachesProposees(goal, data.goals, choisies);
            await refresh();
            fermer();
          }}
          rendu={(x, maj) => <LigneTacheProposee x={x} maj={maj} etapes={arbre} />}
        />
      ) : (
        <Avant payload={payload} libelle={t("Proposer des tâches")} etat={taches.etat} onLancer={() => void taches.lancer(payload)}>
          <p>
            {t("L'IA propose les prochaines tâches concrètes, datées selon ton calendrier et rattachées à l'objectif ou à l'une de ses étapes.")}
          </p>
        </Avant>
      )}
    </FenetreIa>
  );
}

// ── #13 Objectif en péril ───────────────────────────────────────────────────

function Peril({ goal, data, refresh, fermer }: { goal: Goal; data: AppData; refresh: () => Promise<void>; fermer: () => void }) {
  const jour = todayStr();
  const contexte = useMemo(() => ({ habits: data.habits, habitChecks: data.habitChecks }), [data.habits, data.habitChecks]);
  // ⭐ La détection reste LOCALE et relue ici : l'objectif a pu sortir du péril entre-temps.
  const p = useMemo(
    () => objectifsEnPeril(data.goals, data.tasks, data.completions, jour, contexte).find((x) => x.goal.id === goal.id) ?? null,
    [data.goals, data.tasks, data.completions, jour, contexte, goal.id],
  );
  const charge = useCharge(data, goal.deadline && goal.deadline >= jour ? goal.deadline : addDays(jour, 30));
  const { etat, sortie, lancer } = useAppel("objectif_peril");
  const etapes = useMemo(() => data.goals.filter((g) => g.parent_goal_id === goal.id), [data.goals, goal.id]);
  const titre = t("« {titre} » en péril", { titre: goal.title });

  if (!p)
    return (
      <FenetreIa titre={titre} onFermer={fermer}>
        <p className="text-sm text-text">{t("Cet objectif n'est plus en péril : rien à expliquer.")}</p>
      </FenetreIa>
    );
  if (!charge)
    return (
      <FenetreIa titre={titre} onFermer={fermer}>
        <p className="text-sm text-text-dim">{t("Lecture du calendrier…")}</p>
      </FenetreIa>
    );

  const payload = payloadPeril(getLang(), jour, p, data.goals, data.tasks, data.completions, charge, contexte);
  return (
    <FenetreIa titre={titre} onFermer={fermer} large={!!sortie}>
      {sortie ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-text">{sortie.explication}</p>
          <Propositions
            items={sortie.plan}
            cle={(x, i) => `${i}-${x.titre}`}
            vide={t("L'IA n'a pas proposé de tâche de rattrapage.")}
            libelleValider={(n) => tp(n, "Créer {n} tâche", "Créer {n} tâches")}
            onAnnuler={fermer}
            onValider={async (choisies) => {
              await appliquerTachesProposees(goal, data.goals, choisies);
              await refresh();
              fermer();
            }}
            rendu={(x, maj) => <LigneTacheProposee x={x} maj={maj} etapes={etapes} />}
          />
        </div>
      ) : (
        <Avant payload={payload} libelle={t("Pourquoi, et que faire ?")} etat={etat} onLancer={() => void lancer(payload)}>
          <p>
            {t("L'IA reçoit les faits calculés par Shale — avancement, échéance, étapes et tâches restantes, rythme des quatorze derniers jours — et propose un plan de rattrapage en tâches à valider.")}
          </p>
        </Avant>
      )}
    </FenetreIa>
  );
}
