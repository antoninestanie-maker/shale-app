/**
 * « Supprimés récemment » — la corbeille de Shale (migration 027).
 *
 * UNE VUE, PAS UN MODULE : elle vit dans le pied de la barre latérale, sous
 * Réglages, et le compte de treize modules ne bouge pas (arrêt 1 du chantier).
 *
 * Ce que l'écran promet, et d'où vient chaque promesse :
 *   • RESTAURER rend l'objet à l'identique, avec ses liens, ses tags, son
 *     sujet, ses sous-objectifs — la migration 027 n'a rien détruit en le jetant ;
 *   • restaurer un sous-objectif dont le parent est aussi ici RAMÈNE le parent,
 *     et l'écran le dit AVANT d'agir (cahier des charges, § 5.4) ;
 *   • SUPPRIMER DÉFINITIVEMENT dit ce qui disparaît, avec le nombre d'éléments
 *     emportés, et ne propose pas d'« Annuler » : c'est irréversible ;
 *   • tout ce qui reste 30 jours part seul, au lancement suivant.
 *
 * ⚠️ Les confirmations sont EN LIGNE, dans la carte, jamais dans une fenêtre :
 * une modale centrée passe sous la barre d'onglets du téléphone (PIEGES § 18.4),
 * et une confirmation posée à côté de ce qu'elle concerne se lit mieux.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconTrash } from "../components/icons";
import { formatDate, t, tp } from "../lib/i18n";
import { lireCorbeille, planRestauration, supprimerDefinitivement } from "../lib/repo";
import { joursRestants, RETENTION_JOURS } from "../lib/corbeille/regles";
import type { ElementCorbeille, PlanRestauration } from "../lib/corbeille/base";
import { FAMILLES, iconeDeFamille } from "../components/corbeille/familles";
import { BY_ID } from "../components/Sidebar";
import {
  restaurerAvecToast,
  supprimerPourDeBon,
  titreAffiche,
} from "../components/corbeille/geste";
import { afficherToast } from "../lib/toast";

interface Props {
  /** Le rafraîchissement global de l'app : une restauration change `AppData`. */
  refresh: () => Promise<void>;
}

/** Ce qu'une ligne est en train de demander à confirmer. */
type Confirmation =
  | { quoi: "restaurer"; plan: PlanRestauration }
  | { quoi: "supprimer" }
  | null;

