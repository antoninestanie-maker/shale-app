// Les comptes, et le geste le plus fréquent du module : relever un solde.
//
// LE RITUEL MENSUEL. Tout le modèle repose sur une saisie de deux minutes, une
// fois par mois. S'il faut ouvrir cinq dialogues pour cinq comptes, personne ne
// le fait, les relevés vieillissent, et le runway devient faux sans prévenir.
// D'où le bouton « Tout relever » : un formulaire, une colonne de champs, une
// validation. Le solde d'un compte isolé se corrige au clic sur le montant.
import { useEffect, useMemo, useState } from "react";

import { IconAlert, IconCheck, IconFolder, IconPencil, IconPlus, IconTrash, IconX } from "../icons";
import { BoutonDiscret, Champ, inputCls, Montant } from "./champs";
import { formaterCents, parseMontantEnCents } from "../../lib/finance/montants";
import type { LignePatrimoine, Patrimoine } from "../../lib/finance/patrimoine";
import {
  archiveFinanceAccount,
  createFinanceAccount,
  deleteFinanceAccount,
  saveFinanceBalance,
  updateFinanceAccount,
  type FinanceAccountInput,
} from "../../lib/repo";
import type { FinanceAccount, FinanceAccountKind } from "../../lib/types";
import { formatDate, localeTag, t } from "../../lib/i18n";

/**
 * Libellés des natures de compte. Les valeurs stockées sont celles du schéma
 * (migration 018) ; ce qui s'affiche passe par l'i18n comme le reste.
 */
const NATURES: { id: FinanceAccountKind; label: string }[] = [
  { id: "courant", label: "Compte courant" },
  { id: "epargne", label: "Épargne" },
  { id: "investissement", label: "Investissement" },
  { id: "trading", label: "Trading" },
  { id: "credit", label: "Crédit" },
  { id: "especes", label: "Espèces" },
];

const natureLabel = (k: FinanceAccountKind) =>
  t(NATURES.find((n) => n.id === k)?.label ?? k);

const VIDE: FinanceAccountInput = {
  label: "",
  kind: "courant",
  currency: "EUR",
  institution: null,
  is_liquid: true,
};

