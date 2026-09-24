import { useEffect, useMemo, useRef, useState } from "react";

import type { Carte } from "../../lib/carte";
import { menuContextuelOuvert } from "../../lib/menu/tactile";
import { t, tp } from "../../lib/i18n";
import { comptesDuPlan, planDeCarte } from "../../lib/objectifs/carte";
import { creerObjectifDepuisPlan } from "../../lib/objectifs/creerDepuisCarte";
import { EVT_OUVRIR, type DemandeOuverture } from "../../lib/naviguer";
import type { Goal } from "../../lib/types";

/**
 * ⭐ UNE CARTE MENTALE DEVIENT UN OBJECTIF — une fois, sur un geste explicite.
 *
 * Antonin, 2026-09-20 : « inversement, en créant une carte mentale, de pouvoir
 * en faire un objectif avec sous-objectif etc. »
 *
 * ⚠️ CE PANNEAU ANNONCE AVANT D'ÉCRIRE, et ce n'est pas une politesse : une
 * carte de quarante nœuds crée une dizaine d'objectifs et autant de tâches
 * d'un seul clic. Quelqu'un qui ne saurait pas ce qui va arriver découvrirait
 * son module Objectifs rempli par quelque chose qu'il croyait dessiner. Les
 * comptes viennent de `comptesDuPlan`, donc du plan RÉEL — jamais d'une
 * estimation refaite ici.
 *
 * ⚠️ ET LA CARTE NE BOUGE PAS. La conversion ne consomme rien, ne marque rien,
 * ne lie rien : la carte reste dans sa note, telle quelle, et peut être
 * reconvertie (elle créera alors un second objectif — c'est dit à l'écran).
 * Brancher les deux formes l'une sur l'autre demanderait de répondre à « que
 * fait-on quand on supprime un nœud ? », dont la seule réponse honnête serait
 * « on supprime l'objectif » : un geste destructeur derrière un geste de
 * dessin. Le raisonnement complet est en tête de `lib/objectifs/carte.ts`.
 */

const HORIZONS: { value: Goal["scope"]; label: string }[] = [
  { value: "short", label: "Court terme" },
  { value: "medium", label: "Moyen terme" },
  { value: "long", label: "Long terme" },
];

