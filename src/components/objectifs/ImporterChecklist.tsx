import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { menuContextuelOuvert } from "../../lib/menu/tactile";
import { getLang, t, tp } from "../../lib/i18n";
import { comptesDuPlan } from "../../lib/objectifs/carte";
import { creerObjectifDepuisPlan } from "../../lib/objectifs/creerDepuisCarte";
import { consigneIa, lireChecklist } from "../../lib/objectifs/importChecklist";
import { EVT_OUVRIR, type DemandeOuverture } from "../../lib/naviguer";
import { afficherToast } from "../../lib/toast";
import type { Goal } from "../../lib/types";

/**
 * ⭐ IMPORTER UNE CHECKLIST — demandée à n'importe quelle IA, collée ici.
 *
 * Deux gestes : « Copier la consigne » (on la colle dans ChatGPT, Claude,
 * Gemini…), puis on colle la réponse. Le panneau ANNONCE ce qu'il va créer
 * avant d'écrire, comme « En faire un objectif » : une checklist de quarante
 * lignes crée une dizaine d'étapes d'un clic.
 *
 * La lecture est `lireChecklist` (pure, testée) ; l'écriture est celle d'une
 * carte mentale (`creerObjectifDepuisPlan`) — aucune seconde façon de créer un
 * objectif garni.
 */

const HORIZONS: { value: Goal["scope"]; label: string }[] = [
  { value: "short", label: "Court terme" },
  { value: "medium", label: "Moyen terme" },
  { value: "long", label: "Long terme" },
];

