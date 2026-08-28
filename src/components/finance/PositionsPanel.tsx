// Les positions détenues, valorisées depuis le cache de cotations.
//
// Deux choses à ne pas confondre, et que ce panneau sépare : le SOLDE d'un
// compte d'investissement (saisi à la main, il fait foi pour le patrimoine) et
// la valorisation des positions (calculée, informative). Additionner les deux
// compterait le même argent deux fois — c'est pourquoi la valorisation
// n'alimente PAS le patrimoine net.
import { useState } from "react";

import { IconPlus, IconTrash } from "../icons";
import { BoutonDiscret, Champ, ChampMontant, inputCls, Montant } from "./champs";
import { Dialogue } from "./ComptesPanel";
import { formaterQuantite, parseQuantiteE8 } from "../../lib/finance/montants";
import type { Valorisation } from "../../lib/finance/valorisation";
import { deleteFinanceHolding, saveFinanceHolding } from "../../lib/repo";
import type { FinanceAccount, FinanceSource } from "../../lib/types";
import { localeTag, t } from "../../lib/i18n";

export default function PositionsPanel({
  valorisation,
  comptes,
  devise,
  marcheEnCours,
  erreursMarche,
  onRafraichir,
  onChange,
}: {
  valorisation: Valorisation;
  comptes: FinanceAccount[];
  devise: string;
  marcheEnCours: boolean;
  erreursMarche: string[];
  onRafraichir: () => void;
  onChange: () => Promise<void> | void;
}) {
  const [ajout, setAjout] = useState(false);
  const nomCompte = (id: number) => comptes.find((c) => c.id === id)?.label ?? t("compte inconnu");

  return (
    <section className="card p-5">
      {/* Un seul contrôle ici : au survol, `.rgrid-head` réserve ~4 rem pour les
          poignées de la grille et fait glisser le cluster de droite. Avec deux
          boutons, le décalage se voit. « Actualiser » descend près du total,
          où l'on regarde de toute façon la fraîcheur des cotations. */}
      <div className="rgrid-head flex items-center justify-between gap-2">
        <h2 className="hud-label">{t("positions")}</h2>
        <BoutonDiscret onClick={() => setAjout(true)} tip={t("Ajouter une position")}>
          <span className="flex items-center gap-1.5">
            <IconPlus className="h-3.5 w-3.5" />
            {t("Position")}
          </span>
        </BoutonDiscret>
      </div>

      {valorisation.lignes.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-dim">
          {t("Aucune position suivie. Facultatif : le runway n'en a pas besoin.")}
        </p>
      ) : (
        <>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {valorisation.lignes.map((l) => (
              <li key={l.holding.id} className="group/pos flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate font-mono text-sm text-text"
                    title={l.holding.symbol}
                  >
                    {l.holding.symbol}
                  </p>
                  <p
                    className="truncate text-xs text-text-dim"
                    title={`${formaterQuantite(l.holding.quantity_e8, localeTag())} · ${nomCompte(l.holding.account_id)}`}
                  >
                    {formaterQuantite(l.holding.quantity_e8, localeTag())} ·{" "}
                    {nomCompte(l.holding.account_id)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  {l.manque ? (
                    <p className="text-xs text-yellow">
                      {l.manque === "cotation"
                        ? t("cotation indisponible")
                        : t("taux de change indisponible")}
                    </p>
                  ) : (
                    <>
                      <p className="text-sm">
                        <Montant cents={l.valeurCents} devise={devise} />
                      </p>
                      {l.plusValueCents !== null && (
                        <p className="text-[11px]">
                          <Montant
                            cents={l.plusValueCents}
                            devise={devise}
                            colore
                            signe
                            className="text-[11px]"
                          />
                        </p>
                      )}
                      {l.perimee && (
                        <p className="text-[11px] text-yellow">{t("cotation datée")}</p>
                      )}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteFinanceHolding(l.holding.id);
                    await onChange();
                  }}
                  data-tip={t("Retirer cette position")}
                  className="shrink-0 rounded-[10px] p-1.5 text-text-dim opacity-0 transition-opacity hover:bg-overlay hover:text-red group-hover/pos:opacity-100"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="hud-label">
              {t("valorisation")}
              {valorisation.incomplets > 0 &&
                ` · ${t(
                  valorisation.incomplets === 1
                    ? "{n} ligne non valorisée"
                    : "{n} lignes non valorisées",
                  { n: valorisation.incomplets },
                )}`}
            </span>
            <span className="flex items-center gap-2">
              <Montant
                cents={valorisation.totalCents}
                devise={devise}
                className="text-sm font-semibold"
              />
              <BoutonDiscret
                onClick={onRafraichir}
                tip={t("Redemander les cotations à Yahoo et Binance")}
              >
                {marcheEnCours ? t("Mise à jour…") : t("Actualiser")}
              </BoutonDiscret>
            </span>
          </div>

          <p className="mt-2 text-[11px] text-text-dim">
            {t(
              "Informatif : le patrimoine net s'appuie sur les soldes que tu relèves, pas sur cette valorisation — sinon le même argent serait compté deux fois.",
            )}
          </p>

          {erreursMarche.length > 0 && (
            <p className="mt-2 text-[11px] text-yellow">
              {t("Cotations indisponibles :")} {erreursMarche.join(" · ")}
            </p>
          )}
        </>
      )}

      {ajout && (
        <FormulairePosition
          comptes={comptes}
          onFerme={() => setAjout(false)}
          onChange={onChange}
        />
      )}
    </section>
  );
}

function FormulairePosition({
  comptes,
  onFerme,
  onChange,
}: {
  comptes: FinanceAccount[];
  onFerme: () => void;
  onChange: () => Promise<void> | void;
}) {
  const [accountId, setAccountId] = useState<number | null>(comptes[0]?.id ?? null);
  const [symbol, setSymbol] = useState("");
  const [quantite, setQuantite] = useState("");
  const [coutCents, setCoutCents] = useState<number | null>(null);
  const [source, setSource] = useState<FinanceSource>("yahoo");

  const valider = async () => {
    const q = parseQuantiteE8(quantite);
    if (accountId === null || !symbol.trim() || q === null) return;
    await saveFinanceHolding(accountId, symbol.trim().toUpperCase(), q, coutCents, source);
    await onChange();
    onFerme();
  };

  return (
    <Dialogue titre={t("Nouvelle position")} onFerme={onFerme}>
      <div className="flex flex-col gap-3">
        <Champ label={t("Compte")}>
          <select
            className={inputCls}
            value={accountId ?? ""}
            onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}
          >
            {comptes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Champ>

        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label={t("Source")}>
            <select
              className={inputCls}
              value={source}
              onChange={(e) => setSource(e.target.value as FinanceSource)}
            >
              <option value="yahoo">{t("Yahoo Finance")}</option>
              <option value="binance">{t("Binance")}</option>
              <option value="manuel">{t("Manuel (pas de cotation)")}</option>
            </select>
          </Champ>
          <Champ label={t("Symbole")}>
            <input
              className={inputCls}
              value={symbol}
              placeholder={source === "binance" ? "BTCUSDT" : "CW8.PA"}
              onChange={(e) => setSymbol(e.target.value)}
            />
          </Champ>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Champ label={t("Quantité")}>
            <input
              className={inputCls}
              inputMode="decimal"
              value={quantite}
              placeholder="0"
              onChange={(e) => setQuantite(e.target.value)}
            />
          </Champ>
          <ChampMontant
            label={t("Prix de revient total (facultatif)")}
            valeurCents={coutCents}
            onChange={setCoutCents}
          />
        </div>

        <p className="text-xs text-text-dim">
          {t(
            "Le symbole ne sera plus modifiable ensuite : l'identité de la ligne en dérive pour la synchronisation. Le corriger se fait en supprimant la position et en la recréant.",
          )}
        </p>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <BoutonDiscret onClick={onFerme}>{t("Annuler")}</BoutonDiscret>
        <button
          type="button"
          onClick={() => void valider()}
          className="rounded-[10px] bg-blue px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          {t("Ajouter")}
        </button>
      </div>
    </Dialogue>
  );
}