export default function DepuisCarte(props: {
  carte: Carte;
  /** Referme le panneau, la carte reste ouverte. */
  onFermer: () => void;
  /** Referme la CARTE — après navigation vers l'objectif créé. */
  onQuitterCarte: () => void;
}) {
  const plan = useMemo(() => planDeCarte(props.carte), [props.carte]);
  const comptes = useMemo(() => comptesDuPlan(plan), [plan]);
  const [titre, setTitre] = useState(plan.titre);
  const [horizon, setHorizon] = useState<Goal["scope"]>("medium");
  const [occupe, setOccupe] = useState(false);
  const [fait, setFait] = useState<{ id: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    champ.current?.focus();
    champ.current?.select();
  }, []);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      // ⚠️ On MARQUE la touche : sans ça, un seul Échap referme aussi la carte
      // derrière (convention de l'app depuis le 2026-08-28).
      if (e.defaultPrevented || e.key !== "Escape" || menuContextuelOuvert()) return;
      e.preventDefault();
      e.stopPropagation();
      props.onFermer();
    };
    // En capture, comme la carte elle-même : elle écoute Échap sur `window` et
    // s'y est abonnée la première.
    window.addEventListener("keydown", touche, true);
    return () => window.removeEventListener("keydown", touche, true);
  }, [props]);

  const creer = async () => {
    const nom = titre.trim();
    if (!nom || occupe) return;
    setOccupe(true);
    setErreur(null);
    try {
      const ecrits = await creerObjectifDepuisPlan({ ...plan, titre: nom }, { scope: horizon, category: null });
      // ⚠️ DIRE QU'ON A ÉCRIT. Ce panneau vit dans l'éditeur de carte d'une
      // note : il n'a pas le `refresh()` de l'app, et sans ce signal la vue
      // Objectifs restait vide devant un objectif qui existait vraiment (vu à
      // l'écran le 2026-09-20). `App.tsx` écoute cet événement.
      window.dispatchEvent(new Event("sb:data-changed"));
      setFait({ id: ecrits.racineId });
    } catch (e) {
      // ⚠️ Aucune transaction : une erreur au milieu laisse un objectif
      // partiellement garni. On le DIT, plutôt que de laisser croire que rien
      // n'a été écrit (`creerDepuisCarte.ts`).
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  };

  const voir = () => {
    if (!fait) return;
    // La vue Objectifs ne sait pas ouvrir un objectif précis : l'événement
    // change de module, et la feuille de route est dépliée d'office dès qu'elle
    // a des étapes (`GoalsView`). C'est exactement ce qu'on veut montrer.
    window.dispatchEvent(
      new CustomEvent<DemandeOuverture>(EVT_OUVRIR, { detail: { kind: "goal", id: fait.id } }),
    );
    props.onQuitterCarte();
  };

  const ligne = "flex items-start gap-2";
  const puce = <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-dim" aria-hidden />;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-label={t("En faire un objectif")}
        className="card card-solid w-full max-w-sm rounded-[16px] p-4 shadow-2xl"
      >
        <h4 className="font-display text-base font-bold text-text">{t("En faire un objectif")}</h4>

        {fait ? (
          <>
            <p className="mt-2 text-sm text-text">
              {t("L’objectif est créé, avec sa feuille de route.")}
            </p>
            <p className="mt-1 text-xs text-text-dim">
              {t("La carte reste dans cette note : elle n’est pas liée à l’objectif, et la reconvertir en créerait un second.")}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={props.onFermer}
                className="pill cible-tactile-ligne px-3 py-1.5 text-sm font-medium text-text-dim hover:text-text"
              >
                {t("Fermer")}
              </button>
              <button
                type="button"
                onClick={voir}
                className="pill cible-tactile-ligne fill-primary px-4 py-1.5 text-sm font-semibold"
              >
                {t("Voir l’objectif")}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-text-dim">{t("Titre de l'objectif")}</span>
              <input
                ref={champ}
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void creer();
                  }
                }}
                placeholder={t("Titre de l'objectif")}
                className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
              />
            </label>

            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Horizon")}</p>
              <div className="flex flex-wrap gap-1.5">
                {HORIZONS.map((h) => (
                  <button
                    key={h.value}
                    type="button"
                    onClick={() => setHorizon(h.value)}
                    className={`pill cible-tactile-ligne border px-3 py-1 text-xs font-medium transition-colors ${
                      horizon === h.value
                        ? "border-text/30 bg-surface-2 text-text"
                        : "border-border text-text-dim hover:text-text"
                    }`}
                  >
                    {t(h.label)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-[10px] bg-surface-2/60 px-3 py-2 text-xs text-text-dim">
              <p className="hud-label mb-1.5">{t("Ce qui va être créé")}</p>
              {comptes.etapes === 0 && comptes.taches === 0 && comptes.tachesRattachees === 0 ? (
                <p>{t("Un objectif seul : la carte n’a encore aucune branche à découper.")}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {comptes.etapes > 0 && (
                    <li className={ligne}>
                      {puce}
                      <span>
                        {tp(comptes.etapes, "{n} étape", "{n} étapes")}
                        {comptes.phases > 0 && ` · ${tp(comptes.phases, "dont {n} phase", "dont {n} phases")}`}
                      </span>
                    </li>
                  )}
                  {comptes.taches > 0 && (
                    <li className={ligne}>
                      {puce}
                      <span>{tp(comptes.taches, "{n} tâche créée", "{n} tâches créées")}</span>
                    </li>
                  )}
                  {comptes.tachesRattachees > 0 && (
                    <li className={ligne}>
                      {puce}
                      <span>
                        {tp(comptes.tachesRattachees, "{n} tâche existante rattachée", "{n} tâches existantes rattachées")}
                      </span>
                    </li>
                  )}
                  {comptes.ressources > 0 && (
                    <li className={ligne}>
                      {puce}
                      <span>{tp(comptes.ressources, "{n} élément cité rattaché", "{n} éléments cités rattachés")}</span>
                    </li>
                  )}
                </ul>
              )}
              {plan.ignores > 0 && (
                <p className="mt-1.5">
                  {tp(plan.ignores, "{n} nœud vide écarté", "{n} nœuds vides écartés")}
                </p>
              )}
              <p className="mt-1.5">
                {t("Au-delà du deuxième niveau, les nœuds deviennent des tâches de l’étape qui les porte.")}
              </p>
            </div>

            {erreur && <p className="mt-2 text-xs text-red">{erreur}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={props.onFermer}
                className="pill cible-tactile-ligne px-3 py-1.5 text-sm font-medium text-text-dim hover:text-text"
              >
                {t("Annuler")}
              </button>
              <button
                type="button"
                onClick={() => void creer()}
                disabled={!titre.trim() || occupe}
                className="pill cible-tactile-ligne fill-primary px-4 py-1.5 text-sm font-semibold disabled:opacity-40"
              >
                {t("Créer l’objectif")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