export default function ImporterChecklist(props: { onFermer: () => void }) {
  const [sujet, setSujet] = useState("");
  const [texte, setTexte] = useState("");
  const [titre, setTitre] = useState("");
  const [titreTouche, setTitreTouche] = useState(false);
  const [horizon, setHorizon] = useState<Goal["scope"]>("medium");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const champ = useRef<HTMLTextAreaElement>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const [survol, setSurvol] = useState(false);

  /** Lit un fichier .md / .txt : le même texte que s'il avait été collé. */
  const lire = async (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > 1_000_000) {
      setErreur(t("Ce fichier est trop gros pour une checklist."));
      return;
    }
    try {
      setTexte(await f.text());
      setErreur(null);
    } catch {
      setErreur(t("Ce fichier n'a pas pu être lu."));
    }
  };

  const plan = useMemo(() => lireChecklist(texte), [texte]);
  const comptes = useMemo(() => (plan ? comptesDuPlan(plan) : null), [plan]);
  const nomFinal = (titreTouche ? titre : plan?.titre || titre).trim();
  const vide = !plan || (!comptes?.etapes && !comptes?.taches);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.key !== "Escape" || menuContextuelOuvert()) return;
      e.preventDefault();
      e.stopPropagation();
      props.onFermer();
    };
    window.addEventListener("keydown", touche, true);
    return () => window.removeEventListener("keydown", touche, true);
  }, [props]);

  const copier = async () => {
    const consigne = consigneIa(sujet, getLang() === "en" ? "en" : "fr");
    try {
      await navigator.clipboard.writeText(consigne);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2500);
      champ.current?.focus();
    } catch {
      // ⚠️ Pas de presse-papiers (aperçu, droit refusé) : on le DIT, sans
      // faire croire que c'est copié.
      afficherToast({ msg: t("Copie impossible ici : sélectionne et copie à la main."), tone: "loss" });
    }
  };

  const importer = async () => {
    if (!plan || vide || !nomFinal || occupe) return;
    setOccupe(true);
    setErreur(null);
    try {
      const ecrits = await creerObjectifDepuisPlan({ ...plan, titre: nomFinal }, { scope: horizon, category: null });
      window.dispatchEvent(new Event("sb:data-changed"));
      window.dispatchEvent(
        new CustomEvent<DemandeOuverture>(EVT_OUVRIR, { detail: { kind: "goal", id: ecrits.racineId } }),
      );
      props.onFermer();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  };

  const puce = <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-dim" aria-hidden />;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onFermer();
      }}
    >
      <div
        role="dialog"
        aria-label={t("Importer une checklist")}
        className="card card-solid max-h-[calc(90vh*var(--zoom-inv))] w-full max-w-lg overflow-y-auto rounded-[16px] p-5 shadow-2xl"
      >
        <h4 className="font-display text-base font-bold text-text">{t("Importer une checklist")}</h4>
        <p className="mt-1 text-xs text-text-dim">
          {t("Demande-la à l'IA de ton choix, colle sa réponse : elle devient un objectif avec ses étapes et ses tâches.")}
        </p>

        <p className="hud-label mt-4">{t("1 · Demander à l'IA")}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <input
            value={sujet}
            onChange={(e) => setSujet(e.target.value)}
            placeholder={t("Ce que tu veux planifier (facultatif)")}
            className="min-w-0 basis-[12rem] flex-1 rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
          />
          <button type="button" onClick={copier} className="pill cible-tactile-ligne border border-border bg-surface-2 px-3 py-1.5 text-sm font-medium text-text">
            {copie ? t("Consigne copiée") : t("Copier la consigne")}
          </button>
        </div>
        <p className="mt-1 text-xs text-text-dim">
          {t("Colle la consigne dans ChatGPT, Claude, Gemini… puis reviens ici avec sa réponse.")}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="hud-label">{t("2 · Coller la réponse")}</p>
          <button
            type="button"
            onClick={() => fichier.current?.click()}
            className="pill cible-tactile-ligne border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-text"
          >
            {t("Choisir un fichier (.md, .txt)")}
          </button>
          <input
            ref={fichier}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            className="hidden"
            onChange={(e) => {
              void lire(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <textarea
          onDragOver={(e) => {
            e.preventDefault();
            setSurvol(true);
          }}
          onDragLeave={() => setSurvol(false)}
          onDrop={(e) => {
            if (e.dataTransfer.files.length === 0) return;
            e.preventDefault();
            setSurvol(false);
            void lire(e.dataTransfer.files[0]);
          }}
          ref={champ}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={t("# Mon objectif\n## Une étape\n- [ ] Une tâche @2026-12-01 !haute")}
          className={`mt-1.5 w-full resize-y rounded-[10px] border bg-surface-2 px-3 py-2 font-mono text-xs text-text placeholder:text-text-dim focus:border-blue focus:outline-none ${survol ? "border-blue" : "border-border"}`}
        />

        {plan && !vide && comptes && (
          <>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-text-dim">{t("Titre de l'objectif")}</span>
              <input
                value={titreTouche ? titre : plan.titre || titre}
                onChange={(e) => {
                  setTitre(e.target.value);
                  setTitreTouche(true);
                }}
                className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text focus:border-blue focus:outline-none"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {HORIZONS.map((h) => (
                <button
                  key={h.value}
                  type="button"
                  onClick={() => setHorizon(h.value)}
                  className={`pill cible-tactile-ligne border px-3 py-1 text-xs font-medium transition-colors ${
                    horizon === h.value ? "border-text/30 bg-surface-2 text-text" : "border-border text-text-dim hover:text-text"
                  }`}
                >
                  {t(h.label)}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-[10px] bg-surface-2/60 px-3 py-2 text-xs text-text-dim">
              <p className="hud-label mb-1.5">{t("Ce qui va être créé")}</p>
              <ul className="flex flex-col gap-1">
                {comptes.etapes > 0 && (
                  <li className="flex items-start gap-2">
                    {puce}
                    <span>
                      {tp(comptes.etapes, "{n} étape", "{n} étapes")}
                      {comptes.phases > 0 && ` · ${tp(comptes.phases, "dont {n} phase", "dont {n} phases")}`}
                    </span>
                  </li>
                )}
                {comptes.taches > 0 && (
                  <li className="flex items-start gap-2">
                    {puce}
                    <span>{tp(comptes.taches, "{n} tâche créée", "{n} tâches créées")}</span>
                  </li>
                )}
                {plan.ignores > 0 && (
                  <li className="flex items-start gap-2">
                    {puce}
                    <span>{tp(plan.ignores, "{n} ligne ignorée", "{n} lignes ignorées")}</span>
                  </li>
                )}
              </ul>
            </div>
          </>
        )}

        {texte.trim() && vide && (
          <p className="mt-3 text-xs text-red">{t("Rien d'exploitable : il faut au moins une étape (##) ou une tâche (- [ ]).")}</p>
        )}
        {erreur && <p className="mt-3 text-xs text-red">{erreur}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={props.onFermer} className="pill cible-tactile-ligne px-3 py-1.5 text-sm font-medium text-text-dim hover:text-text">
            {t("Annuler")}
          </button>
          <button
            type="button"
            onClick={() => void importer()}
            disabled={vide || !nomFinal || occupe}
            className="pill cible-tactile-ligne fill-primary px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            {t("Importer")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
