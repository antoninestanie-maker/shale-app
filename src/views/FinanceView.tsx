// Finance — trésorerie personnelle pour un revenu irrégulier.
//
// LA THÈSE. Le journal de trading est en R, qui est une abstraction ; la vie se
// paye en euros. Ce module fait le pont, et son chiffre roi est le RUNWAY :
// combien de mois je tiens si mes revenus s'arrêtent demain.
//
// CE QUE CE N'EST PAS. Un gestionnaire de budget. On ne saisit pas de tickets
// de caisse, et il n'y a aucune agrégation bancaire — un agrégateur exige un
// backend qui voit les données en clair, ce qui est incompatible avec le modèle
// local-first chiffré de bout en bout de Shale. Le modèle est fait de
// snapshots : on relève ses soldes une fois par mois et on déclare ses flux
// récurrents une fois pour toutes.
//
// Contraintes respectées (cf. CLAUDE.md / DESIGN.md) :
// - aucun calcul dans ce fichier : tout vient de `lib/finance/`, testé ;
// - aucun appel réseau bloquant au montage — les cotations viennent du cache et
//   se rafraîchissent derrière ;
// - la section « Trading → € » est RETIRÉE de la grille hors Shale Trade, pas
//   masquée (règle de `features.ts`) ;
// - aucun emoji, icônes maison, toute action non triviale porte une bulle.
import { useState } from "react";

import ComptesPanel, { FormulaireCompte } from "../components/finance/ComptesPanel";
import CourbePatrimoine from "../components/finance/CourbePatrimoine";
import DemarrageFinance, {
  demarrageTermine,
} from "../components/finance/DemarrageFinance";
import EnTeteFinance from "../components/finance/EnTeteFinance";
import FluxPanel, { FormulaireFlux } from "../components/finance/FluxPanel";
import PositionsPanel from "../components/finance/PositionsPanel";
import PontTradingPanel from "../components/finance/PontTradingPanel";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";
import { useEntitlements } from "../lib/entitlements";
import { useFinance } from "../lib/finance/useFinance";
import type { AppData } from "../lib/types";
import { t } from "../lib/i18n";

interface Props {
  /** Uniquement pour `data.trades` : le pont Trading → €. Le reste du module
      charge ses propres tables (patron du Savoir). */
  data: AppData;
}

