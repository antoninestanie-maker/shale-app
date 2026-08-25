// L'en-tête : trois chiffres, rien d'autre. C'est ce qu'on vient voir.
//
// Le runway est écrit très gros parce qu'il est LA réponse du module. Les deux
// autres l'expliquent : le patrimoine est le numérateur, le burn le
// dénominateur. Y ajouter un quatrième indicateur diluerait la seule question à
// laquelle cet écran répond.
import { IconAlert } from "../icons";
import { Montant } from "./champs";
import { moisAffiches, type Runway } from "../../lib/finance/runway";
import type { Burn } from "../../lib/finance/burn";
import type { Patrimoine } from "../../lib/finance/patrimoine";
import { formatDate, localeTag, t } from "../../lib/i18n";
import { formaterCents } from "../../lib/finance/montants";

/** Montant sans centimes, DEVISE COMPRISE — « 10 570 » n'est pas un montant. */
const bref = (cents: number, devise: string) =>
  formaterCents(cents, devise, localeTag(), { sansDecimales: true });

/** Teinte du runway : sous trois mois, ça se voit. */
function teinteRunway(r: Runway): string {
  if (r.etat === "epuise") return "text-red";
  if (r.etat === "infini") return "text-green";
  if (r.etat !== "ok" || r.mois === null) return "text-text-dim";
  if (r.mois < 3) return "text-red";
  if (r.mois < 6) return "text-yellow";
  return "text-green";
}

/**
 * Ce que le grand chiffre affiche, selon l'état.
 * Chacun des quatre états sans réponse a sa phrase : « — » partout ferait
 * croire à une panne là où il ne manque qu'une saisie.
 */
function libelleRunway(r: Runway): { valeur: string; sous: string } {
  switch (r.etat) {
    case "ok":
      return {
        valeur: t("{n} mois", { n: moisAffiches(r.mois!).toLocaleString() }),
        sous: r.dateEpuisement
          ? t("épuisement estimé le {d}", { d: formatDate(r.dateEpuisement) })
          : "",
      };
    case "infini":
      return {
        valeur: "∞",
        sous: t("tes revenus récurrents couvrent tes charges"),
      };
    case "epuise":
      return { valeur: t("0 mois"), sous: t("tes liquidités sont à sec") };
    case "sans-burn":
      return {
        valeur: t("—"),
        sous: t("déclare tes charges récurrentes pour obtenir un runway"),
      };
    case "sans-donnees":
      return {
        valeur: t("—"),
        sous: t("relève le solde d'au moins un compte"),
      };
  }
}

export default function EnTeteFinance({
  runway,
  patrimoine,
  burn,
  devise,
}: {
  runway: Runway;
  patrimoine: Patrimoine;
  burn: Burn;
  devise: string;
}) {
  const { valeur, sous } = libelleRunway(runway);

  return (
    <section className="card p-6">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {/* Le runway */}
        <div className="min-w-0">
          <p className="hud-label">{t("runway")}</p>
          <p
            className={`mt-1 font-display text-[clamp(2.25rem,6vw,3.5rem)] font-bold leading-none tracking-tight ${teinteRunway(runway)}`}
          >
            {valeur}
          </p>
          {sous && <p className="mt-2 text-sm text-text-dim">{sous}</p>}
        </div>

        {/* Le numérateur */}
        <div className="min-w-0 sm:border-l sm:border-border sm:pl-6">
          <p className="hud-label">{t("patrimoine net")}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-text">
            <Montant cents={patrimoine.totalCents} devise={devise} sansDecimales />
          </p>
          <p className="mt-2 text-xs text-text-dim">
            {t("dont {n} de liquidités", { n: bref(patrimoine.liquideCents, devise) })}
          </p>
          {patrimoine.sansReleve > 0 && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-yellow">
              <IconAlert className="mt-px h-3.5 w-3.5 shrink-0" />
              {t(
                patrimoine.sansReleve === 1
                  ? "{n} compte sans aucun relevé — le total est incomplet"
                  : "{n} comptes sans aucun relevé — le total est incomplet",
                { n: patrimoine.sansReleve },
              )}
            </p>
          )}
        </div>

        {/* Le dénominateur */}
        <div className="min-w-0 sm:border-l sm:border-border sm:pl-6">
          <p className="hud-label">{t("burn mensuel")}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-text">
            <Montant cents={burn.netCents} devise={devise} sansDecimales />
          </p>
          <p className="mt-2 text-xs text-text-dim">
            {burn.actifs === 0
              ? t("aucun flux déclaré")
              : t("{s} de charges − {e} de revenus", {
                  s: bref(burn.sortiesCents, devise),
                  e: bref(burn.entreesCents, devise),
                })}
          </p>
        </div>
      </div>
    </section>
  );
}
