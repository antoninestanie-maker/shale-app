// ─────────────────────────────────────────────────────────────────────────────
// La revue hebdomadaire (#18) — une carte de la vue Performance.
//
// Elle ne se génère JAMAIS seule : un bouton, après avoir vu ce qui part. Les
// faits sont calculés par l'app (`lib/ia/revue.ts`) ; le modèle rédige « ce qui
// a tenu », « ce qui a glissé » et trois ajustements, chacun transformable en
// tâche d'un clic — rien n'est créé sans ce clic.
//
// Une revue par semaine, rangée au lundi (`ia_contenus`), relue ici et
// synchronisée. Les semaines passées restent consultables.
//
// ⭐ Le Journal : une case, DÉCOCHÉE par défaut. Cochée, seules les notes
// d'humeur et d'énergie (1 à 5) partent — jamais le texte d'une entrée.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate, getLang, t } from "../../lib/i18n";
import {
  appliquerAjustement,
  ecrireInclureJournal,
  lireInclureJournal,
  payloadRevue,
  POIDS_REVUE,
  revueLisible,
  semaineDeRevue,
  type RevueStockee,
} from "../../lib/ia/revue";
import { useIa } from "../../lib/ia/useIa";
import { addDays, todayStr } from "../../lib/logic";
import { ecrireContenuIa, lireContenuIa, listerContenusIa } from "../../lib/repo";
import { afficherToast } from "../../lib/toast";
import type { AppData } from "../../lib/types";
import { CaseACocher } from "../CaseACocher";
import { ApercuEnvoi } from "./ApercuEnvoi";
import { EtatIa, type EtatAppelIa } from "./EtatIa";
import { IconeIa } from "./IconeIa";

function jourCourt(jour: string): string {
  return formatDate(new Date(`${jour}T12:00:00`), { day: "numeric", month: "short" });
}

function libelleSemaine(debut: string): string {
  return t("du {a} au {b}", { a: jourCourt(debut), b: jourCourt(addDays(debut, 6)) });
}