export default function FinanceView({ data }: Props) {
  const f = useFinance();
  const { hasTrading } = useEntitlements();

  // Signaux d'ouverture envoyés par le parcours de démarrage aux panneaux, qui
  // possèdent leurs formulaires. Un compteur plutôt qu'un booléen : redemander
  // deux fois de suite doit rouvrir le dialogue.
  const [signalCompte, setSignalCompte] = useState(0);
  const [signalRelever, setSignalRelever] = useState(0);
  const [signalFlux, setSignalFlux] = useState(0);
  const [ouvreCompte, setOuvreCompte] = useState(false);
  const [ouvreFlux, setOuvreFlux] = useState(false);

  if (!f.pret)
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-dim">{t("Chargement…")}</p>
      </div>
    );

  const etapes = {
    compte: f.data.comptes.length > 0,
    releve: f.data.balances.length > 0,
    flux: f.data.recurrents.length > 0,
  };
  const enRodage = !demarrageTermine(etapes);

  /**
   * Aucun compte : on n'affiche QUE le parcours de démarrage.
   *
   * Les cinq panneaux n'auraient rien à montrer — cinq cartes presque vides,
   * chacune avec un titre et une phrase centrée. Et au survol, la réserve de
   * `.rgrid-head` fait sauter leur bouton de 64 px vers la gauche pendant que
   * l'ombre de la carte gonfle : sur une carte pleine ça passe inaperçu, sur
   * une carte vide ça se lit comme un défaut d'affichage. C'est le reproche
   * qui a été fait à cet écran, et il était fondé.
   *
   * Le parcours de démarrage porte déjà ses propres boutons « Ajouter un
   * compte » et « Ajouter un flux » : rien n'est perdu, seulement le bruit.
   */
  const vide = f.data.comptes.length === 0 && f.data.recurrents.length === 0;

  return (
    <div className="mx-auto max-w-6xl p-8">
      <header>
        <h1 className="font-display text-3xl text-text">{t("Finance")}</h1>
        <p className="mt-1 text-sm text-text-dim">
          {t(
            "Combien de mois tu tiens si tes revenus s'arrêtent. Pas de tickets de caisse, pas de connexion bancaire.",
          )}
        </p>
      </header>

      {/* Hors de la grille : le parcours de démarrage ne doit pouvoir être ni
          masqué ni redimensionné, sous peine de laisser un module vide sans
          expliquer pourquoi il est vide. */}
      {enRodage && (
        <div className="mt-4">
          <DemarrageFinance
            etapes={etapes}
            onAjouterCompte={() =>
              vide ? setOuvreCompte(true) : setSignalCompte((n) => n + 1)
            }
            onRelever={() => setSignalRelever((n) => n + 1)}
            onAjouterFlux={() => (vide ? setOuvreFlux(true) : setSignalFlux((n) => n + 1))}
          />
        </div>
      )}

      {/* Base entièrement vide : les panneaux ne sont pas montés, donc ce sont
          les formulaires eux-mêmes que le parcours de démarrage ouvre. */}
      {vide && ouvreCompte && (
        <FormulaireCompte
          compte={null}
          onFerme={() => setOuvreCompte(false)}
          onChange={f.recharger}
        />
      )}
      {vide && ouvreFlux && (
        <FormulaireFlux
          flux={null}
          categories={f.data.categories}
          aujourdhui={f.aujourdhui}
          estPerime={false}
          onFerme={() => setOuvreFlux(false)}
          onChange={f.recharger}
        />
      )}

      {!vide && (
      <ResizableGrid gridId="finance" className="mt-4">
        {!enRodage && (
          <ResizablePanel id="finance-entete" defaultW={12}>
            <EnTeteFinance
              runway={f.runway}
              patrimoine={f.patrimoine}
              burn={f.burn}
              devise={f.devise}
            />
          </ResizablePanel>
        )}

        <ResizablePanel id="finance-comptes" defaultW={6}>
          <ComptesPanel
            patrimoine={f.patrimoine}
            comptes={f.data.comptes}
            aujourdhui={f.aujourdhui}
            devise={f.devise}
            onChange={f.recharger}
            signalNouveau={signalCompte}
            signalRelever={signalRelever}
          />
        </ResizablePanel>

        <ResizablePanel id="finance-courbe" defaultW={6}>
          <CourbePatrimoine
            serie={f.serie}
            nbReleves={f.data.balances.length}
            patrimoineCents={f.patrimoine.totalCents}
            burn={f.burn}
            aujourdhui={f.aujourdhui}
            devise={f.devise}
          />
        </ResizablePanel>

        <ResizablePanel id="finance-flux" defaultW={6}>
          <FluxPanel
            recurrents={f.data.recurrents}
            categories={f.data.categories}
            perimes={f.perimes}
            burn={f.burn}
            aujourdhui={f.aujourdhui}
            devise={f.devise}
            onChange={f.recharger}
            signalNouveau={signalFlux}
          />
        </ResizablePanel>

        <ResizablePanel id="finance-positions" defaultW={6}>
          <PositionsPanel
            valorisation={f.valorisation}
            comptes={f.data.comptes}
            devise={f.devise}
            marcheEnCours={f.marcheEnCours}
            erreursMarche={f.erreursMarche}
            onRafraichir={() => void f.rafraichirMarche(true)}
            onChange={f.recharger}
          />
        </ResizablePanel>

        {/* Réservé à Shale Trade. Rendu conditionnel et non `display:none` : la
            grille ne doit pas réserver d'empreinte — ni proposer le panneau
            dans les chips « + <titre> » — pour un contenu sans droit. */}
        {hasTrading && (
          <ResizablePanel id="finance-trading" defaultW={12}>
            <PontTradingPanel
              trades={data.trades}
              burn={f.burn}
              aujourdhui={f.aujourdhui}
              devise={f.devise}
              risqueParRCents={f.risqueParRCents}
              risqueSuggere={f.risqueSuggere}
              onEnregistrerRisque={f.enregistrerRisqueParR}
            />
          </ResizablePanel>
        )}
      </ResizableGrid>
      )}
    </div>
  );
}