export default function CorbeilleView({ refresh }: Props) {
  const [elements, setElements] = useState<ElementCorbeille[] | null>(null);
  const [confirmer, setConfirmer] = useState<{ cle: string; c: Confirmation } | null>(null);
  const [viderDemande, setViderDemande] = useState(false);
  const [occupe, setOccupe] = useState(false);

  const recharger = useCallback(async () => {
    setElements(await lireCorbeille());
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  /** Après une action : la corbeille ET le reste de l'app. */
  const apres = useCallback(async () => {
    setConfirmer(null);
    await Promise.all([recharger(), refresh()]);
  }, [recharger, refresh]);

  // Regroupement par MODULE d'origine, dans l'ordre des onglets de la barre
  // latérale (`BY_ID` garde l'ordre de `ITEMS`) : on retrouve ses objets là
  // où l'on a l'habitude de chercher leur module.
  const groupes = useMemo(() => {
    const parModule = new Map<string, ElementCorbeille[]>();
    for (const el of elements ?? []) {
      const module = FAMILLES[el.kind].module;
      if (!parModule.has(module)) parModule.set(module, []);
      parModule.get(module)!.push(el);
    }
    for (const liste of parModule.values()) liste.sort((a, b) => (a.deleted_at < b.deleted_at ? 1 : -1));
    const rangs = [...BY_ID.keys()];
    const rang = (liste: ElementCorbeille[]) => rangs.indexOf(FAMILLES[liste[0].kind].vue);
    return [...parModule.entries()].sort((a, b) => rang(a[1]) - rang(b[1]));
  }, [elements]);

  const total = (elements ?? []).reduce((s, e) => s + e.taille, 0);

  const cleDe = (el: ElementCorbeille) => `${el.kind}:${el.id}`;

  const demanderRestauration = async (el: ElementCorbeille) => {
    const plan = await planRestauration(el.kind, el.id);
    if (!plan) return void recharger(); // restauré ailleurs, par la synchronisation
    // ⭐ Un objet seul revient sans question. Une restauration qui ramène un
    // PARENT, ou tout un lot, s'annonce d'abord.
    if (!plan.remonte && plan.total === 1) {
      setOccupe(true);
      try {
        await restaurerAvecToast(el, apres);
      } finally {
        setOccupe(false);
      }
      return;
    }
    setConfirmer({ cle: cleDe(el), c: { quoi: "restaurer", plan } });
  };

  const vider = async () => {
    if (!elements?.length) return;
    setOccupe(true);
    try {
      let n = 0;
      // ⚠️ Élément par élément, par la MÊME fonction que la ligne : un lot
      // d'objectifs part avec ses phases, une facture avec ses lignes. Une
      // requête « tout effacer » aurait contourné ces cascades.
      for (const el of elements) n += await supprimerDefinitivement(el.kind, el.id);
      setViderDemande(false);
      await apres();
      afficherToast({
        msg: tp(n, "1 élément supprimé pour de bon", "{n} éléments supprimés pour de bon"),
        icone: <IconTrash className="h-5 w-5 shrink-0 text-text-dim" />,
      });
    } finally {
      setOccupe(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl text-text">{t("Supprimés récemment")}</h1>
          <p className="mt-1 text-sm text-text-dim">
            {t("Ce que tu supprimes reste ici {n} jours, puis part pour de bon.", { n: RETENTION_JOURS })}
          </p>
        </div>
        {!!elements?.length && !viderDemande && (
          <button
            type="button"
            onClick={() => setViderDemande(true)}
            className="cible-tactile shrink-0 rounded-[10px] border border-border px-3 py-1.5 text-sm text-red transition-colors hover:bg-red/10"
          >
            {tp(total, "Vider (1 élément)", "Vider ({n} éléments)")}
          </button>
        )}
      </div>

      {viderDemande && (
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 border border-red/30 p-4">
          <p className="min-w-0 text-sm text-text">
            {tp(
              total,
              "Supprimer définitivement 1 élément ? Il ne pourra plus être restauré.",
              "Supprimer définitivement les {n} éléments ? Ils ne pourront plus être restaurés.",
            )}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setViderDemande(false)}
              className="cible-tactile rounded-[10px] px-3 py-1.5 text-sm text-text-dim hover:text-text"
            >
              {t("Garder")}
            </button>
            <button
              type="button"
              disabled={occupe}
              onClick={() => void vider()}
              className="cible-tactile rounded-[10px] bg-red px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {t("Tout supprimer")}
            </button>
          </div>
        </div>
      )}

      {elements === null ? null : elements.length === 0 ? (
        // ── L'état vide ─────────────────────────────────────────────────────
        <div className="card mt-8 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-overlay text-text-dim">
            <IconTrash className="h-6 w-6" />
          </span>
          <p className="text-base font-medium text-text">{t("Rien à restaurer")}</p>
          <p className="max-w-sm text-sm text-text-dim">
            {t("Quand tu supprimes une note, une tâche ou un objectif, il attend ici {n} jours avant de partir.", {
              n: RETENTION_JOURS,
            })}
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {groupes.map(([module, liste]) => (
            <section key={module}>
              <h2 className="hud-label flex items-center gap-2">
                <span className="h-3.5 w-3.5 text-text-dim" aria-hidden>
                  {iconeDeFamille(liste[0].kind)}
                </span>
                {t(module)}
                <span className="font-mono text-text-dim">· {liste.length}</span>
              </h2>
              <ul className="card mt-2 divide-y divide-border p-0">
                {liste.map((el) => (
                  <Ligne
                    key={cleDe(el)}
                    el={el}
                    confirmation={confirmer?.cle === cleDe(el) ? confirmer.c : null}
                    occupe={occupe}
                    onRestaurer={() => void demanderRestauration(el)}
                    onConfirmerRestauration={async () => {
                      setOccupe(true);
                      try {
                        await restaurerAvecToast(el, apres);
                      } finally {
                        setOccupe(false);
                      }
                    }}
                    onSupprimer={() => setConfirmer({ cle: cleDe(el), c: { quoi: "supprimer" } })}
                    onConfirmerSuppression={async () => {
                      setOccupe(true);
                      try {
                        await supprimerPourDeBon(el, apres);
                      } finally {
                        setOccupe(false);
                      }
                    }}
                    onRenoncer={() => setConfirmer(null)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Une ligne ───────────────────────────────────────────────────────────────

function Ligne(props: {
  el: ElementCorbeille;
  confirmation: Confirmation;
  occupe: boolean;
  onRestaurer: () => void;
  onConfirmerRestauration: () => void;
  onSupprimer: () => void;
  onConfirmerSuppression: () => void;
  onRenoncer: () => void;
}) {
  const { el, confirmation } = props;
  const titre = titreAffiche(el);
  const jours = joursRestants(el.deleted_at);
  const autres = el.taille - 1;

  const bouton = "cible-tactile rounded-[10px] px-3 py-1.5 text-sm transition-colors disabled:opacity-50";

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="truncate-souris truncate text-sm font-medium text-text">{titre}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-text-dim">
            <span>
              {t("Supprimé le {date}", {
                date: formatDate(el.deleted_at, { day: "numeric", month: "short" }),
              })}
            </span>
            <span aria-hidden>·</span>
            {/* Le décompte en ORANGE sous trois jours : c'est le moment où le
                regarder vaut quelque chose. Au-delà, il n'a rien d'urgent. */}
            <span className={jours <= 3 ? "text-yellow" : undefined}>
              {jours === 0
                ? t("part au prochain lancement")
                : tp(jours, "encore 1 jour", "encore {n} jours")}
            </span>
            {autres > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{tp(autres, "avec 1 élément", "avec {n} éléments")}</span>
              </>
            )}
          </p>
        </div>
        {!confirmation && (
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              disabled={props.occupe}
              onClick={props.onRestaurer}
              className={`${bouton} border border-border text-text hover:bg-overlay`}
            >
              {t("Restaurer")}
            </button>
            <button
              type="button"
              disabled={props.occupe}
              onClick={props.onSupprimer}
              className={`${bouton} text-red hover:bg-red/10`}
              aria-label={t("Supprimer définitivement « {titre} »", { titre })}
              data-tip={t("Supprimer définitivement")}
            >
              <IconTrash className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Les confirmations, dans la ligne qu'elles concernent ─────────── */}
      {confirmation?.quoi === "restaurer" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-overlay px-3 py-2.5">
          <p className="min-w-0 text-sm text-text">
            {confirmation.plan.remonte
              ? tp(
                  confirmation.plan.total - 1,
                  "« {titre} » est rangé sous un objectif lui aussi supprimé. Le restaurer ramène cet objectif, et 1 autre élément avec.",
                  "« {titre} » est rangé sous un objectif lui aussi supprimé. Le restaurer ramène cet objectif, et {n} autres éléments avec.",
                  { titre },
                )
              : tp(
                  confirmation.plan.total - 1,
                  "Restaurer « {titre} » ramène aussi 1 élément qui avait été supprimé avec lui.",
                  "Restaurer « {titre} » ramène aussi les {n} éléments qui avaient été supprimés avec lui.",
                  { titre },
                )}
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={props.onRenoncer} className={`${bouton} text-text-dim hover:text-text`}>
              {t("Annuler")}
            </button>
            <button
              type="button"
              disabled={props.occupe}
              onClick={props.onConfirmerRestauration}
              className={`${bouton} bg-blue font-semibold text-white hover:opacity-90`}
            >
              {tp(confirmation.plan.total, "Restaurer", "Restaurer les {n}")}
            </button>
          </div>
        </div>
      )}

      {confirmation?.quoi === "supprimer" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-red/30 bg-red/5 px-3 py-2.5">
          <p className="min-w-0 text-sm text-text">
            {autres > 0
              ? tp(
                  autres,
                  "Supprimer définitivement « {titre} » et 1 élément rangé dessous ? Ils ne pourront plus être restaurés.",
                  "Supprimer définitivement « {titre} » et les {n} éléments rangés dessous ? Ils ne pourront plus être restaurés.",
                  { titre },
                )
              : t("Supprimer définitivement « {titre} » ? Il ne pourra plus être restauré.", { titre })}
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={props.onRenoncer} className={`${bouton} text-text-dim hover:text-text`}>
              {t("Garder")}
            </button>
            <button
              type="button"
              disabled={props.occupe}
              onClick={props.onConfirmerSuppression}
              className={`${bouton} bg-red font-semibold text-white hover:opacity-90`}
            >
              {t("Supprimer définitivement")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

