import { useEffect, useMemo, useRef, useState } from "react";

import type { Carte, GenreRef, RefNoeud, TypeDonnable } from "../../lib/carte";
import { t } from "../../lib/i18n";
import { menuContextuelOuvert } from "../../lib/menu/tactile";
import { aideDeGenre, nomDeGenre } from "../../lib/objectifs/libelles";
import type { GenreEtape } from "../../lib/objectifs/structure";
import { genresPour, objectifsAccueillants, planEtape, planHabitude, planTache } from "../../lib/objectifs/typage";
import { typerEnEtape, typerEnHabitude, typerEnTache } from "../../lib/objectifs/typer";
import type { Goal } from "../../lib/types";

/**
 * ⭐ DONNER UN TYPE À UN NŒUD — le panneau qui ANNONCE avant d'écrire.
 *
 * Chantier du 2026-09-29, esprit de « En faire un objectif » (`DepuisCarte`) :
 * typer un nœud CRÉE un vrai objet dans l'app — une tâche dans Tâches, une
 * étape dans une feuille de route, une habitude dans le Journal. Personne ne
 * doit le découvrir après coup : le panneau dit ce qui va naître, et OÙ, avant
 * le moindre clic d'écriture.
 *
 * Le rangement vient de la hiérarchie de la carte (`lib/objectifs/typage.ts`,
 * pur et testé) ; l'écriture de `typer.ts`. Ici, on montre et on transmet.
 */

