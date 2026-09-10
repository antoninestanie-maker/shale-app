// Ce qu'on me doit, ce que je dois — et les DEUX runways.
//
// ⚠️⚠️ LE RUNWAY PRUDENT EST AFFICHÉ EN PREMIER, ET IL NE CHANGE PAS DE
// DÉFINITION. Le second est à côté, nommé autrement, jamais à la place.
// Quelqu'un a déjà pris une décision sur le premier chiffre ; le redéfinir sous
// ses pieds est la pire chose qu'un outil financier puisse faire.
//
// Les deux ensemble disent quelque chose qu'aucun ne dit seul :
//   • prudent       — « avec l'argent que j'AI » ;
//   • avec créances — « si mes clients payent à l'échéance ».
// L'écart entre les deux EST l'information. Un écart énorme veut dire que la
// trésorerie dépend entièrement de gens qui n'ont pas encore payé.
import { useMemo } from "react";

import { IconAlert, IconCheckCircle } from "../icons";
import { Montant } from "./champs";
import type { Encours, Tranche } from "../../lib/finance/facturation/creances";
import { TRANCHES } from "../../lib/finance/facturation/creances";
import type { ComparaisonRevenus, FenetreMois } from "../../lib/finance/facturation/revenus";
import { FENETRES_MOIS, ecartNotable } from "../../lib/finance/facturation/revenus";
import type { DeuxRunways } from "../../lib/finance/facturation/runway-creances";
import { moisAffiches } from "../../lib/finance/runway";
import type { Runway } from "../../lib/finance/runway";
import { formatDate, localeTag, t, tp } from "../../lib/i18n";

/** Libellés des tranches. Valeurs françaises, traduites à l'affichage. */
const LIBELLE_TRANCHE: Record<Tranche, string> = {
  "a-echoir": "À échoir",
  "1-30": "1 à 30 j",
  "31-60": "31 à 60 j",
  "60-plus": "Plus de 60 j",
};

export default function CreancesPanel({
  deuxRunways,
  creances,
  dettes,
  revenus,
  fenetreRevenus,
  onFenetreRevenus,
  devise,
}: {
  deuxRunways: DeuxRunways;
  creances: Encours;
  dettes: Encours;
  revenus: ComparaisonRevenus;
  fenetreRevenus: FenetreMois;
  onFenetreRevenus: (f: FenetreMois) => void;
  devise: string;
}) {
  return (
    <section className="card flex flex-col p-5">
      <header className="rgrid-head flex flex-wrap items-center justify-between gap-2">
        <h2 className="hud-label min-w-0 truncate">{t("Créances et trésorerie")}</h2>
      </header>

      <DeuxChiffres deux={deuxRunways} />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <BlocEncours
          titre={t("Ce qu'on me doit")}
          encours={creances}
          devise={devise}
          sens="client"
        />
        <BlocEncours
          titre={t("Ce que je dois")}
          encours={dettes}
          devise={devise}
          sens="fournisseur"
        />
      </div>

      <ComparaisonDeclare
        revenus={revenus}
        fenetre={fenetreRevenus}
        onFenetre={onFenetreRevenus}
        devise={devise}
      />
    </section>
  );
}

/**
 * ⭐ Les deux runways, côte à côte.
 *
 * ⚠️ Les quatre états d'impossibilité sont traités ICI aussi. Afficher « 0 mois »
 * parce qu'on n'a pas de données serait pire que de n'afficher rien : c'est un
 * chiffre auquel on se fie pour décider de prendre un risque.
 */
function DeuxChiffres({ deux }: { deux: DeuxRunways }) {
  const { prudent, avecCreances, ecartMois } = deux;

  return (
    <div className="mt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <CarteRunway
          titre={t("Runway prudent")}
          sous={t("L'argent réellement en banque")}
          runway={prudent}
          accent={false}
        />
        <CarteRunway
          titre={t("Avec créances")}
          sous={t("Si les factures sont payées à l'échéance")}
          runway={avecCreances}
          accent
        />
      </div>

      {ecartMois !== null && Math.abs(ecartMois) >= 0.1 && (
        <p className="mt-2 text-[11px] text-text-dim">
          {ecartMois > 0
            ? t("Les créances attendues repoussent l'épuisement de {n} mois.", {
                n: moisAffiches(ecartMois).toLocaleString(localeTag()),
              })
            : t("Les dettes fournisseurs rapprochent l'épuisement de {n} mois.", {
                n: moisAffiches(Math.abs(ecartMois)).toLocaleString(localeTag()),
              })}
        </p>
      )}
      {/* Un montant sans son échéance ne dit rien : on ne promet pas la date
          quand le calcul n'en produit pas. */}
      {avecCreances.dateEpuisement && avecCreances.etat === "ok" && (
        <p className="text-[11px] text-text-dim">
          {t("Épuisement estimé le")} {formatDate(avecCreances.dateEpuisement)}
        </p>
      )}
    </div>
  );
}