export function RevueHebdo({ data, refresh }: { data: AppData; refresh: () => Promise<void> }) {
  const { run } = useIa();
  const jour = todayStr();
  const courante = useMemo(() => semaineDeRevue(jour), [jour]);
  const [semaines, setSemaines] = useState<string[]>([]);
  const [choisie, setChoisie] = useState(courante.debut);
  const [revue, setRevue] = useState<RevueStockee | null>(null);
  const [charge, setCharge] = useState(false);
  const [journal, setJournal] = useState(false);
  const [etat, setEtat] = useState<EtatAppelIa>({ etat: "repos" });

  const relire = useCallback(async (debut: string) => {
    const c = await lireContenuIa("revue", debut).catch(() => null);
    setRevue(c ? revueLisible(c.contenu) : null);
    setCharge(true);
  }, []);

  useEffect(() => {
    void lireInclureJournal().then(setJournal);
    void listerContenusIa("revue").then(setSemaines).catch(() => setSemaines([]));
  }, []);
  useEffect(() => {
    setCharge(false);
    void relire(choisie);
  }, [choisie, relire]);

  const contexte = useMemo(() => ({ habits: data.habits, habitChecks: data.habitChecks }), [data.habits, data.habitChecks]);
  const payload = useMemo(
    () => payloadRevue(getLang(), jour, courante, data, journal, contexte),
    [jour, courante, data, journal, contexte],
  );

  const generer = async () => {
    setEtat({ etat: "chargement" });
    const r = await run("revue", payload);
    if (!r.ok) return setEtat({ etat: "erreur", code: r.code, resetsAt: r.resetsAt ?? null });
    const contenu: RevueStockee = { ...r.data, genereLe: new Date().toISOString(), semaine: courante, crees: [] };
    await ecrireContenuIa("revue", courante.debut, contenu);
    setRevue(contenu);
    setChoisie(courante.debut);
    setSemaines((s) => (s.includes(courante.debut) ? s : [courante.debut, ...s]));
    setEtat({ etat: "repos" });
  };

  const creerTache = async (i: number) => {
    if (!revue || revue.crees.includes(i)) return;
    const a = revue.ajustements[i];
    await appliquerAjustement(a);
    const suite: RevueStockee = { ...revue, crees: [...revue.crees, i] };
    await ecrireContenuIa("revue", revue.semaine.debut, suite);
    setRevue(suite);
    await refresh();
    afficherToast({ msg: t("Tâche créée : « {titre} »", { titre: a.titre }) });
  };

  const options = [...new Set([courante.debut, ...semaines])].sort((a, b) => b.localeCompare(a));
  const surLaCourante = choisie === courante.debut;

  return (
    <section className="card p-5">
      <div className="rgrid-head flex flex-wrap items-center justify-between gap-2">
        <h2 className="hud-label flex items-center gap-1.5">
          <IconeIa className="h-3.5 w-3.5" />
          {t("Revue de la semaine")}
        </h2>
        {options.length > 1 ? (
          <select
            value={choisie}
            onChange={(e) => setChoisie(e.target.value)}
            aria-label={t("Semaine")}
            className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-xs text-text"
          >
            {options.map((d) => (
              <option key={d} value={d}>
                {libelleSemaine(d)}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-text-dim">{libelleSemaine(courante.debut)}</span>
        )}
      </div>

      {!charge ? null : revue ? (
        <div className="mt-4 flex flex-col gap-4 text-sm text-text">
          <div>
            <p className="hud-label mb-1">{t("Ce qui a tenu")}</p>
            <p className="leading-relaxed">{revue.tenu}</p>
          </div>
          <div>
            <p className="hud-label mb-1">{t("Ce qui a glissé")}</p>
            <p className="leading-relaxed">{revue.glisse}</p>
          </div>
          <div>
            <p className="hud-label mb-1.5">{t("Trois ajustements")}</p>
            <ul className="flex flex-col gap-2">
              {revue.ajustements.map((a, i) => (
                <li key={i} className="flex flex-wrap items-start gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.titre}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-text-dim">
                      {a.pourquoi}
                      {a.date ? ` · ${jourCourt(a.date)}` : ""}
                    </p>
                  </div>
                  {revue.crees.includes(i) ? (
                    <span className="shrink-0 text-xs text-text-dim">{t("Tâche créée")}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void creerTache(i)}
                      className="pill shrink-0 border border-border px-3 py-1 text-xs hover:bg-overlay"
                    >
                      {t("En faire une tâche")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <EtatIa etat={etat} onReessayer={() => void generer()} />
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-dim">
            <span>
              {t("Générée le {d}.", { d: formatDate(new Date(revue.genereLe), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) })}
            </span>
            {surLaCourante && etat.etat !== "chargement" && (
              <button type="button" onClick={() => void generer()} className="font-medium text-blue hover:underline">
                {t("Régénérer ({n} actions)", { n: POIDS_REVUE })}
              </button>
            )}
          </p>
        </div>
      ) : surLaCourante ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm leading-relaxed text-text-dim">
            {t("Shale calcule les faits de ta semaine — complétion, focus, objectifs, tâches reportées — et l'IA rédige ce qui a tenu, ce qui a glissé et trois ajustements, que tu peux transformer en tâches.")}
          </p>
          <div className="flex items-start gap-2.5 text-sm text-text">
            <CaseACocher
              cochee={journal}
              taille="sm"
              libelle={t("Inclure l'humeur et l'énergie de mon Journal")}
              onBascule={() => {
                const v = !journal;
                setJournal(v);
                void ecrireInclureJournal(v);
              }}
            />
            <span>
              {t("Inclure l'humeur et l'énergie de mon Journal")}
              <span className="mt-0.5 block text-xs text-text-dim">
                {t("Seules les notes de 1 à 5 partent, jamais le texte de tes entrées. Décoché par défaut.")}
              </span>
            </span>
          </div>
          <ApercuEnvoi payload={payload} />
          <EtatIa etat={etat} onReessayer={() => void generer()} />
          {etat.etat !== "chargement" && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void generer()} className="pill fill-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold">
                <IconeIa className="h-4 w-4" />
                {t("Générer la revue")}
              </button>
              <span className="text-xs text-text-dim">{t("Compte pour {n} actions.", { n: POIDS_REVUE })}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-text-dim">{t("Pas de revue pour cette semaine.")}</p>
      )}
    </section>
  );
}
