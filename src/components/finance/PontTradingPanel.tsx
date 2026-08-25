// Trading → € : la seule section du module réservée à Shale Trade.
//
// Elle est retirée de la grille, pas masquée — c'est la règle de `features.ts`
// (`TRADING_PANELS`) : un panneau caché resterait proposé dans les chips
// « + <titre> » sous la grille, ce qui annoncerait une fonctionnalité à
// quelqu'un qui n'y a pas droit.
import { useMemo, useState } from "react";

import { IconAlert } from "../icons";
import { BoutonDiscret, ChampMontant, Montant } from "./champs";
import type { Burn } from "../../lib/finance/burn";
import { ajouterMois } from "../../lib/finance/calendrier";
import { pontTrading } from "../../lib/finance/pont-trading";
import type { Trade } from "../../lib/types";
import { t } from "../../lib/i18n";

const PERIODES = [
  { mois: 3, label: "3 mois" },
  { mois: 6, label: "6 mois" },
  { mois: 12, label: "12 mois" },
] as const;

export default function PontTradingPanel({
  trades,
  burn,
  aujourdhui,
  devise,
  risqueParRCents,
  risqueSuggere,
  onEnregistrerRisque,
}: {
  trades: Trade[];
  burn: Burn;
  aujourdhui: string;
  devise: string;
  risqueParRCents: number | null;
  risqueSuggere: number | null;
  onEnregistrerRisque: (cents: number | null) => Promise<void> | void;
}) {
  const [mois, setMois] = useState<number>(6);
  const [reglage, setReglage] = useState(false);
  const [brouillon, setBrouillon] = useState<number | null>(risqueParRCents ?? risqueSuggere);

  const pont = useMemo(
    () =>
      pontTrading(
        trades,
        ajouterMois(aujourdhui, -mois),
        aujourdhui,
        risqueParRCents ?? 0,
        burn.netCents,
      ),
    [trades, aujourdhui, mois, risqueParRCents, burn.netCents],
  );

  // Sans « ce que vaut 1 R », il n'y a rien à convertir. On le demande plutôt
  // que de le deviner : le risque par trade a pu changer dix fois sur la
  // période, et personne d'autre que l'utilisateur ne sait ce qu'il a risqué.
  if (risqueParRCents === null) {
    return (
      <section className="card p-5">
        <h2 className="hud-label">{t("trading → euros")}</h2>
        <p className="mt-3 text-sm text-text-dim">
          {t(
            "Ton journal est en R, ta vie se paye en euros. Dis à Shale ce que vaut 1 R et il fera le pont.",
          )}
        </p>
        <div className="mt-3 max-w-xs">
          <ChampMontant
            label={t("Ce que vaut 1 R, en euros")}
            valeurCents={brouillon}
            onChange={setBrouillon}
          />
          {risqueSuggere !== null && (
            <p className="mt-1.5 text-xs text-text-dim">
              {t("D'après tes réglages du calculateur de position :")}{" "}
              <button
                type="button"
                onClick={() => setBrouillon(risqueSuggere)}
                className="underline decoration-dotted underline-offset-2 hover:text-text"
              >
                <Montant cents={risqueSuggere} devise={devise} className="text-xs" />
              </button>
            </p>
          )}
        </div>
        <div className="mt-3">
          <BoutonDiscret onClick={() => void onEnregistrerRisque(brouillon)}>
            {t("Enregistrer")}
          </BoutonDiscret>
        </div>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="rgrid-head flex flex-wrap items-center justify-between gap-2">
        <h2 className="hud-label">{t("trading → euros")}</h2>
        <div className="flex items-center gap-1">
          {PERIODES.map((p) => (
            <button
              key={p.mois}
              type="button"
              onClick={() => setMois(p.mois)}
              className={`rounded-[10px] px-2.5 py-1 text-xs transition-colors ${
                mois === p.mois
                  ? "bg-overlay-2 text-text"
                  : "text-text-dim hover:bg-overlay hover:text-text"
              }`}
            >
              {t(p.label)}
            </button>
          ))}
        </div>
      </div>

      {pont.nbTrades === 0 ? (
        <p className="py-6 text-center text-sm text-text-dim">
          {t("Aucun trade réel sur la période.")}
        </p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="hud-label">{t("résultat")}</p>
            <p className="mt-1 font-display text-xl font-semibold">
              <Montant cents={pont.contributionCents} devise={devise} colore signe sansDecimales />
            </p>
            <p className="mt-1 text-xs text-text-dim">
              {t("{n} trades · {r} R", {
                n: pont.nbTrades,
                r: pont.sommeR.toFixed(1),
              })}
            </p>
          </div>
          <div>
            <p className="hud-label">{t("par mois")}</p>
            <p className="mt-1 font-display text-xl font-semibold">
              <Montant
                cents={pont.contributionMensuelleCents}
                devise={devise}
                colore
                sansDecimales
              />
            </p>
            <p className="mt-1 text-xs text-text-dim">{t("ramené au rythme mensuel")}</p>
          </div>
          <div>
            <p className="hud-label">{t("part du burn couverte")}</p>
            <p
              className={`mt-1 font-display text-xl font-semibold ${
                pont.partDuBurnPct === null
                  ? "text-text-dim"
                  : pont.partDuBurnPct >= 100
                    ? "text-green"
                    : pont.partDuBurnPct < 0
                      ? "text-red"
                      : "text-text"
              }`}
            >
              {pont.partDuBurnPct === null ? t("—") : `${pont.partDuBurnPct} %`}
            </p>
            <p className="mt-1 text-xs text-text-dim">
              {pont.partDuBurnPct === null
                ? t("pas de burn net à couvrir")
                : t("de tes {b} de charges nettes", {
                    b: (burn.netCents / 100).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    }),
                  })}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="flex items-start gap-1.5 text-[11px] text-text-dim">
          <IconAlert className="mt-px h-3.5 w-3.5 shrink-0" />
          {t("Les backtests sont exclus : un backtest ne paye pas de loyer.")}
        </p>
        <BoutonDiscret onClick={() => setReglage((v) => !v)}>
          {t("1 R =")} <Montant cents={risqueParRCents} devise={devise} className="text-xs" />
        </BoutonDiscret>
      </div>

      {reglage && (
        <div className="mt-3 flex items-end gap-2">
          <div className="max-w-[200px] flex-1">
            <ChampMontant
              label={t("Ce que vaut 1 R, en euros")}
              valeurCents={brouillon}
              onChange={setBrouillon}
            />
          </div>
          <BoutonDiscret
            onClick={async () => {
              await onEnregistrerRisque(brouillon);
              setReglage(false);
            }}
          >
            {t("Enregistrer")}
          </BoutonDiscret>
        </div>
      )}
    </section>
  );
}
