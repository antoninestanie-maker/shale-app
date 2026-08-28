// Les flux récurrents — la seule chose que l'utilisateur déclare vraiment.
//
// Le tableau montre les montants TELS QU'ILS SONT PAYÉS (« 360 € par an ») et,
// à côté, leur équivalent mensuel. Afficher seulement le mensualisé rendrait la
// relecture impossible : personne ne reconnaît son assurance à « 30 €/mois ».
// Afficher seulement le brut rendrait le total incompréhensible.
import { useEffect, useMemo, useState } from "react";

import { IconAlert, IconPencil, IconPlus, IconTrash } from "../icons";
import { BoutonDiscret, Champ, ChampMontant, inputCls, Montant } from "./champs";
import { Dialogue } from "./ComptesPanel";
import { estActif, mensualiser, type Burn } from "../../lib/finance/burn";
import {
  createFinanceRecurring,
  deleteFinanceRecurring,
  updateFinanceRecurring,
  type FinanceRecurringInput,
} from "../../lib/repo";
import type {
  FinanceCategory,
  FinanceDirection,
  FinanceFrequency,
  FinanceRecurring,
} from "../../lib/types";
import { formatDate, t } from "../../lib/i18n";

const FREQUENCES: { id: FinanceFrequency; label: string }[] = [
  { id: "hebdo", label: "par semaine" },
  { id: "mensuel", label: "par mois" },
  { id: "trimestriel", label: "par trimestre" },
  { id: "annuel", label: "par an" },
];

const freqLabel = (f: FinanceFrequency) =>
  t(FREQUENCES.find((x) => x.id === f)?.label ?? f);

export default function FluxPanel({
  recurrents,
  categories,
  perimes,
  burn,
  aujourdhui,
  devise,
  onChange,
  signalNouveau = 0,
}: {
  recurrents: FinanceRecurring[];
  categories: FinanceCategory[];
  perimes: FinanceRecurring[];
  burn: Burn;
  aujourdhui: string;
  devise: string;
  onChange: () => Promise<void> | void;
  /** Incrémenté par le parcours de démarrage pour ouvrir le formulaire d'ici. */
  signalNouveau?: number;
}) {
  const [edite, setEdite] = useState<FinanceRecurring | "nouveau" | null>(null);
  const [voirPerimes, setVoirPerimes] = useState(false);

  useEffect(() => {
    if (signalNouveau > 0) setEdite("nouveau");
  }, [signalNouveau]);

  const idsPerimes = useMemo(() => new Set(perimes.map((r) => r.id)), [perimes]);
  const actifs = recurrents.filter((r) => estActif(r, aujourdhui));
  const entrees = actifs.filter((r) => r.direction === "entree");
  const sorties = actifs.filter((r) => r.direction === "sortie");

  return (
    <section className="card p-5">
      <div className="rgrid-head flex items-center justify-between">
        <h2 className="hud-label">{t("flux récurrents")}</h2>
        <BoutonDiscret onClick={() => setEdite("nouveau")} tip={t("Ajouter un flux récurrent")}>
          <span className="flex items-center gap-1.5">
            <IconPlus className="h-3.5 w-3.5" />
            {t("Flux")}
          </span>
        </BoutonDiscret>
      </div>

      {actifs.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-dim">
          {t("Aucun flux déclaré. Sans eux, pas de burn — donc pas de runway.")}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          <Groupe
            titre={t("entrées")}
            lignes={entrees}
            categories={categories}
            devise={devise}
            totalCents={burn.entreesCents}
            onEditer={setEdite}
          />
          <Groupe
            titre={t("sorties")}
            lignes={sorties}
            categories={categories}
            devise={devise}
            totalCents={burn.sortiesCents}
            onEditer={setEdite}
          />
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="hud-label">{t("burn net mensuel")}</span>
            <Montant cents={burn.netCents} devise={devise} className="text-sm font-semibold" />
          </div>
        </div>
      )}

      {perimes.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setVoirPerimes((v) => !v)}
            className="flex w-full items-center gap-1.5 text-left text-xs text-text-dim transition-colors hover:text-text"
          >
            <IconAlert className="h-3.5 w-3.5 shrink-0" />
            {t(
              perimes.length === 1
                ? "{n} flux terminé depuis plus de trois mois"
                : "{n} flux terminés depuis plus de trois mois",
              { n: perimes.length },
            )}
          </button>
          {voirPerimes && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {perimes.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-xs">
                  <span
                    className="min-w-0 truncate text-text-dim line-through"
                    title={r.label}
                  >
                    {r.label}
                  </span>
                  <span className="shrink-0 text-text-dim">
                    {t("terminé le {d}", { d: formatDate(r.active_to!) })}
                  </span>
                  <BoutonDiscret onClick={() => setEdite(r)}>{t("Reprendre")}</BoutonDiscret>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-text-dim">
            {t(
              "Ils ne pèsent plus sur le burn. Ils restent listés : un flux résilié garde sa valeur d'historique.",
            )}
          </p>
        </div>
      )}

      {edite && (
        <FormulaireFlux
          flux={edite === "nouveau" ? null : edite}
          categories={categories}
          aujourdhui={aujourdhui}
          estPerime={edite !== "nouveau" && idsPerimes.has(edite.id)}
          onFerme={() => setEdite(null)}
          onChange={onChange}
        />
      )}
    </section>
  );
}