export default function PanneauType(props: {
  type: TypeDonnable;
  carte: Carte;
  noeudId: string;
  /** Les objectifs VIVANTS, lus par l'éditeur. */
  goals: readonly Goal[];
  onFermer: () => void;
  /** L'objet est créé : le nœud devient sa référence. */
  onCree: (ref: RefNoeud, titre: string, genre?: GenreRef) => void;
}) {
  const { type, carte, noeudId, goals } = props;
  const titre = (carte.noeuds.find((n) => n.id === noeudId)?.texte ?? "").trim();

  const tache = useMemo(() => planTache(carte, noeudId, goals), [carte, noeudId, goals]);
  const etape = useMemo(() => planEtape(carte, noeudId, goals), [carte, noeudId, goals]);
  const habitude = useMemo(() => planHabitude(carte, noeudId, goals), [carte, noeudId, goals]);
  const accueillants = useMemo(() => objectifsAccueillants(goals), [goals]);

  // Étape : le parent choisi (celui de la carte, ou celui du sélecteur) et son genre.
  const [parentId, setParentId] = useState<number | null>(etape.parent?.id ?? null);
  const parent = goals.find((g) => g.id === parentId) ?? null;
  const genres = parent ? genresPour(parent, goals) : [];
  const [genre, setGenre] = useState<GenreEtape>(etape.genres.includes("sous-objectif") ? "sous-objectif" : (etape.genres[0] ?? "sous-objectif"));
  const genreRetenu: GenreEtape | null = genres.includes(genre) ? genre : (genres[0] ?? null);

  // Habitude : le rattachement est PROPOSÉ (case cochée), jamais imposé.
  const [rattacher, setRattacher] = useState(!!habitude.propose);
  const [cible, setCible] = useState("");
  const cibleValide = Number.isFinite(Number(cible)) && Math.round(Number(cible)) >= 1;

  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const bouton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    bouton.current?.focus();
  }, []);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      // ⚠️ On MARQUE la touche : sans ça, un seul Échap referme aussi la carte
      // derrière (même convention que `DepuisCarte`).
      if (e.defaultPrevented || e.key !== "Escape" || menuContextuelOuvert()) return;
      e.preventDefault();
      e.stopPropagation();
      props.onFermer();
    };
    window.addEventListener("keydown", touche, true);
    return () => window.removeEventListener("keydown", touche, true);
  }, [props]);

  const possible =
    !!titre &&
    !occupe &&
    (type === "tache" ||
      (type === "etape" && !!parent && !!genreRetenu) ||
      (type === "habitude" && (!rattacher || !habitude.propose || cibleValide)));

  const creer = async () => {
    if (!possible) return;
    setOccupe(true);
    setErreur(null);
    try {
      if (type === "tache") {
        const ref = await typerEnTache(titre, tache.goal);
        if (ref) props.onCree(ref, titre);
      } else if (type === "etape" && parent && genreRetenu) {
        const r = await typerEnEtape(titre, parent, genreRetenu, goals);
        if (r) props.onCree(r.ref, titre, r.genre);
      } else if (type === "habitude") {
        const lien = rattacher && habitude.propose ? { sous: habitude.propose.sous, cible: Number(cible) } : null;
        const ref = await typerEnHabitude(titre, lien, goals);
        if (ref) props.onCree(ref, titre);
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setOccupe(false);
    }
  };

  const titres: Record<TypeDonnable, string> = {
    etape: t("En faire une étape"),
    tache: t("En faire une tâche"),
    habitude: t("En faire une habitude"),
  };
  const nomObjectif = (g: Goal) => g.title.trim() || t("Sans titre");
  const champ = "rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text focus:border-blue focus:outline-none";

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-label={titres[type]} className="card card-solid w-full max-w-sm rounded-[16px] p-4 shadow-2xl">
        <h4 className="font-display text-base font-bold text-text">{titres[type]}</h4>

        {!titre ? (
          <p className="mt-2 text-sm text-text-dim">{t("Donne d'abord un nom au nœud : c'est lui qui deviendra le titre.")}</p>
        ) : (
          <>
            {type === "etape" && (
              <div className="mt-3 flex flex-col gap-2">
                {etape.repli && (
                  <p className="text-xs text-text-dim">
                    {t("« {voulu} » est déjà un sous-objectif : la feuille de route n'a que trois niveaux. L'étape ira sous « {retenu} ».", {
                      voulu: nomObjectif(etape.repli.voulu),
                      retenu: nomObjectif(etape.repli.retenu),
                    })}
                  </p>
                )}
                {!etape.parent && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-text-dim">
                      {t("Aucun objectif au-dessus de ce nœud : sous lequel la ranger ?")}
                    </span>
                    {accueillants.length === 0 ? (
                      <span className="text-xs text-text-dim">{t("Tu n'as encore aucun objectif. Crée-le d'abord, dans Objectifs ou avec « En faire un objectif ».")}</span>
                    ) : (
                      <select
                        value={parentId ?? ""}
                        onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
                        className={`w-full ${champ}`}
                      >
                        <option value="">{t("Choisir un objectif…")}</option>
                        {accueillants.map(({ goal, niveau }) => (
                          <option key={goal.id} value={goal.id}>
                            {niveau > 0 ? "   ↳ " : ""}
                            {nomObjectif(goal)}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                )}
                {parent && genres.length > 1 && (
                  <div>
                    <div className="flex gap-1.5">
                      {genres.map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setGenre(g)}
                          aria-pressed={genreRetenu === g}
                          className={`pill cible-tactile-ligne border px-3 py-1 text-xs font-medium transition-colors ${
                            genreRetenu === g ? "border-text/30 bg-surface-2 text-text" : "border-border text-text-dim hover:text-text"
                          }`}
                        >
                          {nomDeGenre(g)}
                        </button>
                      ))}
                    </div>
                    {/* La même phrase que la feuille de route : un mot sans son explication ne fait que déplacer la question. */}
                    {genreRetenu && <p className="mt-1 text-[11px] text-text-dim">{aideDeGenre(genreRetenu)}</p>}
                  </div>
                )}
              </div>
            )}

            {type === "habitude" && habitude.propose && (
              <div className="mt-3 flex flex-col gap-2">
                <label className="flex items-start gap-2 text-sm text-text">
                  <input type="checkbox" checked={rattacher} onChange={(e) => setRattacher(e.target.checked)} className="mt-1" />
                  <span>
                    {t("La rattacher à « {objectif} »", { objectif: nomObjectif(habitude.propose.voulu) })}
                    <span className="block text-[11px] text-text-dim">
                      {t("Une étape comptera les jours où tu la tiens, à partir d'aujourd'hui. Décoche pour une habitude seule.")}
                    </span>
                  </span>
                </label>
                {rattacher && (
                  <label className="flex items-center gap-2 pl-6 text-xs text-text-dim">
                    <span>{t("Cible")}</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={cible}
                      onChange={(e) => setCible(e.target.value)}
                      placeholder="30"
                      aria-label={t("Cible en jours")}
                      className={`w-20 ${champ} py-1`}
                    />
                    <span>{t("jours")}</span>
                  </label>
                )}
              </div>
            )}

            {/* ⭐ CE QUI VA ÊTRE ÉCRIT, en toutes lettres, avant d'écrire. */}
            <div className="mt-3 rounded-[10px] bg-surface-2/60 px-3 py-2 text-xs text-text-dim">
              <p className="hud-label mb-1.5">{t("Ce qui va être créé")}</p>
              {type === "tache" && (
                <p>
                  {tache.goal
                    ? t("La tâche « {titre} », rattachée à « {objectif} ».", { titre, objectif: nomObjectif(tache.goal) })
                    : t("La tâche « {titre} », libre : aucun objectif au-dessus d'elle sur la carte. Tu pourras la rattacher plus tard.", { titre })}
                </p>
              )}
              {type === "etape" && (
                <p>
                  {parent && genreRetenu
                    ? t("{genre} « {titre} », en dernier sous « {objectif} ».", { genre: nomDeGenre(genreRetenu), titre, objectif: nomObjectif(parent) })
                    : t("Choisis d'abord l'objectif qui l'accueille.")}
                </p>
              )}
              {type === "habitude" && (
                <p>
                  {rattacher && habitude.propose
                    ? t("L'habitude « {titre} » dans le Journal, et un sous-objectif « {titre} » sous « {objectif} », compté en jours tenus.", {
                        titre,
                        objectif: nomObjectif(habitude.propose.sous),
                      })
                    : t("L'habitude « {titre} », dans le Journal.", { titre })}
                </p>
              )}
              <p className="mt-1.5">{t("Le nœud devient un lien vers cet objet : son titre et son état viendront de lui.")}</p>
            </div>
          </>
        )}

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
            ref={bouton}
            type="button"
            onClick={() => void creer()}
            disabled={!possible}
            className="pill cible-tactile-ligne fill-primary px-4 py-1.5 text-sm font-semibold disabled:opacity-40"
          >
            {t("Créer")}
          </button>
        </div>
      </div>
    </div>
  );
}