function CarteRunway({
  titre,
  sous,
  runway,
  accent,
}: {
  titre: string;
  sous: string;
  runway: Runway;
  accent: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border px-3 py-2.5 ${
        accent ? "border-blue/40 bg-overlay" : "border-border"
      }`}
    >
      <p className="hud-label truncate">{titre}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text">
        <ValeurRunway runway={runway} />
      </p>
      <p className="mt-0.5 text-[11px] text-text-dim">{sous}</p>
    </div>
  );
}

/** ⚠️ Chaque état d'impossibilité a sa PHRASE, jamais un zéro trompeur. */
function ValeurRunway({ runway }: { runway: Runway }) {
  switch (runway.etat) {
    case "ok":
      return (
        <>
          {moisAffiches(runway.mois as number).toLocaleString(localeTag())}
          {/* ⚠️ « mois » est invariable en français, pas en anglais : sans
              pluriel, l'app anglaise affichait « 9.3 month ». */}
          <span className="ml-1 text-sm font-normal text-text-dim">
            {tp(moisAffiches(runway.mois as number), "mois|un", "mois|plusieurs")}
          </span>
        </>
      );
    case "epuise":
      return <span className="text-red">{t("Épuisé")}</span>;
    case "infini":
      return <span className="text-green">∞</span>;
    case "sans-burn":
      return <span className="text-sm font-normal text-text-dim">{t("Aucune charge déclarée")}</span>;
    default:
      return <span className="text-sm font-normal text-text-dim">{t("Aucun compte relevé")}</span>;
  }
}

function BlocEncours({
  titre,
  encours,
  devise,
  sens,
}: {
  titre: string;
  encours: Encours;
  devise: string;
  sens: "client" | "fournisseur";
}) {
  const nonVides = useMemo(
    () => TRANCHES.filter((tr) => encours.parTranche[tr] !== 0),
    [encours.parTranche],
  );

  return (
    <div className="rounded-[10px] border border-border px-3 py-2.5">
      <p className="hud-label truncate">{titre}</p>
      <p className="mt-1">
        <Montant cents={encours.totalCents} devise={devise} className="text-lg font-semibold" />
      </p>

      {encours.totalCents === 0 ? (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-text-dim">
          <IconCheckCircle className="h-3 w-3 shrink-0 text-green" />
          {sens === "client" ? t("Rien en attente de règlement.") : t("Rien à régler.")}
        </p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-0.5">
          {nonVides.map((tr) => (
            <li key={tr} className="flex items-center justify-between text-[11px]">
              <span className={tr === "a-echoir" ? "text-text-dim" : "text-yellow"}>
                {t(LIBELLE_TRANCHE[tr])}
              </span>
              <Montant cents={encours.parTranche[tr]} devise={devise} className="text-[11px]" />
            </li>
          ))}
        </ul>
      )}

      {/* ⚠️ Icône + libellé, jamais la seule couleur. */}
      {encours.nbEnRetard > 0 && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-red">
          <IconAlert className="h-3 w-3 shrink-0" />
          {tp(encours.nbEnRetard, "{n} document en retard", "{n} documents en retard")}
        </p>
      )}
    </div>
  );
}

/**
 * ⭐ Déclaré vs encaissé.
 *
 * ⚠️ CE BLOC NE PROPOSE JAMAIS DE « CORRIGER » LE BURN. Un écart durable est une
 * information sur l'activité, pas une faute de saisie : quelqu'un qui déclare
 * 4 000 € et n'en encaisse que 2 800 depuis six mois n'a pas mal rempli un
 * formulaire. Réécrire son burn à sa place effacerait le signal.
 */
function ComparaisonDeclare({
  revenus,
  fenetre,
  onFenetre,
  devise,
}: {
  revenus: ComparaisonRevenus;
  fenetre: FenetreMois;
  onFenetre: (f: FenetreMois) => void;
  devise: string;
}) {
  const notable = ecartNotable(revenus);

  return (
    <div className="mt-4 rounded-[10px] border border-border px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hud-label min-w-0 truncate">{t("Déclaré face à encaissé")}</p>
        <div className="flex shrink-0 items-center gap-1">
          {FENETRES_MOIS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFenetre(f)}
              className={`cible-tactile-ligne rounded-pill border px-2 py-0.5 text-[11px] transition-colors ${
                fenetre === f
                  ? "border-blue bg-overlay-2 text-text"
                  : "border-border text-text-dim hover:bg-overlay hover:text-text"
              }`}
            >
              {t("{n} mois", { n: f })}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[11px] text-text-dim">{t("Revenus récurrents déclarés")}</p>
          <Montant cents={revenus.declareMensuelCents} devise={devise} className="text-sm" />
          <span className="ml-1 text-[11px] text-text-dim">{t("/ mois")}</span>
        </div>
        <div>
          <p className="text-[11px] text-text-dim">{t("Réellement encaissé")}</p>
          <Montant cents={revenus.encaisseMensuelCents} devise={devise} className="text-sm" />
          <span className="ml-1 text-[11px] text-text-dim">{t("/ mois")}</span>
        </div>
      </div>

      {notable && (
        <p className="mt-2 text-[11px] text-text-dim">
          {revenus.ecartMensuelCents < 0
            ? t(
                "Tu encaisses durablement moins que ce que tu as déclaré. Ce n'est pas une erreur de saisie : ton burn reste ce que tu as choisi, et cet écart décrit ton activité.",
              )
            : t(
                "Tu encaisses durablement plus que ce que tu as déclaré. Ton runway prudent est donc plus pessimiste que la réalité.",
              )}
        </p>
      )}

      {revenus.ignoresSansTaux > 0 && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-yellow">
          <IconAlert className="h-3 w-3 shrink-0" />
          {tp(
            revenus.ignoresSansTaux,
            "{n} encaissement est exclu faute de taux de change",
            "{n} encaissements sont exclus faute de taux de change",
          )}
        </p>
      )}
    </div>
  );
}