function Groupe({
  titre,
  lignes,
  categories,
  devise,
  totalCents,
  onEditer,
}: {
  titre: string;
  lignes: FinanceRecurring[];
  categories: FinanceCategory[];
  devise: string;
  totalCents: number;
  onEditer: (r: FinanceRecurring) => void;
}) {
  if (lignes.length === 0) return null;
  const nomCat = (id: number | null) =>
    id === null ? null : (categories.find((c) => c.id === id)?.name ?? null);

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="hud-label">{titre}</span>
        <span className="font-mono text-xs text-text-dim">
          <Montant cents={totalCents} devise={devise} />
          {" / "}
          {t("mois")}
        </span>
      </div>
      <ul className="mt-1.5 flex flex-col divide-y divide-border">
        {lignes.map((r) => (
          <li key={r.id} className="group/flux flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate truncate-souris text-sm text-text" title={r.label}>
                {r.label}
              </p>
              <p
                className="truncate text-xs text-text-dim"
                title={nomCat(r.category_id) ?? t("sans catégorie")}
              >
                {nomCat(r.category_id) ?? t("sans catégorie")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm">
                <Montant cents={r.amount_cents} devise={devise} />
                <span className="ml-1 text-xs text-text-dim">{freqLabel(r.frequency)}</span>
              </p>
              {r.frequency !== "mensuel" && (
                <p className="text-[11px] text-text-dim">
                  {t("soit")}{" "}
                  <Montant
                    cents={mensualiser(r.amount_cents, r.frequency)}
                    devise={devise}
                    className="text-[11px]"
                  />
                  {t(" / mois")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onEditer(r)}
              data-tip={t("Modifier ce flux")}
              className="shrink-0 rounded-[10px] p-1.5 text-text-dim opacity-0 transition-opacity hover:bg-overlay hover:text-text group-hover/flux:opacity-100"
            >
              <IconPencil className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Exporté pour la même raison que `FormulaireCompte` — voir son commentaire. */
export function FormulaireFlux({
  flux,
  categories,
  aujourdhui,
  estPerime,
  onFerme,
  onChange,
}: {
  flux: FinanceRecurring | null;
  categories: FinanceCategory[];
  aujourdhui: string;
  estPerime: boolean;
  onFerme: () => void;
  onChange: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<FinanceRecurringInput>(() =>
    flux
      ? {
          label: flux.label,
          amount_cents: flux.amount_cents,
          direction: flux.direction,
          frequency: flux.frequency,
          day_of_period: flux.day_of_period,
          category_id: flux.category_id,
          account_id: flux.account_id,
          active_from: flux.active_from,
          // « Reprendre » un flux terminé, c'est rouvrir sa période : le
          // formulaire le fait d'emblée plutôt que d'obliger à effacer une date.
          active_to: estPerime ? null : flux.active_to,
        }
      : {
          label: "",
          amount_cents: 0,
          direction: "sortie",
          frequency: "mensuel",
          day_of_period: null,
          category_id: null,
          account_id: null,
          active_from: aujourdhui,
          active_to: null,
        },
  );
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);

  const catsDuSens = categories.filter((c) => c.kind === form.direction);

  const valider = async () => {
    if (!form.label.trim() || form.amount_cents <= 0) return;
    if (flux) await updateFinanceRecurring(flux.id, form);
    else await createFinanceRecurring(form);
    await onChange();
    onFerme();
  };

  return (
    <Dialogue titre={flux ? t("Modifier le flux") : t("Nouveau flux récurrent")} onFerme={onFerme}>
      <div className="flex flex-col gap-3">
        <Champ label={t("Libellé")}>
          <input
            className={inputCls}
            autoFocus
            value={form.label}
            placeholder={t("Loyer")}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
        </Champ>

        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label={t("Sens")}>
            <select
              className={inputCls}
              value={form.direction}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  direction: e.target.value as FinanceDirection,
                  category_id: null,
                }))
              }
            >
              <option value="sortie">{t("Sortie")}</option>
              <option value="entree">{t("Entrée")}</option>
            </select>
          </Champ>
          <ChampMontant
            label={t("Montant")}
            valeurCents={form.amount_cents || null}
            onChange={(c) => setForm((f) => ({ ...f, amount_cents: c ?? 0 }))}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label={t("Fréquence")}>
            <select
              className={inputCls}
              value={form.frequency}
              onChange={(e) =>
                setForm((f) => ({ ...f, frequency: e.target.value as FinanceFrequency }))
              }
            >
              {FREQUENCES.map((f) => (
                <option key={f.id} value={f.id}>
                  {t(f.label)}
                </option>
              ))}
            </select>
          </Champ>
          <Champ label={t("Catégorie")}>
            <select
              className={inputCls}
              value={form.category_id ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category_id: e.target.value ? Number(e.target.value) : null,
                }))
              }
            >
              <option value="">{t("sans catégorie")}</option>
              {catsDuSens.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Champ>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label={t("Actif depuis")}>
            <input
              type="date"
              className={inputCls}
              value={form.active_from}
              onChange={(e) => setForm((f) => ({ ...f, active_from: e.target.value }))}
            />
          </Champ>
          <Champ label={t("Jusqu'au (vide = toujours actif)")}>
            <input
              type="date"
              className={inputCls}
              value={form.active_to ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, active_to: e.target.value || null }))}
            />
          </Champ>
        </div>

        {form.amount_cents > 0 && form.frequency !== "mensuel" && (
          <p className="text-xs text-text-dim">
            {t("Compté comme")}{" "}
            <Montant
              cents={mensualiser(form.amount_cents, form.frequency)}
              className="text-xs"
            />
            {t(" par mois dans le burn.")}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div>
          {flux && !confirmeSuppression && (
            <BoutonDiscret danger onClick={() => setConfirmeSuppression(true)}>
              <span className="flex items-center gap-1.5">
                <IconTrash className="h-3.5 w-3.5" />
                {t("Supprimer")}
              </span>
            </BoutonDiscret>
          )}
          {flux && confirmeSuppression && (
            <BoutonDiscret
              danger
              onClick={async () => {
                await deleteFinanceRecurring(flux.id);
                await onChange();
                onFerme();
              }}
            >
              {t("Confirmer la suppression")}
            </BoutonDiscret>
          )}
        </div>
        <div className="flex gap-2">
          <BoutonDiscret onClick={onFerme}>{t("Annuler")}</BoutonDiscret>
          <button
            type="button"
            onClick={() => void valider()}
            className="rounded-[10px] bg-blue px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            {t("Enregistrer")}
          </button>
        </div>
      </div>
    </Dialogue>
  );
}