export default function ComptesPanel({
  patrimoine,
  comptes,
  aujourdhui,
  devise,
  onChange,
  signalNouveau = 0,
  signalRelever = 0,
}: {
  patrimoine: Patrimoine;
  /** TOUS les comptes, archivés compris — `patrimoine.lignes` les écarte. */
  comptes: FinanceAccount[];
  aujourdhui: string;
  devise: string;
  onChange: () => Promise<void> | void;
  /** Incrémenté par le parcours de démarrage pour ouvrir le formulaire d'ici. */
  signalNouveau?: number;
  /** Idem, pour ouvrir directement le relevé groupé. */
  signalRelever?: number;
}) {
  const [edite, setEdite] = useState<FinanceAccount | "nouveau" | null>(null);
  const [releveGroupe, setReleveGroupe] = useState(false);
  const [voirArchives, setVoirArchives] = useState(false);

  useEffect(() => {
    if (signalNouveau > 0) setEdite("nouveau");
  }, [signalNouveau]);

  useEffect(() => {
    if (signalRelever > 0) setReleveGroupe(true);
  }, [signalRelever]);

  const actifs = patrimoine.lignes;
  const datesAnciennes = actifs.some((l) => l.perime);
  const archives = comptes.filter((c) => c.archived === 1);
  /** Un compte au moins n'a jamais été relevé, ou son relevé a vieilli. */
  const aRelever = actifs.some((l) => l.montantCents === null || l.perime);

  return (
    <section className="card p-5">
      {/* ⚠️ UN SEUL contrôle dans l'en-tête, et c'est délibéré. Au survol du
          panneau, `.rgrid-head` réserve ~4 rem à droite pour les poignées de la
          grille : le cluster de droite glisse alors vers la gauche. Avec deux
          boutons, ce glissement se voit et donne l'impression que la carte
          bouge toute seule ; avec un seul, il est imperceptible. Les actions
          secondaires vivent dans le CORPS du panneau. */}
      <div className="rgrid-head flex items-center justify-between gap-2">
        <h2 className="hud-label">{t("comptes")}</h2>
        <BoutonDiscret onClick={() => setEdite("nouveau")} tip={t("Ajouter un compte")}>
          <span className="flex items-center gap-1.5">
            <IconPlus className="h-3.5 w-3.5" />
            {t("Compte")}
          </span>
        </BoutonDiscret>
      </div>

      {actifs.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-dim">
          {t("Aucun compte. Commence par en ajouter un — même approximatif.")}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-border">
          {actifs.map((ligne) => (
            <LigneCompte
              key={ligne.compte.id}
              ligne={ligne}
              aujourdhui={aujourdhui}
              devise={devise}
              onEditer={() => setEdite(ligne.compte)}
              onChange={onChange}
            />
          ))}
        </ul>
      )}

      {/* Le geste central du module : tout le modèle repose sur cette saisie de
          deux minutes, une fois par mois. Elle mérite un bouton plein, dans le
          corps du panneau — pas une commande discrète coincée dans un en-tête
          où personne ne la cherche. */}
      {actifs.length > 0 && (
        <button
          type="button"
          onClick={() => setReleveGroupe(true)}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-field)] px-3 py-2.5 text-sm font-medium transition-colors ${
            aRelever
              ? "bg-blue text-white hover:opacity-90"
              : "border border-border text-text-dim hover:bg-overlay hover:text-text"
          }`}
        >
          <IconPencil className="h-4 w-4" />
          {aRelever ? t("Relever mes soldes") : t("Mettre à jour mes soldes")}
        </button>
      )}

      {datesAnciennes && (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-yellow">
          <IconAlert className="mt-px h-3.5 w-3.5 shrink-0" />
          {t("Certains relevés datent : le runway s'appuie sur des chiffres vieillissants.")}
        </p>
      )}

      {archives.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setVoirArchives((v) => !v)}
            className="flex w-full items-center gap-1.5 text-left text-xs text-text-dim transition-colors hover:text-text"
          >
            <IconFolder className="h-3.5 w-3.5 shrink-0" />
            {t(
              archives.length === 1
                ? "{n} compte archivé"
                : "{n} comptes archivés",
              { n: archives.length },
            )}
          </button>
          {voirArchives && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {archives.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-text-dim" title={c.label}>
                    {c.label}
                  </span>
                  <BoutonDiscret
                    onClick={async () => {
                      await archiveFinanceAccount(c.id, false);
                      await onChange();
                    }}
                  >
                    {t("Désarchiver")}
                  </BoutonDiscret>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {edite && (
        <FormulaireCompte
          compte={edite === "nouveau" ? null : edite}
          onFerme={() => setEdite(null)}
          onChange={onChange}
        />
      )}

      {releveGroupe && (
        <ReleveGroupe
          lignes={actifs}
          aujourdhui={aujourdhui}
          devise={devise}
          onFerme={() => setReleveGroupe(false)}
          onChange={onChange}
        />
      )}
    </section>
  );
}

/** Une ligne : le solde s'édite au clic, sans quitter la liste. */
function LigneCompte({
  ligne,
  aujourdhui,
  devise,
  onEditer,
  onChange,
}: {
  ligne: LignePatrimoine;
  aujourdhui: string;
  devise: string;
  onEditer: () => void;
  onChange: () => Promise<void> | void;
}) {
  const [saisie, setSaisie] = useState<string | null>(null);
  const { compte, montantCents, dernierReleve, perime } = ligne;

  const valider = async () => {
    if (saisie === null) return;
    const cents = parseMontantEnCents(saisie);
    // Une saisie illisible ne ferme pas le champ et n'écrit rien : la corriger
    // doit être possible sans avoir à rouvrir la ligne.
    if (cents === null) return;
    await saveFinanceBalance(compte.id, aujourdhui, cents);
    await onChange();
    setSaisie(null);
  };

  // La nature est omise quand elle est DÉJÀ le libellé : « Compte courant »
  // suivi de « Compte courant · Boursorama » se lit comme un bug d'affichage,
  // et c'est le nom que la moitié des gens donnent à leur compte.
  //
  // Sortie du JSX pour pouvoir servir DEUX FOIS : le texte affiché, et le
  // `title` qui le rend au survol quand la colonne est trop étroite.
  const sousTitre = [
    compte.label.trim().toLowerCase() === natureLabel(compte.kind).toLowerCase()
      ? null
      : natureLabel(compte.kind),
    compte.institution,
    compte.is_liquid === 0 ? t("hors runway") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="group/ligne flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate truncate-souris text-sm text-text" title={compte.label}>
          {compte.label}
        </p>
        <p className="truncate truncate-souris text-xs text-text-dim" title={sousTitre}>
          {sousTitre}
        </p>
      </div>

      <div className="text-right">
        {saisie !== null ? (
          // ⚠️ L'édition porte ses boutons, et ne repose PAS seulement sur
          // Entrée. Un champ qui ne s'enregistre qu'au clavier laisse
          // l'utilisateur cliquer ailleurs sans savoir si sa saisie a été
          // prise — c'est le reproche exact qui a été fait à cet écran.
          // Le `onBlur` valide toujours, mais il n'est plus le seul chemin.
          <div className="flex items-center justify-end gap-1">
            <input
              className={`${inputCls} w-28 text-right`}
              inputMode="decimal"
              autoFocus
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void valider();
                if (e.key === "Escape") setSaisie(null);
              }}
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void valider()}
              data-tip={t("Enregistrer ce solde")}
              className="rounded-[10px] border border-green/40 p-1.5 text-green transition-colors hover:bg-green/10"
            >
              <IconCheck className="h-4 w-4" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSaisie(null)}
              data-tip={t("Annuler")}
              className="rounded-[10px] border border-border p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        ) : (
          // Le montant EST le champ de saisie : il en porte la bordure en
          // permanence. Sans elle, rien ne disait qu'on pouvait cliquer
          // dessus — le geste le plus fréquent du module était invisible.
          <button
            type="button"
            onClick={() =>
              setSaisie(
                montantCents === null
                  ? ""
                  : (montantCents / 100).toFixed(2).replace(".", ","),
              )
            }
            data-tip={t("Saisir le solde d'aujourd'hui")}
            className={`flex items-center gap-2 rounded-[10px] border px-2.5 py-1.5 text-sm transition-colors ${
              montantCents === null
                ? "border-dashed border-blue/50 text-blue hover:bg-blue/10"
                : "border-border text-text hover:border-border-strong hover:bg-overlay"
            }`}
          >
            {montantCents === null ? (
              <span className="text-xs font-medium">{t("Relever")}</span>
            ) : (
              <Montant cents={montantCents} devise={devise} />
            )}
            <IconPencil className="h-3.5 w-3.5 shrink-0 text-text-dim" />
          </button>
        )}
        <p className={`mt-0.5 text-[11px] ${perime ? "text-yellow" : "text-text-dim"}`}>
          {dernierReleve ? formatDate(dernierReleve) : t("jamais relevé")}
        </p>
      </div>

      <button
        type="button"
        onClick={onEditer}
        data-tip={t("Modifier ce compte")}
        className="shrink-0 rounded-[10px] p-1.5 text-text-dim opacity-0 transition-opacity hover:bg-overlay hover:text-text group-hover/ligne:opacity-100"
      >
        <IconPencil className="h-4 w-4" />
      </button>
    </li>
  );
}

/** Le ritual mensuel : tous les soldes dans un seul formulaire. */
function ReleveGroupe({
  lignes,
  aujourdhui,
  devise,
  onFerme,
  onChange,
}: {
  lignes: LignePatrimoine[];
  aujourdhui: string;
  devise: string;
  onFerme: () => void;
  onChange: () => Promise<void> | void;
}) {
  const [valeurs, setValeurs] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      lignes.map((l) => [
        l.compte.id,
        l.montantCents === null ? "" : (l.montantCents / 100).toFixed(2).replace(".", ","),
      ]),
    ),
  );

  const total = useMemo(
    () =>
      lignes.reduce((s, l) => {
        const c = parseMontantEnCents(valeurs[l.compte.id] ?? "");
        return s + (c ?? 0);
      }, 0),
    [lignes, valeurs],
  );

  const enregistrer = async () => {
    for (const l of lignes) {
      const cents = parseMontantEnCents(valeurs[l.compte.id] ?? "");
      // Un champ laissé vide n'écrase rien : ne pas savoir n'est pas déclarer
      // zéro. C'est la même règle que partout dans le module.
      if (cents !== null) await saveFinanceBalance(l.compte.id, aujourdhui, cents);
    }
    await onChange();
    onFerme();
  };

  return (
    <Dialogue titre={t("Relevé du {d}", { d: formatDate(aujourdhui) })} onFerme={onFerme}>
      <p className="text-xs text-text-dim">
        {t("Un champ laissé vide ne modifie rien — ne pas savoir n'est pas déclarer zéro.")}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {lignes.map((l) => (
          <label key={l.compte.id} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm text-text" title={l.compte.label}>
              {l.compte.label}
            </span>
            <input
              className={`${inputCls} w-36 text-right`}
              inputMode="decimal"
              value={valeurs[l.compte.id] ?? ""}
              placeholder="—"
              onChange={(e) =>
                setValeurs((v) => ({ ...v, [l.compte.id]: e.target.value }))
              }
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="hud-label">{t("total saisi")}</span>
        <span className="font-mono text-sm text-text">
          {formaterCents(total, devise, localeTag())}
        </span>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <BoutonDiscret onClick={onFerme}>{t("Annuler")}</BoutonDiscret>
        <button
          type="button"
          onClick={() => void enregistrer()}
          className="flex items-center gap-1.5 rounded-[10px] bg-blue px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          <IconCheck className="h-3.5 w-3.5" />
          {t("Enregistrer")}
        </button>
      </div>
    </Dialogue>
  );
}

/**
 * ⚠️ EXPORTÉ, et pas seulement utilisé ici. Une modale n'appartient pas au
 * panneau qui l'ouvre : quand la vue masque les panneaux (base entièrement
 * vide), le parcours de démarrage doit pouvoir l'ouvrir quand même. Le
 * contraire a produit un bouton « Ajouter un compte » qui ne faisait rien.
 */
export function FormulaireCompte({
  compte,
  onFerme,
  onChange,
}: {
  compte: FinanceAccount | null;
  onFerme: () => void;
  onChange: () => Promise<void> | void;
}) {
  const [form, setForm] = useState<FinanceAccountInput>(() =>
    compte
      ? {
          label: compte.label,
          kind: compte.kind,
          currency: compte.currency,
          institution: compte.institution,
          is_liquid: compte.is_liquid === 1,
        }
      : VIDE,
  );
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);

  const valider = async () => {
    if (!form.label.trim()) return;
    if (compte) await updateFinanceAccount(compte.id, form);
    else await createFinanceAccount(form);
    await onChange();
    onFerme();
  };

  return (
    <Dialogue titre={compte ? t("Modifier le compte") : t("Nouveau compte")} onFerme={onFerme}>
      <div className="flex flex-col gap-3">
        <Champ label={t("Libellé")}>
          <input
            className={inputCls}
            autoFocus
            value={form.label}
            placeholder={t("Compte courant")}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
        </Champ>

        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label={t("Nature")}>
            <select
              className={inputCls}
              value={form.kind}
              onChange={(e) =>
                setForm((f) => ({ ...f, kind: e.target.value as FinanceAccountKind }))
              }
            >
              {NATURES.map((n) => (
                <option key={n.id} value={n.id}>
                  {t(n.label)}
                </option>
              ))}
            </select>
          </Champ>
          <Champ label={t("Établissement")}>
            <input
              className={inputCls}
              value={form.institution ?? ""}
              placeholder={t("facultatif")}
              onChange={(e) =>
                setForm((f) => ({ ...f, institution: e.target.value || null }))
              }
            />
          </Champ>
        </div>

        <label className="flex items-start gap-2.5 rounded-[10px] border border-border p-3">
          <input
            type="checkbox"
            className="mt-0.5 accent-[var(--color-blue)]"
            checked={form.is_liquid}
            onChange={(e) => setForm((f) => ({ ...f, is_liquid: e.target.checked }))}
          />
          <span>
            <span className="block text-sm text-text">{t("Compte dans le runway")}</span>
            <span className="block text-xs text-text-dim">
              {t(
                "Décoche pour un placement que tu ne comptes pas vendre pour payer tes charges — un PEA bloqué, par exemple.",
              )}
            </span>
          </span>
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {compte && !confirmeSuppression && (
            <>
              <BoutonDiscret
                onClick={async () => {
                  await archiveFinanceAccount(compte.id, compte.archived === 0);
                  await onChange();
                  onFerme();
                }}
                tip={t("Le compte sort des totaux mais son historique est conservé")}
              >
                {compte.archived === 1 ? t("Désarchiver") : t("Archiver")}
              </BoutonDiscret>
              <BoutonDiscret danger onClick={() => setConfirmeSuppression(true)}>
                <span className="flex items-center gap-1.5">
                  <IconTrash className="h-3.5 w-3.5" />
                  {t("Supprimer")}
                </span>
              </BoutonDiscret>
            </>
          )}
          {compte && confirmeSuppression && (
            <BoutonDiscret
              danger
              onClick={async () => {
                await deleteFinanceAccount(compte.id);
                await onChange();
                onFerme();
              }}
            >
              {t("Supprimer définitivement, relevés compris")}
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

/** Modale du module. `card-solid` : le dégradé de `.card` bave au-dessus d'un flou. */
export function Dialogue({
  titre,
  onFerme,
  children,
}: {
  titre: string;
  onFerme: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFerme();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFerme]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onFerme();
      }}
    >
      <div className="card card-solid max-h-[85vh] w-full max-w-lg overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-text">{titre}</h3>
          <button
            type="button"
            onClick={onFerme}
            data-tip={t("Fermer")}
            className="rounded-[10px] p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
